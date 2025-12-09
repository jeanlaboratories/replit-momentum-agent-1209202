"""
Configuration management for the MOMENTUM Agent service.

This module provides centralized access to environment variables and configuration settings.
"""

from .settings import Settings, get_settings, get_google_credentials

__all__ = ['Settings', 'get_settings', 'get_google_credentials']