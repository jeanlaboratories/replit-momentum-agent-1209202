import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEditedImage } from './generate-edited-image';
import { getBrandSoulContext } from '@/lib/brand-soul/context';

// Mock JobQueueProvider to prevent "useJobQueue must be used within a JobQueueProvider" error
vi.mock('@/contexts/job-queue-context', () => ({
  JobQueueProvider: ({ children }: any) => children,
  useJobQueue: () => ({
    state: { jobs: [], isExpanded: false, isPanelVisible: true },
    addJob: vi.fn(() => 'mock-job-id'),
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    clearCompleted: vi.fn(),
    cancelJob: vi.fn(),
    startJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    setProgress: vi.fn(),
    toggleExpanded: vi.fn(),
    setExpanded: vi.fn(),
    setPanelVisible: vi.fn(),
    getActiveJobs: vi.fn(() => []),
    getCompletedJobs: vi.fn(() => []),
    getJobById: vi.fn(),
    hasActiveJobs: vi.fn(() => false),
    isJobStalled: vi.fn(() => false),
    getStalledJobs: vi.fn(() => []),
  }),
  useJob: () => ({
    jobId: null,
    create: vi.fn(() => 'mock-job-id'),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    progress: vi.fn(),
    update: vi.fn(),
    getJob: vi.fn(),
  }),
}));

// Mock dependencies
vi.mock('@/lib/brand-soul/context', () => ({
  getBrandSoulContext: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('generateEditedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for successful Python service response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        image_url: 'https://storage.example.com/generated-image.png',
      }),
    });
  });

  it('should generate an edited image with a single source image', async () => {
    const result = await generateEditedImage({
      prompt: 'Make it blue',
      imageUrl: 'http://example.com/image.png',
    });

    // Verify result contains imageUrl (and other enhanced fields)
    expect(result).toEqual(expect.objectContaining({
      imageUrl: 'https://storage.example.com/generated-image.png',
      imageUrls: ['https://storage.example.com/generated-image.png'],
    }));

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/agent/nano-banana',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Make it blue'),
      })
    );
  });

  it('should generate an edited image with multiple source images', async () => {
    const result = await generateEditedImage({
      prompt: 'Fuse these images',
      imageUrl: 'http://example.com/image1.png',
      additionalImageUrls: ['http://example.com/image2.png', 'http://example.com/image3.png'],
    });

    // Verify result contains imageUrl (and other enhanced fields)
    expect(result).toEqual(expect.objectContaining({
      imageUrl: 'https://storage.example.com/generated-image.png',
      imageUrls: ['https://storage.example.com/generated-image.png'],
    }));

    // Verify fetch was called with reference_images
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/agent/nano-banana',
      expect.objectContaining({
        body: expect.stringContaining('image2.png'),
      })
    );
  });

  it('should inject Brand Soul guidelines when brandId is provided', async () => {
    (getBrandSoulContext as any).mockResolvedValue({
      exists: true,
      visualGuidelines: 'Use neon colors only.'
    });

    await generateEditedImage({
      prompt: 'Edit this',
      imageUrl: 'data:image/png;base64,data',
      brandId: 'test-brand-id'
    });

    // Verify fetch was called with enhanced prompt containing brand guidelines
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.prompt).toContain('BRAND VISUAL GUIDELINES');
    expect(body.prompt).toContain('Use neon colors only');
  });

  it('should handle image_data response format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        image_data: 'base64encodeddata',
      }),
    });

    const result = await generateEditedImage({
      prompt: 'Edit this',
      imageUrl: 'data:image/png;base64,data',
    });

    // Verify result contains imageUrl as data URI
    expect(result).toEqual(expect.objectContaining({
      imageUrl: 'data:image/png;base64,base64encodeddata',
    }));
  });

  it('should throw error on Python service failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ detail: 'Service unavailable' }),
    });

    await expect(generateEditedImage({
      prompt: 'Edit this',
      imageUrl: 'data:image/png;base64,data',
    })).rejects.toThrow('Service unavailable');
  });
});
