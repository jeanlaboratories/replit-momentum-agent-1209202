"""
Tests for media search service deletion functionality with improved cache handling.
"""

import pytest
import sys
import os
import types
from unittest.mock import Mock, patch, MagicMock
from google.api_core import exceptions as google_exceptions
from google.cloud import discoveryengine_v1 as discoveryengine

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def setup_adk_mocks():
    """Set up ADK mocks to prevent import errors and test interference."""
    # Ensure google module exists as a package
    if 'google' not in sys.modules or not hasattr(sys.modules.get('google', None), '__path__'):
        sys.modules['google'] = types.ModuleType('google')
    
    # Create google.adk as a proper package
    if 'google.adk' not in sys.modules or not hasattr(sys.modules.get('google.adk', None), '__path__'):
        adk_module = types.ModuleType('google.adk')
        adk_module.__path__ = []
        sys.modules['google.adk'] = adk_module
    
    # Create all necessary ADK submodules
    adk_submodules = ['agents', 'memory', 'sessions', 'events', 'models', 'runners', 'tools']
    for submod in adk_submodules:
        mod_name = f'google.adk.{submod}'
        if mod_name not in sys.modules or not hasattr(sys.modules.get(mod_name, None), '__path__'):
            submod_obj = types.ModuleType(mod_name)
            submod_obj.__path__ = []
            setattr(sys.modules['google.adk'], submod, submod_obj)
            sys.modules[mod_name] = submod_obj
    
    # Create agent_tool submodule
    if 'google.adk.tools.agent_tool' not in sys.modules:
        agent_tool_obj = types.ModuleType('google.adk.tools.agent_tool')
        sys.modules['google.adk.tools.agent_tool'] = agent_tool_obj
    
    # Mock classes for memory service
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
    
    # Mock Agent and LlmAgent
    def mock_agent_init(self, *args, **kwargs):
        self.tools = kwargs.get('tools', [])
        self.instruction = kwargs.get('instruction', '')
        self.model = kwargs.get('model', 'gemini-2.0-flash')
    mock_agent = type('Agent', (), {'__init__': mock_agent_init})
    mock_llm_agent = type('LlmAgent', (), {'__init__': mock_agent_init})
    sys.modules['google.adk.agents'].Agent = mock_agent
    sys.modules['google.adk.agents'].LlmAgent = mock_llm_agent
    
    # Mock Runner
    def mock_runner_init(self, *args, **kwargs):
        pass
    mock_runner = type('Runner', (), {'__init__': mock_runner_init})
    sys.modules['google.adk.runners'].Runner = mock_runner
    
    # Mock AgentTool
    def mock_agent_tool_init(self, *args, **kwargs):
        pass
    mock_agent_tool = type('AgentTool', (), {'__init__': mock_agent_tool_init})
    sys.modules['google.adk.tools'].AgentTool = mock_agent_tool
    sys.modules['google.adk.tools.agent_tool'].AgentTool = mock_agent_tool
    
    # Mock google_search
    mock_google_search = MagicMock()
    sys.modules['google.adk.tools'].google_search = mock_google_search
    
    # Mock SessionService
    def mock_session_service_init(self, *args, **kwargs):
        pass
    mock_session_service = type('SessionService', (), {'__init__': mock_session_service_init})
    mock_inmemory_session_service = type('InMemorySessionService', (), {'__init__': mock_session_service_init})
    sys.modules['google.adk.sessions'].SessionService = mock_session_service
    sys.modules['google.adk.sessions'].InMemorySessionService = mock_inmemory_session_service


# Set up ADK mocks before any imports that might use them
setup_adk_mocks()


class TestMediaSearchServiceDeletion:
    """Test suite for media search service deletion with cache handling."""
    
    def setup_method(self):
        """Setup for each test method."""
        self.mock_datastore_client = Mock()
        self.mock_operation = Mock()
        
        # Mock settings
        self.mock_settings = Mock()
        self.mock_settings.vertex_ai_project_id = "test-project"
        self.mock_settings.vertex_ai_location = "global"
        
        # Patch dependencies
        self.settings_patch = patch('config.get_settings', return_value=self.mock_settings)
        self.client_patch = patch('google.cloud.discoveryengine_v1.DataStoreServiceClient')
        
        self.settings_patch.start()
        self.mock_client_class = self.client_patch.start()
        self.mock_client_class.return_value = self.mock_datastore_client
        
        # Import service after patching
        from services.media_search_service import MediaSearchService
        self.service = MediaSearchService()
        self.service.project_id = "test-project"
        self.service.location = "global"
        self.service.datastore_client = self.mock_datastore_client
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.settings_patch.stop()
        self.client_patch.stop()
    
    def test_delete_datastore_uses_cached_name(self):
        """Test that delete_datastore uses cached timestamped name."""
        brand_id = "test-brand"
        cached_path = "projects/test-project/locations/global/collections/default_collection/dataStores/momentum-media-test-brand-1234567890"
        
        # Mock operation
        self.mock_datastore_client.delete_data_store.return_value = self.mock_operation
        self.mock_operation.result.return_value = None
        
        # Test with cached path
        with patch('services.media_search_service._datastore_cache', 
                  {"momentum-media-test-brand": cached_path}):
            result = self.service.delete_datastore(brand_id)
            
            assert result == True
            
            # Verify it used the cached path
            self.mock_datastore_client.delete_data_store.assert_called_once()
            call_args = self.mock_datastore_client.delete_data_store.call_args
            assert call_args[1]['request'].name == cached_path
    
    def test_delete_datastore_fallback_to_expected_path(self):
        """Test that delete_datastore falls back to expected path when cache is empty."""
        brand_id = "test-brand"
        
        # Mock operation
        self.mock_datastore_client.delete_data_store.return_value = self.mock_operation
        self.mock_operation.result.return_value = None
        
        # Test with empty cache
        with patch('services.media_search_service._datastore_cache', {}):
            result = self.service.delete_datastore(brand_id)
            
            assert result == True
            
            # Verify it used the expected path
            self.mock_datastore_client.delete_data_store.assert_called_once()
            call_args = self.mock_datastore_client.delete_data_store.call_args
            expected_path = f"projects/{self.service.project_id}/locations/{self.service.location}/dataStores/momentum-media-test-brand"
            assert call_args[1]['request'].name == expected_path
    
    def test_delete_datastore_operation_timeout_graceful_handling(self):
        """Test graceful handling of operation timeout with verification."""
        brand_id = "test-brand-timeout"
        cached_path = "projects/test/dataStores/momentum-media-test-brand-timeout-999"
        
        # Mock operation that times out
        self.mock_datastore_client.delete_data_store.return_value = self.mock_operation
        self.mock_operation.result.side_effect = Exception("Unexpected state: Long-running operation had neither response nor error set.")
        
        # Mock get_data_store to return NotFound (indicating successful deletion)
        self.mock_datastore_client.get_data_store.side_effect = google_exceptions.NotFound("Datastore not found")
        
        with patch('services.media_search_service._datastore_cache', 
                  {"momentum-media-test-brand-timeout": cached_path}):
            result = self.service.delete_datastore(brand_id)
            
            assert result == True
            
            # Verify deletion was attempted
            self.mock_datastore_client.delete_data_store.assert_called_once()
            
            # Verify verification check was made
            self.mock_datastore_client.get_data_store.assert_called_once_with(name=cached_path)
    
    def test_delete_datastore_operation_timeout_still_exists(self):
        """Test handling when operation times out but datastore still exists."""
        brand_id = "test-brand-timeout-exists"
        cached_path = "projects/test/dataStores/momentum-media-test-brand-timeout-exists"
        
        # Mock operation that times out
        self.mock_datastore_client.delete_data_store.return_value = self.mock_operation
        self.mock_operation.result.side_effect = Exception("Unexpected state")
        
        # Mock get_data_store to return datastore (still exists)
        mock_datastore = Mock()
        mock_datastore.name = cached_path
        self.mock_datastore_client.get_data_store.return_value = mock_datastore
        
        with patch('services.media_search_service._datastore_cache', 
                  {"momentum-media-test-brand-timeout-exists": cached_path}):
            result = self.service.delete_datastore(brand_id)
            
            # Should still return True since operation was initiated
            assert result == True
            
            # Verify verification check was made
            self.mock_datastore_client.get_data_store.assert_called_once_with(name=cached_path)
    
    def test_delete_datastore_not_found_already_deleted(self):
        """Test deletion of datastore that's already deleted."""
        brand_id = "test-brand-not-found"
        
        # Mock operation that raises NotFound
        self.mock_datastore_client.delete_data_store.side_effect = google_exceptions.NotFound("Datastore not found")
        
        with patch('services.media_search_service._datastore_cache', {}):
            result = self.service.delete_datastore(brand_id)
            
            assert result == True  # Should return True (already deleted)
    
    def test_delete_datastore_cache_cleanup(self):
        """Test that cache is properly cleaned up after deletion."""
        brand_id = "test-brand-cache-cleanup"
        cached_path = "projects/test/dataStores/momentum-media-test-brand-cache-cleanup"
        
        # Mock successful operation
        self.mock_datastore_client.delete_data_store.return_value = self.mock_operation
        self.mock_operation.result.return_value = None
        
        # Start with populated cache
        test_cache = {"momentum-media-test-brand-cache-cleanup": cached_path}
        
        with patch('services.media_search_service._datastore_cache', test_cache):
            result = self.service.delete_datastore(brand_id)
            
            assert result == True
            
            # Verify cache was cleared
            assert "momentum-media-test-brand-cache-cleanup" not in test_cache
    
    def test_delete_datastore_no_client(self):
        """Test deletion when no datastore client is available."""
        brand_id = "test-brand-no-client"
        
        # Remove client
        self.service.datastore_client = None
        
        result = self.service.delete_datastore(brand_id)
        
        assert result == False
    
    def test_delete_datastore_no_project_id(self):
        """Test deletion when no project ID is configured."""
        brand_id = "test-brand-no-project"
        
        # Remove project ID
        self.service.project_id = None
        
        result = self.service.delete_datastore(brand_id)
        
        assert result == False
    
    def test_delete_datastore_general_exception(self):
        """Test deletion with general exception."""
        brand_id = "test-brand-exception"
        
        # Mock operation that raises general exception
        self.mock_datastore_client.delete_data_store.side_effect = Exception("General error")
        
        with patch('services.media_search_service._datastore_cache', {}):
            result = self.service.delete_datastore(brand_id)
            
            assert result == False
    
    def test_datastore_id_generation(self):
        """Test that datastore ID generation is consistent."""
        brand_id = "Test_Brand-123"
        expected_id = "momentum-media-test-brand-123"
        
        result = self.service._get_datastore_id(brand_id)
        
        assert result == expected_id
    
    def test_datastore_path_generation(self):
        """Test that datastore path generation is correct."""
        brand_id = "test-brand"
        expected_path = "projects/test-project/locations/global/dataStores/momentum-media-test-brand"
        
        result = self.service._get_datastore_path(brand_id)
        
        assert result == expected_path


if __name__ == "__main__":
    pytest.main([__file__])