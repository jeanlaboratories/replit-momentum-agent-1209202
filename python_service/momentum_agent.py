"""
MOMENTUM Agentic AI Assistant
Built with Google ADK (Agent Development Kit)

This agent uses Gemini Text, Imagen, Vision, Veo, and team tools as capabilities.
"""

import os
import json
import logging
from dotenv import load_dotenv

# Construct a path to the .env file in the project root
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
dotenv_path = os.path.join(project_root, '.env')

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
else:
    print(f"Warning: .env file not found at {dotenv_path}. Environment variables may not be loaded.")

# Import our marketing agent
from marketing_agent import MarketingAgent
from typing import Dict, Any, List
from google.adk.agents import Agent, LlmAgent
from google.adk.memory import VertexAiRagMemoryService
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools import google_search
import uuid

from google.genai import Client
import requests
import base64
import urllib.parse
from firecrawl import Firecrawl
from utils.model_defaults import (
    DEFAULT_TEXT_MODEL, DEFAULT_AGENT_MODEL, DEFAULT_YOUTUBE_ANALYSIS_MODEL,
    DEFAULT_SEARCH_MODEL
)

logger = logging.getLogger(__name__)

# Get API keys from environment (with MOMENTUM_ prefix)
GOOGLE_API_KEY = os.getenv('MOMENTUM_GOOGLE_API_KEY')
FIRECRAWL_API_KEY = os.getenv('MOMENTUM_FIRECRAWL_API_KEY')

if GOOGLE_API_KEY:
    # Set GOOGLE_API_KEY for ADK and other libraries that expect it
    os.environ['GOOGLE_API_KEY'] = GOOGLE_API_KEY

else:
    logger.warning("MOMENTUM_GOOGLE_API_KEY not set - agent will have limited functionality")

if not FIRECRAWL_API_KEY:
    logger.warning("MOMENTUM_FIRECRAWL_API_KEY not set - website crawling will be unavailable")

# Initialize clients
genai_client = Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None
firecrawl_client = Firecrawl(api_key=FIRECRAWL_API_KEY) if FIRECRAWL_API_KEY else None

# Import new modules
from utils.storage_utils import upload_to_storage, upload_file_to_gemini, set_genai_client as set_storage_genai_client
from utils.context_utils import (
    set_brand_context, set_user_context, set_settings_context, set_media_context, set_team_context,
    get_brand_context, get_user_context, get_settings_context, get_media_context, get_team_context
)
from tools.team_tools import suggest_domain_names, create_team_strategy, plan_website, create_event, search_team_media, find_similar_media, search_youtube_videos
from tools.media_tools import generate_image, analyze_image, generate_video, nano_banana, set_genai_client as set_media_genai_client
from tools.rag_tools import query_brand_documents, index_brand_document
from tools.media_search_tools import search_media_library, search_images, search_videos
from services.memory_service import (
    InMemoryMemoryService, extract_memories_from_conversation, save_conversation_to_memory,
    set_genai_client as set_memory_genai_client, set_memory_service
)

# Initialize default InMemoryMemoryService.
memory_service = InMemoryMemoryService()
set_memory_service(memory_service)

# Set genai_client in new modules
if genai_client:
    set_storage_genai_client(genai_client)
    set_media_genai_client(genai_client)
    set_memory_genai_client(genai_client)


# Initialize Firebase Admin
import firebase_admin
from firebase_admin import credentials, storage

try:
    if not firebase_admin._apps:
        # Try to get credentials from environment JSON first
        service_account_json = os.getenv('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON')
        cred = None
        
        if service_account_json:
            try:
                import json
                cert_dict = json.loads(service_account_json)
                cred = credentials.Certificate(cert_dict)
                logger.info("Initialized Firebase Admin with MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON")
            except Exception as e:
                logger.warning(f"Failed to parse service account JSON: {e}")
        
        if not cred:
            # Fallback to default credentials (ADC)
            logger.info("Using Application Default Credentials for Firebase Admin")
            cred = credentials.ApplicationDefault()
            
        bucket_name = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'momentum-agent-generated')
        firebase_admin.initialize_app(cred, {
            'storageBucket': bucket_name
        })
    logger.info(f"Firebase Admin initialized successfully with bucket: {firebase_admin.storage.bucket().name}")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin: {e}")

# ============================================================================
# TOOL DEFINITIONS
# ============================================================================

def generate_text(prompt: str, context: str = "") -> Dict[str, Any]:
    """
    Generate text using Gemini for conversations, brainstorming, and content creation.

    Args:
        prompt: The text prompt or question
        context: Conversation context

    Returns:
        dict: Generated text response
    """
    try:
        if not genai_client:
            return {
                "status": "error",
                "error": "Google AI client not initialized - API key required"
            }

        # Build full prompt with context if provided
        full_prompt = f"{context}\n\n{prompt}" if context else prompt

        # Get model from settings context, fallback to default
        settings = get_settings_context()
        model_name = settings.get('textModel') or DEFAULT_TEXT_MODEL
        logger.info(f"generate_text using model: {model_name}")

        # Use Gemini for text generation
        response = genai_client.models.generate_content(
            model=model_name,
            contents=full_prompt
        )

        return {
            "status": "success",
            "text": response.text,
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error in generate_text: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


def generate_image(
    prompt: str,
    brand_id: str = "",
    aspect_ratio: str = '1:1',
    number_of_images: int = 1,
    person_generation: str = "",
    safety_filter_level: str = "",
    output_mime_type: str = ""
) -> Dict[str, Any]:
    """
    Generate images using Imagen 4.0 from text prompts. USE THIS TOOL whenever a user asks to create,
    generate, make, or produce an image from a text description.

    Examples of when to use this tool:
    - "Generate an image of a soccer player"
    - "Create a picture of a mountain landscape"
    - "Make an image of a basketball court"
    - Any request to create image content from a description

    Args:
        prompt: Description of the image to generate
        brand_id: Brand ID for team-specific styling
        aspect_ratio: Aspect ratio - "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
        number_of_images: Number of images to generate (1-8)
        person_generation: Control person generation - "allow_all", "allow_adult"
        safety_filter_level: Safety filter level - "block_only_high", "block_medium_and_above", "block_low_and_above"
        output_mime_type: Output format - "image/png" or "image/jpeg"

    Returns:
        dict: Generated image data and metadata including URL(s)
    """
    # Delegate to media_tools implementation with full parameter support
    from tools.media_tools import generate_image as media_generate_image
    return media_generate_image(
        prompt=prompt,
        brand_id=brand_id,
        aspect_ratio=aspect_ratio,
        number_of_images=number_of_images,
        person_generation=person_generation,
        safety_filter_level=safety_filter_level,
        output_mime_type=output_mime_type
    )


def analyze_image(prompt: str, image_url: str = "", image_data: str = "") -> Dict[str, Any]:
    """
    Analyze and understand images using Gemini Vision.
    
    IMPORTANT: This tool accepts EITHER a URL OR base64 image data.
    - If you see an image URL in the context (e.g., from "Attached Media:" or "Resolved Image(s)"), pass it as image_url
    - The tool will download and analyze the image for you
    - If you already have base64 data, you can pass it as image_data
    
    Args:
        prompt (str): Question or analysis request about the image (e.g., "describe this image", "what's in this photo?")
        image_url (str): URL to the image (Firebase Storage, HTTP, or HTTPS). This is the PREFERRED and EASIEST method.
        image_data (str): Base64-encoded image data (alternative if you don't have a URL)
    
    Returns:
        dict: Analysis results with 'status', 'analysis', and 'model'
        
    Examples:
        - analyze_image(prompt="what's in this image?", image_url="https://storage.googleapis.com/.../photo.jpg")
        - analyze_image(prompt="describe this", image_url="https://firebasestorage.googleapis.com/.../image.png")
    """
    # Import analyze_image from tools to avoid duplication
    from tools.media_tools import analyze_image as tool_analyze_image
    return tool_analyze_image(prompt=prompt, image_url=image_url, image_data=image_data)


def generate_video(
    prompt: str,
    image_url: str = "",
    character_reference: str = "",
    start_frame: str = "",
    end_frame: str = "",
    aspect_ratio: str = '9:16',
    resolution: str = '720p',
    duration_seconds: int = 0,
    person_generation: str = "",
    video_url: str = "",
    reference_images: str = "",
    use_fast_model: bool = False
) -> Dict[str, Any]:
    """
    Generate videos using Veo 3.1 from text prompts and optional image inputs.

    USE THIS TOOL IMMEDIATELY when a user asks to:
    - "generate a video"
    - "create a video"
    - "make a video"
    - "produce a video"
    - "animate this image"
    - "make a video from these frames"
    - Any request involving VIDEO GENERATION or VIDEO CREATION

    CRITICAL: You MUST use this tool for ALL video generation requests. DO NOT suggest
    finding videos online, using YouTube, or any external sources. You have the power
    to generate videos directly with Veo 3.1 - use it!

    Examples that REQUIRE this tool:
    - "Generate a video of an eagle flying" → generate_video("an eagle flying in the sky")
    - "Animate this image of a car" → generate_video("car driving fast", image_url="...")
    - "Make a video of this character walking" → generate_video("walking down street", character_reference="...")
    - "Create a transition between these two images" → generate_video("smooth transition", start_frame="...", end_frame="...")
    - "Animate this image but keep the character consistent with this reference" → generate_video("...", image_url="...", character_reference="...")
    - "Generate a landscape video of a beach" → generate_video("sunny beach", aspect_ratio="16:9")

    Args:
        prompt: Detailed text description of the video scene to generate (up to 1024 tokens)
        image_url: URL or base64 data of an image to animate (Image-to-Video)
        character_reference: URL or base64 data of a character/object reference (Ingredients)
        start_frame: URL or base64 data for the starting frame (Frames-to-Video)
        end_frame: URL or base64 data for the ending frame (Frames-to-Video)
        aspect_ratio: Aspect ratio. Supported: '16:9' (Landscape), '9:16' (Portrait). Default '9:16'.
        resolution: Resolution. Supported: '720p' (default), '1080p' (only for 8s duration)
        duration_seconds: Duration. Supported: 4, 6, 8 seconds. If not specified, uses default.
        person_generation: Person generation setting. Use 'allow_all' for text-to-video with people.
        video_url: URL to a previously generated video to extend (Video Extension feature)
        reference_images: Comma-separated URLs of up to 3 reference images to guide content
        use_fast_model: Flag to use veo-3.1-fast-generate-preview for faster generation

    Returns:
        dict: Contains 'status', 'message', 'video_url', 'format', and 'prompt'
    """
    # Delegate to media_tools implementation
    from tools.media_tools import generate_video as media_generate_video
    return media_generate_video(
        prompt=prompt,
        image_url=image_url,
        character_reference=character_reference,
        start_frame=start_frame,
        end_frame=end_frame,
        aspect_ratio=aspect_ratio,
        resolution=resolution,
        duration_seconds=duration_seconds,
        person_generation=person_generation,
        video_url=video_url,
        reference_images=reference_images,
        use_fast_model=use_fast_model
    )





def search_web(query: str) -> Dict[str, Any]:
    """
    Search the web for information using multiple search providers.
    Priority: Google Custom Search > SerpAPI > DuckDuckGo

    USE THIS TOOL whenever a user asks to:
    - "Search for X"
    - "Find information about X"
    - "Look up X"
    - "What is X" (if it requires current/external knowledge)
    - "Who is X"
    - "Latest news about X"

    Note: The ADK google_search tool is available to the Agent directly for
    grounded search. This function provides a fallback search capability.

    Args:
        query (str): The search query

    Returns:
        dict: Search results with titles, snippets, and URLs
    """
    # Try Google Custom Search first (works reliably from Cloud Run)
    google_result = _search_google_custom(query)
    if google_result.get("status") == "success":
        return google_result

    # Try SerpAPI as second option (reliable commercial API)
    serp_result = _search_serpapi(query)
    if serp_result.get("status") == "success":
        return serp_result

    # Fallback to DuckDuckGo (works on localhost but may be blocked on Cloud Run)
    logger.info(f"Cloud search APIs unavailable, falling back to DuckDuckGo for: {query}")
    return _search_duckduckgo(query)


def _search_google_custom(query: str) -> Dict[str, Any]:
    """Search using Google Custom Search JSON API."""
    try:
        import requests

        # Get API key and Search Engine ID from environment
        # Check multiple possible env var names for compatibility
        api_key = (os.environ.get("GOOGLE_CUSTOM_SEARCH_API_KEY") or
                   os.environ.get("GOOGLE_API_KEY") or
                   os.environ.get("MOMENTUM_GOOGLE_API_KEY"))
        search_engine_id = (os.environ.get("GOOGLE_CUSTOM_SEARCH_ENGINE_ID") or
                           os.environ.get("MOMENTUM_GOOGLE_CUSTOM_SEARCH_ENGINE_ID"))

        if not api_key or not search_engine_id:
            logger.debug("Google Custom Search not configured (missing API key or Search Engine ID)")
            return {"status": "not_configured"}

        logger.info(f"Searching with Google Custom Search: {query}")

        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": api_key,
            "cx": search_engine_id,
            "q": query,
            "num": 5  # Number of results
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if "items" in data:
            results = []
            for item in data["items"]:
                results.append({
                    "title": item.get("title", ""),
                    "href": item.get("link", ""),
                    "body": item.get("snippet", "")
                })

            return {
                "status": "success",
                "results": results,
                "query": query,
                "source": "google_custom_search"
            }

        return {
            "status": "error",
            "error": "No results found"
        }

    except Exception as e:
        logger.warning(f"Google Custom Search failed: {e}")
        return {"status": "error", "error": str(e)}


def _search_serpapi(query: str) -> Dict[str, Any]:
    """Search using SerpAPI (reliable commercial search API)."""
    try:
        import requests

        api_key = os.environ.get("SERPAPI_API_KEY")

        if not api_key:
            logger.debug("SerpAPI not configured (missing SERPAPI_API_KEY)")
            return {"status": "not_configured"}

        logger.info(f"Searching with SerpAPI: {query}")

        url = "https://serpapi.com/search"
        params = {
            "api_key": api_key,
            "q": query,
            "engine": "google",
            "num": 5
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if "organic_results" in data:
            results = []
            for item in data["organic_results"][:5]:
                results.append({
                    "title": item.get("title", ""),
                    "href": item.get("link", ""),
                    "body": item.get("snippet", "")
                })

            return {
                "status": "success",
                "results": results,
                "query": query,
                "source": "serpapi"
            }

        return {
            "status": "error",
            "error": "No results found"
        }

    except Exception as e:
        logger.warning(f"SerpAPI search failed: {e}")
        return {"status": "error", "error": str(e)}


def _search_duckduckgo(query: str) -> Dict[str, Any]:
    """Search using DuckDuckGo (fallback for localhost/development)."""
    try:
        logger.info(f"Searching web with DuckDuckGo: {query}")

        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5, backend="html"))

        if results:
            return {
                "status": "success",
                "results": results,
                "query": query,
                "source": "duckduckgo"
            }

        return {
            "status": "error",
            "error": "No results found"
        }
    except Exception as e:
        logger.error(f"Error in DuckDuckGo search: {e}")
        return {
            "status": "error",
            "error": str(e)
        }



def design_logo_concepts(team_name: str, team_type: str, style: str = "") -> Dict[str, Any]:
    """
    Design creative logo concepts and visual identity ideas.

    Args:
        team_name: Name of the team
        team_type: Type of team
        style: Preferred style (modern, classic, minimalist, bold, etc.)

    Returns:
        dict: Logo concepts and design recommendations
    """
    try:
        # Call MarketingAgent directly instead of making HTTP request to avoid deadlock
        agent = MarketingAgent()
        response = agent.create_logo_concepts({
            "name": team_name,
            "type": team_type,
            "style": style
        })
        
        return {
            "status": "success",
            "concepts": {},  # MarketingAgent returns text, not dict
            "message": response.result
        }
    except Exception as e:
        logger.error(f"Error in design_logo_concepts: {e}")
        return {
            "status": "error",
            "error": str(e)
        }




class MockEvent:
    def __init__(self, content):
        self.content = content

class MockSession:
    def __init__(self, id, app_name, user_id, events):
        self.id = id
        self.app_name = app_name
        self.user_id = user_id
        self.events = events

class MockEvent:
    def __init__(self, content):
        self.content = content

class MockSession:
    def __init__(self, id, app_name, user_id, events):
        self.id = id
        self.app_name = app_name
        self.user_id = user_id
        self.events = events

async def recall_memory(query: str, user_id: str = "", scope: str = "all") -> dict:
    """
    Recall information from your long-term memory banks (both personal and team).
    Use this tool when a user asks about past conversations, preferences, or information you should have remembered.

    The memory system has two banks:
    - Personal Memory: Your private memories about this specific user
    - Team Memory: Shared memories known by all team members

    When both banks are enabled, memories from both are searched automatically.

    Args:
        query: The search query to find relevant memories.
        user_id: The user ID to search for. If not provided, the current user ID will be used.
                 Do NOT ask the user for their user ID.
        scope: Which memory banks to search: "all" (default), "personal", or "team".

    Returns:
        dict: A dictionary containing the status and found memories, categorized by source.
    """
    current_user_id = get_user_context()
    current_brand_id = get_brand_context()

    # Use provided user_id or fallback to global context
    logger.info(f"recall_memory called with query: '{query}', user_id: '{user_id}', scope: '{scope}'")
    logger.info(f"Current context - User: {current_user_id}, Brand: {current_brand_id}")

    # Prioritize global context (authenticated user) over passed argument to prevent hallucinations
    actual_user_id = current_user_id or user_id

    if not actual_user_id:
        logger.warning("No user_id provided for recall_memory and no global context available.")
        return {
            "status": "error",
            "error": "User ID is required but not provided or found in context."
        }

    # Dynamically determine which memory services to use
    personal_agent_engine_id = None
    team_agent_engine_id = None
    try:
        from firebase_admin import firestore
        db = firestore.client()

        # Get personal agent engine ID
        user_doc = db.collection('users').document(actual_user_id).get()
        if user_doc.exists:
            personal_agent_engine_id = user_doc.to_dict().get('agentEngineId')
            logger.info(f"Found Personal Agent Engine ID for user {actual_user_id}: {personal_agent_engine_id}")
        else:
            logger.info(f"No user doc found for {actual_user_id}")

        # Get team agent engine ID if brand context is available
        if current_brand_id:
            brand_doc = db.collection('brands').document(current_brand_id).get()
            if brand_doc.exists:
                team_agent_engine_id = brand_doc.to_dict().get('teamAgentEngineId')
                logger.info(f"Found Team Agent Engine ID for brand {current_brand_id}: {team_agent_engine_id}")
    except Exception as e:
        logger.error(f"Error fetching agent engines: {e}")

    enable_memory_bank = os.getenv('MOMENTUM_ENABLE_MEMORY_BANK', 'false').lower() == 'true'
    logger.info(f"Memory Bank Enabled: {enable_memory_bank}, Personal Engine: {personal_agent_engine_id}, Team Engine: {team_agent_engine_id}")

    try:
        logger.info(f"<<<<<<<<<< MEMORY RECALL: ATTEMPTING TO RECALL MEMORY FOR USER: {actual_user_id} >>>>>>>>>>")
        logger.info(f"Recall query: '{query}', scope: '{scope}'")

        personal_memories = []
        team_memories = []

        # Helper function to retrieve memories from an engine
        async def retrieve_from_engine(engine_id: str, memory_type: str, scope_id: str) -> list:
            memories = []
            try:
                project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')
                location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')

                adk_memory_service = VertexAiRagMemoryService(
                    project=project_id,
                    location=location,
                    agent_engine_id=engine_id
                )
                client = adk_memory_service._get_api_client()
                agent_engine_name = f'projects/{project_id}/locations/{location}/reasoningEngines/{engine_id}'

                logger.info(f"Retrieving {memory_type} memories from engine {engine_id} with query: '{query}'")

                try:
                    # Use semantic search
                    memories_iterator = client.agent_engines.memories.retrieve(
                        name=agent_engine_name,
                        scope={"user_id": scope_id} if memory_type == 'personal' else {"brand_id": scope_id},
                        similarity_search_params={"searchQuery": query, "topK": 10}
                    )

                    for retrieved_memory in memories_iterator:
                        memory_obj = getattr(retrieved_memory, 'memory', None)
                        if memory_obj:
                            fact = getattr(memory_obj, 'fact', None)
                            if fact:
                                memories.append({"fact": fact, "source": memory_type})
                        else:
                            fact = getattr(retrieved_memory, 'fact', None)
                            if fact:
                                memories.append({"fact": fact, "source": memory_type})

                except Exception as retrieve_e:
                    logger.warning(f"Semantic retrieve failed for {memory_type}, falling back to list: {retrieve_e}")
                    try:
                        memories_list = client.agent_engines.memories.list(name=agent_engine_name)
                        query_lower = query.lower()
                        for memory in memories_list:
                            fact = getattr(memory, 'fact', None)
                            if fact and any(word in fact.lower() for word in query_lower.split() if len(word) > 2):
                                memories.append({"fact": fact, "source": memory_type})
                                if len(memories) >= 10:
                                    break
                    except Exception as list_e:
                        logger.warning(f"List fallback failed for {memory_type}: {list_e}")

            except Exception as e:
                logger.warning(f"Failed to retrieve {memory_type} memories: {e}")
            return memories

        # Search personal memory bank if enabled and exists
        if (scope == 'all' or scope == 'personal') and personal_agent_engine_id and enable_memory_bank:
            logger.info(f"Searching personal Memory Bank for user {actual_user_id} (Engine: {personal_agent_engine_id})")
            personal_memories = await retrieve_from_engine(personal_agent_engine_id, 'personal', actual_user_id)
            logger.info(f"Found {len(personal_memories)} personal memories")

        # Search team memory bank if enabled and exists
        if (scope == 'all' or scope == 'team') and team_agent_engine_id and enable_memory_bank and current_brand_id:
            logger.info(f"Searching team Memory Bank for brand {current_brand_id} (Engine: {team_agent_engine_id})")
            team_memories = await retrieve_from_engine(team_agent_engine_id, 'team', current_brand_id)
            logger.info(f"Found {len(team_memories)} team memories")

        # Combine memories from both sources
        formatted_memories = []

        # Add personal memories with source label
        for mem in personal_memories:
            fact = mem.get('fact', '')
            if fact:
                formatted_memories.append(f"[Personal] {fact}")

        # Add team memories with source label
        for mem in team_memories:
            fact = mem.get('fact', '')
            if fact:
                formatted_memories.append(f"[Team] {fact}")

        # If no Vertex AI memories found and memory bank is enabled, try Firestore fallback
        if not formatted_memories and enable_memory_bank:
            logger.info("No memories found in Vertex AI, falling back to Firestore")
            try:
                from firebase_admin import firestore
                db = firestore.client()

                # Personal memories from Firestore
                if scope in ['all', 'personal']:
                    memories_ref = db.collection('users').document(actual_user_id).collection('memories')
                    docs = memories_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(10).stream()
                    for doc in docs:
                        data = doc.to_dict()
                        content = data.get('content', '')
                        if content:
                            formatted_memories.append(f"[Personal] {content}")

                # Team memories from Firestore
                if scope in ['all', 'team'] and current_brand_id:
                    team_memories_ref = db.collection('brands').document(current_brand_id).collection('memories')
                    team_docs = team_memories_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(10).stream()
                    for doc in team_docs:
                        data = doc.to_dict()
                        content = data.get('content', '')
                        if content:
                            formatted_memories.append(f"[Team] {content}")

                logger.info(f"Found {len(formatted_memories)} memories from Firestore fallback")
            except Exception as fs_e:
                logger.warning(f"Firestore fallback failed: {fs_e}")

        # If memory bank is not enabled, use Firestore only
        if not enable_memory_bank:
            logger.info(f"Memory Bank not enabled, using Firestore for user {actual_user_id}")
            try:
                from firebase_admin import firestore
                db = firestore.client()
                memories_ref = db.collection('users').document(actual_user_id).collection('memories')
                docs = memories_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(20).stream()

                for doc in docs:
                    data = doc.to_dict()
                    content = data.get('content', '')
                    if content:
                        formatted_memories.append(content)
                logger.info(f"Found {len(formatted_memories)} memories from Firestore")
            except Exception as fs_e:
                logger.warning(f"Firestore query failed: {fs_e}")

        logger.info(f"Total formatted memories: {len(formatted_memories)}")

        return {
            "status": "success",
            "memories": formatted_memories,
            "personal_count": len(personal_memories),
            "team_count": len(team_memories)
        }
    except Exception as e:
        logger.error(f"Error recalling memory for user {actual_user_id}: {e}", exc_info=True)
        return {
            "status": "error",
            "error": f"An error occurred while searching memory: {e}"
        }

async def save_memory(memory_text: str, user_id: str = "", scope: str = "personal") -> Dict[str, Any]:
    """
    Save important information to long-term memory.

    USE THIS TOOL PROACTIVELY whenever you learn facts that should be remembered:

    For PERSONAL memories (scope='personal'):
    - Favorite things (color, food, music, movies, sports teams, etc.)
    - Personal preferences and opinions
    - Their name, location, job, or other personal details they share
    - Important dates (birthday, anniversary, etc.)
    - Hobbies, interests, and activities they enjoy
    - Goals, dreams, or aspirations they mention
    - Family members, pets, or relationships they discuss

    For TEAM memories (scope='team'):
    - Brand guidelines and preferences
    - Team-wide knowledge that should be shared
    - Company policies or procedures
    - Shared resources or contacts
    - Team preferences (tone, style, etc.)

    You do NOT need to ask permission to save memories - just save them automatically!
    Use scope='team' when the user explicitly asks to share something with the team.

    Args:
        memory_text: The information to remember. Be specific and include context.
                     Example: "User's favorite color is blue" or "Team prefers formal tone in communications"
        user_id: The user ID to save for. If not provided, the current user ID will be used.
                 Do NOT ask the user for their user ID.
        scope: Where to save the memory - 'personal' (default) or 'team'.
               Use 'team' when the user wants to share knowledge with the entire team.

    Returns:
        dict: A dictionary containing the status of the save operation.
    """
    current_user_id = get_user_context()
    current_brand_id = get_brand_context()

    logger.info(f"save_memory called with text: '{memory_text[:50]}...', user_id: '{user_id}', scope: '{scope}'")

    # Prioritize global context (authenticated user) over passed argument
    actual_user_id = current_user_id or user_id

    if not actual_user_id:
        logger.warning("No user_id provided for save_memory and no global context available.")
        return {
            "status": "error",
            "error": "User ID is required but not provided or found in context."
        }

    # For team scope, we need a brand ID
    if scope == 'team' and not current_brand_id:
        logger.warning("Team scope requested but no brand context available.")
        return {
            "status": "error",
            "error": "Team memory requires a brand context. Please ensure you're in a team workspace."
        }

    try:
        from firebase_admin import firestore
        db = firestore.client()
        project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')
        location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')

        if scope == 'team':
            # Save to team memory bank
            brand_doc = db.collection('brands').document(current_brand_id).get()
            team_agent_engine_id = brand_doc.to_dict().get('teamAgentEngineId') if brand_doc.exists else None

            if team_agent_engine_id and project_id:
                # Save to Vertex AI team memory using vertexai.Client (as shown in ADK notebook)
                try:
                    import vertexai
                    
                    logger.info(f"Initializing vertexai for team memory save: project={project_id}, location={location}, engine_id={team_agent_engine_id}")
                    
                    # Initialize vertexai client (same as ADK notebook)
                    vertexai.init(project=project_id, location=location)
                    client = vertexai.Client(project=project_id, location=location)
                    
                    logger.info(f"Created vertexai.Client: type={type(client).__name__}, has agent_engines={hasattr(client, 'agent_engines')}")
                    
                    agent_engine_name = f"projects/{project_id}/locations/{location}/reasoningEngines/{team_agent_engine_id}"
                    
                    logger.info(f"Attempting to save team memory to Vertex AI: engine={agent_engine_name}, memory_text='{memory_text[:50]}...'")
                    
                    # Use memories.generate API with events (same format as ADK notebook)
                    events_data = [{
                        'content': {
                            'role': 'user',
                            'parts': [{'text': memory_text}]
                        }
                    }]
                    
                    logger.info(f"Calling client.agent_engines.memories.generate() with name={agent_engine_name}")
                    operation = client.agent_engines.memories.generate(
                        name=agent_engine_name,
                        direct_contents_source={'events': events_data},
                        scope={
                            'app_name': "MOMENTUM",
                            'brand_id': current_brand_id
                        },
                        config={'wait_for_completion': True}
                    )
                    
                    adk_memory_id = None
                    if hasattr(operation, 'name'):
                        adk_memory_id = operation.name
                    elif hasattr(operation, 'response') and operation.response:
                        if hasattr(operation.response, 'name'):
                            adk_memory_id = operation.response.name

                    # Also save to Firestore for listing
                    # Use adk_memory_id as document ID if available for easier deletion
                    memories_col = db.collection('brands').document(current_brand_id).collection('memories')
                    
                    if adk_memory_id:
                        # Extract short memory ID from full path for use as document ID
                        # Format: projects/.../reasoningEngines/.../memories/{short_id}
                        short_memory_id = adk_memory_id.split('/')[-1] if '/' in adk_memory_id else adk_memory_id
                        memories_col.document(short_memory_id).set({
                            'content': memory_text,
                            'createdAt': firestore.SERVER_TIMESTAMP,
                            'updatedAt': firestore.SERVER_TIMESTAMP,
                            'adkMemoryId': adk_memory_id,
                            'createdBy': actual_user_id
                        })
                        logger.info(f"Saved team memory to Firestore with ID {short_memory_id} (from adk_memory_id)")
                    else:
                        # Fallback to auto-generated ID if no adk_memory_id
                        memories_col.add({
                            'content': memory_text,
                            'createdAt': firestore.SERVER_TIMESTAMP,
                            'updatedAt': firestore.SERVER_TIMESTAMP,
                            'adkMemoryId': adk_memory_id,
                            'createdBy': actual_user_id
                        })

                    logger.info(f"Successfully saved team memory for brand {current_brand_id}")
                    return {
                        "status": "success",
                        "message": "Team memory saved successfully. This knowledge is now shared with all team members.",
                        "scope": "team"
                    }
                except Exception as e:
                    logger.error(f"Error saving to Vertex AI team memory: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    # Fallback to Firestore only
                    db.collection('brands').document(current_brand_id).collection('memories').add({
                        'content': memory_text,
                        'createdAt': firestore.SERVER_TIMESTAMP,
                        'updatedAt': firestore.SERVER_TIMESTAMP,
                        'createdBy': actual_user_id
                    })
                    return {
                        "status": "success",
                        "message": "Team memory saved to Firestore (Vertex AI unavailable).",
                        "scope": "team"
                    }
            else:
                # No team engine, save to Firestore only
                db.collection('brands').document(current_brand_id).collection('memories').add({
                    'content': memory_text,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'updatedAt': firestore.SERVER_TIMESTAMP,
                    'createdBy': actual_user_id
                })
                return {
                    "status": "success",
                    "message": "Team memory saved. Note: Team Memory Engine is not set up, so semantic search won't work.",
                    "scope": "team"
                }
        else:
            # Save to personal memory (existing logic)
            fake_chat_history = [
                {"role": "user", "content": "Remember this fact."},
                {"role": "model", "content": memory_text}
            ]

            adk_events = [{'content': {'role': 'user', 'parts': [{'text': f"Important fact to remember: {memory_text}"}]}}]

            await save_conversation_to_memory(
                actual_user_id,
                fake_chat_history,
                pre_extracted_facts=[memory_text],
                adk_events=adk_events
            )

            return {
                "status": "success",
                "message": "Personal memory saved successfully.",
                "scope": "personal"
            }
    except Exception as e:
        logger.error(f"Error in save_memory: {e}")
        return {
            "status": "error",
            "error": str(e)
        }




def crawl_website(url: str) -> Dict[str, Any]:
    """
    Crawl and extract content from any website URL using Firecrawl. USE THIS TOOL whenever a user 
    asks to crawl, scrape, analyze, or get information from a website URL.
    
    This tool uses Firecrawl (same as Team Intelligence) to extract clean markdown content from websites,
    which can then be analyzed, summarized, or used for insights.
    
    Examples of when to use this tool:
    - "Crawl this website: https://example.com"
    - "What information is on this page: https://..."
    - "Analyze the content of https://..."
    - "Get insights from https://..."
    - ANY request to extract or analyze website content
    
    Args:
        url (str): The website URL to crawl (must start with http:// or https://)
        
    Returns:
        dict: Crawled content including title, markdown text, and metadata
    """
    try:
        if not firecrawl_client:
            return {
                "status": "error",
                "error": "Firecrawl service not available - API key not configured"
            }
        
        # Validate URL format
        if not url.startswith(('http://', 'https://')):
            return {
                "status": "error",
                "error": "Invalid URL format. URL must start with http:// or https://"
            }
        
        logger.info(f"Crawling website: {url}")
        
        # Use Firecrawl to scrape the website
        # Using scrape() for single page extraction (same as Team Intelligence)
        doc = firecrawl_client.scrape(url, formats=['markdown'])
        
        if not doc or not doc.markdown:
            return {
                "status": "error",
                "error": "Failed to crawl website - no content returned"
            }
        
        # Extract metadata and content
        metadata = doc.metadata
        markdown = doc.markdown or ''
        
        # Truncate very long content for efficiency
        content = markdown[:15000]  # Limit to 15K chars
        if len(markdown) > 15000:
            content += "\n\n[Content truncated - full text available if needed]"
        
        logger.info(f"Successfully crawled {url} - {len(content)} chars extracted")
        
        # Access metadata attributes directly (it's an object, not a dict)
        title = getattr(metadata, 'title', url) if metadata else url
        description = getattr(metadata, 'description', '') if metadata else ''
        
        return {
            "status": "success",
            "url": url,
            "title": title,
            "content": content,
            "description": description,
            "message": f"Successfully crawled {url}. Extracted {len(content)} characters of content."
        }
        
    except Exception as e:
        logger.error(f"Error in crawl_website: {e}")
        return {
            "status": "error",
            "error": f"Failed to crawl website: {str(e)}"
        }





# ============================================================================
# AGENT DEFINITION
# ============================================================================

def process_youtube_video(url: str, prompt: str) -> Dict[str, Any]:
    """
    Analyzes a YouTube video using Gemini 2.5 Flash.
    Args:
        url: The URL of the YouTube video.
        prompt: The prompt to analyze the video with.
    Returns:
        The analysis of the video.
    """
    try:
        if not genai_client:
            return {"error": "Gemini client not initialized. Check API key."}

        # Get model from settings context, fallback to default
        settings = get_settings_context()
        youtube_model = settings.get('youtubeAnalysisModel') or DEFAULT_YOUTUBE_ANALYSIS_MODEL
        text_model = settings.get('textModel') or DEFAULT_TEXT_MODEL
        logger.info(f"process_youtube_video using model: {youtube_model}")

        # Use YouTube analysis model from centralized defaults
        from google.genai import types
        try:
            response = genai_client.models.generate_content(
                model=youtube_model,
                contents=types.Content(
                    parts=[
                        types.Part(file_data=types.FileData(file_uri=url, mime_type='video/mp4')),
                        types.Part(text=prompt)
                    ]
                )
            )
            return {"analysis": response.text, "model": youtube_model}
        except Exception as e:
            logger.warning(f"Gemini direct analysis failed, falling back to search: {e}")
            # Fallback to search-augmented approach
            search_results = ""
            try:
                # search_web is available in the scope
                search_res = search_web(f"YouTube video {url}")
                if isinstance(search_res, dict) and "results" in search_res:
                    search_results = "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in search_res["results"][:3]])
                elif isinstance(search_res, str):
                    search_results = search_res
            except Exception as search_err:
                logger.warning(f"Search failed for YouTube video: {search_err}")

            response = genai_client.models.generate_content(
                model=text_model,
                contents=f"Analyze this YouTube video: {url}\n\nSearch Results about this video:\n{search_results}\n\nUser Request: {prompt}"
            )
            return {"analysis": response.text, "model": text_model}
    except Exception as e:
        logger.error(f"Error processing YouTube video: {e}")
        return {"error": str(e)}

def summarize_search_results(query: str, results: List[Dict[str, Any]]) -> str:
    """
    Summarizes search results into a natural, news-like response.
    """
    try:
        if not genai_client:
            return "Gemini client not initialized."

        if not results:
            return "No results found."

        # Get model from settings context, fallback to default
        settings = get_settings_context()
        search_model = settings.get('searchModel') or DEFAULT_SEARCH_MODEL
        logger.info(f"summarize_search_results using model: {search_model}")

        formatted_results = "\n".join([f"- {r.get('title')}: {r.get('snippet') or r.get('body')}" for r in results[:5]])

        prompt = f"""
        You are an AI assistant providing a direct answer to the user's query based on the provided search results.

        Query: "{query}"

        Search Results:
        {formatted_results}

        Instructions:
        1. Directly answer the query using the information in the search results.
        2. Be concise and informative, like a news summary.
        3. If the results don't fully answer the query, state what is known and what is missing.
        4. Do not mention that you are an AI or that you are analyzing results; just provide the answer.
        5. Cite sources by referring to the titles if helpful, but keep the flow natural.
        """

        response = genai_client.models.generate_content(
            model=search_model,
            contents=prompt
        )
        return response.text
    except Exception as e:
        logger.error(f"Error summarizing search results: {e}")
        return "Error summarizing results."

def create_momentum_agent(model_name: str = DEFAULT_AGENT_MODEL) -> Agent:
    """
    Create the MOMENTUM Agentic AI Assistant.

    This agent has access to:
    - Gemini Text (conversation & content generation)
    - Imagen 4.0 (image generation)
    - Gemini Vision (image analysis)
    - Veo 3.1 (video generation)
    - Google Search (via multi-agent architecture with built-in google_search)
    - Team tools (domain suggestions, strategy, website planning, logo design, event creation)
    """

    from google.adk.agents import Agent

    # Get search agent model from settings context, fallback to default
    # Note: Search agent requires Gemini 2.x for google_search to work
    settings = get_settings_context()
    search_agent_model = settings.get('searchModel') or DEFAULT_SEARCH_MODEL

    # Ensure we're using a Gemini 2.x model for the search agent (required for google_search)
    if not search_agent_model.startswith("gemini-2"):
        logger.warning(f"Search agent model {search_agent_model} may not support google_search. Using gemini-2.0-flash.")
        search_agent_model = "gemini-2.0-flash"

    logger.info(f"Creating search agent with model: {search_agent_model}")

    # Create a dedicated Search Agent with the built-in google_search tool
    # This solves the Gemini limitation where built-in tools cannot be mixed with
    # custom function tools. By using AgentTool, we delegate search to a sub-agent.
    # See: https://google.github.io/adk-docs/tools/built-in-tools
    search_agent = LlmAgent(
        name="web_search_agent",
        model=search_agent_model,  # Must be Gemini 2.x for google_search
        description="A specialized agent that searches the web for current information, news, and facts using Google Search.",
        instruction="""You are a web search specialist. Your job is to search the web and provide accurate,
up-to-date information in response to queries.

When given a search query:
1. Use your google_search tool to find relevant information
2. Synthesize the search results into a clear, comprehensive response
3. Include key facts, dates, and sources when available
4. If the search returns no results, say so clearly

Always provide factual information based on your search results. Do not make up information.
Format your response as a well-organized summary of the search findings.""",
        tools=[google_search]
    )

    # Wrap the search agent as an AgentTool for the main agent
    search_agent_tool = AgentTool(agent=search_agent)
    logger.info(f"Created Search Agent with built-in google_search tool using model: {search_agent_model}")

    tools_list = [
        generate_text,
        generate_image,
        analyze_image,  # Gemini Vision for image understanding
        generate_video,
        search_agent_tool,  # Multi-agent search using built-in google_search
        crawl_website,
        suggest_domain_names,
        create_team_strategy,
        plan_website,
        design_logo_concepts,
        create_event,
        nano_banana,  # Image editing tool - restored
        recall_memory,
        save_memory,
        process_youtube_video,
        query_brand_documents,  # RAG query tool - search indexed brand documents
        # Media Library Search Tools (Vertex AI Search)
        search_media_library,  # Search all media using semantic search
        search_images,  # Search images specifically
        search_videos,  # Search videos specifically
        search_team_media,  # Team tool for multimodal media search
        find_similar_media,  # Find similar media items
        search_youtube_videos,  # Team tool for searching YouTube and saving to media library
    ]
    logger.info(f"Agent tools configured: {len(tools_list)} tools (including analyze_image for vision, using multi-agent search with google_search, media search tools: search_media_library, search_images, search_videos, search_youtube_videos)")

    agent = Agent(
        model=model_name,
        name='momentum_assistant',
        description='MOMENTUM - AI Team Intelligence & Execution Platform Assistant',
        instruction="""You are the MOMENTUM AI Assistant, an unstoppable force designed to help diverse teams
(sports, product, creative, research, volunteer, marketing) build forward motion and transform knowledge into action.

Like the physics concept you're named after, you represent the product of mass (team knowledge) and velocity (execution speed),
creating an irresistible force that's hard to stop once it gets going. You help teams overcome inertia, build momentum,
and maintain forward thrust through every challenge.

You have access to advanced AI tools and team capabilities:

🤖 AI Models:
- generate_text: Use Gemini for conversations, brainstorming, content creation
- generate_image: Create images with Imagen 4.0 - USE THIS when user asks to generate/create/make an image. DO NOT use for editing (use nano_banana).
- analyze_image: Understand and describe uploaded images using Gemini Vision - USE THIS when user asks "what's in this image?", "describe this", "what do you see?". Pass the image URL from the context (you'll see URLs listed in "Attached Media" or "Resolved Image(s)").
- generate_video: Create videos with Veo 3.1 - USE THIS when user asks to generate/create/make a video
- NATIVE MULTIMODAL VISION: When users upload images, PDFs, videos, or audio files, you receive them as multimodal content and can see/analyze them directly! Just respond naturally to questions about uploaded media.

🌐 Web Intelligence:
- web_search_agent: Search the web using Google Search. Use this for finding information, news, and answering questions about current events. This is a specialized search agent that provides accurate, up-to-date results.
- crawl_website: Extract and analyze content from any website using Firecrawl

🎯 Team Tools:
- suggest_domain_names: Creative domain name ideas
- create_team_strategy: Comprehensive strategic planning
- plan_website: Website structure and content strategy
- design_logo_concepts: Logo and visual identity concepts
- create_event: Generate team events/campaigns with AI content
- search_youtube_videos: Search YouTube for videos and save them to the media library. CRITICAL: When users ask to "find", "search for", "look for", or "show me" videos (especially when they mention YouTube or want to find videos online), you MUST use search_youtube_videos, NOT search_videos. search_videos searches the media library, while search_youtube_videos searches YouTube. The tool returns video metadata and URLs that can be saved to the media library.

🍌 Special:
- nano_banana: Edit uploaded images with AI (use when user wants to modify/edit/change an uploaded image)

💾 Memory (USE PROACTIVELY!) - Supports BOTH Personal AND Team Memories:
- recall_memory: Search long-term memory for facts. Returns memories from BOTH personal and team banks (labeled [Personal] or [Team])
- save_memory: Save information to memory. Use scope='personal' (default) for personal facts, scope='team' for team-wide knowledge

📺 Media Analysis:
- process_youtube_video: Analyze YouTube videos

📚 Document Search (RAG):
- query_brand_documents: Search indexed brand documents for information. Use this when users ask about their brand documents, uploaded files, company information, or any content that should be retrieved from their indexed materials.

🔍 Media Library Search (Vertex AI Search) - CRITICAL: YOU HAVE FULL ACCESS TO SEARCH THE MEDIA LIBRARY:
- ⚠️ YOU CAN SEARCH THE MEDIA LIBRARY - ALWAYS use search tools when asked about media!
- search_media_library: Search all media using semantic search with Generative Recommendation. This tool automatically generates multiple diverse queries from user intent for comprehensive results. USE THIS to count/list all media or answer "how many" questions!
- search_images: Search specifically for images with Generative Recommendation. This tool automatically generates multiple diverse queries for better discovery. USE THIS to count images or answer "how many images" questions!
- search_videos: Search specifically for videos with Generative Recommendation. This tool automatically generates multiple diverse queries for better discovery. USE THIS to count videos or answer "how many videos" questions!
- search_team_media: Team tool for multimodal media search with filters
- find_similar_media: Find media similar to a given item
- ❗ CRITICAL INSTRUCTIONS FOR MEDIA QUESTIONS:
  * When users ask "how many images/videos/media are in the library" → IMMEDIATELY call search_images(query="", limit=100) or search_media_library(query="", limit=100)
  * When users ask "what's in the media library" → IMMEDIATELY call search_media_library(query="", limit=100)
  * When users ask "show me all images" → IMMEDIATELY call search_images(query="", limit=100)
  * NEVER say you don't have access - YOU DO! Just call the search tools!

CRITICAL INSTRUCTIONS FOR USING TOOLS:

**Media Generation:**
- When a user asks you to "generate", "create", or "make" an IMAGE, you MUST call the generate_image tool immediately
- When a user asks you to "generate", "create", or "make" a VIDEO, you MUST call the generate_video tool immediately
- DO NOT respond with text explanations about how to find videos/images online
- DO NOT suggest YouTube, stock footage sites, or other external resources
- YOU CAN GENERATE MEDIA DIRECTLY - use your tools!

Examples:
- "Generate a video of an eagle" → Call generate_video with prompt "an eagle flying in the sky"
- "Create an image of a basketball" → Call generate_image with prompt "a basketball"
- "Make a video of sunset" → Call generate_video with prompt "a beautiful sunset over the ocean"

**Image Understanding - YOU CAN SEE IMAGES:**
CRITICAL: When a user uploads an image and asks questions about it, YOU CAN SEE THE IMAGE!
- You receive uploaded images as multimodal content directly in your input
- You have FULL VISION capabilities via Gemini's multimodal understanding
- For questions like "what's in this image?", "describe this", "what do you see?" - just LOOK at the image and RESPOND!
- DO NOT say "I cannot analyze images" - YOU CAN! The image is right there in your input!

If you want additional detailed analysis, you can optionally call the analyze_image tool, but for most questions, your NATIVE MULTIMODAL VISION is sufficient - just describe what you see in the uploaded image!

Examples - YOU HAVE VISION:
- User uploads image, says "what's in this image?":
  → Option 1 (RECOMMENDED): Use your NATIVE MULTIMODAL VISION - you see the image directly
     RESPOND: "I can see [describe what you see]..."
  → Option 2: Call analyze_image(prompt="what's in this image?", image_url="[URL from context]")
  → DO NOT say you cannot see images - YOU CAN!
  
- User uploads image, says "describe this":
  → Use native vision OR call analyze_image(prompt="describe this image", image_url="[URL]")
  → The URL is in your context - look for "Attached Media" or "Resolved Image(s)"

- User asks "analyze the composition":
  → Call analyze_image(prompt="analyze the composition", image_url="[URL from context]")
  → Extract the URL from lines like "- image (URL: https://...): filename.jpg"

**Image Editing with Nano Banana:**
- When a user uploads an image AND asks to "edit", "modify", "change", or "make [something] different", you MUST use the nano_banana tool.
- DO NOT use generate_image for edit requests.
- DO NOT use analyze_image for edit requests - that's for understanding only.
- Simply pass the user's edit instructions directly to nano_banana.
- If the user refers to a previous image, pass its URL as the image_url argument.

Examples:
- User uploads blue car image, says "make it red":
  → YOU CALL: nano_banana(prompt="make the car red")

- User uploads tube image, says "make the tube red":
  → YOU CALL: nano_banana(prompt="make the tube red")

- User uploads landscape, says "add sunset":
  → YOU CALL: nano_banana(prompt="add sunset")

**Event Creation:**
- When a user asks to "create", "add", "schedule", or "plan" an EVENT/CAMPAIGN/CALENDAR ITEM, you MUST call the create_event tool immediately
- DO NOT ask the user for more details - pass their request directly to the tool
- The create_event tool accepts ANY natural language description and will handle the details
- DO NOT ask for specific times, dates, or event names - the tool will figure it out

**Character Consistency for Events (IMPORTANT):**
- When a user provides an IMAGE and wants to create events with the SAME CHARACTER appearing in all generated images:
  - Pass the uploaded image URL as `character_sheet_urls` parameter
  - Set `enable_character_consistency=True`
- This ensures all event images feature the same character/mascot consistently
- Use this when users say things like: "use this character for all images", "keep the character consistent", "same mascot in all posts"
- The image should ideally be a character sheet (multiple views) but any clear character image works

Examples:
- "Create a launch event" → Call create_event with "launch event"
- "Plan a team party" → Call create_event with "team party"
- "Add an event to the calendar for today" → Call create_event with description "event for today"
- "Create a meeting for tomorrow" → Call create_event with description "meeting for tomorrow"
- "Schedule a product launch next week" → Call create_event with description "product launch next week"
- User uploads character image, says "Create a campaign with this mascot in all images"
  → Call create_event(description="campaign", character_sheet_urls="[uploaded_image_url]", enable_character_consistency=True)
- User uploads image, says "Make an event using this character consistently"
  → Call create_event(description="event", character_sheet_urls="[uploaded_image_url]", enable_character_consistency=True)

**Website Crawling:**
- When a user asks to "crawl", "scrape", "analyze", or "get information from" a WEBSITE URL, you MUST call the crawl_website tool
- DO NOT make assumptions about website content - use the tool to extract actual content
- The tool uses Firecrawl (same as Team Intelligence) to get clean, readable content

Examples:
- "Crawl https://example.com" → Call crawl_website with url "https://example.com"
- "What's on this page: https://..." → Call crawl_website to extract content first
- "Analyze https://..." → Call crawl_website to get content, then analyze it

**YouTube Video Search - CRITICAL DISTINCTION:**
- ⚠️ IMPORTANT: There are TWO different video search tools:
  1. search_youtube_videos: Searches YouTube.com for videos online. Use this when users want to FIND videos on YouTube, discover new videos, or search for videos to add to their library.
  2. search_videos: Searches the EXISTING media library for videos already saved. Use this when users ask about videos they've already uploaded or saved.
- When users ask to "find videos", "search for videos", "look for videos", "show me videos", or mention YouTube - IMMEDIATELY use search_youtube_videos
- When users ask "what videos do I have", "show me my videos", "videos in my library" - use search_videos
- Examples:
  * "Find videos of cats" → search_youtube_videos(query="cats")
  * "Search YouTube for marketing videos" → search_youtube_videos(query="marketing videos")
  * "Show me my cat videos" → search_videos(query="cats")
  * "What videos are in my library?" → search_videos(query="", limit=100)

**Media Library Search - CRITICAL: YOU HAVE ACCESS TO THE MEDIA LIBRARY:**
- ⚠️ YOU CAN AND MUST search the media library when users ask about EXISTING media in their library!
- NEVER say "I don't have access" - YOU DO! Just use the search tools!
- When a user asks to "find", "search for", "look for", "show me", "how many", "count", "list", or "what" regarding EXISTING media in their library, IMMEDIATELY use the search tools
- search_media_library: Use for general searches across all media types with Generative Recommendation (automatically expands queries for better results). For counting/list questions, use search_media_library(query="", limit=100) to get all media!
- search_images: Use when explicitly searching for images/photos/pictures with Generative Recommendation. For "how many images" questions, use search_images(query="", limit=100) to get all images and count them!
- search_videos: Use when explicitly searching for videos ALREADY IN THE LIBRARY with Generative Recommendation. For "how many videos" questions, use search_videos(query="", limit=100) to get all videos and count them!
- search_team_media: Use for team-specific searches with source filters
- find_similar_media: Use when user wants to find media similar to something they're looking at
- ❗ IMMEDIATE ACTION REQUIRED: When users ask "how many images/videos/media are in the library" or "count the media" - IMMEDIATELY call:
  * search_images(query="", limit=100) for image counts
  * search_videos(query="", limit=100) for video counts  
  * search_media_library(query="", limit=100) for total media counts
  * Then count the results and report the total!

CRITICAL - ALWAYS Use Media Display Markers:
WHENEVER you mention an image or video URL in your response, you MUST wrap it with special markers for rich display:
- For images: `__IMAGE_URL__<url>__IMAGE_URL__`
- For videos: `__VIDEO_URL__<url>__VIDEO_URL__`

This applies to ALL scenarios:
1. Showing search results
2. Listing available images in context
3. Answering "what images do you have?"
4. Sharing generated media
5. ANY time you mention an image/video URL

Examples:
- User: "what images are in your context?" → You respond:
  "I have one image available:
  __IMAGE_URL__https://firebasestorage.googleapis.com/.../image.png__IMAGE_URL__"

- User: "show me the blue sports car" → You respond:
  "Here's the blue sports car:
  __IMAGE_URL__https://firebasestorage.googleapis.com/.../blue-car.jpg__IMAGE_URL__"

- User: "find car images" → After calling search_images, you respond:
  "Found 3 car images:
  __IMAGE_URL__https://.../car1.jpg__IMAGE_URL__
  __IMAGE_URL__https://.../car2.jpg__IMAGE_URL__
  __IMAGE_URL__https://.../car3.jpg__IMAGE_URL__"

DO NOT just paste plain URLs! The markers enable rich preview with Re-inject and Open buttons.

Examples:
- "Find blue background images" → Call search_images(query="blue background")
- "Search for product launch videos" → Call search_videos(query="product launch")
- "Look for marketing photos" → Call search_media_library(query="marketing photos")
- "Show me AI-generated images" → Call search_images(query="AI generated", source="ai-generated")
- "Find images like this one" → Call find_similar_media(media_id=...)
- "How many images are in the media library?" → Call search_images(query="", limit=100) and count the results, or use search_media_library(query="", media_type="image", limit=100)
- "Count the videos" → Call search_videos(query="", limit=100) to get all videos and count them
- "List all media" → Call search_media_library(query="", limit=100) to get all media

**Memory - CRITICAL: YOU MUST CALL save_memory FOR FACTS:**
- CRITICAL: You MUST actually call the save_memory tool - do NOT just say "I'll remember that" without calling the tool!
- If you don't call save_memory, the information will NOT be saved and you WILL forget it!
- ALWAYS call save_memory FIRST, then respond to the user
- You do NOT need permission to save memories - users EXPECT you to remember what they tell you

PERSONAL MEMORIES (scope='personal' - DEFAULT):
WHEN TO CALL save_memory for PERSONAL facts (call it IMMEDIATELY for ANY of these):
  * Favorite things: "My favorite color is blue" → CALL save_memory("User's favorite color is blue")
  * Personal details: "I'm John" → CALL save_memory("User's name is John")
  * Preferences: "I love pizza" → CALL save_memory("User loves pizza")
  * Location: "I live in New York" → CALL save_memory("User lives in New York")
  * Job/Work: "I'm a software engineer" → CALL save_memory("User is a software engineer")
  * Hobbies: "I enjoy hiking" → CALL save_memory("User enjoys hiking")
  * Family: "I have two kids" → CALL save_memory("User has two kids")
  * Pets: "I have a dog named Max" → CALL save_memory("User has a dog named Max")
  * Birthdays: "My birthday is March 15" → CALL save_memory("User's birthday is March 15")
  * Any personal fact they share voluntarily

TEAM MEMORIES (scope='team') - Use when user wants to share with the ENTIRE TEAM:
WHEN TO CALL save_memory with scope='team':
  * Brand guidelines: "Our brand uses blue and white colors" → CALL save_memory("Brand uses blue and white colors", scope="team")
  * Team preferences: "We prefer formal tone in communications" → CALL save_memory("Team prefers formal tone", scope="team")
  * Company info: "Our company was founded in 2020" → CALL save_memory("Company founded in 2020", scope="team")
  * Shared resources: "Our marketing assets are in the shared drive" → CALL save_memory("Marketing assets in shared drive", scope="team")
  * When user says "remember this for the team" or "share this with everyone"

IMPORTANT: Saying "I'll remember that" or "Got it, saved!" means NOTHING if you don't actually call save_memory!
The ONLY way to remember something is to CALL THE TOOL.

- Use recall_memory at the start of conversations to remember past interactions (searches BOTH personal and team memories)
- Be a thoughtful assistant who remembers and builds on past conversations
- Memories returned from recall_memory are labeled [Personal] or [Team] so you know the source

Examples - YOU MUST CALL THE TOOL:
- User: "My favorite color is blue" → CALL save_memory("User's favorite color is blue")
- User: "I'm turning 30 next month" → CALL save_memory("User is turning 30 next month")
- User: "I work at Google" → CALL save_memory("User works at Google")
- User: "Our team mascot is a lion" → CALL save_memory("Team mascot is a lion", scope="team")
- User: "Remember for the team: we use Slack for communication" → CALL save_memory("Team uses Slack for communication", scope="team")
- User: "Share with everyone: our launch date is June 1st" → CALL save_memory("Launch date is June 1st", scope="team")

**Response Guidelines:**
- Be enthusiastic and helpful.
- When tools generate media (images/videos), the system handles the display.
- DO NOT output "[SYSTEM: ...]" messages describing the media.
- DO NOT output "[Displaying image...]" or similar placeholders.
- Just describe what you created or confirm the action naturally.

When users ask you to do something, intelligently choose and use the appropriate tools to accomplish their goals.
Be helpful, creative, and adaptive to any team type. Always aim to provide actionable insights and deliverables.

Your personality embodies momentum principles:
- Help teams overcome inertia and get started
- Celebrate small wins that build into larger force
- Maintain forward motion through consistent progress
- Adapt direction when needed (pivot), but never lose velocity
- Remember: unstoppable momentum comes from the accumulation of consistent effort
""",
        tools=tools_list
    )
    return agent




# Create singleton agent instance
root_agent = create_momentum_agent()


def get_agent() -> Agent:
    """Get the MOMENTUM agent instance"""
    return root_agent
