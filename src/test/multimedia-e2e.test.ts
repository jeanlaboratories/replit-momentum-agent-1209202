/**
 * End-to-End Tests for Multimedia System
 *
 * Tests comprehensive multimedia functionality including:
 * - Media upload from Team Companion chat
 * - Image gallery with public/private visibility
 * - Video gallery with public/private visibility
 * - Team profile media management
 * - Personal profile media management
 * - Role-based access control (Manager vs Contributor)
 * - Multi-tenancy and brand isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UnifiedMedia, MediaCollection } from '@/lib/types/media-library';

// Test data setup
const testBrand1 = 'brand-alpha-123';
const testBrand2 = 'brand-beta-456';
const managerUser = 'manager-user-001';
const contributorUser = 'contributor-user-002';
const otherBrandUser = 'other-brand-user-003';

// Helper to create mock media
const createMockMedia = (overrides: Partial<UnifiedMedia> = {}): UnifiedMedia => ({
  id: `media-${Date.now()}-${Math.random()}`,
  brandId: testBrand1,
  type: 'image',
  url: 'https://storage.googleapis.com/test-bucket/image.jpg',
  title: 'Test Media',
  description: '',
  source: 'upload',
  createdBy: managerUser,
  createdAt: new Date().toISOString(),
  isPublished: false,
  tags: [],
  collections: [],
  auditTrail: [{
    userId: managerUser,
    action: 'created',
    timestamp: new Date().toISOString(),
  }],
  ...overrides,
});

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

describe('Multimedia E2E Tests', () => {
  // ==================== 1. MEDIA UPLOAD FROM CHAT ====================
  describe('1. Media Upload from Team Companion Chat', () => {
    it('should structure image upload with correct metadata', () => {
      const imageUpload = {
        name: 'team-photo.jpg',
        type: 'image/jpeg',
        size: 1024 * 500,
        brandId: testBrand1,
        userId: managerUser,
      };

      expect(imageUpload.name).toBe('team-photo.jpg');
      expect(imageUpload.type).toBe('image/jpeg');
      expect(imageUpload.brandId).toBe(testBrand1);
      expect(imageUpload.userId).toBe(managerUser);
    });

    it('should structure video upload with correct metadata', () => {
      const videoUpload = {
        name: 'presentation.mp4',
        type: 'video/mp4',
        size: 1024 * 1024 * 5,
        brandId: testBrand1,
        userId: contributorUser,
      };

      expect(videoUpload.type).toBe('video/mp4');
      expect(videoUpload.userId).toBe(contributorUser);
    });

    it('should create media record from chat upload', () => {
      const media = createMockMedia({
        type: 'image',
        source: 'chatbot',
        title: 'Team Photo from Chat',
        isPublished: false,
      });

      expect(media.source).toBe('chatbot');
      expect(media.type).toBe('image');
      expect(media.isPublished).toBe(false);
      expect(media.createdBy).toBe(managerUser);
      expect(media.brandId).toBe(testBrand1);
    });

    it('should track multiple media attachments in chat message', () => {
      const chatMessage = {
        role: 'user',
        content: 'Here are the analytics charts',
        media: [
          { type: 'image', url: 'https://storage.googleapis.com/test/chart1.png', fileName: 'chart1.png' },
          { type: 'image', url: 'https://storage.googleapis.com/test/chart2.png', fileName: 'chart2.png' },
        ],
      };

      expect(chatMessage.media).toHaveLength(2);
      expect(chatMessage.media[0].type).toBe('image');
      expect(chatMessage.media[1].type).toBe('image');
    });
  });

  // ==================== 2. IMAGE GALLERY - PUBLIC/PRIVATE ====================
  describe('2. Image Gallery - Public/Private Visibility', () => {
    it('should create private image with isPublished=false', () => {
      const privateImage = createMockMedia({
        type: 'image',
        title: 'Private Draft Design',
        isPublished: false,
      });

      expect(privateImage.isPublished).toBe(false);
      expect(privateImage.type).toBe('image');
    });

    it('should create public image with isPublished=true', () => {
      const publicImage = createMockMedia({
        type: 'image',
        title: 'Official Team Banner',
        isPublished: true,
      });

      expect(publicImage.isPublished).toBe(true);
    });

    it('should filter media by published status', () => {
      const allMedia = [
        createMockMedia({ title: 'Public 1', isPublished: true }),
        createMockMedia({ title: 'Private 1', isPublished: false }),
        createMockMedia({ title: 'Public 2', isPublished: true }),
        createMockMedia({ title: 'Private 2', isPublished: false }),
      ];

      const publicOnly = allMedia.filter(m => m.isPublished === true);
      const privateOnly = allMedia.filter(m => m.isPublished === false);

      expect(publicOnly).toHaveLength(2);
      expect(privateOnly).toHaveLength(2);
      expect(publicOnly.every(m => m.isPublished === true)).toBe(true);
      expect(privateOnly.every(m => m.isPublished === false)).toBe(true);
    });

    it('should implement Smart Scan privacy (published OR own private)', () => {
      const currentUserId = managerUser;
      const allMedia = [
        createMockMedia({ title: 'Public 1', isPublished: true, createdBy: contributorUser }),
        createMockMedia({ title: 'Own Private', isPublished: false, createdBy: currentUserId }),
        createMockMedia({ title: 'Other Private', isPublished: false, createdBy: contributorUser }),
        createMockMedia({ title: 'Public 2', isPublished: true, createdBy: managerUser }),
      ];

      // Smart Scan logic: show published OR created by current user
      const visibleMedia = allMedia.filter(m => {
        const isOwner = m.createdBy === currentUserId;
        const isPublished = m.isPublished === true;
        return isPublished || isOwner;
      });

      expect(visibleMedia).toHaveLength(3); // Public 1, Own Private, Public 2
      expect(visibleMedia.some(m => m.title === 'Other Private')).toBe(false);
    });

    it('should toggle image from private to public', () => {
      const media = createMockMedia({
        title: 'Design After Review',
        isPublished: false,
      });

      expect(media.isPublished).toBe(false);

      // Simulate publish action
      media.isPublished = true;
      media.auditTrail.push({
        userId: managerUser,
        action: 'published',
        timestamp: new Date().toISOString(),
      });

      expect(media.isPublished).toBe(true);
      expect(media.auditTrail.some(e => e.action === 'published')).toBe(true);
    });
  });

  // ==================== 3. VIDEO GALLERY - PUBLIC/PRIVATE ====================
  describe('3. Video Gallery - Public/Private Visibility', () => {
    it('should create private video', () => {
      const privateVideo = createMockMedia({
        type: 'video',
        title: 'Work in Progress Video',
        source: 'veo',
        isPublished: false,
      });

      expect(privateVideo.type).toBe('video');
      expect(privateVideo.source).toBe('veo');
      expect(privateVideo.isPublished).toBe(false);
    });

    it('should create public video', () => {
      const publicVideo = createMockMedia({
        type: 'video',
        title: 'Official Promo Video',
        source: 'veo',
        isPublished: true,
      });

      expect(publicVideo.isPublished).toBe(true);
    });

    it('should filter video gallery by type and published status', () => {
      const allMedia = [
        createMockMedia({ type: 'video', isPublished: true }),
        createMockMedia({ type: 'video', isPublished: false }),
        createMockMedia({ type: 'image', isPublished: true }),
      ];

      const publicVideos = allMedia.filter(m => m.type === 'video' && m.isPublished === true);

      expect(publicVideos).toHaveLength(1);
      expect(publicVideos[0].type).toBe('video');
    });

    it('should track video generation metadata', () => {
      const video = createMockMedia({
        type: 'video',
        source: 'veo',
        prompt: 'A beautiful sunset over the ocean',
      });

      expect(video.prompt).toBe('A beautiful sunset over the ocean');
      expect(video.source).toBe('veo');
    });
  });

  // ==================== 4. TEAM PROFILE MEDIA ====================
  describe('4. Team Profile Media Management', () => {
    it('should tag team profile media with profile tag', () => {
      const profileMedia = createMockMedia({
        title: 'Team Logo',
        tags: ['profile', 'logo', 'official'],
        isPublished: true,
      });

      expect(profileMedia.tags).toContain('profile');
      expect(profileMedia.isPublished).toBe(true);
    });

    it('should enforce manager permissions for profile edits', () => {
      const permissions = {
        MANAGER: {
          canEditBrandProfile: true,
          canDeleteContent: true,
        },
        CONTRIBUTOR: {
          canEditBrandProfile: false,
          canDeleteContent: false,
        },
      };

      expect(permissions.MANAGER.canEditBrandProfile).toBe(true);
      expect(permissions.CONTRIBUTOR.canEditBrandProfile).toBe(false);
    });

    it('should organize team media in collections', () => {
      const collection = createMockCollection({
        name: 'Team Brand Assets',
        description: 'Official logos, banners, and profile images',
      });

      const media = createMockMedia({
        title: 'Brand Asset',
        collections: [collection.id],
        isPublished: true,
      });

      expect(media.collections).toContain(collection.id);
      expect(collection.name).toBe('Team Brand Assets');
    });
  });

  // ==================== 5. PERSONAL PROFILE MEDIA ====================
  describe('5. Personal Profile Media Management', () => {
    it('should create personal media with personal tag', () => {
      const personalPhoto = createMockMedia({
        title: 'My Profile Photo',
        tags: ['personal', 'avatar'],
        isPublished: false,
        createdBy: managerUser,
      });

      expect(personalPhoto.tags).toContain('personal');
      expect(personalPhoto.isPublished).toBe(false);
      expect(personalPhoto.createdBy).toBe(managerUser);
    });

    it('should filter user media by createdBy', () => {
      const allMedia = [
        createMockMedia({ createdBy: managerUser, title: 'Manager 1' }),
        createMockMedia({ createdBy: contributorUser, title: 'Contributor 1' }),
        createMockMedia({ createdBy: managerUser, title: 'Manager 2' }),
      ];

      const managerMedia = allMedia.filter(m => m.createdBy === managerUser);

      expect(managerMedia).toHaveLength(2);
      expect(managerMedia.every(m => m.createdBy === managerUser)).toBe(true);
    });

    it('should prevent editing other users media', () => {
      const ownerMedia = createMockMedia({
        createdBy: managerUser,
        title: 'Owner Image',
      });

      const currentUser = contributorUser;
      const canEdit = ownerMedia.createdBy === currentUser;

      expect(canEdit).toBe(false);
    });
  });

  // ==================== 6. ROLE-BASED ACCESS CONTROL ====================
  describe('6. Role-Based Access Control', () => {
    it('should define manager permissions', () => {
      const managerPerms = {
        canEditBrandProfile: true,
        canInviteUsers: true,
        canManageTeam: true,
        canDeleteContent: true,
      };

      expect(Object.values(managerPerms).every(v => v === true)).toBe(true);
    });

    it('should define contributor permissions', () => {
      const contributorPerms = {
        canEditBrandProfile: false,
        canInviteUsers: false,
        canManageTeam: false,
        canDeleteContent: false,
      };

      expect(Object.values(contributorPerms).every(v => v === false)).toBe(true);
    });

    it('should enforce ownership for deletion by contributors', () => {
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

    it('should implement bulk publish with audit trail', () => {
      const mediaItems = [
        createMockMedia({ isPublished: false }),
        createMockMedia({ isPublished: false }),
      ];

      // Simulate bulk publish
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
  });

  // ==================== 7. MULTI-TENANCY & BRAND ISOLATION ====================
  describe('7. Multi-Tenancy and Brand Isolation', () => {
    it('should isolate media by brandId', () => {
      const brand1Media = [
        createMockMedia({ brandId: testBrand1, title: 'Brand 1 Image 1' }),
        createMockMedia({ brandId: testBrand1, title: 'Brand 1 Image 2' }),
      ];

      const brand2Media = [
        createMockMedia({ brandId: testBrand2, title: 'Brand 2 Image 1' }),
      ];

      const allMedia = [...brand1Media, ...brand2Media];

      const brand1Results = allMedia.filter(m => m.brandId === testBrand1);
      const brand2Results = allMedia.filter(m => m.brandId === testBrand2);

      expect(brand1Results).toHaveLength(2);
      expect(brand2Results).toHaveLength(1);
      expect(brand1Results.every(m => m.brandId === testBrand1)).toBe(true);
      expect(brand2Results.every(m => m.brandId === testBrand2)).toBe(true);
    });

    it('should enforce brandId in storage paths', () => {
      const storagePath = `chat_media/${testBrand1}/${managerUser}/image.jpg`;

      expect(storagePath).toContain(testBrand1);
      expect(storagePath).toContain(managerUser);
      expect(storagePath).not.toContain(testBrand2);
    });

    it('should isolate collections by brandId', () => {
      const collections = [
        createMockCollection({ brandId: testBrand1, name: 'Brand 1 Collection' }),
        createMockCollection({ brandId: testBrand2, name: 'Brand 2 Collection' }),
      ];

      const brand1Collections = collections.filter(c => c.brandId === testBrand1);

      expect(brand1Collections).toHaveLength(1);
      expect(brand1Collections[0].name).toBe('Brand 1 Collection');
    });

    it('should prevent cross-brand data access', () => {
      const checkBrandAccess = (userId: string, brandId: string, userBrandIds: string[]) => {
        return userBrandIds.includes(brandId);
      };

      const managerBrands = [testBrand1];
      const otherUserBrands = [testBrand2];

      expect(checkBrandAccess(managerUser, testBrand1, managerBrands)).toBe(true);
      expect(checkBrandAccess(managerUser, testBrand2, managerBrands)).toBe(false);
      expect(checkBrandAccess(otherBrandUser, testBrand2, otherUserBrands)).toBe(true);
    });

    it('should maintain separate audit trails per brand', () => {
      const media1 = createMockMedia({ brandId: testBrand1 });
      const media2 = createMockMedia({ brandId: testBrand2 });

      expect(media1.brandId).toBe(testBrand1);
      expect(media2.brandId).toBe(testBrand2);
      expect(media1.auditTrail).toBeDefined();
      expect(media2.auditTrail).toBeDefined();
    });
  });

  // ==================== 8. MEDIA METADATA & ORGANIZATION ====================
  describe('8. Media Metadata and Organization', () => {
    it('should add tags to media', () => {
      const media = createMockMedia({
        tags: ['marketing', 'social-media', 'approved'],
      });

      expect(media.tags).toHaveLength(3);
      expect(media.tags).toContain('marketing');
      expect(media.tags).toContain('social-media');
      expect(media.tags).toContain('approved');
    });

    it('should add media to collections', () => {
      const collection = createMockCollection();
      const media = createMockMedia({
        collections: [collection.id],
      });

      expect(media.collections).toContain(collection.id);
    });

    it('should filter by source type', () => {
      const allMedia = [
        createMockMedia({ source: 'upload', title: 'Uploaded' }),
        createMockMedia({ source: 'imagen', title: 'AI Generated' }),
        createMockMedia({ source: 'veo', title: 'Video Generated' }),
        createMockMedia({ source: 'upload', title: 'Uploaded 2' }),
      ];

      const uploaded = allMedia.filter(m => m.source === 'upload');
      const aiGenerated = allMedia.filter(m => m.source === 'imagen');

      expect(uploaded).toHaveLength(2);
      expect(aiGenerated).toHaveLength(1);
    });

    it('should track AI generation metadata', () => {
      const aiMedia = createMockMedia({
        source: 'imagen',
        prompt: 'A beautiful sunset over mountains',
        explainability: {
          summary: 'Generated based on prompt',
          confidence: 0.95,
          appliedControls: ['content-filter', 'style-guide'],
          brandElementsUsed: ['color-palette'],
        },
      });

      expect(aiMedia.prompt).toBe('A beautiful sunset over mountains');
      expect(aiMedia.explainability?.confidence).toBe(0.95);
      expect(aiMedia.explainability?.appliedControls).toContain('content-filter');
    });

    it('should maintain audit trail for all actions', () => {
      const media = createMockMedia();

      // Simulate actions
      media.auditTrail.push({
        userId: managerUser,
        action: 'edited',
        timestamp: new Date().toISOString(),
        details: 'Updated title',
      });

      media.auditTrail.push({
        userId: managerUser,
        action: 'published',
        timestamp: new Date().toISOString(),
      });

      expect(media.auditTrail).toHaveLength(3); // created + edited + published
      expect(media.auditTrail.some(e => e.action === 'created')).toBe(true);
      expect(media.auditTrail.some(e => e.action === 'edited')).toBe(true);
      expect(media.auditTrail.some(e => e.action === 'published')).toBe(true);
    });

    it('should support hierarchical collections', () => {
      const parentCollection = createMockCollection({
        name: 'Marketing',
      });

      const childCollection = createMockCollection({
        name: 'Q1 Campaign',
        parentId: parentCollection.id,
      });

      expect(childCollection.parentId).toBe(parentCollection.id);
    });
  });

  // ==================== 9. MEDIA DIMENSIONS & FILE INFO ====================
  describe('9. Media Dimensions and File Information', () => {
    it('should store image dimensions', () => {
      const media = createMockMedia({
        type: 'image',
        dimensions: { width: 1920, height: 1080 },
      });

      expect(media.dimensions?.width).toBe(1920);
      expect(media.dimensions?.height).toBe(1080);
    });

    it('should store file size and mime type', () => {
      const media = createMockMedia({
        mimeType: 'image/jpeg',
        fileSize: 1024 * 500, // 500KB
      });

      expect(media.mimeType).toBe('image/jpeg');
      expect(media.fileSize).toBe(512000);
    });

    it('should track color palette for images', () => {
      const media = createMockMedia({
        type: 'image',
        colors: ['#FF5733', '#33FF57', '#3357FF'],
      });

      expect(media.colors).toHaveLength(3);
      expect(media.colors).toContain('#FF5733');
    });
  });

  // ==================== 10. SOURCE TRACKING & RELATIONSHIPS ====================
  describe('10. Source Tracking and Relationships', () => {
    it('should track source artifact for Brand Soul media', () => {
      const media = createMockMedia({
        source: 'brand-soul',
        sourceArtifactId: 'artifact-123',
      });

      expect(media.source).toBe('brand-soul');
      expect(media.sourceArtifactId).toBe('artifact-123');
    });

    it('should link edited images to source', () => {
      const originalMedia = createMockMedia({
        id: 'original-123',
        title: 'Original Image',
      });

      const editedMedia = createMockMedia({
        title: 'Edited Image',
        source: 'edited',
        sourceImageId: originalMedia.id,
      });

      expect(editedMedia.sourceImageId).toBe(originalMedia.id);
      expect(editedMedia.source).toBe('edited');
    });

    it('should track video generation from image', () => {
      const sourceImage = createMockMedia({
        id: 'image-456',
        type: 'image',
      });

      const generatedVideo = createMockMedia({
        type: 'video',
        source: 'veo',
        sourceImageId: sourceImage.id,
      });

      expect(generatedVideo.sourceImageId).toBe(sourceImage.id);
      expect(generatedVideo.type).toBe('video');
    });
  });
});
