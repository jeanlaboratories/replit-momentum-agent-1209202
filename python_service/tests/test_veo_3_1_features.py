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

class TestVeo31Features(unittest.TestCase):
    """Test all Veo 3.1 features comprehensively"""


    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_resolution_and_duration(self, mock_upload, mock_genai):
        """Test resolution and duration_seconds parameters"""
        mock_operation = MagicMock()
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b'fake_video_bytes'
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"

        result = generate_video(
            prompt="High quality video",
            resolution="1080p",
            duration_seconds=8
        )

        self.assertEqual(result['status'], 'success')

        # Verify config parameters
        call_args = mock_genai.models.generate_videos.call_args
        config = call_args[1]['config']
        self.assertEqual(config['resolution'], '1080p')
        self.assertEqual(config['duration_seconds'], '8')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_person_generation(self, mock_upload, mock_genai):
        """Test person_generation parameter"""
        mock_operation = MagicMock()
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b'fake_video_bytes'
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"

        result = generate_video(
            prompt="People walking in park",
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')

        # Verify person_generation in config
        call_args = mock_genai.models.generate_videos.call_args
        config = call_args[1]['config']
        self.assertEqual(config['person_generation'], 'allow_all')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.requests')
    @patch('tools.media_tools.upload_to_storage')
    def test_video_extension(self, mock_upload, mock_requests, mock_genai):
        """Test video extension feature"""
        mock_operation = MagicMock()
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b'fake_video_bytes'
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"

        # Mock video download
        mock_response = MagicMock()
        mock_response.content = b'fake_original_video'
        mock_response.headers = {'Content-Type': 'video/mp4'}
        mock_requests.get.return_value = mock_response

        result = generate_video(
            prompt="Continue the action",
            video_url="https://example.com/original.mp4"
        )

        self.assertEqual(result['status'], 'success')

        # Verify video input was added
        call_args = mock_genai.models.generate_videos.call_args
        self.assertIn('video', call_args[1])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.requests')
    @patch('tools.media_tools.base64')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_reference_images(self, mock_upload, mock_base64, mock_requests, mock_genai):
        """Test multiple reference images (up to 3)"""
        mock_operation = MagicMock()
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b'fake_video_bytes'
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"

        # Mock image processing
        mock_base64.b64decode.return_value = b'fake_image_bytes'

        # reference_images is now a comma-separated string
        result = generate_video(
            prompt="Video with asset references",
            reference_images="data:image/png;base64,img1,data:image/png;base64,img2,data:image/png;base64,img3"
        )

        self.assertEqual(result['status'], 'success')

        # Verify reference images were added to config
        call_args = mock_genai.models.generate_videos.call_args
        config = call_args[1]['config']
        self.assertIn('reference_images', config)
        # Should have up to 3 reference images
        self.assertLessEqual(len(config['reference_images']), 3)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_fast_model_variant(self, mock_upload, mock_genai):
        """Test fast model variant (veo-3.1-fast-generate-preview)"""
        mock_operation = MagicMock()
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b'fake_video_bytes'
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"

        result = generate_video(
            prompt="Quick video",
            use_fast_model=True
        )

        self.assertEqual(result['status'], 'success')

        # Verify fast model was used
        call_args = mock_genai.models.generate_videos.call_args
        self.assertEqual(call_args[1]['model'], 'veo-3.1-fast-generate-preview')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_features_combined(self, mock_upload, mock_genai):
        """Test using multiple features together"""
        mock_operation = MagicMock()
        mock_operation.response.generated_videos = [MagicMock(video="video_obj")]
        mock_operation.done = True
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b'fake_video_bytes'
        mock_upload.return_value = "https://storage.googleapis.com/bucket/video.mp4"

        result = generate_video(
            prompt="Complex video generation",
            resolution="1080p",
            duration_seconds=8,
            person_generation="allow_all",
            use_fast_model=True,
            aspect_ratio="16:9"
        )

        self.assertEqual(result['status'], 'success')

        # Verify all parameters were passed
        call_args = mock_genai.models.generate_videos.call_args
        self.assertEqual(call_args[1]['model'], 'veo-3.1-fast-generate-preview')

        config = call_args[1]['config']
        self.assertEqual(config['resolution'], '1080p')
        self.assertEqual(config['duration_seconds'], '8')
        self.assertEqual(config['person_generation'], 'allow_all')
        self.assertEqual(config['aspect_ratio'], '16:9')

if __name__ == '__main__':
    unittest.main()
