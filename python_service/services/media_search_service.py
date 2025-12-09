"""
Vertex AI Search Service for Media Library

This service provides semantic search capabilities for the media library using
Vertex AI Search (Discovery Engine API). It enables multimodal search across
images, videos, and their metadata.

Features:
- Create and manage data stores per brand for media search
- Index media metadata (titles, descriptions, tags, prompts, AI summaries)
- Semantic search using natural language queries
- Filter by media type, source, collections, and date ranges
- Multimodal search capabilities for images and videos
"""

import logging
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from config import get_settings, get_google_credentials
from config.exceptions import handle_external_api_error

from google.cloud import discoveryengine_v1 as discoveryengine
from google.api_core import exceptions as google_exceptions
from google.protobuf import struct_pb2

logger = logging.getLogger(__name__)

# Configuration (now centralized)
DATA_STORE_TYPE = "SOLUTION_TYPE_SEARCH"

# In-memory cache for data store names
_datastore_cache: Dict[str, str] = {}


@dataclass
class MediaSearchResult:
    """Result from a media search query."""
    media_id: str
    title: str
    description: str
    media_type: str
    url: str
    thumbnail_url: Optional[str]
    source: str
    tags: List[str]
    relevance_score: float
    snippet: Optional[str] = None
    
    # Vision analysis fields
    vision_description: Optional[str] = None
    vision_keywords: Optional[List[str]] = None
    vision_categories: Optional[List[str]] = None
    enhanced_search_text: Optional[str] = None


@dataclass
class MediaSearchResponse:
    """Response from a media search operation."""
    results: List[MediaSearchResult]
    total_count: int
    query: str
    search_time_ms: float
    next_page_token: Optional[str] = None


@dataclass
class MediaIndexResult:
    """Result from indexing media."""
    success: bool
    indexed_count: int
    message: str
    errors: List[str] = None


class MediaSearchService:
    """
    Vertex AI Search Service for Media Library.

    Uses Discovery Engine API to provide semantic search over media metadata
    including titles, descriptions, tags, AI prompts, and explainability summaries.
    """

    def __init__(self, project_id: Optional[str] = None, location: Optional[str] = None):
        """
        Initialize the Media Search service.

        Args:
            project_id: GCP project ID. Defaults to environment variable.
            location: GCP location. Defaults to 'global'.
        """
        # Use centralized configuration
        settings = get_settings()
        self.project_id = project_id or settings.effective_project_id
        self.location = location or settings.search_location

        if not self.project_id:
            logger.warning("No GCP project ID configured for Media Search service")
            return

        # Initialize the Discovery Engine clients with quota project
        try:
            # Get credentials (prioritizes JSON secret over GCE metadata)
            credentials, _ = get_google_credentials(
                quota_project_id=self.project_id
            )

            # Initialize clients with explicit credentials
            self.search_client = discoveryengine.SearchServiceClient(credentials=credentials)
            self.document_client = discoveryengine.DocumentServiceClient(credentials=credentials)
            self.datastore_client = discoveryengine.DataStoreServiceClient(credentials=credentials)
            logger.info(f"Media Search Service initialized: project={self.project_id}, location={self.location}")
        except Exception as e:
            # Convert to standardized exception
            standardized_error = handle_external_api_error(
                e, "Vertex AI Search", "client initialization",
                "Failed to initialize Vertex AI Search clients"
            )
            logger.error(f"Failed to initialize Vertex AI Search clients: {standardized_error.message}")
            logger.error(f"Error details: {standardized_error.details}")
            
            self.search_client = None
            self.document_client = None
            self.datastore_client = None

    def _get_datastore_id(self, brand_id: str) -> str:
        """Generate a data store ID for a brand's media."""
        # Data store IDs must be lowercase alphanumeric with hyphens
        # Use a hash to ensure valid ID format
        safe_brand_id = brand_id.lower().replace('_', '-')
        return f"momentum-media-{safe_brand_id}"

    def _get_datastore_path(self, brand_id: str) -> str:
        """Get the full resource path for a brand's data store."""
        datastore_id = self._get_datastore_id(brand_id)
        # Use the simplified path format (collections are not required for newer API)
        return f"projects/{self.project_id}/locations/{self.location}/dataStores/{datastore_id}"

    def _get_serving_config_path(self, brand_id: str) -> str:
        """Get the serving config path for search."""
        datastore_path = self._get_datastore_path(brand_id)
        return f"{datastore_path}/servingConfigs/default_search"

    def _get_branch_path(self, brand_id: str) -> str:
        """Get the default branch path for document operations."""
        datastore_path = self._get_datastore_path(brand_id)
        return f"{datastore_path}/branches/default_branch"

    def _get_or_create_datastore(self, brand_id: str) -> Optional[str]:
        """
        Get existing data store or create a new one for the brand.

        Args:
            brand_id: Brand ID to get/create data store for.

        Returns:
            Data store resource name or None if failed.
        """
        datastore_id = self._get_datastore_id(brand_id)

        # Check cache first
        if datastore_id in _datastore_cache:
            return _datastore_cache[datastore_id]

        try:
            # Try to get existing data store
            datastore_path = self._get_datastore_path(brand_id)
            try:
                datastore = self.datastore_client.get_data_store(name=datastore_path)
                logger.info(f"Found existing data store: {datastore.name}")
                _datastore_cache[datastore_id] = datastore.name
                return datastore.name
            except google_exceptions.NotFound:
                logger.info(f"Data store not found, will create: {datastore_path}")
                pass  # Data store doesn't exist, create it
            except Exception as get_error:
                logger.warning(f"Error checking for existing data store: {get_error}")
                # Continue to try creating

            # Create new data store
            logger.info(f"Creating new media data store for brand: {brand_id} (ID: {datastore_id})")
            # Use simplified parent path without collections
            parent = f"projects/{self.project_id}/locations/{self.location}"
            logger.info(f"Parent path: {parent}")

            datastore = discoveryengine.DataStore(
                display_name=f"MOMENTUM Media - {brand_id}",
                industry_vertical=discoveryengine.IndustryVertical.GENERIC,
                solution_types=[discoveryengine.SolutionType.SOLUTION_TYPE_SEARCH],
                content_config=discoveryengine.DataStore.ContentConfig.CONTENT_REQUIRED,
            )

            try:
                logger.info(f"Calling create_data_store with parent={parent}, data_store_id={datastore_id}")
                logger.info(f"Data store config: display_name={datastore.display_name}, industry_vertical={datastore.industry_vertical}, solution_types={datastore.solution_types}")
                logger.info(f"Project ID: {self.project_id}, Location: {self.location}")
                
                # Call create_data_store - the client accepts both request object and direct parameters
                operation = self.datastore_client.create_data_store(
                    parent=parent,
                    data_store=datastore,
                    data_store_id=datastore_id,
                )

                # Wait for the operation to complete (increase timeout to 120 seconds)
                logger.info(f"Waiting for data store creation to complete (timeout: 120s)...")
                try:
                    result = operation.result(timeout=120)
                    logger.info(f"Successfully created new data store: {result.name}")
                    logger.info(f"Created data store full details: name={result.name}, display_name={result.display_name}")
                    
                    # Verify the created data store is accessible using the path we expect
                    expected_path = self._get_datastore_path(brand_id)
                    logger.info(f"Verifying data store at expected path: {expected_path}")
                    try:
                        verify_created = self.datastore_client.get_data_store(name=expected_path)
                        logger.info(f"Verified created data store is accessible: {verify_created.name}")
                    except Exception as verify_err:
                        logger.error(f"WARNING: Created data store not accessible at expected path: {verify_err}")
                        logger.error(f"Created path: {result.name}, Expected path: {expected_path}")
                        # Try using the returned name instead
                        try:
                            verify_created = self.datastore_client.get_data_store(name=result.name)
                            logger.info(f"Data store accessible at returned path: {verify_created.name}")
                            # Update cache with the actual path returned
                            _datastore_cache[datastore_id] = result.name
                            return result.name
                        except Exception as retry_err:
                            logger.error(f"Data store not accessible at returned path either: {retry_err}")
                            # Still return it - might just need time to propagate
                    
                    _datastore_cache[datastore_id] = result.name
                    return result.name
                except Exception as wait_error:
                    logger.error(f"Error waiting for data store creation: {wait_error}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    raise
            except google_exceptions.AlreadyExists:
                # Data store was created between check and create - fetch it
                logger.info(f"Data store already exists (race condition), fetching...")
                try:
                    datastore = self.datastore_client.get_data_store(name=datastore_path)
                    logger.info(f"Retrieved existing data store: {datastore.name}")
                    _datastore_cache[datastore_id] = datastore.name
                    return datastore.name
                except Exception as fetch_error:
                    logger.error(f"Failed to fetch data store after AlreadyExists error: {fetch_error}")
                    raise
            except google_exceptions.NotFound as not_found_error:
                error_str = str(not_found_error)
                logger.error(f"NOT_FOUND error creating data store: {error_str}")
                # This usually means the parent location doesn't exist or API not enabled
                if "collection" in error_str.lower():
                    logger.error(f"Location or project may not exist. Parent path: {parent}")
                    logger.error("Discovery Engine API may not be enabled or location is invalid.")
                raise
            except google_exceptions.PermissionDenied as perm_error:
                error_str = str(perm_error)
                logger.error(f"PERMISSION_DENIED error creating data store: {error_str}")
                logger.error("Service account may not have 'Discovery Engine Admin' role")
                raise
            except google_exceptions.FailedPrecondition as precondition_error:
                error_str = str(precondition_error)
                logger.error(f"FAILED_PRECONDITION error creating data store: {error_str}")
                
                # Check if this is a deletion conflict - retry with timestamped ID
                if "is being deleted" in error_str:
                    logger.info(f"Data store is being deleted, retrying with timestamped ID...")
                    timestamp = int(time.time())
                    new_datastore_id = f"{datastore_id}-{timestamp}"
                    logger.info(f"Retrying with new datastore ID: {new_datastore_id}")
                    
                    try:
                        # Try creating with the new timestamped ID
                        operation = self.datastore_client.create_data_store(
                            parent=parent,
                            data_store=datastore,
                            data_store_id=new_datastore_id,
                        )
                        
                        logger.info(f"Waiting for timestamped data store creation to complete...")
                        result = operation.result(timeout=120)
                        logger.info(f"Successfully created timestamped data store: {result.name}")
                        
                        # Cache the new path and return it
                        _datastore_cache[datastore_id] = result.name
                        return result.name
                        
                    except Exception as retry_error:
                        logger.error(f"Failed to create timestamped data store: {retry_error}")
                        # Fall through to original raise
                else:
                    logger.error("This may indicate the API is not enabled or the collection doesn't exist")
                
                raise
            except Exception as create_error:
                error_str = str(create_error)
                logger.error(f"Failed to create data store: {error_str}")
                logger.error(f"Error type: {type(create_error).__name__}")
                logger.error(f"Error code: {getattr(create_error, 'code', 'N/A')}")
                logger.error(f"Error message: {getattr(create_error, 'message', error_str)}")
                # Log full exception details
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                raise

        except google_exceptions.NotFound as not_found:
            error_msg = str(not_found)
            logger.error(f"NOT_FOUND exception in _get_or_create_datastore for brand {brand_id}: {error_msg}")
            if "collection" in error_msg.lower():
                logger.error(
                    f"Discovery Engine location may not exist or API may not be properly enabled. "
                    f"Check if Discovery Engine API is enabled and the location '{self.location}' is valid."
                )
            return None
        except google_exceptions.PermissionDenied as perm_denied:
            error_msg = str(perm_denied)
            logger.error(f"PERMISSION_DENIED exception in _get_or_create_datastore for brand {brand_id}: {error_msg}")
            logger.error(
                f"Service account lacks permissions. Grant 'Discovery Engine Admin' role to your service account. "
                f"Project: {self.project_id}"
            )
            return None
        except Exception as e:
            error_msg = str(e)
            import traceback
            logger.error(f"Exception in _get_or_create_datastore for brand {brand_id}: {error_msg}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            # Check if this is a deletion conflict - retry with timestamped ID
            if "is being deleted" in error_msg:
                logger.info(f"Data store is being deleted, retrying with timestamped ID...")
                timestamp = int(time.time())
                new_datastore_id = f"{self._get_datastore_id(brand_id)}-{timestamp}"
                logger.info(f"Retrying with new datastore ID: {new_datastore_id}")
                
                try:
                    # Try creating with the new timestamped ID
                    parent = f"projects/{self.project_id}/locations/{self.location}"
                    datastore = discoveryengine.DataStore(
                        display_name=f"MOMENTUM Media - {brand_id}",
                        industry_vertical=discoveryengine.IndustryVertical.GENERIC,
                        solution_types=[discoveryengine.SolutionType.SOLUTION_TYPE_SEARCH],
                        content_config=discoveryengine.DataStore.ContentConfig.CONTENT_REQUIRED,
                    )
                    
                    operation = self.datastore_client.create_data_store(
                        parent=parent,
                        data_store=datastore,
                        data_store_id=new_datastore_id,
                    )
                    
                    logger.info(f"Waiting for timestamped data store creation to complete...")
                    result = operation.result(timeout=120)
                    logger.info(f"Successfully created timestamped data store: {result.name}")
                    
                    # Cache the new path and return it
                    _datastore_cache[self._get_datastore_id(brand_id)] = result.name
                    return result.name
                    
                except Exception as retry_error:
                    logger.error(f"Failed to create timestamped data store: {retry_error}")
                    # Continue to the original error handling below
            
            # Provide helpful error messages for common issues
            if "SERVICE_DISABLED" in error_msg or "API has not been used" in error_msg:
                logger.error(
                    f"Discovery Engine API not enabled. "
                    f"Enable it at: https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project={self.project_id}"
                )
            elif "PERMISSION_DENIED" in error_msg:
                logger.error(
                    f"Service account lacks permissions. Grant 'Discovery Engine Admin' role to your service account."
                )
            elif "collections" in error_msg:
                logger.error(
                    f"Data store path format issue detected. "
                    f"This might indicate an API version mismatch or configuration issue. "
                    f"Using simplified path format without collections."
                )
            else:
                logger.error(f"Error getting/creating data store for brand {brand_id}: {e}")
            
            return None

    def _media_to_document(self, media: Dict[str, Any]) -> discoveryengine.Document:
        """
        Convert a media item to a Discovery Engine document.

        Args:
            media: Media item dictionary from Firestore.

        Returns:
            Discovery Engine Document.
        """
        # Build searchable text content from all relevant fields
        text_parts = []

        if media.get('title'):
            text_parts.append(f"Title: {media['title']}")

        if media.get('description'):
            text_parts.append(f"Description: {media['description']}")

        if media.get('prompt'):
            text_parts.append(f"AI Prompt: {media['prompt']}")

        if media.get('tags'):
            text_parts.append(f"Tags: {', '.join(media['tags'])}")

        if media.get('explainability'):
            exp = media['explainability']
            if exp.get('summary'):
                text_parts.append(f"AI Summary: {exp['summary']}")
            if exp.get('brandElements'):
                text_parts.append(f"Brand Elements: {', '.join(exp['brandElements'])}")

        # Include vision analysis fields in search content
        if media.get('visionDescription'):
            text_parts.append(f"Vision Analysis: {media['visionDescription']}")

        if media.get('visionKeywords'):
            text_parts.append(f"Vision Keywords: {', '.join(media['visionKeywords'])}")

        if media.get('visionCategories'):
            text_parts.append(f"Vision Categories: {', '.join(media['visionCategories'])}")

        if media.get('enhancedSearchText'):
            text_parts.append(f"Enhanced Search: {media['enhancedSearchText']}")

        content = "\n".join(text_parts)

        # Build structured data
        struct_data = struct_pb2.Struct()
        struct_data.update({
            "media_id": media.get('id', ''),
            "brand_id": media.get('brandId', ''),
            "title": media.get('title', ''),
            "description": media.get('description', ''),
            "type": media.get('type', 'image'),  # Use 'type' to match Firestore field name
            "source": media.get('source', 'upload'),
            "url": media.get('url', ''),
            "thumbnail_url": media.get('thumbnailUrl', media.get('url', '')),
            "tags": media.get('tags', []),
            "collections": media.get('collections', []),
            "created_at": str(media.get('createdAt', '')),
            "created_by": media.get('createdBy', ''),
            "is_published": media.get('isPublished', False),
            # Include vision analysis fields in structured data
            "vision_description": media.get('visionDescription', ''),
            "vision_keywords": media.get('visionKeywords', []),
            "vision_categories": media.get('visionCategories', []),
            "enhanced_search_text": media.get('enhancedSearchText', ''),
        })

        return discoveryengine.Document(
            id=media.get('id', ''),
            struct_data=struct_data,
            content=discoveryengine.Document.Content(
                mime_type="text/plain",
                raw_bytes=content.encode('utf-8'),
            ),
        )

    def index_media(
        self,
        brand_id: str,
        media_items: List[Dict[str, Any]],
        batch_size: int = 10,
    ) -> MediaIndexResult:
        """
        Index media items into the brand's search data store.

        Args:
            brand_id: Brand ID to index media for.
            media_items: List of media item dictionaries.

        Returns:
            MediaIndexResult with indexing status.
        """
        if not self.project_id or not self.document_client:
            return MediaIndexResult(
                success=False,
                indexed_count=0,
                message="Media Search service not configured",
                errors=["Missing project ID or service not initialized"]
            )

        if not media_items:
            return MediaIndexResult(
                success=True,
                indexed_count=0,
                message="No media items to index"
            )

        start_time = time.time()
        try:
            # Try to ensure data store exists, but gracefully handle failure
            logger.info(f"Getting or creating data store for brand: {brand_id} with {len(media_items)} items")
            try:
                datastore_creation_start = time.time()
                datastore_name = self._get_or_create_datastore(brand_id)
                datastore_creation_time = time.time() - datastore_creation_start
                logger.info(f"Data store operation completed in {datastore_creation_time:.2f}s")
            except Exception as ds_error:
                error_msg = f"Vertex AI Search not available: {str(ds_error)}"
                logger.warning(error_msg)
                logger.info("Media indexing will be skipped - search will use Firestore fallback instead")
                return MediaIndexResult(
                    success=True,  # Don't fail - just indicate that indexing was skipped
                    indexed_count=0,
                    message="Vertex AI Search not available - media will be searchable via Firestore fallback",
                    errors=None
                )
            
            if not datastore_name:
                logger.warning("Data store creation returned None - Vertex AI Search not available")
                logger.info("Media indexing will be skipped - search will use Firestore fallback instead")
                return MediaIndexResult(
                    success=True,  # Don't fail - just indicate that indexing was skipped
                    indexed_count=0,
                    message="Vertex AI Search not available - media will be searchable via Firestore fallback",
                    errors=None
                )
            
            logger.info(f"Using data store: {datastore_name}")
            
            # Verify data store actually exists before proceeding
            # Use the path returned by the API (from creation or cache)
            verified_path = datastore_name
            try:
                verify_datastore = self.datastore_client.get_data_store(name=datastore_name)
                logger.info(f"Verified data store exists at: {verify_datastore.name}")
                verified_path = verify_datastore.name
            except Exception as verify_error:
                logger.warning(f"Data store not accessible at path {datastore_name}: {verify_error}")
                logger.info("Media indexing will be skipped - search will use Firestore fallback instead")
                return MediaIndexResult(
                    success=True,  # Don't fail - just indicate that indexing was skipped
                    indexed_count=0,
                    message="Vertex AI Search not available - media will be searchable via Firestore fallback",
                    errors=None
                )
            
            # Wait a moment to ensure data store is fully ready
            logger.info("Waiting 3 seconds for data store to be fully ready...")
            time.sleep(3)

            # Construct branch path from the verified data store path (not the constructed one)
            # This ensures we use the actual path returned by the API
            if verified_path.endswith('/dataStores/'):
                # Extract data store path and construct branch
                branch_path = f"{verified_path}/branches/default_branch"
            else:
                # Use the verified path to construct branch path
                # The verified_path should be: projects/.../collections/.../dataStores/...
                branch_path = f"{verified_path}/branches/default_branch"
            
            logger.info(f"Using branch path: {branch_path} (constructed from verified data store path: {verified_path})")
            
            # Final verification - try to access the data store one more time
            try:
                final_check = self.datastore_client.get_data_store(name=verified_path)
                logger.info(f"Final verification: data store exists at {final_check.name}")
            except Exception as final_error:
                logger.warning(f"Data store verification failed right before indexing: {final_error}")
                logger.info("Media indexing will be skipped - search will use Firestore fallback instead")
                return MediaIndexResult(
                    success=True,  # Don't fail - just indicate that indexing was skipped
                    indexed_count=0,
                    message="Vertex AI Search not available - media will be searchable via Firestore fallback",
                    errors=None
                )
            
            indexed_count = 0
            errors = []
            indexing_start = time.time()

            # Index media items in batches for better performance
            logger.info(f"Starting batch indexing of {len(media_items)} items (batch size: {batch_size})")
            
            for i in range(0, len(media_items), batch_size):
                batch = media_items[i:i + batch_size]
                batch_start = time.time()
                batch_num = i // batch_size + 1
                total_batches = (len(media_items) + batch_size - 1) // batch_size
                
                logger.info(f"Processing indexing batch {batch_num}/{total_batches} ({len(batch)} items)")
                
                batch_indexed = 0
                for media in batch:
                    media_id = media.get('id', 'unknown')
                    try:
                        document = self._media_to_document(media)

                        # Use create_document with allow_missing to upsert
                        request = discoveryengine.CreateDocumentRequest(
                            parent=branch_path,
                            document=document,
                            document_id=media_id,
                        )

                        logger.debug(f"Indexing media {media_id} to branch: {branch_path}")
                        self.document_client.create_document(request=request)
                        indexed_count += 1
                        batch_indexed += 1
                        logger.debug(f"Successfully indexed media {media_id}")

                    except google_exceptions.NotFound as not_found:
                        # Data store or branch not found - this shouldn't happen if we just created it
                        error_msg = f"Data store or branch not found: {str(not_found)}. Branch path: {branch_path}, Data store: {datastore_name}"
                        logger.error(error_msg)
                        logger.error(f"Full error details: {not_found}")
                        # If this is the first error and it's a NotFound, the data store might not be ready
                        # Try to re-verify the data store
                        if indexed_count == 0 and len(errors) == 0:
                            logger.warning("First indexing attempt failed with NotFound - data store may not be ready yet")
                            try:
                                recheck = self.datastore_client.get_data_store(name=datastore_name)
                                logger.info(f"Data store still exists: {recheck.name}")
                            except Exception as recheck_error:
                                logger.error(f"Data store no longer exists! {recheck_error}")
                                # Return early - don't continue if data store is gone
                                return MediaIndexResult(
                                    success=False,
                                    indexed_count=0,
                                    message="Data store disappeared after creation",
                                    errors=[f"Data store was created but is no longer accessible: {str(recheck_error)}"]
                                )
                        errors.append(f"Failed to index {media_id}: {error_msg}")
                    except google_exceptions.AlreadyExists:
                        # Document exists, update it
                        try:
                            document = self._media_to_document(media)
                            document.name = f"{branch_path}/documents/{media_id}"

                            request = discoveryengine.UpdateDocumentRequest(
                                document=document,
                                allow_missing=True,
                            )

                            logger.debug(f"Updating existing document {media_id}")
                            self.document_client.update_document(request=request)
                            indexed_count += 1
                            batch_indexed += 1
                            logger.debug(f"Successfully updated media {media_id}")
                        except Exception as update_error:
                            error_msg = f"Failed to update {media_id}: {str(update_error)}"
                            logger.error(error_msg)
                            errors.append(error_msg)

                    except Exception as e:
                        error_msg = f"Failed to index {media_id}: {str(e)}"
                        logger.error(error_msg, exc_info=True)
                        errors.append(error_msg)
                
                batch_time = time.time() - batch_start
                logger.info(f"Batch {batch_num} completed: {batch_indexed}/{len(batch)} items indexed successfully (time: {batch_time:.2f}s)")
                
                # Small delay between batches to avoid overwhelming the API
                if batch_num < total_batches:
                    time.sleep(0.1)
            
            indexing_time = time.time() - indexing_start
            total_time = time.time() - start_time
            
            logger.info(f"Indexing completed: {indexed_count}/{len(media_items)} items indexed (indexing: {indexing_time:.2f}s, total: {total_time:.2f}s)")

            success = indexed_count > 0 or len(errors) == 0
            message = f"Indexed {indexed_count}/{len(media_items)} media items"

            if errors:
                message += f" ({len(errors)} errors)"

            return MediaIndexResult(
                success=success,
                indexed_count=indexed_count,
                message=message,
                errors=errors if errors else None
            )

        except Exception as e:
            logger.error(f"Error indexing media: {e}")
            return MediaIndexResult(
                success=False,
                indexed_count=0,
                message=f"Failed to index media: {str(e)}",
                errors=[str(e)]
            )

    def search(
        self,
        brand_id: str,
        query: str,
        media_type: Optional[str] = None,
        source: Optional[str] = None,
        collections: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        page_size: int = 20,
        page_token: Optional[str] = None,
    ) -> MediaSearchResponse:
        """
        Search media using Vertex AI Search.

        Args:
            brand_id: Brand ID to search within.
            query: Natural language search query.
            media_type: Filter by media type ('image' or 'video').
            source: Filter by source ('upload', 'ai-generated', 'brand-soul', etc.).
            collections: Filter by collection IDs.
            tags: Filter by tags.
            page_size: Number of results per page.
            page_token: Token for pagination.

        Returns:
            MediaSearchResponse with search results.
        """
        # Support both single query (string) and multiple queries (list)
        if isinstance(query, list):
            return self.search_multi_query(
                brand_id=brand_id,
                queries=query,
                media_type=media_type,
                source=source,
                collections=collections,
                tags=tags,
                page_size=page_size,
                page_token=page_token,
            )
        start_time = time.time()

        if not self.project_id or not self.search_client:
            return MediaSearchResponse(
                results=[],
                total_count=0,
                query=query,
                search_time_ms=0,
            )

        try:
            serving_config = self._get_serving_config_path(brand_id)

            # CRITICAL: Do NOT expand queries for Vertex AI Search
            # Vertex AI Search handles plurals/singulars automatically and intelligently
            # Manual expansion causes incorrect matches:
            #   - "car" -> "car cars" matches boat images that mention "cars" in context
            #   - "caars" (misspelled) doesn't expand properly, causing inconsistent behavior
            # Use the original query as-is - Vertex AI will handle plural/singular matching correctly
            # Vertex AI Search understands that "car" and "cars" are semantically related
            expanded_query = query

            # Build filter expression
            filter_parts = []

            # DISABLED: Vertex AI Search doesn't support filtering on custom fields
            # The 'type' field is not recognized as a filterable field by Vertex AI
            # We'll handle media type filtering in the client-side processing instead
            # if media_type:
            #     filter_parts.append(f'type="{media_type}"')

            if source:
                if source == 'ai-generated':
                    # AI generated includes multiple source values
                    filter_parts.append('(source="ai-generated" OR source="chatbot" OR source="imagen" OR source="veo")')
                else:
                    filter_parts.append(f'source="{source}"')

            if collections:
                collection_filters = [f'collections="{c}"' for c in collections]
                filter_parts.append(f"({' OR '.join(collection_filters)})")

            if tags:
                tag_filters = [f'tags="{t}"' for t in tags]
                filter_parts.append(f"({' OR '.join(tag_filters)})")

            filter_expr = " AND ".join(filter_parts) if filter_parts else ""

            # Build search request
            request = discoveryengine.SearchRequest(
                serving_config=serving_config,
                query=expanded_query,
                page_size=page_size,
                page_token=page_token or "",
                filter=filter_expr,
                query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                    condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO,
                ),
                spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                    mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO,
                ),
            )

            # Execute search
            response = self.search_client.search(request=request)

            # Parse results
            all_results = []
            for result in response.results:
                doc = result.document
                struct_data = dict(doc.struct_data) if doc.struct_data else {}
                
                all_results.append(MediaSearchResult(
                    media_id=struct_data.get('media_id', doc.id),
                    title=struct_data.get('title', ''),
                    description=struct_data.get('description', ''),
                    media_type=struct_data.get('type', 'image'),
                    url=struct_data.get('url', ''),
                    thumbnail_url=struct_data.get('thumbnail_url'),
                    source=struct_data.get('source', 'upload'),
                    tags=list(struct_data.get('tags', [])),
                    relevance_score=result.relevance_score if hasattr(result, 'relevance_score') else 0.0,
                    snippet=None,  # Can be extracted from snippets if available
                    
                    # Include vision analysis data from structured data
                    vision_description=struct_data.get('vision_description'),
                    vision_keywords=list(struct_data.get('vision_keywords', [])),
                    vision_categories=list(struct_data.get('vision_categories', [])),
                    enhanced_search_text=struct_data.get('enhanced_search_text'),
                ))
            
            # Apply client-side media type filtering since Vertex AI doesn't support it
            if media_type:
                results = [result for result in all_results if result.media_type == media_type]
            else:
                results = all_results

            search_time_ms = (time.time() - start_time) * 1000

            return MediaSearchResponse(
                results=results,
                total_count=response.total_size if hasattr(response, 'total_size') else len(results),
                query=query,
                search_time_ms=search_time_ms,
                next_page_token=response.next_page_token if hasattr(response, 'next_page_token') else None,
            )

        except google_exceptions.NotFound:
            logger.warning(f"Data store not found for brand {brand_id}. No media indexed yet.")
            return MediaSearchResponse(
                results=[],
                total_count=0,
                query=query,
                search_time_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            logger.error(f"Error searching media: {e}")
            return MediaSearchResponse(
                results=[],
                total_count=0,
                query=query,
                search_time_ms=(time.time() - start_time) * 1000,
            )

    def search_multi_query(
        self,
        brand_id: str,
        queries: List[str],
        media_type: Optional[str] = None,
        source: Optional[str] = None,
        collections: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        page_size: int = 20,
        page_token: Optional[str] = None,
    ) -> MediaSearchResponse:
        """
        Search media using multiple queries and merge results (Generative Recommendation pattern).

        This method executes multiple queries in parallel, merges results using RRF-like ranking,
        and returns deduplicated, ranked results.

        Args:
            brand_id: Brand ID to search within.
            queries: List of natural language search queries.
            media_type: Filter by media type ('image' or 'video').
            source: Filter by source ('upload', 'ai-generated', 'brand-soul', etc.).
            collections: Filter by collection IDs.
            tags: Filter by tags.
            page_size: Number of results per page.
            page_token: Token for pagination.

        Returns:
            MediaSearchResponse with merged and ranked search results.
        """
        start_time = time.time()

        if not queries:
            return MediaSearchResponse(
                results=[],
                total_count=0,
                query=", ".join(queries) if queries else "",
                search_time_ms=0,
            )

        # If only one query, use regular search
        if len(queries) == 1:
            return self.search(
                brand_id=brand_id,
                query=queries[0],
                media_type=media_type,
                source=source,
                collections=collections,
                tags=tags,
                page_size=page_size,
                page_token=page_token,
            )

        logger.info(f"Executing multi-query search with {len(queries)} queries: {queries}")

        # Execute all queries in parallel
        all_results = {}  # media_id -> (result, query_index, rank_in_query)
        query_results = []

        for query_idx, query in enumerate(queries):
            try:
                # Execute search for this query
                response = self.search(
                    brand_id=brand_id,
                    query=query,
                    media_type=media_type,
                    source=source,
                    collections=collections,
                    tags=tags,
                    page_size=page_size * 2,  # Get more results per query for better merging
                    page_token=page_token,
                )

                # Track results with their query index and rank
                for rank, result in enumerate(response.results):
                    media_id = result.media_id
                    if media_id not in all_results:
                        all_results[media_id] = {
                            'result': result,
                            'queries': [query_idx],
                            'ranks': [rank + 1],  # 1-indexed rank
                            'scores': [result.relevance_score],
                        }
                    else:
                        # Result appears in multiple queries - merge information
                        all_results[media_id]['queries'].append(query_idx)
                        all_results[media_id]['ranks'].append(rank + 1)
                        all_results[media_id]['scores'].append(result.relevance_score)

                query_results.append((query, response))

            except Exception as e:
                logger.warning(f"Error executing query '{query}': {e}")
                continue

        # Merge and rank results using RRF (Reciprocal Rank Fusion)
        # RRF score = sum(1 / (k + rank)) for each query where result appears
        # k is a constant (typically 60)
        k = 60
        merged_results = []

        for media_id, data in all_results.items():
            result = data['result']
            ranks = data['ranks']
            scores = data['scores']

            # Calculate RRF score
            rrf_score = sum(1.0 / (k + rank) for rank in ranks)

            # Also consider average relevance score
            avg_score = sum(scores) / len(scores) if scores else 0.0

            # Combined score: weighted average of RRF and relevance
            # RRF gives diversity (appearing in multiple queries is good)
            # Relevance gives quality (higher scores are better)
            combined_score = (rrf_score * 0.6) + (avg_score * 0.4)

            merged_results.append({
                'result': result,
                'rrf_score': rrf_score,
                'avg_score': avg_score,
                'combined_score': combined_score,
                'query_count': len(data['queries']),  # How many queries matched this
            })

        # Sort by combined score (descending)
        merged_results.sort(key=lambda x: x['combined_score'], reverse=True)

        # Take top results
        final_results = [item['result'] for item in merged_results[:page_size]]

        # Update relevance scores to reflect combined scores
        for i, item in enumerate(merged_results[:page_size]):
            final_results[i].relevance_score = item['combined_score']

        search_time_ms = (time.time() - start_time) * 1000

        logger.info(
            f"Multi-query search completed: {len(final_results)} results from {len(queries)} queries "
            f"(merged from {len(all_results)} unique items) in {search_time_ms:.2f}ms"
        )

        return MediaSearchResponse(
            results=final_results,
            total_count=len(final_results),
            query=", ".join(queries),
            search_time_ms=search_time_ms,
            next_page_token=page_token,  # TODO: Implement proper pagination for merged results
        )

    def delete_media(self, brand_id: str, media_id: str) -> bool:
        """
        Delete a media document from the search index.

        Args:
            brand_id: Brand ID.
            media_id: Media ID to delete.

        Returns:
            True if deleted successfully.
        """
        if not self.project_id or not self.document_client:
            return False

        try:
            branch_path = self._get_branch_path(brand_id)
            document_name = f"{branch_path}/documents/{media_id}"

            request = discoveryengine.DeleteDocumentRequest(
                name=document_name,
            )

            self.document_client.delete_document(request=request)
            logger.info(f"Deleted media document: {media_id}")
            return True

        except google_exceptions.NotFound:
            logger.warning(f"Media document not found: {media_id}")
            return True  # Already deleted
        except Exception as e:
            logger.error(f"Error deleting media document: {e}")
            return False

    def delete_datastore(self, brand_id: str) -> bool:
        """
        Delete a brand's entire media search data store.

        Args:
            brand_id: Brand ID whose data store to delete.

        Returns:
            True if deleted successfully.
        """
        if not self.project_id or not self.datastore_client:
            return False

        try:
            datastore_id = self._get_datastore_id(brand_id)
            
            # Check if we have a cached datastore name (which could be timestamped)
            if datastore_id in _datastore_cache:
                datastore_path = _datastore_cache[datastore_id]
                logger.info(f"Using cached datastore path for deletion: {datastore_path}")
            else:
                # Fall back to expected path
                datastore_path = self._get_datastore_path(brand_id)
                logger.info(f"Using expected datastore path for deletion: {datastore_path}")

            request = discoveryengine.DeleteDataStoreRequest(
                name=datastore_path,
            )

            operation = self.datastore_client.delete_data_store(request=request)
            
            try:
                # Wait for deletion operation, but handle timeout gracefully
                operation.result(timeout=30)
                logger.info(f"Data store deletion operation completed for brand: {brand_id}")
            except Exception as wait_error:
                # Log the operation issue but continue - deletion may still be in progress
                logger.warning(f"Delete operation had issues but continuing: {wait_error}")
                # Check if the datastore is actually being deleted by trying to get it
                try:
                    # If we can still get the datastore, deletion might not have started
                    check_datastore = self.datastore_client.get_data_store(name=datastore_path)
                    logger.warning(f"Data store still exists after delete operation: {check_datastore.name}")
                    # But we'll still remove it from cache and return success since the operation was initiated
                except google_exceptions.NotFound:
                    logger.info(f"Data store no longer exists - deletion successful")
                except Exception as check_error:
                    logger.info(f"Cannot verify datastore status (expected): {check_error}")

            # Remove from cache regardless - the delete operation was initiated
            if datastore_id in _datastore_cache:
                del _datastore_cache[datastore_id]

            logger.info(f"Deleted data store for brand: {brand_id}")
            return True

        except google_exceptions.NotFound:
            logger.warning(f"Data store not found for brand: {brand_id}")
            return True  # Already deleted
        except Exception as e:
            logger.error(f"Error deleting data store: {e}")
            return False


# Singleton instance
_media_search_service: Optional[MediaSearchService] = None


def get_media_search_service() -> MediaSearchService:
    """Get the singleton Media Search service instance."""
    global _media_search_service
    if _media_search_service is None:
        _media_search_service = MediaSearchService()
    return _media_search_service
