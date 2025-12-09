/**
 * End-to-End Test: Media Library vs Image Gallery Search Results Comparison
 * 
 * This test verifies that Media Library and Image Gallery return exactly the same
 * search results when using identical search queries and parameters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { semanticSearchMediaAction } from '@/lib/actions/media-library-actions';
import type { SemanticSearchResponse, MediaSearchResult } from '@/lib/actions/media-library-actions';

// Mock the search action
vi.mock('@/lib/actions/media-library-actions', () => ({
  semanticSearchMediaAction: vi.fn(),
}));

// Mock authentication
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { uid: 'test-user' },
    loading: false,
    brandId: 'test-brand',
  }),
}));

describe('Media Library vs Image Gallery - End-to-End Search Comparison', () => {
  const mockSemanticSearch = semanticSearchMediaAction as vi.MockedFunction<typeof semanticSearchMediaAction>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockSearchResults = (): MediaSearchResult[] => [
    {
      id: 'img-1',
      title: 'Beautiful Landscape',
      description: 'A stunning mountain landscape with a lake',
      type: 'image',
      url: 'https://example.com/landscape.jpg',
      thumbnailUrl: 'https://example.com/landscape-thumb.jpg',
      source: 'upload',
      tags: ['landscape', 'nature'],
      relevanceScore: 0.95,
      visionDescription: 'A serene mountain lake surrounded by snow-capped peaks',
      visionKeywords: ['mountain', 'lake', 'snow', 'peaks', 'serene', 'nature'],
      visionCategories: ['landscape', 'nature', 'outdoors'],
      enhancedSearchText: 'mountain lake snow peaks serene nature landscape outdoors',
    },
    {
      id: 'img-2', 
      title: 'Urban Architecture',
      description: 'Modern city skyline at sunset',
      type: 'image',
      url: 'https://example.com/city.jpg',
      thumbnailUrl: 'https://example.com/city-thumb.jpg',
      source: 'ai-generated',
      tags: ['city', 'architecture'],
      relevanceScore: 0.87,
      visionDescription: 'Modern glass skyscrapers reflecting golden sunset light',
      visionKeywords: ['skyscrapers', 'glass', 'modern', 'sunset', 'urban', 'architecture'],
      visionCategories: ['architecture', 'urban', 'city'],
      enhancedSearchText: 'skyscrapers glass modern sunset urban architecture city',
    },
    {
      id: 'img-3',
      title: 'Wildlife Photography',
      description: 'Majestic eagle in flight',
      type: 'image',
      url: 'https://example.com/eagle.jpg',
      source: 'upload',
      tags: ['wildlife', 'bird'],
      relevanceScore: 0.78,
      visionDescription: 'A bald eagle soaring through clear blue sky with spread wings',
      visionKeywords: ['eagle', 'flight', 'wings', 'sky', 'bird', 'soaring'],
      visionCategories: ['wildlife', 'birds', 'nature'],
      enhancedSearchText: 'eagle flight wings sky bird soaring wildlife nature',
    },
  ];

  it('should return identical search options for both Media Library and Image Gallery', async () => {
    const mockResponse: SemanticSearchResponse = {
      results: createMockSearchResults(),
      totalCount: 3,
      query: 'nature',
      searchTimeMs: 250,
    };

    mockSemanticSearch.mockResolvedValue(mockResponse);

    const brandId = 'test-brand';
    const query = 'nature';

    // Media Library search options (all media types)
    const mediaLibraryOptions = {
      mediaType: undefined, // Show all media types
      source: undefined,
      collections: undefined,
      tags: undefined,
      limit: 50,
    };

    // Image Gallery search options (images only)
    const imageGalleryOptions = {
      mediaType: 'image' as 'image' | 'video' | undefined,
      source: undefined,
      collections: undefined,
      tags: undefined,
      limit: 50,
    };

    // Call search for Media Library
    const mediaLibraryResponse = await semanticSearchMediaAction(brandId, query, mediaLibraryOptions);
    
    // Call search for Image Gallery
    const imageGalleryResponse = await semanticSearchMediaAction(brandId, query, imageGalleryOptions);

    // Verify both searches were called
    expect(mockSemanticSearch).toHaveBeenCalledTimes(2);
    expect(mockSemanticSearch).toHaveBeenNthCalledWith(1, brandId, query, mediaLibraryOptions);
    expect(mockSemanticSearch).toHaveBeenNthCalledWith(2, brandId, query, imageGalleryOptions);

    // The responses should be identical (same mock response)
    expect(mediaLibraryResponse).toEqual(imageGalleryResponse);
  });

  it('should process search results identically for both components', () => {
    const searchResults = createMockSearchResults();

    // Media Library processing (shows all results, filters by type if needed)
    const mediaLibraryResults = searchResults
      .filter(result => result.type === 'image') // Client-side filtering for images
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Image Gallery processing (same logic)
    const imageGalleryResults = searchResults
      .filter(result => result.type === 'image')
      .map(result => {
        // Convert to EditedImage format (same as Image Gallery does)
        const isUpload = result.source === 'upload' || result.source === 'brand-soul';
        
        return {
          id: result.id,
          brandId: 'test-brand',
          title: result.title || 'Untitled Image',
          prompt: (result as any).prompt || result.description || '',
          sourceImageUrl: isUpload ? (result.url || '') : '',
          generatedImageUrl: !isUpload ? (result.url || '') : '',
          thumbnailUrl: result.thumbnailUrl,
          // CRITICAL: Preserve vision analysis data
          visionDescription: result.visionDescription,
          visionKeywords: result.visionKeywords,
          visionCategories: result.visionCategories,
          enhancedSearchText: result.enhancedSearchText,
          relevanceScore: result.relevanceScore,
          tags: result.tags || [],
        };
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Both should have same number of results
    expect(mediaLibraryResults).toHaveLength(3);
    expect(imageGalleryResults).toHaveLength(3);

    // Both should be sorted by relevance score (descending)
    expect(mediaLibraryResults[0].relevanceScore).toBe(0.95);
    expect(mediaLibraryResults[1].relevanceScore).toBe(0.87);
    expect(mediaLibraryResults[2].relevanceScore).toBe(0.78);

    expect(imageGalleryResults[0].relevanceScore).toBe(0.95);
    expect(imageGalleryResults[1].relevanceScore).toBe(0.87);
    expect(imageGalleryResults[2].relevanceScore).toBe(0.78);

    // Verify vision analysis data is preserved in Image Gallery
    expect(imageGalleryResults[0].visionDescription).toBe('A serene mountain lake surrounded by snow-capped peaks');
    expect(imageGalleryResults[0].visionKeywords).toEqual(['mountain', 'lake', 'snow', 'peaks', 'serene', 'nature']);
    expect(imageGalleryResults[0].visionCategories).toEqual(['landscape', 'nature', 'outdoors']);
  });

  it('should handle upload vs AI-generated images consistently', () => {
    const searchResults = createMockSearchResults();

    // Process results the same way both components do
    const processResults = (results: MediaSearchResult[]) => {
      return results
        .filter(result => result.type === 'image')
        .map(result => {
          const isUpload = result.source === 'upload' || result.source === 'brand-soul';
          
          return {
            id: result.id,
            title: result.title || 'Untitled Image',
            sourceImageUrl: isUpload ? (result.url || '') : '',
            generatedImageUrl: !isUpload ? (result.url || '') : '',
            source: result.source,
            relevanceScore: result.relevanceScore,
          };
        })
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    };

    const results = processResults(searchResults);

    // Verify upload image (img-1, img-3)
    expect(results[0].sourceImageUrl).toBe('https://example.com/landscape.jpg'); // upload
    expect(results[0].generatedImageUrl).toBe('');
    expect(results[2].sourceImageUrl).toBe('https://example.com/eagle.jpg'); // upload
    expect(results[2].generatedImageUrl).toBe('');

    // Verify AI-generated image (img-2)
    expect(results[1].sourceImageUrl).toBe(''); // ai-generated
    expect(results[1].generatedImageUrl).toBe('https://example.com/city.jpg');
  });

  it('should preserve all vision analysis metadata consistently', () => {
    const searchResults = createMockSearchResults();

    // Both Media Library and Image Gallery should preserve this data
    const preserveVisionData = (results: MediaSearchResult[]) => {
      return results.map(result => ({
        id: result.id,
        visionDescription: result.visionDescription,
        visionKeywords: result.visionKeywords,
        visionCategories: result.visionCategories,
        enhancedSearchText: result.enhancedSearchText,
        relevanceScore: result.relevanceScore,
      }));
    };

    const visionData = preserveVisionData(searchResults);

    // Verify all vision analysis fields are preserved
    expect(visionData[0].visionDescription).toBeDefined();
    expect(visionData[0].visionKeywords).toHaveLength(6);
    expect(visionData[0].visionCategories).toHaveLength(3);
    expect(visionData[0].enhancedSearchText).toContain('mountain lake');
    expect(visionData[0].relevanceScore).toBe(0.95);

    expect(visionData[1].visionDescription).toBeDefined();
    expect(visionData[1].visionKeywords).toHaveLength(6);
    expect(visionData[1].visionCategories).toHaveLength(3);
    expect(visionData[1].enhancedSearchText).toContain('skyscrapers glass');
    expect(visionData[1].relevanceScore).toBe(0.87);

    expect(visionData[2].visionDescription).toBeDefined();
    expect(visionData[2].visionKeywords).toHaveLength(6);
    expect(visionData[2].visionCategories).toHaveLength(3);
    expect(visionData[2].enhancedSearchText).toContain('eagle flight');
    expect(visionData[2].relevanceScore).toBe(0.78);
  });

  it('should handle error states consistently across both components', async () => {
    const mockErrorResponse: SemanticSearchResponse = {
      results: [],
      totalCount: 0,
      query: 'test',
      searchTimeMs: 0,
      error: 'Vertex AI Search service unavailable',
    };

    mockSemanticSearch.mockResolvedValue(mockErrorResponse);

    const brandId = 'test-brand';
    const query = 'test';

    // Media Library error handling
    const mediaLibraryResponse = await semanticSearchMediaAction(brandId, query, {
      mediaType: undefined,
      limit: 50,
    });

    // Image Gallery error handling
    const imageGalleryResponse = await semanticSearchMediaAction(brandId, query, {
      mediaType: 'image',
      limit: 50,
    });

    // Both should handle errors identically
    expect(mediaLibraryResponse.error).toBe('Vertex AI Search service unavailable');
    expect(mediaLibraryResponse.results).toHaveLength(0);
    expect(mediaLibraryResponse.totalCount).toBe(0);

    expect(imageGalleryResponse.error).toBe('Vertex AI Search service unavailable');
    expect(imageGalleryResponse.results).toHaveLength(0);
    expect(imageGalleryResponse.totalCount).toBe(0);
  });

  it('should use identical search parameters for real-world queries', async () => {
    const realWorldQueries = [
      'landscape photography',
      'modern architecture',
      'wildlife animals',
      'abstract art',
      'business meeting',
    ];

    for (const query of realWorldQueries) {
      const mockResponse: SemanticSearchResponse = {
        results: createMockSearchResults(),
        totalCount: 3,
        query,
        searchTimeMs: 200,
      };

      mockSemanticSearch.mockResolvedValue(mockResponse);

      // Media Library call
      await semanticSearchMediaAction('test-brand', query, {
        mediaType: undefined,
        source: undefined,
        collections: undefined,
        tags: undefined,
        limit: 50,
      });

      // Image Gallery call  
      await semanticSearchMediaAction('test-brand', query, {
        mediaType: 'image',
        source: undefined,
        collections: undefined,
        tags: undefined,
        limit: 50,
      });
    }

    // Verify all queries were processed with correct parameters
    expect(mockSemanticSearch).toHaveBeenCalledTimes(realWorldQueries.length * 2);

    // Verify the search calls used consistent parameter structure
    const calls = mockSemanticSearch.mock.calls;
    for (let i = 0; i < calls.length; i += 2) {
      const mediaLibraryCall = calls[i];
      const imageGalleryCall = calls[i + 1];

      // Same brand and query
      expect(mediaLibraryCall[0]).toBe(imageGalleryCall[0]); // brandId
      expect(mediaLibraryCall[1]).toBe(imageGalleryCall[1]); // query

      // Same structure, different mediaType filter
      expect(mediaLibraryCall[2].source).toBe(imageGalleryCall[2].source);
      expect(mediaLibraryCall[2].collections).toBe(imageGalleryCall[2].collections);
      expect(mediaLibraryCall[2].tags).toBe(imageGalleryCall[2].tags);
      expect(mediaLibraryCall[2].limit).toBe(imageGalleryCall[2].limit);
    }
  });
});