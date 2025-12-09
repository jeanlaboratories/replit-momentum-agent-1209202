"""
Test the /media/generate-video endpoint (Video Gallery) with all Veo 3.1 modes.
Uses mocks to simulate the API responses - tests the generate_video function directly
to avoid complex import chain issues with google.adk.
"""
import unittest
from unittest.mock import MagicMock, patch
import sys
import os
import base64

# Add python_service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock firebase_admin before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

from tools.media_tools import generate_video


class TestVideoGalleryModes(unittest.TestCase):
    """Test all Veo 3.1 modes that the Video Gallery uses via generate_video()"""

    def _setup_mock_video_response(self, mock_genai):
        """Helper to set up standard mock video response"""
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_operation.name = "test-operation"

        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data_for_testing"
        mock_operation.response.generated_videos = [mock_video]

        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_data_for_testing"

        # Mock file upload for video extension
        mock_file = MagicMock()
        mock_file.uri = "https://generativelanguage.googleapis.com/v1beta/files/test-file"
        mock_genai.files.upload.return_value = mock_file

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_text_to_video(self, mock_upload, mock_genai):
        """Test Text-to-Video mode - the basic generation mode"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        result = generate_video(prompt="A beautiful sunset over the ocean")

        self.assertEqual(result["status"], "success")
        self.assertIn("video_url", result)
        self.assertEqual(result["format"], "url")

        # Verify API was called correctly
        mock_genai.models.generate_videos.assert_called_once()
        call_args = mock_genai.models.generate_videos.call_args
        self.assertEqual(call_args[1]['prompt'], "A beautiful sunset over the ocean")

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_image_to_video(self, mock_upload, mock_genai):
        """Test Image-to-Video mode - animate an image"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        fake_image = base64.b64encode(b"fake_image_data").decode('utf-8')

        result = generate_video(
            prompt="Animate this image with gentle motion",
            image_url=fake_image
        )

        self.assertEqual(result["status"], "success")

        # Verify image was passed
        call_args = mock_genai.models.generate_videos.call_args
        self.assertIn('image', call_args[1])
        self.assertIsNotNone(call_args[1]['image'])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.types')
    def test_frames_to_video_interpolation(self, mock_types, mock_upload, mock_genai):
        """Test Frames-to-Video (interpolation) mode - using image + config.last_frame"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        # Mock Part.from_bytes to return a Part with inline_data
        def create_mock_part(data, mime_type):
            mock_part = MagicMock()
            mock_inline_data = MagicMock()
            mock_inline_data.data = data
            mock_inline_data.mime_type = mime_type
            mock_part.inline_data = mock_inline_data
            return mock_part
        
        mock_types.Part.from_bytes = MagicMock(side_effect=lambda data, mime_type: create_mock_part(data, mime_type))
        
        # Mock VideoGenerationReferenceImage and Video classes
        mock_types.VideoGenerationReferenceImage = MagicMock
        mock_types.Video = MagicMock
        mock_types.Image = MagicMock  # For FixedImage

        fake_start = base64.b64encode(b"start_frame_data").decode('utf-8')
        fake_end = base64.b64encode(b"end_frame_data").decode('utf-8')

        result = generate_video(
            prompt="Smooth transition between frames",
            start_frame=fake_start,
            end_frame=fake_end
        )

        self.assertEqual(result["status"], "success")

        # CRITICAL: Verify correct API format for interpolation
        call_args = mock_genai.models.generate_videos.call_args

        # First frame should be in 'image' param (NOT an array)
        self.assertIn('image', call_args[1])
        image = call_args[1]['image']
        self.assertNotIsInstance(image, list, "image should be single frame, not array")

        # Last frame should be in config.last_frame
        self.assertIn('config', call_args[1])
        config = call_args[1]['config']
        self.assertIn('last_frame', config, "config must have last_frame for interpolation")

        # Duration must be 8 seconds for interpolation
        self.assertEqual(config.get('duration_seconds'), '8')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_video_extension(self, mock_upload, mock_genai):
        """Test Video Extension mode - using types.Video(uri=file_uri)"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        fake_video = base64.b64encode(b"fake_video_bytes").decode('utf-8')

        result = generate_video(
            prompt="Continue this video with more action",
            video_url=fake_video
        )

        self.assertEqual(result["status"], "success")

        # CRITICAL: Verify video was uploaded to File API first
        mock_genai.files.upload.assert_called_once()

        # Verify video param was passed to generate_videos
        call_args = mock_genai.models.generate_videos.call_args
        self.assertIn('video', call_args[1])

        # The video should be a types.Video object (not Part.from_bytes)
        video_arg = call_args[1]['video']
        self.assertIsNotNone(video_arg)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_character_reference_ingredients(self, mock_upload, mock_genai):
        """Test Character Reference (Ingredients) mode"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        fake_char = base64.b64encode(b"character_sheet_data").decode('utf-8')

        result = generate_video(
            prompt="Character walking through a park",
            character_reference=fake_char
        )

        self.assertEqual(result["status"], "success")

        # Verify character reference was added to config.reference_images
        call_args = mock_genai.models.generate_videos.call_args
        config = call_args[1]['config']
        self.assertIn('reference_images', config)
        self.assertTrue(len(config['reference_images']) > 0)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_veo_parameters(self, mock_upload, mock_genai):
        """Test all Veo 3.1 parameters passed correctly"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        fake_image = base64.b64encode(b"image_data").decode('utf-8')

        result = generate_video(
            prompt="A cinematic scene",
            image_url=fake_image,
            aspect_ratio="16:9",
            resolution="1080p",
            duration_seconds=8,
            person_generation="allow_all",
            use_fast_model=True
        )

        self.assertEqual(result["status"], "success")

        # Verify all parameters were passed correctly
        call_args = mock_genai.models.generate_videos.call_args

        # Fast model should be used
        self.assertEqual(call_args[1]['model'], 'veo-3.1-fast-generate-preview')

        # Config parameters
        config = call_args[1]['config']
        self.assertEqual(config['aspect_ratio'], '16:9')
        self.assertEqual(config['resolution'], '1080p')
        self.assertEqual(config['duration_seconds'], '8')
        self.assertEqual(config['person_generation'], 'allow_all')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_fallback_response(self, mock_upload, mock_genai):
        """Test that base64 response is returned when storage upload fails"""
        # Upload fails, so we get base64 response
        mock_upload.return_value = ""
        self._setup_mock_video_response(mock_genai)

        result = generate_video(prompt="A test video")

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["format"], "base64")
        self.assertIn("video_data", result)

        # Verify base64 data is valid
        video_b64 = result["video_data"]
        decoded = base64.b64decode(video_b64)
        self.assertEqual(decoded, b"fake_video_data_for_testing")

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.types')
    def test_combined_image_and_character_reference(self, mock_types, mock_upload, mock_genai):
        """Test combining image input with character reference"""
        mock_upload.return_value = "https://storage.example.com/video.mp4"
        self._setup_mock_video_response(mock_genai)

        # Mock Part.from_bytes to return a Part with inline_data
        def create_mock_part(data, mime_type):
            mock_part = MagicMock()
            mock_inline_data = MagicMock()
            mock_inline_data.data = data
            mock_inline_data.mime_type = mime_type
            mock_part.inline_data = mock_inline_data
            return mock_part
        
        mock_types.Part.from_bytes = MagicMock(side_effect=lambda data, mime_type: create_mock_part(data, mime_type))
        
        # Mock VideoGenerationReferenceImage and Video classes
        mock_types.VideoGenerationReferenceImage = MagicMock
        mock_types.Video = MagicMock
        mock_types.Image = MagicMock  # For FixedImage

        fake_image = base64.b64encode(b"input_image").decode('utf-8')
        fake_char = base64.b64encode(b"character_ref").decode('utf-8')

        result = generate_video(
            prompt="Animate with character consistency",
            image_url=fake_image,
            character_reference=fake_char
        )

        self.assertEqual(result["status"], "success")

        call_args = mock_genai.models.generate_videos.call_args

        # Both image and character reference should be present
        self.assertIn('image', call_args[1])
        config = call_args[1]['config']
        self.assertIn('reference_images', config)


if __name__ == '__main__':
    unittest.main()
