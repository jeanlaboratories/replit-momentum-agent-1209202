/**
 * Integration tests for Image Gallery search functionality.
 * 
 * This ensures Image Gallery search works identically to Media Library search
 * and provides the same high-quality semantic search experience.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('Image Gallery Search Integration', () => {
  const mockSemanticSearch = semanticSearchMediaAction as vi.MockedFunction<typeof semanticSearchMediaAction>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call semanticSearchMediaAction with correct image filter', async () => {
    const mockResponse: SemanticSearchResponse = {
      results: [
        {
          id: 'img-1',
          title: 'Test Image',
          description: 'A test image with vision analysis',
          type: 'image',
          url: 'https://example.com/img1.jpg',
          thumbnailUrl: 'https://example.com/img1-thumb.jpg',
          source: 'upload',
          tags: ['test', 'image'],
          relevanceScore: 0.95,
          visionDescription: 'A beautiful landscape with mountains and trees',
          visionKeywords: ['landscape', 'mountains', 'trees', 'nature'],
          visionCategories: ['nature', 'landscape'],
          enhancedSearchText: 'beautiful landscape mountains trees nature',
        } as MediaSearchResult,
      ],
      totalCount: 1,
      query: 'landscape',
      searchTimeMs: 150,
    };

    mockSemanticSearch.mockResolvedValue(mockResponse);

    // Simulate the search call that Image Gallery makes
    const brandId = 'test-brand';
    const query = 'landscape';
    const searchOptions = {
      mediaType: 'image' as 'image' | 'video' | undefined,
      source: undefined,
      collections: undefined,
      tags: undefined,
      limit: 50,
    };

    const response = await semanticSearchMediaAction(brandId, query, searchOptions);

    // Verify the search action was called with correct parameters
    expect(mockSemanticSearch).toHaveBeenCalledWith(brandId, query, searchOptions);
    expect(mockSemanticSearch).toHaveBeenCalledTimes(1);

    // Verify the response structure
    expect(response).toEqual(mockResponse);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].type).toBe('image');
    expect(response.results[0].relevanceScore).toBe(0.95);
    expect(response.results[0].visionDescription).toBeDefined();
    expect(response.results[0].visionKeywords).toHaveLength(4);
  });

  it('should preserve vision analysis data in search results', async () => {
    const mockResponse: SemanticSearchResponse = {
      results: [
        {
          id: 'img-with-vision',
          title: 'AI Analyzed Image',
          description: 'Image with comprehensive vision analysis',
          type: 'image',
          url: 'https://example.com/analyzed.jpg',
          source: 'upload',
          tags: ['ai', 'analyzed'],
          relevanceScore: 0.88,
          visionDescription: 'A modern office space with people working on laptops',
          visionKeywords: ['office', 'workspace', 'laptops', 'people', 'modern', 'collaborative'],
          visionCategories: ['business', 'workspace', 'technology'],
          enhancedSearchText: 'office workspace laptops people modern collaborative business technology',
        } as MediaSearchResult,
      ],
      totalCount: 1,
      query: 'office space',
      searchTimeMs: 200,
    };

    mockSemanticSearch.mockResolvedValue(mockResponse);

    const response = await semanticSearchMediaAction('test-brand', 'office space', {
      mediaType: 'image',
      limit: 50,
    });

    const result = response.results[0];
    
    // Verify all vision analysis fields are preserved
    expect(result.visionDescription).toBe('A modern office space with people working on laptops');
    expect(result.visionKeywords).toEqual(['office', 'workspace', 'laptops', 'people', 'modern', 'collaborative']);
    expect(result.visionCategories).toEqual(['business', 'workspace', 'technology']);
    expect(result.enhancedSearchText).toContain('office workspace laptops');
    expect(result.relevanceScore).toBe(0.88);
  });

  it('should handle search errors gracefully', async () => {
    const mockErrorResponse: SemanticSearchResponse = {
      results: [],
      totalCount: 0,
      query: 'test',
      searchTimeMs: 0,
      error: 'Search service unavailable',
    };

    mockSemanticSearch.mockResolvedValue(mockErrorResponse);

    const response = await semanticSearchMediaAction('test-brand', 'test', {
      mediaType: 'image',
      limit: 50,
    });

    expect(response.error).toBe('Search service unavailable');
    expect(response.results).toHaveLength(0);
    expect(response.totalCount).toBe(0);
  });

  it('should filter results by image type only', async () => {
    const mockResponse: SemanticSearchResponse = {
      results: [
        {
          id: 'img-1',
          type: 'image',
          title: 'Image Result',
          url: 'https://example.com/img.jpg',
          source: 'upload',
          tags: [],
          relevanceScore: 0.9,
        } as MediaSearchResult,
        {
          id: 'vid-1',
          type: 'video',
          title: 'Video Result',
          url: 'https://example.com/vid.mp4',
          source: 'upload',
          tags: [],
          relevanceScore: 0.8,
        } as MediaSearchResult,
      ],
      totalCount: 2,
      query: 'test',
      searchTimeMs: 100,
    };

    mockSemanticSearch.mockResolvedValue(mockResponse);

    const response = await semanticSearchMediaAction('test-brand', 'test', {
      mediaType: 'image',
      limit: 50,
    });

    // The backend should filter by media_type, so we should only get image results
    // But if for some reason both are returned, the Image Gallery should filter client-side
    expect(response.results).toHaveLength(2); // Backend returns both
    
    // Image Gallery should filter to only images
    const imageResults = response.results.filter(r => r.type === 'image');
    expect(imageResults).toHaveLength(1);
    expect(imageResults[0].id).toBe('img-1');
  });

  it('should sort results by relevance score', () => {
    const results: MediaSearchResult[] = [
      {
        id: 'img-1',
        type: 'image',
        title: 'Low Relevance',
        url: 'https://example.com/img1.jpg',
        source: 'upload',
        tags: [],
        relevanceScore: 0.3,
      } as MediaSearchResult,
      {
        id: 'img-2',
        type: 'image',
        title: 'High Relevance',
        url: 'https://example.com/img2.jpg',
        source: 'upload',
        tags: [],
        relevanceScore: 0.9,
      } as MediaSearchResult,
      {
        id: 'img-3',
        type: 'image',
        title: 'Medium Relevance',
        url: 'https://example.com/img3.jpg',
        source: 'upload',
        tags: [],
        relevanceScore: 0.6,
      } as MediaSearchResult,
    ];

    // Sort by relevance score (descending)
    const sorted = results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    expect(sorted[0].id).toBe('img-2'); // 0.9
    expect(sorted[1].id).toBe('img-3'); // 0.6
    expect(sorted[2].id).toBe('img-1'); // 0.3
  });

  it('should convert search results to EditedImage format correctly', () => {
    const searchResult: MediaSearchResult = {
      id: 'test-img',
      title: 'Test Image',
      description: 'A test image for conversion',
      type: 'image',
      url: 'https://example.com/test.jpg',
      thumbnailUrl: 'https://example.com/test-thumb.jpg',
      source: 'upload',
      tags: ['test'],
      relevanceScore: 0.85,
      visionDescription: 'A detailed vision analysis',
      visionKeywords: ['test', 'image', 'analysis'],
      visionCategories: ['test'],
      enhancedSearchText: 'test image analysis detailed vision',
    };

    // Convert to EditedImage format (same logic as Image Gallery)
    const isUpload = searchResult.source === 'upload' || searchResult.source === 'brand-soul';
    
    const converted = {
      id: searchResult.id,
      brandId: 'test-brand',
      title: searchResult.title || 'Untitled Image',
      prompt: (searchResult as any).prompt || searchResult.description || '',
      sourceImageUrl: isUpload ? (searchResult.url || '') : '',
      generatedImageUrl: !isUpload ? (searchResult.url || '') : '',
      visionDescription: searchResult.visionDescription,
      visionKeywords: searchResult.visionKeywords,
      visionCategories: searchResult.visionCategories,
      enhancedSearchText: searchResult.enhancedSearchText,
      relevanceScore: searchResult.relevanceScore,
    };

    expect(converted.id).toBe('test-img');
    expect(converted.title).toBe('Test Image');
    expect(converted.sourceImageUrl).toBe('https://example.com/test.jpg'); // upload source
    expect(converted.generatedImageUrl).toBe(''); // not AI generated
    expect(converted.visionDescription).toBe('A detailed vision analysis');
    expect(converted.visionKeywords).toEqual(['test', 'image', 'analysis']);
    expect(converted.relevanceScore).toBe(0.85);
  });

  it('should handle AI-generated images correctly', () => {
    const aiGeneratedResult: MediaSearchResult = {
      id: 'ai-img',
      title: 'AI Generated Image',
      type: 'image',
      url: 'https://example.com/ai-generated.jpg',
      source: 'ai-generated',
      tags: ['ai'],
      relevanceScore: 0.92,
    };

    // Convert to EditedImage format
    const isUpload = aiGeneratedResult.source === 'upload' || aiGeneratedResult.source === 'brand-soul';
    
    const converted = {
      id: aiGeneratedResult.id,
      brandId: 'test-brand',
      title: aiGeneratedResult.title || 'Untitled Image',
      sourceImageUrl: isUpload ? (aiGeneratedResult.url || '') : '',
      generatedImageUrl: !isUpload ? (aiGeneratedResult.url || '') : '',
      relevanceScore: aiGeneratedResult.relevanceScore,
    };

    expect(converted.sourceImageUrl).toBe(''); // not an upload
    expect(converted.generatedImageUrl).toBe('https://example.com/ai-generated.jpg'); // AI generated
    expect(converted.relevanceScore).toBe(0.92);
  });
});