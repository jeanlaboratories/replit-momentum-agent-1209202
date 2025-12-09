import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add python_service to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock firebase_admin before importing media_tools
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

from tools.media_tools import generate_video

class TestVideoGeneration(unittest.TestCase):
    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.requests')
    @patch('tools.media_tools.base64')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_video_with_image(self, mock_upload, mock_base64, mock_requests, mock_genai):
        # Mock the client and operation
        mock_operation = MagicMock()
        # Set operation.response.generated_videos
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        # Ensure operation.done is True to avoid infinite loop
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        
        # Mock genai_client.files.download
        mock_genai.files.download.return_value = b'fake_video_bytes'
        
        # Mock upload_to_storage
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"
        
        # Mock base64 decoding
        mock_base64.b64decode.return_value = b'fakebytes'
        
        # Call generate_video with image_url (base64)
        result = generate_video(
            prompt="Animate this image",
            image_url="data:image/png;base64,fakebase64"
        )
        
        # Print result for debugging
        print(f"Result: {result}")
        
        # Verify results
        self.assertEqual(result['status'], 'success')
        self.assertIn('video_url', result)
        self.assertEqual(result['video_url'], "https://storage.googleapis.com/bucket/video.mp4")
        
        # Verify call args
        mock_genai.models.generate_videos.assert_called_once()
        call_args = mock_genai.models.generate_videos.call_args
        self.assertIn('image', call_args[1])

if __name__ == '__main__':
    unittest.main()
