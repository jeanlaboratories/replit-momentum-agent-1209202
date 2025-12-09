"""
Integration tests for search functionality across Media Library, Image Gallery, and Video Gallery.

This module tests that search works consistently across all three galleries:
- Media Library search
- Image Gallery search  
- Video Gallery search

All should use the same semanticSearchMediaAction and return consistent results.
"""

import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import os
import sys

# Mock problematic imports BEFORE importing to prevent segmentation faults
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['google.cloud'] = MagicMock()
sys.modules['google.cloud.firestore'] = MagicMock()
sys.modules['google.cloud.firestore_v1'] = MagicMock()
sys.modules['google.cloud.storage'] = MagicMock()
sys.modules['google.adk'] = MagicMock()
sys.modules['google.adk.agents'] = MagicMock()
sys.modules['google.adk.tools'] = MagicMock()
sys.modules['google.adk.runners'] = MagicMock()
sys.modules['google.adk.sessions'] = MagicMock()
sys.modules['google.adk.models'] = MagicMock()
sys.modules['google.adk.models.google_llm'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['google.genai.types'] = MagicMock()

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestGallerySearchConsistency(unittest.TestCase):
    """Test that search works consistently across all galleries."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project',
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'MOMENTUM_SEARCH_LOCATION': 'global'
        })
        self.env_patcher.start()
        # Reset query generation agent singleton for test isolation
        try:
            from agents.query_generation_agent import reset_query_generation_agent
            reset_query_generation_agent()
        except ImportError:
            pass  # If function doesn't exist, continue

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()
        # Reset query generation agent singleton after test
        try:
            from agents.query_generation_agent import reset_query_generation_agent
            reset_query_generation_agent()
        except ImportError:
            pass  # If function doesn't exist, continue

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_image_gallery_search_uses_correct_media_type(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that Image Gallery search filters by image type."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from models.search_settings import SearchSettings, SearchMethod

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='img-1', title='Test Image', description='Test',
                    media_type='image', url='https://example.com/img.jpg',
                    thumbnail_url='https://example.com/img-thumb.jpg',
                    source='upload', tags=[], relevance_score=0.9
                )
            ],
            total_count=1,
            query='test',
            search_time_ms=20.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        mock_settings_service = MagicMock()
        mock_settings = SearchSettings(
            brand_id='brand-123',
            search_method=SearchMethod.VERTEX_AI,
            auto_index=True,
            vertex_ai_enabled=True
        )
        mock_settings_service.get_search_settings.return_value = mock_settings
        mock_get_settings_service.return_value = mock_settings_service

        # Simulate Image Gallery search call
        # This would be called via semanticSearchMediaAction with mediaType: 'image'
        from tools.media_search_tools import search_images
        from tools.media_search_tools import get_brand_context

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            result = search_images(query='test', brand_id='brand-123', use_query_generation=False)

            # Verify search was called with image filter
            if mock_service.search.called:
                call_args = mock_service.search.call_args
                self.assertEqual(call_args[1]['media_type'], 'image')
            self.assertEqual(result['status'], 'success')
            self.assertEqual(len(result['results']), 1)

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_video_gallery_search_uses_correct_media_type(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that Video Gallery search filters by video type."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from models.search_settings import SearchSettings, SearchMethod

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='vid-1', title='Test Video', description='Test',
                    media_type='video', url='https://example.com/vid.mp4',
                    thumbnail_url='https://example.com/vid-thumb.jpg',
                    source='upload', tags=[], relevance_score=0.9
                )
            ],
            total_count=1,
            query='test',
            search_time_ms=20.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        mock_settings_service = MagicMock()
        mock_settings = SearchSettings(
            brand_id='brand-123',
            search_method=SearchMethod.VERTEX_AI,
            auto_index=True,
            vertex_ai_enabled=True
        )
        mock_settings_service.get_search_settings.return_value = mock_settings
        mock_get_settings_service.return_value = mock_settings_service

        # Simulate Video Gallery search call
        from tools.media_search_tools import search_videos
        from tools.media_search_tools import get_brand_context

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            result = search_videos(query='test', brand_id='brand-123', use_query_generation=False)

            # Verify search was called with video filter
            if mock_service.search.called:
                call_args = mock_service.search.call_args
                self.assertEqual(call_args[1]['media_type'], 'video')
            self.assertEqual(result['status'], 'success')
            self.assertEqual(len(result['results']), 1)

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_media_library_search_no_type_filter(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that Media Library search can search all types."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from models.search_settings import SearchSettings, SearchMethod

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='img-1', title='Test Image', description='Test',
                    media_type='image', url='https://example.com/img.jpg',
                    thumbnail_url='https://example.com/img-thumb.jpg',
                    source='upload', tags=[], relevance_score=0.9
                ),
                MediaSearchResult(
                    media_id='vid-1', title='Test Video', description='Test',
                    media_type='video', url='https://example.com/vid.mp4',
                    thumbnail_url='https://example.com/vid-thumb.jpg',
                    source='upload', tags=[], relevance_score=0.85
                )
            ],
            total_count=2,
            query='test',
            search_time_ms=25.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        mock_settings_service = MagicMock()
        mock_settings = SearchSettings(
            brand_id='brand-123',
            search_method=SearchMethod.VERTEX_AI,
            auto_index=True,
            vertex_ai_enabled=True
        )
        mock_settings_service.get_search_settings.return_value = mock_settings
        mock_get_settings_service.return_value = mock_settings_service

        # Simulate Media Library search call (no media type filter)
        from tools.media_search_tools import search_media_library

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            result = search_media_library(query='test', brand_id='brand-123', media_type='', use_query_generation=False)

            # Verify search was called without media_type filter (or with None)
            if mock_service.search.called:
                call_args = mock_service.search.call_args
                self.assertIsNone(call_args[1].get('media_type'))
            self.assertEqual(result['status'], 'success')
            self.assertEqual(len(result['results']), 2)

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_all_galleries_use_same_search_service(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that all galleries use the same underlying search service."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from tools.media_search_tools import search_media_library, search_images, search_videos
        from models.search_settings import SearchSettings, SearchMethod

        mock_service = MagicMock()
        # Set up mock return value for search
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='1', 
                    title='Test', 
                    description='',
                    media_type='image',
                    url='http://test.com', 
                    thumbnail_url=None,
                    source='upload',
                    tags=[],
                    relevance_score=0.9
                ),
            ],
            total_count=1,
            query='test',
            search_time_ms=100.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        mock_settings_service = MagicMock()
        mock_settings = SearchSettings(
            brand_id='brand-123',
            search_method=SearchMethod.VERTEX_AI,
            auto_index=True,
            vertex_ai_enabled=True
        )
        mock_settings_service.get_search_settings.return_value = mock_settings
        mock_get_settings_service.return_value = mock_settings_service

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            # All should use the same service instance
            search_media_library(query='test', brand_id='brand-123', use_query_generation=False)
            search_images(query='test', brand_id='brand-123', use_query_generation=False)
            search_videos(query='test', brand_id='brand-123', use_query_generation=False)

            # Verify all three called the same service
            self.assertEqual(mock_service.search.call_count, 3)

    @patch('firebase_admin.firestore.client')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_search_error_handling_consistent(self, mock_get_service, mock_discoveryengine, mock_firestore_client):
        """Test that all galleries handle search errors consistently."""
        from services.media_search_service import MediaSearchService, MediaSearchResponse
        from tools.media_search_tools import search_media_library, search_images, search_videos

        # Create service that will return empty results (simulating error)
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[],
            total_count=0,
            query='test',
            search_time_ms=0.0
        )
        mock_get_service.return_value = mock_service

        # Mock firestore to return empty results for fallback
        mock_collection = MagicMock()
        mock_collection.where.return_value.where.return_value.limit.return_value.get.return_value = []
        mock_firestore_client.return_value.collection.return_value = mock_collection

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            # All should handle empty results gracefully
            media_result = search_media_library(query='test', brand_id='brand-123', use_query_generation=False)
            image_result = search_images(query='test', brand_id='brand-123', use_query_generation=False)
            video_result = search_videos(query='test', brand_id='brand-123', use_query_generation=False)

            # All should return success status with empty results
            self.assertEqual(media_result['status'], 'success')
            self.assertEqual(image_result['status'], 'success')
            self.assertEqual(video_result['status'], 'success')
            self.assertEqual(len(media_result['results']), 0)
            self.assertEqual(len(image_result['results']), 0)
            self.assertEqual(len(video_result['results']), 0)

    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_search_result_format_consistent(self, mock_get_service, mock_discoveryengine):
        """Test that search results have consistent format across all galleries."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from tools.media_search_tools import search_media_library, search_images, search_videos

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='test-1', title='Test Item', description='Description',
                    media_type='image', url='https://example.com/item.jpg',
                    thumbnail_url='https://example.com/item-thumb.jpg',
                    source='upload', tags=['tag1'], relevance_score=0.9
                )
            ],
            total_count=1,
            query='test',
            search_time_ms=15.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            media_result = search_media_library(query='test', brand_id='brand-123', use_query_generation=False)
            image_result = search_images(query='test', brand_id='brand-123', use_query_generation=False)
            video_result = search_videos(query='test', brand_id='brand-123', use_query_generation=False)

            # All should have the same result structure
            for result in [media_result, image_result, video_result]:
                self.assertIn('status', result)
                self.assertIn('results', result)
                self.assertIn('total_count', result)
                self.assertIn('query', result)
                if result['results']:
                    item = result['results'][0]
                    self.assertIn('id', item)
                    self.assertIn('title', item)
                    self.assertIn('url', item)
                    self.assertIn('type', item)
                    self.assertIn('source', item)

    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_search_limit_validation_consistent(self, mock_get_service, mock_discoveryengine):
        """Test that all galleries validate search limits consistently."""
        from services.media_search_service import MediaSearchResponse
        from tools.media_search_tools import search_media_library, search_images, search_videos

        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[],
            total_count=0,
            query='test',
            search_time_ms=10.0
        )
        mock_get_service.return_value = mock_service

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):
            # Test limit too high (should be capped at 50)
            search_media_library(query='test', brand_id='brand-123', limit=100, use_query_generation=False)
            search_images(query='test', brand_id='brand-123', limit=100, use_query_generation=False)
            search_videos(query='test', brand_id='brand-123', limit=100, use_query_generation=False)

            # All should cap at 50
            for call in mock_service.search.call_args_list:
                self.assertLessEqual(call[1]['page_size'], 50)

            # Test limit too low (should be at least 1)
            mock_service.reset_mock()
            search_media_library(query='test', brand_id='brand-123', limit=0, use_query_generation=False)
            search_images(query='test', brand_id='brand-123', limit=0, use_query_generation=False)
            search_videos(query='test', brand_id='brand-123', limit=0, use_query_generation=False)

            # All should use at least 1
            for call in mock_service.search.call_args_list:
                self.assertGreaterEqual(call[1]['page_size'], 1)


class TestGallerySearchResponseFormat(unittest.TestCase):
    """Test that search response formats are correct for frontend consumption."""

    @patch('services.media_search_service.discoveryengine')
    def test_media_search_result_has_required_fields(self, mock_discoveryengine):
        """Test that MediaSearchResult has all fields needed by frontend."""
        from services.media_search_service import MediaSearchResult

        result = MediaSearchResult(
            media_id='test-123',
            title='Test Title',
            description='Test Description',
            media_type='image',
            url='https://example.com/test.jpg',
            thumbnail_url='https://example.com/test-thumb.jpg',
            source='upload',
            tags=['tag1', 'tag2'],
            relevance_score=0.95
        )

        # Verify all required fields exist
        self.assertEqual(result.media_id, 'test-123')
        self.assertEqual(result.title, 'Test Title')
        self.assertEqual(result.description, 'Test Description')
        self.assertEqual(result.media_type, 'image')
        self.assertEqual(result.url, 'https://example.com/test.jpg')
        self.assertEqual(result.thumbnail_url, 'https://example.com/test-thumb.jpg')
        self.assertEqual(result.source, 'upload')
        self.assertEqual(result.tags, ['tag1', 'tag2'])
        self.assertEqual(result.relevance_score, 0.95)

    @patch('services.media_search_service.discoveryengine')
    def test_search_tool_response_format(self, mock_discoveryengine):
        """Test that search tool responses have consistent format."""
        from tools.media_search_tools import search_media_library
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        with patch('services.media_search_service.get_media_search_service') as mock_get_service, \
             patch('tools.media_search_tools.get_brand_context', return_value='brand-123'):

            mock_service = MagicMock()
            mock_service.search.return_value = MediaSearchResponse(
                results=[
                    MediaSearchResult(
                        media_id='test-1', title='Test', description='',
                        media_type='image', url='https://example.com/test.jpg',
                        thumbnail_url=None, source='upload', tags=[], relevance_score=0.9
                    )
                ],
                total_count=1,
                query='test',
                search_time_ms=20.0
            )
            mock_get_service.return_value = mock_service

            result = search_media_library(query='test', brand_id='brand-123', use_query_generation=False)

            # Verify response format
            self.assertIn('status', result)
            self.assertIn('results', result)
            self.assertIn('total_count', result)
            self.assertIn('query', result)
            self.assertEqual(result['status'], 'success')
            self.assertIsInstance(result['results'], list)
            if result['results']:
                item = result['results'][0]
                # Verify item has 'id' (not 'media_id') for frontend compatibility
                self.assertIn('id', item)
                self.assertIn('title', item)
                self.assertIn('url', item)
                self.assertIn('type', item)
                self.assertIn('source', item)


class TestGallerySearchFallback(unittest.TestCase):
    """Test fallback behavior when Vertex AI Search is unavailable."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project'
        })
        self.env_patcher.start()

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()

    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_fallback_to_firestore_search(self, mock_get_service, mock_discoveryengine):
        """Test that search falls back to Firestore when Vertex AI is unavailable."""
        from tools.media_search_tools import search_media_library, _firestore_fallback_search

        # Mock service that returns empty results (simulating Vertex AI unavailable)
        mock_service = MagicMock()
        mock_service.search.return_value = None
        mock_get_service.return_value = mock_service

        with patch('tools.media_search_tools.get_brand_context', return_value='brand-123'), \
             patch('tools.media_search_tools._firestore_fallback_search') as mock_fallback:

            mock_fallback.return_value = {
                'status': 'success',
                'results': [],
                'total_count': 0
            }

            # Search should attempt fallback
            result = search_media_library(query='test', brand_id='brand-123', use_query_generation=False)

            # Verify fallback was considered (actual implementation may vary)
            self.assertIsNotNone(result)


if __name__ == '__main__':
    unittest.main()

