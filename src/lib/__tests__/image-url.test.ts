import { describe, it, expect } from 'vitest';
import {
  isImageUrl,
  extractImageUrls,
  hasImageUrls,
  removeImageUrls,
  getImageFileName,
  getImageMimeType,
} from '../image-url';

describe('image-url utilities', () => {
  describe('isImageUrl', () => {
    it('should detect URLs with common image extensions', () => {
      expect(isImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(isImageUrl('https://example.com/image.jpeg')).toBe(true);
      expect(isImageUrl('https://example.com/image.png')).toBe(true);
      expect(isImageUrl('https://example.com/image.gif')).toBe(true);
      expect(isImageUrl('https://example.com/image.webp')).toBe(true);
      expect(isImageUrl('https://example.com/image.svg')).toBe(true);
      expect(isImageUrl('https://example.com/image.bmp')).toBe(true);
      expect(isImageUrl('https://example.com/image.avif')).toBe(true);
    });

    it('should detect Nike static image URLs', () => {
      expect(isImageUrl('https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/b032abc3-ec58-4857-a216-81b36a9f8fdd/NIKE+FLEX+CONTROL+TR4.png')).toBe(true);
      expect(isImageUrl('https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/12abc.jpg')).toBe(true);
    });

    it('should detect URLs with f_auto pattern (CDN auto-format)', () => {
      expect(isImageUrl('https://example.com/images/f_auto/product.jpg')).toBe(true);
      expect(isImageUrl('https://cdn.example.com/f_auto,q_80/image')).toBe(true);
    });

    it('should detect common image hosting services', () => {
      expect(isImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true);
      expect(isImageUrl('https://images.unsplash.com/photo-123')).toBe(true);
      expect(isImageUrl('https://i.imgur.com/abc123.png')).toBe(true);
    });

    it('should NOT detect non-image URLs', () => {
      expect(isImageUrl('https://example.com/page.html')).toBe(false);
      expect(isImageUrl('https://example.com/document.pdf')).toBe(false);
      expect(isImageUrl('https://example.com/video.mp4')).toBe(false);
      expect(isImageUrl('https://example.com/api/data')).toBe(false);
      expect(isImageUrl('https://youtube.com/watch?v=123')).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(isImageUrl('not a url')).toBe(false);
      expect(isImageUrl('')).toBe(false);
    });
  });

  describe('extractImageUrls', () => {
    it('should extract single image URL from text', () => {
      const text = 'Check out this image: https://example.com/photo.jpg';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.jpg']);
    });

    it('should extract multiple image URLs from text', () => {
      const text = 'Here are some images: https://example.com/one.jpg and https://example.com/two.png';
      expect(extractImageUrls(text)).toEqual([
        'https://example.com/one.jpg',
        'https://example.com/two.png',
      ]);
    });

    it('should extract Nike image URLs from text', () => {
      const text = 'Nike shoe: https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/b032abc3-ec58-4857-a216-81b36a9f8fdd/NIKE+FLEX+CONTROL+TR4.png - looks great!';
      const urls = extractImageUrls(text);
      expect(urls.length).toBe(1);
      expect(urls[0]).toContain('static.nike.com');
    });

    it('should NOT extract non-image URLs', () => {
      const text = 'Check https://example.com/page.html and https://youtube.com/watch?v=123';
      expect(extractImageUrls(text)).toEqual([]);
    });

    it('should return empty array for text without URLs', () => {
      expect(extractImageUrls('No URLs here')).toEqual([]);
      expect(extractImageUrls('')).toEqual([]);
    });

    it('should handle mixed content with image and non-image URLs', () => {
      const text = 'Page: https://example.com/page.html Image: https://example.com/photo.png';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.png']);
    });
  });

  describe('hasImageUrls', () => {
    it('should return true when text contains image URLs', () => {
      expect(hasImageUrls('Here is an image: https://example.com/photo.jpg')).toBe(true);
    });

    it('should return false when text has no image URLs', () => {
      expect(hasImageUrls('No images here')).toBe(false);
      expect(hasImageUrls('https://example.com/page.html')).toBe(false);
    });
  });

  describe('removeImageUrls', () => {
    it('should remove image URLs from text', () => {
      const text = 'Check this https://example.com/photo.jpg out';
      expect(removeImageUrls(text)).toBe('Check this out');
    });

    it('should replace with custom placeholder', () => {
      const text = 'Image: https://example.com/photo.jpg here';
      expect(removeImageUrls(text, '[image]')).toBe('Image: [image] here');
    });

    it('should handle multiple image URLs', () => {
      const text = 'https://example.com/one.jpg and https://example.com/two.png';
      expect(removeImageUrls(text)).toBe('and');
    });

    it('should preserve non-image URLs', () => {
      const text = 'Visit https://example.com/page.html and see https://example.com/photo.jpg';
      expect(removeImageUrls(text)).toBe('Visit https://example.com/page.html and see');
    });
  });

  describe('getImageFileName', () => {
    it('should extract filename from URL with extension', () => {
      expect(getImageFileName('https://example.com/photos/my-photo.jpg')).toBe('my-photo.jpg');
      expect(getImageFileName('https://example.com/image.png')).toBe('image.png');
    });

    it('should generate filename for URLs without extension', () => {
      const filename = getImageFileName('https://example.com/api/image/123');
      expect(filename).toMatch(/^image-\d+\.jpg$/);
    });

    it('should handle invalid URLs gracefully', () => {
      const filename = getImageFileName('not a url');
      expect(filename).toMatch(/^image-\d+\.jpg$/);
    });
  });

  describe('getImageMimeType', () => {
    it('should return correct MIME type for common extensions', () => {
      expect(getImageMimeType('https://example.com/image.png')).toBe('image/png');
      expect(getImageMimeType('https://example.com/image.gif')).toBe('image/gif');
      expect(getImageMimeType('https://example.com/image.webp')).toBe('image/webp');
      expect(getImageMimeType('https://example.com/image.svg')).toBe('image/svg+xml');
    });

    it('should default to image/jpeg for unknown extensions', () => {
      expect(getImageMimeType('https://example.com/image.jpg')).toBe('image/jpeg');
      expect(getImageMimeType('https://example.com/image')).toBe('image/jpeg');
    });

    it('should handle invalid URLs gracefully', () => {
      expect(getImageMimeType('not a url')).toBe('image/jpeg');
    });
  });
});
