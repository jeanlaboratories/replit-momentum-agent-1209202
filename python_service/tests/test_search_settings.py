"""
Tests for the Search Settings service and API endpoints.

These tests cover the search settings management functionality including
search method switching, data store operations, and indexing status.
"""

import pytest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock Firebase and Google Cloud imports before importing our code
mock_firestore = MagicMock()
mock_discoveryengine = MagicMock()
mock_datastore_client = MagicMock()

sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.firestore'] = mock_firestore
sys.modules['google.cloud'] = MagicMock()
sys.modules['google.cloud.discoveryengine_v1'] = mock_discoveryengine
sys.modules['google.api_core'] = MagicMock()
sys.modules['google.api_core.exceptions'] = MagicMock()

# Mock the settings and other dependencies
with patch('config.get_settings') as mock_get_settings, \
     patch('services.media_search_service.get_media_search_service') as mock_media_search:
    
    mock_settings = Mock()
    mock_get_settings.return_value = mock_settings
    
    # Import after mocking
    from models.search_settings import (
        SearchSettings, SearchMethod, DataStoreInfo, DataStoreStatus,
        IndexingStatus, SearchStatsResponse, SearchSettingsUpdateRequest,
        DataStoreDeleteRequest, DataStoreCreateRequest
    )
    from services.search_settings_service import SearchSettingsService
    from config.exceptions import ServiceUnavailableError, ResourceNotFoundError


class TestSearchSettingsService:
    """Test suite for SearchSettingsService."""

    def setup_method(self):
        """Setup for each test method."""
        self.mock_db = Mock()
        self.mock_media_search_service = Mock()
        
        # Setup the service with mocked dependencies
        with patch('firebase_admin.firestore.client', return_value=self.mock_db), \
             patch('services.media_search_service.get_media_search_service', 
                   return_value=self.mock_media_search_service):
            self.service = SearchSettingsService()

    def test_get_search_settings_with_vertex_ai(self):
        """Test getting search settings when Vertex AI is available."""
        brand_id = "test-brand-123"
        
        # Mock data store info
        mock_data_store_info = DataStoreInfo(
            id=f"{brand_id}-datastore",
            name=f"projects/test-project/locations/us-central1/dataStores/{brand_id}-datastore",
            display_name=f"Brand {brand_id} Datastore",
            brand_id=brand_id,
            status=DataStoreStatus.ACTIVE,
            document_count=100,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        
        # Mock everything at the service level
        with patch.object(self.service.db, 'collection') as mock_collection, \
             patch.object(self.service, '_get_data_store_info', return_value=mock_data_store_info), \
             patch.object(self.service, '_get_firebase_document_count', return_value=150):
            
            # Setup Firestore mock chain
            mock_doc = Mock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                'search_method': 'vertex_ai',
                'auto_index': True,
                'last_sync': '2023-01-01T12:00:00Z'
            }
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
            
            result = self.service.get_search_settings(brand_id)
            
            assert isinstance(result, SearchSettings)
            assert result.brand_id == brand_id
            assert result.search_method == SearchMethod.VERTEX_AI
            assert result.auto_index == True
            assert result.vertex_ai_enabled == True
            assert result.data_store_info is not None
            assert result.data_store_info.status == DataStoreStatus.ACTIVE
            assert result.firebase_document_count == 150
            assert result.last_sync == '2023-01-01T12:00:00Z'

    def test_get_search_settings_fallback_to_firebase(self):
        """Test getting search settings when Vertex AI is not available."""
        brand_id = "test-brand-456"
        
        # Mock data store access failure (Vertex AI not available)
        with patch.object(self.service.db, 'collection') as mock_collection, \
             patch.object(self.service, '_get_data_store_info', return_value=None), \
             patch.object(self.service, '_get_firebase_document_count', return_value=75):
            
            # Setup Firestore mock chain for firebase settings
            mock_doc = Mock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {
                'search_method': 'firebase',
                'auto_index': False
            }
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
            
            result = self.service.get_search_settings(brand_id)
            
            assert isinstance(result, SearchSettings)
            assert result.brand_id == brand_id
            assert result.search_method == SearchMethod.FIREBASE  # Uses settings from Firestore
            assert result.vertex_ai_enabled == False
            assert result.data_store_info is None
            assert result.firebase_document_count == 75

    def test_update_search_settings_switch_method(self):
        """Test updating search method."""
        brand_id = "test-brand-789"
        
        # Mock settings reference directly
        mock_settings_ref = Mock()
        mock_current_doc = Mock()
        mock_current_doc.exists = True
        mock_current_doc.to_dict.return_value = {
            'search_method': 'vertex_ai',
            'auto_index': True
        }
        mock_settings_ref.get.return_value = mock_current_doc
        
        # Mock the return value
        updated_settings = SearchSettings(
            brand_id=brand_id,
            search_method=SearchMethod.FIREBASE,
            auto_index=True,
            vertex_ai_enabled=False,
            firebase_document_count=100
        )
        
        # Patch the specific database path and get_search_settings
        with patch.object(self.service.db, 'collection') as mock_collection, \
             patch.object(self.service, 'get_search_settings', return_value=updated_settings):
            
            # Setup the mock chain properly
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value = mock_settings_ref
            
            result = self.service.update_search_settings(
                brand_id=brand_id,
                search_method=SearchMethod.FIREBASE
            )
        
        # Verify the database operations
        mock_settings_ref.get.assert_called()
        mock_settings_ref.set.assert_called()
        
        # Verify the result
        assert result.search_method == SearchMethod.FIREBASE

    def test_update_auto_index_setting(self):
        """Test updating auto-index setting."""
        brand_id = "test-brand-auto"
        
        # Mock settings reference directly
        mock_settings_ref = Mock()
        mock_current_doc = Mock()
        mock_current_doc.exists = True
        mock_current_doc.to_dict.return_value = {
            'search_method': 'vertex_ai',
            'auto_index': True
        }
        mock_settings_ref.get.return_value = mock_current_doc
        
        # Mock the return value
        updated_settings = SearchSettings(
            brand_id=brand_id,
            search_method=SearchMethod.VERTEX_AI,
            auto_index=False,
            vertex_ai_enabled=True,
            firebase_document_count=100
        )
        
        # Patch the specific database path and get_search_settings
        with patch.object(self.service.db, 'collection') as mock_collection, \
             patch.object(self.service, 'get_search_settings', return_value=updated_settings):
            
            # Setup the mock chain properly
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value = mock_settings_ref
            
            result = self.service.update_search_settings(
                brand_id=brand_id,
                auto_index=False
            )
        
        # Verify the database operations
        mock_settings_ref.get.assert_called()
        mock_settings_ref.set.assert_called()
        
        # Verify the result
        assert result.auto_index == False

    def test_delete_data_store_success(self):
        """Test successful data store deletion."""
        brand_id = "test-brand-delete"
        
        # Mock data store info
        mock_data_store_info = DataStoreInfo(
            id=f"{brand_id}-datastore",
            name=f"projects/test/locations/us/dataStores/{brand_id}-datastore",
            display_name="Test Datastore",
            brand_id=brand_id,
            status=DataStoreStatus.ACTIVE,
            document_count=100
        )
        
        # Mock settings reference
        mock_settings_ref = Mock()
        
        # Setup patches
        with patch.object(self.service, '_get_data_store_info', return_value=mock_data_store_info), \
             patch.object(self.service.media_search_service, 'delete_datastore', return_value=True), \
             patch.object(self.service.db, 'collection') as mock_collection:
            
            # Ensure datastore client is available
            self.service.media_search_service.datastore_client = Mock()
            
            # Setup mock chain for settings update
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value = mock_settings_ref
            
            result = self.service.delete_data_store(brand_id)
        
        assert result['success'] == True
        assert 'Data store for brand' in result['message']
        assert result['switched_to_firebase'] == True
        
        # Verify settings were updated to use Firebase
        mock_settings_ref.set.assert_called_once()

    def test_delete_data_store_not_found(self):
        """Test data store deletion when store doesn't exist."""
        brand_id = "test-brand-missing"
        
        # Mock no data store exists
        with patch.object(self.service, '_get_data_store_info', return_value=None):
            # Ensure datastore client is available
            self.service.media_search_service.datastore_client = Mock()
            
            with pytest.raises(ResourceNotFoundError) as exc_info:
                self.service.delete_data_store(brand_id)
            
            assert "no data store found" in str(exc_info.value).lower()

    def test_create_data_store_success(self):
        """Test successful data store creation."""
        brand_id = "test-brand-create"
        
        # Mock no existing data store
        datastore_name = f"projects/test/locations/us/dataStores/{brand_id}-datastore"
        mock_settings_ref = Mock()
        
        with patch.object(self.service, '_get_data_store_info', return_value=None), \
             patch.object(self.service.media_search_service, '_get_or_create_datastore', return_value=datastore_name), \
             patch.object(self.service.db, 'collection') as mock_collection:
            
            # Ensure datastore client is available
            self.service.media_search_service.datastore_client = Mock()
            
            # Setup mock chain for settings update
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value = mock_settings_ref
            
            result = self.service.create_data_store(brand_id, force_recreate=False)
        
        assert result['success'] == True
        assert 'created successfully' in result['message']
        assert result['datastore_name'] == datastore_name
        assert result['switched_to_vertex_ai'] == True
        
        # Verify settings were updated to use Vertex AI
        mock_settings_ref.set.assert_called_once()
        update_call = mock_settings_ref.set.call_args[0][0]
        assert update_call['search_method'] == 'vertex_ai'

    def test_create_data_store_already_exists(self):
        """Test data store creation when store already exists."""
        brand_id = "test-brand-exists"
        
        # Mock existing data store
        existing_info = DataStoreInfo(
            id=f"{brand_id}-datastore",
            name=f"projects/test/locations/us/dataStores/{brand_id}-datastore",
            display_name="Existing Datastore",
            brand_id=brand_id,
            status=DataStoreStatus.ACTIVE,
            document_count=50
        )
        
        with patch.object(self.service, '_get_data_store_info') as mock_get_info:
            mock_get_info.return_value = existing_info
            
            result = self.service.create_data_store(brand_id, force_recreate=False)
        
        assert result['success'] == False
        assert 'already exists' in result['message']
        assert 'force_recreate=true' in result['message']
        assert result['existing_store'] == existing_info.model_dump()

    def test_create_data_store_force_recreate(self):
        """Test data store force recreation."""
        brand_id = "test-brand-recreate"
        
        # Mock existing data store
        existing_info = DataStoreInfo(
            id=f"{brand_id}-datastore",
            name=f"projects/test/locations/us/dataStores/{brand_id}-datastore",
            display_name="Old Datastore",
            brand_id=brand_id,
            status=DataStoreStatus.ACTIVE,
            document_count=75
        )
        
        with patch.object(self.service, '_get_data_store_info') as mock_get_info, \
             patch.object(self.service, 'delete_data_store') as mock_delete, \
             patch('time.sleep'):  # Mock sleep to speed up test
            
            # First call returns existing, second call returns None (after deletion)
            mock_get_info.side_effect = [existing_info, None]
            mock_delete.return_value = {'success': True}
            
            # Mock successful creation after deletion
            self.mock_media_search_service.datastore_client = mock_datastore_client
            datastore_name = f"projects/test/locations/us/dataStores/{brand_id}-new-datastore"
            self.mock_media_search_service._get_or_create_datastore.return_value = datastore_name
            
            # Mock settings update
            mock_settings_ref = Mock()
            self.mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value = mock_settings_ref
            
            result = self.service.create_data_store(brand_id, force_recreate=True)
        
        assert result['success'] == True
        mock_delete.assert_called_once_with(brand_id)

    def test_get_indexing_status_active(self):
        """Test getting indexing status when indexing is active."""
        brand_id = "test-brand-indexing"
        
        # Mock active indexing status in Firestore
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            'is_indexing': True,
            'progress': 65.5,
            'items_processed': 655,
            'total_items': 1000,
            'started_at': '2023-01-01T10:00:00Z',
            'estimated_completion': '2023-01-01T14:00:00Z',
            'current_operation': 'Processing images'
        }
        
        with patch.object(self.service.db, 'collection') as mock_collection:
            mock_collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
            
            result = self.service.get_indexing_status(brand_id)
        
        assert isinstance(result, IndexingStatus)
        assert result.is_indexing == True
        assert result.progress == 65.5
        assert result.items_processed == 655
        assert result.total_items == 1000
        assert result.current_operation == 'Processing images'

    def test_get_indexing_status_inactive(self):
        """Test getting indexing status when no indexing is active."""
        brand_id = "test-brand-no-indexing"
        
        # Mock no indexing status document
        mock_doc = Mock()
        mock_doc.exists = False
        
        self.mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_doc
        
        result = self.service.get_indexing_status(brand_id)
        
        assert isinstance(result, IndexingStatus)
        assert result.is_indexing == False
        assert result.progress == 0.0
        assert result.items_processed == 0
        assert result.total_items == 0

    def test_get_search_stats(self):
        """Test getting search statistics."""
        brand_id = "test-brand-stats"
        
        result = self.service.get_search_stats(brand_id)
        
        assert isinstance(result, SearchStatsResponse)
        # Currently returns placeholder data
        assert result.total_searches == 0
        assert result.vertex_ai_searches == 0
        assert result.firebase_searches == 0
        assert result.success_rate == 100.0

    def test_firebase_document_count(self):
        """Test Firebase document counting."""
        brand_id = "test-brand-count"
        
        # Mock 200 documents in Firebase
        mock_docs = [Mock() for _ in range(200)]
        
        with patch.object(self.service.db, 'collection') as mock_collection:
            mock_collection.return_value.where.return_value.stream.return_value = iter(mock_docs)
            
            count = self.service._get_firebase_document_count(brand_id)
        
        assert count == 200
        
        # Verify correct query was made
        mock_collection.assert_called_with('unifiedMedia')
        mock_collection.return_value.where.assert_called_with('brandId', '==', brand_id)

    def test_firebase_document_count_error_handling(self):
        """Test Firebase document counting error handling."""
        brand_id = "test-brand-error"
        
        # Mock error in Firebase query
        self.mock_db.collection.return_value.where.return_value.stream.side_effect = Exception("Firebase error")
        
        count = self.service._get_firebase_document_count(brand_id)
        
        # Should return 0 on error
        assert count == 0

    def test_data_store_info_not_found(self):
        """Test data store info when datastore doesn't exist."""
        brand_id = "test-brand-no-store"
        
        # Mock Google API not found exception
        from google.api_core import exceptions as google_exceptions
        
        self.mock_media_search_service.datastore_client = mock_datastore_client
        self.mock_media_search_service.datastore_client.get_data_store.side_effect = google_exceptions.NotFound("Not found")
        self.mock_media_search_service._get_datastore_path.return_value = "test-path"
        
        result = self.service._get_data_store_info(brand_id)
        
        assert result is None

    def test_service_unavailable_error(self):
        """Test handling of service unavailable errors."""
        brand_id = "test-brand-unavailable"
        
        # Mock Vertex AI service not available
        self.service.media_search_service.datastore_client = None
        
        with pytest.raises(ServiceUnavailableError) as exc_info:
            self.service.delete_data_store(brand_id)
        
        assert "not available" in str(exc_info.value).lower()


class TestSearchSettingsModels:
    """Test the Pydantic models for search settings."""

    def test_search_settings_model_validation(self):
        """Test SearchSettings model validation."""
        settings_data = {
            'brand_id': 'test-brand',
            'search_method': 'vertex_ai',
            'auto_index': True,
            'vertex_ai_enabled': True,
            'firebase_document_count': 100
        }
        
        settings = SearchSettings(**settings_data)
        
        assert settings.brand_id == 'test-brand'
        assert settings.search_method == SearchMethod.VERTEX_AI
        assert settings.auto_index == True
        assert settings.vertex_ai_enabled == True
        assert settings.firebase_document_count == 100

    def test_data_store_info_model(self):
        """Test DataStoreInfo model."""
        datastore_data = {
            'id': 'test-datastore',
            'name': 'projects/test/locations/us/dataStores/test-datastore',
            'display_name': 'Test Datastore',
            'brand_id': 'test-brand',
            'status': 'active',
            'document_count': 500,
            'created_at': '2023-01-01T00:00:00Z'
        }
        
        datastore = DataStoreInfo(**datastore_data)
        
        assert datastore.id == 'test-datastore'
        assert datastore.status == DataStoreStatus.ACTIVE
        assert datastore.document_count == 500

    def test_search_method_enum(self):
        """Test SearchMethod enum values."""
        assert SearchMethod.VERTEX_AI == 'vertex_ai'
        assert SearchMethod.FIREBASE == 'firebase'

    def test_data_store_status_enum(self):
        """Test DataStoreStatus enum values."""
        assert DataStoreStatus.ACTIVE == 'active'
        assert DataStoreStatus.CREATING == 'creating'
        assert DataStoreStatus.DELETING == 'deleting'
        assert DataStoreStatus.ERROR == 'error'
        assert DataStoreStatus.NOT_FOUND == 'not_found'

    def test_search_settings_update_request(self):
        """Test SearchSettingsUpdateRequest model."""
        update_data = {
            'search_method': 'firebase',
            'auto_index': False
        }
        
        update = SearchSettingsUpdateRequest(**update_data)
        
        assert update.search_method == SearchMethod.FIREBASE
        assert update.auto_index == False

    def test_data_store_delete_request(self):
        """Test DataStoreDeleteRequest model."""
        delete_data = {
            'brand_id': 'test-brand',
            'confirm_deletion': True
        }
        
        delete_req = DataStoreDeleteRequest(**delete_data)
        
        assert delete_req.brand_id == 'test-brand'
        assert delete_req.confirm_deletion == True

    def test_indexing_status_model(self):
        """Test IndexingStatus model."""
        indexing_data = {
            'is_indexing': True,
            'progress': 75.5,
            'items_processed': 755,
            'total_items': 1000,
            'current_operation': 'Processing videos'
        }
        
        status = IndexingStatus(**indexing_data)
        
        assert status.is_indexing == True
        assert status.progress == 75.5
        assert status.current_operation == 'Processing videos'


if __name__ == "__main__":
    # Run tests with pytest if executed directly
    pytest.main([__file__])