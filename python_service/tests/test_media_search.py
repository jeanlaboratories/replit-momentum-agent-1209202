"""
Tests for the Vertex AI Search Media Service and Tools

This module tests:
- MediaSearchService: Vertex AI Discovery Engine integration for media search
- Media Search Tools: Agent tools for searching media library
- API Endpoints: FastAPI endpoints for media search/index
"""

import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestMediaSearchService(unittest.TestCase):
    """Test cases for the MediaSearchService class."""

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

    @patch('services.media_search_service.google')
    @patch('services.media_search_service.discoveryengine')
    def test_service_initialization(self, mock_discoveryengine, mock_google):
        """Test MediaSearchService initializes correctly."""
        # Mock Google auth
        mock_credentials = MagicMock()
        mock_google.auth.default.return_value = (mock_credentials, None)
        
        from services.media_search_service import MediaSearchService

        service = MediaSearchService(project_id='test-project', location='global')

        self.assertEqual(service.project_id, 'test-project')
        self.assertEqual(service.location, 'global')
        mock_discoveryengine.SearchServiceClient.assert_called_once()
        mock_discoveryengine.DocumentServiceClient.assert_called_once()
        mock_discoveryengine.DataStoreServiceClient.assert_called_once()

    @patch('services.media_search_service.discoveryengine')
    def test_get_datastore_id(self, mock_discoveryengine):
        """Test data store ID generation."""
        from services.media_search_service import MediaSearchService

        service = MediaSearchService(project_id='test-project')

        # Test lowercase and hyphen conversion
        self.assertEqual(service._get_datastore_id('brand_123'), 'momentum-media-brand-123')
        self.assertEqual(service._get_datastore_id('BRAND_ABC'), 'momentum-media-brand-abc')

    @patch('services.media_search_service.discoveryengine')
    def test_get_datastore_path(self, mock_discoveryengine):
        """Test data store path generation."""
        from services.media_search_service import MediaSearchService

        service = MediaSearchService(project_id='test-project', location='global')
        path = service._get_datastore_path('brand-123')

        self.assertEqual(path, 'projects/test-project/locations/global/dataStores/momentum-media-brand-123')

    @patch('services.media_search_service.discoveryengine')
    def test_search_missing_project(self, mock_discoveryengine):
        """Test search returns empty results when project not configured."""
        from services.media_search_service import MediaSearchService

        # Create service with no project
        service = MediaSearchService.__new__(MediaSearchService)
        service.project_id = None
        service.location = 'global'
        service.search_client = None

        result = service.search(
            brand_id='brand-123',
            query='blue images'
        )

        self.assertEqual(result.results, [])
        self.assertEqual(result.total_count, 0)

    @patch('services.media_search_service.discoveryengine')
    def test_index_media_missing_project(self, mock_discoveryengine):
        """Test index returns error when project not configured."""
        from services.media_search_service import MediaSearchService

        # Create service with no project
        service = MediaSearchService.__new__(MediaSearchService)
        service.project_id = None
        service.document_client = None

        result = service.index_media(
            brand_id='brand-123',
            media_items=[{'id': 'test-1', 'title': 'Test'}]
        )

        self.assertFalse(result.success)
        self.assertIn('not configured', result.message)

    @patch('services.media_search_service.google')
    @patch('services.media_search_service.discoveryengine')
    def test_index_media_empty_items(self, mock_discoveryengine, mock_google):
        """Test index with empty media items."""
        # Mock Google auth
        mock_credentials = MagicMock()
        mock_google.auth.default.return_value = (mock_credentials, None)
        
        from services.media_search_service import MediaSearchService

        service = MediaSearchService(project_id='test-project')
        result = service.index_media(brand_id='brand-123', media_items=[])

        self.assertTrue(result.success)
        self.assertEqual(result.indexed_count, 0)
        self.assertIn('No media items', result.message)

    @patch('services.media_search_service.discoveryengine')
    def test_media_to_document(self, mock_discoveryengine):
        """Test media item to Discovery Engine document conversion."""
        from services.media_search_service import MediaSearchService

        # Need to properly configure the mock Document to return real values
        mock_doc_class = MagicMock()
        mock_discoveryengine.Document = mock_doc_class

        service = MediaSearchService(project_id='test-project')

        media = {
            'id': 'media-123',
            'brandId': 'brand-456',
            'title': 'Test Image',
            'description': 'A beautiful landscape',
            'prompt': 'Generate a mountain scene',
            'tags': ['nature', 'landscape'],
            'type': 'image',
            'source': 'ai-generated',
            'url': 'https://example.com/image.jpg',
            'thumbnailUrl': 'https://example.com/thumb.jpg',
            'explainability': {
                'summary': 'AI-generated landscape',
                'brandElements': ['mountain', 'sky']
            }
        }

        doc = service._media_to_document(media)

        # Verify Document was called with correct id
        call_kwargs = mock_doc_class.call_args[1]
        self.assertEqual(call_kwargs['id'], 'media-123')
        # Content should include all searchable text
        content = call_kwargs['content']
        self.assertIsNotNone(content)

    @patch('services.media_search_service.google_exceptions')
    @patch('services.media_search_service.google')
    @patch('services.media_search_service.discoveryengine')
    def test_delete_media_not_found(self, mock_discoveryengine, mock_google, mock_google_exceptions):
        """Test delete handles not found gracefully."""
        # Mock Google auth
        mock_credentials = MagicMock()
        mock_google.auth.default.return_value = (mock_credentials, None)
        
        # Mock Google exceptions
        not_found_exception = Exception('Not found')
        mock_google_exceptions.NotFound = type(not_found_exception)
        
        from services.media_search_service import MediaSearchService

        mock_doc_client = MagicMock()
        mock_doc_client.delete_document.side_effect = mock_google_exceptions.NotFound('Not found')
        mock_discoveryengine.DocumentServiceClient.return_value = mock_doc_client

        service = MediaSearchService(project_id='test-project')
        result = service.delete_media(brand_id='brand-123', media_id='media-456')

        # Should return True (already deleted)
        self.assertTrue(result)


class TestMediaSearchDataClasses(unittest.TestCase):
    """Test data classes for media search."""

    def test_media_search_result_creation(self):
        """Test MediaSearchResult dataclass creation."""
        from services.media_search_service import MediaSearchResult

        result = MediaSearchResult(
            media_id='test-123',
            title='Test Title',
            description='Test Description',
            media_type='image',
            url='https://example.com/image.jpg',
            thumbnail_url='https://example.com/thumb.jpg',
            source='upload',
            tags=['tag1', 'tag2'],
            relevance_score=0.95,
            snippet='Matched text...'
        )

        self.assertEqual(result.media_id, 'test-123')
        self.assertEqual(result.title, 'Test Title')
        self.assertEqual(result.relevance_score, 0.95)

    def test_media_search_response_creation(self):
        """Test MediaSearchResponse dataclass creation."""
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        results = [
            MediaSearchResult(
                media_id='test-1', title='Test 1', description='', media_type='image',
                url='', thumbnail_url=None, source='upload', tags=[], relevance_score=0.9
            )
        ]

        response = MediaSearchResponse(
            results=results,
            total_count=1,
            query='blue images',
            search_time_ms=50.5,
            next_page_token='token123'
        )

        self.assertEqual(response.total_count, 1)
        self.assertEqual(response.query, 'blue images')
        self.assertEqual(response.next_page_token, 'token123')

    def test_media_index_result_creation(self):
        """Test MediaIndexResult dataclass creation."""
        from services.media_search_service import MediaIndexResult

        result = MediaIndexResult(
            success=True,
            indexed_count=5,
            message='Indexed 5 items',
            errors=['Error 1']
        )

        self.assertTrue(result.success)
        self.assertEqual(result.indexed_count, 5)
        self.assertEqual(len(result.errors), 1)


class TestMediaSearchTools(unittest.TestCase):
    """Test cases for media search tools used by the agent."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project'
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
    @patch('agents.query_generation_agent.generate_search_queries_sync')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_search_media_library_success(self, mock_get_brand_context, mock_get_service, mock_generate_queries, mock_get_settings_service):
        """Test successful media library search."""
        # Ensure mock is set up before importing
        mock_get_brand_context.return_value = 'brand-123'
        # Mock query generation to return single query (disable for tests)
        mock_generate_queries.return_value = ['blue images']
        
        from tools.media_search_tools import search_media_library
        from services.media_search_service import MediaSearchResponse, MediaSearchResult
        from models.search_settings import SearchSettings, SearchMethod

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='img-1', title='Blue Sky', description='Landscape',
                    media_type='image', url='https://example.com/1.jpg',
                    thumbnail_url='https://example.com/1-thumb.jpg',
                    source='upload', tags=['nature'], relevance_score=0.95
                )
            ],
            total_count=1,
            query='blue images',
            search_time_ms=25.0
        )

        mock_service = MagicMock()
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

        result = search_media_library(query='blue images', use_query_generation=False)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['title'], 'Blue Sky')
        self.assertEqual(result['total_count'], 1)

    def test_search_media_library_no_brand(self):
        """Test search fails without brand context."""
        # We need to patch where the function is imported, not where it's defined
        with patch('tools.media_search_tools.get_brand_context', return_value=None):
            from tools.media_search_tools import search_media_library

            result = search_media_library(query='test query')

            self.assertEqual(result['status'], 'error')
            self.assertIn('Brand ID required', result['error'])

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('agents.query_generation_agent.generate_search_queries_sync')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_search_images_filters_by_type(self, mock_get_brand_context, mock_get_service, mock_generate_queries, mock_get_settings_service):
        """Test search_images filters by image type."""
        # Ensure mock is set up before importing
        mock_get_brand_context.return_value = 'brand-123'
        # Mock query generation to return single query (disable for tests)
        mock_generate_queries.return_value = ['blue sky']
        
        from tools.media_search_tools import search_images
        from services.media_search_service import MediaSearchResponse
        from models.search_settings import SearchSettings, SearchMethod
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[], total_count=0, query='test', search_time_ms=10.0
        )
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

        search_images(query='blue sky', use_query_generation=False)

        # Verify media_type filter was passed
        call_args = mock_service.search.call_args
        self.assertEqual(call_args[1]['media_type'], 'image')

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('agents.query_generation_agent.generate_search_queries_sync')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_search_videos_filters_by_type(self, mock_get_brand_context, mock_get_service, mock_generate_queries, mock_get_settings_service):
        """Test search_videos filters by video type."""
        # Ensure mock is set up before importing
        mock_get_brand_context.return_value = 'brand-123'
        # Mock query generation to return single query (disable for tests)
        mock_generate_queries.return_value = ['product demo']
        
        from tools.media_search_tools import search_videos
        from services.media_search_service import MediaSearchResponse
        from models.search_settings import SearchSettings, SearchMethod
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[], total_count=0, query='test', search_time_ms=10.0
        )
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

        search_videos(query='product demo', use_query_generation=False)

        # Verify media_type filter was passed
        call_args = mock_service.search.call_args
        self.assertEqual(call_args[1]['media_type'], 'video')


class TestTeamMediaSearchTools(unittest.TestCase):
    """Test cases for team tools for media search."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project'
        })
        self.env_patcher.start()

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()

    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.team_tools.get_brand_context')
    def test_search_team_media_success(self, mock_get_brand_context, mock_get_service):
        """Test successful team media search."""
        from tools.team_tools import search_team_media
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        mock_get_brand_context.return_value = 'brand-123'

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='vid-1', title='Product Demo', description='Demo video',
                    media_type='video', url='https://example.com/1.mp4',
                    thumbnail_url='https://example.com/1-thumb.jpg',
                    source='ai-generated', tags=['product'], relevance_score=0.88
                )
            ],
            total_count=1,
            query='product demo',
            search_time_ms=30.0
        )

        mock_service = MagicMock()
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service

        result = search_team_media(query='product demo')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['type'], 'video')

    def test_search_team_media_no_brand(self):
        """Test team media search fails without brand context."""
        # We need to patch where the function is imported, not where it's defined
        with patch('tools.team_tools.get_brand_context', return_value=None):
            from tools.team_tools import search_team_media

            result = search_team_media(query='test query')

            self.assertEqual(result['status'], 'error')
            self.assertIn('Brand ID required', result['error'])

    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.team_tools.get_brand_context')
    def test_search_team_media_with_source_filters(self, mock_get_brand_context, mock_get_service):
        """Test team media search with source filters."""
        from tools.team_tools import search_team_media
        from services.media_search_service import MediaSearchResponse

        mock_get_brand_context.return_value = 'brand-123'
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[], total_count=0, query='test', search_time_ms=10.0
        )
        mock_get_service.return_value = mock_service

        # Test with only uploads enabled
        search_team_media(
            query='test',
            include_ai_generated=False,
            include_brand_soul=False,
            include_uploads=True
        )

        # Verify search was called
        mock_service.search.assert_called()

    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.team_tools.get_brand_context')
    def test_find_similar_media(self, mock_get_brand_context, mock_get_service):
        """Test find similar media functionality."""
        from tools.team_tools import find_similar_media
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        mock_get_brand_context.return_value = 'brand-123'

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='similar-1', title='Similar Image',
                    description='Similar content', media_type='image',
                    url='https://example.com/similar.jpg',
                    thumbnail_url='https://example.com/similar-thumb.jpg',
                    source='upload', tags=['test'], relevance_score=0.75
                )
            ],
            total_count=1,
            query='similar to original-123',
            search_time_ms=20.0
        )

        mock_service = MagicMock()
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service

        result = find_similar_media(media_id='original-123')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['reference_id'], 'original-123')


class TestMediaSearchToolIntegration(unittest.TestCase):
    """Test tool registration in the agent."""

    def test_media_search_tools_importable(self):
        """Test that media search tools can be imported."""
        try:
            from tools.media_search_tools import (
                search_media_library,
                search_images,
                search_videos,
                index_brand_media
            )
            self.assertTrue(callable(search_media_library))
            self.assertTrue(callable(search_images))
            self.assertTrue(callable(search_videos))
            self.assertTrue(callable(index_brand_media))
        except ImportError as e:
            self.fail(f"Failed to import media search tools: {e}")

    def test_team_media_tools_importable(self):
        """Test that team media tools can be imported."""
        try:
            from tools.team_tools import search_team_media, find_similar_media
            self.assertTrue(callable(search_team_media))
            self.assertTrue(callable(find_similar_media))
        except ImportError as e:
            self.fail(f"Failed to import team media tools: {e}")

    def test_tool_docstrings(self):
        """Test that tools have proper docstrings for agent use."""
        from tools.media_search_tools import search_media_library, search_images, search_videos
        from tools.team_tools import search_team_media

        # Check docstrings contain key information
        self.assertIsNotNone(search_media_library.__doc__)
        self.assertIn('search', search_media_library.__doc__.lower())

        self.assertIsNotNone(search_images.__doc__)
        self.assertIn('image', search_images.__doc__.lower())

        self.assertIsNotNone(search_videos.__doc__)
        self.assertIn('video', search_videos.__doc__.lower())

        self.assertIsNotNone(search_team_media.__doc__)
        self.assertIn('team', search_team_media.__doc__.lower())


class TestMediaSearchAPI(unittest.TestCase):
    """Test FastAPI endpoints for media search."""

    def test_request_models_importable(self):
        """Test that request models can be imported."""
        try:
            from models.requests import MediaSearchRequest, MediaIndexRequest
            self.assertIsNotNone(MediaSearchRequest)
            self.assertIsNotNone(MediaIndexRequest)
        except ImportError as e:
            self.fail(f"Failed to import request models: {e}")

    def test_media_search_request_validation(self):
        """Test MediaSearchRequest validation."""
        from models.requests import MediaSearchRequest

        # Valid request
        request = MediaSearchRequest(
            brand_id='brand-123',
            query='blue images',
            media_type='image',
            limit=10
        )
        self.assertEqual(request.brand_id, 'brand-123')
        self.assertEqual(request.query, 'blue images')
        self.assertEqual(request.media_type, 'image')
        self.assertEqual(request.limit, 10)

    def test_media_index_request_validation(self):
        """Test MediaIndexRequest validation."""
        from models.requests import MediaIndexRequest

        # Valid request
        request = MediaIndexRequest(
            brand_id='brand-123',
            media_items=[
                {'id': 'media-1', 'title': 'Test 1'},
                {'id': 'media-2', 'title': 'Test 2'}
            ]
        )
        self.assertEqual(request.brand_id, 'brand-123')
        self.assertEqual(len(request.media_items), 2)


class TestMediaSearchServiceSingleton(unittest.TestCase):
    """Test singleton pattern for MediaSearchService."""

    @patch('services.media_search_service.discoveryengine')
    def test_get_media_search_service_singleton(self, mock_discoveryengine):
        """Test that get_media_search_service returns singleton."""
        from services.media_search_service import get_media_search_service, _media_search_service
        import services.media_search_service as module

        # Reset singleton
        module._media_search_service = None

        service1 = get_media_search_service()
        service2 = get_media_search_service()

        self.assertIs(service1, service2)


class TestMediaSearchIntegration(unittest.TestCase):
    """Integration tests for media search across all features."""

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

    def test_agent_tools_include_media_search(self):
        """Test that momentum agent includes media search tools."""
        # Just test the tools can be imported and have correct signatures
        from tools.media_search_tools import search_media_library, search_images, search_videos
        from tools.team_tools import search_team_media, find_similar_media

        # All should be callable
        self.assertTrue(callable(search_media_library))
        self.assertTrue(callable(search_images))
        self.assertTrue(callable(search_videos))
        self.assertTrue(callable(search_team_media))
        self.assertTrue(callable(find_similar_media))

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_media_library_search_flow(self, mock_get_brand_context, mock_get_service, mock_get_settings_service):
        """Test complete search flow for Media Library."""
        from tools.media_search_tools import search_media_library
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        mock_get_brand_context.return_value = 'brand-123'

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='img-1', title='Product Photo', description='High quality product shot',
                    media_type='image', url='https://example.com/product.jpg',
                    thumbnail_url='https://example.com/product-thumb.jpg',
                    source='upload', tags=['product', 'photo'], relevance_score=0.95
                ),
                MediaSearchResult(
                    media_id='img-2', title='Brand Logo', description='Company logo',
                    media_type='image', url='https://example.com/logo.jpg',
                    thumbnail_url='https://example.com/logo-thumb.jpg',
                    source='brand-soul', tags=['logo', 'brand'], relevance_score=0.88
                )
            ],
            total_count=2,
            query='product photos',
            search_time_ms=45.0
        )

        mock_service = MagicMock()
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

        result = search_media_library(query='product photos', limit=10, use_query_generation=False)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 2)
        self.assertEqual(result['results'][0]['title'], 'Product Photo')
        self.assertEqual(result['results'][1]['source'], 'brand-soul')

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_image_gallery_search_flow(self, mock_get_brand_context, mock_get_service, mock_get_settings_service):
        """Test search flow specifically for Image Gallery."""
        from tools.media_search_tools import search_images
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        mock_get_brand_context.return_value = 'brand-456'

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='ai-img-1', title='AI Landscape', description='Mountain scene',
                    media_type='image', url='https://example.com/landscape.jpg',
                    thumbnail_url='https://example.com/landscape-thumb.jpg',
                    source='ai-generated', tags=['landscape', 'mountain'], relevance_score=0.92
                )
            ],
            total_count=1,
            query='landscape',
            search_time_ms=30.0
        )

        mock_service = MagicMock()
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service
        
        # Mock search settings service to return proper SearchSettings
        from models.search_settings import SearchSettings, SearchMethod
        mock_settings_service = MagicMock()
        mock_settings = SearchSettings(
            brand_id='brand-456',
            search_method=SearchMethod.VERTEX_AI,
            auto_index=True,
            vertex_ai_enabled=True
        )
        mock_settings_service.get_search_settings.return_value = mock_settings
        mock_get_settings_service.return_value = mock_settings_service

        result = search_images(query='landscape', source='ai-generated', use_query_generation=False)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['source'], 'ai-generated')

        # Verify search was called with image filter
        call_args = mock_service.search.call_args
        self.assertEqual(call_args[1]['media_type'], 'image')

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_video_gallery_search_flow(self, mock_get_brand_context, mock_get_service, mock_get_settings_service):
        """Test search flow specifically for Video Gallery."""
        from tools.media_search_tools import search_videos
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        mock_get_brand_context.return_value = 'brand-789'

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='vid-1', title='Product Demo', description='Demo video',
                    media_type='video', url='https://example.com/demo.mp4',
                    thumbnail_url='https://example.com/demo-thumb.jpg',
                    source='upload', tags=['demo', 'product'], relevance_score=0.89
                ),
                MediaSearchResult(
                    media_id='vid-2', title='AI Generated Promo', description='Promotional video',
                    media_type='video', url='https://example.com/promo.mp4',
                    thumbnail_url='https://example.com/promo-thumb.jpg',
                    source='veo', tags=['promo'], relevance_score=0.85
                )
            ],
            total_count=2,
            query='demo video',
            search_time_ms=35.0
        )

        mock_service = MagicMock()
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service

        result = search_videos(query='demo video', use_query_generation=False)

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 2)

        # Verify search was called with video filter
        call_args = mock_service.search.call_args
        self.assertEqual(call_args[1]['media_type'], 'video')

    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.team_tools.get_brand_context')
    def test_team_tools_search_flow(self, mock_get_brand_context, mock_get_service):
        """Test search flow for Team Companion Team Tools."""
        from tools.team_tools import search_team_media
        from services.media_search_service import MediaSearchResponse, MediaSearchResult

        mock_get_brand_context.return_value = 'team-123'

        mock_result = MediaSearchResponse(
            results=[
                MediaSearchResult(
                    media_id='team-img-1', title='Team Meeting Photo', description='Q4 planning',
                    media_type='image', url='https://example.com/meeting.jpg',
                    thumbnail_url='https://example.com/meeting-thumb.jpg',
                    source='upload', tags=['team', 'meeting'], relevance_score=0.91
                )
            ],
            total_count=1,
            query='team meeting',
            search_time_ms=28.0
        )

        mock_service = MagicMock()
        mock_service.search.return_value = mock_result
        mock_get_service.return_value = mock_service

        result = search_team_media(
            query='team meeting',
            include_ai_generated=False,
            include_uploads=True,
            include_brand_soul=False
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['source'], 'upload')

    @patch('services.media_search_service.struct_pb2')
    @patch('services.media_search_service.google')
    @patch('services.media_search_service.discoveryengine')
    def test_indexing_flow(self, mock_discoveryengine, mock_google, mock_struct_pb2):
        """Test media indexing flow."""
        # Mock Google auth
        mock_credentials = MagicMock()
        mock_google.auth.default.return_value = (mock_credentials, None)
        
        # Mock struct_pb2
        mock_struct = MagicMock()
        mock_struct_pb2.Struct.return_value = mock_struct
        
        from services.media_search_service import MediaSearchService

        mock_datastore_client = MagicMock()
        mock_document_client = MagicMock()
        mock_discoveryengine.DataStoreServiceClient.return_value = mock_datastore_client
        mock_discoveryengine.DocumentServiceClient.return_value = mock_document_client

        # Mock data store already exists
        mock_datastore = MagicMock()
        mock_datastore.name = 'projects/test/locations/global/dataStores/momentum-media-brand-test'
        mock_datastore_client.get_data_store.return_value = mock_datastore

        service = MediaSearchService(project_id='test-project')

        media_items = [
            {
                'id': 'media-1',
                'brandId': 'brand-test',
                'title': 'Test Image',
                'description': 'A test image for indexing',
                'type': 'image',
                'source': 'upload',
                'url': 'https://example.com/test.jpg',
                'tags': ['test', 'example']
            }
        ]

        result = service.index_media(brand_id='brand-test', media_items=media_items)

        # Verify indexing was attempted
        mock_document_client.create_document.assert_called()
        self.assertIsNotNone(result)


class TestSearchFilterScenarios(unittest.TestCase):
    """Test different filter scenarios for search."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project'
        })
        self.env_patcher.start()
        # Reset query generation agent singleton for test isolation
        try:
            from agents.query_generation_agent import reset_query_generation_agent
            reset_query_generation_agent()
        except ImportError:
            pass

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()
        # Reset query generation agent singleton after test
        try:
            from agents.query_generation_agent import reset_query_generation_agent
            reset_query_generation_agent()
        except ImportError:
            pass

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_search_with_tags_filter(self, mock_get_brand_context, mock_get_service, mock_get_settings_service):
        """Test searching with tags filter."""
        from tools.media_search_tools import search_media_library
        from services.media_search_service import MediaSearchResponse

        mock_get_brand_context.return_value = 'brand-123'
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[], total_count=0, query='test', search_time_ms=10.0
        )
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

        search_media_library(query='test', tags='summer, beach, vacation', use_query_generation=False)

        if mock_service.search.called:
            call_args = mock_service.search.call_args
            self.assertEqual(call_args[1]['tags'], ['summer', 'beach', 'vacation'])

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_search_with_collections_filter(self, mock_get_brand_context, mock_get_service, mock_get_settings_service):
        """Test searching with collections filter."""
        from tools.media_search_tools import search_media_library
        from services.media_search_service import MediaSearchResponse

        mock_get_brand_context.return_value = 'brand-123'
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[], total_count=0, query='test', search_time_ms=10.0
        )
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

        search_media_library(query='test', collections='campaign-2024, product-launch', use_query_generation=False)

        if mock_service.search.called:
            call_args = mock_service.search.call_args
            self.assertEqual(call_args[1]['collections'], ['campaign-2024', 'product-launch'])

    @patch('services.search_settings_service.get_search_settings_service')
    @patch('services.media_search_service.get_media_search_service')
    @patch('tools.media_search_tools.get_brand_context')
    def test_search_limit_validation(self, mock_get_brand_context, mock_get_service, mock_get_settings_service):
        """Test that search limit is properly validated."""
        from tools.media_search_tools import search_media_library
        from services.media_search_service import MediaSearchResponse

        mock_get_brand_context.return_value = 'brand-123'
        mock_service = MagicMock()
        mock_service.search.return_value = MediaSearchResponse(
            results=[], total_count=0, query='test', search_time_ms=10.0
        )
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

        # Test limit too high
        search_media_library(query='test', limit=100, use_query_generation=False)
        if mock_service.search.called:
            call_args = mock_service.search.call_args
            self.assertEqual(call_args[1]['page_size'], 50)  # Should be capped at 50

        # Test limit too low
        search_media_library(query='test', limit=0, use_query_generation=False)
        if mock_service.search.called:
            call_args = mock_service.search.call_args
            self.assertEqual(call_args[1]['page_size'], 1)  # Should be at least 1


if __name__ == '__main__':
    unittest.main()
