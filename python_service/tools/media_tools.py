import logging
import base64
import requests
import time
from typing import Dict, Any
from google.genai import types
from utils.storage_utils import upload_to_storage, download_from_firebase_storage, is_firebase_storage_url
from utils.context_utils import get_settings_context
from utils.model_defaults import DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, DEFAULT_IMAGE_EDIT_MODEL, DEFAULT_TEXT_MODEL

logger = logging.getLogger(__name__)

# Global genai_client will be set by momentum_agent or other modules
genai_client = None

def set_genai_client(client):
    global genai_client
    genai_client = client

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
    try:
        if not genai_client:
            return {
                "status": "error",
                "error": "Google AI client not initialized - API key required"
            }

        # Use model from settings or default from centralized constants
        settings = get_settings_context()
        model_name = settings.get('imageModel', DEFAULT_IMAGE_MODEL)
        if not model_name.startswith('imagen'):
            # Ensure it's an imagen model, fallback if not
            model_name = DEFAULT_IMAGE_MODEL

        logger.info(f"Generating image with model: {model_name}")

        # Build config
        config = {
            'number_of_images': min(max(1, number_of_images), 8),
            'aspect_ratio': aspect_ratio
        }

        # Add optional parameters
        if person_generation:
            config['person_generation'] = person_generation
        if safety_filter_level:
            config['safety_filter_level'] = safety_filter_level
        if output_mime_type:
            config['output_mime_type'] = output_mime_type

        response = genai_client.models.generate_images(
            model=model_name,
            prompt=prompt,
            config=config
        )

        # Process generated images
        if response.generated_images and len(response.generated_images) > 0:
            image_urls = []
            image_data_list = []

            for image in response.generated_images:
                # Try to upload to Firebase Storage
                image_url = upload_to_storage(image.image.image_bytes, 'image/png', folder="generated_images")

                if image_url:
                    image_urls.append(image_url)
                else:
                    # Fallback to base64
                    image_b64 = base64.b64encode(image.image.image_bytes).decode('utf-8')
                    image_data_list.append(image_b64)

            # Return consistent structure - always use arrays and include both singular and plural
            # for backward compatibility with consumers that expect either format
            if image_urls:
                return {
                    "status": "success",
                    "message": f"Generated {len(image_urls)} image(s) successfully with Imagen 4.0",
                    "format": "url",
                    "prompt": prompt,
                    # Always include both for compatibility
                    "image_url": image_urls[0],  # First image for single-image consumers
                    "image_urls": image_urls     # All images for multi-image consumers
                }
            else:
                # All fallback to base64
                return {
                    "status": "success",
                    "message": f"Generated {len(image_data_list)} image(s) successfully (fallback to base64)",
                    "format": "base64",
                    "prompt": prompt,
                    # Always include both for compatibility
                    "image_data": image_data_list[0],  # First image for single-image consumers
                    "image_data_list": image_data_list  # All images for multi-image consumers
                }

        return {
            "status": "error",
            "error": "No image generated"
        }
    except Exception as e:
        logger.error(f"Error in generate_image: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

def analyze_image(prompt: str, image_url: str = "", image_data: str = "") -> Dict[str, Any]:
    """
    Analyze and understand images using Gemini Vision.
    
    IMPORTANT: This tool accepts EITHER a URL OR base64 image data.
    - If you have an image URL from the context (e.g., from attached media), pass it as image_url
    - If you have base64 data, pass it as image_data
    
    Args:
        prompt (str): Question or analysis request about the image
        image_url (str): URL to the image (Firebase Storage, HTTP, or HTTPS). Preferred method.
        image_data (str): Base64-encoded image data (alternative to URL)
    
    Returns:
        dict: Analysis results and insights
    """
    try:
        if not genai_client:
            return {
                "status": "error",
                "error": "Google AI client not initialized - API key required"
            }
        
        # Must have either URL or base64 data
        if not image_url and not image_data:
            return {
                "status": "error",
                "error": "Either image_url or image_data is required"
            }

        # Get model from settings context, fallback to default
        settings = get_settings_context()
        model_name = settings.get('textModel') or DEFAULT_TEXT_MODEL
        logger.info(f"analyze_image using model: {model_name}")
        
        # If URL provided, download the image
        if image_url:
            logger.info(f"Downloading image from URL for analysis: {image_url[:100]}...")
            try:
                if is_firebase_storage_url(image_url):
                    # Download from Firebase Storage
                    image_bytes, mime_type = download_from_firebase_storage(image_url)
                    if image_bytes is None:
                        raise Exception("Failed to download from Firebase Storage")
                else:
                    # Download from regular HTTP(S) URL
                    response = requests.get(image_url, timeout=30)
                    response.raise_for_status()
                    image_bytes = response.content
                
                # Convert bytes to base64
                image_data = base64.b64encode(image_bytes).decode('utf-8')
                logger.info(f"Downloaded and converted image: {len(image_bytes)} bytes")
            except Exception as e:
                logger.error(f"Failed to download image from URL: {e}")
                return {
                    "status": "error",
                    "error": f"Failed to download image: {str(e)}"
                }

        # Prepare image data for Gemini
        response = genai_client.models.generate_content(
            model=model_name,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": image_data
                            }
                        }
                    ]
                }
            ]
        )

        return {
            "status": "success",
            "analysis": response.text,
            "model": model_name
        }
    except Exception as e:
        logger.error(f"Error in analyze_image: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

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
    use_fast_model: bool = False,
    veo_video_uri: str = ""
) -> Dict[str, Any]:
    """
    Generate videos using Veo 3.1 from text prompts and optional image inputs.

    Args:
        prompt: Detailed text description of the video scene to generate (up to 1024 tokens)
        image_url: URL or base64 data of an image to animate (Image-to-Video)
        character_reference: URL or base64 data of a character/object reference (Ingredients)
        start_frame: URL or base64 data for the starting frame (Frames-to-Video)
        end_frame: URL or base64 data for the ending frame (Frames-to-Video)
        aspect_ratio: Aspect ratio for the video. Supported: '16:9', '9:16'. Default is '9:16'
        resolution: Video resolution. '720p' or '1080p' (1080p only for 8s duration). Default is '720p'
        duration_seconds: Video duration in seconds (4, 6, or 8). Default varies by resolution
        person_generation: Person generation setting. Use 'allow_all' to include people in videos
        video_url: URL or base64 data of a previously generated video to extend (Video Extension) - DEPRECATED, use veo_video_uri instead
        reference_images: Comma-separated URLs or base64 data for up to 3 reference images (asset images)
        use_fast_model: Set to True to use veo-3.1-fast-generate-preview for faster generation
        veo_video_uri: The Gemini API file URI of a previously Veo-generated video to extend (Video Extension)
                      This is returned as 'veo_video_uri' in the response of generate_video and should be stored
                      to enable video extension. Videos are stored for 2 days on Google's servers.

    Returns:
        dict: Contains 'status', 'message', 'video_url', 'format', 'prompt', and 'veo_video_uri' (for extension)
    """
    # Use model from settings or default from centralized constants
    settings = get_settings_context()
    base_model = settings.get('videoModel', DEFAULT_VIDEO_MODEL)
    if not base_model.startswith('veo'):
        base_model = DEFAULT_VIDEO_MODEL

    # Use fast model if requested (fast variant of the default)
    if use_fast_model:
        model_name = 'veo-3.1-fast-generate-preview'
    else:
        model_name = base_model

    logger.info(f"Generating video with model: {model_name}")

    # Build config with all parameters
    config_dict = {
        "aspect_ratio": aspect_ratio
    }

    if resolution:
        config_dict["resolution"] = resolution
    if duration_seconds:
        config_dict["duration_seconds"] = str(duration_seconds)
    if person_generation:
        config_dict["person_generation"] = person_generation

    call_args = {
        "model": model_name,
        "prompt": prompt,
        "config": config_dict
    }

    try:
        if not genai_client:
            return {
                "status": "error",
                "error": "Google AI client not initialized - API key required"
            }

        # Use Veo 3.1 directly via Google GenAI client
        logger.info(f"VEO_VERSION_CHECK: Starting Veo 3.0 video generation: {prompt} (Aspect Ratio: {aspect_ratio})")

        # Define FixedImage class at the top to ensure it's always available
        # This is a workaround for SDK/API mismatch: API expects bytesBase64Encoded, SDK sends imageBytes
        try:
            from pydantic import SerializerFunctionWrapHandler, model_serializer

            class FixedImage(types.Image):
                @model_serializer(mode='wrap')
                def serialize_model(self, handler: SerializerFunctionWrapHandler):
                    return {
                        "bytesBase64Encoded": base64.b64encode(self.image_bytes).decode('utf-8') if self.image_bytes else None,
                        "mimeType": self.mime_type
                    }

                def to_json_dict(self):
                    return {
                        "bytesBase64Encoded": base64.b64encode(self.image_bytes).decode('utf-8') if self.image_bytes else None,
                        "mimeType": self.mime_type
                    }
        except ImportError:
            logger.warning("Pydantic not available, using standard types.Image")
            FixedImage = types.Image

        # Helper to process image input
        def process_image_input(input_data: str) -> types.Part:
            if input_data.startswith('data:'):
                # Handle data URI
                header, encoded = input_data.split(',', 1)
                mime_type = header.split(':')[1].split(';')[0]
                data = base64.b64decode(encoded)
                return types.Part.from_bytes(data=data, mime_type=mime_type)
            elif input_data.startswith(('http://', 'https://')):
                # Handle URL - download first
                resp = requests.get(input_data)
                resp.raise_for_status()
                mime_type = resp.headers.get('Content-Type', 'image/png')
                return types.Part.from_bytes(data=resp.content, mime_type=mime_type)
            else:
                # Assume base64 string without header
                data = base64.b64decode(input_data)
                return types.Part.from_bytes(data=data, mime_type='image/png')

        # Prepare inputs
        image_input = None
        if image_url:
            logger.info("Adding Image Input (Image-to-Video)")
            part = process_image_input(image_url)
            if part.inline_data:
                image_input = FixedImage(
                    image_bytes=part.inline_data.data,
                    mime_type=part.inline_data.mime_type
                )
                logger.info(f"Image input prepared with FixedImage: {part.inline_data.mime_type}, {len(part.inline_data.data)} bytes")
            else:
                logger.warning("Image input has no inline data")

        # Handle character reference
        if character_reference:
            logger.info("Adding Character Reference (Ingredients)")
            try:
                char_part = process_image_input(character_reference)
                if char_part.inline_data:
                    char_img = FixedImage(
                        image_bytes=char_part.inline_data.data,
                        mime_type=char_part.inline_data.mime_type
                    )
                    char_ref_obj = types.VideoGenerationReferenceImage(
                        image=char_img,
                        reference_type="character"
                    )
                    if 'reference_images' not in call_args['config']:
                        call_args['config']['reference_images'] = []
                    call_args['config']['reference_images'].append(char_ref_obj)
                    logger.info("Character reference added")
            except Exception as e:
                logger.error(f"Failed to process character reference: {e}")

        # Handle frames (Frames-to-Video Interpolation)
        # API expects: image = first frame, config.last_frame = last frame
        # See: https://ai.google.dev/gemini-api/docs/video
        if start_frame and end_frame:
            logger.info("Adding Start/End Frames (Frames-to-Video Interpolation)")

            # Process start frame (first frame)
            start_part = process_image_input(start_frame)
            start_image_input = None
            if start_part.inline_data:
                start_image_input = FixedImage(
                    image_bytes=start_part.inline_data.data,
                    mime_type=start_part.inline_data.mime_type
                )

            # Process end frame (last frame)
            end_part = process_image_input(end_frame)
            end_image_input = None
            if end_part.inline_data:
                end_image_input = FixedImage(
                    image_bytes=end_part.inline_data.data,
                    mime_type=end_part.inline_data.mime_type
                )

            if start_image_input and end_image_input:
                # Set first frame as the main image
                call_args['image'] = start_image_input
                # Set last frame in config (for interpolation)
                call_args['config']['last_frame'] = end_image_input
                # Interpolation requires 8 second duration
                call_args['config']['duration_seconds'] = '8'
                logger.info("Configured for Frames-to-Video Interpolation (image + config.last_frame)")
            else:
                logger.warning("Failed to process start or end frame for interpolation")

        elif image_input:
            call_args['image'] = image_input
            logger.info("Using single image input")

        # Handle video extension
        # Video extension requires the original Veo video URI (from a previous generation)
        # See: https://ai.google.dev/gemini-api/docs/video
        # IMPORTANT: Video extension only works with Veo-generated videos, not arbitrary uploaded videos
        # The veo_video_uri parameter should be used for proper video extension (stored from previous generation)
        if veo_video_uri:
            # PREFERRED METHOD: Use the stored Veo video URI directly
            logger.info(f"Using stored Veo video URI for extension: {veo_video_uri}")
            try:
                # Create a types.Video object with the stored URI
                video_input = types.Video(uri=veo_video_uri)
                call_args['video'] = video_input
                logger.info(f"Video input configured for extension using stored Veo URI")
            except Exception as e:
                logger.error(f"Failed to create Video object from stored URI: {e}")
        elif video_url:
            # FALLBACK (deprecated): Try uploading video to File API
            # NOTE: This approach may not produce consistent results for video extension
            # because the File API upload creates a new file that wasn't generated by Veo
            logger.warning("Using video_url for extension (deprecated). For best results, use veo_video_uri instead.")
            logger.info("Adding video input for extension via File API upload (may not match original)")
            try:
                # Step 1: Download the video bytes
                if video_url.startswith(('http://', 'https://')):
                    # Check if this is a Firebase Storage URL
                    if is_firebase_storage_url(video_url):
                        logger.info(f"Firebase Storage URL detected for video extension: {video_url[:100]}...")
                        video_bytes, mime_type = download_from_firebase_storage(video_url)
                        if video_bytes is None:
                            raise ValueError(f"Failed to download video from Firebase Storage")
                    else:
                        resp = requests.get(video_url)
                        resp.raise_for_status()
                        video_bytes = resp.content
                        mime_type = resp.headers.get('Content-Type', 'video/mp4')
                        # Clean up Content-Type header
                        mime_type = mime_type.split(';')[0].strip()
                elif video_url.startswith('data:'):
                    header, encoded = video_url.split(',', 1)
                    mime_type = header.split(':')[1].split(';')[0]
                    video_bytes = base64.b64decode(encoded)
                else:
                    video_bytes = base64.b64decode(video_url)
                    mime_type = 'video/mp4'

                logger.info(f"Video downloaded for extension: {mime_type}, {len(video_bytes)} bytes")

                # Step 2: Upload to Gemini File API to get a proper file reference
                # The video parameter in generate_videos expects a types.Video object with a URI
                import tempfile
                import os as temp_os

                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                    temp_file.write(video_bytes)
                    temp_path = temp_file.name

                try:
                    logger.info(f"Uploading video to Gemini File API for extension...")
                    video_file = genai_client.files.upload(
                        file=temp_path,
                        config={'mime_type': mime_type}
                    )

                    # Get the URI - must be a string, not a MagicMock or None
                    file_uri = getattr(video_file, 'uri', None)
                    if file_uri and isinstance(file_uri, str):
                        logger.info(f"Video uploaded successfully: {file_uri}")
                        # Create a types.Video object with the file URI reference
                        # This is the correct way to pass a video for extension
                        video_input = types.Video(uri=file_uri)
                        call_args['video'] = video_input
                        logger.info(f"Video input configured for extension using types.Video(uri={file_uri})")
                    else:
                        # Fallback: try using the file object directly
                        # The generate_videos may accept the file object itself
                        logger.info(f"Video uploaded, using file object directly (no URI available)")
                        call_args['video'] = video_file
                        logger.info(f"Video input configured for extension using file object directly")

                finally:
                    # Clean up temp file
                    if temp_os.path.exists(temp_path):
                        temp_os.unlink(temp_path)

            except Exception as e:
                logger.error(f"Failed to process video input for extension: {e}")

        # Handle multiple reference images (up to 3)
        # reference_images is now a comma-separated string for ADK compatibility
        if reference_images:
            ref_urls = [url.strip() for url in reference_images.split(',') if url.strip()]
            logger.info(f"Adding {len(ref_urls)} reference images")
            ref_image_objects = []
            for idx, ref_url in enumerate(ref_urls[:3]):  # Limit to 3
                try:
                    ref_part = process_image_input(ref_url)
                    if ref_part.inline_data:
                        ref_img = FixedImage(
                            image_bytes=ref_part.inline_data.data,
                            mime_type=ref_part.inline_data.mime_type
                        )
                        ref_image_obj = types.VideoGenerationReferenceImage(
                            image=ref_img,
                            reference_type="asset"
                        )
                        ref_image_objects.append(ref_image_obj)
                        logger.info(f"Reference image {idx+1} processed")
                except Exception as e:
                    logger.warning(f"Failed to process reference image {idx+1}: {e}")

            if ref_image_objects:
                call_args['config']['reference_images'] = ref_image_objects

        logger.info(f"Calling generate_videos with args: {call_args.keys()}")
        try:
            operation = genai_client.models.generate_videos(**call_args)
            logger.info(f"Operation created: {operation.name if hasattr(operation, 'name') else 'unknown'}")
        except Exception as e:
            logger.error(f"Error calling generate_videos: {e}")
            return {
                "status": "error",
                "error": f"Failed to create video generation operation: {str(e)}"
            }
        
        # Poll the operation until video is ready (max 2 minutes)
        max_wait = 120  # 2 minutes
        start_time = time.time()
        poll_interval = 5  # Check every 5 seconds
        
        logger.info("Polling for video generation completion...")
        while not operation.done:
            elapsed = time.time() - start_time
            if elapsed > max_wait:
                return {
                    "status": "error",
                    "error": f"Video generation timed out after {max_wait} seconds"
                }
            
            logger.info(f"Video generation in progress... ({int(elapsed)}s elapsed)")
            time.sleep(poll_interval)
            operation = genai_client.operations.get(operation)
        
        logger.info("Video generation complete!")
        
        # Get the first generated video from the operation response
        if hasattr(operation, 'response') and hasattr(operation.response, 'generated_videos'):
            videos = operation.response.generated_videos
            if videos and len(videos) > 0:
                video = videos[0]

                # IMPORTANT: Capture the Veo video URI for future extension
                # This is the internal Gemini API file URI that can be used to extend this video
                # Videos are stored on Google's servers for 2 days
                generated_veo_video_uri = getattr(video.video, 'uri', None)
                if generated_veo_video_uri:
                    logger.info(f"Captured Veo video URI for extension: {generated_veo_video_uri}")
                else:
                    logger.warning("No URI found on generated video object - video extension may not work")

                # Download the video file
                video_bytes = genai_client.files.download(file=video.video)

                # Upload to Firebase Storage
                video_url = upload_to_storage(video_bytes, 'video/mp4', folder="generated_videos")

                if video_url:
                    # Return consistent structure - always include both singular and array
                    # for backward compatibility with consumers that expect either format
                    return {
                        "status": "success",
                        "message": "Video generated successfully with Veo 3.1",
                        "format": "url",
                        "prompt": prompt,
                        # Always include both for compatibility
                        "video_url": video_url,      # Singular for single-video consumers
                        "video_urls": [video_url],   # Array for multi-video consumers
                        # Veo video URI for extension - IMPORTANT: Store this to enable video extension
                        # This URI is valid for 2 days on Google's servers
                        "veo_video_uri": generated_veo_video_uri,
                        # Metadata
                        "input_image_url": image_url,
                        "character_reference_url": character_reference,
                        "start_frame_url": start_frame,
                        "end_frame_url": end_frame
                    }
                else:
                    # Fallback to base64
                    video_b64 = base64.b64encode(video_bytes).decode('utf-8')
                    return {
                        "status": "success",
                        "message": "Video generated successfully (fallback to base64)",
                        "format": "base64",
                        "prompt": prompt,
                        # Always include both for compatibility
                        "video_data": video_b64,        # Singular for single-video consumers
                        "video_data_list": [video_b64],  # Array for multi-video consumers
                        # Veo video URI for extension - IMPORTANT: Store this to enable video extension
                        "veo_video_uri": generated_veo_video_uri
                    }
        
        return {
            "status": "error",
            "error": "No video generated in operation response"
        }
    except Exception as e:
        logger.error(f"Error in generate_video: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

def nano_banana(
    prompt: str,
    image_url: str = "",
    reference_images: str = "",
    mask_url: str = "",
    mode: str = "",
    aspect_ratio: str = '1:1',
    number_of_images: int = 1,
    person_generation: str = ""
) -> Dict[str, Any]:
    """
    Edit and compose images using Imagen 3 (Nano Banana) with text prompts and reference images.
    Supports image editing, multi-image composition, and mask-based editing.

    USE THIS TOOL when a user asks to:
    - "edit this image"
    - "modify this photo"
    - "change the background"
    - "add something to this image"
    - "remove something from this image"
    - "combine these images"

    IMPORTANT: When the user uploads an image, the full URL will be in the "Attached Media" section.
    You MUST use the complete URL (starting with https://) from there as the image_url parameter.
    DO NOT use just the filename - that will not work.

    Args:
        prompt: Detailed text description of the image edit/composition to perform
        image_url: MUST be the full URL (https://...) from the Attached Media section. Do NOT use just the filename.
        reference_images: Comma-separated URLs or base64 data for up to 14 reference images (6 objects, 5 humans max)
        mask_url: Mask image URL/base64 for mask-based editing
        mode: Edit mode - "edit" for editing, "compose" for multi-image composition
        aspect_ratio: Aspect ratio - "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
        number_of_images: Number of images to generate (1-4 for editing)
        person_generation: Control person generation - "allow_all", "allow_adult"

    Returns:
        dict: Contains 'status', 'message', 'image_url', 'format', and 'prompt'
    """
    try:
        if not genai_client:
            return {
                "status": "error",
                "error": "Google AI client not initialized - API key required"
            }

        logger.info(f"Nano Banana called with prompt: {prompt}, image_url: {image_url[:100] if image_url else None}..., reference_images: {reference_images[:100] if reference_images else None}...")

        # Helper function to process image input (URL or base64)
        def process_image_input(input_data: str) -> types.Part:
            if input_data.startswith('data:'):
                # Handle data URI
                header, encoded = input_data.split(',', 1)
                mime_type = header.split(':')[1].split(';')[0]
                image_bytes = base64.b64decode(encoded)
                logger.info(f"Processing data URI, mime_type: {mime_type}, size: {len(image_bytes)} bytes")
            elif input_data.startswith(('http://', 'https://')):
                # Check if this is a Firebase Storage URL that needs admin SDK access
                if is_firebase_storage_url(input_data):
                    logger.info(f"Firebase Storage URL detected, using admin SDK: {input_data[:100]}...")
                    image_bytes, mime_type = download_from_firebase_storage(input_data)
                    if image_bytes is None:
                        raise ValueError(f"Failed to download from Firebase Storage: {input_data[:100]}...")
                    logger.info(f"Downloaded from Firebase Storage, mime_type: {mime_type}, size: {len(image_bytes)} bytes")
                else:
                    # Download from regular URL
                    logger.info(f"Downloading image from URL: {input_data[:100]}...")
                    resp = requests.get(input_data, timeout=30)
                    resp.raise_for_status()
                    image_bytes = resp.content
                    # Clean up Content-Type header (remove charset and other params)
                    content_type = resp.headers.get('Content-Type', 'image/png')
                    mime_type = content_type.split(';')[0].strip()
                    logger.info(f"Downloaded image, Content-Type header: {content_type}, cleaned mime_type: {mime_type}, size: {len(image_bytes)} bytes")
            else:
                # Check if this looks like a filename (common mistake from LLM)
                # Filenames typically have extensions like .png, .jpg and are short
                # But valid base64 can also contain '.' so we need to be careful
                if '.' in input_data and len(input_data) < 100 and not '/' in input_data and not '+' in input_data:
                    # Very likely a filename - short string with dot, no base64 chars like / or +
                    raise ValueError(f"Invalid image input: '{input_data}' appears to be a filename. Please provide the full URL of the image.")

                # Assume base64 without header - validate it's actually base64
                try:
                    image_bytes = base64.b64decode(input_data)
                    mime_type = 'image/png'
                    logger.info(f"Processing base64 data, assumed mime_type: {mime_type}, size: {len(image_bytes)} bytes")
                except Exception as e:
                    raise ValueError(f"Invalid image input: not a valid URL, data URI, or base64 data. Input: {input_data[:100]}... Error: {e}")

            # Validate mime type - Gemini supports these image types
            supported_types = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
            if mime_type not in supported_types:
                logger.warning(f"Mime type {mime_type} may not be supported, defaulting to image/png")
                mime_type = 'image/png'

            return types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        # Use model from settings or default for editing
        settings = get_settings_context()
        model_name = settings.get('imageEditModel') or DEFAULT_IMAGE_EDIT_MODEL
        logger.info(f"nano_banana using model: {model_name}")

        # Build prompt parts
        content_parts = []

        # Add primary image if provided
        if image_url:
            image_part = process_image_input(image_url)
            content_parts.append(image_part)

        # Add reference images if provided (for composition)
        # reference_images is now a comma-separated string for ADK compatibility
        skipped_refs = []
        if reference_images:
            ref_urls = [url.strip() for url in reference_images.split(',') if url.strip()]
            for ref_img in ref_urls[:14]:  # Max 14 reference images
                try:
                    ref_part = process_image_input(ref_img)
                    content_parts.append(ref_part)
                except Exception as e:
                    # Log warning and skip this reference image
                    logger.warning(f"Skipping reference image that failed to load: {ref_img[:100]}... Error: {e}")
                    skipped_refs.append(ref_img[:50] + '...' if len(ref_img) > 50 else ref_img)

            if skipped_refs:
                logger.warning(f"Skipped {len(skipped_refs)} reference image(s) due to download errors")

        # Add mask if provided (for mask-based editing)
        if mask_url:
            mask_part = process_image_input(mask_url)
            content_parts.append(mask_part)

        # Add text prompt
        content_parts.append(types.Part(text=prompt))

        # Generate edited/composed image
        logger.info(f"Calling Gemini API with model: {model_name}, content_parts count: {len(content_parts)}")

        response = genai_client.models.generate_content(
            model=model_name,
            contents=content_parts,
            config={
                'response_modalities': ['image']
            }
        )

        # Extract image from response
        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            for part in candidate.content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    # Upload to Firebase Storage
                    image_url_result = upload_to_storage(
                        part.inline_data.data,
                        part.inline_data.mime_type or 'image/png',
                        folder="edited_images"
                    )

                    if image_url_result:
                        # Return consistent structure - always include both singular and array
                        # for backward compatibility with consumers that expect either format
                        message = "Image edited successfully with Imagen 3"
                        if skipped_refs:
                            message += f" (Note: {len(skipped_refs)} reference image(s) were unavailable and skipped)"
                        return {
                            "status": "success",
                            "message": message,
                            "format": "url",
                            "prompt": prompt,
                            # Always include both for compatibility
                            "image_url": image_url_result,      # Singular for single-image consumers
                            "image_urls": [image_url_result],   # Array for multi-image consumers
                            "skipped_references": skipped_refs if skipped_refs else None
                        }
                    else:
                        # Fallback to base64
                        image_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                        message = "Image edited successfully (fallback to base64)"
                        if skipped_refs:
                            message += f" (Note: {len(skipped_refs)} reference image(s) were unavailable and skipped)"
                        return {
                            "status": "success",
                            "message": message,
                            "format": "base64",
                            "prompt": prompt,
                            # Always include both for compatibility
                            "image_data": image_b64,        # Singular for single-image consumers
                            "image_data_list": [image_b64], # Array for multi-image consumers
                            "skipped_references": skipped_refs if skipped_refs else None
                        }

        return {
            "status": "error",
            "error": "No edited image generated"
        }

    except Exception as e:
        logger.error(f"Error in nano_banana: {e}")
        return {
            "status": "error",
            "error": str(e)
        }
