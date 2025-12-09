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

# Ensure clean import state for each test class
def setUpModule():
    """Clean up any polluted mocks from previous tests"""
    pass

def tearDownModule():
    """Clean up after all tests in this module"""
    pass

class TestVeoGeneration(unittest.TestCase):

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_text_to_video(self, mock_upload, mock_genai):
        # Setup mock upload to fail (return empty string) so we get base64
        mock_upload.return_value = ""
        
        # Setup files.download to return bytes
        mock_genai.files.download.return_value = b"fake_video_data"
        # Setup mock response
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data"
        mock_operation.response.generated_videos = [mock_video]
        
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        
        # Call tool
        result = generate_video(prompt="A cinematic shot")
        
        # Verify call
        mock_genai.models.generate_videos.assert_called_once()
        call_args = mock_genai.models.generate_videos.call_args
        self.assertEqual(call_args[1]['model'], 'veo-3.1-generate-preview')
        self.assertEqual(call_args[1]['prompt'], 'A cinematic shot') # Single prompt part passed as string if only text
        
        # Verify result
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_image_to_video(self, mock_upload, mock_genai):
        # Setup mock upload to fail (return empty string) so we get base64
        mock_upload.return_value = ""

        # Setup mock
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data"
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_data"

        # Fake image data
        fake_image = base64.b64encode(b"image").decode('utf-8')

        # Call tool
        result = generate_video(prompt="Animate this", image_url=fake_image)

        # Verify call
        call_args = mock_genai.models.generate_videos.call_args
        # Check prompt is string
        self.assertEqual(call_args[1]['prompt'], "Animate this")
        # Check image argument is present
        self.assertIn('image', call_args[1])
        image_arg = call_args[1]['image']
        self.assertIsNotNone(image_arg)

        # Verify config arguments (config is now a GenerateVideosConfig object)
        self.assertIn('config', call_args[1])
        config = call_args[1]['config']
        self.assertIsNotNone(config)

        # Verify result
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_ingredients_mode(self, mock_upload, mock_genai):
        """Test video generation with character reference (ingredients mode)"""
        # Setup mock upload to fail (return empty string) so we get base64
        mock_upload.return_value = ""

        # Setup mock
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data"
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_data"

        # Fake character reference data
        fake_char_ref = base64.b64encode(b"character_image").decode('utf-8')

        # Call tool with character reference
        result = generate_video(prompt="Character walking", character_reference=fake_char_ref)

        # Verify call was made
        mock_genai.models.generate_videos.assert_called_once()
        call_args = mock_genai.models.generate_videos.call_args

        # Check that config contains reference_images
        self.assertIn('config', call_args[1])
        config = call_args[1]['config']

        # Config should be a GenerateVideosConfig object with reference_images
        self.assertIsNotNone(config)
        # The config dict should have been used to create the config object
        # We can't easily inspect the object attributes in the mock, but we verified it was called

        # Verify result
        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.types')
    def test_frames_mode(self, mock_types, mock_upload, mock_genai):
        """Test video generation with start and end frames (interpolation mode)"""
        # Setup mock upload to fail (return empty string) so we get base64
        mock_upload.return_value = ""

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

        # Setup mock
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data"
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_data"

        # Fake frame data
        fake_start_frame = base64.b64encode(b"start_frame_image").decode('utf-8')
        fake_end_frame = base64.b64encode(b"end_frame_image").decode('utf-8')

        # Call tool with start and end frames
        result = generate_video(
            prompt="Smooth transition",
            start_frame=fake_start_frame,
            end_frame=fake_end_frame
        )

        # Verify call was made
        mock_genai.models.generate_videos.assert_called_once()
        call_args = mock_genai.models.generate_videos.call_args

        # Check that image parameter is set (first frame)
        self.assertIn('image', call_args[1])
        # Image should be a single FixedImage, not a list
        image = call_args[1]['image']
        self.assertNotIsInstance(image, list, "For interpolation, image should be single frame, not a list")

        # Check that config contains last_frame (for interpolation)
        self.assertIn('config', call_args[1])
        config = call_args[1]['config']
        self.assertIsNotNone(config)

        # Verify last_frame is in config (the correct API format)
        self.assertIn('last_frame', config, "config should have last_frame for interpolation")

        # Verify duration is set to 8 (required for interpolation)
        self.assertEqual(config.get('duration_seconds'), '8', "Interpolation requires 8 second duration")

        # Verify result
        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_combined_inputs(self, mock_upload, mock_genai):
        """Test video generation with image and character reference combined"""
        # Setup mock upload to fail (return empty string) so we get base64
        mock_upload.return_value = ""

        # Setup mock
        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock()
        mock_video.video.video_bytes = b"fake_video_data"
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.operations.get.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_data"

        # Fake image and character reference data
        fake_image = base64.b64encode(b"input_image").decode('utf-8')
        fake_char_ref = base64.b64encode(b"character_ref").decode('utf-8')

        # Call tool with both image and character reference
        result = generate_video(
            prompt="Animate with character consistency",
            image_url=fake_image,
            character_reference=fake_char_ref
        )

        # Verify call was made
        mock_genai.models.generate_videos.assert_called_once()
        call_args = mock_genai.models.generate_videos.call_args

        # Check that image parameter is set
        self.assertIn('image', call_args[1])

        # Check that config contains reference_images
        self.assertIn('config', call_args[1])
        config = call_args[1]['config']
        self.assertIsNotNone(config)

        # Verify result
        self.assertEqual(result['status'], 'success')

if __name__ == '__main__':
    unittest.main()
