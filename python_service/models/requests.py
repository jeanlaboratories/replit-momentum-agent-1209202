from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

class MediaFile(BaseModel):
    type: str
    data: Optional[str] = None
    url: Optional[str] = None
    fileName: Optional[str] = None
    mimeType: Optional[str] = None

class ImageReference(BaseModel):
    """Reference to an image from conversation history."""
    url: str
    index: int  # 1-based index for user reference (e.g., "image 1", "image 2")
    source: str  # 'user' or 'assistant'
    file_name: Optional[str] = None
    persistent_id: Optional[str] = None  # UUID for tracking across conversation
    role: Optional[str] = None  # 'primary', 'reference', 'mask', etc.

class ImageContext(BaseModel):
    """Context about images shared in the conversation history.
    Allows users to reference previously shared images (e.g., "edit the last image").
    """
    last_image_url: Optional[str] = None
    total_count: int = 0
    images: Optional[List[ImageReference]] = None
    is_new_media: Optional[bool] = False  # Flag to indicate if this is freshly uploaded/injected media
    resolution_method: Optional[str] = None  # How the media was resolved
    resolution_confidence: Optional[float] = None  # 0.0 to 1.0
    user_intent: Optional[str] = None  # Interpreted user intent

class RobustMediaContext(BaseModel):
    """Enhanced media context with robust resolution metadata"""
    resolved_media_count: int = 0
    available_media_count: int = 0
    resolution_method: str = 'explicit_upload'
    resolution_confidence: float = 1.0
    user_intent: str = 'no_media_operation'
    debug_info: Optional[str] = None

class AgentChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"
    brand_id: Optional[str] = None
    user_id: Optional[str] = None
    team_context: Optional[Dict[str, Any]] = None
    media: Optional[List[MediaFile]] = None
    settings: Optional[Dict[str, Any]] = None
    image_context: Optional[ImageContext] = None  # Images from conversation history
    robust_media_context: Optional[RobustMediaContext] = None  # Enhanced media resolution metadata

class DomainRequest(BaseModel):
    keywords: List[str]
    business_type: Optional[str] = None

class BusinessInfo(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    goals: Optional[str] = None
    services: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    style: Optional[str] = None
    colors: Optional[str] = None
    values: Optional[str] = None

class WebsiteRequest(BaseModel):
    domain: str
    business_info: BusinessInfo

class MarketingRequest(BaseModel):
    business_info: BusinessInfo

class LogoRequest(BaseModel):
    business_info: BusinessInfo

class ColorRequest(BaseModel):
    screenshot_url: str
    num_colors: Optional[int] = 5

class GenerateVideoRequest(BaseModel):
    """Request for Veo 3.1 video generation with all supported modes."""
    prompt: str
    image_url: Optional[str] = None  # Image-to-Video: image to animate
    start_frame_url: Optional[str] = None  # Frames-to-Video: starting frame
    end_frame_url: Optional[str] = None  # Frames-to-Video: ending frame
    aspect_ratio: Optional[str] = "9:16"
    brand_id: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    # Veo 3.1 additional parameters
    video_url: Optional[str] = None  # Video Extension: URL of video to extend
    character_reference: Optional[str] = None  # Ingredients mode: character reference image
    resolution: Optional[str] = None  # '720p' or '1080p' (1080p only for 8s)
    duration_seconds: Optional[int] = None  # 4, 6, or 8 seconds
    person_generation: Optional[str] = None  # 'allow_all' for people in videos
    reference_images: Optional[List[str]] = None  # Up to 3 reference image URLs
    use_fast_model: Optional[bool] = None  # Use veo-3.1-fast-generate-preview
    veo_video_uri: Optional[str] = None  # Veo video URI for extension (preferred over video_url)

class DeleteSessionRequest(BaseModel):
    brand_id: str
    user_id: str


# Media Search Request Models (Vertex AI Search)
class MediaSearchRequest(BaseModel):
    """Request for semantic media search using Vertex AI Search with Generative Recommendation."""
    brand_id: str
    query: str
    media_type: Optional[str] = None  # 'image' or 'video'
    source: Optional[str] = None  # 'upload', 'ai-generated', 'brand-soul'
    collections: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    limit: Optional[int] = 20
    use_query_generation: Optional[bool] = True  # Enable Generative Recommendation (query expansion)


class MediaIndexRequest(BaseModel):
    """Request to index media items into Vertex AI Search."""
    brand_id: str
    media_items: List[Dict[str, Any]]


class NanoBananaRequest(BaseModel):
    """Request for character-consistent image generation using Nano Banana (Gemini 2.5 Flash Image)."""
    prompt: str
    image_url: Optional[str] = None  # Primary image for editing
    reference_images: Optional[str] = None  # Comma-separated URLs for character consistency
    mask_url: Optional[str] = None
    mode: Optional[str] = None  # 'edit' or 'compose'
    aspect_ratio: Optional[str] = "1:1"
    number_of_images: Optional[int] = 1
    person_generation: Optional[str] = "allow_all"


class GenerateImageRequest(BaseModel):
    """Request for Imagen 4.0 image generation with multi-image support."""
    prompt: str
    brand_id: Optional[str] = None
    aspect_ratio: Optional[str] = "1:1"
    number_of_images: Optional[int] = 1  # 1-8 images
    person_generation: Optional[str] = None  # 'allow_all', 'allow_adult'
    safety_filter_level: Optional[str] = None  # 'block_only_high', 'block_medium_and_above', 'block_low_and_above'
    output_mime_type: Optional[str] = None  # 'image/png' or 'image/jpeg'
