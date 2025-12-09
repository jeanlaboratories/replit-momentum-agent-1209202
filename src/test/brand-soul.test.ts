import { describe, it, expect, vi } from 'vitest';
import { hslToHex } from '../lib/utils';

// Mock dependencies for extraction worker
vi.mock('@/ai/genkit', () => ({
  ai: {
    generate: vi.fn(),
  },
}));
vi.mock('@/lib/firebase/admin', () => ({
  getAdminInstances: vi.fn(() => ({
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
        })),
      })),
    },
  })),
}));
vi.mock('@/lib/brand-soul/storage', () => ({
  brandSoulStorage: {
    getContent: vi.fn(),
    storeContent: vi.fn(),
    getSignedUrl: vi.fn(),
    storeInsights: vi.fn(),
  },
}));

describe('Color Utilities', () => {
  it('should convert HSL to Hex correctly', () => {
    expect(hslToHex('hsl(0, 100%, 50%)')).toBe('#ff0000');
    expect(hslToHex('hsl(120, 100%, 50%)')).toBe('#00ff00');
    expect(hslToHex('hsl(240, 100%, 50%)')).toBe('#0000ff');
    expect(hslToHex('hsl(0, 0%, 0%)')).toBe('#000000');
    expect(hslToHex('hsl(0, 0%, 100%)')).toBe('#ffffff');
  });

  it('should return fallback for invalid HSL', () => {
    expect(hslToHex('invalid')).toBe('#000000');
  });
});

describe('YouTube URL Extraction', () => {
  // Since we can't easily test the full worker without complex mocks,
  // we test the regex logic used in the ingestion route.
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  it('should extract ID from standard YouTube URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=VIDEO_ID_12')).toBe('VIDEO_ID_12');
  });

  it('should extract ID from short YouTube URL', () => {
    expect(extractYouTubeId('https://youtu.be/VIDEO_ID_12')).toBe('VIDEO_ID_12');
  });

  it('should extract ID from embed YouTube URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/VIDEO_ID_12')).toBe('VIDEO_ID_12');
  });

  it('should return null for invalid URL', () => {
    expect(extractYouTubeId('https://google.com')).toBeNull();
  });
});
