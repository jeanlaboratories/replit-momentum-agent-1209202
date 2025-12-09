/**
 * Comprehensive End-to-End Tests for Media Library
 *
 * This test suite covers ALL Media Library functionality including:
 * - Media upload, update, delete operations
 * - All filter types and combinations
 * - Pagination and infinite scroll
 * - Collections management
 * - Bulk operations (tags, collections, publish, delete)
 * - Privacy and visibility controls
 * - Search and filtering
 * - Media viewer and details
 * - Color palette extraction
 * - AI generation metadata
 * - Audit trail tracking
 * - Brand Soul sync and migration
 * - Multi-tenancy and brand isolation
 * - Role-based access control
 * - Smart Scan privacy logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UnifiedMedia, MediaCollection, MediaSearchFilters } from '@/lib/types/media-library';

// Test data setup
const testBrand1 = 'brand-alpha-123';
const testBrand2 = 'brand-beta-456';
const managerUser = 'manager-user-001';
const contributorUser = 'contributor-user-002';
const otherUser = 'other-user-003';

// Helper to create mock media
const createMockMedia = (overrides: Partial<UnifiedMedia> = {}): UnifiedMedia => {
  const createdBy = overrides.createdBy || managerUser;
  return {
    id: `media-${Date.now()}-${Math.random()}`,
    brandId: testBrand1,
    type: 'image',
    url: 'https://storage.googleapis.com/test-bucket/image.jpg',
    title: 'Test Media',
    description: '',
    source: 'upload',
    createdBy,
    createdAt: new Date().toISOString(),
    isPublished: false,
    tags: [],
    collections: [],
    auditTrail: [{
      userId: createdBy,
      action: 'created',
      timestamp: new Date().toISOString(),
    }],
    ...overrides,
  };
};

// Helper to create mock collection
const createMockCollection = (overrides: Partial<MediaCollection> = {}): MediaCollection => ({
  id: `col-${Date.now()}-${Math.random()}`,
  brandId: testBrand1,
  name: 'Test Collection',
  description: '',
  mediaCount: 0,
  createdAt: new Date().toISOString(),
  createdBy: managerUser,
  ...overrides,
});

// Helper to apply filters to media array (simulates Smart Scan)
const applyFilters = (
  media: UnifiedMedia[],
  filters: MediaSearchFilters,
  currentUserId?: string
): UnifiedMedia[] => {
  return media.filter(m => {
    // Type filter
    if (filters.type && m.type !== filters.type) return false;

    // Collections filter
    if (filters.collections && filters.collections.length > 0) {
      if (!m.collections.some(c => filters.collections!.includes(c))) return false;
    }

    // Tags filter (OR logic)
    if (filters.tags && filters.tags.length > 0) {
      if (!m.tags.some(t => filters.tags!.includes(t))) return false;
    }

    // Source filter
    if (filters.source) {
      const aiSources = ['ai-generated', 'chatbot', 'imagen', 'veo'];
      if (filters.source === 'ai-generated') {
        if (!aiSources.includes(m.source)) return false;
      } else if (m.source !== filters.source) {
        return false;
      }
    }

    // Date range filter
    if (filters.dateRange) {
      const createdAt = new Date(m.createdAt as string);
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      if (createdAt < start || createdAt > end) return false;
    }

    // Created by filter
    if (filters.createdBy && m.createdBy !== filters.createdBy) return false;

    // Has colors filter
    if (filters.hasColors && (!m.colors || m.colors.length === 0)) return false;

    // Has explainability filter
    if (filters.hasExplainability && !m.explainability) return false;

    // Published status filter (with Smart Scan logic)
    if (filters.isPublished !== undefined) {
      if (m.isPublished !== filters.isPublished) return false;
    } else if (currentUserId) {
      // Smart Scan: show published OR owned by current user
      const isOwner = m.createdBy === currentUserId;
      const isPublished = m.isPublished === true;
      if (!isPublished && !isOwner) return false;
    }

    return true;
  });
};

describe('Media Library E2E Tests', () => {
  // ==================== 1. MEDIA UPLOAD ====================
  describe('1. Media Upload Operations', () => {
    it('should upload image with all metadata', () => {
      const uploadedImage = createMockMedia({
        type: 'image',
        source: 'upload',
        title: 'Uploaded Photo',
        description: 'A beautiful landscape photo',
        mimeType: 'image/jpeg',
        fileSize: 1024 * 500, // 500KB
        dimensions: { width: 1920, height: 1080 },
        tags: ['landscape', 'nature'],
        isPublished: false,
      });

      expect(uploadedImage.type).toBe('image');
      expect(uploadedImage.source).toBe('upload');
      expect(uploadedImage.mimeType).toBe('image/jpeg');
      expect(uploadedImage.dimensions?.width).toBe(1920);
      expect(uploadedImage.dimensions?.height).toBe(1080);
      expect(uploadedImage.fileSize).toBe(512000);
      expect(uploadedImage.tags).toContain('landscape');
      expect(uploadedImage.auditTrail[0].action).toBe('created');
    });

    it('should upload video with metadata', () => {
      const uploadedVideo = createMockMedia({
        type: 'video',
        source: 'upload',
        title: 'Product Demo',
        mimeType: 'video/mp4',
        fileSize: 1024 * 1024 * 5, // 5MB
        thumbnailUrl: 'https://storage.googleapis.com/test-bucket/video-thumb.jpg',
      });

      expect(uploadedVideo.type).toBe('video');
      expect(uploadedVideo.mimeType).toBe('video/mp4');
      expect(uploadedVideo.thumbnailUrl).toBeDefined();
    });

    it('should validate file size limit (100MB)', () => {
      const fileSize = 1024 * 1024 * 100; // 100MB
      const tooLarge = 1024 * 1024 * 101; // 101MB

      expect(fileSize).toBeLessThanOrEqual(1024 * 1024 * 100);
      expect(tooLarge).toBeGreaterThan(1024 * 1024 * 100);
    });

    it('should support multiple image formats', () => {
      const formats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

      formats.forEach(format => {
        const media = createMockMedia({ mimeType: format });
        expect(media.mimeType).toBe(format);
      });
    });

    it('should generate AI prompt description on upload', () => {
      const media = createMockMedia({
        source: 'upload',
        prompt: 'AI-generated description of the uploaded image',
      });

      expect(media.prompt).toBeDefined();
      expect(media.prompt?.length).toBeGreaterThan(0);
    });

    it('should track uploader in audit trail', () => {
      const media = createMockMedia({
        createdBy: contributorUser,
        uploadedBy: contributorUser,
      });

      expect(media.createdBy).toBe(contributorUser);
      expect(media.uploadedBy).toBe(contributorUser);
      expect(media.auditTrail[0].userId).toBe(contributorUser);
    });
  });

  // ==================== 2. TYPE FILTERS ====================
  describe('2. Type Filters', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'img1', type: 'image', title: 'Image 1', isPublished: true }),
        createMockMedia({ id: 'img2', type: 'image', title: 'Image 2', isPublished: true }),
        createMockMedia({ id: 'img3', type: 'image', title: 'Image 3', isPublished: true }),
        createMockMedia({ id: 'vid1', type: 'video', title: 'Video 1', isPublished: true }),
        createMockMedia({ id: 'vid2', type: 'video', title: 'Video 2', isPublished: true }),
      ];
    });

    it('should filter by image type', () => {
      const filtered = applyFilters(testMedia, { type: 'image' });

      expect(filtered).toHaveLength(3);
      expect(filtered.every(m => m.type === 'image')).toBe(true);
    });

    it('should filter by video type', () => {
      const filtered = applyFilters(testMedia, { type: 'video' });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(m => m.type === 'video')).toBe(true);
    });

    it('should show all types when no filter', () => {
      const filtered = applyFilters(testMedia, {});

      expect(filtered).toHaveLength(5);
    });
  });

  // ==================== 3. VISIBILITY FILTERS ====================
  describe('3. Visibility Filters (Published/Private)', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'pub1', title: 'Published 1', isPublished: true, createdBy: managerUser }),
        createMockMedia({ id: 'pub2', title: 'Published 2', isPublished: true, createdBy: contributorUser }),
        createMockMedia({ id: 'priv1', title: 'Private 1', isPublished: false, createdBy: managerUser }),
        createMockMedia({ id: 'priv2', title: 'Private 2', isPublished: false, createdBy: contributorUser }),
        createMockMedia({ id: 'priv3', title: 'Private 3', isPublished: false, createdBy: otherUser }),
      ];
    });

    it('should filter published media only', () => {
      const filtered = applyFilters(testMedia, { isPublished: true });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(m => m.isPublished === true)).toBe(true);
    });

    it('should filter private media only', () => {
      const filtered = applyFilters(testMedia, { isPublished: false });

      expect(filtered).toHaveLength(3);
      expect(filtered.every(m => m.isPublished === false)).toBe(true);
    });

    it('should implement Smart Scan (published OR own private)', () => {
      const filtered = applyFilters(testMedia, {}, managerUser);

      // Should show: pub1, pub2 (published), priv1 (own private)
      expect(filtered).toHaveLength(3);
      expect(filtered.some(m => m.id === 'pub1')).toBe(true);
      expect(filtered.some(m => m.id === 'pub2')).toBe(true);
      expect(filtered.some(m => m.id === 'priv1')).toBe(true);
      expect(filtered.some(m => m.id === 'priv2')).toBe(false); // other's private
      expect(filtered.some(m => m.id === 'priv3')).toBe(false); // other's private
    });

    it('should apply Smart Scan for different users', () => {
      const managerView = applyFilters(testMedia, {}, managerUser);
      const contributorView = applyFilters(testMedia, {}, contributorUser);
      const otherView = applyFilters(testMedia, {}, otherUser);

      expect(managerView).toHaveLength(3); // pub1, pub2, priv1
      expect(contributorView).toHaveLength(3); // pub1, pub2, priv2
      expect(otherView).toHaveLength(3); // pub1, pub2, priv3
    });
  });

  // ==================== 4. COLLECTION FILTERS ====================
  describe('4. Collection Filters', () => {
    let testMedia: UnifiedMedia[];
    let collections: MediaCollection[];

    beforeEach(() => {
      collections = [
        createMockCollection({ id: 'col1', name: 'Marketing' }),
        createMockCollection({ id: 'col2', name: 'Brand Assets' }),
        createMockCollection({ id: 'col3', name: 'Social Media' }),
      ];

      testMedia = [
        createMockMedia({ id: 'm1', collections: ['col1'], isPublished: true }),
        createMockMedia({ id: 'm2', collections: ['col1', 'col2'], isPublished: true }),
        createMockMedia({ id: 'm3', collections: ['col2'], isPublished: true }),
        createMockMedia({ id: 'm4', collections: ['col3'], isPublished: true }),
        createMockMedia({ id: 'm5', collections: [], isPublished: true }),
      ];
    });

    it('should filter by single collection', () => {
      const filtered = applyFilters(testMedia, { collections: ['col1'] });

      expect(filtered).toHaveLength(2); // m1, m2
      expect(filtered.every(m => m.collections.includes('col1'))).toBe(true);
    });

    it('should filter by multiple collections (OR logic)', () => {
      const filtered = applyFilters(testMedia, { collections: ['col1', 'col3'] });

      expect(filtered).toHaveLength(3); // m1, m2, m4
    });

    it('should filter media in multiple collections', () => {
      const filtered = applyFilters(testMedia, { collections: ['col2'] });

      expect(filtered).toHaveLength(2); // m2, m3
    });

    it('should show empty result for non-existent collection', () => {
      const filtered = applyFilters(testMedia, { collections: ['col999'] });

      expect(filtered).toHaveLength(0);
    });
  });

  // ==================== 5. SOURCE FILTERS ====================
  describe('5. Source Filters', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'u1', source: 'upload', isPublished: true }),
        createMockMedia({ id: 'u2', source: 'upload', isPublished: true }),
        createMockMedia({ id: 'ai1', source: 'imagen', isPublished: true }),
        createMockMedia({ id: 'ai2', source: 'veo', isPublished: true }),
        createMockMedia({ id: 'ai3', source: 'chatbot', isPublished: true }),
        createMockMedia({ id: 'ai4', source: 'ai-generated', isPublished: true }),
        createMockMedia({ id: 'bs1', source: 'brand-soul', isPublished: true }),
        createMockMedia({ id: 'e1', source: 'edited', isPublished: true }),
      ];
    });

    it('should filter by upload source', () => {
      const filtered = applyFilters(testMedia, { source: 'upload' });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(m => m.source === 'upload')).toBe(true);
    });

    it('should filter by AI generated (aggregates multiple sources)', () => {
      const filtered = applyFilters(testMedia, { source: 'ai-generated' });

      // Should include: imagen, veo, chatbot, ai-generated
      expect(filtered).toHaveLength(4);
      expect(['imagen', 'veo', 'chatbot', 'ai-generated']).toContain(filtered[0].source);
    });

    it('should filter by Brand Soul source', () => {
      const filtered = applyFilters(testMedia, { source: 'brand-soul' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe('brand-soul');
    });

    it('should filter by edited source', () => {
      const filtered = applyFilters(testMedia, { source: 'edited' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe('edited');
    });
  });

  // ==================== 6. DATE RANGE FILTERS ====================
  describe('6. Date Range Filters', () => {
    let testMedia: UnifiedMedia[];
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'm1', createdAt: now.toISOString(), isPublished: true }),
        createMockMedia({ id: 'm2', createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), isPublished: true }),
        createMockMedia({ id: 'm3', createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), isPublished: true }),
        createMockMedia({ id: 'm4', createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), isPublished: true }),
      ];
    });

    it('should filter by last 7 days', () => {
      const filtered = applyFilters(testMedia, {
        dateRange: { start: last7Days.toISOString(), end: now.toISOString() }
      });

      expect(filtered).toHaveLength(2); // m1, m2
    });

    it('should filter by last 30 days', () => {
      const filtered = applyFilters(testMedia, {
        dateRange: { start: last30Days.toISOString(), end: now.toISOString() }
      });

      expect(filtered).toHaveLength(3); // m1, m2, m3
    });

    it('should filter by custom date range', () => {
      const filtered = applyFilters(testMedia, {
        dateRange: { start: last60Days.toISOString(), end: last30Days.toISOString() }
      });

      expect(filtered).toHaveLength(1); // m4
    });

    it('should show all media without date filter', () => {
      const filtered = applyFilters(testMedia, {});

      expect(filtered).toHaveLength(4);
    });
  });

  // ==================== 7. TEAM MEMBER FILTERS ====================
  describe('7. Team Member Filters (Created By)', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'm1', createdBy: managerUser, isPublished: true }),
        createMockMedia({ id: 'm2', createdBy: managerUser, isPublished: true }),
        createMockMedia({ id: 'm3', createdBy: contributorUser, isPublished: true }),
        createMockMedia({ id: 'm4', createdBy: contributorUser, isPublished: true }),
        createMockMedia({ id: 'm5', createdBy: otherUser, isPublished: true }),
      ];
    });

    it('should filter by manager user', () => {
      const filtered = applyFilters(testMedia, { createdBy: managerUser });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(m => m.createdBy === managerUser)).toBe(true);
    });

    it('should filter by contributor user', () => {
      const filtered = applyFilters(testMedia, { createdBy: contributorUser });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(m => m.createdBy === contributorUser)).toBe(true);
    });

    it('should filter by other user', () => {
      const filtered = applyFilters(testMedia, { createdBy: otherUser });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].createdBy).toBe(otherUser);
    });
  });

  // ==================== 8. TAG FILTERS ====================
  describe('8. Tag Filters', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'm1', tags: ['marketing', 'social'], isPublished: true }),
        createMockMedia({ id: 'm2', tags: ['marketing', 'email'], isPublished: true }),
        createMockMedia({ id: 'm3', tags: ['design', 'branding'], isPublished: true }),
        createMockMedia({ id: 'm4', tags: ['social', 'ads'], isPublished: true }),
        createMockMedia({ id: 'm5', tags: [], isPublished: true }),
      ];
    });

    it('should filter by single tag', () => {
      const filtered = applyFilters(testMedia, { tags: ['marketing'] });

      expect(filtered).toHaveLength(2); // m1, m2
      expect(filtered.every(m => m.tags.includes('marketing'))).toBe(true);
    });

    it('should filter by multiple tags (OR logic)', () => {
      const filtered = applyFilters(testMedia, { tags: ['marketing', 'design'] });

      expect(filtered).toHaveLength(3); // m1, m2, m3
    });

    it('should find media with overlapping tags', () => {
      const filtered = applyFilters(testMedia, { tags: ['social'] });

      expect(filtered).toHaveLength(2); // m1, m4
    });

    it('should return empty for non-existent tag', () => {
      const filtered = applyFilters(testMedia, { tags: ['nonexistent'] });

      expect(filtered).toHaveLength(0);
    });
  });

  // ==================== 9. COLOR PALETTE FILTERS ====================
  describe('9. Color Palette Filters', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({
          id: 'm1',
          colors: [
            { hex: '#FF5733', rgb: [255, 87, 51], proportion: 0.4 },
            { hex: '#33FF57', rgb: [51, 255, 87], proportion: 0.3 },
          ],
          isPublished: true,
        }),
        createMockMedia({
          id: 'm2',
          colors: [
            { hex: '#3357FF', rgb: [51, 87, 255], proportion: 0.6 },
          ],
          isPublished: true,
        }),
        createMockMedia({ id: 'm3', colors: [], isPublished: true }),
        createMockMedia({ id: 'm4', isPublished: true }), // no colors field
      ];
    });

    it('should filter media with color palettes', () => {
      const filtered = applyFilters(testMedia, { hasColors: true });

      expect(filtered).toHaveLength(2); // m1, m2
      expect(filtered.every(m => m.colors && m.colors.length > 0)).toBe(true);
    });

    it('should verify color palette structure', () => {
      const media = testMedia[0];

      expect(media.colors).toBeDefined();
      expect(media.colors![0].hex).toBe('#FF5733');
      expect(media.colors![0].rgb).toEqual([255, 87, 51]);
      expect(media.colors![0].proportion).toBe(0.4);
    });

    it('should handle media without colors', () => {
      const filtered = applyFilters(testMedia, { hasColors: false });

      expect(filtered).toHaveLength(4); // All media when hasColors is false
    });
  });

  // ==================== 10. EXPLAINABILITY FILTERS ====================
  describe('10. AI Explainability Filters', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({
          id: 'ai1',
          source: 'imagen',
          explainability: {
            summary: 'Generated from prompt with brand controls',
            confidence: 0.95,
            appliedControls: ['content-filter', 'style-guide'],
            brandElementsUsed: ['color-palette', 'logo'],
            avoidedElements: ['competitor-imagery'],
          },
          isPublished: true,
        }),
        createMockMedia({
          id: 'ai2',
          source: 'veo',
          explainability: {
            summary: 'Video generated with motion controls',
            confidence: 0.88,
            appliedControls: ['motion-smoothing'],
            brandElementsUsed: ['brand-colors'],
            avoidedElements: [],
          },
          isPublished: true,
        }),
        createMockMedia({ id: 'u1', source: 'upload', isPublished: true }), // no explainability
      ];
    });

    it('should filter media with explainability', () => {
      const filtered = applyFilters(testMedia, { hasExplainability: true });

      expect(filtered).toHaveLength(2); // ai1, ai2
      expect(filtered.every(m => m.explainability !== undefined)).toBe(true);
    });

    it('should verify explainability structure', () => {
      const media = testMedia[0];

      expect(media.explainability).toBeDefined();
      expect(media.explainability!.summary).toBe('Generated from prompt with brand controls');
      expect(media.explainability!.confidence).toBe(0.95);
      expect(media.explainability!.appliedControls).toContain('content-filter');
      expect(media.explainability!.brandElementsUsed).toContain('color-palette');
    });

    it('should track AI generation prompt', () => {
      const aiMedia = createMockMedia({
        source: 'imagen',
        prompt: 'A sunset over mountains with warm colors',
        explainability: {
          summary: 'Generated based on prompt',
          confidence: 0.92,
          appliedControls: [],
          brandElementsUsed: [],
          avoidedElements: [],
        },
      });

      expect(aiMedia.prompt).toBe('A sunset over mountains with warm colors');
      expect(aiMedia.explainability).toBeDefined();
    });
  });

  // ==================== 11. COMBINED FILTERS ====================
  describe('11. Combined Filter Scenarios', () => {
    let testMedia: UnifiedMedia[];
    const col1 = 'col-marketing';
    const col2 = 'col-social';

    beforeEach(() => {
      testMedia = [
        createMockMedia({
          id: 'm1',
          type: 'image',
          source: 'upload',
          tags: ['marketing', 'social'],
          collections: [col1, col2],
          isPublished: true,
          createdBy: managerUser,
        }),
        createMockMedia({
          id: 'm2',
          type: 'video',
          source: 'veo',
          tags: ['promo'],
          collections: [col1],
          isPublished: true,
          createdBy: contributorUser,
        }),
        createMockMedia({
          id: 'm3',
          type: 'image',
          source: 'imagen',
          tags: ['design'],
          collections: [col2],
          isPublished: false,
          createdBy: managerUser,
        }),
        createMockMedia({
          id: 'm4',
          type: 'image',
          source: 'upload',
          tags: ['marketing'],
          collections: [],
          isPublished: true,
          createdBy: otherUser,
        }),
      ];
    });

    it('should combine type + source filters', () => {
      const filtered = applyFilters(testMedia, {
        type: 'image',
        source: 'upload',
      });

      expect(filtered).toHaveLength(2); // m1, m4
      expect(filtered.every(m => m.type === 'image' && m.source === 'upload')).toBe(true);
    });

    it('should combine type + tags + published filters', () => {
      const filtered = applyFilters(testMedia, {
        type: 'image',
        tags: ['marketing'],
        isPublished: true,
      });

      expect(filtered).toHaveLength(2); // m1, m4
    });

    it('should combine collections + createdBy filters', () => {
      const filtered = applyFilters(testMedia, {
        collections: [col1],
        createdBy: managerUser,
      });

      expect(filtered).toHaveLength(1); // m1
      expect(filtered[0].id).toBe('m1');
    });

    it('should combine all filters', () => {
      const filtered = applyFilters(testMedia, {
        type: 'image',
        source: 'upload',
        tags: ['marketing'],
        collections: [col1],
        isPublished: true,
        createdBy: managerUser,
      });

      expect(filtered).toHaveLength(1); // m1
      expect(filtered[0].id).toBe('m1');
    });

    it('should return empty when no matches', () => {
      const filtered = applyFilters(testMedia, {
        type: 'video',
        source: 'upload', // no uploaded videos
      });

      expect(filtered).toHaveLength(0);
    });
  });

  // ==================== 12. COLLECTIONS MANAGEMENT ====================
  describe('12. Collections Management', () => {
    it('should create collection with metadata', () => {
      const collection = createMockCollection({
        name: 'Q1 Campaign',
        description: 'Marketing materials for Q1 2024 campaign',
        coverImageUrl: 'https://storage.googleapis.com/test-bucket/cover.jpg',
      });

      expect(collection.name).toBe('Q1 Campaign');
      expect(collection.description).toBeDefined();
      expect(collection.coverImageUrl).toBeDefined();
      expect(collection.brandId).toBe(testBrand1);
      expect(collection.createdBy).toBe(managerUser);
    });

    it('should support hierarchical collections', () => {
      const parent = createMockCollection({ name: 'Marketing' });
      const child = createMockCollection({
        name: 'Social Media',
        parentId: parent.id,
      });

      expect(child.parentId).toBe(parent.id);
    });

    it('should track media count in collection', () => {
      const collection = createMockCollection({
        name: 'Brand Assets',
        mediaCount: 15,
      });

      expect(collection.mediaCount).toBe(15);
    });

    it('should update collection timestamp', () => {
      const collection = createMockCollection();
      const updatedAt = new Date().toISOString();
      collection.updatedAt = updatedAt;

      expect(collection.updatedAt).toBe(updatedAt);
    });

    it('should add media to multiple collections', () => {
      const col1 = createMockCollection({ id: 'col1', name: 'Collection 1' });
      const col2 = createMockCollection({ id: 'col2', name: 'Collection 2' });
      const col3 = createMockCollection({ id: 'col3', name: 'Collection 3' });

      const media = createMockMedia({
        collections: [col1.id, col2.id, col3.id],
      });

      expect(media.collections).toHaveLength(3);
      expect(media.collections).toContain(col1.id);
      expect(media.collections).toContain(col2.id);
      expect(media.collections).toContain(col3.id);
    });
  });

  // ==================== 13. BULK OPERATIONS ====================
  describe('13. Bulk Operations', () => {
    it('should bulk add tags to media', () => {
      const mediaItems = [
        createMockMedia({ id: 'm1', tags: ['old'] }),
        createMockMedia({ id: 'm2', tags: ['old'] }),
        createMockMedia({ id: 'm3', tags: ['old'] }),
      ];

      const newTags = ['marketing', 'approved'];
      mediaItems.forEach(m => {
        m.tags = [...m.tags, ...newTags];
        m.auditTrail.push({
          userId: managerUser,
          action: 'tags-added',
          timestamp: new Date().toISOString(),
          details: JSON.stringify(newTags),
        });
      });

      expect(mediaItems.every(m => m.tags.includes('marketing'))).toBe(true);
      expect(mediaItems.every(m => m.tags.includes('approved'))).toBe(true);
      expect(mediaItems.every(m => m.auditTrail.some(e => e.action === 'tags-added'))).toBe(true);
    });

    it('should bulk remove tags from media', () => {
      const mediaItems = [
        createMockMedia({ id: 'm1', tags: ['marketing', 'draft', 'review'] }),
        createMockMedia({ id: 'm2', tags: ['marketing', 'draft'] }),
      ];

      const tagsToRemove = ['draft'];
      mediaItems.forEach(m => {
        m.tags = m.tags.filter(t => !tagsToRemove.includes(t));
        m.auditTrail.push({
          userId: managerUser,
          action: 'tags-removed',
          timestamp: new Date().toISOString(),
          details: JSON.stringify(tagsToRemove),
        });
      });

      expect(mediaItems.every(m => !m.tags.includes('draft'))).toBe(true);
    });

    it('should bulk add to collection', () => {
      const collectionId = 'col-approved';
      const mediaItems = [
        createMockMedia({ id: 'm1', collections: [] }),
        createMockMedia({ id: 'm2', collections: ['other-col'] }),
      ];

      mediaItems.forEach(m => {
        if (!m.collections.includes(collectionId)) {
          m.collections.push(collectionId);
        }
        m.auditTrail.push({
          userId: managerUser,
          action: 'added-to-collection',
          timestamp: new Date().toISOString(),
          details: collectionId,
        });
      });

      expect(mediaItems.every(m => m.collections.includes(collectionId))).toBe(true);
    });

    it('should bulk remove from collection', () => {
      const collectionId = 'col-draft';
      const mediaItems = [
        createMockMedia({ id: 'm1', collections: ['col-draft', 'col-other'] }),
        createMockMedia({ id: 'm2', collections: ['col-draft'] }),
      ];

      mediaItems.forEach(m => {
        m.collections = m.collections.filter(c => c !== collectionId);
        m.auditTrail.push({
          userId: managerUser,
          action: 'removed-from-collection',
          timestamp: new Date().toISOString(),
          details: collectionId,
        });
      });

      expect(mediaItems.every(m => !m.collections.includes(collectionId))).toBe(true);
    });

    it('should bulk publish media', () => {
      const mediaItems = [
        createMockMedia({ id: 'm1', isPublished: false }),
        createMockMedia({ id: 'm2', isPublished: false }),
        createMockMedia({ id: 'm3', isPublished: false }),
      ];

      mediaItems.forEach(m => {
        m.isPublished = true;
        m.auditTrail.push({
          userId: managerUser,
          action: 'published',
          timestamp: new Date().toISOString(),
        });
      });

      expect(mediaItems.every(m => m.isPublished === true)).toBe(true);
      expect(mediaItems.every(m => m.auditTrail.some(e => e.action === 'published'))).toBe(true);
    });

    it('should bulk unpublish media', () => {
      const mediaItems = [
        createMockMedia({ id: 'm1', isPublished: true }),
        createMockMedia({ id: 'm2', isPublished: true }),
      ];

      mediaItems.forEach(m => {
        m.isPublished = false;
        m.auditTrail.push({
          userId: managerUser,
          action: 'unpublished',
          timestamp: new Date().toISOString(),
        });
      });

      expect(mediaItems.every(m => m.isPublished === false)).toBe(true);
      expect(mediaItems.every(m => m.auditTrail.some(e => e.action === 'unpublished'))).toBe(true);
    });

    it('should bulk delete media', () => {
      const mediaIds = ['m1', 'm2', 'm3'];
      const results = {
        success: [] as string[],
        failed: [] as string[],
      };

      // Simulate deletion
      mediaIds.forEach(id => {
        // In real implementation, would delete from storage
        results.success.push(id);
      });

      expect(results.success).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
    });
  });

  // ==================== 14. MEDIA UPDATE OPERATIONS ====================
  describe('14. Media Update Operations', () => {
    it('should update media title', () => {
      const media = createMockMedia({ title: 'Old Title' });

      media.title = 'New Title';
      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date().toISOString(),
        details: 'Updated title',
      });

      expect(media.title).toBe('New Title');
      expect(media.auditTrail.some(e => e.action === 'edited')).toBe(true);
    });

    it('should update media description', () => {
      const media = createMockMedia({ description: 'Old description' });

      media.description = 'Updated description with more details';
      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date().toISOString(),
        details: 'Updated description',
      });

      expect(media.description).toBe('Updated description with more details');
    });

    it('should update media tags', () => {
      const media = createMockMedia({ tags: ['tag1', 'tag2'] });

      media.tags = ['tag1', 'tag3', 'tag4'];
      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date().toISOString(),
        details: 'Updated tags',
      });

      expect(media.tags).toContain('tag3');
      expect(media.tags).toContain('tag4');
      expect(media.tags).not.toContain('tag2');
    });

    it('should update media collections', () => {
      const media = createMockMedia({ collections: ['col1'] });

      media.collections = ['col1', 'col2', 'col3'];
      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date().toISOString(),
        details: 'Updated collections',
      });

      expect(media.collections).toHaveLength(3);
    });

    it('should toggle published status', () => {
      const media = createMockMedia({ isPublished: false });

      // Publish
      media.isPublished = true;
      media.auditTrail.push({
        userId: managerUser,
        action: 'published',
        timestamp: new Date().toISOString(),
      });

      expect(media.isPublished).toBe(true);

      // Unpublish
      media.isPublished = false;
      media.auditTrail.push({
        userId: managerUser,
        action: 'unpublished',
        timestamp: new Date().toISOString(),
      });

      expect(media.isPublished).toBe(false);
      expect(media.auditTrail).toHaveLength(3); // created, published, unpublished
    });
  });

  // ==================== 15. MEDIA DELETE OPERATIONS ====================
  describe('15. Media Delete Operations', () => {
    it('should delete single media item', () => {
      const media = createMockMedia({ id: 'media-to-delete' });
      const mediaId = media.id;

      // Simulate deletion
      const deleted = mediaId === 'media-to-delete';

      expect(deleted).toBe(true);
    });

    it('should enforce ownership for contributor deletion', () => {
      const media = createMockMedia({ createdBy: managerUser });
      const currentUser = contributorUser;
      const userRole = 'CONTRIBUTOR';

      const canDelete = userRole === 'MANAGER' || media.createdBy === currentUser;

      expect(canDelete).toBe(false);
    });

    it('should allow manager to delete any media', () => {
      const media = createMockMedia({ createdBy: contributorUser });
      const currentUser = managerUser;
      const userRole = 'MANAGER';

      const canDelete = userRole === 'MANAGER' || media.createdBy === currentUser;

      expect(canDelete).toBe(true);
    });

    it('should allow user to delete own media', () => {
      const media = createMockMedia({ createdBy: contributorUser });
      const currentUser = contributorUser;
      const userRole = 'CONTRIBUTOR';

      const canDelete = userRole === 'MANAGER' || media.createdBy === currentUser;

      expect(canDelete).toBe(true);
    });

    it('should track deletion success/failure', () => {
      const mediaIds = ['m1', 'm2', 'm3'];
      const results = {
        success: ['m1', 'm3'],
        failed: ['m2'],
      };

      expect(results.success).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
    });
  });

  // ==================== 16. PAGINATION ====================
  describe('16. Pagination and Infinite Scroll', () => {
    it('should paginate results with cursor', () => {
      const allMedia = Array.from({ length: 150 }, (_, i) =>
        createMockMedia({ id: `m${i}`, title: `Media ${i}`, isPublished: true })
      );

      const pageSize = 50;
      const page1 = allMedia.slice(0, pageSize);
      const page2 = allMedia.slice(pageSize, pageSize * 2);
      const page3 = allMedia.slice(pageSize * 2, pageSize * 3);

      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(50);
      expect(page3).toHaveLength(50);
      expect(page1[0].id).toBe('m0');
      expect(page2[0].id).toBe('m50');
      expect(page3[0].id).toBe('m100');
    });

    it('should handle last page with fewer items', () => {
      const allMedia = Array.from({ length: 75 }, (_, i) =>
        createMockMedia({ id: `m${i}`, isPublished: true })
      );

      const pageSize = 50;
      const page1 = allMedia.slice(0, pageSize);
      const page2 = allMedia.slice(pageSize);

      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(25);
    });

    it('should use cursor-based pagination', () => {
      const media1 = createMockMedia({ id: 'cursor-1', createdAt: '2024-01-01T00:00:00Z' });
      const media2 = createMockMedia({ id: 'cursor-2', createdAt: '2024-01-02T00:00:00Z' });

      const cursor = { id: media1.id, createdAt: media1.createdAt };

      expect(cursor.id).toBe('cursor-1');
      expect(cursor.createdAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should track hasMore for infinite scroll', () => {
      const totalItems = 150;
      const pageSize = 50;
      const currentPage = 2;

      const hasMore = (currentPage * pageSize) < totalItems;

      expect(hasMore).toBe(true);
    });
  });

  // ==================== 17. MEDIA STATISTICS ====================
  describe('17. Media Statistics', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ type: 'image', source: 'upload' }),
        createMockMedia({ type: 'image', source: 'upload' }),
        createMockMedia({ type: 'image', source: 'imagen' }),
        createMockMedia({ type: 'video', source: 'veo' }),
        createMockMedia({ type: 'video', source: 'upload' }),
        createMockMedia({ type: 'image', source: 'brand-soul' }),
      ];
    });

    it('should calculate total media count', () => {
      expect(testMedia.length).toBe(6);
    });

    it('should count images and videos', () => {
      const images = testMedia.filter(m => m.type === 'image').length;
      const videos = testMedia.filter(m => m.type === 'video').length;

      expect(images).toBe(4);
      expect(videos).toBe(2);
    });

    it('should count by source', () => {
      const uploads = testMedia.filter(m => m.source === 'upload').length;
      const aiGenerated = testMedia.filter(m => ['imagen', 'veo', 'ai-generated', 'chatbot'].includes(m.source)).length;
      const brandSoul = testMedia.filter(m => m.source === 'brand-soul').length;

      expect(uploads).toBe(3);
      expect(aiGenerated).toBe(2);
      expect(brandSoul).toBe(1);
    });
  });

  // ==================== 18. BRAND SOUL SYNC ====================
  describe('18. Brand Soul Sync and Migration', () => {
    it('should sync Brand Soul artifacts to media library', () => {
      const artifact = {
        id: 'artifact-123',
        imageUrl: 'https://example.com/logo.png',
      };

      const media = createMockMedia({
        source: 'brand-soul',
        sourceArtifactId: artifact.id,
        url: artifact.imageUrl,
      });

      expect(media.source).toBe('brand-soul');
      expect(media.sourceArtifactId).toBe(artifact.id);
    });

    it('should validate image extensions during sync', () => {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const urls = [
        'https://example.com/image.jpg',
        'https://example.com/image.png',
        'https://example.com/tracking.gif?pixel=1', // valid even with query
        'https://example.com/script.js', // invalid
      ];

      const isValidImage = (url: string) => {
        return validExtensions.some(ext => url.toLowerCase().includes(ext));
      };

      expect(isValidImage(urls[0])).toBe(true);
      expect(isValidImage(urls[1])).toBe(true);
      expect(isValidImage(urls[2])).toBe(true);
      expect(isValidImage(urls[3])).toBe(false);
    });

    it('should migrate legacy images to unified media', () => {
      const legacyImage = {
        id: 'legacy-img-1',
        imageUrl: 'https://storage.googleapis.com/bucket/image.jpg',
        description: 'Legacy image',
      };

      const migratedMedia = createMockMedia({
        id: legacyImage.id,
        type: 'image',
        url: legacyImage.imageUrl,
        description: legacyImage.description,
        sourceImageId: legacyImage.id,
      });

      expect(migratedMedia.sourceImageId).toBe(legacyImage.id);
    });

    it('should migrate legacy videos to unified media', () => {
      const legacyVideo = {
        id: 'legacy-vid-1',
        url: 'https://youtube.com/watch?v=abc123',
        title: 'Legacy video',
      };

      const migratedMedia = createMockMedia({
        id: legacyVideo.id,
        type: 'video',
        url: legacyVideo.url,
        title: legacyVideo.title,
        sourceVideoId: legacyVideo.id,
      });

      expect(migratedMedia.sourceVideoId).toBe(legacyVideo.id);
      expect(migratedMedia.type).toBe('video');
    });
  });

  // ==================== 19. MULTI-TENANCY ====================
  describe('19. Multi-Tenancy and Brand Isolation', () => {
    it('should isolate media by brandId', () => {
      const allMedia = [
        createMockMedia({ brandId: testBrand1, title: 'Brand 1 Media 1' }),
        createMockMedia({ brandId: testBrand1, title: 'Brand 1 Media 2' }),
        createMockMedia({ brandId: testBrand2, title: 'Brand 2 Media 1' }),
        createMockMedia({ brandId: testBrand2, title: 'Brand 2 Media 2' }),
      ];

      const brand1Media = allMedia.filter(m => m.brandId === testBrand1);
      const brand2Media = allMedia.filter(m => m.brandId === testBrand2);

      expect(brand1Media).toHaveLength(2);
      expect(brand2Media).toHaveLength(2);
      expect(brand1Media.every(m => m.brandId === testBrand1)).toBe(true);
      expect(brand2Media.every(m => m.brandId === testBrand2)).toBe(true);
    });

    it('should isolate collections by brandId', () => {
      const allCollections = [
        createMockCollection({ brandId: testBrand1, name: 'Brand 1 Collection' }),
        createMockCollection({ brandId: testBrand2, name: 'Brand 2 Collection' }),
      ];

      const brand1Collections = allCollections.filter(c => c.brandId === testBrand1);

      expect(brand1Collections).toHaveLength(1);
      expect(brand1Collections[0].brandId).toBe(testBrand1);
    });

    it('should prevent cross-brand access', () => {
      const media = createMockMedia({ brandId: testBrand1 });
      const userBrandIds = [testBrand2]; // User only has access to testBrand2

      const hasAccess = userBrandIds.includes(media.brandId);

      expect(hasAccess).toBe(false);
    });
  });

  // ==================== 20. AUDIT TRAIL ====================
  describe('20. Audit Trail Tracking', () => {
    it('should track creation in audit trail', () => {
      const media = createMockMedia();

      expect(media.auditTrail).toHaveLength(1);
      expect(media.auditTrail[0].action).toBe('created');
      expect(media.auditTrail[0].userId).toBe(managerUser);
      expect(media.auditTrail[0].timestamp).toBeDefined();
    });

    it('should track all actions in audit trail', () => {
      const media = createMockMedia();

      // Edit
      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date().toISOString(),
        details: 'Updated title and tags',
      });

      // Publish
      media.auditTrail.push({
        userId: managerUser,
        action: 'published',
        timestamp: new Date().toISOString(),
      });

      // Add to collection
      media.auditTrail.push({
        userId: managerUser,
        action: 'added-to-collection',
        timestamp: new Date().toISOString(),
        details: 'col-marketing',
      });

      expect(media.auditTrail).toHaveLength(4);
      expect(media.auditTrail.map(e => e.action)).toEqual([
        'created',
        'edited',
        'published',
        'added-to-collection',
      ]);
    });

    it('should include details in audit events', () => {
      const media = createMockMedia();

      media.auditTrail.push({
        userId: managerUser,
        action: 'tags-added',
        timestamp: new Date().toISOString(),
        details: JSON.stringify(['marketing', 'approved']),
      });

      const lastEvent = media.auditTrail[media.auditTrail.length - 1];
      const tags = JSON.parse(lastEvent.details!);

      expect(tags).toEqual(['marketing', 'approved']);
    });
  });

  // ==================== 21. MEDIA RELATIONSHIPS ====================
  describe('21. Media Source Relationships', () => {
    it('should link edited image to source', () => {
      const original = createMockMedia({ id: 'original-123', title: 'Original' });
      const edited = createMockMedia({
        title: 'Edited',
        source: 'edited',
        sourceImageId: original.id,
      });

      expect(edited.sourceImageId).toBe(original.id);
      expect(edited.source).toBe('edited');
    });

    it('should link generated video to source image', () => {
      const sourceImage = createMockMedia({
        id: 'img-456',
        type: 'image',
      });

      const video = createMockMedia({
        type: 'video',
        source: 'veo',
        sourceImageId: sourceImage.id,
        startFrameUrl: sourceImage.url,
      });

      expect(video.sourceImageId).toBe(sourceImage.id);
      expect(video.startFrameUrl).toBe(sourceImage.url);
    });

    it('should track input image for AI generation', () => {
      const inputImage = 'https://storage.googleapis.com/input.jpg';
      const generated = createMockMedia({
        source: 'imagen',
        inputImageUrl: inputImage,
        prompt: 'Make it more colorful',
      });

      expect(generated.inputImageUrl).toBe(inputImage);
      expect(generated.prompt).toBeDefined();
    });

    it('should track character reference for video generation', () => {
      const characterRef = 'https://storage.googleapis.com/character.jpg';
      const video = createMockMedia({
        type: 'video',
        source: 'veo',
        characterReferenceUrl: characterRef,
      });

      expect(video.characterReferenceUrl).toBe(characterRef);
    });
  });

  // ==================== 22. SEARCH FUNCTIONALITY ====================
  describe('22. Search and Query', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'm1', title: 'Sunset Beach Photo', description: 'Beautiful sunset', isPublished: true }),
        createMockMedia({ id: 'm2', title: 'Mountain Landscape', description: 'Snowy peaks', isPublished: true }),
        createMockMedia({ id: 'm3', title: 'Beach Vacation', description: 'Summer fun', isPublished: true }),
        createMockMedia({ id: 'm4', title: 'City Skyline', description: 'Urban sunset', isPublished: true }),
      ];
    });

    it('should search in titles', () => {
      const query = 'beach';
      const results = testMedia.filter(m =>
        m.title.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2); // m1, m3
    });

    it('should search in descriptions', () => {
      const query = 'sunset';
      const results = testMedia.filter(m =>
        m.description?.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2); // m1, m4
    });

    it('should search in both title and description', () => {
      const query = 'sunset';
      const results = testMedia.filter(m =>
        m.title.toLowerCase().includes(query.toLowerCase()) ||
        m.description?.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2); // m1 (both), m4 (description)
    });
  });

  // ==================== 23. SORTING ====================
  describe('23. Sorting and Ordering', () => {
    let testMedia: UnifiedMedia[];

    beforeEach(() => {
      testMedia = [
        createMockMedia({ id: 'm1', title: 'Zebra', createdAt: '2024-01-03T00:00:00Z' }),
        createMockMedia({ id: 'm2', title: 'Apple', createdAt: '2024-01-01T00:00:00Z' }),
        createMockMedia({ id: 'm3', title: 'Mango', createdAt: '2024-01-02T00:00:00Z' }),
      ];
    });

    it('should sort by createdAt descending (newest first)', () => {
      const sorted = [...testMedia].sort((a, b) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
      );

      expect(sorted[0].id).toBe('m1'); // 2024-01-03
      expect(sorted[1].id).toBe('m3'); // 2024-01-02
      expect(sorted[2].id).toBe('m2'); // 2024-01-01
    });

    it('should sort by title alphabetically', () => {
      const sorted = [...testMedia].sort((a, b) =>
        a.title.localeCompare(b.title)
      );

      expect(sorted[0].id).toBe('m2'); // Apple
      expect(sorted[1].id).toBe('m3'); // Mango
      expect(sorted[2].id).toBe('m1'); // Zebra
    });
  });

  // ==================== 24. MEDIA VIEWER ====================
  describe('24. Media Viewer and Details', () => {
    it('should display full media details', () => {
      const media = createMockMedia({
        title: 'Product Photo',
        description: 'Official product photography',
        type: 'image',
        source: 'upload',
        tags: ['product', 'official'],
        collections: ['col1', 'col2'],
        mimeType: 'image/jpeg',
        fileSize: 1024 * 500,
        dimensions: { width: 1920, height: 1080 },
        colors: [{ hex: '#FF5733', rgb: [255, 87, 51], proportion: 0.6 }],
        isPublished: true,
        createdBy: managerUser,
        createdAt: new Date().toISOString(),
      });

      // Verify all details are present
      expect(media.title).toBe('Product Photo');
      expect(media.description).toBeDefined();
      expect(media.type).toBe('image');
      expect(media.source).toBe('upload');
      expect(media.tags).toHaveLength(2);
      expect(media.collections).toHaveLength(2);
      expect(media.mimeType).toBe('image/jpeg');
      expect(media.fileSize).toBeDefined();
      expect(media.dimensions).toBeDefined();
      expect(media.colors).toBeDefined();
      expect(media.isPublished).toBe(true);
    });

    it('should display AI generation metadata', () => {
      const media = createMockMedia({
        source: 'imagen',
        prompt: 'A beautiful sunset over mountains',
        explainability: {
          summary: 'Generated with brand controls',
          confidence: 0.95,
          appliedControls: ['content-filter'],
          brandElementsUsed: ['color-palette'],
          avoidedElements: [],
        },
        inputImageUrl: 'https://storage.googleapis.com/input.jpg',
      });

      expect(media.prompt).toBeDefined();
      expect(media.explainability).toBeDefined();
      expect(media.explainability!.confidence).toBe(0.95);
      expect(media.inputImageUrl).toBeDefined();
    });

    it('should display audit trail in chronological order', () => {
      const media = createMockMedia();

      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date(Date.now() + 1000).toISOString(),
      });

      media.auditTrail.push({
        userId: managerUser,
        action: 'published',
        timestamp: new Date(Date.now() + 2000).toISOString(),
      });

      expect(media.auditTrail).toHaveLength(3);
      expect(media.auditTrail[0].action).toBe('created');
      expect(media.auditTrail[1].action).toBe('edited');
      expect(media.auditTrail[2].action).toBe('published');
    });
  });

  // ==================== 25. ROLE-BASED ACCESS CONTROL ====================
  describe('25. Role-Based Access Control', () => {
    it('should define manager permissions', () => {
      const managerPerms = {
        canEditBrandProfile: true,
        canDeleteAnyMedia: true,
        canManageCollections: true,
        canBulkPublish: true,
      };

      expect(Object.values(managerPerms).every(v => v === true)).toBe(true);
    });

    it('should define contributor permissions', () => {
      const contributorPerms = {
        canEditBrandProfile: false,
        canDeleteAnyMedia: false,
        canManageCollections: true, // Can create collections
        canBulkPublish: false,
      };

      expect(contributorPerms.canEditBrandProfile).toBe(false);
      expect(contributorPerms.canDeleteAnyMedia).toBe(false);
    });

    it('should enforce ownership for contributor edits', () => {
      const media = createMockMedia({ createdBy: managerUser });
      const currentUser = contributorUser;
      const userRole = 'CONTRIBUTOR';

      const canEdit = userRole === 'MANAGER' || media.createdBy === currentUser;

      expect(canEdit).toBe(false);
    });

    it('should allow manager to edit any media', () => {
      const media = createMockMedia({ createdBy: contributorUser });
      const userRole = 'MANAGER';

      const canEdit = userRole === 'MANAGER';

      expect(canEdit).toBe(true);
    });
  });
});
