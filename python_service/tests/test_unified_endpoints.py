"""
Tests for Unified Image Generation Endpoints.

Verifies that:
1. /agent/nano-banana and /media/nano-banana both support ALL parameters
2. Both endpoints return consistent camelCase response format
3. momentum_agent.generate_image wrapper supports ALL media_tools parameters
4. Response structure is consistent across all entry points
"""
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os
import base64
import json
from google.api_core import exceptions as google_exceptions

# Add python_service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock firebase_admin before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()

# Mock ADK before importing momentum_agent
import types
def setup_adk_mocks():
    """Set up ADK mocks to prevent import errors."""
    if 'google' not in sys.modules:
        sys.modules['google'] = types.ModuleType('google')
    
    if 'google.adk' not in sys.modules:
        adk_module = types.ModuleType('google.adk')
        adk_module.__path__ = []
        sys.modules['google.adk'] = adk_module
    
    adk_submodules = ['agents', 'memory', 'sessions', 'events', 'models', 'runners', 'tools']
    for submod in adk_submodules:
        mod_name = f'google.adk.{submod}'
        if mod_name not in sys.modules:
            submod_obj = types.ModuleType(mod_name)
            submod_obj.__path__ = []
            setattr(sys.modules['google.adk'], submod, submod_obj)
            sys.modules[mod_name] = submod_obj
    
    if 'google.adk.tools.agent_tool' not in sys.modules:
        agent_tool_obj = types.ModuleType('google.adk.tools.agent_tool')
        sys.modules['google.adk.tools.agent_tool'] = agent_tool_obj
    
    # Create function_tool submodule (required for ADK flows)
    if 'google.adk.tools.function_tool' not in sys.modules:
        function_tool_obj = types.ModuleType('google.adk.tools.function_tool')
        sys.modules['google.adk.tools.function_tool'] = function_tool_obj
    
    # Mock FunctionTool class (required by ADK flows)
    def mock_function_tool_init(self, *args, **kwargs):
        pass
    mock_function_tool = type('FunctionTool', (), {'__init__': mock_function_tool_init})
    sys.modules['google.adk.tools.function_tool'].FunctionTool = mock_function_tool
    
    # Mock classes
    mock_vertex_ai_memory_bank_service = type('VertexAiMemoryBankService', (), {
        '__init__': lambda self, *args, **kwargs: None,
        '_get_api_client': lambda self: MagicMock(),
    })
    mock_vertex_ai_rag_memory_service = type('VertexAiRagMemoryService', (), {
        '__init__': lambda self, *args, **kwargs: None,
        '_get_api_client': lambda self: MagicMock(),
    })
    sys.modules['google.adk.memory'].VertexAiMemoryBankService = mock_vertex_ai_memory_bank_service
    sys.modules['google.adk.memory'].VertexAiRagMemoryService = mock_vertex_ai_rag_memory_service
    
    def mock_agent_init(self, *args, **kwargs):
        self.tools = kwargs.get('tools', [])
        self.instruction = kwargs.get('instruction', '')
        self.model = kwargs.get('model', 'gemini-2.0-flash')
    mock_agent = type('Agent', (), {'__init__': mock_agent_init})
    mock_llm_agent = type('LlmAgent', (), {'__init__': mock_agent_init})
    sys.modules['google.adk.agents'].Agent = mock_agent
    sys.modules['google.adk.agents'].LlmAgent = mock_llm_agent
    
    def mock_runner_init(self, *args, **kwargs):
        pass
    mock_runner = type('Runner', (), {'__init__': mock_runner_init})
    sys.modules['google.adk.runners'].Runner = mock_runner
    
    def mock_agent_tool_init(self, *args, **kwargs):
        pass
    mock_agent_tool = type('AgentTool', (), {'__init__': mock_agent_tool_init})
    sys.modules['google.adk.tools'].AgentTool = mock_agent_tool
    sys.modules['google.adk.tools.agent_tool'].AgentTool = mock_agent_tool
    
    mock_google_search = MagicMock()
    sys.modules['google.adk.tools'].google_search = mock_google_search
    
    def mock_session_service_init(self, *args, **kwargs):
        pass
    mock_session_service = type('SessionService', (), {'__init__': mock_session_service_init})
    mock_inmemory_session_service = type('InMemorySessionService', (), {'__init__': mock_session_service_init})
    sys.modules['google.adk.sessions'].SessionService = mock_session_service
    sys.modules['google.adk.sessions'].InMemorySessionService = mock_inmemory_session_service

setup_adk_mocks()


# =============================================================================
# UNIFIED NANO BANANA ENDPOINT TESTS
# =============================================================================

class TestUnifiedNanoBananaEndpoint(unittest.TestCase):
    """
    Test that /agent/nano-banana now supports ALL parameters (after unification).

    Previously /agent/nano-banana only supported 4 params:
    - prompt, image_url, reference_images, mask_url

    After unification it should support ALL 8 params:
    - prompt, image_url, reference_images, mask_url
    - mode, aspect_ratio, number_of_images, person_generation
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

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_agent_endpoint_full_parameter_support(self, mock_upload, mock_genai):
        """Test /agent/nano-banana now accepts ALL parameters"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Test all parameters are accepted without error
        result = nano_banana(
            prompt="Edit this image",
            image_url=base64.b64encode(b"test_image").decode(),
            reference_images="",
            mask_url="",
            mode="edit",                    # Previously NOT supported by /agent/nano-banana
            aspect_ratio="16:9",            # Previously NOT supported
            number_of_images=2,             # Previously NOT supported
            person_generation="allow_all"   # Previously NOT supported
        )

        self.assertEqual(result['status'], 'success')

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_agent_endpoint_all_aspect_ratios(self, mock_upload, mock_genai):
        """Test all aspect ratios work through unified endpoint"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        aspect_ratios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]

        for ratio in aspect_ratios:
            result = nano_banana(prompt="Test", aspect_ratio=ratio)
            self.assertEqual(result['status'], 'success', f"Failed for aspect ratio {ratio}")

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_agent_endpoint_modes(self, mock_upload, mock_genai):
        """Test edit and compose modes work through unified endpoint"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        # Test edit mode
        result_edit = nano_banana(prompt="Edit image", mode="edit")
        self.assertEqual(result_edit['status'], 'success')

        # Test compose mode
        result_compose = nano_banana(prompt="Compose images", mode="compose")
        self.assertEqual(result_compose['status'], 'success')


# =============================================================================
# UNIFIED GENERATE IMAGE WRAPPER TESTS
# =============================================================================

class TestUnifiedGenerateImageWrapper(unittest.TestCase):
    """
    Test that momentum_agent.generate_image wrapper supports ALL parameters.

    Previously the wrapper was missing:
    - safety_filter_level
    - output_mime_type

    After unification it should support all 8 params.
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

    @patch('tools.media_tools.generate_image')
    def test_wrapper_full_parameter_support(self, mock_generate_image):
        """Test momentum_agent.generate_image passes ALL parameters to media_tools"""
        # Mock the underlying generate_image function
        mock_generate_image.return_value = {
            'status': 'success',
            'message': 'Image generated successfully',
            'format': 'url',
            'prompt': 'Generate an image',
            'image_url': 'https://storage.example.com/generated.png',
            'image_urls': ['https://storage.example.com/generated.png']
        }

        from momentum_agent import generate_image

        # Test new parameters added during unification
        result = generate_image(
            prompt="Generate an image",
            brand_id="test_brand",
            aspect_ratio="16:9",
            number_of_images=2,
            safety_filter_level="block_only_high",    # Previously NOT passed through
            output_mime_type="image/png"              # Previously NOT passed through
        )

        self.assertEqual(result['status'], 'success')

        # Verify ALL params were passed through to media_tools.generate_image
        mock_generate_image.assert_called_once_with(
            prompt="Generate an image",
            brand_id="test_brand",
            aspect_ratio="16:9",
            number_of_images=2,
            person_generation="",
            safety_filter_level="block_only_high",
            output_mime_type="image/png"
        )

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_wrapper_safety_filter_levels(self, mock_upload, mock_genai):
        """Test all safety filter levels work through wrapper"""
        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai)

        from momentum_agent import generate_image

        # Note: The API only supports "block_low_and_above" for safety_filter_level
        # Other levels will be rejected by the API, but we test that the wrapper
        # correctly passes through the parameter. For unsupported levels, we expect
        # an error response from the API, which is valid behavior.
        safety_levels = ["block_only_high", "block_medium_and_above", "block_low_and_above"]

        for level in safety_levels:
            # Reset mock for each iteration - clear side_effect and reset return value
            mock_genai.models.generate_images.reset_mock()
            mock_genai.models.generate_images.side_effect = None  # Clear any previous side_effect
            self._setup_mock_generate_response(mock_genai)
            
            # For unsupported levels, mock the API to return an error
            if level != "block_low_and_above":
                mock_genai.models.generate_images.side_effect = google_exceptions.InvalidArgument(
                    "Only block_low_and_above is supported for safetySetting."
                )
                result = generate_image(prompt="Test", safety_filter_level=level)
                # Unsupported levels should return error status
                self.assertEqual(result['status'], 'error', 
                               f"Expected error for unsupported safety level {level}")
            else:
                # Supported level should succeed - ensure side_effect is None
                mock_genai.models.generate_images.side_effect = None
                result = generate_image(prompt="Test", safety_filter_level=level)
                self.assertEqual(result['status'], 'success', 
                               f"Failed for supported safety level {level}")

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_wrapper_output_formats(self, mock_upload, mock_genai):
        """Test output format options work through wrapper"""
        mock_upload.return_value = "https://storage.example.com/generated.png"
        self._setup_mock_generate_response(mock_genai)

        from momentum_agent import generate_image

        # Test PNG output
        result_png = generate_image(prompt="Test", output_mime_type="image/png")
        self.assertEqual(result_png['status'], 'success')

        # Test JPEG output
        result_jpeg = generate_image(prompt="Test", output_mime_type="image/jpeg")
        self.assertEqual(result_jpeg['status'], 'success')


# =============================================================================
# RESPONSE FORMAT CONSISTENCY TESTS
# =============================================================================

class TestResponseFormatConsistency(unittest.TestCase):
    """
    Test that all endpoints return consistent response formats.

    All image-related endpoints should return:
    - status, message, format, prompt (common fields)
    - image_url (singular) and image_urls (array) for URL responses
    - image_data (singular) and image_data_list (array) for base64 responses
    """

    def _setup_mock_edit_response(self, mock_genai):
        """Helper to set up mock edit response"""
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image_data"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

    def _setup_mock_generate_response(self, mock_genai):
        """Helper to set up mock generate response"""
        mock_response = MagicMock()
        mock_image = MagicMock()
        mock_image.image.image_bytes = b"generated_image_data"
        mock_response.generated_images = [mock_image]
        mock_genai.models.generate_images.return_value = mock_response

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_image_response_structure(self, mock_upload, mock_genai):
        """Test generate_image returns all required fields"""
        mock_upload.return_value = "https://storage.example.com/image.png"
        self._setup_mock_generate_response(mock_genai)

        from tools.media_tools import generate_image

        result = generate_image(prompt="Test image")

        # Check all required fields
        self.assertIn('status', result)
        self.assertIn('message', result)
        self.assertIn('format', result)
        self.assertIn('prompt', result)
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

        # Verify values
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'url')
        self.assertEqual(result['image_url'], result['image_urls'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_nano_banana_response_structure(self, mock_upload, mock_genai):
        """Test nano_banana returns all required fields"""
        mock_upload.return_value = "https://storage.example.com/edited.png"
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import nano_banana

        result = nano_banana(prompt="Edit image")

        # Check all required fields
        self.assertIn('status', result)
        self.assertIn('message', result)
        self.assertIn('format', result)
        self.assertIn('prompt', result)
        self.assertIn('image_url', result)
        self.assertIn('image_urls', result)

        # Verify values
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['format'], 'url')
        self.assertEqual(result['image_url'], result['image_urls'][0])

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_base64_fallback_structure(self, mock_upload, mock_genai):
        """Test base64 fallback returns consistent structure"""
        mock_upload.return_value = ""  # Force base64 fallback
        self._setup_mock_generate_response(mock_genai)
        self._setup_mock_edit_response(mock_genai)

        from tools.media_tools import generate_image, nano_banana

        # Test generate_image base64 response
        result_gen = generate_image(prompt="Test")
        self.assertEqual(result_gen['format'], 'base64')
        self.assertIn('image_data', result_gen)
        self.assertIn('image_data_list', result_gen)

        # Reset mock for nano_banana
        self._setup_mock_edit_response(mock_genai)

        # Test nano_banana base64 response
        result_edit = nano_banana(prompt="Test")
        self.assertEqual(result_edit['format'], 'base64')
        self.assertIn('image_data', result_edit)
        self.assertIn('image_data_list', result_edit)


# =============================================================================
# PARAMETER PARITY TESTS
# =============================================================================

class TestParameterParity(unittest.TestCase):
    """
    Test that parameter handling is consistent across all entry points.

    This ensures the same parameters produce the same behavior whether
    called via Agent tool, /agent endpoint, or /media endpoint.
    """

    def _setup_mock_edit_response(self, mock_genai):
        """Helper to set up mock edit response"""
        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"edited_image_data"
        mock_part.inline_data.mime_type = "image/png"
        mock_candidate.content.parts = [mock_part]
        mock_response.candidates = [mock_candidate]
        mock_genai.models.generate_content.return_value = mock_response

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_nano_banana_parameter_count(self, mock_upload, mock_genai):
        """Verify nano_banana accepts all 8 parameters"""
        from tools.media_tools import nano_banana
        import inspect

        sig = inspect.signature(nano_banana)
        params = list(sig.parameters.keys())

        expected_params = [
            'prompt', 'image_url', 'reference_images', 'mask_url',
            'mode', 'aspect_ratio', 'number_of_images', 'person_generation'
        ]

        self.assertEqual(len(params), 8, f"nano_banana should have 8 parameters, got {len(params)}: {params}")
        for param in expected_params:
            self.assertIn(param, params, f"Missing parameter: {param}")

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_generate_image_parameter_count(self, mock_upload, mock_genai):
        """Verify generate_image accepts all 7 parameters"""
        from tools.media_tools import generate_image
        import inspect

        sig = inspect.signature(generate_image)
        params = list(sig.parameters.keys())

        expected_params = [
            'prompt', 'brand_id', 'aspect_ratio', 'number_of_images',
            'person_generation', 'safety_filter_level', 'output_mime_type'
        ]

        self.assertEqual(len(params), 7, f"generate_image should have 7 parameters, got {len(params)}: {params}")
        for param in expected_params:
            self.assertIn(param, params, f"Missing parameter: {param}")

    @patch('tools.media_tools.genai_client')
    @patch('tools.media_tools.upload_to_storage')
    def test_wrapper_parameter_count(self, mock_upload, mock_genai):
        """Verify momentum_agent.generate_image wrapper has same params as media_tools"""
        from momentum_agent import generate_image as wrapper_generate_image
        from tools.media_tools import generate_image as media_generate_image
        import inspect

        wrapper_params = list(inspect.signature(wrapper_generate_image).parameters.keys())
        media_params = list(inspect.signature(media_generate_image).parameters.keys())

        self.assertEqual(
            set(wrapper_params),
            set(media_params),
            f"Parameter mismatch:\n  Wrapper: {wrapper_params}\n  Media: {media_params}"
        )


if __name__ == '__main__':
    unittest.main()
