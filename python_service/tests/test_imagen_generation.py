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

class TestImagenGeneration(unittest.TestCase):
    
    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_image_success(self, mock_upload, mock_genai):
        # Setup mock upload to fail (return empty string) so we get base64
        mock_upload.return_value = ""
        # Setup mock response
        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"fake_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

        # Call tool
        result = generate_image(prompt="A futuristic city")

        # Verify call
        mock_genai.models.generate_images.assert_called_once_with(
            model='imagen-4.0-generate-001',
            prompt="A futuristic city",
            config={
                'number_of_images': 1,
                'aspect_ratio': '1:1'
            }
        )

        # Verify result
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'base64')
        self.assertTrue(len(result['image_data']) > 0)

    @patch('tools.media_tools.genai_client')
    def test_generate_image_failure(self, mock_genai):
        # Setup mock response with no images
        mock_response = MagicMock()
        mock_response.generated_images = []
        mock_genai.models.generate_images.return_value = mock_response

        # Call tool
        result = generate_image(prompt="A futuristic city")

        # Verify result
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['error'], 'No image generated')

if __name__ == '__main__':
    unittest.main()
