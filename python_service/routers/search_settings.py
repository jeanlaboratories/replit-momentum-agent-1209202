"""
Search Settings API endpoints for managing search configuration and data stores.
"""

import logging
import time
import math
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from models.search_settings import (
    SearchSettings,
    SearchSettingsUpdateRequest, 
    DataStoreDeleteRequest,
    DataStoreCreateRequest,
    SearchStatsResponse,
    IndexingStatus,
    SearchMethod
)
from services.search_settings_service import get_search_settings_service
from services.media_search_service import get_media_search_service
from config.exceptions import (
    ResourceNotFoundError,
    ServiceUnavailableError, 
    ValidationError
)

router = APIRouter(prefix="/search-settings", tags=["search-settings"])
logger = logging.getLogger(__name__)


@router.get("/{brand_id}", response_model=SearchSettings)
async def get_search_settings(brand_id: str):
    """
    Get current search settings for a brand.
    
    Returns search configuration, data store information, and current status.
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    try:
        settings_service = get_search_settings_service()
        settings = settings_service.get_search_settings(brand_id)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Retrieved search settings for brand {brand_id} in {processing_time:.2f}ms")
        
        return settings
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error getting search settings for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get search settings: {str(e)}")


@router.put("/{brand_id}", response_model=SearchSettings)
async def update_search_settings(brand_id: str, request: SearchSettingsUpdateRequest):
    """
    Update search settings for a brand.
    
    Allows switching between Vertex AI Search and Firebase fallback,
    and configuring auto-indexing preferences.
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    try:
        settings_service = get_search_settings_service()
        
        # Note: Allow switching to Vertex AI even if no datastore exists yet
        # The user can create a datastore after switching the search method
        
        updated_settings = settings_service.update_search_settings(
            brand_id=brand_id,
            search_method=request.search_method,
            auto_index=request.auto_index
        )
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Updated search settings for brand {brand_id} in {processing_time:.2f}ms")
        
        return updated_settings
        
    except HTTPException:
        raise
    except ValidationError as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Validation error updating search settings for {brand_id} after {processing_time:.2f}ms: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error updating search settings for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update search settings: {str(e)}")


@router.delete("/{brand_id}/datastore")
async def delete_data_store(brand_id: str, request: DataStoreDeleteRequest):
    """
    Delete a brand's Vertex AI data store.
    
    This will permanently delete all indexed data in Vertex AI Search
    and automatically switch the brand to Firebase fallback search.
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    if brand_id != request.brand_id:
        raise HTTPException(status_code=400, detail="Brand ID mismatch in request")
    
    if not request.confirm_deletion:
        raise HTTPException(status_code=400, detail="Deletion confirmation required")
    
    try:
        settings_service = get_search_settings_service()
        result = settings_service.delete_data_store(brand_id)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Deleted data store for brand {brand_id} in {processing_time:.2f}ms")
        
        return JSONResponse(content={
            **result,
            "processing_time_ms": processing_time
        })
        
    except ResourceNotFoundError as e:
        processing_time = (time.time() - start_time) * 1000
        logger.warning(f"Data store not found for {brand_id} after {processing_time:.2f}ms: {e.message}")
        raise HTTPException(status_code=404, detail=e.message)
    except ServiceUnavailableError as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Service unavailable deleting data store for {brand_id} after {processing_time:.2f}ms: {e.message}")
        raise HTTPException(status_code=503, detail=e.message)
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error deleting data store for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete data store: {str(e)}")


@router.post("/{brand_id}/datastore")
async def create_data_store(brand_id: str, request: DataStoreCreateRequest):
    """
    Create or recreate a brand's Vertex AI data store.
    
    This will create a new data store for indexing media content.
    If force_recreate is true, will delete existing store first.
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    if brand_id != request.brand_id:
        raise HTTPException(status_code=400, detail="Brand ID mismatch in request")
    
    try:
        settings_service = get_search_settings_service()
        result = settings_service.create_data_store(brand_id, request.force_recreate)
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Created data store for brand {brand_id} in {processing_time:.2f}ms")
        
        return JSONResponse(content={
            **result,
            "processing_time_ms": processing_time
        })
        
    except ServiceUnavailableError as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Service unavailable creating data store for {brand_id} after {processing_time:.2f}ms: {e.message}")
        raise HTTPException(status_code=503, detail=e.message)
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error creating data store for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create data store: {str(e)}")


@router.post("/{brand_id}/reindex")
async def reindex_media(brand_id: str, force: bool = Query(False, description="Force reindexing even if up to date"), job_id: str = Query(None, description="Job ID for progress tracking")):
    """
    Trigger reindexing of all media for a brand.
    
    This will index all media items into the current search method
    (Vertex AI Search or Firebase).
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    try:
        # Get current search settings
        settings_service = get_search_settings_service()
        media_search_service = get_media_search_service()
        settings = settings_service.get_search_settings(brand_id)
        
        # Initialize Firestore client with explicit credentials
        from google.cloud import firestore
        from config import get_google_credentials
        credentials, project_id = get_google_credentials()
        db = firestore.Client(credentials=credentials, project=project_id)
        
        # Initialize progress tracking if job_id provided
        if job_id:
            try:
                # Update job to show we've started
                job_ref = db.collection('generationJobs').document(job_id)
                job_ref.update({
                    'progress': 0,
                    'status': 'processing'
                })
            except Exception as e:
                logger.warning(f"Failed to update job progress for {job_id}: {e}")
        media_collection = db.collection('brands').document(brand_id).collection('media')
        
        # Get all media documents
        all_media = []
        docs = media_collection.stream()
        for doc in docs:
            media_data = doc.to_dict()
            media_data['id'] = doc.id  # Ensure ID is included
            all_media.append(media_data)
        
        logger.info(f"Found {len(all_media)} media items to reindex for brand {brand_id}")
        
        if len(all_media) == 0:
            # Complete job if no items to process
            if job_id:
                try:
                    logger.info(f"Updating job {job_id} to completed (0 items)")
                    from datetime import datetime, timezone
                    job_ref = db.collection('generationJobs').document(job_id)
                    job_ref.update({
                        'progress': 100,
                        'status': 'completed',
                        'completedAt': datetime.now(timezone.utc).isoformat()
                    })
                    logger.info(f"Successfully completed job {job_id}")
                except Exception as e:
                    logger.error(f"Failed to complete job {job_id}: {e}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
            
            processing_time = (time.time() - start_time) * 1000
            return JSONResponse(content={
                "success": True,
                "message": "No media items found to reindex",
                "search_method": settings.search_method,
                "processing_time_ms": processing_time,
                "items_processed": 0
            })
        
        # Helper function to update progress
        def update_progress(processed_count: int, total_count: int):
            if job_id and total_count > 0:
                progress = min(100, math.floor((processed_count / total_count) * 100))
                try:
                    job_ref = db.collection('generationJobs').document(job_id)
                    job_ref.update({'progress': progress})
                    logger.debug(f"Updated job {job_id} progress to {progress}%")
                except Exception as e:
                    logger.warning(f"Failed to update job progress for {job_id}: {e}")
        
        # Perform reindexing based on search method
        if settings.search_method == SearchMethod.VERTEX_AI:
            # Index to Vertex AI with progress tracking
            try:
                # Process in batches for progress tracking
                batch_size = 10  # Process 10 items at a time
                success_count = 0
                failed_items = []
                
                for i in range(0, len(all_media), batch_size):
                    batch = all_media[i:i+batch_size]
                    
                    # Process this batch
                    try:
                        result = media_search_service.index_media(brand_id, batch)
                        success_count += result.indexed_count
                        if result.failed_items:
                            failed_items.extend(result.failed_items)
                    except Exception as e:
                        logger.error(f"Failed to index batch {i//batch_size + 1}: {e}")
                        failed_items.extend([item.get('id', f'unknown_{j}') for j, item in enumerate(batch)])
                    
                    # Update progress
                    processed_items = min(i + batch_size, len(all_media))
                    update_progress(processed_items, len(all_media))
                
                message = f"Successfully reindexed {success_count}/{len(all_media)} items to Vertex AI Search"
                
                if failed_items:
                    message += f". {len(failed_items)} items failed"
                    logger.warning(f"Some items failed to index: {failed_items}")
                    
            except Exception as e:
                # Fail the job if there's an error
                if job_id:
                    try:
                        from datetime import datetime, timezone
                        job_ref = db.collection('generationJobs').document(job_id)
                        job_ref.update({
                            'status': 'failed',
                            'errorMessage': f"Vertex AI reindexing failed: {str(e)}",
                            'completedAt': datetime.now(timezone.utc).isoformat()
                        })
                    except Exception as update_e:
                        logger.warning(f"Failed to update failed job status for {job_id}: {update_e}")
                
                logger.error(f"Vertex AI reindexing failed for brand {brand_id}: {e}")
                processing_time = (time.time() - start_time) * 1000
                raise HTTPException(status_code=500, detail=f"Vertex AI reindexing failed: {str(e)}")
                
        else:
            # For Firebase, media items should already be properly structured
            # We can simulate processing for progress tracking
            success_count = len(all_media)
            
            # Simulate progress updates for Firebase (since it's quick)
            for i in range(0, len(all_media), 50):  # Update every 50 items
                update_progress(min(i + 50, len(all_media)), len(all_media))
            
            message = f"Firebase search documents are up to date ({success_count} items)"
        
        # Complete the job
        if job_id:
            try:
                from datetime import datetime, timezone
                job_ref = db.collection('generationJobs').document(job_id)
                job_ref.update({
                    'progress': 100,
                    'status': 'completed',
                    'completedAt': datetime.now(timezone.utc).isoformat()
                })
                logger.info(f"Completed job {job_id}")
            except Exception as e:
                logger.warning(f"Failed to complete job {job_id}: {e}")
        
        processing_time = (time.time() - start_time) * 1000
        logger.info(f"Completed reindexing for brand {brand_id} in {processing_time:.2f}ms")
        
        return JSONResponse(content={
            "success": True,
            "message": message,
            "search_method": settings.search_method,
            "processing_time_ms": processing_time,
            "items_processed": success_count
        })
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error triggering reindex for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger reindexing: {str(e)}")


@router.get("/{brand_id}/status", response_model=IndexingStatus)
async def get_indexing_status(brand_id: str):
    """
    Get current indexing status for a brand.
    
    Returns information about any ongoing indexing operations.
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    try:
        settings_service = get_search_settings_service()
        status = settings_service.get_indexing_status(brand_id)
        
        processing_time = (time.time() - start_time) * 1000
        logger.debug(f"Retrieved indexing status for brand {brand_id} in {processing_time:.2f}ms")
        
        return status
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error getting indexing status for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get indexing status: {str(e)}")


@router.get("/{brand_id}/stats", response_model=SearchStatsResponse)
async def get_search_stats(brand_id: str):
    """
    Get search usage statistics for a brand.
    
    Returns metrics about search performance and usage patterns.
    """
    start_time = time.time()
    
    if not brand_id or not brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    try:
        settings_service = get_search_settings_service()
        stats = settings_service.get_search_stats(brand_id)
        
        processing_time = (time.time() - start_time) * 1000
        logger.debug(f"Retrieved search stats for brand {brand_id} in {processing_time:.2f}ms")
        
        return stats
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        logger.error(f"Error getting search stats for {brand_id} after {processing_time:.2f}ms: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get search stats: {str(e)}")