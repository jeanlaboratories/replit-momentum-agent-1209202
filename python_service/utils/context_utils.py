from typing import Optional, Dict, Any, List

_current_brand_id = None
_current_user_id = None
_current_settings = {}
_current_media = []
_current_team_context = {}

def set_brand_context(brand_id: Optional[str]):
    """Set the current brand ID for tool calls"""
    global _current_brand_id
    _current_brand_id = brand_id

def get_brand_context() -> Optional[str]:
    return _current_brand_id

def set_user_context(user_id: Optional[str]):
    """Set the current user ID for tool calls"""
    global _current_user_id
    _current_user_id = user_id

def get_user_context() -> Optional[str]:
    return _current_user_id

def set_settings_context(settings: Dict[str, Any]):
    """Set the current AI model settings for tool calls"""
    global _current_settings
    _current_settings = settings or {}

def get_settings_context() -> Dict[str, Any]:
    return _current_settings

def set_media_context(media: List[Any]):
    """Set the current media files for tool calls"""
    global _current_media
    _current_media = media or []

def get_media_context() -> List[Any]:
    return _current_media

def set_team_context(context: Dict[str, Any]):
    """Set the current team context for tool calls"""
    global _current_team_context
    _current_team_context = context or {}

def get_team_context() -> Dict[str, Any]:
    return _current_team_context
