"""
Search Settings Service for managing search configuration and data stores.

This service handles search method switching, data store management,
and search settings persistence.
"""

import logging
import time
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from firebase_admin import firestore
from google.cloud import discoveryengine_v1 as discoveryengine

from config import get_settings
from config.exceptions import (
    ResourceNotFoundError, 
    ServiceUnavailableError, 
    ValidationError,
    handle_external_api_error
)
from models.search_settings import (
    SearchSettings, 
    SearchMethod, 
    DataStoreInfo, 
    DataStoreStatus,
    IndexingStatus,
    SearchStatsResponse
)
from services.media_search_service import get_media_search_service

logger = logging.getLogger(__name__)


class SearchSettingsService:
    """
    Service for managing search settings and data store operations.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.db = firestore.client()
        self.media_search_service = get_media_search_service()
    
    def get_search_settings(self, brand_id: str) -> SearchSettings:
        """
        Get current search settings for a brand.
        
        Args:
            brand_id: Brand ID to get settings for
            
        Returns:
            SearchSettings: Current search configuration
        """
        try:
            # Get settings from Firestore
            settings_ref = self.db.collection('brands').document(brand_id).collection('settings').document('search')
            settings_doc = settings_ref.get()
            
            settings_data = settings_doc.to_dict() if settings_doc.exists else {}
            
            # Get data store information if using Vertex AI
            data_store_info = None
            vertex_ai_enabled = True
            
            try:
                data_store_info = self._get_data_store_info(brand_id)
                if data_store_info is None:
                    vertex_ai_enabled = False
            except Exception as e:
                logger.warning(f"Could not get data store info for {brand_id}: {e}")
                vertex_ai_enabled = False
            
            # Get Firebase document count
            firebase_count = self._get_firebase_document_count(brand_id)
            
            return SearchSettings(
                brand_id=brand_id,
                search_method=SearchMethod(settings_data.get('search_method', SearchMethod.VERTEX_AI)),
                auto_index=settings_data.get('auto_index', True),
                vertex_ai_enabled=vertex_ai_enabled,
                data_store_info=data_store_info,
                firebase_document_count=firebase_count,
                last_sync=settings_data.get('last_sync')
            )
            
        except Exception as e:
            logger.error(f"Error getting search settings for {brand_id}: {e}")
            # Return default settings on error
            return SearchSettings(
                brand_id=brand_id,
                search_method=SearchMethod.FIREBASE,
                vertex_ai_enabled=False,
                firebase_document_count=self._get_firebase_document_count(brand_id)
            )
    
    def update_search_settings(
        self, 
        brand_id: str, 
        search_method: Optional[SearchMethod] = None,
        auto_index: Optional[bool] = None
    ) -> SearchSettings:
        """
        Update search settings for a brand.
        
        Args:
            brand_id: Brand ID to update
            search_method: New search method to use
            auto_index: New auto-index preference
            
        Returns:
            SearchSettings: Updated search configuration
        """
        try:
            settings_ref = self.db.collection('brands').document(brand_id).collection('settings').document('search')
            
            # Get current settings
            current_data = {}
            current_doc = settings_ref.get()
            if current_doc.exists:
                current_data = current_doc.to_dict()
            
            # Update only provided fields
            updates = {}
            if search_method is not None:
                updates['search_method'] = search_method.value
            if auto_index is not None:
                updates['auto_index'] = auto_index
                
            if updates:
                updates['last_sync'] = datetime.now(timezone.utc).isoformat()
                current_data.update(updates)
                settings_ref.set(current_data, merge=True)
                
                logger.info(f"Updated search settings for {brand_id}: {updates}")
            
            return self.get_search_settings(brand_id)
            
        except Exception as e:
            error = handle_external_api_error(e, "Firebase", "update search settings")
            logger.error(f"Error updating search settings for {brand_id}: {error.message}")
            raise error
    
    def _get_data_store_info(self, brand_id: str) -> Optional[DataStoreInfo]:
        """Get information about the brand's Vertex AI data store."""
        try:
            if not self.media_search_service.datastore_client:
                return None
                
            # Check if we have a cached datastore name first
            datastore_id = self.media_search_service._get_datastore_id(brand_id)
            from services.media_search_service import _datastore_cache
            
            if datastore_id in _datastore_cache:
                # Use cached name (which includes timestamp if created that way)
                datastore_name = _datastore_cache[datastore_id]
            else:
                # Try the expected path for older datastores
                datastore_name = self.media_search_service._get_datastore_path(brand_id)
                
            datastore = self.media_search_service.datastore_client.get_data_store(name=datastore_name)
            
            # Get document count (this is an estimate)
            document_count = self._get_datastore_document_count(brand_id)
            
            return DataStoreInfo(
                id=self.media_search_service._get_datastore_id(brand_id),
                name=datastore.name,
                display_name=datastore.display_name,
                brand_id=brand_id,
                status=DataStoreStatus.ACTIVE,
                document_count=document_count,
                created_at=datastore.create_time.isoformat() if datastore.create_time else None
            )
            
        except Exception as e:
            # Handle NotFound or any other exception
            if hasattr(e, '__class__') and 'NotFound' in str(type(e)):
                return None
            logger.warning(f"Error getting data store info for {brand_id}: {e}")
            return None
    
    def _get_datastore_document_count(self, brand_id: str) -> int:
        """Get approximate document count in data store."""
        try:
            # This would require listing documents, which can be expensive
            # For now, return count from Firebase as approximation
            return self._get_firebase_document_count(brand_id)
        except Exception:
            return 0
    
    def _get_firebase_document_count(self, brand_id: str) -> int:
        """Get count of media documents in Firebase."""
        try:
            media_ref = self.db.collection('unifiedMedia')
            query = media_ref.where('brandId', '==', brand_id)
            
            # Use get() to count documents (expensive but accurate)
            docs = query.stream()
            count = sum(1 for _ in docs)
            return count
            
        except Exception as e:
            logger.warning(f"Error counting Firebase documents for {brand_id}: {e}")
            return 0
    
    def delete_data_store(self, brand_id: str) -> Dict[str, Any]:
        """
        Delete a brand's Vertex AI data store.
        
        Args:
            brand_id: Brand ID whose data store to delete
            
        Returns:
            Dict with deletion status and details
        """
        try:
            if not self.media_search_service.datastore_client:
                raise ServiceUnavailableError("Vertex AI Search not available")
            
            # Check if data store exists
            data_store_info = self._get_data_store_info(brand_id)
            if not data_store_info:
                raise ResourceNotFoundError(f"No data store found for brand {brand_id}")
            
            # Delete the data store
            success = self.media_search_service.delete_datastore(brand_id)
            
            if success:
                # Update settings to reflect deletion
                settings_ref = self.db.collection('brands').document(brand_id).collection('settings').document('search')
                settings_ref.set({
                    'search_method': SearchMethod.FIREBASE.value,
                    'last_sync': datetime.now(timezone.utc).isoformat()
                }, merge=True)
                
                logger.info(f"Successfully deleted data store for brand {brand_id}")
                return {
                    'success': True,
                    'message': f'Data store for brand {brand_id} deleted successfully',
                    'switched_to_firebase': True
                }
            else:
                raise ServiceUnavailableError("Failed to delete data store")
                
        except Exception as e:
            if isinstance(e, (ResourceNotFoundError, ServiceUnavailableError)):
                raise
            error = handle_external_api_error(e, "Vertex AI Search", "delete data store")
            logger.error(f"Error deleting data store for {brand_id}: {error.message}")
            raise error
    
    def create_data_store(self, brand_id: str, force_recreate: bool = False) -> Dict[str, Any]:
        """
        Create or recreate a brand's Vertex AI data store.
        
        Args:
            brand_id: Brand ID to create data store for
            force_recreate: Whether to delete existing store first
            
        Returns:
            Dict with creation status and details
        """
        try:
            if not self.media_search_service.datastore_client:
                raise ServiceUnavailableError("Vertex AI Search not available")
            
            # Check if data store already exists
            existing_info = self._get_data_store_info(brand_id)
            
            if existing_info and not force_recreate:
                return {
                    'success': False,
                    'message': f'Data store already exists for brand {brand_id}. Use force_recreate=true to recreate.',
                    'existing_store': existing_info.model_dump()
                }
            
            # Delete existing if force recreating
            if existing_info and force_recreate:
                self.delete_data_store(brand_id)
                # Wait a moment for deletion to complete
                time.sleep(2)
            
            # Create new data store
            datastore_name = self.media_search_service._get_or_create_datastore(brand_id)
            
            if datastore_name:
                # Update settings to use Vertex AI
                settings_ref = self.db.collection('brands').document(brand_id).collection('settings').document('search')
                settings_ref.set({
                    'search_method': SearchMethod.VERTEX_AI.value,
                    'last_sync': datetime.now(timezone.utc).isoformat()
                }, merge=True)
                
                logger.info(f"Successfully created data store for brand {brand_id}: {datastore_name}")
                return {
                    'success': True,
                    'message': f'Data store created successfully for brand {brand_id}',
                    'datastore_name': datastore_name,
                    'switched_to_vertex_ai': True
                }
            else:
                raise ServiceUnavailableError("Failed to create data store")
                
        except Exception as e:
            if isinstance(e, (ServiceUnavailableError, ValidationError)):
                raise
            error = handle_external_api_error(e, "Vertex AI Search", "create data store")
            logger.error(f"Error creating data store for {brand_id}: {error.message}")
            raise error
    
    def get_indexing_status(self, brand_id: str) -> IndexingStatus:
        """
        Get current indexing status for a brand.
        
        Args:
            brand_id: Brand ID to check
            
        Returns:
            IndexingStatus: Current indexing operation status
        """
        try:
            # Check for active indexing operations in Firestore
            status_ref = self.db.collection('brands').document(brand_id).collection('status').document('indexing')
            status_doc = status_ref.get()
            
            if not status_doc.exists:
                return IndexingStatus()
            
            status_data = status_doc.to_dict()
            return IndexingStatus(**status_data)
            
        except Exception as e:
            logger.error(f"Error getting indexing status for {brand_id}: {e}")
            return IndexingStatus()
    
    def get_search_stats(self, brand_id: str) -> SearchStatsResponse:
        """
        Get search statistics for a brand.
        
        Args:
            brand_id: Brand ID to get stats for
            
        Returns:
            SearchStatsResponse: Search usage statistics
        """
        try:
            # This would typically come from analytics/logging data
            # For now, return placeholder data
            return SearchStatsResponse(
                total_searches=0,
                vertex_ai_searches=0,
                firebase_searches=0,
                avg_response_time=0.0,
                success_rate=100.0
            )
            
        except Exception as e:
            logger.error(f"Error getting search stats for {brand_id}: {e}")
            return SearchStatsResponse()


# Singleton instance
_search_settings_service: Optional[SearchSettingsService] = None


def get_search_settings_service() -> SearchSettingsService:
    """Get the singleton Search Settings service instance."""
    global _search_settings_service
    if _search_settings_service is None:
        _search_settings_service = SearchSettingsService()
    return _search_settings_service