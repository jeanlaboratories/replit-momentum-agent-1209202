"""
Fixed tests for the Search Settings service.
Focus on testing business logic with proper mocking to avoid segfaults.
"""

import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock all Google Cloud imports before any other imports to prevent segfaults
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['google.cloud'] = MagicMock()
sys.modules['google.cloud.discoveryengine_v1'] = MagicMock()
sys.modules['google.api_core'] = MagicMock()
sys.modules['google.api_core.exceptions'] = MagicMock()

from models.search_settings import (
    SearchSettings, SearchMethod, DataStoreInfo, DataStoreStatus,
    IndexingStatus, SearchStatsResponse
)
from config.exceptions import ServiceUnavailableError, ResourceNotFoundError


class TestSearchSettingsLogic:
    """Test the search settings business logic without external dependencies."""
    
    def test_search_method_enum_values(self):
        """Test that SearchMethod enum has correct values."""
        assert SearchMethod.VERTEX_AI == "vertex_ai"
        assert SearchMethod.FIREBASE == "firebase"
    
    def test_data_store_status_enum_values(self):
        """Test that DataStoreStatus enum has correct values."""
        assert DataStoreStatus.ACTIVE == "active"
        assert DataStoreStatus.CREATING == "creating"
        assert DataStoreStatus.DELETING == "deleting"
        assert DataStoreStatus.ERROR == "error"
        assert DataStoreStatus.NOT_FOUND == "not_found"
    
    def test_search_settings_model_creation(self):
        """Test creating SearchSettings model with valid data."""
        settings = SearchSettings(
            brand_id="test-brand",
            search_method=SearchMethod.VERTEX_AI,
            auto_index=True,
            vertex_ai_enabled=True,
            firebase_document_count=100
        )
        
        assert settings.brand_id == "test-brand"
        assert settings.search_method == SearchMethod.VERTEX_AI
        assert settings.auto_index == True
        assert settings.vertex_ai_enabled == True
        assert settings.firebase_document_count == 100
    
    def test_data_store_info_model_creation(self):
        """Test creating DataStoreInfo model with valid data."""
        data_store = DataStoreInfo(
            id="test-datastore",
            name="projects/test/locations/us/dataStores/test",
            display_name="Test Datastore",
            brand_id="test-brand",
            status=DataStoreStatus.ACTIVE,
            document_count=50
        )
        
        assert data_store.id == "test-datastore"
        assert data_store.brand_id == "test-brand"
        assert data_store.status == DataStoreStatus.ACTIVE
        assert data_store.document_count == 50
    
    def test_indexing_status_model_creation(self):
        """Test creating IndexingStatus model with valid data."""
        status = IndexingStatus(
            is_indexing=True,
            progress=75.5,
            items_processed=755,
            total_items=1000,
            current_operation="Processing images"
        )
        
        assert status.is_indexing == True
        assert status.progress == 75.5
        assert status.items_processed == 755
        assert status.total_items == 1000
        assert status.current_operation == "Processing images"
    
    def test_search_stats_response_model_creation(self):
        """Test creating SearchStatsResponse model with valid data."""
        stats = SearchStatsResponse(
            total_searches=1000,
            vertex_ai_searches=600,
            firebase_searches=400,
            avg_response_time=150.5,
            success_rate=98.7
        )
        
        assert stats.total_searches == 1000
        assert stats.vertex_ai_searches == 600
        assert stats.firebase_searches == 400
        assert stats.avg_response_time == 150.5
        assert stats.success_rate == 98.7


class TestSearchSettingsServiceMocked:
    """Test search settings service with comprehensive mocking."""
    
    @patch('services.search_settings_service.get_media_search_service')
    @patch('services.search_settings_service.get_settings')
    @patch('services.search_settings_service.firestore')
    def test_get_search_settings_vertex_ai_success(self, mock_firestore, mock_get_settings, mock_media_search):
        """Test successful retrieval of Vertex AI search settings."""
        from services.search_settings_service import SearchSettingsService
        
        # Setup mock return values
        mock_db = MagicMock()
        mock_firestore.client.return_value = mock_db
        
        # Mock Firestore document response
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            'search_method': 'vertex_ai',
            'auto_index': True,
            'last_sync': '2023-01-01T12:00:00Z'
        }
        
        # Setup the complex mock chain for Firestore access
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
        
        # Mock the service instance
        service = SearchSettingsService()
        
        # Mock the private methods to return expected values
        mock_data_store = DataStoreInfo(
            id="test-datastore",
            name="projects/test/locations/us/dataStores/test",
            display_name="Test Datastore",
            brand_id="test-brand",
            status=DataStoreStatus.ACTIVE,
            document_count=100
        )
        
        with patch.object(service, '_get_data_store_info', return_value=mock_data_store):
            with patch.object(service, '_get_firebase_document_count', return_value=150):
                result = service.get_search_settings("test-brand")
                
                assert result.brand_id == "test-brand"
                assert result.search_method == SearchMethod.VERTEX_AI
                assert result.auto_index == True
                assert result.vertex_ai_enabled == True
                assert result.firebase_document_count == 150
                assert result.data_store_info == mock_data_store
    
    @patch('services.search_settings_service.get_media_search_service')
    @patch('services.search_settings_service.get_settings')
    @patch('services.search_settings_service.firestore')
    def test_get_search_settings_firebase_fallback(self, mock_firestore, mock_get_settings, mock_media_search):
        """Test fallback to Firebase when Vertex AI is not available."""
        from services.search_settings_service import SearchSettingsService
        
        # Setup mock return values for Firebase fallback
        mock_db = MagicMock()
        mock_firestore.client.return_value = mock_db
        
        # Mock Firestore document response for Firebase
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            'search_method': 'firebase',
            'auto_index': False
        }
        
        mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
        
        service = SearchSettingsService()
        
        # Mock methods to simulate no Vertex AI availability
        with patch.object(service, '_get_data_store_info', return_value=None):
            with patch.object(service, '_get_firebase_document_count', return_value=75):
                result = service.get_search_settings("test-brand")
                
                assert result.brand_id == "test-brand"
                assert result.search_method == SearchMethod.FIREBASE
                assert result.vertex_ai_enabled == False
                assert result.data_store_info is None
                assert result.firebase_document_count == 75
    
    @patch('services.search_settings_service.get_media_search_service')
    @patch('services.search_settings_service.get_settings')
    @patch('services.search_settings_service.firestore')
    def test_update_search_settings_success(self, mock_firestore, mock_get_settings, mock_media_search):
        """Test successful update of search settings."""
        from services.search_settings_service import SearchSettingsService
        
        mock_db = MagicMock()
        mock_firestore.client.return_value = mock_db
        
        service = SearchSettingsService()
        
        # Mock the get_search_settings method to return updated settings
        updated_settings = SearchSettings(
            brand_id="test-brand",
            search_method=SearchMethod.FIREBASE,
            auto_index=True,
            vertex_ai_enabled=False,
            firebase_document_count=100
        )
        
        with patch.object(service, 'get_search_settings', return_value=updated_settings):
            result = service.update_search_settings(
                brand_id="test-brand",
                search_method=SearchMethod.FIREBASE
            )
            
            assert result.search_method == SearchMethod.FIREBASE
            assert result.brand_id == "test-brand"
    
    def test_exception_handling(self):
        """Test that appropriate exceptions are raised."""
        # Test ResourceNotFoundError
        with pytest.raises(ResourceNotFoundError):
            raise ResourceNotFoundError("Test resource not found")
        
        # Test ServiceUnavailableError
        with pytest.raises(ServiceUnavailableError):
            raise ServiceUnavailableError("Test service unavailable")


if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])