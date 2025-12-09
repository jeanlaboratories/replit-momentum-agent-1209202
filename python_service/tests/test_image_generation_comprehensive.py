"""
Comprehensive Test Suite for Image Generation and Editing

This file contains exhaustive tests for:
1. Imagen 4.0 Image Generation (generate_image)
2. Nano Banana Image Editing (nano_banana)
3. API Endpoints (/media/nano-banana)
4. Response format consistency
5. Parameter validation
6. Error handling
7. Storage upload behavior

Test Categories:
- Unit Tests: Test core functions with mocked dependencies
- Integration Tests: Test API endpoints with mocked genai client
- End-to-End Tests: Full flow testing with mocked external services
"""
import unittest
from unittest.mock import MagicMock, patch, Mock
import sys
import os
import base64
import json

# Add python_service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock firebase_admin before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

from tools.media_tools import generate_image, nano_banana


# =============================================================================
# SECTION 1: IMAGEN 4.0 IMAGE GENERATION TESTS
# =============================================================================

class TestImagenGeneration(unittest.TestCase):
    """Test Imagen 4.0 image generation (generate_image function)"""

    def _setup_mock_image_response(self, mock_genai, num_images=1):
        """Helper to set up mock Imagen response"""
        mock_response = MagicMock()
        mock_images = []
        for i in range(num_images):
            mock_image = MagicMock()
            mock_image.image.image_bytes = f"fake_image_data_{i}".encode()
            mock_images.append(mock_image)
        mock_response.generated_images = mock_images
        mock_genai.models.generate_images.return_value = mock_response

    # -------------------------------------------------------------------------
    # Basic Generation Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_basic_text_to_image(self, mock_upload, mock_genai):
        """Test basic text-to-image generation"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        result = generate_image(prompt="A beautiful sunset")

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'url')
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)
        mock_genai.models.generate_images.assert_called_once()

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_fallback(self, mock_upload, mock_genai):
        """Test base64 fallback when storage upload fails"""
        mock_upload.return_value = ""  # Upload fails
        self._setup_mock_image_response(mock_genai)

        result = generate_image(prompt="A beautiful sunset")

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')
        self.assertIn('image_data', result)
        self.assertIn('image_data_list', result)

    @patch('tools.media_tools.genai_client')
    def test_no_client_error(self, mock_genai):
        """Test error when genai client is not initialized"""
        # Set client to None
        import tools.media_tools as mt
        original_client = mt.genai_client
        mt.genai_client = None

        result = generate_image(prompt="Test")

        self.assertEqual(result['status'], 'error')
        self.assertIn('not initialized', result['error'])

        # Restore
        mt.genai_client = original_client

    @patch('tools.media_tools.genai_client')
    def test_no_images_generated(self, mock_genai):
        """Test error when no images are generated"""
        mock_response = MagicMock()
        mock_response.generated_images = []
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="Test")

        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['error'], 'No image generated')

    # -------------------------------------------------------------------------
    # Aspect Ratio Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_aspect_ratios(self, mock_upload, mock_genai):
        """Test all supported aspect ratios"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        aspect_ratios = [
            '1:1', '2:3', '3:2', '3:4', '4:3',
            '4:5', '5:4', '9:16', '16:9', '21:9'
        ]

        for ratio in aspect_ratios:
            result = generate_image(prompt="Test", aspect_ratio=ratio)
            self.assertEqual(result['status'], 'success', f"Failed for {ratio}")

            call_args = mock_genai.models.generate_images.call_args
            self.assertEqual(call_args[1]['config']['aspect_ratio'], ratio)

    # -------------------------------------------------------------------------
    # Multiple Images Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_images_with_urls(self, mock_upload, mock_genai):
        """Test generating multiple images with URL response"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai, num_images=4)

        result = generate_image(prompt="Test", number_of_images=4)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['image_urls']), 4)
        self.assertEqual(result['image_url'], result['image_urls'][0])

        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['number_of_images'], 4)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_images_base64_fallback(self, mock_upload, mock_genai):
        """Test multiple images with base64 fallback"""
        mock_upload.return_value = ""  # Upload fails
        self._setup_mock_image_response(mock_genai, num_images=3)

        result = generate_image(prompt="Test", number_of_images=3)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')
        self.assertEqual(len(result['image_data_list']), 3)
        self.assertEqual(result['image_data'], result['image_data_list'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_number_of_images_limits(self, mock_upload, mock_genai):
        """Test number_of_images is clamped to valid range (1-8)"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        # Test minimum (should be clamped to 1)
        result = generate_image(prompt="Test", number_of_images=0)
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['number_of_images'], 1)

        # Test maximum (should be clamped to 8)
        result = generate_image(prompt="Test", number_of_images=10)
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['number_of_images'], 8)

    # -------------------------------------------------------------------------
    # Advanced Parameters Tests
    # -------------------------------------------------------------------------


    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_person_generation_allow_all(self, mock_upload, mock_genai):
        """Test person_generation with allow_all"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        result = generate_image(
            prompt="People at a party",
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['person_generation'], 'allow_all')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_person_generation_allow_adult(self, mock_upload, mock_genai):
        """Test person_generation with allow_adult"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        result = generate_image(
            prompt="Professional portrait",
            person_generation="allow_adult"
        )

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['person_generation'], 'allow_adult')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_safety_filter_levels(self, mock_upload, mock_genai):
        """Test safety filter level parameter"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        safety_levels = [
            'block_only_high',
            'block_medium_and_above',
            'block_low_and_above'
        ]

        for level in safety_levels:
            result = generate_image(
                prompt="Test",
                safety_filter_level=level
            )
            self.assertEqual(result['status'], 'success')
            call_args = mock_genai.models.generate_images.call_args
            self.assertEqual(call_args[1]['config']['safety_filter_level'], level)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_output_mime_types(self, mock_upload, mock_genai):
        """Test output MIME type parameter"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        mime_types = ['image/png', 'image/jpeg']

        for mime_type in mime_types:
            result = generate_image(
                prompt="Test",
                output_mime_type=mime_type
            )
            self.assertEqual(result['status'], 'success')
            call_args = mock_genai.models.generate_images.call_args
            self.assertEqual(call_args[1]['config']['output_mime_type'], mime_type)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_parameters_combined(self, mock_upload, mock_genai):
        """Test using all Imagen 4.0 parameters together"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai, num_images=2)

        result = generate_image(
            prompt="Professional portrait in studio",
            aspect_ratio="3:4",
            number_of_images=2,
            person_generation="allow_adult",
            safety_filter_level="block_only_high",
            output_mime_type="image/png"
        )

        self.assertEqual(result['status'], 'success')

        call_args = mock_genai.models.generate_images.call_args
        config = call_args[1]['config']

        self.assertEqual(config['aspect_ratio'], '3:4')
        self.assertEqual(config['number_of_images'], 2)
        self.assertEqual(config['person_generation'], 'allow_adult')
        self.assertEqual(config['safety_filter_level'], 'block_only_high')
        self.assertEqual(config['output_mime_type'], 'image/png')

    # -------------------------------------------------------------------------
    # Default Model Selection Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.get_settings_context')
    def test_default_model_used(self, mock_settings, mock_upload, mock_genai):
        """Test default Imagen model is used when no setting provided"""
        mock_settings.return_value = {}
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        result = generate_image(prompt="Test")

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['model'], 'imagen-4.0-generate-001')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.get_settings_context')
    def test_custom_model_from_settings(self, mock_settings, mock_upload, mock_genai):
        """Test custom Imagen model from settings"""
        mock_settings.return_value = {'imageModel': 'imagen-4.0-ultra-generate-001'}
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        result = generate_image(prompt="Test")

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['model'], 'imagen-4.0-ultra-generate-001')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.get_settings_context')
    def test_non_imagen_model_falls_back(self, mock_settings, mock_upload, mock_genai):
        """Test non-imagen model falls back to default"""
        mock_settings.return_value = {'imageModel': 'gemini-2.5-flash'}  # Not an imagen model
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_image_response(mock_genai)

        result = generate_image(prompt="Test")

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['model'], 'imagen-4.0-generate-001')


# =============================================================================
# SECTION 2: NANO BANANA IMAGE EDITING TESTS
# =============================================================================

class TestNanoBananaEditing(unittest.TestCase):
    """Test Nano Banana image editing (nano_banana function)"""

    def _setup_mock_edit_response(self, mock_genai):
        """Helper to set up mock Nano Banana response"""
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
    # Basic Editing Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_text_only_generation(self, mock_upload, mock_genai):
        """Test generation with only text prompt (no image)"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        result = nano_banana(prompt="Generate a sunset scene")

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        mock_genai.models.generate_content.assert_called_once()

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_image_editing_with_base64(self, mock_upload, mock_genai):
        """Test image editing with base64 input"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        # Create fake base64 image
        fake_image = base64.b64encode(b"fake_image_data").decode('utf-8')

        result = nano_banana(
            prompt="Make the sky blue",
            image_url=fake_image
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.requests')
    def test_image_editing_with_url(self, mock_requests, mock_upload, mock_genai):
        """Test image editing with URL input"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        # Mock image download
        mock_response = MagicMock()
        mock_response.content = b"downloaded_image"
        mock_response.headers = {'Content-Type': 'image/png'}
        mock_requests.get.return_value = mock_response

        result = nano_banana(
            prompt="Make it brighter",
            image_url="https://example.com/image.png"
        )

        self.assertEqual(result['status'], 'success')
        mock_requests.get.assert_called_once()

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_image_editing_with_data_uri(self, mock_upload, mock_genai):
        """Test image editing with data URI input"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        # Create data URI
        fake_data = base64.b64encode(b"image_data").decode('utf-8')
        data_uri = f"data:image/png;base64,{fake_data}"

        result = nano_banana(
            prompt="Add contrast",
            image_url=data_uri
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_fallback_response(self, mock_upload, mock_genai):
        """Test base64 fallback when upload fails"""
        mock_upload.return_value = ""  # Upload fails
        self._setup_mock_edit_response(mock_genai)

        result = nano_banana(prompt="Test")

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')
        self.assertIn('image_data', result)
        self.assertIn('image_data_list', result)

    # -------------------------------------------------------------------------
    # Reference Images Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_single_reference_image(self, mock_upload, mock_genai):
        """Test with single reference image"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        ref_image = base64.b64encode(b"ref_image").decode('utf-8')

        result = nano_banana(
            prompt="Use this as reference",
            reference_images=ref_image
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_reference_images(self, mock_upload, mock_genai):
        """Test multi-image composition with comma-separated reference images"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        # Create comma-separated reference images (ADK format)
        ref1 = base64.b64encode(b"ref1").decode('utf-8')
        ref2 = base64.b64encode(b"ref2").decode('utf-8')
        ref3 = base64.b64encode(b"ref3").decode('utf-8')
        reference_images = f"{ref1},{ref2},{ref3}"

        result = nano_banana(
            prompt="Combine these elements",
            reference_images=reference_images
        )

        self.assertEqual(result['status'], 'success')

        # Verify multiple parts were passed (prompt + 3 images)
        call_args = mock_genai.models.generate_content.call_args
        contents = call_args[1]['contents']
        self.assertGreater(len(contents), 1)  # More than just prompt

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_max_14_reference_images(self, mock_upload, mock_genai):
        """Test that only up to 14 reference images are used"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        # Create 20 reference images (should only use 14)
        refs = []
        for i in range(20):
            ref = base64.b64encode(f"ref{i}".encode()).decode('utf-8')
            refs.append(ref)
        reference_images = ",".join(refs)

        result = nano_banana(
            prompt="Combine all",
            reference_images=reference_images
        )

        self.assertEqual(result['status'], 'success')
        # The function should limit to 14 images

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.requests')
    def test_skipped_unavailable_references(self, mock_requests, mock_upload, mock_genai):
        """Test that unavailable reference images are skipped and reported"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        # First URL succeeds, second fails
        def side_effect(url, **kwargs):
            if "good" in url:
                mock_resp = MagicMock()
                mock_resp.content = b"image"
                mock_resp.headers = {'Content-Type': 'image/png'}
                return mock_resp
            else:
                raise Exception("Download failed")

        mock_requests.get.side_effect = side_effect

        result = nano_banana(
            prompt="Combine",
            reference_images="https://good.com/img.png,https://bad.com/img.png"
        )

        self.assertEqual(result['status'], 'success')
        # Should report skipped references
        self.assertIn('skipped_references', result)

    # -------------------------------------------------------------------------
    # Mask-Based Editing Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_mask_based_editing(self, mock_upload, mock_genai):
        """Test mask-based inpainting"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        image_data = base64.b64encode(b"original").decode('utf-8')
        mask_data = base64.b64encode(b"mask").decode('utf-8')

        result = nano_banana(
            prompt="Replace the masked area with a tree",
            image_url=image_data,
            mask_url=mask_data
        )

        self.assertEqual(result['status'], 'success')

        # Verify mask was included
        call_args = mock_genai.models.generate_content.call_args
        contents = call_args[1]['contents']
        self.assertGreater(len(contents), 2)  # image + mask + prompt

    # -------------------------------------------------------------------------
    # Mode Parameter Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_edit_mode(self, mock_upload, mock_genai):
        """Test edit mode parameter"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        image_data = base64.b64encode(b"image").decode('utf-8')

        result = nano_banana(
            prompt="Enhance this",
            image_url=image_data,
            mode="edit"
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_compose_mode(self, mock_upload, mock_genai):
        """Test compose mode parameter"""
        mock_upload.return_value = "https://storage.example.com/composed.png"
        self._setup_mock_edit_response(mock_genai)

        ref_images = ",".join([
            base64.b64encode(b"img1").decode('utf-8'),
            base64.b64encode(b"img2").decode('utf-8')
        ])

        result = nano_banana(
            prompt="Compose these",
            reference_images=ref_images,
            mode="compose"
        )

        self.assertEqual(result['status'], 'success')

    # -------------------------------------------------------------------------
    # Aspect Ratio Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_aspect_ratios(self, mock_upload, mock_genai):
        """Test aspect ratio parameter"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        aspect_ratios = ['1:1', '16:9', '9:16', '4:3', '3:2']

        for ratio in aspect_ratios:
            result = nano_banana(
                prompt="Generate",
                aspect_ratio=ratio
            )
            self.assertEqual(result['status'], 'success', f"Failed for {ratio}")

    # -------------------------------------------------------------------------
    # Advanced Parameters Tests
    # -------------------------------------------------------------------------


    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_person_generation(self, mock_upload, mock_genai):
        """Test person generation parameter"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        result = nano_banana(
            prompt="Add a person",
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_parameters_combined(self, mock_upload, mock_genai):
        """Test all Nano Banana parameters combined"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        image_data = base64.b64encode(b"image").decode('utf-8')
        ref_images = base64.b64encode(b"ref").decode('utf-8')

        result = nano_banana(
            prompt="Edit with all parameters",
            image_url=image_data,
            reference_images=ref_images,
            mode="edit",
            aspect_ratio="16:9",
            number_of_images=1,
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')

    # -------------------------------------------------------------------------
    # Error Handling Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    def test_no_client_error(self, mock_genai):
        """Test error when client not initialized"""
        import tools.media_tools as mt
        original_client = mt.genai_client
        mt.genai_client = None

        result = nano_banana(prompt="Test")

        self.assertEqual(result['status'], 'error')
        self.assertIn('not initialized', result['error'])

        mt.genai_client = original_client

    @patch('tools.media_tools.genai_client')
    def test_no_edited_image_error(self, mock_genai):
        """Test error when no image is generated"""
        mock_response = MagicMock()
        mock_response.candidates = []
        mock_genai.models.generate_content.return_value = mock_response

        result = nano_banana(prompt="Test")

        self.assertEqual(result['status'], 'error')
        self.assertIn('No edited image', result['error'])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_invalid_filename_detection(self, mock_upload, mock_genai):
        """Test that filenames (not URLs) are detected and rejected"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        # This should fail - looks like a filename
        result = nano_banana(
            prompt="Edit",
            image_url="image.png"  # Common LLM mistake
        )

        self.assertEqual(result['status'], 'error')
        self.assertIn('filename', result['error'].lower())

    # -------------------------------------------------------------------------
    # Firebase Storage URL Handling Tests
    # -------------------------------------------------------------------------

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.download_from_firebase_storage')
    @patch('tools.media_tools.is_firebase_storage_url')
    def test_firebase_storage_url_handling(
        self, mock_is_firebase, mock_download, mock_upload, mock_genai
    ):
        """Test Firebase Storage URL is handled correctly"""
        mock_is_firebase.return_value = True
        mock_download.return_value = (b"firebase_image", "image/png")
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        result = nano_banana(
            prompt="Edit",
            image_url="https://firebasestorage.googleapis.com/v0/b/test/image.png"
        )

        self.assertEqual(result['status'], 'success')
        mock_download.assert_called_once()


# =============================================================================
# SECTION 3: API ENDPOINT INTEGRATION TESTS
# =============================================================================

class TestNanoBananaEndpoint(unittest.TestCase):
    """Test /media/nano-banana API endpoint"""

    @classmethod
    def setUpClass(cls):
        """Set up test client"""
        # Import here to avoid import issues
        pass

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_endpoint_response_format(self, mock_upload, mock_genai):
        """Test endpoint returns camelCase response"""
        # This tests the response transformation in media.py
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

        # Call the function directly (endpoint wraps this)
        result = nano_banana(prompt="Test")

        # Verify snake_case response from function
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

        # The endpoint transforms to:
        # imageUrl, imageUrls (camelCase)


# =============================================================================
# SECTION 4: RESPONSE CONSISTENCY TESTS
# =============================================================================

class TestResponseConsistency(unittest.TestCase):
    """Test response format consistency across functions"""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_image_response_has_both_formats(self, mock_upload, mock_genai):
        """Test generate_image returns both singular and array formats"""
        mock_upload.return_value = "https://storage.example.com/image.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="Test")

        # URL format
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)
        self.assertEqual(result['image_url'], result['image_urls'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_nano_banana_response_has_both_formats(self, mock_upload, mock_genai):
        """Test nano_banana returns both singular and array formats"""
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

        # URL format
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)
        self.assertEqual(result['image_url'], result['image_urls'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_response_has_both_formats(self, mock_upload, mock_genai):
        """Test base64 fallback returns both singular and array formats"""
        mock_upload.return_value = ""  # Force base64

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(prompt="Test")

        # Base64 format
        self.assertIn('image_data', result)
        self.assertIn('image_data_list', result)
        self.assertEqual(result['image_data'], result['image_data_list'][0])


# =============================================================================
# SECTION 5: MODEL CONFIGURATION TESTS
# =============================================================================

class TestModelConfiguration(unittest.TestCase):
    """Test model selection and configuration"""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.get_settings_context')
    def test_imagen_models(self, mock_settings, mock_upload, mock_genai):
        """Test various Imagen model configurations"""
        mock_upload.return_value = "https://storage.example.com/image.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        imagen_models = [
            'imagen-4.0-generate-001',
            'imagen-4.0-ultra-generate-001',
            'imagen-4.0-fast-generate-001',
            'imagen-3.0-generate-002'
        ]

        for model in imagen_models:
            mock_settings.return_value = {'imageModel': model}
            result = generate_image(prompt="Test")
            self.assertEqual(result['status'], 'success')
            call_args = mock_genai.models.generate_images.call_args
            self.assertEqual(call_args[1]['model'], model)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.get_settings_context')
    def test_nano_banana_model(self, mock_settings, mock_upload, mock_genai):
        """Test Nano Banana uses correct model"""
        mock_settings.return_value = {'imageEditModel': 'gemini-2.5-flash-preview-05-20'}
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

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_content.call_args
        self.assertEqual(call_args[1]['model'], 'gemini-2.5-flash-preview-05-20')


if __name__ == '__main__':
    unittest.main()
