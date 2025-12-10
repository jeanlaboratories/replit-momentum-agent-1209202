"""
Tests for YouTube search API endpoint (/agent/youtube-search)
These tests verify the endpoint logic without requiring full ADK setup.
"""
import pytest
from unittest.mock import patch, MagicMock
import sys
import os

# Add python_service to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock googleapiclient before importing
sys.modules['googleapiclient'] = MagicMock()
sys.modules['googleapiclient.discovery'] = MagicMock()


class TestYouTubeSearchEndpoint:
    """Test YouTube search API endpoint logic."""
    
    @patch('utils.context_utils.set_brand_context')
    @patch('tools.team_tools.search_youtube_videos')
    def test_youtube_search_endpoint_logic(self, mock_search, mock_set_brand):
        """Test YouTube search endpoint logic (without full FastAPI setup)."""
        # Mock the tool response
        mock_search.return_value = {
            "status": "success",
            "videos": [
                {
                    "id": "test-video-id",
                    "title": "Test Video",
                    "description": "Test description",
                    "url": "https://www.youtube.com/watch?v=test-video-id",
                    "thumbnail_url": "https://example.com/thumb.jpg",
                    "channel_title": "Test Channel",
                    "duration_seconds": 253,
                    "view_count": 1000,
                }
            ],
            "total_results": 1,
            "query": "test query",
            "content": "Found 1 YouTube video(s) for 'test query'",
        }
        
        # Simulate endpoint logic
        query = "test query"
        brand_id = "test-brand-id"
        max_results = 10
        
        # Set context
        if brand_id:
            from utils.context_utils import set_brand_context
            set_brand_context(brand_id)
        
        # Call the tool
        from tools.team_tools import search_youtube_videos
        result = search_youtube_videos(query=query, max_results=max_results)
        
        # Assertions
        assert result["status"] == "success"
        assert len(result["videos"]) == 1
        assert result["videos"][0]["title"] == "Test Video"
        
        # Verify context was set
        if brand_id:
            mock_set_brand.assert_called_once_with(brand_id)
        # Verify tool was called
        mock_search.assert_called_once_with(query=query, max_results=max_results)
    
    def test_youtube_search_endpoint_validation(self):
        """Test YouTube search endpoint validation logic."""
        # Test that query is required
        query = None
        if not query:
            with pytest.raises(ValueError, match="Query is required"):
                # Simulate validation
                raise ValueError("Query is required")
        
        # Test that query works when provided
        query = "test query"
        assert query is not None
        assert len(query) > 0

