"""
Search settings data models for managing search configuration and data stores.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class SearchMethod(str, Enum):
    """Supported search methods."""
    VERTEX_AI = "vertex_ai"
    FIREBASE = "firebase"


class DataStoreStatus(str, Enum):
    """Data store status values."""
    ACTIVE = "active"
    CREATING = "creating"
    DELETING = "deleting"
    ERROR = "error"
    NOT_FOUND = "not_found"


class DataStoreInfo(BaseModel):
    """Information about a Vertex AI data store."""
    id: str = Field(..., description="Data store ID")
    name: str = Field(..., description="Full data store resource name")
    display_name: str = Field(..., description="Human-readable display name")
    brand_id: str = Field(..., description="Associated brand ID")
    status: DataStoreStatus = Field(..., description="Current status")
    document_count: int = Field(default=0, description="Number of indexed documents")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    last_indexed: Optional[str] = Field(None, description="Last indexing timestamp")
    size_bytes: Optional[int] = Field(None, description="Data store size in bytes")


class SearchSettings(BaseModel):
    """Search configuration settings for a brand."""
    brand_id: str = Field(..., description="Brand ID")
    search_method: SearchMethod = Field(default=SearchMethod.VERTEX_AI, description="Active search method")
    auto_index: bool = Field(default=True, description="Whether to automatically index new media")
    vertex_ai_enabled: bool = Field(default=True, description="Whether Vertex AI Search is available")
    data_store_info: Optional[DataStoreInfo] = Field(None, description="Data store information")
    firebase_document_count: int = Field(default=0, description="Number of documents in Firebase")
    last_sync: Optional[str] = Field(None, description="Last synchronization timestamp")


class SearchSettingsUpdateRequest(BaseModel):
    """Request to update search settings."""
    search_method: Optional[SearchMethod] = Field(None, description="Search method to use")
    auto_index: Optional[bool] = Field(None, description="Auto-indexing preference")


class DataStoreDeleteRequest(BaseModel):
    """Request to delete a data store."""
    brand_id: str = Field(..., description="Brand ID")
    confirm_deletion: bool = Field(..., description="Confirmation that user wants to delete")


class DataStoreCreateRequest(BaseModel):
    """Request to create or recreate a data store."""
    brand_id: str = Field(..., description="Brand ID")
    force_recreate: bool = Field(default=False, description="Force recreation if exists")


class SearchStatsResponse(BaseModel):
    """Response with search statistics."""
    total_searches: int = Field(default=0, description="Total number of searches")
    vertex_ai_searches: int = Field(default=0, description="Searches using Vertex AI")
    firebase_searches: int = Field(default=0, description="Searches using Firebase")
    avg_response_time: float = Field(default=0.0, description="Average response time in ms")
    success_rate: float = Field(default=0.0, description="Search success rate")


class IndexingStatus(BaseModel):
    """Current indexing operation status."""
    is_indexing: bool = Field(default=False, description="Whether indexing is in progress")
    progress: float = Field(default=0.0, description="Indexing progress (0-100)")
    items_processed: int = Field(default=0, description="Number of items processed")
    total_items: int = Field(default=0, description="Total items to process")
    started_at: Optional[str] = Field(None, description="Indexing start time")
    estimated_completion: Optional[str] = Field(None, description="Estimated completion time")
    current_operation: str = Field(default="", description="Current operation description")