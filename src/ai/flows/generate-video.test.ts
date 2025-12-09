import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVideo } from './generate-video';

// Mock dependencies
vi.mock('@/lib/brand-soul/context', () => ({
  getBrandSoulContext: vi.fn().mockResolvedValue({ exists: false }),
}));

// Mock fetch
global.fetch = vi.fn();
process.env.PYTHON_SERVICE_URL = 'http://localhost:8000';

describe('generateVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a video by calling Python service', async () => {
  // Setup mock response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://example.com/video.mp4' }),
    });

    // Call function
    const result = await generateVideo({ prompt: 'A cinematic shot' });

    // Verify
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/media/generate-video',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'A cinematic shot',
          aspect_ratio: '9:16',
        }),
      })
    );
    expect(result.videoUrl).toBe('https://example.com/video.mp4');
  });

  it('should include image input for Image-to-Video', async () => {
    // Setup mock response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://example.com/video.mp4' }),
    });

    // Call function
    await generateVideo({
      prompt: 'Animate this',
      imageUrl: 'https://example.com/image.png'
    });

    // Verify
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/media/generate-video',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Animate this',
          image_url: 'https://example.com/image.png',
          aspect_ratio: '9:16',
        }),
      })
    );
  });

  it('should include start and end frames for Frames-to-Video', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ videoUrl: 'https://example.com/video.mp4' }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const input = {
      prompt: 'test prompt',
      startFrameUrl: 'https://example.com/start.jpg',
      endFrameUrl: 'https://example.com/end.jpg',
    };

    const result = await generateVideo(input);

    expect(result).toEqual({ videoUrl: 'https://example.com/video.mp4' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/media/generate-video',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt',
          start_frame: 'https://example.com/start.jpg',
          end_frame: 'https://example.com/end.jpg',
          aspect_ratio: '9:16',
        }),
      })
    );
  });

  it('should handle errors from Python service', async () => {
  // Setup mock error response
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    // Call function and expect error
    await expect(generateVideo({ prompt: 'Fail me' })).rejects.toThrow(
      'Failed to generate video: Python service error: 500 Internal Server Error'
    );
  });

  it('should handle missing video URL in response', async () => {
  // Setup mock response with missing URL
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}), // No videoUrl
    });

    // Call function and expect error
    await expect(generateVideo({ prompt: 'No URL' })).rejects.toThrow(
      'Failed to generate video: No video URL returned from Python service'
    );
  });

  it('should include all Veo 3.1 parameters', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://example.com/video.mp4' }),
    });

    await generateVideo({
      prompt: 'Test video',
      resolution: '1080p',
      durationSeconds: 8,
      personGeneration: 'allow_all',
      useFastModel: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/media/generate-video',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test video',
          aspect_ratio: '9:16',
          resolution: '1080p',
          duration_seconds: 8,
          person_generation: 'allow_all',
          use_fast_model: true,
        }),
      })
    );
  });

  it('should support video extension', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://example.com/extended.mp4' }),
    });

    await generateVideo({
      prompt: 'Extend this video',
      videoUrl: 'https://example.com/original.mp4',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/media/generate-video',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Extend this video',
          aspect_ratio: '9:16',
          video_url: 'https://example.com/original.mp4',
        }),
      })
    );
  });

  it('should support multiple reference images', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ videoUrl: 'https://example.com/video.mp4' }),
    });

    await generateVideo({
      prompt: 'Video with references',
      referenceImages: [
        'https://example.com/ref1.jpg',
        'https://example.com/ref2.jpg',
        'https://example.com/ref3.jpg',
      ],
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.reference_images).toEqual([
      'https://example.com/ref1.jpg',
      'https://example.com/ref2.jpg',
      'https://example.com/ref3.jpg',
    ]);
  });
});
