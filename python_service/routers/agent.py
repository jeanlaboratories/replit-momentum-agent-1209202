import logging
import json
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from models.requests import AgentChatRequest, DeleteSessionRequest
from services.adk_service import get_adk_components
from utils.context_utils import (
    set_brand_context, set_user_context, set_settings_context,
    set_media_context, set_team_context
)

router = APIRouter(prefix="/agent", tags=["agent"])
logger = logging.getLogger(__name__)

@router.get("/status")
async def get_adk_agent_status():
    """Check if the MOMENTUM ADK agent is available"""
    adk_agent, adk_runner, _, _ = get_adk_components()
    if adk_agent and adk_runner:
        return {
            "status": "available", 
            "agent": adk_agent.__class__.__name__,
            "runner": adk_runner.__class__.__name__
        }
    return {"status": "unavailable", "reason": "ADK Agent or Runner not initialized"}

@router.post("/chat")
async def chat_with_adk_agent(request: AgentChatRequest):
    """
    Chat with the MOMENTUM ADK Agent.
    The agent will intelligently use tools (Gemini Text, Imagen, Vision, Veo, team tools) as needed.
    """
    from google.genai import types

    adk_agent, adk_runner, adk_session_service, _ = get_adk_components()

    if not adk_agent or not adk_runner or not adk_session_service:
        raise HTTPException(status_code=503, detail="ADK Agent not initialized")

    try:
        # Set context for tool calls - this allows tools to access settings, brand, user info
        set_brand_context(request.brand_id)
        set_user_context(request.user_id)
        set_settings_context(request.settings or {})
        set_team_context(request.team_context or {})
        if request.media:
            set_media_context([m.model_dump() if hasattr(m, 'model_dump') else m for m in request.media])
        else:
            set_media_context([])

        logger.info(f"Context set - Brand: {request.brand_id}, User: {request.user_id}, Settings: {bool(request.settings)}")

        # 1. Prepare the message with context if provided
        message_text = request.message

        # Inject team context if available
        if request.team_context:
            context_str = "\n\nTeam Context:\n"
            for key, value in request.team_context.items():
                context_str += f"- {key}: {value}\n"
            message_text += context_str

        # Inject media information if available
        # IMPORTANT: Always include the full URL for tools like nano_banana to access
        if request.media:
            media_str = "\n\nAttached Media:\n"
            for m in request.media:
                # Prefer URL over fileName for tool calls to work correctly
                if m.url:
                    media_str += f"- {m.type} (URL: {m.url}): {m.fileName or 'unnamed'}\n"
                else:
                    media_str += f"- {m.type}: {m.fileName or 'unnamed'}\n"
            message_text += media_str

        # Inject ROBUST image context from conversation history
        # This uses intelligent media reference resolution for 100% accurate tool calls
        if request.image_context and request.image_context.total_count > 0:
            img_ctx = request.image_context
            context_str = f"\n\n--- RESOLVED MEDIA CONTEXT (ROBUST SYSTEM) ---\n"
            
            # Include resolution metadata for agent decision-making
            if img_ctx.resolution_method:
                context_str += f"Resolution Method: {img_ctx.resolution_method}\n"
                context_str += f"Confidence: {img_ctx.resolution_confidence * 100:.0f}%\n"
                context_str += f"User Intent: {img_ctx.user_intent}\n\n"
            
            context_str += f"You have access to {img_ctx.total_count} RESOLVED image(s) for this request.\n"
            
            if img_ctx.is_new_media:
                context_str += "⚠️ These are NEWLY uploaded images from THIS turn - prioritize working on these!\n"
            
            if img_ctx.images:
                context_str += "\nResolved Image(s) for THIS Request:\n"
                for img in img_ctx.images:
                    source = "uploaded by user" if img.source == "user" else "AI-generated"
                    role = f" [{img.role}]" if img.role else ""
                    name = f" ({img.file_name})" if img.file_name else ""
                    context_str += f"- Image {img.index}{role}: {source}{name}\n"
                    context_str += f"  URL: {img.url}\n"
                
                # Add role-specific instructions
                primary_images = [img for img in img_ctx.images if img.role == 'primary']
                if primary_images:
                    context_str += f"\n✓ PRIMARY IMAGE (main subject): {primary_images[0].url}\n"
                
                reference_images = [img for img in img_ctx.images if img.role == 'reference']
                if reference_images:
                    context_str += f"✓ REFERENCE IMAGES (for style/composition): {len(reference_images)} images\n"
                
                mask_images = [img for img in img_ctx.images if img.role == 'mask']
                if mask_images:
                    context_str += f"✓ MASK IMAGE (for inpainting): {mask_images[0].url}\n"
            
            context_str += "\n🎯 CRITICAL INSTRUCTIONS:\n"
            context_str += "1. Use the URLs listed above for your tool calls.\n"
            context_str += "2. When mentioning these URLs in your response, ALWAYS wrap them with markers:\n"
            context_str += "   - Images: __IMAGE_URL__<url>__IMAGE_URL__\n"
            context_str += "   - Videos: __VIDEO_URL__<url>__VIDEO_URL__\n"
            context_str += "3. DO NOT paste plain URLs - they won't display properly!\n"
            context_str += "--- END RESOLVED MEDIA ---\n"
            message_text += context_str
            
            logger.info(f"Added robust image context: {img_ctx.total_count} images, method={img_ctx.resolution_method}, confidence={img_ctx.resolution_confidence}")

        # 2. Handle Session and User Management
        user_id = request.user_id or "anonymous"
        session_id = request.session_id or "default"
        # We use a combination of brand_id and user_id for uniqueness if available
        if request.brand_id and request.user_id:
            session_id = f"{request.brand_id}_{request.user_id}"
        elif request.user_id:
            session_id = f"user_{request.user_id}"

        # 3. Ensure session exists - create if it doesn't
        logger.info(f"Checking session for app=MOMENTUM, user={user_id}, session={session_id}")
        existing_session = await adk_session_service.get_session(
            app_name="MOMENTUM",
            user_id=user_id,
            session_id=session_id
        )
        logger.info(f"Existing session: {existing_session}")
        if not existing_session:
            logger.info(f"Creating new session for user {user_id}, session {session_id}")
            created_session = await adk_session_service.create_session(
                app_name="MOMENTUM",
                user_id=user_id,
                session_id=session_id
            )
            logger.info(f"Created session: {created_session}")

        # 4. Create Content object for ADK with multimodal support
        # Build parts list - start with text
        message_parts = [types.Part.from_text(text=message_text)]
        
        # Add media as multimodal parts for native vision understanding
        if request.media:
            import httpx
            import base64
            from io import BytesIO
            
            for media in request.media:
                if not media.url:
                    continue
                    
                try:
                    # Download media from URL
                    logger.info(f"Downloading media for multimodal: {media.url[:100]}...")
                    
                    # Determine MIME type
                    mime_type = media.mimeType or 'application/octet-stream'
                    if media.type == 'image' and not media.mimeType:
                        mime_type = 'image/png'
                    elif media.type == 'video' and not media.mimeType:
                        mime_type = 'video/mp4'
                    elif media.type == 'pdf' and not media.mimeType:
                        mime_type = 'application/pdf'
                    elif media.type == 'audio' and not media.mimeType:
                        mime_type = 'audio/mpeg'
                    
                    # For Firebase URLs or HTTP(S) URLs, download the content
                    # Skip YouTube URLs - they can't be downloaded as video files
                    if media.url.startswith('http://') or media.url.startswith('https://'):
                        # Check if this is a YouTube URL - if so, skip downloading and just mention it in text
                        youtube_patterns = ['youtube.com', 'youtu.be']
                        is_youtube = any(pattern in media.url.lower() for pattern in youtube_patterns)
                        
                        if is_youtube and media.type == 'video':
                            logger.info(f"Skipping YouTube URL from multimodal parts - URL will be in message text: {media.url}")
                            # Don't try to download YouTube URLs - they're web pages, not video files
                            # The URL is already included in the message text, so the agent can use process_youtube_video tool
                            continue
                        
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            response = await client.get(media.url)
                            response.raise_for_status()
                            media_bytes = response.content
                            
                        # Add as inline data part for native multimodal understanding
                        message_parts.append(
                            types.Part.from_bytes(
                                data=media_bytes,
                                mime_type=mime_type
                            )
                        )
                        logger.info(f"Added {media.type} as multimodal part: {len(media_bytes)} bytes, mime={mime_type}")
                    
                    # For data URIs, extract and add inline
                    elif media.url.startswith('data:'):
                        # Extract base64 data from data URI
                        if ';base64,' in media.url:
                            base64_data = media.url.split(';base64,')[1]
                            media_bytes = base64.b64decode(base64_data)
                            
                            message_parts.append(
                                types.Part.from_bytes(
                                    data=media_bytes,
                                    mime_type=mime_type
                                )
                            )
                            logger.info(f"Added data URI {media.type} as multimodal part")
                        
                except Exception as e:
                    logger.warning(f"Failed to add {media.type} as multimodal part: {e}. Will rely on URL in text.")
                    # Continue - media URL is already in the text message
        
        new_message = types.Content(
            role="user",
            parts=message_parts
        )
        logger.info(f"Created multimodal message: {len(message_parts)} parts (text + {len(message_parts) - 1} media)")

        # 5. Run the agent using run_async (proper async support)
        logger.info(f"Running ADK agent for session {session_id}")
        full_response_text = ""
        tool_calls = []
        tool_outputs = []  # Capture tool outputs (images, videos, etc.)
        event_count = 0

        # Use streaming response to emit thinking events in real-time
        async def generate_streaming_response():
            nonlocal event_count, full_response_text, tool_calls, tool_outputs
            thinking_steps = []

            try:
                # Use run_async for proper async support in FastAPI
                async for event in adk_runner.run_async(
                    user_id=user_id,
                    session_id=session_id,
                    new_message=new_message
                ):
                    event_count += 1
                    logger.info(f"Event {event_count}: author={event.author}, turn_complete={event.turn_complete}, partial={event.partial}")

                    # Emit thinking event at the start of processing
                    if event_count == 1:
                        yield json.dumps({'type': 'log', 'content': 'Thinking...'}) + "\n"

                    # Track function calls and emit thinking events BEFORE execution
                    function_calls_in_event = event.get_function_calls()
                    if function_calls_in_event:
                        for fc in function_calls_in_event:
                            tool_name = fc.name
                            logger.info(f"  Tool call: {tool_name} (type: {type(fc).__name__})")
                            tool_calls.append(tool_name)
                            # Emit thinking event for tool call - this shows BEFORE tool executes
                            thinking_msg = f"Using {tool_name}..."
                            if tool_name == 'generate_image':
                                thinking_msg = "🎨 Generating image..."
                            elif tool_name == 'generate_video':
                                thinking_msg = "🎬 Generating video (this may take 30-90 seconds)..."
                            elif tool_name == 'nano_banana':
                                thinking_msg = "🍌 Editing image with Nano Banana..."
                            # Handle web search agent (AgentTool wraps search agent with name "web_search_agent")
                            elif tool_name in ('search_web', 'web_search_agent') or 'web_search' in tool_name.lower() or (tool_name.startswith('web_') and 'search' in tool_name.lower()):
                                thinking_msg = "🔍 Searching the web..."
                                logger.info(f"Web search tool detected: {tool_name}")
                            elif tool_name == 'crawl_website':
                                thinking_msg = "🌐 Crawling website..."
                                logger.info(f"Website crawl tool detected: {tool_name}")
                            elif tool_name == 'create_event':
                                thinking_msg = "📅 Creating event..."
                            elif tool_name == 'recall_memory':
                                thinking_msg = "💭 Recalling from memory..."
                            elif tool_name == 'save_memory':
                                thinking_msg = "💾 Saving to memory..."
                            elif tool_name == 'process_youtube_video':
                                thinking_msg = "📺 Analyzing YouTube video..."

                            thinking_steps.append(thinking_msg)
                            yield json.dumps({'type': 'log', 'content': thinking_msg}) + "\n"

                    # Capture function responses (tool outputs like images, videos)
                    function_responses = event.get_function_responses()
                    if function_responses:
                        for fr in function_responses:
                            logger.info(f"  Tool response from {fr.name}: {str(fr.response)[:200]}...")

                            # Emit completion thinking event
                            yield json.dumps({'type': 'log', 'content': f'✓ {fr.name} completed'}) + "\n"

                            # Check if this is an image generation/editing response
                            # Standardized response format: always has image_urls array + image_url singular
                            if fr.name in ('generate_image', 'nano_banana') and isinstance(fr.response, dict):
                                if fr.response.get('status') == 'success':
                                    prompt = fr.response.get('prompt', '')
                                    response_format = fr.response.get('format', 'url')

                                    # Use array format (image_urls) for consistency, fallback to singular
                                    image_urls = fr.response.get('image_urls', [])
                                    if not image_urls and fr.response.get('image_url'):
                                        image_urls = [fr.response.get('image_url')]

                                    # Handle base64 format
                                    image_data_list = fr.response.get('image_data_list', [])
                                    if not image_data_list and fr.response.get('image_data'):
                                        image_data_list = [fr.response.get('image_data')]

                                    # Emit each image as a separate event
                                    if response_format == 'url' and image_urls:
                                        for url in image_urls:
                                            tool_outputs.append({
                                                'type': 'image',
                                                'url': url,
                                                'prompt': prompt
                                            })
                                            yield json.dumps({
                                                'type': 'image',
                                                'data': {
                                                    'format': 'url',
                                                    'url': url,
                                                    'prompt': prompt
                                                }
                                            }) + "\n"
                                    elif response_format == 'base64' and image_data_list:
                                        for data in image_data_list:
                                            tool_outputs.append({
                                                'type': 'image',
                                                'data': data,
                                                'prompt': prompt
                                            })
                                            yield json.dumps({
                                                'type': 'image',
                                                'data': {
                                                    'format': 'base64',
                                                    'data': data,
                                                    'prompt': prompt
                                                }
                                            }) + "\n"

                            # Check if this is a video generation response
                            # Standardized response format: always has video_urls array + video_url singular
                            elif fr.name == 'generate_video' and isinstance(fr.response, dict):
                                if fr.response.get('status') == 'success':
                                    prompt = fr.response.get('prompt', '')
                                    response_format = fr.response.get('format', 'url')

                                    # Use array format (video_urls) for consistency, fallback to singular
                                    video_urls = fr.response.get('video_urls', [])
                                    if not video_urls and fr.response.get('video_url'):
                                        video_urls = [fr.response.get('video_url')]

                                    # Handle base64 format
                                    video_data_list = fr.response.get('video_data_list', [])
                                    if not video_data_list and fr.response.get('video_data'):
                                        video_data_list = [fr.response.get('video_data')]

                                    # Emit each video as a separate event
                                    if response_format == 'url' and video_urls:
                                        for url in video_urls:
                                            tool_outputs.append({
                                                'type': 'video',
                                                'url': url,
                                                'prompt': prompt
                                            })
                                            yield json.dumps({
                                                'type': 'video',
                                                'data': {
                                                    'format': 'url',
                                                    'url': url,
                                                    'prompt': prompt
                                                }
                                            }) + "\n"
                                    elif response_format == 'base64' and video_data_list:
                                        for data in video_data_list:
                                            tool_outputs.append({
                                                'type': 'video',
                                                'data': data,
                                                'prompt': prompt
                                            })
                                            yield json.dumps({
                                                'type': 'video',
                                                'data': {
                                                    'format': 'base64',
                                                    'data': data,
                                                    'prompt': prompt
                                                }
                                            }) + "\n"

                            # Check if this is an event creation response - emit as structured data
                            # This enables the "Generate Event with AI" card to appear in chat
                            elif fr.name == 'create_event' and isinstance(fr.response, dict):
                                if fr.response.get('status') == 'success':
                                    preview_data = fr.response.get('preview_data')
                                    if preview_data and preview_data.get('action') == 'generate-campaign':
                                        tool_outputs.append({
                                            'type': 'event',
                                            'preview_data': preview_data
                                        })
                                        # Emit as 'data' type which frontend parses for structured UI
                                        yield json.dumps({
                                            'type': 'data',
                                            'data': preview_data
                                        }) + "\n"
                                        logger.info(f"Emitted create_event preview data: {preview_data.get('campaignName', 'unnamed')}")

                    # Extract text from model/agent responses only (not user messages)
                    if event.content and event.content.parts and event.author != "user":
                        for part in event.content.parts:
                            if hasattr(part, 'text') and part.text:
                                logger.info(f"  Text from {event.author}: {part.text[:100]}...")
                                full_response_text += part.text

                    # Check for errors
                    if event.error_message:
                        logger.error(f"Agent error: {event.error_message}")
                        yield json.dumps({'type': 'error', 'content': event.error_message}) + "\n"
                        return

                logger.info(f"Agent completed. Events: {event_count}, Response length: {len(full_response_text)}, Tools used: {tool_calls}, Tool outputs: {len(tool_outputs)}")

                # Send final response - this triggers the frontend to save to chat history
                # The frontend expects 'final_response' type to persist the assistant message
                yield json.dumps({'type': 'final_response', 'content': full_response_text}) + "\n"
                yield json.dumps({'type': 'done'}) + "\n"

            except Exception as e:
                logger.error(f"Error in streaming response: {e}")
                import traceback
                logger.error(traceback.format_exc())
                yield json.dumps({'type': 'error', 'content': str(e)}) + "\n"

        return StreamingResponse(
            generate_streaming_response(),
            media_type="application/x-ndjson"
        )

    except Exception as e:
        logger.error(f"Error in ADK chat: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# Compatibility route for old frontend
@router.get("/session-stats")
async def get_agent_session_stats_compat(brand_id: str, user_id: str):
    adk_agent, adk_runner, adk_session_service, _ = get_adk_components()
    if not adk_session_service:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    try:
        session_id = f"{brand_id}_{user_id}"
        if hasattr(adk_session_service, 'get_session'):
            session = await adk_session_service.get_session(
                app_name="MOMENTUM",
                user_id=user_id,
                session_id=session_id
            )
            if session and hasattr(session, 'events'):
                return {
                    "status": "active",
                    "session_id": session_id,
                    "message_count": len(session.events),
                    "last_updated": getattr(session, 'last_update_time', None)
                }
        return {"status": "unknown", "message_count": 0, "note": "Session stats not available with current ADK"}
    except Exception as e:
        logger.error(f"Error getting session stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete-session")
async def delete_agent_session_compat(request: DeleteSessionRequest):
    from routers.session import delete_agent_session
    return await delete_agent_session(request)

@router.post("/youtube-analysis")
async def analyze_youtube_video_endpoint(request: Request):
    """
    Directly analyze a YouTube video.
    """
    try:
        data = await request.json()
        url = data.get("url")
        prompt = data.get("prompt", "Analyze this video")
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
            
        from momentum_agent import process_youtube_video
        result = process_youtube_video(url, prompt)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
            
        return result
    except Exception as e:
        logger.error(f"Error in youtube analysis endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/youtube-search")
async def search_youtube_videos_endpoint(request: Request):
    """
    Directly search YouTube for videos.
    """
    try:
        data = await request.json()
        query = data.get("query")
        brand_id = data.get("brand_id")
        max_results = data.get("max_results", 10)
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Set context for tool calls
        from utils.context_utils import set_brand_context
        if brand_id:
            set_brand_context(brand_id)
        
        # Import and call the tool directly
        from tools.team_tools import search_youtube_videos
        result = search_youtube_videos(
            query=query,
            max_results=max_results
        )
        
        return result
    except Exception as e:
        logger.error(f"Error in youtube search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def search_web_endpoint(request: Request):
    """
    Directly search the web.
    """
    try:
        data = await request.json()
        query = data.get("query")
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
            
        from momentum_agent import search_web, summarize_search_results
        result = search_web(query)
        
        # If it's a dict with results, summarize it
        if isinstance(result, dict) and "results" in result:
            summary = summarize_search_results(query, result["results"])
            return {
                "status": "success",
                "summary": summary,
                "results": result["results"],
                "query": query
            }
        return result
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nano-banana")
async def nano_banana_endpoint(request: Request):
    """
    Edit images using nano_banana (Gemini image editing).

    Unified endpoint supporting all nano_banana parameters:
    - prompt: Text description of the edit/generation
    - image_url: Primary image to edit (URL or base64)
    - reference_images: Comma-separated URLs/base64 for character consistency
    - mask_url: Mask image for inpainting
    - mode: "edit" or "compose"
    - aspect_ratio: Output aspect ratio
    - number_of_images: Number of images to generate (1-4)
    - person_generation: "allow_all" or "allow_adult"

    Returns consistent camelCase response format matching /media/nano-banana.
    """
    try:
        data = await request.json()
        prompt = data.get("prompt")
        image_url = data.get("image_url", "")
        reference_images = data.get("reference_images", "")
        mask_url = data.get("mask_url", "")
        # Full parameter support - previously missing
        mode = data.get("mode", "")
        aspect_ratio = data.get("aspect_ratio", "1:1")
        number_of_images = data.get("number_of_images", 1)
        person_generation = data.get("person_generation", "")

        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        from tools.media_tools import nano_banana
        result = nano_banana(
            prompt=prompt,
            image_url=image_url,
            reference_images=reference_images,
            mask_url=mask_url,
            mode=mode,
            aspect_ratio=aspect_ratio,
            number_of_images=number_of_images,
            person_generation=person_generation
        )

        if result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))

        # Return consistent camelCase response format (matching /media/nano-banana)
        image_url_result = result.get("image_url")
        image_urls = result.get("image_urls")

        # If no URL but base64 data is present, convert to data URL
        if not image_url_result and result.get("image_data"):
            image_url_result = f"data:image/png;base64,{result.get('image_data')}"
            image_urls = [image_url_result]

        return {
            "status": result.get("status"),
            "message": result.get("message"),
            "imageUrl": image_url_result,      # camelCase for frontend
            "imageUrls": image_urls,           # Array for multi-image consumers
            "format": result.get("format"),
            "prompt": result.get("prompt"),
            "skippedReferences": result.get("skipped_references"),  # camelCase
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in nano_banana endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/crawl-website")
async def crawl_website_endpoint(request: Request):
    """
    Crawl and extract content from a website.
    """
    try:
        data = await request.json()
        url = data.get("url")

        if not url:
            raise HTTPException(status_code=400, detail="URL is required")

        from momentum_agent import crawl_website
        result = crawl_website(url)

        return result
    except Exception as e:
        logger.error(f"Error in crawl website endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/memory/recall")
async def recall_memory_endpoint(request: Request):
    """
    Recall information from long-term memory.
    Supports both personal and team memory banks.

    Body params:
    - query: The search query
    - user_id: The user ID (optional, uses context)
    - scope: 'all' (default), 'personal', or 'team'
    """
    try:
        data = await request.json()
        query = data.get("query")
        user_id = data.get("user_id", "")
        scope = data.get("scope", "all")

        if not query:
            raise HTTPException(status_code=400, detail="Query is required")

        from momentum_agent import recall_memory
        # recall_memory is async and takes query, user_id, and scope
        result = await recall_memory(query, user_id=user_id, scope=scope)

        return result
    except Exception as e:
        logger.error(f"Error in recall memory endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/memory/save")
async def save_memory_endpoint(request: Request):
    """
    Save information to long-term memory.
    Supports both personal and team memory banks.

    Body params:
    - content: The memory text to save
    - user_id: The user ID (optional, uses context)
    - scope: 'personal' (default) or 'team'
    """
    try:
        data = await request.json()
        content = data.get("content")
        user_id = data.get("user_id", "")
        scope = data.get("scope", "personal")

        if not content:
            raise HTTPException(status_code=400, detail="Content is required")

        from momentum_agent import save_memory
        # save_memory is async and takes memory_text, user_id, and scope
        result = await save_memory(content, user_id=user_id, scope=scope)

        return result
    except Exception as e:
        logger.error(f"Error in save memory endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rag-search")
async def rag_search_endpoint(request: Request):
    """
    Search indexed brand documents using RAG.
    """
    try:
        data = await request.json()
        query = data.get("query")
        brand_id = data.get("brand_id")

        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        if not brand_id:
            raise HTTPException(status_code=400, detail="Brand ID is required")

        from tools.rag_tools import query_brand_documents
        result = query_brand_documents(query=query, brand_id=brand_id)

        return result
    except Exception as e:
        logger.error(f"Error in RAG search endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/media-search")
async def media_search_endpoint(request: Request):
    """
    Search media library using Vertex AI Discovery Engine with Firestore fallback.
    Vertex AI provides semantic search; Firestore provides basic text matching as fallback.
    """
    try:
        data = await request.json()
        query = data.get("query", "")
        brand_id = data.get("brand_id")
        media_type = data.get("media_type", "")  # "image", "video", or "" for all
        limit = data.get("limit", 20)

        if not brand_id:
            raise HTTPException(status_code=400, detail="Brand ID is required")

        results = []
        search_method = "firestore"  # Track which method succeeded

        # Try Vertex AI Discovery Engine first (semantic search)
        try:
            from services.media_search_service import get_media_search_service
            search_service = get_media_search_service()

            if search_service.project_id and search_service.search_client:
                vertex_result = search_service.search(
                    brand_id=brand_id,
                    query=query if query else "*",  # Use wildcard for empty query
                    media_type=media_type if media_type else None,
                    page_size=limit,
                )

                if vertex_result.results:
                    search_method = "vertex_ai"
                    for r in vertex_result.results:
                        results.append({
                            "id": r.media_id,
                            "title": r.title,
                            "description": r.description,
                            "type": r.media_type,
                            "source": r.source,
                            "url": r.url,
                            "thumbnailUrl": r.thumbnail_url,
                            "tags": r.tags,
                            "relevance_score": r.relevance_score,
                            # Include vision analysis fields (convert from snake_case to camelCase)
                            "visionDescription": r.vision_description if hasattr(r, 'vision_description') else None,
                            "visionKeywords": r.vision_keywords if hasattr(r, 'vision_keywords') else None,
                            "visionCategories": r.vision_categories if hasattr(r, 'vision_categories') else None,
                            "enhancedSearchText": r.enhanced_search_text if hasattr(r, 'enhanced_search_text') else None,
                        })
                    logger.info(f"Vertex AI Search returned {len(results)} results for '{query}'")
        except Exception as vertex_error:
            logger.warning(f"Vertex AI Search failed, falling back to Firestore: {vertex_error}")

        # Fallback to Firestore if Vertex AI returned no results
        if not results:
            search_method = "firestore"
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

            # Order by createdAt descending and fetch optimized amount for filtering
            # Optimized: fetch limit + small buffer instead of 3x (max 100 docs)
            fetch_limit = min(limit + 20, 100)
            query_ref = query_ref.order_by('createdAt', direction=firestore.Query.DESCENDING)
            query_ref = query_ref.limit(fetch_limit)

            docs = query_ref.stream()
            query_lower = query.lower() if query else ""

            for doc in docs:
                if len(results) >= limit:
                    break

                media_data = doc.to_dict()
                media_data['id'] = doc.id

                # If there's a search query, filter client-side
                if query_lower:
                    title = (media_data.get('title') or '').lower()
                    description = (media_data.get('description') or '').lower()
                    tags = media_data.get('tags') or []
                    prompt = (media_data.get('prompt') or '').lower()
                    explainability = media_data.get('explainability') or {}
                    summary = (explainability.get('summary') or '').lower()
                    
                    # Include vision analysis fields
                    vision_description = (media_data.get('visionDescription') or '').lower()
                    vision_keywords = media_data.get('visionKeywords') or []
                    vision_categories = media_data.get('visionCategories') or []
                    enhanced_search_text = (media_data.get('enhancedSearchText') or '').lower()
                    
                    # Use intelligent matching (same as galleries) for plural/singular handling
                    from utils.search_utils import intelligent_text_match, intelligent_tag_match
                    
                    # Use intelligent matching for text fields (handles plurals, stemming, fuzzy)
                    # Increased fuzzy threshold to 0.9 to prevent false matches like "caar" matching "car"
                    text_match, text_confidence = intelligent_text_match(
                        query, title, description, prompt, summary, vision_description, enhanced_search_text, fuzzy_threshold=0.9
                    )

                    # Use intelligent matching for tags (include vision keywords and categories)
                    # Increased fuzzy threshold to 0.9 to prevent false matches like "caar" matching "car"
                    all_tags = tags + vision_keywords + vision_categories
                    tag_match, tag_confidence = intelligent_tag_match(query, all_tags, fuzzy_threshold=0.9)

                    # Accept if either text or tags match (same logic as _firestore_fallback_search)
                    if not text_match and not tag_match:
                        continue

                results.append({
                    "id": media_data.get('id'),
                    "title": media_data.get('title', 'Untitled'),
                    "description": media_data.get('description', ''),
                    "type": media_data.get('type', 'image'),
                    "source": media_data.get('source', 'upload'),
                    "url": media_data.get('url', ''),
                    "thumbnailUrl": media_data.get('thumbnailUrl', media_data.get('url', '')),
                    "tags": media_data.get('tags', []),
                    "prompt": media_data.get('prompt', ''),
                    "createdAt": str(media_data.get('createdAt', '')),
                    # Include vision analysis fields
                    "visionDescription": media_data.get('visionDescription'),
                    "visionKeywords": media_data.get('visionKeywords'),
                    "visionCategories": media_data.get('visionCategories'),
                    "enhancedSearchText": media_data.get('enhancedSearchText'),
                })

        return {
            "status": "success",
            "results": results,
            "total_count": len(results),
            "query": query,
            "search_method": search_method,
            "message": f"Found {len(results)} media items" + (f" matching '{query}'" if query else "") + f" (via {search_method})"
        }

    except Exception as e:
        logger.error(f"Error in media search endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

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

@router.post("/media-index")
async def media_index_endpoint(request: Request):
    """
    Index media items into Vertex AI Discovery Engine for semantic search.
    Can index a single item or all media for a brand.
    """
    try:
        data = await request.json()
        brand_id = data.get("brand_id")
        media_items = data.get("media_items")  # Optional: specific items to index
        index_all = data.get("index_all", False)  # If true, index all media for brand

        if not brand_id:
            raise HTTPException(status_code=400, detail="Brand ID is required")

        from services.media_search_service import get_media_search_service
        search_service = get_media_search_service()

        if not search_service.project_id:
            raise HTTPException(status_code=503, detail="Vertex AI Search not configured")

        # If index_all, fetch all media from Firestore
        if index_all or not media_items:
            import firebase_admin
            from firebase_admin import firestore

            try:
                db = firestore.client()
            except ValueError:
                firebase_admin.initialize_app()
                db = firestore.client()

            # Fetch all media for the brand
            docs = db.collection('unifiedMedia').where('brandId', '==', brand_id).stream()
            media_items = []
            for doc in docs:
                media_data = doc.to_dict()
                media_data['id'] = doc.id
                media_items.append(media_data)

            logger.info(f"Fetched {len(media_items)} media items from Firestore for indexing")

        if not media_items:
            return {
                "status": "success",
                "message": "No media items to index",
                "indexed_count": 0
            }

        # Index the media items
        result = search_service.index_media(brand_id, media_items)

        # Check for API enablement errors
        if not result.success and result.errors:
            error_text = " ".join(result.errors)
            if "SERVICE_DISABLED" in error_text or "API has not been used" in error_text:
                return {
                    "status": "error",
                    "message": "⚠️ Vertex AI Discovery Engine API is not enabled",
                    "indexed_count": 0,
                    "errors": [
                        "The Discovery Engine API needs to be enabled in your Google Cloud project.",
                        f"Enable it here: https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project={search_service.project_id}",
                        "After enabling, wait 2-3 minutes and try again.",
                        "Note: Media search will use basic Firestore queries until this is enabled."
                    ],
                    "help_url": f"https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project={search_service.project_id}"
                }

        return {
            "status": "success" if result.success else "error",
            "message": result.message,
            "indexed_count": result.indexed_count,
            "errors": result.errors
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error in media index endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Provide helpful error for API not enabled
        if "SERVICE_DISABLED" in error_msg or "API has not been used" in error_msg:
            raise HTTPException(
                status_code=503,
                detail="Vertex AI Discovery Engine API is not enabled. Please enable it in Google Cloud Console."
            )
        
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/media-index-single")
async def media_index_single_endpoint(request: Request):
    """
    Index a single media item into Vertex AI Discovery Engine.
    Call this after creating new media to keep the index up to date.
    """
    try:
        data = await request.json()
        brand_id = data.get("brand_id")
        media_item = data.get("media_item")

        if not brand_id:
            raise HTTPException(status_code=400, detail="Brand ID is required")
        if not media_item:
            raise HTTPException(status_code=400, detail="Media item is required")

        from services.media_search_service import get_media_search_service
        search_service = get_media_search_service()

        if not search_service.project_id:
            # Silently succeed if Vertex AI not configured - don't break media creation
            return {
                "status": "skipped",
                "message": "Vertex AI Search not configured, skipping indexing"
            }

        # Index the single item
        result = search_service.index_media(brand_id, [media_item])

        return {
            "status": "success" if result.success else "error",
            "message": result.message,
            "indexed_count": result.indexed_count
        }

    except Exception as e:
        logger.warning(f"Error indexing single media item (non-fatal): {e}")
        # Return success anyway - don't break media creation flow
        return {
            "status": "skipped",
            "message": f"Indexing skipped due to error: {str(e)}"
        }
