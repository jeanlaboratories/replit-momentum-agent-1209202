"""
Centralized configuration management for MOMENTUM Agent.

This module consolidates all environment variable access and provides
type-safe configuration with validation and default values.
"""

import os
from typing import Optional
from functools import lru_cache


class Settings:
    """
    Centralized configuration class for MOMENTUM Agent.
    
    This class provides type-safe access to all environment variables
    used throughout the application, with appropriate defaults and validation.
    """
    
    # Google API Configuration
    google_api_key: str = os.getenv('MOMENTUM_GOOGLE_API_KEY', '')
    google_application_credentials_json: Optional[str] = os.getenv('MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON')
    
    # Google Cloud Project Configuration
    project_id: str = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID', '')
    google_cloud_project: Optional[str] = os.getenv('MOMENTUM_GOOGLE_CLOUD_PROJECT')
    
    # Firebase Configuration
    firebase_storage_bucket: str = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'momentum-agent-generated')
    
    # Agent Engine Configuration
    agent_engine_id: Optional[str] = os.getenv('MOMENTUM_AGENT_ENGINE_ID')
    agent_engine_location: str = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')
    
    # Search Configuration
    search_location: str = os.getenv('MOMENTUM_SEARCH_LOCATION', 'global')
    google_custom_search_api_key: Optional[str] = os.getenv('GOOGLE_CUSTOM_SEARCH_API_KEY')
    google_custom_search_engine_id: Optional[str] = os.getenv('MOMENTUM_GOOGLE_CUSTOM_SEARCH_ENGINE_ID')
    
    # RAG Configuration
    rag_location: str = os.getenv('MOMENTUM_RAG_LOCATION', 'us-central1')
    
    # Model Configuration
    default_text_model: str = os.getenv('MOMENTUM_DEFAULT_TEXT_MODEL', 'gemini-1.5-pro-002')
    
    # External API Keys
    firecrawl_api_key: Optional[str] = os.getenv('MOMENTUM_FIRECRAWL_API_KEY')
    
    # Feature Flags
    enable_memory_bank: bool = os.getenv('MOMENTUM_ENABLE_MEMORY_BANK', 'true').lower() == 'true'
    
    def __init__(self):
        """Initialize settings and perform validation."""
        self._validate_required_settings()
    
    def _validate_required_settings(self) -> None:
        """Validate that required environment variables are set."""
        # Only validate in production - allow empty values in development/testing
        if os.getenv('MOMENTUM_ENV', 'development') == 'production':
            required_settings = [
                ('google_api_key', 'MOMENTUM_GOOGLE_API_KEY'),
                ('project_id', 'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
            ]
            
            missing_settings = []
            for attr_name, env_var_name in required_settings:
                if not getattr(self, attr_name):
                    missing_settings.append(env_var_name)
            
            if missing_settings:
                raise ValueError(
                    f"Missing required environment variables: {', '.join(missing_settings)}"
                )
    
    @property
    def effective_project_id(self) -> str:
        """Get the effective project ID, preferring google_cloud_project if set."""
        return self.google_cloud_project or self.project_id
    
    @property
    def effective_search_api_key(self) -> str:
        """Get the effective API key for search, with fallbacks."""
        return (
            self.google_custom_search_api_key or 
            os.environ.get("GOOGLE_API_KEY") or 
            self.google_api_key
        )
    
    def get_database_url(self, database_id: str = "(default)") -> str:
        """Get Firestore database URL for the given database ID."""
        return f"projects/{self.effective_project_id}/databases/{database_id}"
    
    def get_storage_bucket_url(self) -> str:
        """Get Firebase Storage bucket URL."""
        return f"gs://{self.firebase_storage_bucket}"
    
    def to_dict(self) -> dict:
        """Convert settings to dictionary, excluding sensitive values."""
        return {
            'project_id': self.project_id,
            'agent_engine_location': self.agent_engine_location,
            'search_location': self.search_location,
            'rag_location': self.rag_location,
            'default_text_model': self.default_text_model,
            'enable_memory_bank': self.enable_memory_bank,
            'firebase_storage_bucket': self.firebase_storage_bucket,
            # Sensitive values are excluded for security
        }


@lru_cache()
def get_settings() -> Settings:
    """
    Get a cached instance of the Settings class.
    
    This function uses LRU cache to ensure that Settings is instantiated
    only once and reused throughout the application lifecycle.
    
    Returns:
        Settings: The singleton Settings instance.
    """
    return Settings()


# Convenience functions for backward compatibility
def get_project_id() -> str:
    """Get the effective project ID."""
    return get_settings().effective_project_id


def get_agent_engine_location() -> str:
    """Get the agent engine location."""
    return get_settings().agent_engine_location


def get_google_api_key() -> str:
    """Get the Google API key."""
    return get_settings().google_api_key


def get_search_location() -> str:
    """Get the search service location."""
    return get_settings().search_location


def get_google_credentials(quota_project_id: str = None):
    """
    Get Google Cloud credentials, prioritizing JSON credentials secret.
    
    This avoids the GCE metadata service timeout issue in non-GCE environments
    by checking for MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON first.
    
    Args:
        quota_project_id: Optional quota project ID to set on credentials.
    
    Returns:
        Tuple of (credentials, project_id)
    """
    import json
    import google.auth
    from google.oauth2 import service_account
    
    settings = get_settings()
    
    # Try JSON credentials from secret first (fastest, no network calls)
    if settings.google_application_credentials_json:
        try:
            credentials_info = json.loads(settings.google_application_credentials_json)
            credentials = service_account.Credentials.from_service_account_info(
                credentials_info,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            if quota_project_id:
                credentials = credentials.with_quota_project(quota_project_id)
            project_id = credentials_info.get('project_id', settings.effective_project_id)
            return credentials, project_id
        except (json.JSONDecodeError, ValueError) as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to parse credentials JSON: {e}")
    
    # Fall back to default credentials (may try GCE metadata, slower)
    return google.auth.default(quota_project_id=quota_project_id)