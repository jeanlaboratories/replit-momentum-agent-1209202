"""
Media Search Tools

Tools for searching the media library using Vertex AI Search or Firebase fallback.
These tools enable the Team Companion agent to find images and videos
using natural language queries and semantic search.

Implements Generative Recommendation pattern:
- Uses Query Generation Agent to research user intent and generate multiple queries
- Executes multi-query search for comprehensive results
- Merges and ranks results using RRF (Reciprocal Rank Fusion)

Respects user's search method preference (Vertex AI vs Firebase).
"""

import logging
import time
from typing import Dict, Any, Optional, List
from utils.context_utils import get_brand_context
from utils.search_utils import intelligent_text_match, intelligent_tag_match
from models.search_settings import SearchMethod

logger = logging.getLogger(__name__)


def _firestore_fallback_search_multi(
    brand_id: str,
    queries: List[str],
    media_type: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Fallback search using Firestore with multiple queries and result merging.
    """
    import time
    start_time = time.time()

    try:
        import firebase_admin
        from firebase_admin import firestore

        # Get Firestore client
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()

        # Query unifiedMedia collection
        collection_ref = db.collection('unifiedMedia')
        query_ref = collection_ref.where('brandId', '==', brand_id)

        # Filter by media type if specified
        if media_type:
            query_ref = query_ref.where('type', '==', media_type)

        # Order by createdAt descending and fetch more for filtering
        fetch_limit = min(limit * 3, 200)  # Fetch more for multi-query merging
        query_ref = query_ref.order_by('createdAt', direction=firestore.Query.DESCENDING)
        query_ref = query_ref.limit(fetch_limit)

        docs = query_ref.stream()

        # Track results per query
        all_results = {}  # media_id -> (media_data, query_matches, match_confidences)

        for doc in docs:
            media_data = doc.to_dict()
            media_data['id'] = doc.id

            # Filter by source if specified
            if source:
                item_source = media_data.get('source', '')
                if source == 'ai-generated':
                    if item_source not in ['ai-generated', 'chatbot', 'imagen', 'veo']:
                        continue
                elif item_source != source:
                    continue

            # Check against all queries
            title = media_data.get('title') or ''
            description = media_data.get('description') or ''
            tags = media_data.get('tags') or []
            prompt = media_data.get('prompt') or ''
            explainability = media_data.get('explainability') or {}
            summary = explainability.get('summary') or ''
            vision_description = media_data.get('visionDescription') or ''
            vision_keywords = media_data.get('visionKeywords') or []
            vision_categories = media_data.get('visionCategories') or []
            enhanced_search_text = media_data.get('enhancedSearchText') or ''
            vision_keywords_text = ' '.join(vision_keywords) if vision_keywords else ''
            vision_categories_text = ' '.join(vision_categories) if vision_categories else ''

            matched_queries = []
            confidences = []

            for query in queries:
                query_lower = query.lower()
                text_match, text_confidence = intelligent_text_match(
                    query, title, description, prompt, summary, vision_description, enhanced_search_text, fuzzy_threshold=0.9
                )
                all_tags = tags + vision_keywords + vision_categories
                tag_match, tag_confidence = intelligent_tag_match(query, all_tags, fuzzy_threshold=0.9)

                if text_match or tag_match:
                    matched_queries.append(query)
                    confidences.append(max(text_confidence, tag_confidence))

            if matched_queries:
                media_id = media_data.get('id')
                if media_id not in all_results:
                    all_results[media_id] = {
                        'media_data': media_data,
                        'matched_queries': matched_queries,
                        'confidences': confidences,
                    }
                else:
                    # Merge with existing matches
                    all_results[media_id]['matched_queries'].extend(matched_queries)
                    all_results[media_id]['confidences'].extend(confidences)

        # Rank results using RRF-like approach
        # Score = sum(1 / (k + rank)) for each query match
        k = 60
        ranked_results = []

        for media_id, data in all_results.items():
            media_data = data['media_data']
            matched_count = len(data['matched_queries'])
            avg_confidence = sum(data['confidences']) / len(data['confidences']) if data['confidences'] else 0.0

            # RRF-like score: more queries matched = higher score
            # Also consider confidence
            rrf_score = matched_count * (1.0 / k)  # Simplified RRF
            combined_score = (rrf_score * 0.6) + (avg_confidence * 0.4)

            ranked_results.append({
                'media_data': media_data,
                'score': combined_score,
                'matched_queries': data['matched_queries'],
            })

        # Sort by score
        ranked_results.sort(key=lambda x: x['score'], reverse=True)

        # Take top results
        results = []
        image_urls = []
        video_urls = []

        for item in ranked_results[:limit]:
            media_data = item['media_data']
            result = {
                "id": media_data.get('id'),
                "title": media_data.get('title', 'Untitled'),
                "description": media_data.get('description', ''),
                "type": media_data.get('type', 'image'),
                "source": media_data.get('source', 'upload'),
                "url": media_data.get('url', ''),
                "thumbnail_url": media_data.get('thumbnailUrl', media_data.get('url', '')),
                "tags": media_data.get('tags', []),
                "relevance_score": item['score'],
                "visionDescription": media_data.get('visionDescription'),
                "visionKeywords": media_data.get('visionKeywords'),
                "visionCategories": media_data.get('visionCategories'),
                "enhancedSearchText": media_data.get('enhancedSearchText'),
            }
            results.append(result)

            if result['type'] == 'image' and result['url']:
                image_urls.append(result['url'])
            elif result['type'] == 'video' and result['url']:
                video_urls.append(result['url'])

        search_time_ms = (time.time() - start_time) * 1000

        if results:
            summary_text = f"Found {len(results)} media items matching queries: {', '.join(queries[:3])}..." if len(queries) > 3 else f"Found {len(results)} media items matching queries: {', '.join(queries)} (via Firestore)."

            media_markers = ""
            for url in image_urls:
                media_markers += f"\n__IMAGE_URL__{url}__IMAGE_URL__"
            for url in video_urls:
                media_markers += f"\n__VIDEO_URL__{url}__VIDEO_URL__"

            return {
                "status": "success",
                "results": results,
                "total_count": len(results),
                "search_time_ms": search_time_ms,
                "query": ", ".join(queries),
                "search_method": "firestore",
                "content": summary_text + media_markers,
                "message": summary_text
            }
        else:
            no_results_text = f"No media found matching queries: {', '.join(queries)}. Try different search terms."
            return {
                "status": "success",
                "results": [],
                "total_count": 0,
                "search_time_ms": search_time_ms,
                "query": ", ".join(queries),
                "search_method": "firestore",
                "content": no_results_text,
                "message": no_results_text
            }
    except Exception as e:
        logger.error(f"Firestore multi-query search failed: {e}")
        error_text = f"Error searching media: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,
            "message": error_text,
            "results": [],
            "total_count": 0
        }


def _firestore_fallback_search(
    brand_id: str,
    query: str,
    media_type: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Fallback search using Firestore when Vertex AI Search returns no results.
    Queries the unifiedMedia collection directly.
    """
    import time
    start_time = time.time()

    try:
        import firebase_admin
        from firebase_admin import firestore

        # Get Firestore client
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()

        # Query unifiedMedia collection
        collection_ref = db.collection('unifiedMedia')
        query_ref = collection_ref.where('brandId', '==', brand_id)

        # Filter by media type if specified
        if media_type:
            query_ref = query_ref.where('type', '==', media_type)

        # Order by createdAt descending and fetch more for filtering
        # Optimized: fetch limit + small buffer instead of 3x (max 100 docs)
        fetch_limit = min(limit + 20, 100)
        query_ref = query_ref.order_by('createdAt', direction=firestore.Query.DESCENDING)
        query_ref = query_ref.limit(fetch_limit)

        docs = query_ref.stream()
        query_lower = query.lower() if query else ""

        results = []
        image_urls = []
        video_urls = []

        # Early exit optimization: stop processing when we have enough results
        for doc in docs:
            if len(results) >= limit:
                break

            media_data = doc.to_dict()
            media_data['id'] = doc.id

            # If there's a search query, filter using intelligent matching
            if query_lower:
                title = media_data.get('title') or ''
                description = media_data.get('description') or ''
                tags = media_data.get('tags') or []
                prompt = media_data.get('prompt') or ''
                explainability = media_data.get('explainability') or {}
                summary = explainability.get('summary') or ''
                
                # Include vision analysis fields in search
                vision_description = media_data.get('visionDescription') or ''
                vision_keywords = media_data.get('visionKeywords') or []
                vision_categories = media_data.get('visionCategories') or []
                enhanced_search_text = media_data.get('enhancedSearchText') or ''
                
                # Convert vision keywords and categories to text for searching
                vision_keywords_text = ' '.join(vision_keywords) if vision_keywords else ''
                vision_categories_text = ' '.join(vision_categories) if vision_categories else ''

                # Use intelligent matching for text fields (handles plurals, stemming, fuzzy)
                # Increased fuzzy threshold to 0.9 to prevent false matches like "caar" matching "car"
                text_match, text_confidence = intelligent_text_match(
                    query, title, description, prompt, summary, vision_description, enhanced_search_text, fuzzy_threshold=0.9
                )

                # Use intelligent matching for tags (include vision keywords and categories)
                # Increased fuzzy threshold to 0.9 to prevent false matches like "caar" matching "car"
                all_tags = tags + vision_keywords + vision_categories
                tag_match, tag_confidence = intelligent_tag_match(query, all_tags, fuzzy_threshold=0.9)


                # Accept if either text or tags match
                if not text_match and not tag_match:
                    continue

                # Store confidence for potential ranking (use best confidence)
                media_data['_match_confidence'] = max(text_confidence, tag_confidence)

            # Filter by source if specified
            if source:
                item_source = media_data.get('source', '')
                if source == 'ai-generated':
                    # AI generated includes multiple source values
                    if item_source not in ['ai-generated', 'chatbot', 'imagen', 'veo']:
                        continue
                elif item_source != source:
                    continue

            result = {
                "id": media_data.get('id'),
                "title": media_data.get('title', 'Untitled'),
                "description": media_data.get('description', ''),
                "type": media_data.get('type', 'image'),
                "source": media_data.get('source', 'upload'),
                "url": media_data.get('url', ''),
                "thumbnail_url": media_data.get('thumbnailUrl', media_data.get('url', '')),
                "tags": media_data.get('tags', []),
                "relevance_score": media_data.get('_match_confidence', 0.5),  # Use intelligent match confidence
                
                # Include vision analysis data
                "visionDescription": media_data.get('visionDescription'),
                "visionKeywords": media_data.get('visionKeywords'),
                "visionCategories": media_data.get('visionCategories'),
                "enhancedSearchText": media_data.get('enhancedSearchText'),
            }
            results.append(result)

            # Collect URLs for visual display
            if result['type'] == 'image' and result['url']:
                image_urls.append(result['url'])
            elif result['type'] == 'video' and result['url']:
                video_urls.append(result['url'])

        search_time_ms = (time.time() - start_time) * 1000

        if results:
            # Standardized text response format with media markers
            summary_text = f"Found {len(results)} media items" + (f" matching '{query}'" if query else "") + " (via Firestore)."

            # Add image URL markers for frontend
            media_markers = ""
            for url in image_urls:
                media_markers += f"\n__IMAGE_URL__{url}__IMAGE_URL__"
            for url in video_urls:
                media_markers += f"\n__VIDEO_URL__{url}__VIDEO_URL__"

            return {
                "status": "success",
                "results": results,
                "total_count": len(results),
                "search_time_ms": search_time_ms,
                "query": query,
                "search_method": "firestore",
                "content": summary_text + media_markers,
                "message": summary_text
            }
        else:
            no_results_text = f"No media found" + (f" matching '{query}'" if query else "") + ". Try different search terms or upload some media first."
            return {
                "status": "success",
                "results": [],
                "total_count": 0,
                "search_time_ms": search_time_ms,
                "query": query,
                "search_method": "firestore",
                "content": no_results_text,
                "message": no_results_text
            }
    except Exception as e:
        logger.error(f"Firestore fallback search failed: {e}")
        error_text = f"Error searching media: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,
            "message": error_text,
            "results": [],
            "total_count": 0
        }


def _get_search_method(brand_id: str) -> SearchMethod:
    """Get the configured search method for a brand."""
    try:
        from services.search_settings_service import get_search_settings_service
        settings_service = get_search_settings_service()
        settings = settings_service.get_search_settings(brand_id)
        return settings.search_method
    except Exception as e:
        logger.warning(f"Could not get search method for {brand_id}, defaulting to Vertex AI: {e}")
        return SearchMethod.VERTEX_AI


def search_media_library(
    query: str,
    brand_id: str = "",
    media_type: str = "",
    source: str = "",
    collections: str = "",
    tags: str = "",
    limit: int = 10,
    use_query_generation: bool = True,
) -> Dict[str, Any]:
    """
    Search the media library using the configured search method with Generative Recommendation.

    This tool implements the Generative Recommendation pattern:
    1. Uses Query Generation Agent to research user intent and generate multiple queries
    2. Executes multi-query search for comprehensive results
    3. Merges and ranks results using RRF (Reciprocal Rank Fusion)

    Use this tool when users ask to find, search for, or look up media in their library.
    Uses the brand's configured search method (Vertex AI Search or Firebase fallback)
    to find images and videos by description, visual content, AI prompts, tags, or any natural language query.

    Examples of when to use this tool:
    - "Find images with blue backgrounds"
    - "Search for videos about product launches"
    - "Look for photos from our marketing campaign"
    - "Find AI-generated images of landscapes"
    - "Show me all brand-soul images"
    - "Find media tagged with 'summer'"

    Args:
        query (str): Natural language search query describing what to find.
        brand_id (str): Brand ID for scoped search. If empty, uses current context.
        media_type (str): Filter by type: 'image' or 'video'. Leave empty for all.
        source (str): Filter by source: 'upload', 'ai-generated', 'brand-soul', 'edited'.
        collections (str): Comma-separated collection IDs to filter by.
        tags (str): Comma-separated tags to filter by.
        limit (int): Maximum number of results to return (default: 10, max: 50).
        use_query_generation (bool): Whether to use query generation agent (default: True).

    Returns:
        dict: Contains 'results' with matched media items, 'total_count', and search metadata.
    """
    try:
        # Generate multiple queries using Query Generation Agent
        queries = [query]  # Default to single query
        
        if use_query_generation and len(query.strip()) > 3:  # Only generate if query is substantial
            try:
                from agents.query_generation_agent import generate_search_queries_sync
                
                # Generate queries using sync wrapper (handles async internally)
                queries = generate_search_queries_sync(user_query=query)
                
                if len(queries) > 1:
                    logger.info(f"Generated {len(queries)} search queries from '{query}': {queries}")
            except Exception as gen_error:
                logger.warning(f"Query generation failed, using original query: {gen_error}")
                queries = [query]
        else:
            queries = [query]
        from services.media_search_service import get_media_search_service

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "Brand ID required for media search. Please ensure user is authenticated."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text,  # Primary text field for consistency with agent
                "message": error_text,  # Backward compatibility
                "results": [],
                "total_count": 0
            }

        # Parse comma-separated lists
        collection_list = [c.strip() for c in collections.split(',') if c.strip()] if collections else None
        tag_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else None

        # Validate and cap limit
        limit = min(max(1, limit), 50)

        # Check the configured search method for this brand
        search_method = _get_search_method(effective_brand_id)
        
        if search_method == SearchMethod.FIREBASE:
            # Use Firebase search with multi-query support
            logger.info(f"Using Firebase search for brand {effective_brand_id} (configured method) with {len(queries)} queries")
            if len(queries) > 1:
                result = _firestore_fallback_search_multi(
                    brand_id=effective_brand_id,
                    queries=queries,
                    media_type=media_type if media_type else None,
                    source=source if source else None,
                    limit=limit
                )
            else:
                result = _firestore_fallback_search(
                    brand_id=effective_brand_id,
                    query=queries[0],
                    media_type=media_type if media_type else None,
                    source=source if source else None,
                    limit=limit
                )
            return result
        else:
            # Use Vertex AI search with multi-query support
            logger.info(f"Using Vertex AI search for brand {effective_brand_id} (configured method) with {len(queries)} queries")
            search_service = get_media_search_service()
            
            if len(queries) > 1:
                # Use multi-query search
                result = search_service.search_multi_query(
                    brand_id=effective_brand_id,
                    queries=queries,
                    media_type=media_type if media_type else None,
                    source=source if source else None,
                    collections=collection_list,
                    tags=tag_list,
                    page_size=limit,
                )
            else:
                # Single query search
                result = search_service.search(
                    brand_id=effective_brand_id,
                    query=queries[0],
                    media_type=media_type if media_type else None,
                    source=source if source else None,
                    collections=collection_list,
                    tags=tag_list,
                    page_size=limit,
                )

        if result.results:
            # Format results for the agent
            formatted_results = []
            image_urls = []
            video_urls = []
            for r in result.results:
                formatted_results.append({
                    "id": r.media_id,
                    "title": r.title,
                    "description": r.description,
                    "type": r.media_type,
                    "source": r.source,
                    "url": r.url,
                    "thumbnail_url": r.thumbnail_url,
                    "tags": r.tags,
                    "relevance_score": r.relevance_score,
                    # Include vision analysis fields
                    "visionDescription": getattr(r, 'vision_description', None),
                    "visionKeywords": getattr(r, 'vision_keywords', None),
                    "visionCategories": getattr(r, 'vision_categories', None),
                    "enhancedSearchText": getattr(r, 'enhanced_search_text', None),
                })
                # Collect URLs for visual display in chat
                if r.media_type == "image" and r.url:
                    image_urls.append(r.url)
                elif r.media_type == "video" and r.url:
                    video_urls.append(r.url)

            # Standardized text response format with media markers for chat display
            summary_text = f"Found {len(formatted_results)} media items matching '{query}'."

            # Add image URL markers for frontend to extract and display nicely
            media_markers = ""
            for url in image_urls:
                media_markers += f"\n__IMAGE_URL__{url}__IMAGE_URL__"
            for url in video_urls:
                media_markers += f"\n__VIDEO_URL__{url}__VIDEO_URL__"

            return {
                "status": "success",
                "results": formatted_results,
                "total_count": result.total_count,
                "search_time_ms": result.search_time_ms,
                "query": result.query,
                "content": summary_text + media_markers,  # Primary text field with media markers
                "message": summary_text   # Backward compatibility (text only)
            }
        else:
            # Vertex AI returned no results, try Firestore fallback
            logger.info(f"Vertex AI Search returned no results for queries '{queries}', trying Firestore fallback")
            if len(queries) > 1:
                return _firestore_fallback_search_multi(
                    brand_id=effective_brand_id,
                    queries=queries,
                    media_type=media_type if media_type else None,
                    source=source if source else None,
                    limit=limit,
                )
            else:
                return _firestore_fallback_search(
                    brand_id=effective_brand_id,
                    query=queries[0],
                    media_type=media_type if media_type else None,
                    source=source if source else None,
                    limit=limit,
                )

    except ImportError as e:
        logger.warning(f"Media search service not available, using Firestore fallback: {e}")
        # Fall back to Firestore when Vertex AI is not available
        effective_brand_id = brand_id or get_brand_context()
        if not effective_brand_id:
            error_text = "Brand ID required for media search. Please ensure user is authenticated."
            return {
                "status": "error",
                "error": error_text,
                "content": error_text,
                "message": error_text,
                "results": [],
                "total_count": 0
            }
        # Fallback to Firestore
        if len(queries) > 1:
            return _firestore_fallback_search_multi(
                brand_id=effective_brand_id,
                queries=queries,
                media_type=media_type if media_type else None,
                source=source if source else None,
                limit=limit,
            )
        else:
            return _firestore_fallback_search(
                brand_id=effective_brand_id,
                query=queries[0],
                media_type=media_type if media_type else None,
                source=source if source else None,
                limit=limit,
            )
    except Exception as e:
        logger.warning(f"Error in Vertex AI search, trying Firestore fallback: {e}")
        # Fall back to Firestore on any Vertex AI error
        effective_brand_id = brand_id or get_brand_context()
        if not effective_brand_id:
            error_text = f"Error searching media: {str(e)}"
            return {
                "status": "error",
                "error": str(e),
                "content": error_text,
                "message": error_text,
                "results": [],
                "total_count": 0
            }
        if len(queries) > 1:
            return _firestore_fallback_search_multi(
                brand_id=effective_brand_id,
                queries=queries,
                media_type=media_type if media_type else None,
                source=source if source else None,
                limit=limit,
            )
        else:
            return _firestore_fallback_search(
                brand_id=effective_brand_id,
                query=queries[0],
                media_type=media_type if media_type else None,
                source=source if source else None,
                limit=limit,
            )


def search_images(
    query: str,
    brand_id: str = "",
    source: str = "",
    limit: int = 10,
    use_query_generation: bool = True,
) -> Dict[str, Any]:
    """
    Search for images in the media library.

    A convenience tool specifically for finding images. Use this when users
    explicitly ask for images, photos, or pictures.

    Examples:
    - "Find product photos"
    - "Search for team pictures"
    - "Look for logo images"
    - "Find AI-generated artwork"

    Args:
        query (str): Natural language search query.
        brand_id (str): Brand ID for scoped search. If empty, uses current context.
        source (str): Filter by source: 'upload', 'ai-generated', 'brand-soul', 'edited'.
        limit (int): Maximum number of results (default: 10, max: 50).
        use_query_generation (bool): Whether to use query generation for enhanced search (default: True).

    Returns:
        dict: Contains 'results' with matched images and search metadata.
    """
    return search_media_library(
        query=query,
        brand_id=brand_id,
        media_type="image",
        source=source,
        limit=limit,
        use_query_generation=use_query_generation,
    )


def search_videos(
    query: str,
    brand_id: str = "",
    source: str = "",
    limit: int = 10,
    use_query_generation: bool = True,
) -> Dict[str, Any]:
    """
    Search for videos in the media library.

    A convenience tool specifically for finding videos. Use this when users
    explicitly ask for videos or video content.

    Examples:
    - "Find product demo videos"
    - "Search for training videos"
    - "Look for AI-generated videos"
    - "Find marketing campaign videos"

    Args:
        query (str): Natural language search query.
        brand_id (str): Brand ID for scoped search. If empty, uses current context.
        source (str): Filter by source: 'upload', 'ai-generated', 'veo'.
        limit (int): Maximum number of results (default: 10, max: 50).
        use_query_generation (bool): Whether to use query generation for enhanced search (default: True).

    Returns:
        dict: Contains 'results' with matched videos and search metadata.
    """
    return search_media_library(
        query=query,
        brand_id=brand_id,
        media_type="video",
        source=source,
        limit=limit,
        use_query_generation=use_query_generation,
    )


def index_brand_media(brand_id: str = "") -> Dict[str, Any]:
    """
    Index all media for a brand into Vertex AI Search.

    This tool triggers indexing of all media items (images and videos) in
    the brand's library to enable semantic search. Use this when:
    - Setting up search for a new brand
    - After bulk media uploads
    - If search results seem incomplete

    Note: Indexing happens automatically when media is uploaded, but this
    tool can be used to ensure all existing media is indexed.
    
    This will automatically create the data store if it doesn't exist.

    Args:
        brand_id (str): Brand ID to index media for. If empty, uses current context.

    Returns:
        dict: Contains indexing status and count of indexed items.
    """
    try:
        from services.media_search_service import get_media_search_service
        import firebase_admin
        from firebase_admin import firestore

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "Please ensure you're logged in to index media."
            return {
                "status": "error",
                "error": "Brand ID required for media indexing.",
                "content": error_text,  # Primary text field for consistency
                "message": error_text   # Backward compatibility
            }

        # Get the media search service (this will ensure data store is created)
        search_service = get_media_search_service()

        if not search_service.project_id:
            error_text = (
                "Vertex AI Search is not configured. "
                "Media indexing requires the Discovery Engine API to be enabled. "
                "The data store cannot be created without this configuration."
            )
            return {
                "status": "error",
                "error": "Vertex AI Search not configured",
                "content": error_text,
                "message": error_text
            }

        # Get Firestore client
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()

        # Fetch all media for the brand
        logger.info(f"Fetching media items for brand {effective_brand_id} to index")
        docs = db.collection('unifiedMedia').where('brandId', '==', effective_brand_id).stream()
        media_items = []
        for doc in docs:
            media_data = doc.to_dict()
            media_data['id'] = doc.id
            media_items.append(media_data)

        logger.info(f"Found {len(media_items)} media items to index for brand {effective_brand_id}")

        if not media_items:
            success_text = f"No media items found for brand {effective_brand_id} to index."
            return {
                "status": "success",
                "content": success_text,
                "message": success_text,
                "brand_id": effective_brand_id,
                "indexed_count": 0
            }

        # Index the media items (this will create the data store if it doesn't exist)
        result = search_service.index_media(
            brand_id=effective_brand_id,
            media_items=media_items,
        )

        # Format response
        if result.success:
            success_text = (
                f"Successfully indexed {result.indexed_count}/{len(media_items)} media items "
                f"for brand {effective_brand_id}. "
            )
            if result.errors:
                success_text += f"Encountered {len(result.errors)} errors during indexing."
            
            return {
                "status": "success",
                "content": success_text,
                "message": success_text,
                "brand_id": effective_brand_id,
                "indexed_count": result.indexed_count,
                "total_count": len(media_items),
                "errors": result.errors if result.errors else None
            }
        else:
            error_text = (
                f"Failed to index media for brand {effective_brand_id}. "
                f"Indexed {result.indexed_count}/{len(media_items)} items. "
            )
            if result.errors:
                error_text += f"Errors: {', '.join(result.errors[:3])}"  # Show first 3 errors
            
            return {
                "status": "error",
                "error": result.message,
                "content": error_text,
                "message": error_text,
                "brand_id": effective_brand_id,
                "indexed_count": result.indexed_count,
                "total_count": len(media_items),
                "errors": result.errors
            }

    except Exception as e:
        logger.error(f"Error in index_brand_media: {e}", exc_info=True)
        error_text = f"Error indexing media: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,  # Primary text field for consistency
            "message": error_text   # Backward compatibility
        }
