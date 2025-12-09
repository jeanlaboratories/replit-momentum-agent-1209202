import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add python_service to path
sys.path.insert(0,(os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))))

# Mock firebase_admin before importing media_tools
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

from tools.media_tools import generate_image
from tools.media_tools import nano_banana

class TestImagenComprehensive(unittest.TestCase):
    """Comprehensive tests for all Imagen 4.0 features"""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_aspect_ratio_support(self, mock_upload, mock_genai):
        """Test different aspect ratio options"""
        mock_upload.return_value = "https://storage.example.com/image.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        # Test different aspect ratios
        aspect_ratios = ['1:1', '16:9', '9:16', '4:3', '3:2']
        for ratio in aspect_ratios:
            result = generate_image(
                prompt="Test image",
                aspect_ratio=ratio
            )

            self.assertEqual(result['status'], 'success')
            call_args = mock_genai.models.generate_images.call_args
            self.assertEqual(call_args[1]['config']['aspect_ratio'], ratio)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multiple_images_generation(self, mock_upload, mock_genai):
        """Test generating multiple images at once"""
        mock_upload.return_value = ""  # Force base64

        # Create 4 mock images
        mock_response = MagicMock()
        mock_images = []
        for i in range(4):
            mock_image = MagicMock()
            mock_image.image.image_bytes = f"fake_image_{i}".encode()
            mock_images.append(mock_image)
        mock_response.generated_images = mock_images
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(
            prompt="Generate variations",
            number_of_images=4
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_data_list', result)
        self.assertEqual(len(result['image_data_list']), 4)

        # Verify config
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['number_of_images'], 4)


    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_person_generation_control(self, mock_upload, mock_genai):
        """Test person generation parameter"""
        mock_upload.return_value = "https://storage.example.com/image.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(
            prompt="People at a party",
            person_generation="allow_all"
        )

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        self.assertEqual(call_args[1]['config']['person_generation'], 'allow_all')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_all_parameters_combined(self, mock_upload, mock_genai):
        """Test using all parameters together"""
        mock_upload.return_value = "https://storage.example.com/image.png"

        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        result = generate_image(
            prompt="Professional portrait",
            aspect_ratio="3:4",
            number_of_images=2,
            person_generation="allow_adult"
        )

        self.assertEqual(result['status'], 'success')
        call_args = mock_genai.models.generate_images.call_args
        config = call_args[1]['config']

        self.assertEqual(config['aspect_ratio'], '3:4')
        self.assertEqual(config['number_of_images'], 2)
        self.assertEqual(config['person_generation'], 'allow_adult')


class TestNanoBananaComprehensive(unittest.TestCase):
    """Comprehensive tests for Nano Banana (Imagen 3) image editing"""

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    @patch('tools.media_tools.requests')
    def test_single_image_editing(self, mock_requests, mock_upload, mock_genai):
        """Test basic image editing with single image"""
        mock_upload.return_value = "https://storage.example.com/edited.png"

        # Mock image download
        mock_response_img = MagicMock()
        mock_response_img.content = b"original_image"
        mock_response_img.headers = {'Content-Type': 'image/png'}
        mock_requests.get.return_value = mock_response_img

        # Mock genai response
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

        result = nano_banana(
            prompt="Make the sky blue",
            image_url="https://example.com/original.png"
        )

        self.assertEqual(result['status'], 'success')
        self.assertIn('image_url', result)
        mock_genai.models.generate_content.assert_called_once()

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_multi_image_composition(self, mock_upload, mock_genai):
        """Test multi-image composition with reference images"""
        mock_upload.return_value = "https://storage.example.com/composed.png"

        # Mock genai response
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"composed_image"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

        import base64
        # reference_images is now a comma-separated string
        ref_images = ",".join([
            base64.b64encode(b"ref1").decode('utf-8'),
            base64.b64encode(b"ref2").decode('utf-8'),
            base64.b64encode(b"ref3").decode('utf-8')
        ])

        result = nano_banana(
            prompt="Combine these elements into one image",
            reference_images=ref_images
        )

        self.assertEqual(result['status'], 'success')
        # Should have called with multiple image parts
        call_args = mock_genai.models.generate_content.call_args
        self.assertIsNotNone(call_args)

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_mask_based_editing(self, mock_upload, mock_genai):
        """Test mask-based editing"""
        mock_upload.return_value = "https://storage.example.com/edited.png"

        # Mock genai response
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

        import base64
        image_data = base64.b64encode(b"original").decode('utf-8')
        mask_data = base64.b64encode(b"mask").decode('utf-8')

        result = nano_banana(
            prompt="Replace the masked area with a tree",
            image_url=image_data,
            mask_url=mask_data
        )

        self.assertEqual(result['status'], 'success')
        mock_genai.models.generate_content.assert_called_once()


if __name__ == '__main__':
    unittest.main()
