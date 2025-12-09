import logging
import time
from fastapi import APIRouter, HTTPException, Request
from models.requests import GenerateVideoRequest, MediaSearchRequest, MediaIndexRequest, NanoBananaRequest, GenerateImageRequest
from momentum_agent import generate_video
from tools.media_tools import nano_banana, generate_image

router = APIRouter(prefix="/media", tags=["media"])
logger = logging.getLogger(__name__)


# ============================================================================
# Vertex AI Search Endpoints
# ============================================================================

@router.post("/search")
async def search_media_endpoint(request: MediaSearchRequest):
    """
    Semantic search for media using Vertex AI Search with Generative Recommendation.

    This endpoint implements the Generative Recommendation pattern:
    1. Uses Query Generation Agent to research user intent and generate multiple queries
    2. Executes multi-query search for comprehensive results
    3. Merges and ranks results using RRF (Reciprocal Rank Fusion)

    This provides natural language search across the media library,
    finding images and videos by description, tags, prompts, or visual features.
    """
    start_time = time.time()
    
    # Input validation
    if not request.brand_id or not request.brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Search query is required")
    
    if len(request.query) > 500:
        raise HTTPException(status_code=400, detail="Search query too long (max 500 characters)")
    
    try:
        from services.media_search_service import get_media_search_service
        from agents.query_generation_agent import generate_search_queries

        logger.info(f"Media search request: query='{request.query[:100]}{'...' if len(request.query) > 100 else ''}', brand={request.brand_id}")

        # Generate multiple queries using Query Generation Agent
        queries = [request.query]  # Default to single query
        
        # Only generate if query is substantial and not too short
        use_query_generation = getattr(request, 'use_query_generation', True)  # Default to True
        if use_query_generation and len(request.query.strip()) > 3:
            try:
                from agents.query_generation_agent import generate_search_queries_async
                queries = await generate_search_queries_async(user_query=request.query)
                logger.info(f"Generated {len(queries)} search queries: {queries}")
            except Exception as gen_error:
                logger.warning(f"Query generation failed, using original query: {gen_error}")
                queries = [request.query]
        else:
            queries = [request.query]

        search_service = get_media_search_service()
        
        # Use multi-query search if we have multiple queries
        if len(queries) > 1:
            result = search_service.search_multi_query(
                brand_id=request.brand_id,
                queries=queries,
                media_type=request.media_type,
                source=request.source,
                collections=request.collections,
                tags=request.tags,
                page_size=request.limit or 20,
            )
        else:
            result = search_service.search(
                brand_id=request.brand_id,
                query=queries[0],
                media_type=request.media_type,
                source=request.source,
                collections=request.collections,
                tags=request.tags,
                page_size=request.limit or 20,
            )

        # If Vertex AI Search returns no results, try Firestore fallback
        if result.total_count == 0 and queries:
            logger.info(f"No Vertex AI results for queries '{queries}', trying Firestore fallback")
            try:
                from tools.media_search_tools import search_media_library
                # Use the first query for fallback (or could use all queries)
                fallback_result = search_media_library(
                    query=queries[0] if queries else request.query,
                    brand_id=request.brand_id,
                    media_type=request.media_type,
                    limit=request.limit or 20,
                    use_query_generation=False  # Don't generate again in fallback
                )
                
                if fallback_result.get('status') == 'success' and fallback_result.get('results'):
                    # Convert firestore results to the expected format
                    formatted_results = []
                    for r in fallback_result['results']:
                        formatted_results.append({
                            "id": r.get('id', ''),
                            "title": r.get('title', ''),
                            "description": r.get('description', ''),
                            "type": r.get('type', 'image'),
                            "source": r.get('source', 'unknown'),
                            "url": r.get('url', ''),
                            "thumbnailUrl": r.get('thumbnailUrl') or r.get('url', ''),
                            "tags": r.get('tags', []),
                            "relevanceScore": r.get('relevance_score', 0.5),
                            
                            # Include vision analysis data from firestore fallback
                            "visionDescription": r.get('visionDescription'),
                            "visionKeywords": r.get('visionKeywords'),
                            "visionCategories": r.get('visionCategories'),
                            "enhancedSearchText": r.get('enhancedSearchText'),
                        })
                    
                    return {
                        "status": "success",
                        "results": formatted_results,
                        "total_count": fallback_result.get('total_count', len(formatted_results)),
                        "query": request.query,
                        "search_time_ms": fallback_result.get('search_time_ms', 0),
                        "search_method": "firestore_fallback"
                    }
            except Exception as fallback_error:
                logger.warning(f"Firestore fallback also failed: {fallback_error}")

        # Format results for API response
        formatted_results = []
        for r in result.results:
            formatted_results.append({
                "id": r.media_id,
                "title": r.title,
                "description": r.description,
                "type": r.media_type,
                "source": r.source,
                "url": r.url,
                "thumbnailUrl": r.thumbnail_url,
                "tags": r.tags,
                "relevanceScore": r.relevance_score,
                # Include vision analysis fields from Vertex AI results
                "visionDescription": getattr(r, 'vision_description', None),
                "visionKeywords": getattr(r, 'vision_keywords', None),
                "visionCategories": getattr(r, 'vision_categories', None),
                "enhancedSearchText": getattr(r, 'enhanced_search_text', None),
            })

        total_time_ms = (time.time() - start_time) * 1000
        logger.info(f"Search completed: {len(formatted_results)} results in {total_time_ms:.2f}ms")
        
        return {
            "status": "success",
            "results": formatted_results,
            "total_count": result.total_count,
            "query": result.query,
            "search_time_ms": result.search_time_ms,
            "total_time_ms": total_time_ms,
        }

    except HTTPException:
        raise
    except Exception as e:
        total_time_ms = (time.time() - start_time) * 1000
        logger.error(f"Error in search_media_endpoint after {total_time_ms:.2f}ms: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/index")
async def index_media_endpoint(request: MediaIndexRequest):
    """
    Index media items into Vertex AI Search for semantic search.

    This endpoint is called when media is uploaded or updated to ensure
    it's searchable. It indexes media metadata including titles, descriptions,
    tags, prompts, and AI-generated summaries.
    """
    start_time = time.time()
    
    # Input validation
    if not request.brand_id or not request.brand_id.strip():
        raise HTTPException(status_code=400, detail="Brand ID is required")
    
    if not request.media_items:
        return {
            "success": True,
            "indexed_count": 0,
            "message": "No media items to index",
            "time_ms": (time.time() - start_time) * 1000
        }
    
    if len(request.media_items) > 1000:
        raise HTTPException(status_code=400, detail="Too many media items (max 1000 per request)")
    
    # Validate media items structure
    for i, item in enumerate(request.media_items):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"Media item {i} must be a dictionary")
        if not item.get('id'):
            raise HTTPException(status_code=400, detail=f"Media item {i} missing required 'id' field")
    
    try:
        from services.media_search_service import get_media_search_service

        logger.info(f"Media index request: brand={request.brand_id}, count={len(request.media_items)}")

        # Input validation handled above

        search_service = get_media_search_service()
        result = search_service.index_media(
            brand_id=request.brand_id,
            media_items=request.media_items,
        )
        
        total_time_ms = (time.time() - start_time) * 1000
        logger.info(f"Indexing completed: {result.indexed_count}/{len(request.media_items)} items in {total_time_ms:.2f}ms")

        return {
            "success": result.success,
            "indexed_count": result.indexed_count,
            "message": result.message,
            "errors": result.errors,
            "time_ms": total_time_ms,
        }

    except HTTPException:
        raise
    except Exception as e:
        total_time_ms = (time.time() - start_time) * 1000
        logger.error(f"Error in index_media_endpoint after {total_time_ms:.2f}ms: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

@router.get("/test-datastore/{brand_id}")
async def test_datastore_endpoint(brand_id: str):
    """
    Test endpoint to debug data store creation.
    Returns detailed information about data store creation attempt.
    """
    try:
        from services.media_search_service import get_media_search_service
        
        search_service = get_media_search_service()
        
        if not search_service.project_id:
            return {
                "status": "error",
                "message": "Vertex AI Search not configured",
                "project_id": None
            }
        
        logger.info(f"Testing data store creation for brand: {brand_id}")
        
        # Try to get or create the data store
        datastore_name = search_service._get_or_create_datastore(brand_id)
        
        if datastore_name:
            # Try to verify it exists
            try:
                verify = search_service.datastore_client.get_data_store(name=datastore_name)
                return {
                    "status": "success",
                    "message": "Data store exists and is accessible",
                    "datastore_name": datastore_name,
                    "verified_name": verify.name,
                    "project_id": search_service.project_id,
                    "location": search_service.location
                }
            except Exception as verify_error:
                return {
                    "status": "warning",
                    "message": "Data store creation returned a path, but verification failed",
                    "datastore_name": datastore_name,
                    "verification_error": str(verify_error),
                    "project_id": search_service.project_id,
                    "location": search_service.location
                }
        else:
            return {
                "status": "error",
                "message": "Data store creation returned None",
                "project_id": search_service.project_id,
                "location": search_service.location,
                "suggestion": "Check Python service logs for creation errors"
            }
            
    except Exception as e:
        logger.error(f"Error in test_datastore_endpoint: {e}")
        import traceback
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }

@router.post("/generate-video")
async def generate_video_endpoint(request: GenerateVideoRequest):
    """
    Generate a video using Veo 3.1 via the Python SDK.
    This endpoint is used by the Video Gallery to ensure consistent behavior with the Agent.
    """
    try:
        logger.info(f"Received video generation request: {request.prompt[:50]}...")
        
        # Call the shared generation function from momentum_agent
        # This ensures we use the same logic as the agent's tool
        # Note: generate_video is a sync function (it blocks while polling for video generation)
        result = generate_video(
            prompt=request.prompt,
            image_url=request.image_url,
            start_frame=request.start_frame_url,
            end_frame=request.end_frame_url,
            aspect_ratio=request.aspect_ratio,
            # Veo 3.1 additional parameters
            video_url=request.video_url,  # Video Extension (deprecated, use veo_video_uri)
            character_reference=request.character_reference,  # Ingredients mode
            resolution=request.resolution,
            duration_seconds=request.duration_seconds,
            person_generation=request.person_generation,
            reference_images=request.reference_images,
            use_fast_model=request.use_fast_model,
            veo_video_uri=request.veo_video_uri,  # Video Extension (preferred)
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        # Transform snake_case to camelCase for TypeScript frontend compatibility
        # Handle both URL and base64 formats
        video_url = result.get("video_url")
        if not video_url and result.get("video_data"):
            # Convert base64 data to data URL
            video_url = f"data:video/mp4;base64,{result.get('video_data')}"

        return {
            "status": result.get("status"),
            "message": result.get("message"),
            "videoUrl": video_url,  # camelCase for frontend
            "veoVideoUri": result.get("veo_video_uri"),  # Gemini API file URI for video extension
            "format": result.get("format"),
            "prompt": result.get("prompt"),
        }
        
    except Exception as e:
        logger.error(f"Error in generate_video_endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Character-Consistent Image Generation (Nano Banana)
# ============================================================================

@router.post("/nano-banana")
async def nano_banana_endpoint(request: NanoBananaRequest):
    """
    Generate character-consistent images using Nano Banana (Gemini 2.5 Flash Image).

    This endpoint provides image generation with character consistency by accepting
    reference images (character sheets) that the model uses to maintain visual
    consistency across multiple generated images.

    Use this for:
    - Campaign images with recurring characters
    - Brand mascot generation across multiple scenes
    - Event visuals with consistent character representation
    """
    try:
        logger.info(f"Nano Banana request: prompt='{request.prompt[:50]}...', ref_images={len(request.reference_images.split(',')) if request.reference_images else 0}")

        # Call the nano_banana function from media_tools
        result = nano_banana(
            prompt=request.prompt,
            image_url=request.image_url or "",
            reference_images=request.reference_images or "",
            mask_url=request.mask_url or "",
            mode=request.mode or "",
            aspect_ratio=request.aspect_ratio or "1:1",
            number_of_images=request.number_of_images or 1,
            person_generation=request.person_generation or "allow_all"
        )

        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))

        # Transform snake_case to camelCase for TypeScript frontend compatibility
        # Handle both URL and base64 formats - convert base64 to data URL if needed
        image_url = result.get("image_url")
        image_urls = result.get("image_urls")

        # If no URL but base64 data is present, convert to data URL
        if not image_url and result.get("image_data"):
            image_url = f"data:image/png;base64,{result.get('image_data')}"
            image_urls = [image_url]

        return {
            "status": result.get("status"),
            "message": result.get("message"),
            "imageUrl": image_url,      # camelCase for frontend
            "imageUrls": image_urls,    # Array for multi-image consumers
            "format": result.get("format"),
            "prompt": result.get("prompt"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in nano_banana_endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Image Generation (Imagen 4.0 with Multi-Image Support)
# ============================================================================

@router.post("/analyze-vision")
async def analyze_vision_endpoint(request: Request):
    """
    Enhance media items with vision analysis (detailed descriptions and search keywords).
    
    This endpoint analyzes images using Gemini Vision to generate:
    - Detailed descriptions of visual content
    - Searchable keywords and tags
    - Content categories
    
    The analysis is stored back to Firestore to improve search quality.
    """
    try:
        data = await request.json()
        brand_id = data.get("brand_id")
        media_ids = data.get("media_ids", [])  # Optional: specific media to analyze
        analyze_all = data.get("analyze_all", False)  # If true, analyze all media for brand
        
        if not brand_id:
            raise HTTPException(status_code=400, detail="Brand ID is required")
        
        from services.vision_analysis_service import get_vision_analysis_service
        import firebase_admin
        from firebase_admin import firestore
        
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()
        
        # Fetch media items to analyze
        if analyze_all or not media_ids:
            logger.info(f"Fetching all media for vision analysis: brand={brand_id}")
            docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
            media_items = []
            for doc in docs:
                media_data = doc.to_dict()
                media_data['id'] = doc.id
                media_items.append(media_data)
        else:
            logger.info(f"Fetching specific media items for analysis: {len(media_ids)} items")
            media_items = []
            for media_id in media_ids:
                doc = db.collection('unifiedMedia').document(media_id).get()
                if doc.exists:
                    media_data = doc.to_dict()
                    media_data['id'] = doc.id
                    media_items.append(media_data)
        
        if not media_items:
            return {
                "status": "success",
                "message": "No media items found to analyze",
                "analyzed_count": 0
            }
        
        # Get analysis statistics before starting
        vision_service = get_vision_analysis_service()
        stats_before = vision_service.get_analysis_stats(media_items)
        
        logger.info(f"Starting vision analysis for {len(media_items)} media items")
        total_analyzable = stats_before.get('total_analyzable_media', stats_before.get('total_images', 0) + stats_before.get('total_videos', 0))
        logger.info(f"Analysis stats: {stats_before.get('analyzed', 0)}/{total_analyzable} media items already analyzed")
        
        # Analyze media items
        enhanced_items = await vision_service.analyze_media_batch(media_items)
        
        # Update Firestore with vision analysis using batch operations
        analyzed_count = 0
        errors = []
        batch_size = 500  # Firestore batch limit is 500 operations
        
        # Collect detailed error information
        vision_errors = []
        for item in enhanced_items:
            if item.get('_vision_error'):
                error_info = {
                    'media_id': item.get('id'),
                    'source': item.get('source'),
                    'error': item['_vision_error'],
                    'url': item.get('url', item.get('thumbnailUrl', 'No URL found'))
                }
                vision_errors.append(error_info)
                logger.warning(f"Vision analysis error for {item.get('id')} (source: {item.get('source')}): {item['_vision_error']}")
        
        # Prepare batch operations
        updates_to_perform = []
        for item in enhanced_items:
            # Only update if we have vision data
            if item.get('visionDescription') or item.get('visionKeywords') or item.get('visionCategories'):
                update_data = {}
                if item.get('visionDescription'):
                    update_data['visionDescription'] = item['visionDescription']
                if item.get('visionKeywords'):
                    update_data['visionKeywords'] = item['visionKeywords']
                if item.get('visionCategories'):
                    update_data['visionCategories'] = item['visionCategories']
                if item.get('enhancedSearchText'):
                    update_data['enhancedSearchText'] = item['enhancedSearchText']
                
                if update_data:
                    updates_to_perform.append({
                        'id': item['id'],
                        'data': update_data
                    })
        
        # Log detailed statistics
        logger.info(f"Vision analysis results: {len(updates_to_perform)} items to update, {len(vision_errors)} items with errors")
        
        # Log source breakdown of errors
        if vision_errors:
            source_breakdown = {}
            for error_info in vision_errors:
                source = error_info['source']
                if source not in source_breakdown:
                    source_breakdown[source] = 0
                source_breakdown[source] += 1
            logger.warning(f"Vision analysis errors by source: {source_breakdown}")
        
        # Process updates in batches
        for i in range(0, len(updates_to_perform), batch_size):
            batch_updates = updates_to_perform[i:i + batch_size]
            batch = db.batch()
            
            try:
                for update in batch_updates:
                    doc_ref = db.collection('unifiedMedia').document(update['id'])
                    batch.update(doc_ref, update['data'])
                
                # Commit the batch
                batch.commit()
                analyzed_count += len(batch_updates)
                logger.info(f"Batch updated {len(batch_updates)} media items with vision data")
                
            except Exception as e:
                # If batch fails, fall back to individual updates for this batch
                logger.warning(f"Batch update failed, falling back to individual updates: {str(e)}")
                for update in batch_updates:
                    try:
                        doc_ref = db.collection('unifiedMedia').document(update['id'])
                        doc_ref.update(update['data'])
                        analyzed_count += 1
                        logger.info(f"Updated vision data for media: {update['id']}")
                    except Exception as individual_error:
                        error_msg = f"Failed to update media {update['id']}: {str(individual_error)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
        
        # Prepare detailed response
        detailed_errors = []
        for error_info in vision_errors:
            detailed_errors.append(f"{error_info['media_id']} ({error_info['source']}): {error_info['error']}")
        
        # Add any Firestore update errors
        if errors:
            detailed_errors.extend(errors)
        
        return {
            "status": "success",
            "message": f"Vision analysis complete",
            "analyzed_count": analyzed_count,
            "total_items": len(media_items),
            "errors": detailed_errors if detailed_errors else None,
            "error_breakdown": {
                "vision_analysis_errors": len(vision_errors),
                "firestore_update_errors": len(errors),
                "total_errors": len(vision_errors) + len(errors)
            } if (vision_errors or errors) else None
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_vision_endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-vision-force")
async def analyze_vision_force_endpoint(request: Request):
    """
    Force vision analysis on ALL images, including previously failed ones.
    
    This endpoint ignores existing visionDescription and reanalyzes everything
    to achieve 100% success rate. Use sparingly due to API costs.
    """
    try:
        data = await request.json()
        brand_id = data.get("brand_id")
        
        if not brand_id:
            raise HTTPException(status_code=400, detail="Brand ID is required")
        
        from services.vision_analysis_service import get_vision_analysis_service
        import firebase_admin
        from firebase_admin import firestore
        
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()
        
        # Fetch ALL images regardless of analysis status
        logger.info(f"Force analyzing ALL images for brand: {brand_id}")
        docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
        media_items = []
        for doc in docs:
            media_data = doc.to_dict()
            media_data['id'] = doc.id
            media_items.append(media_data)
        
        # Filter to only images but remove the "already analyzed" check
        all_images = [item for item in media_items if item.get('type') == 'image']
        
        if not all_images:
            return {
                "status": "success", 
                "message": "No images found to analyze",
                "analyzed_count": 0
            }
        
        logger.info(f"Found {len(all_images)} images total for force analysis")
        
        # Temporarily remove visionDescription to force reanalysis
        images_for_analysis = []
        for item in all_images:
            # Create a copy without vision data to force analysis
            clean_item = {k: v for k, v in item.items() 
                         if k not in ['visionDescription', 'visionKeywords', 'visionCategories', 'enhancedSearchText']}
            images_for_analysis.append(clean_item)
        
        vision_service = get_vision_analysis_service()
        
        # Force analyze all images
        enhanced_items = await vision_service.analyze_media_batch(images_for_analysis, batch_size=3)  # Smaller batches for reliability
        
        # Update Firestore with results
        analyzed_count = 0
        errors = []
        vision_errors = []
        
        # Collect errors and successful analyses
        for item in enhanced_items:
            if item.get('_vision_error'):
                vision_errors.append({
                    'media_id': item.get('id'),
                    'source': item.get('source'), 
                    'error': item['_vision_error'],
                    'url': item.get('url', item.get('thumbnailUrl', 'No URL'))
                })
        
        # Update successful analyses
        batch_size = 500
        updates_to_perform = []
        for item in enhanced_items:
            if item.get('visionDescription') or item.get('visionKeywords') or item.get('visionCategories'):
                update_data = {}
                if item.get('visionDescription'):
                    update_data['visionDescription'] = item['visionDescription']
                if item.get('visionKeywords'):
                    update_data['visionKeywords'] = item['visionKeywords']
                if item.get('visionCategories'):
                    update_data['visionCategories'] = item['visionCategories']
                if item.get('enhancedSearchText'):
                    update_data['enhancedSearchText'] = item['enhancedSearchText']
                
                if update_data:
                    updates_to_perform.append({
                        'id': item['id'],
                        'data': update_data
                    })
        
        # Batch update to Firestore
        for i in range(0, len(updates_to_perform), batch_size):
            batch_updates = updates_to_perform[i:i + batch_size]
            batch = db.batch()
            
            try:
                for update in batch_updates:
                    doc_ref = db.collection('unifiedMedia').document(update['id'])
                    batch.update(doc_ref, update['data'])
                
                batch.commit()
                analyzed_count += len(batch_updates)
                logger.info(f"Force updated {len(batch_updates)} media items")
                
            except Exception as e:
                logger.error(f"Batch update failed: {e}")
                # Try individual updates
                for update in batch_updates:
                    try:
                        doc_ref = db.collection('unifiedMedia').document(update['id'])
                        doc_ref.update(update['data'])
                        analyzed_count += 1
                    except Exception as individual_error:
                        error_msg = f"Failed to update media {update['id']}: {str(individual_error)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
        
        # Detailed error reporting
        detailed_errors = []
        for error_info in vision_errors:
            detailed_errors.append(f"{error_info['media_id']} ({error_info['source']}): {error_info['error']}")
        if errors:
            detailed_errors.extend(errors)
        
        success_rate = (analyzed_count / len(all_images)) * 100 if all_images else 0
        
        logger.info(f"Force analysis complete: {analyzed_count}/{len(all_images)} images analyzed ({success_rate:.1f}% success rate)")
        
        return {
            "status": "success",
            "message": f"Force vision analysis complete - {success_rate:.1f}% success rate",
            "analyzed_count": analyzed_count,
            "total_images": len(all_images),
            "success_rate": round(success_rate, 1),
            "errors": detailed_errors if detailed_errors else None,
            "error_breakdown": {
                "vision_analysis_errors": len(vision_errors),
                "firestore_update_errors": len(errors),
                "total_errors": len(vision_errors) + len(errors)
            } if (vision_errors or errors) else None
        }
        
    except Exception as e:
        logger.error(f"Error in force vision analysis: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vision-stats/{brand_id}")
async def get_vision_stats_endpoint(brand_id: str):
    """
    Get vision analysis statistics for a brand's media.
    
    Returns counts of analyzed vs unanalyzed images to help with progress tracking.
    """
    try:
        from services.vision_analysis_service import get_vision_analysis_service
        import firebase_admin
        from firebase_admin import firestore
        
        try:
            db = firestore.client()
        except ValueError:
            firebase_admin.initialize_app()
            db = firestore.client()
        
        # Fetch media items
        docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
        media_items = []
        for doc in docs:
            media_data = doc.to_dict()
            media_data['id'] = doc.id
            media_items.append(media_data)
        
        # Get statistics
        vision_service = get_vision_analysis_service()
        stats = vision_service.get_analysis_stats(media_items)
        
        return {
            "status": "success",
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error in get_vision_stats_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-image")
async def generate_image_endpoint(request: GenerateImageRequest):
    """
    Generate images using Imagen 4.0 with support for multiple images.

    This endpoint provides image generation with full parameter support including:
    - Multiple image generation (1-8 images at once, API limit)
    - Aspect ratio control
    - Person generation settings
    - Safety filter configuration

    Use this for:
    - AI image generation from text prompts
    - Batch image generation (multiple variations)
    - Brand-consistent image creation

    Note: For requests > 8 images, the frontend will automatically batch into multiple requests.
    This endpoint handles up to 8 images per request (Imagen API limit).
    """
    try:
        num_images = request.number_of_images or 1
        logger.info(f"Generate image request: prompt='{request.prompt[:50]}...', num_images={num_images}")
        
        # Warn if request exceeds API limit (should be handled by frontend batching)
        if num_images > 8:
            logger.warning(f"Request for {num_images} images exceeds API limit of 8. Capping to 8. Frontend should batch large requests.")
            num_images = 8

        result = generate_image(
            prompt=request.prompt,
            brand_id=request.brand_id or "",
            aspect_ratio=request.aspect_ratio or "1:1",
            number_of_images=num_images,
            person_generation=request.person_generation or "",
            safety_filter_level=request.safety_filter_level or "",
            output_mime_type=request.output_mime_type or ""
        )

        if result.get("status") == "error":
            error_msg = result.get("error", "Unknown error")
            logger.error(f"Image generation failed: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)

        # Transform snake_case to camelCase for TypeScript frontend compatibility
        image_url = result.get("image_url")
        image_urls = result.get("image_urls", [])

        # If no URL but base64 data is present, convert to data URL
        if not image_url and result.get("image_data"):
            image_url = f"data:image/png;base64,{result.get('image_data')}"
            image_urls = [image_url]

        if not image_urls and result.get("image_data_list"):
            image_urls = [f"data:image/png;base64,{data}" for data in result.get("image_data_list", [])]
            if image_urls:
                image_url = image_urls[0]

        if not image_url and not image_urls:
            logger.error("No image data returned from generation")
            raise HTTPException(status_code=500, detail="No image data returned from generation service")

        logger.info(f"Successfully generated {len(image_urls)} image(s)")
        return {
            "status": result.get("status"),
            "message": result.get("message"),
            "imageUrl": image_url,        # camelCase for frontend (first image)
            "imageUrls": image_urls,      # Array of all generated images
            "format": result.get("format"),
            "prompt": result.get("prompt"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_image_endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Provide more specific error message for network/timeout issues
        error_str = str(e).lower()
        if 'timeout' in error_str or 'network' in error_str or 'connection' in error_str:
            raise HTTPException(
                status_code=504, 
                detail=f"Image generation request timed out or network error: {str(e)}. For large batches (>8 images), requests are automatically batched."
            )
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")
