"""
Tests for Media Response Consistency

This test file ensures that all media generation tools (generate_image, generate_video,
nano_banana) return consistent response structures that can be consumed by the frontend
regardless of whether single or multiple media items are generated.

Standard Response Format:
- Always includes BOTH singular and array fields for backward compatibility
- Image responses: image_url (singular) + image_urls (array)
- Video responses: video_url (singular) + video_urls (array)
- Base64 fallback: image_data/video_data (singular) + image_data_list/video_data_list (array)
"""

import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add python_service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock firebase_admin before importing media_tools
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

from tools.media_tools import generate_image, generate_video, nano_banana


class TestMediaResponseConsistency(unittest.TestCase):
    """Test that all media tools return consistent response structures."""

    def assert_image_response_structure(self, result, expected_format='url'):
        """Helper to validate image response structure."""
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], expected_format)
        self.assertIn('prompt', result)

        if expected_format == 'url':
            # Must have BOTH singular and array for consistency
            self.assertIn('image_url', result, "Missing image_url (singular)")
            self.assertIn('image_urls', result, "Missing image_urls (array)")
            self.assertIsInstance(result['image_urls'], list)
            self.assertEqual(result['image_url'], result['image_urls'][0],
                           "image_url should equal first element of image_urls")
        else:
            # Base64 format
            self.assertIn('image_data', result, "Missing image_data (singular)")
            self.assertIn('image_data_list', result, "Missing image_data_list (array)")
            self.assertIsInstance(result['image_data_list'], list)
            self.assertEqual(result['image_data'], result['image_data_list'][0],
                           "image_data should equal first element of image_data_list")

    def assert_video_response_structure(self, result, expected_format='url'):
        """Helper to validate video response structure."""
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], expected_format)
        self.assertIn('prompt', result)

        if expected_format == 'url':
            # Must have BOTH singular and array for consistency
            self.assertIn('video_url', result, "Missing video_url (singular)")
            self.assertIn('video_urls', result, "Missing video_urls (array)")
            self.assertIsInstance(result['video_urls'], list)
            self.assertEqual(result['video_url'], result['video_urls'][0],
                           "video_url should equal first element of video_urls")
        else:
            # Base64 format
            self.assertIn('video_data', result, "Missing video_data (singular)")
            self.assertIn('video_data_list', result, "Missing video_data_list (array)")
            self.assertIsInstance(result['video_data_list'], list)
            self.assertEqual(result['video_data'], result['video_data_list'][0],
                           "video_data should equal first element of video_data_list")


class TestGenerateImageResponseConsistency(TestMediaResponseConsistency):
    """Test generate_image returns consistent response structure."""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_single_image_url_format(self, mock_upload, mock_genai):
        """Single image with URL format has both singular and array fields."""
        mock_upload.return_value = "https://storage.example.com/image1.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="A sunset", number_of_images=1)

        self.assert_image_response_structure(result, expected_format='url')
        self.assertEqual(len(result['image_urls']), 1)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_images_url_format(self, mock_upload, mock_genai):
        """Multiple images with URL format has both singular and array fields."""
        mock_upload.side_effect = [
            "https://storage.example.com/image1.png",
            "https://storage.example.com/image2.png",
            "https://storage.example.com/image3.png"
        ]

        mock_response = MagicMock()
        mock_images = [MagicMock() for _ in range(3)]
        for img in mock_images:
            img.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = mock_images
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="A sunset", number_of_images=3)

        self.assert_image_response_structure(result, expected_format='url')
        self.assertEqual(len(result['image_urls']), 3)
        # image_url should be the first one
        self.assertEqual(result['image_url'], result['image_urls'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_single_image_base64_fallback(self, mock_upload, mock_genai):
        """Single image with base64 fallback has both singular and array fields."""
        mock_upload.return_value = ""  # Force base64 fallback

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="A sunset", number_of_images=1)

        self.assert_image_response_structure(result, expected_format='base64')
        self.assertEqual(len(result['image_data_list']), 1)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_images_base64_fallback(self, mock_upload, mock_genai):
        """Multiple images with base64 fallback has both singular and array fields."""
        mock_upload.return_value = ""  # Force base64 fallback

        mock_response = MagicMock()
        mock_images = [MagicMock() for _ in range(4)]
        for i, img in enumerate(mock_images):
            img.image.image_bytes = f"fake_image_data_{i}".encode()
        mock_response.generated_images = mock_images
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="A sunset", number_of_images=4)

        self.assert_image_response_structure(result, expected_format='base64')
        self.assertEqual(len(result['image_data_list']), 4)
        # image_data should be the first one
        self.assertEqual(result['image_data'], result['image_data_list'][0])


class TestGenerateVideoResponseConsistency(TestMediaResponseConsistency):
    """Test generate_video returns consistent response structure."""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_video_url_format(self, mock_upload, mock_genai):
        """Video with URL format has both singular and array fields."""
        mock_upload.return_value = "https://storage.example.com/video.mp4"

        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock(video="video_obj")
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_bytes"

        result = generate_video(prompt="A flying eagle")

        self.assert_video_response_structure(result, expected_format='url')
        self.assertEqual(len(result['video_urls']), 1)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_video_base64_fallback(self, mock_upload, mock_genai):
        """Video with base64 fallback has both singular and array fields."""
        mock_upload.return_value = ""  # Force base64 fallback

        mock_operation = MagicMock()
        mock_operation.done = True
        mock_video = MagicMock(video="video_obj")
        mock_operation.response.generated_videos = [mock_video]
        mock_genai.models.generate_videos.return_value = mock_operation
        mock_genai.files.download.return_value = b"fake_video_bytes"

        result = generate_video(prompt="A flying eagle")

        self.assert_video_response_structure(result, expected_format='base64')
        self.assertEqual(len(result['video_data_list']), 1)


class TestNanoBananaResponseConsistency(TestMediaResponseConsistency):
    """Test nano_banana returns consistent response structure."""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_nano_banana_url_format(self, mock_upload, mock_genai):
        """nano_banana with URL format has both singular and array fields."""
        mock_upload.return_value = "https://storage.example.com/edited.png"

        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image_data"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

        result = nano_banana(prompt="Make it blue")

        self.assert_image_response_structure(result, expected_format='url')
        self.assertEqual(len(result['image_urls']), 1)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_nano_banana_base64_fallback(self, mock_upload, mock_genai):
        """nano_banana with base64 fallback has both singular and array fields."""
        mock_upload.return_value = ""  # Force base64 fallback

        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image_data"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

        result = nano_banana(prompt="Make it blue")

        self.assert_image_response_structure(result, expected_format='base64')
        self.assertEqual(len(result['image_data_list']), 1)


class TestAgentRouterMediaHandling(unittest.TestCase):
    """Test that agent router correctly handles standardized media responses."""

    def test_agent_router_handles_image_urls_array(self):
        """Verify agent router uses image_urls array format."""
        # Read the agent.py file to verify implementation
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Verify it uses the array format
        self.assertIn("image_urls = fr.response.get('image_urls', [])", source,
                      "Agent router should use image_urls array format")
        self.assertIn("image_data_list = fr.response.get('image_data_list', [])", source,
                      "Agent router should use image_data_list array format")

    def test_agent_router_handles_video_urls_array(self):
        """Verify agent router uses video_urls array format."""
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Verify it uses the array format
        self.assertIn("video_urls = fr.response.get('video_urls', [])", source,
                      "Agent router should use video_urls array format")
        self.assertIn("video_data_list = fr.response.get('video_data_list', [])", source,
                      "Agent router should use video_data_list array format")

    def test_agent_router_fallback_to_singular(self):
        """Verify agent router falls back to singular fields for backward compatibility."""
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Verify fallback logic exists
        self.assertIn("fr.response.get('image_url')", source,
                      "Agent router should fallback to image_url for backward compatibility")
        self.assertIn("fr.response.get('video_url')", source,
                      "Agent router should fallback to video_url for backward compatibility")

    def test_agent_router_combines_image_tools(self):
        """Verify generate_image and nano_banana are handled together."""
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Verify both tools are handled in the same block
        self.assertIn("fr.name in ('generate_image', 'nano_banana')", source,
                      "Agent router should handle generate_image and nano_banana together")


class TestResponseFieldConsistency(unittest.TestCase):
    """Test that response fields are consistent across all media tools."""

    def test_all_success_responses_have_required_fields(self):
        """All successful responses must have status, format, prompt, and message."""
        required_fields = ['status', 'format', 'prompt', 'message']

        # Read media_tools.py to check response structures
        media_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_tools.py')
        with open(media_tools_path, 'r') as f:
            source = f.read()

        # Check for required fields in success responses
        for field in required_fields:
            self.assertIn(f'"{field}":', source,
                         f"Media tools should include '{field}' in responses")

    def test_image_responses_always_have_both_formats(self):
        """Image responses always have both singular and array fields."""
        media_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_tools.py')
        with open(media_tools_path, 'r') as f:
            source = f.read()

        # Check that both formats are included
        self.assertIn('"image_url":', source)
        self.assertIn('"image_urls":', source)
        self.assertIn('"image_data":', source)
        self.assertIn('"image_data_list":', source)

    def test_video_responses_always_have_both_formats(self):
        """Video responses always have both singular and array fields."""
        media_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_tools.py')
        with open(media_tools_path, 'r') as f:
            source = f.read()

        # Check that both formats are included
        self.assertIn('"video_url":', source)
        self.assertIn('"video_urls":', source)
        self.assertIn('"video_data":', source)
        self.assertIn('"video_data_list":', source)


if __name__ == '__main__':
    unittest.main()
