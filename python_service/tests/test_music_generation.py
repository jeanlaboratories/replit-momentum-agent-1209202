"""
Tests for music generation using Lyria 2.
"""
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os
import types
import base64

# Add the parent directory to sys.path
sys.path.insert(0, (os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))))

# Mock external dependencies before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['google.auth'] = MagicMock()
sys.modules['google.auth.transport'] = MagicMock()
sys.modules['google.auth.transport.requests'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['requests.exceptions'] = MagicMock()
# Create HTTPError exception class
http_error = type('HTTPError', (Exception,), {})
sys.modules['requests.exceptions'].HTTPError = http_error

# Setup ADK mocks
if 'google' not in sys.modules:
    sys.modules['google'] = types.ModuleType('google')
if 'google.adk' not in sys.modules:
    adk_module = types.ModuleType('google.adk')
    adk_module.__path__ = []
    sys.modules['google.adk'] = adk_module

# Now import the modules to test
from routers.music import generate_music, MusicGenerationRequest
from fastapi import HTTPException


class TestMusicGeneration(unittest.IsolatedAsyncioTestCase):
    """Tests for music generation."""
    
    @patch('routers.music.get_settings')
    @patch('routers.music.get_google_credentials')
    @patch('routers.music.send_request_to_google_api')
    @patch('routers.music.storage')
    @patch('routers.music.firestore')
    async def test_generate_music_success(self, mock_firestore, mock_storage, mock_send_request, mock_get_creds, mock_get_settings):
        """Test successful music generation."""
        # Setup mocks
        mock_settings = MagicMock()
        mock_settings.effective_project_id = 'test-project'
        mock_get_settings.return_value = mock_settings
        
        # Mock credentials
        mock_creds = MagicMock()
        mock_get_creds.return_value = (mock_creds, 'test-project')
        
        # Mock Google API response
        mock_send_request.return_value = {
            "predictions": [
                {
                    "bytesBase64Encoded": base64.b64encode(b"fake_audio_data").decode('utf-8')
                }
            ]
        }
        
        # Mock Firebase Storage
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.public_url = "https://storage.googleapis.com/test-bucket/music/test.wav"
        mock_bucket.blob.return_value = mock_blob
        mock_storage.bucket.return_value = mock_bucket
        
        # Mock Firestore
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "music-123"
        mock_collection = MagicMock()
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        mock_firestore.client.return_value = mock_db
        
        # Create request (project_id now optional)
        request = MusicGenerationRequest(
            prompt="Smooth jazz",
            negative_prompt="",
            sample_count=1,
            seed=None,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        # Call generate_music
        result = await generate_music(request)
        
        # Verify results
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 1)
        self.assertEqual(len(result["music"]), 1)
        self.assertEqual(result["music"][0]["prompt"], "Smooth jazz")
        self.assertIn("url", result["music"][0])
        
        # Verify credentials were called
        mock_get_creds.assert_called_once()
        
        # Verify API was called
        mock_send_request.assert_called_once()
        call_args = mock_send_request.call_args
        self.assertIn("lyria-002:predict", call_args[0][0])
        
        # Verify request payload structure matches notebook
        request_payload = call_args[0][1]
        self.assertIn("instances", request_payload)
        self.assertIn("parameters", request_payload)
        self.assertEqual(len(request_payload["instances"]), 1)
        instance = request_payload["instances"][0]
        self.assertEqual(instance["prompt"], "Smooth jazz")
        self.assertEqual(instance["sample_count"], 1)
        self.assertNotIn("seed", instance)  # Should not be present when using sample_count
        
        # Verify storage upload
        mock_blob.upload_from_string.assert_called_once()
        mock_blob.make_public.assert_called_once()
        
        # Verify Firestore save
        mock_collection.add.assert_called_once()
    
    @patch('routers.music.get_settings')
    @patch('routers.music.get_google_credentials')
    async def test_generate_music_missing_project_id(self, mock_get_creds, mock_get_settings):
        """Test music generation fails when project ID is missing."""
        mock_settings = MagicMock()
        mock_settings.effective_project_id = None
        mock_settings.project_id = None
        mock_get_settings.return_value = mock_settings
        
        # Mock credentials returning no project ID
        mock_creds = MagicMock()
        mock_get_creds.return_value = (mock_creds, None)
        
        request = MusicGenerationRequest(
            prompt="Test",
            brand_id="test-brand",
            user_id="test-user"
        )
        
        with self.assertRaises(HTTPException) as context:
            await generate_music(request)
        
        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("Project ID not configured", context.exception.detail)
    
    @patch('routers.music.get_settings')
    @patch('routers.music.get_google_credentials')
    async def test_generate_music_seed_and_sample_count_conflict(self, mock_get_creds, mock_get_settings):
        """Test that seed and sample_count cannot be used together."""
        mock_settings = MagicMock()
        mock_settings.effective_project_id = 'test-project'
        mock_get_settings.return_value = mock_settings
        
        # Mock credentials
        mock_creds = MagicMock()
        mock_get_creds.return_value = (mock_creds, 'test-project')
        
        request = MusicGenerationRequest(
            prompt="Test",
            sample_count=2,
            seed=111,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        with self.assertRaises(HTTPException) as context:
            await generate_music(request)
        
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("seed and sample_count cannot be used together", context.exception.detail)
    
    @patch('routers.music.get_settings')
    @patch('routers.music.get_google_credentials')
    async def test_generate_music_invalid_sample_count(self, mock_get_creds, mock_get_settings):
        """Test that sample_count must be between 1 and 4."""
        mock_settings = MagicMock()
        mock_settings.effective_project_id = 'test-project'
        mock_get_settings.return_value = mock_settings
        
        # Mock credentials
        mock_creds = MagicMock()
        mock_get_creds.return_value = (mock_creds, 'test-project')
        
        request = MusicGenerationRequest(
            prompt="Test",
            sample_count=5,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        with self.assertRaises(HTTPException) as context:
            await generate_music(request)
        
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("sample_count must be between 1 and 4", context.exception.detail)
    
    @patch('routers.music.get_settings')
    @patch('routers.music.get_google_credentials')
    @patch('routers.music.send_request_to_google_api')
    @patch('routers.music.storage')
    @patch('routers.music.firestore')
    async def test_generate_music_with_seed(self, mock_firestore, mock_storage, mock_send_request, mock_get_creds, mock_get_settings):
        """Test music generation with seed parameter."""
        # Setup mocks
        mock_settings = MagicMock()
        mock_settings.effective_project_id = 'test-project'
        mock_get_settings.return_value = mock_settings
        
        # Mock credentials
        mock_creds = MagicMock()
        mock_get_creds.return_value = (mock_creds, 'test-project')
        
        # Mock Google API response
        mock_send_request.return_value = {
            "predictions": [
                {
                    "bytesBase64Encoded": base64.b64encode(b"fake_audio_data").decode('utf-8')
                }
            ]
        }
        
        # Mock Firebase Storage
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.public_url = "https://storage.googleapis.com/test-bucket/music/test.wav"
        mock_bucket.blob.return_value = mock_blob
        mock_storage.bucket.return_value = mock_bucket
        
        # Mock Firestore
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "music-123"
        mock_collection = MagicMock()
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        mock_firestore.client.return_value = mock_db
        
        # Create request with seed
        request = MusicGenerationRequest(
            prompt="Dramatic dance symphony",
            seed=111,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        # Call generate_music
        result = await generate_music(request)
        
        # Verify results
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 1)
        
        # Verify request payload structure when using seed
        call_args = mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertEqual(instance["prompt"], "Dramatic dance symphony")
        self.assertEqual(instance["seed"], 111)
        self.assertNotIn("sample_count", instance)  # Should not be present when using seed


if __name__ == '__main__':
    unittest.main()

