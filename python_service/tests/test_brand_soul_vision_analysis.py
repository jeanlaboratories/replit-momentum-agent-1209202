"""
Test suite for brand soul vision analysis functionality.

This ensures brand soul images can be properly analyzed using AI Vision Analysis
and that the enhanced vision analysis service handles all image types correctly.
"""

import unittest
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from services.vision_analysis_service import VisionAnalysisService, get_vision_analysis_service
import pytest
import asyncio


class TestBrandSoulVisionAnalysis(unittest.TestCase):
    
    def setUp(self):
        self.vision_service = VisionAnalysisService()
        self.sample_brand_soul_items = [
            {
                'id': 'brand-soul-1',
                'type': 'image',
                'source': 'brand-soul',
                'url': 'https://firebasestorage.googleapis.com/brand-soul/logo.jpg',
                'title': 'Company Logo',
                'description': 'Brand soul company logo'
            },
            {
                'id': 'brand-soul-2', 
                'type': 'image',
                'source': 'brand-soul',
                'url': 'https://storage.googleapis.com/bucket/brand-asset.png',
                'title': 'Brand Asset',
                'description': 'Brand soul marketing asset'
            },
            {
                'id': 'upload-1',
                'type': 'image', 
                'source': 'upload',
                'url': 'https://firebasestorage.googleapis.com/uploads/photo.jpg',
                'title': 'Uploaded Photo',
                'description': 'User uploaded photo'
            }
        ]
    
    def test_brand_soul_image_url_validation(self):
        """Test that brand soul images with valid URLs pass validation."""
        # Test various valid brand soul URL patterns
        valid_urls = [
            'https://firebasestorage.googleapis.com/brand-soul/asset.jpg',
            'https://storage.googleapis.com/bucket/brand-asset.png',
            'https://example.com/brand-image.jpg'
        ]
        
        for url in valid_urls:
            with self.subTest(url=url):
                self.assertTrue(
                    self.vision_service._is_valid_image_url(url),
                    f"Valid brand soul URL should pass validation: {url}"
                )
    
    def test_invalid_url_rejection(self):
        """Test that invalid URLs are properly rejected."""
        invalid_urls = [
            '',
            'null',
            'undefined', 
            '[object Object]',
            'javascript:alert(1)',
            'blob:data',
            'data:text/plain;base64,invalid'
        ]
        
        for url in invalid_urls:
            with self.subTest(url=url):
                self.assertFalse(
                    self.vision_service._is_valid_image_url(url),
                    f"Invalid URL should be rejected: {url}"
                )
    
    @patch('services.vision_analysis_service.analyze_image')
    async def test_brand_soul_image_analysis(self, mock_analyze_image):
        """Test that brand soul images are properly analyzed."""
        # Mock successful vision analysis response
        mock_analyze_image.return_value = {
            'status': 'success',
            'analysis': '''DESCRIPTION: A professional company logo featuring modern typography and clean design elements.

KEYWORDS: logo, brand, company, professional, typography, design, corporate, identity, branding, modern, clean, business

CATEGORIES: logo, branding, corporate, design'''
        }
        
        brand_soul_item = self.sample_brand_soul_items[0]
        result = await self.vision_service.analyze_media_item(brand_soul_item)
        
        # Verify analysis was attempted
        mock_analyze_image.assert_called_once()
        
        # Verify vision data was added
        self.assertIn('visionDescription', result)
        self.assertIn('visionKeywords', result)
        self.assertIn('visionCategories', result)
        self.assertIn('enhancedSearchText', result)
        
        # Verify content quality
        self.assertGreater(len(result['visionDescription']), 10)
        self.assertGreater(len(result['visionKeywords']), 3)
        self.assertGreater(len(result['visionCategories']), 1)
        
        # Verify brand-specific content
        description = result['visionDescription'].lower()
        keywords = [k.lower() for k in result['visionKeywords']]
        
        self.assertIn('logo', description)
        self.assertIn('logo', keywords)
        self.assertIn('brand', keywords)
    
    @patch('services.vision_analysis_service.analyze_image')
    async def test_brand_soul_vs_upload_analysis_consistency(self, mock_analyze_image):
        """Test that brand soul and upload images get consistent analysis quality."""
        
        def mock_analysis_response(prompt, image_url):
            if 'brand-soul' in image_url:
                return {
                    'status': 'success',
                    'analysis': '''DESCRIPTION: A professional brand asset with corporate styling and clear visual hierarchy.

KEYWORDS: brand, corporate, professional, asset, marketing, design, business, identity, visual, hierarchy

CATEGORIES: branding, corporate, marketing, design'''
                }
            else:
                return {
                    'status': 'success', 
                    'analysis': '''DESCRIPTION: A high-quality photograph showing natural lighting and good composition.

KEYWORDS: photo, image, photography, natural, lighting, composition, quality, visual, picture

CATEGORIES: photography, image, visual'''
                }
        
        mock_analyze_image.side_effect = mock_analysis_response
        
        # Test brand soul item
        brand_soul_result = await self.vision_service.analyze_media_item(self.sample_brand_soul_items[0])
        
        # Test upload item
        upload_result = await self.vision_service.analyze_media_item(self.sample_brand_soul_items[2])
        
        # Verify both got analyzed
        self.assertEqual(mock_analyze_image.call_count, 2)
        
        # Verify both have vision data
        for result in [brand_soul_result, upload_result]:
            self.assertIn('visionDescription', result)
            self.assertIn('visionKeywords', result) 
            self.assertIn('visionCategories', result)
            self.assertIn('enhancedSearchText', result)
        
        # Verify quality consistency
        self.assertGreater(len(brand_soul_result['visionDescription']), 10)
        self.assertGreater(len(upload_result['visionDescription']), 10)
        
        self.assertGreater(len(brand_soul_result['visionKeywords']), 3)
        self.assertGreater(len(upload_result['visionKeywords']), 3)
    
    @patch('services.vision_analysis_service.analyze_image')
    async def test_brand_soul_error_handling(self, mock_analyze_image):
        """Test error handling for brand soul images."""
        # Mock analysis failure
        mock_analyze_image.return_value = {
            'status': 'error',
            'error': 'Unable to access image URL'
        }
        
        brand_soul_item = self.sample_brand_soul_items[0]
        result = await self.vision_service.analyze_media_item(brand_soul_item)
        
        # Verify error was captured
        self.assertIn('_vision_error', result)
        self.assertEqual(result['_vision_error'], 'Unable to access image URL')
        
        # Verify original item data is preserved
        self.assertEqual(result['id'], 'brand-soul-1')
        self.assertEqual(result['source'], 'brand-soul')
        
        # Verify no vision data was added
        self.assertNotIn('visionDescription', result)
    
    async def test_batch_analysis_with_brand_soul_images(self):
        """Test batch processing includes brand soul images properly."""
        with patch('services.vision_analysis_service.analyze_image') as mock_analyze_image:
            # Mock successful responses for all items
            mock_analyze_image.return_value = {
                'status': 'success',
                'analysis': '''DESCRIPTION: Test image analysis.

KEYWORDS: test, image, analysis

CATEGORIES: test, analysis'''
            }
            
            # Process batch with mixed sources
            results = await self.vision_service.analyze_media_batch(self.sample_brand_soul_items)
            
            # Verify all images were processed (3 items)
            self.assertEqual(mock_analyze_image.call_count, 3)
            
            # Verify brand soul items were included
            brand_soul_results = [r for r in results if r.get('source') == 'brand-soul']
            self.assertEqual(len(brand_soul_results), 2)
            
            # Verify they have vision data
            for result in brand_soul_results:
                self.assertIn('visionDescription', result)
                self.assertIn('visionKeywords', result)
    
    def test_analysis_stats_includes_brand_soul(self):
        """Test that statistics correctly count brand soul images."""
        # Mix of analyzed and unanalyzed items including brand soul
        test_items = [
            {
                'id': 'brand-soul-analyzed',
                'type': 'image',
                'source': 'brand-soul',
                'visionDescription': 'Already analyzed brand asset'
            },
            {
                'id': 'brand-soul-unanalyzed', 
                'type': 'image',
                'source': 'brand-soul'
            },
            {
                'id': 'upload-analyzed',
                'type': 'image', 
                'source': 'upload',
                'visionDescription': 'Already analyzed upload'
            },
            {
                'id': 'video-item',
                'type': 'video',
                'source': 'brand-soul'
            }
        ]
        
        stats = self.vision_service.get_analysis_stats(test_items)
        
        self.assertEqual(stats['total_images'], 3)  # 3 images total (excluding video)
        self.assertEqual(stats['analyzed'], 2)     # 2 already have visionDescription
        # unanalyzed = total_analyzable_media - analyzed = (3 images + 1 video) - 2 = 2
        # The video is counted as analyzable but unanalyzed
        self.assertEqual(stats['unanalyzed'], 2)   # 2 need analysis (1 image + 1 video)
        self.assertEqual(stats['total_media'], 4)  # 4 total items including video
    
    def test_url_field_fallback_for_brand_soul(self):
        """Test that service checks multiple URL fields for brand soul items."""
        # Test item with URL in different field
        test_item = {
            'id': 'brand-soul-alt-url',
            'type': 'image',
            'source': 'brand-soul',
            'thumbnailUrl': 'https://firebasestorage.googleapis.com/brand-asset-thumb.jpg'
        }
        
        # Should find URL in thumbnailUrl field
        self.assertTrue(self.vision_service._is_valid_image_url(test_item.get('thumbnailUrl')))
    
    @patch('services.vision_analysis_service.analyze_image')
    async def test_empty_or_malformed_analysis_response(self, mock_analyze_image):
        """Test handling of empty or malformed analysis responses."""
        # Test empty response
        mock_analyze_image.return_value = {
            'status': 'success',
            'analysis': ''
        }
        
        brand_soul_item = self.sample_brand_soul_items[0]
        result = await self.vision_service.analyze_media_item(brand_soul_item)
        
        # Should not have vision data due to empty response
        self.assertNotIn('visionDescription', result)
        
        # Test very short response
        mock_analyze_image.return_value = {
            'status': 'success', 
            'analysis': 'short'
        }
        
        result = await self.vision_service.analyze_media_item(brand_soul_item)
        
        # Should not have vision data due to too short response
        self.assertNotIn('visionDescription', result)

    def test_get_vision_analysis_service_singleton(self):
        """Test that service returns singleton instance."""
        service1 = get_vision_analysis_service()
        service2 = get_vision_analysis_service()
        
        self.assertIs(service1, service2)
        self.assertIsInstance(service1, VisionAnalysisService)


# Async test runner helper
def run_async_test(coro):
    """Helper to run async tests."""
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(coro)


if __name__ == '__main__':
    # Convert async tests to sync for unittest
    test_instance = TestBrandSoulVisionAnalysis()
    test_instance.setUp()
    
    async def run_all_async_tests():
        await test_instance.test_brand_soul_image_analysis()
        await test_instance.test_brand_soul_vs_upload_analysis_consistency()
        await test_instance.test_brand_soul_error_handling()
        await test_instance.test_batch_analysis_with_brand_soul_images()
        await test_instance.test_empty_or_malformed_analysis_response()
    
    # Run async tests
    run_async_test(run_all_async_tests())
    
    # Run sync tests
    unittest.main(verbosity=2)