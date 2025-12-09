import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import base64

# Add python_service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock firebase_admin before importing media_tools
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

from tools.media_tools import generate_video

class TestVeoUrlHandling(unittest.TestCase):

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.requests.get')
    def test_valid_image_url(self, mock_get, mock_genai):
        # Setup mock requests response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"fake_image_data"
        mock_response.headers = {'Content-Type': 'image/jpeg'}
        mock_get.return_value = mock_response
        
        # Setup mock genai response
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data"
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        
        # Call tool with URL
        url = "https://example.com/image.jpg"
        generate_video(prompt="Animate this", image_url=url)
        
        # Verify requests.get was called
        mock_get.assert_called_once_with(url)
        
        # Verify genai call used the downloaded data
        call_args = mock_genai.models.generate_videos.call_args
        # Check prompt is string
        self.assertEqual(call_args[1]['prompt'], "Animate this")
        # Check image argument is present and has correct data
        self.assertIn('image', call_args[1])
        image_arg = call_args[1]['image']
        # In the real code, image_arg is a types.Image object with image_bytes
        # Since we are mocking, we need to make sure our mock matches what the code expects
        self.assertIsNotNone(image_arg)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.requests.get')
    def test_invalid_image_url_404(self, mock_get, mock_genai):
        # Setup mock requests failure
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status.side_effect = Exception("404 Client Error")
        mock_get.return_value = mock_response
        
        # Call tool
        result = generate_video(prompt="Animate this", image_url="https://example.com/missing.jpg")
        
        # Verify result indicates error
        self.assertEqual(result['status'], 'error')
        self.assertIn("404 Client Error", result['error'])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.requests.get')
    def test_image_url_connection_error(self, mock_get, mock_genai):
        # Setup mock connection error
        mock_get.side_effect = Exception("Connection refused")
        
        # Call tool
        result = generate_video(prompt="Animate this", image_url="https://down.com/image.jpg")
        
        # Verify result indicates error
        self.assertEqual(result['status'], 'error')
        self.assertIn("Connection refused", result['error'])

if __name__ == '__main__':
    unittest.main()
