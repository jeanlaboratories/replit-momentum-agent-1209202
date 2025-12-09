import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from services.vision_analysis_service import VisionAnalysisService, get_vision_analysis_service


class TestVisionAnalysisService:
    
    @pytest.fixture
    def vision_service(self):
        """Create a VisionAnalysisService instance for testing."""
        return VisionAnalysisService()
    
    @pytest.fixture
    def sample_media_item(self):
        """Sample media item for testing."""
        return {
            'id': 'test-media-123',
            'type': 'image',
            'url': 'https://example.com/test-image.jpg',
            'thumbnailUrl': 'https://example.com/test-thumb.jpg',
            'title': 'Test Image',
            'description': 'A test image for unit testing'
        }
    
    @pytest.fixture
    def sample_media_with_vision(self):
        """Sample media item that already has vision analysis."""
        return {
            'id': 'test-media-analyzed',
            'type': 'image',
            'url': 'https://example.com/analyzed-image.jpg',
            'visionDescription': 'A red car parked in front of a building',
            'visionKeywords': ['car', 'red', 'building', 'vehicle'],
            'visionCategories': ['transportation', 'outdoor']
        }
    
    @pytest.fixture
    def sample_video_item(self):
        """Sample video item for testing."""
        return {
            'id': 'test-video-123',
            'type': 'video',
            'url': 'https://example.com/test-video.mp4',
            'title': 'Test Video',
            'description': 'A test video for unit testing',
            'source': 'uploaded'
        }
    
    @pytest.fixture
    def sample_youtube_video(self):
        """Sample YouTube video item for testing."""
        return {
            'id': 'test-youtube-456',
            'type': 'video',
            'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'title': 'Test YouTube Video',
            'source': 'youtube'
        }
    
    @pytest.fixture
    def mock_video_analysis_response(self):
        """Mock successful video analysis response."""
        return {
            'status': 'success',
            'analysis': '''DESCRIPTION: A tutorial video showing how to cook pasta with fresh ingredients in a modern kitchen.

KEYWORDS: cooking tutorial, pasta, kitchen, chef, ingredients, recipe, culinary, food preparation, cooking tips, Italian cuisine

CATEGORIES: tutorial, cooking, educational, food, culinary''',
            'model': 'gemini-2.0-flash-exp'
        }
    
    @pytest.fixture  
    def mock_youtube_analysis_response(self):
        """Mock successful YouTube video analysis response."""
        return {
            'analysis': '''DESCRIPTION: A music video featuring a pop song with colorful visuals and dance choreography.

KEYWORDS: music video, pop music, dance, choreography, colorful visuals, entertainment, artist, performance, music industry

CATEGORIES: entertainment, music, dance, performance''',
            'model': 'gemini-2.0-flash-exp'
        }
    
    @pytest.fixture
    def mock_analysis_response(self):
        """Mock successful vision analysis response."""
        return {
            'status': 'success',
            'analysis': '''DESCRIPTION: A vibrant red sports car parked in front of a modern glass building on a sunny day.

KEYWORDS: red car, sports car, vehicle, automobile, glass building, modern architecture, sunny day, parking, outdoor scene, urban setting

CATEGORIES: transportation, automotive, architecture, urban, outdoor'''
        }
    
    def test_parse_analysis_success(self, vision_service, mock_analysis_response):
        """Test successful parsing of vision analysis response."""
        result = vision_service._parse_analysis(mock_analysis_response['analysis'])
        
        assert 'visionDescription' in result
        assert 'visionKeywords' in result
        assert 'visionCategories' in result
        assert 'enhancedSearchText' in result
        
        # Check description
        assert 'red sports car' in result['visionDescription']
        assert 'glass building' in result['visionDescription']
        
        # Check keywords
        assert 'red car' in result['visionKeywords']
        assert 'sports car' in result['visionKeywords']
        assert len(result['visionKeywords']) > 5
        
        # Check categories
        assert 'transportation' in result['visionCategories']
        assert 'automotive' in result['visionCategories']
        
        # Check enhanced search text combines all fields
        assert 'red sports car' in result['enhancedSearchText']
        assert 'transportation' in result['enhancedSearchText']
    
    def test_parse_analysis_malformed(self, vision_service):
        """Test parsing of malformed analysis response."""
        malformed_text = "This is not properly formatted analysis text"
        result = vision_service._parse_analysis(malformed_text)
        
        # Should return empty but valid structure
        assert result['visionDescription'] == ''
        assert result['visionKeywords'] == []
        assert result['visionCategories'] == []
        assert result['enhancedSearchText'] == ''
    
    @pytest.mark.asyncio
    async def test_analyze_media_item_success(self, vision_service, sample_media_item, mock_analysis_response):
        """Test successful analysis of a media item."""
        with patch('services.vision_analysis_service.analyze_image', return_value=mock_analysis_response):
            result = await vision_service.analyze_media_item(sample_media_item)
            
            # Should return enhanced media item
            assert result['id'] == sample_media_item['id']
            assert 'visionDescription' in result
            assert 'visionKeywords' in result
            assert 'visionCategories' in result
            assert 'enhancedSearchText' in result
            
            # Check that vision data was added
            assert result['visionDescription'] != ''
            assert len(result['visionKeywords']) > 0
            assert len(result['visionCategories']) > 0
    
    @pytest.mark.asyncio
    async def test_analyze_media_item_skip_non_media(self, vision_service):
        """Test that non-media items are skipped."""
        text_item = {
            'id': 'test-text-123',
            'type': 'text',
            'url': 'https://example.com/test-text.txt'
        }
        
        result = await vision_service.analyze_media_item(text_item)
        
        # Should return unchanged
        assert result == text_item
        assert 'visionDescription' not in result
    
    @pytest.mark.asyncio
    async def test_analyze_video_item_success(self, vision_service, sample_video_item, mock_video_analysis_response):
        """Test successful analysis of a video item."""
        with patch('services.vision_analysis_service.process_youtube_video') as mock_youtube, \
             patch.object(vision_service, '_analyze_video', return_value=mock_video_analysis_response):
            
            result = await vision_service.analyze_media_item(sample_video_item)
            
            # Should return enhanced media item
            assert result['id'] == sample_video_item['id']
            assert 'visionDescription' in result
            assert 'visionKeywords' in result
            assert 'visionCategories' in result
            assert 'enhancedSearchText' in result
            
            # Check that vision data was added
            assert 'tutorial video' in result['visionDescription']
            assert 'pasta' in result['visionKeywords']
            assert 'tutorial' in result['visionCategories']
    
    @pytest.mark.asyncio
    async def test_analyze_youtube_video_success(self, vision_service, sample_youtube_video, mock_youtube_analysis_response):
        """Test successful analysis of a YouTube video."""
        with patch('services.vision_analysis_service.process_youtube_video', return_value=mock_youtube_analysis_response):
            result = await vision_service.analyze_media_item(sample_youtube_video)
            
            # Should return enhanced media item
            assert result['id'] == sample_youtube_video['id']
            assert 'visionDescription' in result
            assert 'visionKeywords' in result
            assert 'visionCategories' in result
            
            # Check that YouTube video analysis data was added
            assert 'music video' in result['visionDescription']
            assert 'dance' in result['visionKeywords']
            assert 'entertainment' in result['visionCategories']
    
    @pytest.mark.asyncio
    async def test_analyze_video_no_url(self, vision_service):
        """Test handling of video item with no URL."""
        video_no_url = {
            'id': 'test-video-no-url',
            'type': 'video',
            'title': 'Video without URL'
        }
        
        result = await vision_service.analyze_media_item(video_no_url)
        
        # Should return unchanged
        assert result == video_no_url
        assert 'visionDescription' not in result
    
    @pytest.mark.asyncio
    async def test_analyze_video_analysis_failure(self, vision_service, sample_video_item):
        """Test handling of video analysis failure."""
        error_response = {
            'status': 'error',
            'error': 'Failed to analyze video'
        }
        
        with patch.object(vision_service, '_analyze_video', return_value=error_response):
            result = await vision_service.analyze_media_item(sample_video_item)
            
            # Should contain error information
            assert result['id'] == sample_video_item['id']
            assert result.get('_vision_error') == 'Failed to analyze video'
            assert 'visionDescription' not in result
    
    @pytest.mark.asyncio
    async def test_analyze_media_item_skip_already_analyzed(self, vision_service, sample_media_with_vision):
        """Test that already analyzed media items are skipped."""
        result = await vision_service.analyze_media_item(sample_media_with_vision)
        
        # Should return unchanged
        assert result == sample_media_with_vision
    
    @pytest.mark.asyncio
    async def test_analyze_media_item_no_url(self, vision_service):
        """Test handling of media item with no URL."""
        item_no_url = {
            'id': 'test-no-url',
            'type': 'image',
            'title': 'Image without URL'
        }
        
        result = await vision_service.analyze_media_item(item_no_url)
        
        # Should return unchanged
        assert result == item_no_url
        assert 'visionDescription' not in result
    
    @pytest.mark.asyncio
    async def test_analyze_media_item_vision_failure(self, vision_service, sample_media_item):
        """Test handling of vision analysis failure."""
        error_response = {
            'status': 'error',
            'error': 'Failed to analyze image'
        }
        
        with patch('services.vision_analysis_service.analyze_image', return_value=error_response):
            result = await vision_service.analyze_media_item(sample_media_item)
            
            # Should contain error information but keep original data
            assert result['id'] == sample_media_item['id']
            assert result.get('_vision_error') == 'Failed to analyze image'
            assert 'visionDescription' not in result
    
    @pytest.mark.asyncio
    async def test_analyze_media_batch_success(self, vision_service, mock_analysis_response, mock_video_analysis_response):
        """Test batch analysis of multiple media items including videos."""
        media_items = [
            {'id': '1', 'type': 'image', 'url': 'https://example.com/1.jpg'},
            {'id': '2', 'type': 'image', 'url': 'https://example.com/2.jpg'},
            {'id': '3', 'type': 'video', 'url': 'https://example.com/3.mp4', 'source': 'uploaded'},
            {'id': '4', 'type': 'video', 'url': 'https://www.youtube.com/watch?v=test', 'source': 'youtube'},
        ]
        
        with patch('services.vision_analysis_service.analyze_image', return_value=mock_analysis_response), \
             patch.object(vision_service, '_analyze_video', return_value=mock_video_analysis_response):
            
            results = await vision_service.analyze_media_batch(media_items, batch_size=2)
            
            assert len(results) == 4
            
            # All should have vision data now (images and videos)
            assert 'visionDescription' in results[0]
            assert 'visionDescription' in results[1] 
            assert 'visionDescription' in results[2]  # Video should now be analyzed
            assert 'visionDescription' in results[3]  # YouTube video should also be analyzed
    
    @pytest.mark.asyncio
    async def test_analyze_media_batch_empty(self, vision_service):
        """Test batch analysis with empty input."""
        results = await vision_service.analyze_media_batch([])
        assert results == []
    
    def test_get_analysis_stats(self, vision_service):
        """Test analysis statistics calculation including videos."""
        media_items = [
            {'id': '1', 'type': 'image', 'visionDescription': 'analyzed'},
            {'id': '2', 'type': 'image'},  # Not analyzed
            {'id': '3', 'type': 'video', 'visionDescription': 'video analyzed'},  # Video analyzed
            {'id': '4', 'type': 'image', 'visionDescription': 'also analyzed'},
            {'id': '5', 'type': 'image'},  # Not analyzed
            {'id': '6', 'type': 'video'},  # Video not analyzed
            {'id': '7', 'type': 'text'},   # Non-media type
        ]
        
        stats = vision_service.get_analysis_stats(media_items)
        
        assert stats['total_images'] == 4         # 4 images total
        assert stats['total_videos'] == 2         # 2 videos total
        assert stats['total_analyzable_media'] == 6  # 4 images + 2 videos
        assert stats['analyzed'] == 3             # 2 images + 1 video with vision data
        assert stats['unanalyzed'] == 3           # 2 images + 1 video without vision data
        assert stats['total_media'] == 7          # 7 total items including text
    
    def test_get_analysis_stats_empty(self, vision_service):
        """Test analysis statistics with empty input."""
        stats = vision_service.get_analysis_stats([])
        
        assert stats['total_images'] == 0
        assert stats['total_videos'] == 0
        assert stats['analyzed'] == 0
        assert stats['unanalyzed'] == 0
        assert stats['total_media'] == 0
    
    def test_is_valid_video_url(self, vision_service):
        """Test video URL validation."""
        # Valid URLs
        assert vision_service._is_valid_video_url('https://example.com/video.mp4')
        assert vision_service._is_valid_video_url('https://firebasestorage.googleapis.com/video.mp4')
        assert vision_service._is_valid_video_url('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        assert vision_service._is_valid_video_url('https://youtu.be/dQw4w9WgXcQ')
        
        # Invalid URLs
        assert not vision_service._is_valid_video_url('')
        assert not vision_service._is_valid_video_url(None)
        assert not vision_service._is_valid_video_url('null')
        assert not vision_service._is_valid_video_url('javascript:alert(1)')
        assert not vision_service._is_valid_video_url('[object Object]')
        assert not vision_service._is_valid_video_url('ftp://example.com/video.mp4')
    
    @pytest.mark.asyncio
    async def test_analyze_video_method_youtube(self, vision_service, sample_youtube_video, mock_youtube_analysis_response):
        """Test _analyze_video method with YouTube URL."""
        with patch('services.vision_analysis_service.process_youtube_video', return_value=mock_youtube_analysis_response):
            result = await vision_service._analyze_video(sample_youtube_video['url'], sample_youtube_video)
            
            assert result['status'] == 'success'
            assert 'music video' in result['analysis']
            assert result['model'] == 'gemini-2.0-flash-exp'
    
    @pytest.mark.asyncio 
    async def test_analyze_video_method_direct_error(self, vision_service, sample_video_item):
        """Test _analyze_video method with direct video file that has import errors."""
        # This will test the error handling path when genai imports fail
        result = await vision_service._analyze_video(sample_video_item['url'], sample_video_item)
        
        assert result['status'] == 'error'
        assert 'Failed to analyze video' in result['error'] or 'Gemini video analysis failed' in result['error']
    
    def test_get_vision_analysis_service_singleton(self):
        """Test that get_vision_analysis_service returns singleton."""
        service1 = get_vision_analysis_service()
        service2 = get_vision_analysis_service()
        
        # Should be the same instance
        assert service1 is service2
        assert isinstance(service1, VisionAnalysisService)


class TestVisionAnalysisServiceIntegration:
    """Integration tests for vision analysis service."""
    
    @pytest.mark.asyncio
    async def test_real_analysis_flow(self):
        """Test the complete analysis flow with mocked dependencies."""
        service = VisionAnalysisService()
        
        media_item = {
            'id': 'integration-test',
            'type': 'image',
            'url': 'https://firebasestorage.googleapis.com/test-image.jpg',
            'title': 'Integration test image'
        }
        
        # Mock the analyze_image function
        mock_response = {
            'status': 'success',
            'analysis': '''DESCRIPTION: A beautiful landscape with mountains and trees.

KEYWORDS: landscape, mountains, trees, nature, outdoor, scenery, green, blue sky

CATEGORIES: landscape, nature, outdoor'''
        }
        
        with patch('services.vision_analysis_service.analyze_image', return_value=mock_response):
            result = await service.analyze_media_item(media_item)
            
            # Verify complete transformation
            assert result['id'] == media_item['id']
            assert result['title'] == media_item['title']
            assert result['url'] == media_item['url']
            
            # Verify vision data was added
            assert 'landscape' in result['visionDescription']
            assert 'mountains' in result['visionKeywords']
            assert 'nature' in result['visionCategories']
            assert 'landscape mountains trees' in result['enhancedSearchText']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])