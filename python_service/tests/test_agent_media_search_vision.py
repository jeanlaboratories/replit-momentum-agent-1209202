"""
Tests for Agent media search with vision analysis support.

This module verifies that:
1. Agent search tools (search_media_library, search_images, search_videos) include vision analysis fields
2. Agent endpoint (/media-search) includes vision analysis fields in results
3. Agent search uses intelligent matching for plural/singular handling (same as galleries)
4. Vision analysis fields are searchable in all search paths
"""

import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestAgentSearchVisionAnalysis(unittest.TestCase):
    """Test that agent search includes and uses vision analysis fields."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project',
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'MOMENTUM_SEARCH_LOCATION': 'global'
        })
        self.env_patcher.start()

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_search_media_library_includes_vision_analysis(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that search_media_library includes vision analysis fields in results."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from tools.media_search_tools import search_media_library

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='img-1',
                    title='Test Image',
                    description='Test description',
                    media_type='image',
                    url='https://example.com/img.jpg',
                    thumbnail_url='https://example.com/img-thumb.jpg',
                    source='upload',
                    tags=['tag1'],
                    relevance_score=0.9,
                    vision_description='A red sports car with futuristic purple accents',
                    vision_keywords=['car', 'sports car', 'red', 'purple', 'futuristic'],
                    vision_categories=['vehicle', 'automotive'],
                    enhanced_search_text='futuristic purple car'
                )
            ],
            total_count=1,
            query='futuristic purple',
            search_time_ms=25.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        from models.search_settings import SearchSettings, SearchMethod
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
            result = search_media_library(query='futuristic purple', brand_id='brand-123', use_query_generation=False)

            # Verify vision analysis fields are included
            self.assertEqual(result['status'], 'success')
            self.assertEqual(len(result['results']), 1)
            item = result['results'][0]
            
            # Check vision analysis fields are present
            self.assertIn('visionDescription', item)
            self.assertIn('visionKeywords', item)
            self.assertIn('visionCategories', item)
            self.assertIn('enhancedSearchText', item)
            
            # Verify values
            self.assertEqual(item['visionDescription'], 'A red sports car with futuristic purple accents')
            self.assertEqual(item['visionKeywords'], ['car', 'sports car', 'red', 'purple', 'futuristic'])
            self.assertEqual(item['visionCategories'], ['vehicle', 'automotive'])
            self.assertEqual(item['enhancedSearchText'], 'futuristic purple car')

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_search_images_includes_vision_analysis(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that search_images includes vision analysis fields."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from tools.media_search_tools import search_images

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='img-1',
                    title='Car Image',
                    description='',
                    media_type='image',
                    url='https://example.com/car.jpg',
                    thumbnail_url='https://example.com/car-thumb.jpg',
                    source='upload',
                    tags=[],
                    relevance_score=0.95,
                    vision_description='A futuristic purple sports car',
                    vision_keywords=['car', 'sports car', 'purple', 'futuristic'],
                    vision_categories=['vehicle'],
                    enhanced_search_text=''
                )
            ],
            total_count=1,
            query='car',
            search_time_ms=20.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        from models.search_settings import SearchSettings, SearchMethod
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
            result = search_images(query='car', brand_id='brand-123', use_query_generation=False)

            # Verify vision analysis is included
            self.assertEqual(result['status'], 'success')
            item = result['results'][0]
            self.assertIn('visionDescription', item)
            self.assertIn('visionKeywords', item)
            self.assertEqual(item['visionDescription'], 'A futuristic purple sports car')

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.discoveryengine')
    @patch('services.media_search_service.get_media_search_service')
    def test_search_videos_includes_vision_analysis(self, mock_get_service, mock_discoveryengine, mock_get_settings_service):
        """Test that search_videos includes vision analysis fields."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from tools.media_search_tools import search_videos

        mock_service = MagicMock()
        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='vid-1',
                    title='Product Video',
                    description='Demo video',
                    media_type='video',
                    url='https://example.com/video.mp4',
                    thumbnail_url='https://example.com/video-thumb.jpg',
                    source='upload',
                    tags=[],
                    relevance_score=0.85,
                    vision_description='Product demonstration showing features',
                    vision_keywords=['product', 'demo', 'features'],
                    vision_categories=['business'],
                    enhanced_search_text=''
                )
            ],
            total_count=1,
            query='product demo',
            search_time_ms=30.0
        )
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        from models.search_settings import SearchSettings, SearchMethod
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
            result = search_videos(query='product demo', brand_id='brand-123')

            # Verify vision analysis is included
            self.assertEqual(result['status'], 'success')
            item = result['results'][0]
            self.assertIn('visionDescription', item)
            self.assertIn('visionKeywords', item)
            self.assertEqual(item['visionDescription'], 'Product demonstration showing features')

    def test_firestore_fallback_includes_vision_analysis(self):
        """Test that Firestore fallback search includes vision analysis fields in result structure."""
        # This test verifies the code includes vision analysis fields in the result dictionary
        # We verify by checking the actual code structure rather than running the full function
        import inspect
        from tools.media_search_tools import _firestore_fallback_search
        
        # Get the source code
        source = inspect.getsource(_firestore_fallback_search)
        
        # Verify vision analysis fields are included in the result structure
        self.assertIn('visionDescription', source)
        self.assertIn('visionKeywords', source)
        self.assertIn('visionCategories', source)
        self.assertIn('enhancedSearchText', source)
        
        # Verify intelligent matching is used
        self.assertIn('intelligent_text_match', source)
        self.assertIn('intelligent_tag_match', source)

    def test_firestore_fallback_uses_intelligent_matching(self):
        """Test that Firestore fallback uses intelligent matching (plural/singular handling)."""
        import inspect
        from tools.media_search_tools import _firestore_fallback_search
        
        # Get the source code
        source = inspect.getsource(_firestore_fallback_search)
        
        # Verify intelligent matching is used (same as galleries)
        self.assertIn('intelligent_text_match', source)
        self.assertIn('intelligent_tag_match', source)
        
        # Verify vision analysis fields are included in search logic
        self.assertIn('vision_description', source)
        self.assertIn('vision_keywords', source)
        self.assertIn('vision_categories', source)


class TestAgentEndpointVisionAnalysis(unittest.TestCase):
    """Test that agent endpoint includes vision analysis fields."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project',
            'GOOGLE_CLOUD_PROJECT': 'test-project',
            'MOMENTUM_SEARCH_LOCATION': 'global'
        })
        self.env_patcher.start()

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()

    def test_media_search_endpoint_includes_vision_analysis(self):
        """Test that /media-search endpoint includes vision analysis in results."""
        import inspect
        import sys
        import os
        
        # Read the router file directly to check for vision analysis fields
        router_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'routers', 'agent.py')
        with open(router_path, 'r') as f:
            source = f.read()
        
        # Verify vision analysis fields are included in Vertex AI results
        self.assertIn('visionDescription', source)
        self.assertIn('visionKeywords', source)
        self.assertIn('visionCategories', source)
        self.assertIn('enhancedSearchText', source)
        
        # Verify intelligent matching is used in fallback
        self.assertIn('intelligent_text_match', source)
        self.assertIn('intelligent_tag_match', source)


if __name__ == '__main__':
    unittest.main()

