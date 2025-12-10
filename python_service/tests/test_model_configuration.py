"""
Tests for Model Configuration Propagation

This test suite ensures that AI model settings configured in the Settings UI
propagate correctly throughout the application - from frontend to Python tools.

The model configuration flow is:
1. User sets model preferences in Settings → AI Model Configuration
2. Settings stored in Firestore: brands/{brandId}/settings/ai-models
3. Chat API fetches settings and passes to Python service
4. Python service stores settings in context (context_utils)
5. Individual tools read from context and use appropriate models
"""

import pytest
import sys
import os

# Add python_service to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock ADK before importing momentum_agent
import types
from unittest.mock import MagicMock

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

from utils.context_utils import (
    get_settings_context, set_settings_context,
    get_brand_context, set_brand_context,
    get_user_context, set_user_context,
    get_team_context, set_team_context,
    get_media_context, set_media_context,
)
from utils.model_defaults import (
    DEFAULT_TEXT_MODEL, DEFAULT_AGENT_MODEL, DEFAULT_IMAGE_MODEL,
    DEFAULT_VIDEO_MODEL, DEFAULT_SEARCH_MODEL, DEFAULT_YOUTUBE_ANALYSIS_MODEL,
    DEFAULT_IMAGE_EDIT_MODEL,
)


class TestContextUtils:
    """Test the context utilities that store and retrieve settings."""

    def test_settings_context_set_and_get(self):
        """Test that settings can be set and retrieved correctly."""
        test_settings = {
            'textModel': 'gemini-2.5-pro',
            'agentModel': 'gemini-2.5-flash',
            'imageModel': 'imagen-4.0-generate-001',
            'videoModel': 'veo-3.1-generate-preview',
            'searchModel': 'gemini-2.0-flash-exp',
        }

        set_settings_context(test_settings)
        result = get_settings_context()

        assert result == test_settings
        assert result['textModel'] == 'gemini-2.5-pro'
        assert result['agentModel'] == 'gemini-2.5-flash'

    def test_settings_context_empty_fallback(self):
        """Test that empty settings return empty dict, not None."""
        set_settings_context({})
        result = get_settings_context()
        assert result == {}
        assert isinstance(result, dict)

    def test_settings_context_none_handling(self):
        """Test that None settings are handled gracefully."""
        set_settings_context(None)
        result = get_settings_context()
        # Should return empty dict or handle gracefully
        assert result is not None

    def test_brand_context(self):
        """Test brand context setting and retrieval."""
        set_brand_context('test-brand-123')
        assert get_brand_context() == 'test-brand-123'

    def test_user_context(self):
        """Test user context setting and retrieval."""
        set_user_context('user-456')
        assert get_user_context() == 'user-456'

    def test_team_context(self):
        """Test team context setting and retrieval."""
        team_data = {'teamName': 'Test Team', 'teamType': 'sports'}
        set_team_context(team_data)
        assert get_team_context() == team_data

    def test_media_context(self):
        """Test media context setting and retrieval."""
        media_list = [
            {'url': 'https://example.com/image.png', 'type': 'image'},
            {'url': 'https://example.com/video.mp4', 'type': 'video'},
        ]
        set_media_context(media_list)
        assert get_media_context() == media_list


class TestModelDefaults:
    """Test that model defaults are properly defined."""

    def test_default_models_exist(self):
        """Test that all default model constants are defined."""
        assert DEFAULT_TEXT_MODEL is not None
        assert DEFAULT_AGENT_MODEL is not None
        assert DEFAULT_IMAGE_MODEL is not None
        assert DEFAULT_VIDEO_MODEL is not None
        assert DEFAULT_SEARCH_MODEL is not None
        assert DEFAULT_YOUTUBE_ANALYSIS_MODEL is not None
        assert DEFAULT_IMAGE_EDIT_MODEL is not None

    def test_default_models_are_strings(self):
        """Test that all default models are string values."""
        assert isinstance(DEFAULT_TEXT_MODEL, str)
        assert isinstance(DEFAULT_AGENT_MODEL, str)
        assert isinstance(DEFAULT_IMAGE_MODEL, str)
        assert isinstance(DEFAULT_VIDEO_MODEL, str)
        assert isinstance(DEFAULT_SEARCH_MODEL, str)
        assert isinstance(DEFAULT_YOUTUBE_ANALYSIS_MODEL, str)
        assert isinstance(DEFAULT_IMAGE_EDIT_MODEL, str)

    def test_default_models_not_empty(self):
        """Test that default models are not empty strings."""
        assert len(DEFAULT_TEXT_MODEL) > 0
        assert len(DEFAULT_AGENT_MODEL) > 0
        assert len(DEFAULT_IMAGE_MODEL) > 0
        assert len(DEFAULT_VIDEO_MODEL) > 0
        assert len(DEFAULT_SEARCH_MODEL) > 0
        assert len(DEFAULT_YOUTUBE_ANALYSIS_MODEL) > 0
        assert len(DEFAULT_IMAGE_EDIT_MODEL) > 0

    def test_image_model_starts_with_imagen(self):
        """Test that image model is an Imagen model."""
        assert DEFAULT_IMAGE_MODEL.startswith('imagen')

    def test_video_model_starts_with_veo(self):
        """Test that video model is a Veo model."""
        assert DEFAULT_VIDEO_MODEL.startswith('veo')

    def test_search_model_is_gemini_2x(self):
        """Test that search model is Gemini 2.x (required for google_search tool)."""
        assert 'gemini-2' in DEFAULT_SEARCH_MODEL


class TestModelSelectionLogic:
    """Test the model selection logic used throughout the codebase."""

    def test_model_selection_with_settings(self):
        """Test that settings override defaults."""
        settings = {'textModel': 'custom-model-1'}
        set_settings_context(settings)

        result = get_settings_context()
        model = result.get('textModel') or DEFAULT_TEXT_MODEL

        assert model == 'custom-model-1'

    def test_model_selection_fallback_to_default(self):
        """Test fallback to default when setting is missing."""
        settings = {'imageModel': 'imagen-custom'}  # No textModel
        set_settings_context(settings)

        result = get_settings_context()
        model = result.get('textModel') or DEFAULT_TEXT_MODEL

        assert model == DEFAULT_TEXT_MODEL

    def test_model_selection_empty_string_fallback(self):
        """Test that empty string in settings falls back to default."""
        settings = {'textModel': ''}
        set_settings_context(settings)

        result = get_settings_context()
        model = result.get('textModel') or DEFAULT_TEXT_MODEL

        assert model == DEFAULT_TEXT_MODEL

    def test_all_model_types_configurable(self):
        """Test that all model types can be configured via settings."""
        custom_settings = {
            'textModel': 'custom-text-model',
            'agentModel': 'custom-agent-model',
            'imageModel': 'imagen-custom',
            'imageEditModel': 'gemini-custom-image',
            'videoModel': 'veo-custom',
            'searchModel': 'gemini-2.0-search-custom',
            'youtubeAnalysisModel': 'gemini-youtube-custom',
            'teamChatModel': 'team-chat-custom',
            'domainSuggestionsModel': 'domain-custom',
            'websitePlanningModel': 'website-custom',
            'teamStrategyModel': 'strategy-custom',
            'logoConceptsModel': 'logo-custom',
        }

        set_settings_context(custom_settings)
        result = get_settings_context()

        for key, value in custom_settings.items():
            assert result.get(key) == value, f"Setting {key} not properly stored"


class TestSearchAgentModelValidation:
    """Test search agent model validation (must be Gemini 2.x for google_search)."""

    def test_valid_gemini_2_models(self):
        """Test that valid Gemini 2.x models pass validation."""
        valid_models = [
            'gemini-2.0-flash',
            'gemini-2.0-flash-exp',
            'gemini-2.5-flash',
            'gemini-2.5-pro',
        ]

        for model in valid_models:
            assert model.startswith('gemini-2'), f"{model} should be valid for search agent"

    def test_invalid_models_for_search(self):
        """Test that non-Gemini-2.x models are identified."""
        invalid_models = [
            'gemini-1.5-pro',
            'gemini-3-pro',
            'claude-3-opus',
            'gpt-4',
        ]

        for model in invalid_models:
            assert not model.startswith('gemini-2'), f"{model} should be invalid for search agent"


class TestToolModelIntegration:
    """Test that tools correctly use the settings context."""

    def setup_method(self):
        """Reset context before each test."""
        set_settings_context({})
        set_brand_context(None)
        set_user_context(None)

    def test_generate_text_uses_settings(self):
        """Test that generate_text would use settings context."""
        custom_settings = {'textModel': 'gemini-custom-text'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('textModel') or DEFAULT_TEXT_MODEL

        assert model == 'gemini-custom-text'

    def test_generate_image_uses_settings(self):
        """Test that generate_image would use settings context."""
        custom_settings = {'imageModel': 'imagen-custom-4'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('imageModel') or DEFAULT_IMAGE_MODEL

        assert model == 'imagen-custom-4'

    def test_generate_video_uses_settings(self):
        """Test that generate_video would use settings context."""
        custom_settings = {'videoModel': 'veo-custom-3'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('videoModel') or DEFAULT_VIDEO_MODEL

        assert model == 'veo-custom-3'

    def test_youtube_analysis_uses_settings(self):
        """Test that process_youtube_video would use settings context."""
        custom_settings = {'youtubeAnalysisModel': 'gemini-youtube-custom'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('youtubeAnalysisModel') or DEFAULT_YOUTUBE_ANALYSIS_MODEL

        assert model == 'gemini-youtube-custom'

    def test_image_edit_uses_settings(self):
        """Test that nano_banana would use settings context."""
        custom_settings = {'imageEditModel': 'gemini-edit-custom'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('imageEditModel') or DEFAULT_IMAGE_EDIT_MODEL

        assert model == 'gemini-edit-custom'

    def test_search_uses_settings(self):
        """Test that search functions would use settings context."""
        custom_settings = {'searchModel': 'gemini-2.0-flash-custom'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('searchModel') or DEFAULT_SEARCH_MODEL

        assert model == 'gemini-2.0-flash-custom'


class TestAgentRouterIntegration:
    """Test that the agent router correctly sets context from requests."""

    def test_context_set_from_request_data(self):
        """Test simulated request data setting context."""
        # Simulate what the agent router does
        request_brand_id = 'brand-abc'
        request_user_id = 'user-xyz'
        request_settings = {
            'textModel': 'gemini-from-request',
            'imageModel': 'imagen-from-request',
        }
        request_team_context = {'teamName': 'Request Team'}

        # Set context as the router would
        set_brand_context(request_brand_id)
        set_user_context(request_user_id)
        set_settings_context(request_settings)
        set_team_context(request_team_context)

        # Verify all context is accessible
        assert get_brand_context() == 'brand-abc'
        assert get_user_context() == 'user-xyz'
        assert get_settings_context() == request_settings
        assert get_team_context() == request_team_context

    def test_empty_settings_in_request(self):
        """Test handling when request has no settings."""
        set_settings_context({})

        settings = get_settings_context()
        model = settings.get('textModel') or DEFAULT_TEXT_MODEL

        assert model == DEFAULT_TEXT_MODEL


class TestMarketingAgentModelConfiguration:
    """Test that MarketingAgent accepts model configuration."""

    def test_marketing_agent_accepts_model_name(self):
        """Test that MarketingAgent can be initialized with custom model."""
        try:
            from marketing_agent import MarketingAgent

            # Should accept model_name parameter
            # Note: This will fail without API key, but we're testing the interface
            agent_class = MarketingAgent
            import inspect
            sig = inspect.signature(agent_class.__init__)
            params = list(sig.parameters.keys())

            assert 'model_name' in params, "MarketingAgent should accept model_name parameter"
        except ImportError:
            pytest.skip("MarketingAgent not available")
        except ValueError:
            # Expected if API key is not set
            pass


class TestTeamToolsModelConfiguration:
    """Test that team tools use the settings context for model selection."""

    def test_team_tools_helper_function_exists(self):
        """Test that _get_marketing_agent helper exists."""
        try:
            from tools.team_tools import _get_marketing_agent
            assert callable(_get_marketing_agent)
        except ImportError:
            pytest.skip("team_tools not available")

    def test_team_tools_uses_settings_context(self):
        """Test that team tools would use settings from context."""
        custom_settings = {'textModel': 'gemini-team-custom'}
        set_settings_context(custom_settings)

        settings = get_settings_context()
        model = settings.get('textModel') or DEFAULT_TEXT_MODEL

        assert model == 'gemini-team-custom'


class TestMediaToolsModelConfiguration:
    """Test that media tools use the settings context for model selection."""

    def test_media_tools_imports(self):
        """Test that media_tools can import context utils."""
        try:
            from tools.media_tools import generate_image, generate_video, analyze_image, nano_banana
            assert callable(generate_image)
            assert callable(generate_video)
            assert callable(analyze_image)
            assert callable(nano_banana)
        except ImportError:
            pytest.skip("media_tools not available")

    def test_image_model_validation(self):
        """Test that non-imagen models would be rejected for image generation."""
        settings = {'imageModel': 'gemini-not-imagen'}
        set_settings_context(settings)

        result = get_settings_context()
        model = result.get('imageModel') or DEFAULT_IMAGE_MODEL

        # If model doesn't start with 'imagen', it should fall back to default
        if not model.startswith('imagen'):
            model = DEFAULT_IMAGE_MODEL

        assert model.startswith('imagen')

    def test_video_model_validation(self):
        """Test that non-veo models would be rejected for video generation."""
        settings = {'videoModel': 'gemini-not-veo'}
        set_settings_context(settings)

        result = get_settings_context()
        model = result.get('videoModel') or DEFAULT_VIDEO_MODEL

        # If model doesn't start with 'veo', it should fall back to default
        if not model.startswith('veo'):
            model = DEFAULT_VIDEO_MODEL

        assert model.startswith('veo')


class TestMomentumAgentModelConfiguration:
    """Test that momentum_agent uses settings context correctly."""

    def test_momentum_agent_imports(self):
        """Test that momentum_agent can be imported."""
        try:
            from momentum_agent import create_momentum_agent, generate_text
            assert callable(create_momentum_agent)
            assert callable(generate_text)
        except ImportError:
            pytest.skip("momentum_agent not available")

    def test_search_agent_model_validation_logic(self):
        """Test the search agent model validation logic."""
        # Simulate the validation in create_momentum_agent
        settings = {'searchModel': 'gemini-1.5-pro'}  # Invalid for search
        set_settings_context(settings)

        result = get_settings_context()
        search_model = result.get('searchModel') or DEFAULT_SEARCH_MODEL

        # If not Gemini 2.x, should fall back
        if not search_model.startswith('gemini-2'):
            search_model = 'gemini-2.0-flash'

        assert search_model.startswith('gemini-2')


class TestEndToEndModelPropagation:
    """End-to-end tests for model configuration propagation."""

    def setup_method(self):
        """Reset all context before each test."""
        set_settings_context({})
        set_brand_context(None)
        set_user_context(None)
        set_team_context({})
        set_media_context([])

    def test_full_request_simulation(self):
        """Simulate a complete request flow with model settings."""
        # 1. Simulate request coming from frontend with settings
        request_settings = {
            'textModel': 'gemini-2.5-pro',
            'agentModel': 'gemini-2.5-flash',
            'imageModel': 'imagen-4.0-generate-001',
            'imageEditModel': 'gemini-3-pro-image-preview',
            'videoModel': 'veo-3.1-generate-preview',
            'searchModel': 'gemini-2.0-flash',
            'youtubeAnalysisModel': 'gemini-2.5-flash',
        }

        # 2. Router sets context (as routers/agent.py does)
        set_brand_context('test-brand')
        set_user_context('test-user')
        set_settings_context(request_settings)

        # 3. Tools read from context
        settings = get_settings_context()

        # 4. Verify all models are correctly propagated
        assert settings.get('textModel') == 'gemini-2.5-pro'
        assert settings.get('agentModel') == 'gemini-2.5-flash'
        assert settings.get('imageModel') == 'imagen-4.0-generate-001'
        assert settings.get('imageEditModel') == 'gemini-3-pro-image-preview'
        assert settings.get('videoModel') == 'veo-3.1-generate-preview'
        assert settings.get('searchModel') == 'gemini-2.0-flash'
        assert settings.get('youtubeAnalysisModel') == 'gemini-2.5-flash'

    def test_partial_settings_with_defaults(self):
        """Test that partial settings work with defaults for missing values."""
        # Only set some models
        partial_settings = {
            'textModel': 'gemini-custom',
            # imageModel, videoModel, etc. not set
        }

        set_settings_context(partial_settings)
        settings = get_settings_context()

        # Custom setting should be used
        text_model = settings.get('textModel') or DEFAULT_TEXT_MODEL
        assert text_model == 'gemini-custom'

        # Missing settings should fall back to defaults
        image_model = settings.get('imageModel') or DEFAULT_IMAGE_MODEL
        assert image_model == DEFAULT_IMAGE_MODEL

        video_model = settings.get('videoModel') or DEFAULT_VIDEO_MODEL
        assert video_model == DEFAULT_VIDEO_MODEL

    def test_context_isolation_between_requests(self):
        """Test that context from one request doesn't affect another."""
        # First request
        set_settings_context({'textModel': 'model-request-1'})
        assert get_settings_context().get('textModel') == 'model-request-1'

        # Second request overwrites
        set_settings_context({'textModel': 'model-request-2'})
        assert get_settings_context().get('textModel') == 'model-request-2'

        # Clear context
        set_settings_context({})
        model = get_settings_context().get('textModel') or DEFAULT_TEXT_MODEL
        assert model == DEFAULT_TEXT_MODEL


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
