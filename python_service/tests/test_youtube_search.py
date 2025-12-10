"""
Tests for YouTube search tool (search_youtube_videos)
"""
import pytest
from unittest.mock import patch, MagicMock
import sys

# Mock googleapiclient before importing
sys.modules['googleapiclient'] = MagicMock()
sys.modules['googleapiclient.discovery'] = MagicMock()

from tools.team_tools import search_youtube_videos, save_youtube_video_to_library, _parse_duration, _format_duration


class TestYouTubeSearch:
    """Test YouTube search functionality."""
    
    @patch('tools.team_tools.get_settings')
    @patch('googleapiclient.discovery.build')
    def test_search_youtube_videos_success(self, mock_build, mock_get_settings):
        """Test successful YouTube video search."""
        # Setup mocks
        mock_settings = MagicMock()
        mock_settings.google_api_key = 'test-api-key'
        mock_get_settings.return_value = mock_settings
        
        # Mock YouTube API response
        mock_youtube = MagicMock()
        mock_build.return_value = mock_youtube
        
        # Mock search response
        mock_search_response = {
            'items': [
                {
                    'id': {'videoId': 'test-video-id-1', 'kind': 'youtube#video'},
                    'snippet': {
                        'title': 'Test Video 1',
                        'description': 'Test description 1',
                        'channelTitle': 'Test Channel',
                        'channelId': 'channel-1',
                        'publishedAt': '2024-01-01T00:00:00Z',
                        'thumbnails': {
                            'high': {'url': 'https://example.com/thumb1.jpg'}
                        },
                        'tags': ['test', 'video']
                    }
                }
            ]
        }
        
        # Mock videos().list() response
        mock_videos_response = {
            'items': [
                {
                    'id': 'test-video-id-1',
                    'snippet': {
                        'title': 'Test Video 1',
                        'description': 'Test description 1',
                        'channelTitle': 'Test Channel',
                        'channelId': 'channel-1',
                        'publishedAt': '2024-01-01T00:00:00Z',
                        'thumbnails': {
                            'high': {'url': 'https://example.com/thumb1.jpg'}
                        },
                        'tags': ['test', 'video']
                    },
                    'statistics': {
                        'viewCount': '1000',
                        'likeCount': '50',
                        'commentCount': '10'
                    },
                    'contentDetails': {
                        'duration': 'PT4M13S'
                    }
                }
            ]
        }
        
        mock_youtube.search.return_value.list.return_value.execute.return_value = mock_search_response
        mock_youtube.videos.return_value.list.return_value.execute.return_value = mock_videos_response
        
        # Call function
        result = search_youtube_videos('test query', max_results=10)
        
        # Assertions
        assert result['status'] == 'success'
        assert len(result['videos']) == 1
        assert result['videos'][0]['id'] == 'test-video-id-1'
        assert result['videos'][0]['title'] == 'Test Video 1'
        assert result['videos'][0]['url'] == 'https://www.youtube.com/watch?v=test-video-id-1'
        assert result['total_results'] == 1
        assert '__VIDEO_URL__' in result['content']
        assert 'test-video-id-1' in result['content']
        
        # Verify API was called correctly
        mock_build.assert_called_once_with('youtube', 'v3', developerKey='test-api-key')
        mock_youtube.search.return_value.list.assert_called_once()
        mock_youtube.videos.return_value.list.assert_called_once()
    
    @patch('tools.team_tools.get_settings')
    def test_search_youtube_videos_no_api_key(self, mock_get_settings):
        """Test YouTube search without API key."""
        mock_settings = MagicMock()
        mock_settings.google_api_key = ''
        mock_get_settings.return_value = mock_settings
        
        result = search_youtube_videos('test query')
        
        assert result['status'] == 'error'
        assert 'API key' in result['error']
        assert result['videos'] == []
        assert result['total_results'] == 0
    
    @patch('tools.team_tools.get_settings')
    @patch('googleapiclient.discovery.build')
    def test_search_youtube_videos_no_results(self, mock_build, mock_get_settings):
        """Test YouTube search with no results."""
        mock_settings = MagicMock()
        mock_settings.google_api_key = 'test-api-key'
        mock_get_settings.return_value = mock_settings
        
        mock_youtube = MagicMock()
        mock_build.return_value = mock_youtube
        mock_youtube.search.return_value.list.return_value.execute.return_value = {'items': []}
        
        result = search_youtube_videos('nonexistent query')
        
        assert result['status'] == 'success'
        assert result['videos'] == []
        assert result['total_results'] == 0
        assert 'No YouTube videos found' in result['content']
    
    @patch('tools.team_tools.get_settings')
    @patch('googleapiclient.discovery.build')
    def test_search_youtube_videos_api_error(self, mock_build, mock_get_settings):
        """Test YouTube search with API error."""
        mock_settings = MagicMock()
        mock_settings.google_api_key = 'test-api-key'
        mock_get_settings.return_value = mock_settings
        
        mock_youtube = MagicMock()
        mock_build.return_value = mock_youtube
        mock_youtube.search.return_value.list.return_value.execute.side_effect = Exception('API Error')
        
        result = search_youtube_videos('test query')
        
        assert result['status'] == 'error'
        assert 'API Error' in result['error']
        assert result['videos'] == []
        assert result['total_results'] == 0


class TestYouTubeSave:
    """Test YouTube video saving functionality."""
    
    @patch('tools.team_tools.get_brand_context')
    @patch('tools.team_tools.requests.post')
    def test_save_youtube_video_success(self, mock_post, mock_get_brand_context):
        """Test successful YouTube video save."""
        mock_get_brand_context.return_value = 'test-brand-id'
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'mediaId': 'test-media-id',
            'message': 'YouTube video saved to media library'
        }
        mock_post.return_value = mock_response
        
        result = save_youtube_video_to_library(
            video_url='https://www.youtube.com/watch?v=test-video-id',
            brand_id='test-brand-id',
            title='Test Video',
            description='Test description',
            thumbnail_url='https://example.com/thumb.jpg',
            channel_title='Test Channel'
        )
        
        assert result['status'] == 'success'
        assert result['media_id'] == 'test-media-id'
        assert 'saved to media library' in result['message']
        
        # Verify API was called
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == 'http://127.0.0.1:5000/api/media-library/save-youtube'
        assert call_args[1]['json']['videoUrl'] == 'https://www.youtube.com/watch?v=test-video-id'
        assert call_args[1]['json']['brandId'] == 'test-brand-id'
    
    @patch('tools.team_tools.get_brand_context')
    def test_save_youtube_video_no_brand_id(self, mock_get_brand_context):
        """Test YouTube video save without brand ID."""
        mock_get_brand_context.return_value = None
        
        result = save_youtube_video_to_library(
            video_url='https://www.youtube.com/watch?v=test-video-id'
        )
        
        assert result['status'] == 'error'
        assert 'Brand ID required' in result['error']
    
    @patch('tools.team_tools.get_brand_context')
    def test_save_youtube_video_invalid_url(self, mock_get_brand_context):
        """Test YouTube video save with invalid URL."""
        mock_get_brand_context.return_value = 'test-brand-id'
        
        result = save_youtube_video_to_library(
            video_url='https://invalid-url.com',
            brand_id='test-brand-id'
        )
        
        assert result['status'] == 'error'
        assert 'Invalid YouTube URL' in result['error']
    
    @patch('tools.team_tools.get_brand_context')
    @patch('tools.team_tools.requests.post')
    def test_save_youtube_video_already_exists(self, mock_post, mock_get_brand_context):
        """Test YouTube video save when video already exists."""
        mock_get_brand_context.return_value = 'test-brand-id'
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'mediaId': 'existing-media-id',
            'message': 'YouTube video already exists in media library',
            'alreadyExists': True
        }
        mock_post.return_value = mock_response
        
        result = save_youtube_video_to_library(
            video_url='https://www.youtube.com/watch?v=test-video-id',
            brand_id='test-brand-id'
        )
        
        assert result['status'] == 'success'
        assert result['already_exists'] is True


class TestDurationHelpers:
    """Test duration parsing and formatting helpers."""
    
    def test_parse_duration_seconds(self):
        """Test parsing duration in seconds."""
        assert _parse_duration('PT30S') == 30
        assert _parse_duration('PT1S') == 1
    
    def test_parse_duration_minutes(self):
        """Test parsing duration in minutes."""
        assert _parse_duration('PT4M') == 240
        assert _parse_duration('PT4M13S') == 253
    
    def test_parse_duration_hours(self):
        """Test parsing duration in hours."""
        assert _parse_duration('PT1H') == 3600
        assert _parse_duration('PT1H30M') == 5400
        assert _parse_duration('PT1H30M45S') == 5445
    
    def test_parse_duration_empty(self):
        """Test parsing empty duration."""
        assert _parse_duration('') == 0
        assert _parse_duration(None) == 0
    
    def test_format_duration_seconds(self):
        """Test formatting duration in seconds."""
        assert _format_duration(30) == '30s'
        assert _format_duration(1) == '1s'
    
    def test_format_duration_minutes(self):
        """Test formatting duration in minutes."""
        assert _format_duration(240) == '4m'
        assert _format_duration(253) == '4m 13s'
    
    def test_format_duration_hours(self):
        """Test formatting duration in hours."""
        assert _format_duration(3600) == '1h'
        assert _format_duration(5400) == '1h 30m'
        assert _format_duration(5445) == '1h 30m 45s'

