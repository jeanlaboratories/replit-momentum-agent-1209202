"""
Integration Tests for Image Gallery Endpoints

Tests the /media/nano-banana endpoint that the Image Gallery uses for:
1. Image editing (Nano Banana / Gemini Image)
2. Character-consistent image generation
3. Multi-image composition

These tests verify:
- Endpoint response format (camelCase for frontend)
- All parameters are passed correctly
- Error handling
- Response transformation
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

from tools.media_tools import nano_banana


# =============================================================================
# IMAGE GALLERY - NANO BANANA ENDPOINT TESTS
# =============================================================================

class TestImageGalleryNanoBananaEndpoint(unittest.TestCase):
    """
    Test the Nano Banana endpoint behavior for Image Gallery.

    The Image Gallery uses /media/nano-banana for:
    - Editing uploaded images
    - Character-consistent generation
    - Multi-image composition
    """

    def _setup_mock_edit_response(self, mock_genai):
        """Helper to set up standard mock response"""
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image_data"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

    # -------------------------------------------------------------------------
    # Basic Image Editing (Image Gallery Edit Feature)
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_edit_image_from_gallery(self, mock_upload, mock_genai):
        """Test editing an image from the gallery"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        # Simulate gallery sending base64 image
        image_data = base64.b64encode(b"gallery_image").decode('utf-8')

        result = nano_banana(
            prompt="Make this image brighter and add more contrast",
            image_url=image_data,
            mode="edit"
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)
        # Verify the result format matches frontend expectations
        self.assertEqual(result['image_url'], result['image_urls'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.download_from_firebase_storage')
    @patch('tools.media_tools.is_firebase_storage_url')
    def test_edit_image_from_firebase_url(self, mock_is_firebase, mock_download, mock_upload, mock_genai):
        """Test editing image using Firebase Storage URL"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        # Mock Firebase Storage URL detection and download
        mock_is_firebase.return_value = True
        mock_download.return_value = (b"downloaded_image", "image/png")

        result = nano_banana(
            prompt="Remove the background",
            image_url="https://storage.googleapis.com/bucket/image.png"
        )

        self.assertEqual(result['status'], 'success')
        mock_download.assert_called_once()

    # -------------------------------------------------------------------------
    # Character-Consistent Image Generation
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_character_consistent_generation(self, mock_upload, mock_genai):
        """Test character-consistent image generation (used for campaigns)"""
        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_edit_response(mock_genai)

        # Character sheet as reference
        char_sheet = base64.b64encode(b"character_sheet").decode('utf-8')

        result = nano_banana(
            prompt="Generate the character in a beach scene",
            reference_images=char_sheet,
            aspect_ratio="16:9",
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_character_references(self, mock_upload, mock_genai):
        """Test generation with multiple character reference images"""
        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_edit_response(mock_genai)

        # Multiple character references (comma-separated as per ADK format)
        refs = ",".join([
            base64.b64encode(b"char_front").decode('utf-8'),
            base64.b64encode(b"char_side").decode('utf-8'),
            base64.b64encode(b"char_back").decode('utf-8')
        ])

        result = nano_banana(
            prompt="Generate the character running in the park",
            reference_images=refs,
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')

        # Verify multiple image parts were passed
        call_args = mock_genai.models.generate_content.call_args
        contents = call_args[1]['contents']
        # Should have reference images + prompt text
        self.assertGreater(len(contents), 1)

    # -------------------------------------------------------------------------
    # Multi-Image Composition
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_compose_multiple_images(self, mock_upload, mock_genai):
        """Test composing multiple images together"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        # Multiple images to compose
        images = ",".join([
            base64.b64encode(b"background").decode('utf-8'),
            base64.b64encode(b"product").decode('utf-8'),
            base64.b64encode(b"logo").decode('utf-8')
        ])

        result = nano_banana(
            prompt="Compose these elements into a product advertisement",
            reference_images=images,
            mode="compose"
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_compose_with_main_image_and_references(self, mock_upload, mock_genai):
        """Test composing with a main image and additional references"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        main_image = base64.b64encode(b"main_scene").decode('utf-8')
        refs = ",".join([
            base64.b64encode(b"overlay1").decode('utf-8'),
            base64.b64encode(b"overlay2").decode('utf-8')
        ])

        result = nano_banana(
            prompt="Add these elements to the main scene",
            image_url=main_image,
            reference_images=refs,
            mode="compose"
        )

        self.assertEqual(result['status'], 'success')

    # -------------------------------------------------------------------------
    # Aspect Ratio Support for Gallery
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_gallery_aspect_ratios(self, mock_upload, mock_genai):
        """Test all aspect ratios supported by Image Gallery"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_edit_response(mock_genai)

        # Common aspect ratios used in Image Gallery
        gallery_ratios = [
            '1:1',    # Square (default)
            '16:9',   # Landscape
            '9:16',   # Portrait/Story
            '4:3',    # Standard
            '3:2',    # Photo
        ]

        for ratio in gallery_ratios:
            result = nano_banana(
                prompt=f"Generate in {ratio}",
                aspect_ratio=ratio
            )
            self.assertEqual(result['status'], 'success', f"Failed for {ratio}")

    # -------------------------------------------------------------------------
    # Mask-Based Editing (Inpainting)
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_mask_inpainting(self, mock_upload, mock_genai):
        """Test mask-based inpainting for selective edits"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        image = base64.b64encode(b"original_image").decode('utf-8')
        mask = base64.b64encode(b"mask_image").decode('utf-8')

        result = nano_banana(
            prompt="Replace the masked area with a tree",
            image_url=image,
            mask_url=mask
        )

        self.assertEqual(result['status'], 'success')

    # -------------------------------------------------------------------------
    # Response Format Verification
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_response_contains_all_required_fields(self, mock_upload, mock_genai):
        """Test response contains all fields needed by frontend"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_edit_response(mock_genai)

        result = nano_banana(prompt="Test")

        # Required fields for frontend
        required_fields = ['status', 'message', 'format', 'prompt']
        for field in required_fields:
            self.assertIn(field, result, f"Missing field: {field}")

        # Should have either URL or base64 data
        self.assertTrue(
            'image_url' in result or 'image_data' in result,
            "Must have image_url or image_data"
        )

        # Should have array format as well
        self.assertTrue(
            'image_urls' in result or 'image_data_list' in result,
            "Must have image_urls or image_data_list"
        )

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_fallback_format(self, mock_upload, mock_genai):
        """Test base64 fallback response format"""
        mock_upload.return_value = ""  # Force base64 fallback
        self._setup_mock_edit_response(mock_genai)

        result = nano_banana(prompt="Test")

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')
        self.assertIn('image_data', result)
        self.assertIn('image_data_list', result)

        # Verify base64 is valid
        decoded = base64.b64decode(result['image_data'])
        self.assertEqual(decoded, b"edited_image_data")

    # -------------------------------------------------------------------------
    # Error Handling
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_invalid_image_url_error(self, mock_upload, mock_genai):
        """Test error handling for invalid image URL (filename instead of URL)"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_edit_response(mock_genai)

        # Common mistake: passing filename instead of full URL
        result = nano_banana(
            prompt="Edit this",
            image_url="photo.jpg"  # This should fail
        )

        self.assertEqual(result['status'], 'error')
        self.assertIn('filename', result['error'].lower())

    @patch('tools.media_tools.genai_client')
    def test_api_error_handling(self, mock_genai):
        """Test handling of API errors"""
        mock_genai.models.generate_content.side_effect = Exception("API Error")

        result = nano_banana(prompt="Test")

        self.assertEqual(result['status'], 'error')
        self.assertIn('API Error', result['error'])

    @patch('tools.media_tools.genai_client')
    def test_empty_response_handling(self, mock_genai):
        """Test handling when API returns no image"""
        mock_response = MagicMock()
        mock_response.candidates = []
        mock_genai.models.generate_content.return_value = mock_response

        result = nano_banana(prompt="Test")

        self.assertEqual(result['status'], 'error')
        self.assertIn('No edited image', result['error'])

    # -------------------------------------------------------------------------
    # Person Generation Control
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_person_generation_control(self, mock_upload, mock_genai):
        """Test person generation parameter"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_edit_response(mock_genai)

        # Test allow_all
        result = nano_banana(
            prompt="A group of people",
            person_generation="allow_all"
        )
        self.assertEqual(result['status'], 'success')

        # Test allow_adult
        result = nano_banana(
            prompt="Professional portrait",
            person_generation="allow_adult"
        )
        self.assertEqual(result['status'], 'success')


# =============================================================================
# IMAGE GALLERY - GENERATE IMAGE ENDPOINT TESTS
# =============================================================================

class TestImageGalleryGenerateImageEndpoint(unittest.TestCase):
    """
    Test the Image Generation endpoint behavior for Image Gallery.

    Note: Image Gallery currently uses Genkit flow (TypeScript) for generation,
    but these tests verify the Python generate_image function that could be
    used via a unified endpoint.
    """

    def _setup_mock_generate_response(self, mock_genai, num_images=1):
        """Helper to set up mock response"""
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
    def test_basic_generation(self, mock_upload, mock_genai):
        """Test basic image generation"""
        from tools.media_tools import generate_image

        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai)

        result = generate_image(prompt="A beautiful sunset over the ocean")

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_images_generation(self, mock_upload, mock_genai):
        """Test generating multiple images (for variations)"""
        from tools.media_tools import generate_image

        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai, num_images=4)

        result = generate_image(
            prompt="Product photo variations",
            number_of_images=4
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['image_urls']), 4)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_imagen_parameters(self, mock_upload, mock_genai):
        """Test all Imagen 4.0 parameters"""
        from tools.media_tools import generate_image

        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai)

        result = generate_image(
            prompt="Professional headshot",
            aspect_ratio="3:4",
            number_of_images=1,
            person_generation="allow_adult",
            safety_filter_level="block_only_high",
            output_mime_type="image/png"
        )

        self.assertEqual(result['status'], 'success')

        # Verify config params were passed
        call_args = mock_genai.models.generate_images.call_args
        config = call_args[1]['config']

        self.assertEqual(config['aspect_ratio'], '3:4')
        self.assertEqual(config['person_generation'], 'allow_adult')


# =============================================================================
# UNIFIED ENDPOINT TESTS (Future API Design)
# =============================================================================

class TestUnifiedImageEndpoint(unittest.TestCase):
    """
    Tests for unified image endpoint design.

    These tests verify that both generate_image and nano_banana
    return consistent response formats that the Image Gallery can use.
    """

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_consistent_response_format_generation(self, mock_upload, mock_genai):
        """Test generate_image returns consistent format"""
        from tools.media_tools import generate_image

        mock_upload.return_value = "https://storage.example.com/image.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"generated"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="Test")

        # Common response structure
        self.assertIn('status', result)
        self.assertIn('message', result)
        self.assertIn('format', result)
        self.assertIn('prompt', result)

        # Both singular and array formats
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_consistent_response_format_editing(self, mock_upload, mock_genai):
        """Test nano_banana returns consistent format"""
        mock_upload.return_value = "https://storage.example.com/edited.png"

        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

        result = nano_banana(prompt="Test")

        # Same common response structure
        self.assertIn('status', result)
        self.assertIn('message', result)
        self.assertIn('format', result)
        self.assertIn('prompt', result)

        # Both singular and array formats
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_fallback_consistent(self, mock_upload, mock_genai):
        """Test base64 fallback is consistent across both functions"""
        from tools.media_tools import generate_image

        mock_upload.return_value = ""  # Force base64 fallback

        # Setup for generate_image
        mock_response_gen = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"generated"
        mock_response_gen.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response_gen

        result_gen = generate_image(prompt="Test")

        # Setup for nano_banana
        mock_response_edit = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response_edit.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response_edit

        result_edit = nano_banana(prompt="Test")

        # Both should have same structure
        self.assertEqual(result_gen['format'], 'base64')
        self.assertEqual(result_edit['format'], 'base64')

        self.assertIn('image_data', result_gen)
        self.assertIn('image_data', result_edit)

        self.assertIn('image_data_list', result_gen)
        self.assertIn('image_data_list', result_edit)


if __name__ == '__main__':
    unittest.main()
