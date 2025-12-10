"""
Comprehensive tests for music generation features - FIXED VERSION.
Tests all aspects: generation, job queue, model configuration, examples, etc.
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


class TestMusicGenerationComprehensiveFixed(unittest.IsolatedAsyncioTestCase):
    """Comprehensive tests for music generation - properly mocked."""
    
    def setUp(self):
        """Setup common mocks for all tests."""
        # Apply consistent mocking for all tests
        self.mock_settings_patcher = patch('routers.music.get_settings')
        self.mock_credentials_patcher = patch('routers.music.get_google_credentials')
        self.mock_send_request_patcher = patch('routers.music.send_request_to_google_api')
        self.mock_storage_patcher = patch('routers.music.storage')
        self.mock_firestore_patcher = patch('routers.music.firestore')
        
        self.mock_settings = self.mock_settings_patcher.start()
        self.mock_credentials = self.mock_credentials_patcher.start()
        self.mock_send_request = self.mock_send_request_patcher.start()
        self.mock_storage = self.mock_storage_patcher.start()
        self.mock_firestore = self.mock_firestore_patcher.start()
        
        # Setup default mocks
        mock_settings_obj = MagicMock()
        mock_settings_obj.effective_project_id = 'test-project'
        self.mock_settings.return_value = mock_settings_obj
        
        mock_creds = MagicMock()
        self.mock_credentials.return_value = (mock_creds, 'test-project')
        
        # Default successful API response
        self.mock_send_request.return_value = {
            "predictions": [
                {"bytesBase64Encoded": base64.b64encode(b"fake_audio_data").decode('utf-8')}
            ]
        }
        
        # Mock Firebase Storage
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.public_url = "https://storage.googleapis.com/test-bucket/music/test.wav"
        mock_bucket.blob.return_value = mock_blob
        self.mock_storage.bucket.return_value = mock_bucket
        
        # Mock Firestore
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "music-123"
        mock_collection = MagicMock()
        mock_collection.add.return_value = (None, mock_doc_ref)
        mock_db.collection.return_value.document.return_value.collection.return_value = mock_collection
        self.mock_firestore.client.return_value = mock_db
        
    def tearDown(self):
        """Clean up patches."""
        self.mock_settings_patcher.stop()
        self.mock_credentials_patcher.stop()
        self.mock_send_request_patcher.stop()
        self.mock_storage_patcher.stop()
        self.mock_firestore_patcher.stop()
    
    async def test_generate_music_with_custom_model(self):
        """Test music generation with custom model selection."""
        request = MusicGenerationRequest(
            prompt="Test music",
            brand_id="test-brand",
            user_id="test-user",
            model="lyria-002"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        # Verify custom model was used in API endpoint
        call_args = self.mock_send_request.call_args
        endpoint = call_args[0][0] if call_args[0] else ''
        self.assertIn("lyria-002:predict", endpoint)
    
    async def test_generate_music_multiple_samples(self):
        """Test generating multiple music samples."""
        # Setup multiple predictions
        self.mock_send_request.return_value = {
            "predictions": [
                {"bytesBase64Encoded": base64.b64encode(b"audio1").decode('utf-8')},
                {"bytesBase64Encoded": base64.b64encode(b"audio2").decode('utf-8')},
                {"bytesBase64Encoded": base64.b64encode(b"audio3").decode('utf-8')}
            ]
        }
        
        request = MusicGenerationRequest(
            prompt="Test multiple",
            sample_count=3,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 3)
        self.assertEqual(len(result["music"]), 3)
        
        # Verify each sample has correct metadata
        for i, track in enumerate(result["music"]):
            self.assertEqual(track["sample_index"], i)
            self.assertEqual(track["duration"], 30)
            self.assertEqual(track["sampleRate"], 48000)
    
    async def test_generate_music_with_seed(self):
        """Test music generation with seed for deterministic results."""
        request = MusicGenerationRequest(
            prompt="Test with seed",
            seed=111,
            brand_id="test-brand",
            user_id="test-user"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 1)
        
        # Verify request payload had seed instead of sample_count
        call_args = self.mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertEqual(instance["seed"], 111)
        self.assertNotIn("sample_count", instance)
    
    async def test_generate_music_with_negative_prompt(self):
        """Test music generation with negative prompt."""
        request = MusicGenerationRequest(
            prompt="Classical music",
            negative_prompt="electronic, modern",
            brand_id="test-brand",
            user_id="test-user"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        
        # Verify negative prompt was included
        call_args = self.mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertEqual(instance["negative_prompt"], "electronic, modern")
    
    async def test_generate_music_no_predictions(self):
        """Test error handling when API returns no predictions."""
        self.mock_send_request.return_value = {
            "predictions": []
        }
        
        request = MusicGenerationRequest(
            prompt="Test no predictions",
            brand_id="test-brand",
            user_id="test-user"
        )
        
        with self.assertRaises(HTTPException) as context:
            await generate_music(request)
        
        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("No predictions returned", context.exception.detail)
    
    async def test_generate_music_api_error_handling(self):
        """Test error handling when API returns error."""
        # Create a proper mock error that simulates RequestsHTTPError
        mock_error = http_error("API quota exceeded")
        mock_error.response = MagicMock()
        mock_error.response.status_code = 500
        mock_error.response.json.return_value = {"error": {"message": "API quota exceeded"}}
        mock_error.response.text = "API quota exceeded"
        
        self.mock_send_request.side_effect = mock_error
        
        request = MusicGenerationRequest(
            prompt="Test error handling",
            brand_id="test-brand",
            user_id="test-user"
        )
        
        with self.assertRaises(HTTPException) as context:
            await generate_music(request)
        
        self.assertEqual(context.exception.status_code, 500)
        detail = str(context.exception.detail)
        self.assertIn("API quota exceeded", detail)
    
    async def test_empty_negative_prompt_handling(self):
        """Test that empty negative prompts are not included in request."""
        request = MusicGenerationRequest(
            prompt="Test empty negative prompt",
            negative_prompt="",  # Empty string
            brand_id="test-brand",
            user_id="test-user"
        )
        
        result = await generate_music(request)
        
        self.assertTrue(result["success"])
        
        # Verify empty negative prompt was not included
        call_args = self.mock_send_request.call_args
        request_payload = call_args[0][1]
        instance = request_payload["instances"][0]
        self.assertNotIn("negative_prompt", instance)


if __name__ == '__main__':
    unittest.main()