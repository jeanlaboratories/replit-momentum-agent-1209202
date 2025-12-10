"""
Music Generation API using Google's Lyria 2 model via Vertex AI.
"""
import logging
import base64
import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import google.auth
import google.auth.transport.requests
import requests
from requests.exceptions import HTTPError as RequestsHTTPError
from firebase_admin import firestore, storage
from config.settings import get_settings, get_google_credentials

router = APIRouter(prefix="/agent/music", tags=["music"])
logger = logging.getLogger(__name__)


class MusicGenerationRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    sample_count: Optional[int] = 1
    seed: Optional[int] = None
    project_id: Optional[str] = None  # Make optional, will use settings if not provided
    brand_id: str
    user_id: str
    model: Optional[str] = None  # Music model to use (e.g., 'lyria-002')


def send_request_to_google_api(api_endpoint: str, data: dict):
    """
    Sends an HTTP request to a Google API endpoint using centralized credentials.
    
    Args:
        api_endpoint: The URL of the Google API endpoint.
        data: Dictionary of data to send in the request body.
    
    Returns:
        The response from the Google API.
    """
    try:
        # Use centralized credential system for consistency
        creds, project_id = get_google_credentials()
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)
        access_token = creds.token
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        logger.info(f"Sending request to {api_endpoint} with project {project_id}")
        response = requests.post(api_endpoint, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error sending request to Google API: {e}")
        logger.error(f"Endpoint: {api_endpoint}")
        logger.error(f"Data: {data}")
        raise


@router.post("/generate")
async def generate_music(request: MusicGenerationRequest):
    """
    Generate music using Google's Lyria 2 model.
    
    Args:
        request: MusicGenerationRequest with prompt and optional parameters
    
    Returns:
        Dictionary with generated music data and metadata
    """
    try:
        settings = get_settings()
        
        # Use consistent project ID resolution - get from centralized credentials
        try:
            creds, project_id_from_auth = get_google_credentials()
        except Exception as e:
            logger.error(f"Failed to get Google credentials: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Authentication error: {str(e)}"
            )
        
        # Priority: request.project_id > credentials project_id > settings
        project_id = request.project_id or project_id_from_auth or settings.effective_project_id
        
        if not project_id:
            logger.error("No project ID available from any source")
            raise HTTPException(
                status_code=500,
                detail="Project ID not configured. Please check MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID or credentials."
            )
        
        logger.info(f"Using project ID: {project_id}")
        
        # Validate parameters
        if request.seed is not None and request.sample_count > 1:
            raise HTTPException(
                status_code=400,
                detail="seed and sample_count cannot be used together. When using seed, sample_count is ignored."
            )
        
        if request.sample_count < 1 or request.sample_count > 4:
            raise HTTPException(
                status_code=400,
                detail="sample_count must be between 1 and 4"
            )
        
        # Get the music model to use (default to lyria-002)
        music_model = request.model or 'lyria-002'
        
        # Construct the music model API endpoint
        music_model_endpoint = (
            f"https://us-central1-aiplatform.googleapis.com/v1/projects/{project_id}"
            f"/locations/us-central1/publishers/google/models/{music_model}:predict"
        )
        
        # Prepare the request payload to match notebook structure exactly
        request_dict = {
            "prompt": request.prompt,
        }
        
        # Add negative_prompt only if provided and not empty
        if request.negative_prompt and request.negative_prompt.strip():
            request_dict["negative_prompt"] = request.negative_prompt.strip()
        
        # Add seed OR sample_count (never both, as per Lyria 2 API)
        if request.seed is not None:
            request_dict["seed"] = request.seed
            logger.info(f"Using seed: {request.seed} (sample_count ignored)")
        else:
            request_dict["sample_count"] = request.sample_count
            logger.info(f"Using sample_count: {request.sample_count}")
        
        # Match notebook structure exactly
        request_payload = {
            "instances": [request_dict],
            "parameters": {}
        }
        
        logger.info(f"Generating music with prompt: '{request.prompt[:100]}...'")
        logger.info(f"Request payload: {request_payload}")
        
        # Call the Lyria 2 API
        response = send_request_to_google_api(music_model_endpoint, request_payload)
        
        if "predictions" not in response:
            logger.error(f"Invalid response structure: {response}")
            raise HTTPException(
                status_code=500,
                detail="Invalid response from Lyria API - no predictions field"
            )
        
        predictions = response["predictions"]
        if not predictions:
            logger.error("Empty predictions array from Lyria API")
            raise HTTPException(
                status_code=500,
                detail="No predictions returned from Lyria API"
            )
        
        generated_music = []
        
        # Process each generated audio sample
        for idx, pred in enumerate(predictions):
            if "bytesBase64Encoded" not in pred:
                logger.warning(f"Prediction {idx} missing bytesBase64Encoded field")
                continue
            
            try:
                # Decode base64 audio data
                audio_bytes = base64.b64decode(pred["bytesBase64Encoded"])
                logger.info(f"Decoded audio sample {idx}: {len(audio_bytes)} bytes")
                
                # Save to Firebase Storage
                bucket = storage.bucket()
                filename = f"music/{request.brand_id}/{request.user_id}/{os.urandom(8).hex()}.wav"
                blob = bucket.blob(filename)
                blob.upload_from_string(audio_bytes, content_type="audio/wav")
                blob.make_public()
                audio_url = blob.public_url
                
                logger.info(f"Uploaded to Firebase Storage: {audio_url}")
                
                # Save metadata to Firestore
                db = firestore.client()
                music_doc = {
                    "prompt": request.prompt,
                    "negative_prompt": request.negative_prompt or "",
                    "url": audio_url,
                    "filename": filename,
                    "sample_index": idx,
                    "sample_count": request.sample_count if request.seed is None else 1,
                    "seed": request.seed,
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "createdBy": request.user_id,
                    "brandId": request.brand_id,
                    "duration": 30,  # Lyria 2 generates 30-second clips
                    "sampleRate": 48000,  # 48kHz sample rate
                    "format": "wav",
                }
                
                doc_ref = db.collection("brands").document(request.brand_id).collection("music").add(music_doc)
                music_id = doc_ref[1].id
                
                generated_music.append({
                    "id": music_id,
                    "url": audio_url,
                    "prompt": request.prompt,
                    "negative_prompt": request.negative_prompt or "",
                    "sample_index": idx,
                    "seed": request.seed,
                    "duration": 30,
                    "sampleRate": 48000,
                    "format": "wav",
                })
                
            except Exception as e:
                logger.error(f"Error processing prediction {idx}: {e}")
                continue
        
        if not generated_music:
            raise HTTPException(
                status_code=500,
                detail="Failed to process any audio samples from Lyria API"
            )
        
        logger.info(f"Successfully generated {len(generated_music)} music sample(s)")
        
        return {
            "success": True,
            "music": generated_music,
            "count": len(generated_music),
        }
    
    except RequestsHTTPError as e:
        logger.error(f"HTTP error from Lyria API: {e}")
        error_detail = "Failed to generate music - API error"
        status_code = 500
        
        try:
            if hasattr(e, 'response') and e.response is not None:
                status_code = e.response.status_code
                try:
                    error_response = e.response.json()
                    if "error" in error_response:
                        error_detail = error_response["error"].get("message", error_detail)
                    else:
                        error_detail = str(error_response)
                except:
                    error_detail = f"HTTP {status_code}: {e.response.text[:500]}"
        except Exception as parse_error:
            logger.error(f"Error parsing API error response: {parse_error}")
        
        raise HTTPException(status_code=status_code, detail=error_detail)
    except HTTPException:
        # Re-raise HTTPExceptions (validation errors)
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating music: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal error: {str(e)}"
        )

