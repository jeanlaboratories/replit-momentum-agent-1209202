import logging
import requests
from typing import Dict, Any
from marketing_agent import MarketingAgent
from utils.context_utils import get_brand_context, get_settings_context
from utils.model_defaults import DEFAULT_TEXT_MODEL

logger = logging.getLogger(__name__)

# Next.js API URL for event parsing
NEXTJS_API_URL = 'http://127.0.0.1:5000'


def _get_marketing_agent() -> MarketingAgent:
    """Get a MarketingAgent instance configured with the current settings context."""
    settings = get_settings_context()
    model_name = settings.get('textModel') or DEFAULT_TEXT_MODEL
    logger.info(f"Creating MarketingAgent with model: {model_name}")
    return MarketingAgent(model_name=model_name)


def suggest_domain_names(keywords: str, team_type: str = "") -> Dict[str, Any]:
    """
    Suggest creative domain names for teams based on keywords.

    Args:
        keywords (str): Comma-separated keywords describing the team
        team_type (str): Type of team (sports, product, creative, research, volunteer, marketing)
        
    Returns:
        dict: Domain name suggestions
    """
    try:
        keyword_list = [k.strip() for k in keywords.split(',') if k.strip()]

        # Call MarketingAgent directly instead of making HTTP request to avoid deadlock
        agent = _get_marketing_agent()
        response = agent.suggest_domains(keyword_list, team_type)
        
        # Standardized text response format:
        # - content: The main AI-generated text/markdown (for NDJSON streaming)
        # - message: Same content for backward compatibility
        return {
            "status": "success",
            "domains": [],  # MarketingAgent returns text, not list
            "content": response.result,  # Primary text field for consistency with agent
            "message": response.result   # Backward compatibility
        }
    except Exception as e:
        logger.error(f"Error in suggest_domain_names: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

def create_team_strategy(team_name: str, team_type: str, goals: str = "") -> Dict[str, Any]:
    """
    Create a comprehensive strategic plan for any team type.

    Args:
        team_name (str): Name of the team
        team_type (str): Type of team (sports, product, creative, research, volunteer, marketing)
        goals (str): Team goals and objectives
        
    Returns:
        dict: Strategic plan and recommendations
    """
    try:
        # Call MarketingAgent directly instead of making HTTP request to avoid deadlock
        agent = _get_marketing_agent()
        response = agent.create_marketing_strategy({
            "name": team_name,
            "type": team_type,
            "goals": goals
        })
        
        # Standardized text response format
        return {
            "status": "success",
            "strategy": {},  # MarketingAgent returns text, not dict
            "content": response.result,  # Primary text field for consistency with agent
            "message": response.result   # Backward compatibility
        }
    except Exception as e:
        logger.error(f"Error in create_team_strategy: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

def plan_website(domain: str, team_name: str, team_type: str) -> Dict[str, Any]:
    """
    Plan a professional website structure for teams.
    
    Args:
        domain (str): Domain name for the website
        team_name (str): Name of the team
        team_type (str): Type of team
        
    Returns:
        dict: Website plan with pages, features, and content strategy
    """
    try:
        # Call MarketingAgent directly instead of making HTTP request to avoid deadlock
        agent = _get_marketing_agent()
        response = agent.create_website_plan(domain, {
            "name": team_name,
            "type": team_type
        })
        
        # Standardized text response format
        return {
            "status": "success",
            "plan": {},  # MarketingAgent returns text, not dict
            "content": response.result,  # Primary text field for consistency with agent
            "message": response.result   # Backward compatibility
        }
    except Exception as e:
        logger.error(f"Error in plan_website: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

def create_event(
    description: str,
    brand_id: str = "",
    character_sheet_urls: str = "",
    enable_character_consistency: bool = False,
    scheduled_times: str = "",
    tone_of_voice: str = ""
) -> Dict[str, Any]:
    """
    Create a preview for a team event or campaign with AI-generated content. USE THIS TOOL whenever a user asks
    to create, add, schedule, or plan an event, campaign, or calendar item.

    This tool accepts ANY natural language description - you do NOT need to ask the user for more details.
    Just pass their request directly to this tool and it will figure out the details.

    Examples of when to use this tool:
    - "Add an event to the calendar for today"
    - "Create a 3-day product launch starting next Monday"
    - "Schedule a meeting for tomorrow at 2pm"
    - "Plan a campaign for next week"
    - ANY request to create/add/schedule an event or campaign

    SCHEDULED TIMES:
    If the user specifies specific times for posts (e.g., "at 4pm", "at 5:30am"), extract those times
    and pass them via scheduled_times as comma-separated times in HH:MM format (24-hour).
    Scheduled times only apply to Social Media Posts, NOT to Email Newsletter or Blog Post Idea.

    Examples:
    - "Post at 4pm" -> scheduled_times="16:00"
    - "Schedule posts at 9am and 5pm" -> scheduled_times="09:00,17:00"
    - "Morning post at 8:30am, evening at 7pm" -> scheduled_times="08:30,19:00"

    TONE OF VOICE:
    If the user specifies a tone or mood for the content (e.g., "playful", "professional", "urgent"),
    pass it in tone_of_voice. Valid tones: Professional, Playful, Urgent.

    Examples:
    - "Create a playful campaign" -> tone_of_voice="Playful"
    - "Professional product launch" -> tone_of_voice="Professional"
    - "Urgent flash sale event" -> tone_of_voice="Urgent"

    CHARACTER CONSISTENCY:
    If the user mentions wanting consistent characters, a mascot, or the same character across images,
    set enable_character_consistency=True. If they provide a character sheet image URL, pass it in
    character_sheet_urls (comma-separated for multiple).

    Examples that should enable character consistency:
    - "Create a campaign with our mascot appearing in all images"
    - "Make a 5-day event where the same character appears each day"
    - "Use this character sheet for all the images: [URL]"
    - "Keep the character consistent across all posts"

    Args:
        description (str): Natural language description of the event - accept whatever the user provides
        brand_id (str): Brand/Team ID for event creation
        character_sheet_urls (str): Comma-separated URLs to character sheet images for consistency
        enable_character_consistency (bool): Enable character consistency using Nano Banana
        scheduled_times (str): Comma-separated scheduled times in HH:MM format (24-hour). Only applies to Social Media Posts.
        tone_of_voice (str): Desired tone: Professional, Playful, or Urgent

    Returns:
        dict: Event preview data that will show a "Generate Event with AI" button in the chat
    """
    try:
        # Use the brand_id from parameter or fall back to global context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            return {
                "status": "error",
                "error": "Brand ID required for event creation"
            }

        # Parse scheduled_times from comma-separated string
        parsed_scheduled_times = [t.strip() for t in scheduled_times.split(',') if t.strip()] if scheduled_times else []

        # Parse the event description using the Event Creator parsing endpoint
        logger.info(f"Parsing event description: {description}")
        response = requests.post(
            f'{NEXTJS_API_URL}/api/parse-event-description',
            json={
                "prompt": description,
                "brandId": effective_brand_id,
                # Include scheduled times and tone of voice if provided
                "scheduledTimes": parsed_scheduled_times,
                "toneOfVoice": tone_of_voice,
            },
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            campaign_name = data.get("campaignName", "Event")
            campaign_request = data.get("campaignRequest", {})
            total_posts = data.get("totalPosts", 0)

            logger.info(f"Event preview ready: {campaign_name}")

            # Build character consistency config if enabled
            character_consistency_config = None
            if enable_character_consistency:
                # Parse character sheet URLs
                character_urls = [url.strip() for url in character_sheet_urls.split(',') if url.strip()]
                characters = []
                for i, url in enumerate(character_urls):
                    characters.append({
                        "id": f"char-{i+1}",
                        "name": f"Character {i+1}",
                        "characterSheetUrl": url,
                        "isActive": True
                    })

                character_consistency_config = {
                    "enabled": True,
                    "characters": characters,
                    "useSceneToSceneConsistency": True,
                    "maxReferenceImages": 14
                }

            # Build preview data in the format expected by the frontend
            # This matches the format used by the Event Creator UI
            preview_data = {
                "action": "generate-campaign",
                "prompt": description,  # Original user request needed for generation
                "campaignName": campaign_name,
                "campaignRequest": campaign_request,
                "totalPosts": total_posts,
                "brandId": effective_brand_id,
                "characterConsistency": character_consistency_config,
            }

            # Build message based on character consistency
            message = "I've prepared an event plan for you. Click below to generate it with AI."
            if enable_character_consistency:
                if character_urls:
                    message = f"I've prepared an event plan with character consistency enabled using {len(character_urls)} character sheet(s). Click below to generate it with AI."
                else:
                    message = "I've prepared an event plan with character consistency enabled. Click below to generate it with AI."

            # Return preview data that will show "Generate Event with AI" button
            return {
                "status": "success",
                "message": message,
                "preview_data": preview_data
            }
        elif response.status_code == 400:
            return {
                "status": "error",
                "error": "Team ID required for event creation. Please ensure user is authenticated."
            }

        return {
            "status": "error",
            "error": f"Event creation failed: {response.status_code}"
        }
    except requests.exceptions.ConnectionError:
        logger.warning("Next.js API not available, returning simple preview")
        # Fallback when Next.js API is not available
        effective_brand_id = brand_id or get_brand_context()

        # Build character consistency config if enabled
        character_consistency_config = None
        if enable_character_consistency:
            character_urls = [url.strip() for url in character_sheet_urls.split(',') if url.strip()]
            characters = []
            for i, url in enumerate(character_urls):
                characters.append({
                    "id": f"char-{i+1}",
                    "name": f"Character {i+1}",
                    "characterSheetUrl": url,
                    "isActive": True
                })
            character_consistency_config = {
                "enabled": True,
                "characters": characters,
                "useSceneToSceneConsistency": True,
                "maxReferenceImages": 14
            }

        return {
            "status": "success",
            "type": "event_preview",
            "description": description,
            "brand_id": effective_brand_id,
            "message": f"I'll help you create an event for: {description}. Click the button below to generate the details.",
            "preview_data": {
                "action": "generate-campaign",
                "prompt": description,
                "campaignName": description[:50],
                "brandId": effective_brand_id,
                "characterConsistency": character_consistency_config,
            }
        }
    except Exception as e:
        logger.error(f"Error in create_event: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def search_team_media(
    query: str,
    brand_id: str = "",
    media_type: str = "",
    include_ai_generated: bool = True,
    include_uploads: bool = True,
    include_brand_soul: bool = True,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Search team's multimodal media library using Vertex AI Search.

    This is a Team Tool for finding images, videos, and other media assets
    across the team's library using natural language search. It leverages
    Vertex AI Search for semantic understanding of queries.

    Use this tool when team members need to:
    - Find specific media assets for campaigns
    - Discover existing content before creating new
    - Search for media by visual description or theme
    - Find AI-generated content or brand assets
    - Locate media for presentations or marketing materials

    Examples:
    - "Find team photos from the product launch"
    - "Search for blue background images"
    - "Look for videos about our services"
    - "Find AI-generated promotional images"
    - "Show brand soul assets with company colors"

    Args:
        query (str): Natural language search query describing the media to find.
        brand_id (str): Brand/Team ID. If empty, uses current context.
        media_type (str): Filter by type: 'image', 'video', or '' for all.
        include_ai_generated (bool): Include AI-generated content (default: True).
        include_uploads (bool): Include uploaded content (default: True).
        include_brand_soul (bool): Include brand soul assets (default: True).
        limit (int): Maximum results to return (default: 20, max: 50).

    Returns:
        dict: Contains 'results' with media items, 'total_count', and search metadata.
              Each result includes id, title, description, type, url, thumbnail_url,
              source, tags, and relevance_score.
    """
    try:
        from services.media_search_service import get_media_search_service

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            return {
                "status": "error",
                "error": "Brand ID required for media search. Please ensure user is authenticated.",
                "results": [],
                "total_count": 0
            }

        # Build source filter based on flags
        sources = []
        if include_ai_generated:
            sources.extend(['ai-generated', 'chatbot', 'imagen', 'veo'])
        if include_uploads:
            sources.append('upload')
        if include_brand_soul:
            sources.append('brand-soul')

        # Validate limit
        limit = min(max(1, limit), 50)

        # Get search service and perform search
        search_service = get_media_search_service()

        # If specific source filters requested, we need to handle differently
        # For now, we'll use a combined approach
        source_filter = None
        if not include_ai_generated or not include_uploads or not include_brand_soul:
            # Only apply source filter if some are disabled
            if len(sources) == 1:
                source_filter = sources[0]

        result = search_service.search(
            brand_id=effective_brand_id,
            query=query,
            media_type=media_type if media_type else None,
            source=source_filter,
            page_size=limit,
        )

        if result.results:
            # Filter results by source if needed
            filtered_results = result.results
            if not include_ai_generated or not include_uploads or not include_brand_soul:
                filtered_results = [
                    r for r in result.results
                    if r.source in sources
                ]

            # Format results for team use
            formatted_results = []
            image_urls = []
            video_urls = []
            for r in filtered_results[:limit]:
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
                })
                # Collect URLs for visual display in chat
                if r.media_type == "image" and r.url:
                    image_urls.append(r.url)
                elif r.media_type == "video" and r.url:
                    video_urls.append(r.url)

            # Standardized text response format with media markers for chat display
            summary_text = f"Found {len(formatted_results)} media items for your team."

            # Add image URL markers for frontend to extract and display nicely
            media_markers = ""
            for url in image_urls:
                media_markers += f"\n__IMAGE_URL__{url}__IMAGE_URL__"
            for url in video_urls:
                media_markers += f"\n__VIDEO_URL__{url}__VIDEO_URL__"

            return {
                "status": "success",
                "results": formatted_results,
                "total_count": len(formatted_results),
                "search_time_ms": result.search_time_ms,
                "query": result.query,
                "content": summary_text + media_markers,  # Primary text field with media markers
                "message": summary_text   # Backward compatibility (text only)
            }
        else:
            # Standardized text response format
            no_results_text = f"No media found matching '{query}'. Try different search terms."
            return {
                "status": "success",
                "results": [],
                "total_count": 0,
                "search_time_ms": result.search_time_ms,
                "query": result.query,
                "content": no_results_text,  # Primary text field for consistency with agent
                "message": no_results_text   # Backward compatibility
            }

    except ImportError as e:
        logger.error(f"Media search service not available: {e}")
        return {
            "status": "error",
            "error": "Media search service not available",
            "results": [],
            "total_count": 0
        }
    except Exception as e:
        logger.error(f"Error in search_team_media: {e}")
        return {
            "status": "error",
            "error": str(e),
            "results": [],
            "total_count": 0
        }


def find_similar_media(
    media_id: str,
    brand_id: str = "",
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Find media similar to a given media item.

    This tool helps team members discover related content by finding
    media that is semantically similar to a reference item. Useful for:
    - Finding variations of existing assets
    - Discovering related content for campaigns
    - Building collections of similar media
    - Finding alternatives to a specific image or video

    Args:
        media_id (str): ID of the reference media item.
        brand_id (str): Brand/Team ID. If empty, uses current context.
        limit (int): Maximum results to return (default: 10, max: 20).

    Returns:
        dict: Contains 'results' with similar media items and relevance scores.
    """
    try:
        from services.media_search_service import get_media_search_service
        import requests

        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            return {
                "status": "error",
                "error": "Brand ID required for finding similar media.",
                "results": []
            }

        # First, get the reference media item to extract searchable content
        # This would typically call the Next.js API to get media details
        # For now, we'll use the media_id as a search seed

        search_service = get_media_search_service()

        # Use the media ID as part of the query to find similar items
        # A more sophisticated implementation would fetch the media metadata
        # and use its description/tags as the search query
        result = search_service.search(
            brand_id=effective_brand_id,
            query=f"similar to {media_id}",  # Simplified approach
            page_size=min(limit, 20) + 1,  # +1 to potentially exclude the reference
        )

        # Filter out the reference media itself
        filtered_results = [r for r in result.results if r.media_id != media_id][:limit]

        if filtered_results:
            formatted_results = []
            image_urls = []
            video_urls = []
            for r in filtered_results:
                formatted_results.append({
                    "id": r.media_id,
                    "title": r.title,
                    "description": r.description,
                    "type": r.media_type,
                    "source": r.source,
                    "url": r.url,
                    "thumbnail_url": r.thumbnail_url,
                    "tags": r.tags,
                    "similarity_score": r.relevance_score,
                })
                # Collect URLs for visual display in chat
                if r.media_type == "image" and r.url:
                    image_urls.append(r.url)
                elif r.media_type == "video" and r.url:
                    video_urls.append(r.url)

            # Standardized text response format with media markers for chat display
            summary_text = f"Found {len(formatted_results)} similar media items."

            # Add image URL markers for frontend to extract and display nicely
            media_markers = ""
            for url in image_urls:
                media_markers += f"\n__IMAGE_URL__{url}__IMAGE_URL__"
            for url in video_urls:
                media_markers += f"\n__VIDEO_URL__{url}__VIDEO_URL__"

            return {
                "status": "success",
                "results": formatted_results,
                "reference_id": media_id,
                "content": summary_text + media_markers,  # Primary text field with media markers
                "message": summary_text   # Backward compatibility (text only)
            }
        else:
            # Standardized text response format
            no_results_text = "No similar media found. The library may need more content."
            return {
                "status": "success",
                "results": [],
                "reference_id": media_id,
                "content": no_results_text,  # Primary text field for consistency with agent
                "message": no_results_text   # Backward compatibility
            }

    except Exception as e:
        logger.error(f"Error in find_similar_media: {e}")
        return {
            "status": "error",
            "error": str(e),
            "results": []
        }
