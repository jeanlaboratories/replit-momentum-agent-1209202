import os
import logging
import uuid
import urllib.parse
import re
from typing import Optional, Any, Tuple
from firebase_admin import storage

logger = logging.getLogger(__name__)

# Global genai_client will be set by momentum_agent or other modules
genai_client = None

def set_genai_client(client):
    global genai_client
    genai_client = client

def upload_to_storage(data: bytes, content_type: str, folder: str = "generated") -> str:
    """Uploads data to Firebase Storage and returns the public URL."""
    try:
        bucket = storage.bucket()
        filename = f"{folder}/{uuid.uuid4()}"
        if content_type.startswith('image/'):
            filename += ".png"
        elif content_type.startswith('video/'):
            filename += ".mp4"
            
        blob = bucket.blob(filename)
        
        # Create a download token
        token = str(uuid.uuid4())
        metadata = {"firebaseStorageDownloadTokens": token}
        blob.metadata = metadata
        
        blob.upload_from_string(data, content_type=content_type)
        
        # Construct the Firebase Download URL
        # Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
        encoded_path = urllib.parse.quote(filename, safe='')
        public_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{encoded_path}?alt=media&token={token}"
        
        logger.info(f"Uploaded to storage: {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"Failed to upload to storage: {e}")
        return ""

def download_from_firebase_storage(url: str) -> Tuple[Optional[bytes], str]:
    """
    Downloads a file from Firebase Storage using the Admin SDK.
    Handles URLs that may not have authentication tokens.

    Args:
        url: Firebase Storage URL in one of these formats:
            - https://storage.googleapis.com/{bucket}/o/{path}?alt=media
            - https://storage.googleapis.com/{bucket}/{path} (direct path without /o/)
            - https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media

    Returns:
        Tuple of (file_bytes, mime_type) or (None, '') on error
    """
    try:
        bucket_name = None
        file_path = None

        # Pattern 1: storage.googleapis.com with /o/ prefix
        # https://storage.googleapis.com/bucket-name/o/path%2Fto%2Ffile.png?alt=media
        pattern1 = r'https://storage\.googleapis\.com/([^/]+)/o/([^?]+)'
        match = re.match(pattern1, url)
        if match:
            bucket_name = match.group(1)
            file_path = urllib.parse.unquote(match.group(2))
            logger.info(f"Matched pattern 1 (storage.googleapis.com with /o/): bucket={bucket_name}")

        # Pattern 2: storage.googleapis.com with direct path (no /o/)
        # https://storage.googleapis.com/automl-migration-test.firebasestorage.app/images/uuid/file.png
        if not match:
            pattern2 = r'https://storage\.googleapis\.com/([^/]+)/(.+?)(?:\?|$)'
            match = re.match(pattern2, url)
            if match:
                bucket_name = match.group(1)
                file_path = urllib.parse.unquote(match.group(2))
                logger.info(f"Matched pattern 2 (storage.googleapis.com direct path): bucket={bucket_name}")

        # Pattern 3: firebasestorage.googleapis.com URL
        # https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
        if not match:
            pattern3 = r'https://firebasestorage\.googleapis\.com/v0/b/([^/]+)/o/([^?]+)'
            match = re.match(pattern3, url)
            if match:
                bucket_name = match.group(1)
                file_path = urllib.parse.unquote(match.group(2))
                logger.info(f"Matched pattern 3 (firebasestorage.googleapis.com): bucket={bucket_name}")

        if not bucket_name or not file_path:
            logger.warning(f"URL does not match any Firebase Storage patterns: {url[:100]}...")
            return None, ''

        logger.info(f"Downloading from Firebase Storage: bucket={bucket_name}, path={file_path}")

        # Get the bucket and download
        bucket = storage.bucket(bucket_name)
        blob = bucket.blob(file_path)

        # Download the content
        content = blob.download_as_bytes()

        # Get mime type from blob metadata or infer from extension
        mime_type = blob.content_type or 'application/octet-stream'
        if mime_type == 'application/octet-stream':
            # Try to infer from file extension
            if file_path.lower().endswith('.png'):
                mime_type = 'image/png'
            elif file_path.lower().endswith(('.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            elif file_path.lower().endswith('.gif'):
                mime_type = 'image/gif'
            elif file_path.lower().endswith('.webp'):
                mime_type = 'image/webp'

        logger.info(f"Downloaded {len(content)} bytes, mime_type={mime_type}")
        return content, mime_type

    except Exception as e:
        logger.error(f"Failed to download from Firebase Storage: {e}")
        return None, ''


def is_firebase_storage_url(url: str) -> bool:
    """Check if a URL is a Firebase Storage URL that we can download with admin SDK."""
    return (
        'storage.googleapis.com' in url or
        'firebasestorage.googleapis.com' in url
    )


def upload_file_to_gemini(media_data: bytes, mime_type: str) -> Optional[Any]:
    """
    Uploads a file to the Gemini File API for efficient token usage.
    
    Args:
        media_data (bytes): The raw file data
        mime_type (str): The MIME type of the file
        
    Returns:
        Optional[Any]: The uploaded file object (File) or None if upload failed
    """
    try:
        if not genai_client:
            logger.error("Google AI client not initialized in storage_utils")
            return None
            
        # Create a temporary file to upload (client.files.upload expects a path or file-like object)
        import tempfile
        
        # Map mime type to extension
        ext = ".bin"
        if mime_type == "image/png": ext = ".png"
        elif mime_type == "image/jpeg": ext = ".jpg"
        elif mime_type == "image/webp": ext = ".webp"
        elif mime_type == "video/mp4": ext = ".mp4"
        elif mime_type == "application/pdf": ext = ".pdf"
        elif mime_type == "audio/mpeg": ext = ".mp3"
        elif mime_type == "audio/wav": ext = ".wav"
        
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            temp_file.write(media_data)
            temp_path = temp_file.name
            
        try:
            logger.info(f"Uploading file to Gemini File API ({len(media_data)} bytes, {mime_type})...")
            file_obj = genai_client.files.upload(
                file=temp_path,
                config={'mime_type': mime_type}
            )
            logger.info(f"File uploaded successfully: {file_obj.uri}")
            return file_obj
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"Failed to upload file to Gemini: {e}")
        return None
