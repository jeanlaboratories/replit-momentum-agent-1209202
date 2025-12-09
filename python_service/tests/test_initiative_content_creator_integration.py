"""
Tests for Initiative Content Creator Integration with Nano Banana.

Verifies that the unified nano_banana endpoint works correctly for all
Initiative Content Creator use cases:

1. Campaign image editing with full parameter support
2. Multi-image composition for campaign assets
3. Character-consistent image generation
4. Aspect ratio support for different content types
5. Response format consistency with TypeScript frontend
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


class TestInitiativeContentCreatorNanoBanana(unittest.TestCase):
    """
    Test nano_banana functionality as used by Initiative Content Creator.

    The Initiative Content Creator uses nano_banana for:
    - Editing campaign images with AI
    - Composing multiple images into one
    - Applying brand-specific styles
    - Different aspect ratios for different platforms
    """

    def _setup_mock_edit_response(self, mock_genai, num_images=1):
        """Helper to set up standard mock response"""
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_parts = []
        for i in range(num_images):
            mock_part = MagicMock()
            mock_part.inline_data = MagicMock()
            mock_part.inline_data.data = f"edited_image_{i}".encode()
            mock_part.inline_data.mime_type = "image/png"
            mock_parts.append(mock_part)
        mock_candidate.content.parts = mock_parts
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_campaign_image_edit_mode(self, mock_upload, mock_genai):
        """Test editing a single campaign image with edit mode"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        result = nano_banana(
            prompt="Add a golden hour lighting effect to this campaign image",
            image_url=base64.b64encode(b"campaign_image").decode(),
            mode="edit",
            aspect_ratio="16:9"  # Common for social media headers
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        self.assertEqual(result['format'], 'url')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multi_image_composition_for_campaigns(self, mock_upload, mock_genai):
        """Test composing multiple images for campaign collage"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Simulate selecting multiple images from gallery
        ref_images = [
            base64.b64encode(b"product_image_1").decode(),
            base64.b64encode(b"product_image_2").decode(),
            base64.b64encode(b"background_image").decode(),
        ]

        result = nano_banana(
            prompt="Create a product showcase collage with all these items arranged beautifully",
            reference_images=",".join(ref_images),
            mode="compose",
            aspect_ratio="1:1",  # Square for Instagram
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_social_media_aspect_ratios(self, mock_upload, mock_genai):
        """Test different aspect ratios for various social platforms"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Test Instagram Story (9:16)
        result_story = nano_banana(
            prompt="Transform into Instagram story format",
            image_url=base64.b64encode(b"test").decode(),
            aspect_ratio="9:16"
        )
        self.assertEqual(result_story['status'], 'success')

        # Test Twitter/Facebook post (16:9)
        result_post = nano_banana(
            prompt="Transform into wide format for Twitter",
            image_url=base64.b64encode(b"test").decode(),
            aspect_ratio="16:9"
        )
        self.assertEqual(result_post['status'], 'success')

        # Test Instagram feed (1:1)
        result_feed = nano_banana(
            prompt="Transform into square format for Instagram feed",
            image_url=base64.b64encode(b"test").decode(),
            aspect_ratio="1:1"
        )
        self.assertEqual(result_feed['status'], 'success')

        # Test portrait format (4:5)
        result_portrait = nano_banana(
            prompt="Transform into portrait format",
            image_url=base64.b64encode(b"test").decode(),
            aspect_ratio="4:5"
        )
        self.assertEqual(result_portrait['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_brand_style_application(self, mock_upload, mock_genai):
        """Test applying brand-specific styles"""
        mock_upload.return_value = "https://storage.example.com/branded.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        result = nano_banana(
            prompt="Apply our brand's minimalist style with clean lines, avoiding cluttered or busy backgrounds",
            image_url=base64.b64encode(b"product_shot").decode(),
            mode="edit"
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_response_format_for_frontend(self, mock_upload, mock_genai):
        """Test that response format matches what TypeScript frontend expects"""
        mock_upload.return_value = "https://storage.example.com/result.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        result = nano_banana(
            prompt="Test image",
            image_url=base64.b64encode(b"test").decode()
        )

        # Verify all fields that TypeScript frontend expects
        required_fields = ['status', 'message', 'format', 'prompt', 'image_url', 'image_urls']
        for field in required_fields:
            self.assertIn(field, result, f"Missing required field: {field}")

        self.assertEqual(result['status'], 'success')
        self.assertIsInstance(result['image_urls'], list)
        self.assertEqual(result['image_url'], result['image_urls'][0])


class TestCharacterConsistentGeneration(unittest.TestCase):
    """
    Test character-consistent image generation for campaigns.

    This uses nano_banana with reference_images for character sheets
    to maintain visual consistency across campaign content.
    """

    def _setup_mock_edit_response(self, mock_genai):
        """Helper to set up mock response"""
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"character_consistent_image"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_character_reference_with_prompt(self, mock_upload, mock_genai):
        """Test using character sheets for consistent generation"""
        mock_upload.return_value = "https://storage.example.com/character.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Simulate character sheet reference
        character_sheet = base64.b64encode(b"character_sheet_data").decode()

        result = nano_banana(
            prompt="Our mascot character walking through a park",
            reference_images=character_sheet,
            mode="compose",
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_character_references(self, mock_upload, mock_genai):
        """Test using multiple character references"""
        mock_upload.return_value = "https://storage.example.com/multi_char.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Multiple character sheets
        char_refs = [
            base64.b64encode(b"mascot_sheet").decode(),
            base64.b64encode(b"sidekick_sheet").decode(),
        ]

        result = nano_banana(
            prompt="The mascot and sidekick having a conversation",
            reference_images=",".join(char_refs),
            mode="compose",
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_scene_to_scene_consistency(self, mock_upload, mock_genai):
        """Test using previous scene for scene-to-scene consistency"""
        mock_upload.return_value = "https://storage.example.com/next_scene.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Character sheet + previous scene for consistency
        char_sheet = base64.b64encode(b"character_sheet").decode()
        prev_scene = base64.b64encode(b"previous_scene").decode()

        result = nano_banana(
            prompt="Same character now inside the building",
            reference_images=f"{char_sheet},{prev_scene}",
            mode="compose",
        )

        self.assertEqual(result['status'], 'success')


class TestImageEditAPIEndpoint(unittest.TestCase):
    """
    Test the /agent/nano-banana endpoint as called by the TypeScript frontend.

    The frontend (generate-edited-image.ts) calls this endpoint with these params:
    - prompt, image_url, reference_images, mask_url
    - mode, aspect_ratio, number_of_images, person_generation
    """

    def _setup_mock_edit_response(self, mock_genai):
        """Helper to set up mock response"""
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"api_result_image"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_parameters_accepted(self, mock_upload, mock_genai):
        """Test that all 8 parameters are accepted by nano_banana"""
        mock_upload.return_value = "https://storage.example.com/result.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # All parameters that TypeScript frontend can send
        result = nano_banana(
            prompt="Edit this image",
            image_url=base64.b64encode(b"main_image").decode(),
            reference_images=base64.b64encode(b"ref").decode(),
            mask_url="",
            mode="edit",
            aspect_ratio="16:9",
            number_of_images=1,
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_empty_optional_params(self, mock_upload, mock_genai):
        """Test with empty optional parameters (as sent by frontend)"""
        mock_upload.return_value = "https://storage.example.com/result.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Frontend may send empty strings for optional params
        result = nano_banana(
            prompt="Generate an image",
            image_url="",
            reference_images="",
            mask_url="",
            mode="",  # Empty string, not None
            aspect_ratio="1:1",
            number_of_images=1,
            person_generation=""
        )

        self.assertEqual(result['status'], 'success')


class TestGenerateImageIntegration(unittest.TestCase):
    """
    Test generate_image function as called by Initiative Content Creator.

    The frontend (generate-ai-images.ts) uses this for:
    - Standard image generation with brand guidelines
    - Character-consistent generation via Nano Banana
    """

    def _setup_mock_generate_response(self, mock_genai, num_images=1):
        """Helper to set up mock generate response"""
        mock_response = MagicMock()
        mock_images = []
        for i in range(num_images):
            mock_image = MagicMock()
            mock_image.image.image_bytes = f"generated_image_{i}".encode()
            mock_images.append(mock_image)
        mock_response.generated_images = mock_images
        mock_genai.models.generate_images.return_value = mock_response

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_image_all_params(self, mock_upload, mock_genai):
        """Test generate_image with all parameters"""
        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai)

        from tools.media_tools import generate_image

        result = generate_image(
            prompt="A beautiful product shot",
            brand_id="test_brand",
            aspect_ratio="16:9",
            number_of_images=2,
            person_generation="allow_adult",
            safety_filter_level="block_medium_and_above",
            output_mime_type="image/png"
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_image_response_consistency(self, mock_upload, mock_genai):
        """Test generate_image response matches nano_banana format"""
        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai)

        from tools.media_tools import generate_image

        result = generate_image(prompt="Test image")

        # Same fields as nano_banana for frontend consistency
        required_fields = ['status', 'message', 'format', 'prompt', 'image_url', 'image_urls']
        for field in required_fields:
            self.assertIn(field, result, f"Missing required field: {field}")


if __name__ == '__main__':
    unittest.main()
