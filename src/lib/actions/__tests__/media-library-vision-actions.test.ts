import { analyzeMediaVisionAction } from '../media-library-actions';
import { vi } from 'vitest';
import * as secureAuth from '../../../lib/secure-auth';
import * as brandMembership from '../../../lib/brand-membership';

// Mock the auth and brand access modules
vi.mock('../../../lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn(() =>
    Promise.resolve({ uid: 'test-user-123', email: 'test@example.com' })
  ),
}));

vi.mock('../../../lib/brand-membership', () => ({
  requireBrandAccess: vi.fn(() => Promise.resolve()),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('analyzeMediaVisionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set default environment
    process.env.MOMENTUM_PYTHON_SERVICE_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    delete process.env.MOMENTUM_PYTHON_SERVICE_URL;
    delete process.env.MOMENTUM_PYTHON_AGENT_URL;
  });

  describe('successful analysis', () => {
    it('should analyze all media for a brand', async () => {
      const mockResponse = {
        status: 'success',
        analyzed_count: 5,
        total_items: 8,
        errors: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123', {
        analyzeAll: true,
      });

      expect(result.success).toBe(true);
      expect(result.analyzed).toBe(5);
      expect(result.total).toBe(8);
      expect(result.errors).toBeUndefined();

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/media/analyze-vision',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: 'test-brand-123',
            analyze_all: true,
            media_ids: [],
          }),
        }
      );
    });

    it('should analyze specific media items', async () => {
      const mockResponse = {
        status: 'success',
        analyzed_count: 2,
        total_items: 2,
        errors: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123', {
        mediaIds: ['media1', 'media2'],
        analyzeAll: false,
      });

      expect(result.success).toBe(true);
      expect(result.analyzed).toBe(2);
      expect(result.total).toBe(2);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/media/analyze-vision',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: 'test-brand-123',
            analyze_all: false,
            media_ids: ['media1', 'media2'],
          }),
        }
      );
    });

    it('should handle analysis with errors', async () => {
      const mockResponse = {
        status: 'success',
        analyzed_count: 3,
        total_items: 5,
        errors: ['Failed to analyze media1: timeout', 'Failed to analyze media2: invalid format'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(true);
      expect(result.analyzed).toBe(3);
      expect(result.total).toBe(5);
      expect(result.errors).toEqual(['Failed to analyze media1: timeout', 'Failed to analyze media2: invalid format']);
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to analyze media: Internal server error');
    });

    it('should handle service error responses', async () => {
      const mockResponse = {
        status: 'error',
        message: 'Vision API quota exceeded',
        errors: ['API limit reached'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Vision API quota exceeded');
      expect(result.errors).toEqual(['API limit reached']);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to analyze media');
    });
  });

  describe('configuration and environment', () => {
    it('should use MOMENTUM_PYTHON_AGENT_URL as fallback', async () => {
      delete process.env.MOMENTUM_PYTHON_SERVICE_URL;
      process.env.MOMENTUM_PYTHON_AGENT_URL = 'http://alternative:9000';

      const mockResponse = { status: 'success', analyzed_count: 1, total_items: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await analyzeMediaVisionAction('test-brand-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://alternative:9000/media/analyze-vision',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should use default URL when no environment variables are set', async () => {
      delete process.env.MOMENTUM_PYTHON_SERVICE_URL;
      delete process.env.MOMENTUM_PYTHON_AGENT_URL;

      const mockResponse = { status: 'success', analyzed_count: 1, total_items: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await analyzeMediaVisionAction('test-brand-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/media/analyze-vision',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle default parameters correctly', async () => {
      const mockResponse = { status: 'success', analyzed_count: 0, total_items: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(true);
      expect(result.analyzed).toBe(0);
      expect(result.total).toBe(0);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/media/analyze-vision',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: 'test-brand-123',
            analyze_all: false,
            media_ids: [],
          }),
        }
      );
    });
  });

  describe('authentication and authorization', () => {
    it('should require brand access', async () => {
      const mockResponse = { status: 'success', analyzed_count: 1, total_items: 1 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await analyzeMediaVisionAction('test-brand-123');

      expect(secureAuth.getAuthenticatedUser).toHaveBeenCalled();
      expect(brandMembership.requireBrandAccess).toHaveBeenCalledWith('test-user-123', 'test-brand-123');
    });

    it('should propagate authentication errors', async () => {
      vi.mocked(secureAuth.getAuthenticatedUser).mockRejectedValueOnce(new Error('Not authenticated'));

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('should propagate authorization errors', async () => {
      vi.mocked(brandMembership.requireBrandAccess).mockRejectedValueOnce(new Error('Access denied'));

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });
  });

  describe('input validation and edge cases', () => {
    it('should handle empty media IDs array', async () => {
      const mockResponse = { status: 'success', analyzed_count: 0, total_items: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123', {
        mediaIds: [],
        analyzeAll: false,
      });

      expect(result.success).toBe(true);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            brand_id: 'test-brand-123',
            analyze_all: false,
            media_ids: [],
          }),
        })
      );
    });

    it('should handle undefined options', async () => {
      const mockResponse = { status: 'success', analyzed_count: 0, total_items: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await analyzeMediaVisionAction('test-brand-123', undefined);

      expect(result.success).toBe(true);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            brand_id: 'test-brand-123',
            analyze_all: false,
            media_ids: [],
          }),
        })
      );
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await analyzeMediaVisionAction('test-brand-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });
  });
});