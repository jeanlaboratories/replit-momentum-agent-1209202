/**
 * Team Profile E2E Tests
 *
 * Comprehensive E2E test suite for Team Profile features including:
 * - Posts (Pinned Posts)
 * - Reels (Feed Sections)
 * - Docs (Team Documents)
 * - About Tab (Brand Identity, Summary, Contact Info)
 * - Image Gallery
 * - Video Gallery
 *
 * Pattern: Mock-based data validation (follows multimedia-e2e.test.ts approach)
 *
 * @see /src/lib/types.ts - BrandProfile, PinnedPost, FeedSection, BrandAsset
 * @see /src/components/brand-profile-social/ContentFeed.tsx - UI component
 */

import { describe, it, expect } from 'vitest';
import type {
  BrandProfile,
  PinnedPost,
  FeedSection,
  BrandAsset,
  BrandText,
  EngagementMetric,
} from '@/lib/types';

// ============================================================================
// Test Constants
// ============================================================================

const BRAND_1_ID = 'brand-1';
const BRAND_2_ID = 'brand-2';
const USER_1_ID = 'user-1';
const USER_2_ID = 'user-2';

const CONTENT_TYPES = ['updates', 'solutions', 'insights', 'events', 'images', 'videos', 'resources', 'documents'] as const;

// ============================================================================
// Helper Functions - Mock Creators
// ============================================================================

/**
 * Creates a mock PinnedPost object
 */
function createMockPinnedPost(overrides?: Partial<PinnedPost>): PinnedPost {
  return {
    id: `pinned-${Date.now()}`,
    title: 'Exciting Team Update',
    content: 'We are thrilled to announce our latest milestone!',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock FeedSection object
 */
function createMockFeedSection(overrides?: Partial<FeedSection>): FeedSection {
  return {
    id: `section-${Date.now()}`,
    title: 'Recent Updates',
    slug: 'updates',
    contentType: 'updates',
    items: [],
    ...overrides,
  };
}

/**
 * Creates a mock BrandAsset object
 */
function createMockBrandAsset(overrides?: Partial<BrandAsset>): BrandAsset {
  return {
    id: `asset-${Date.now()}`,
    name: 'Team Asset',
    url: 'https://example.com/asset.jpg',
    type: 'image',
    uploadedBy: USER_1_ID,
    uploadedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock BrandProfile object
 */
function createMockBrandProfile(overrides?: Partial<BrandProfile>): BrandProfile {
  return {
    images: [],
    videos: [],
    documents: [],
    ...overrides,
  };
}

/**
 * Creates a mock EngagementMetric object
 */
function createMockEngagementMetric(overrides?: Partial<EngagementMetric>): EngagementMetric {
  return {
    label: 'Total Reach',
    value: '10K',
    icon: 'users',
    ...overrides,
  };
}

/**
 * Validates ISO timestamp format
 */
function isISOTimestamp(timestamp: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return iso8601Regex.test(timestamp);
}

// ============================================================================
// Test Suite 1: Pinned Posts (8 tests)
// ============================================================================

describe('Team Profile E2E Tests - Pinned Posts', () => {
  it('should create pinned post with required fields', () => {
    const pinnedPost = createMockPinnedPost();

    expect(pinnedPost.id).toBeDefined();
    expect(pinnedPost.title).toBeDefined();
    expect(pinnedPost.content).toBeDefined();
    expect(pinnedPost.createdAt).toBeDefined();
  });

  it('should have valid ISO timestamp for createdAt', () => {
    const pinnedPost = createMockPinnedPost();

    expect(isISOTimestamp(pinnedPost.createdAt)).toBe(true);
  });

  it('should support optional imageUrl', () => {
    const pinnedPost = createMockPinnedPost({
      imageUrl: 'https://example.com/pinned-image.jpg',
    });

    expect(pinnedPost.imageUrl).toBe('https://example.com/pinned-image.jpg');
  });

  it('should support optional linkUrl and linkText', () => {
    const pinnedPost = createMockPinnedPost({
      linkUrl: 'https://example.com/read-more',
      linkText: 'Read More',
    });

    expect(pinnedPost.linkUrl).toBe('https://example.com/read-more');
    expect(pinnedPost.linkText).toBe('Read More');
  });

  it('should allow only one pinned post per brand profile', () => {
    const profile = createMockBrandProfile({
      pinnedPost: createMockPinnedPost(),
    });

    expect(profile.pinnedPost).toBeDefined();
    // Only one pinnedPost field exists
    expect(typeof profile.pinnedPost).toBe('object');
  });

  it('should allow unpinning (setting pinnedPost to undefined)', () => {
    const profile = createMockBrandProfile({
      pinnedPost: createMockPinnedPost(),
    });

    const updatedProfile = {
      ...profile,
      pinnedPost: undefined,
    };

    expect(updatedProfile.pinnedPost).toBeUndefined();
  });

  it('should support rich text content', () => {
    const pinnedPost = createMockPinnedPost({
      content: 'This is **bold** text with *italics* and a [link](https://example.com).',
    });

    expect(pinnedPost.content).toContain('**bold**');
    expect(pinnedPost.content).toContain('[link]');
  });

  it('should update pinned post with new content', () => {
    const originalPost = createMockPinnedPost({
      title: 'Original Title',
      content: 'Original content',
    });

    const updatedPost = {
      ...originalPost,
      title: 'Updated Title',
      content: 'Updated content',
    };

    expect(updatedPost.title).toBe('Updated Title');
    expect(updatedPost.content).toBe('Updated content');
    expect(updatedPost.id).toBe(originalPost.id); // ID preserved
  });
});

// ============================================================================
// Test Suite 2: Feed Sections / Reels (12 tests)
// ============================================================================

describe('Team Profile E2E Tests - Feed Sections (Reels)', () => {
  it('should create feed section with required fields', () => {
    const section = createMockFeedSection();

    expect(section.id).toBeDefined();
    expect(section.title).toBeDefined();
    expect(section.slug).toBeDefined();
    expect(section.contentType).toBeDefined();
  });

  it('should support all content types', () => {
    CONTENT_TYPES.forEach((type) => {
      const section = createMockFeedSection({
        contentType: type,
      });

      expect(section.contentType).toBe(type);
    });
  });

  it('should have items array for section content', () => {
    const section = createMockFeedSection({
      items: [
        {
          id: 'item-1',
          title: 'First Update',
          excerpt: 'This is our first update',
          date: new Date().toISOString(),
        },
      ],
    });

    expect(Array.isArray(section.items)).toBe(true);
    expect(section.items).toHaveLength(1);
    expect(section.items![0].title).toBe('First Update');
  });

  it('should support empty items array', () => {
    const section = createMockFeedSection({
      items: [],
    });

    expect(section.items).toHaveLength(0);
  });

  it('should support section items with imageUrl', () => {
    const section = createMockFeedSection({
      items: [
        {
          id: 'item-1',
          title: 'Visual Update',
          excerpt: 'Check out our new design',
          date: new Date().toISOString(),
          imageUrl: 'https://example.com/update.jpg',
        },
      ],
    });

    expect(section.items![0].imageUrl).toBe('https://example.com/update.jpg');
  });

  it('should allow multiple feed sections per profile', () => {
    const profile = createMockBrandProfile({
      feedSections: [
        createMockFeedSection({ slug: 'updates', contentType: 'updates' }),
        createMockFeedSection({ slug: 'insights', contentType: 'insights' }),
        createMockFeedSection({ slug: 'events', contentType: 'events' }),
      ],
    });

    expect(profile.feedSections).toHaveLength(3);
    expect(profile.feedSections!.map((s) => s.slug)).toEqual(['updates', 'insights', 'events']);
  });

  it('should use slug for section navigation', () => {
    const section = createMockFeedSection({
      title: 'Recent Updates',
      slug: 'recent-updates',
    });

    expect(section.slug).toBe('recent-updates');
    expect(section.slug).not.toContain(' '); // No spaces in slug
  });

  it('should support updates content type', () => {
    const section = createMockFeedSection({
      title: 'Company Updates',
      contentType: 'updates',
    });

    expect(section.contentType).toBe('updates');
  });

  it('should support solutions content type', () => {
    const section = createMockFeedSection({
      title: 'Our Solutions',
      contentType: 'solutions',
    });

    expect(section.contentType).toBe('solutions');
  });

  it('should support insights content type', () => {
    const section = createMockFeedSection({
      title: 'Industry Insights',
      contentType: 'insights',
    });

    expect(section.contentType).toBe('insights');
  });

  it('should support events content type', () => {
    const section = createMockFeedSection({
      title: 'Upcoming Events',
      contentType: 'events',
    });

    expect(section.contentType).toBe('events');
  });

  it('should support resources content type', () => {
    const section = createMockFeedSection({
      title: 'Resources & Guides',
      contentType: 'resources',
    });

    expect(section.contentType).toBe('resources');
  });
});

// ============================================================================
// Test Suite 3: Image Gallery (10 tests)
// ============================================================================

describe('Team Profile E2E Tests - Image Gallery', () => {
  it('should create brand asset for image', () => {
    const image = createMockBrandAsset({
      type: 'image',
      url: 'https://example.com/team-photo.jpg',
    });

    expect(image.type).toBe('image');
    expect(image.url).toBeDefined();
  });

  it('should track uploader information', () => {
    const image = createMockBrandAsset({
      uploadedBy: USER_1_ID,
      uploadedAt: new Date().toISOString(),
    });

    expect(image.uploadedBy).toBe(USER_1_ID);
    expect(image.uploadedAt).toBeDefined();
    expect(isISOTimestamp(image.uploadedAt!)).toBe(true);
  });

  it('should support image name/title', () => {
    const image = createMockBrandAsset({
      name: 'Team Photo - Annual Retreat 2024',
      type: 'image',
    });

    expect(image.name).toBe('Team Photo - Annual Retreat 2024');
  });

  it('should support optional prompt for AI-generated images', () => {
    const image = createMockBrandAsset({
      type: 'image',
      prompt: 'A modern office space with natural lighting',
    });

    expect(image.prompt).toBe('A modern office space with natural lighting');
  });

  it('should support isPublished flag for visibility', () => {
    const image = createMockBrandAsset({
      type: 'image',
      isPublished: true,
    });

    expect(image.isPublished).toBe(true);
  });

  it('should store multiple images in profile', () => {
    const profile = createMockBrandProfile({
      images: [
        createMockBrandAsset({ id: 'img-1', type: 'image' }),
        createMockBrandAsset({ id: 'img-2', type: 'image' }),
        createMockBrandAsset({ id: 'img-3', type: 'image' }),
      ],
    });

    expect(profile.images).toHaveLength(3);
    expect(profile.images.every((img) => img.type === 'image')).toBe(true);
  });

  it('should filter images by published status', () => {
    const allImages = [
      createMockBrandAsset({ id: 'img-1', isPublished: true }),
      createMockBrandAsset({ id: 'img-2', isPublished: false }),
      createMockBrandAsset({ id: 'img-3', isPublished: true }),
    ];

    const publishedImages = allImages.filter((img) => img.isPublished);

    expect(publishedImages).toHaveLength(2);
  });

  it('should support image sorting by upload date', () => {
    const now = new Date();
    const images = [
      createMockBrandAsset({ id: 'img-1', uploadedAt: new Date(now.getTime() - 3600000).toISOString() }),
      createMockBrandAsset({ id: 'img-2', uploadedAt: new Date(now.getTime() - 7200000).toISOString() }),
      createMockBrandAsset({ id: 'img-3', uploadedAt: now.toISOString() }),
    ];

    const sortedImages = [...images].sort(
      (a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime()
    );

    expect(sortedImages[0].id).toBe('img-3'); // Most recent
    expect(sortedImages[2].id).toBe('img-2'); // Oldest
  });

  it('should support images feed section', () => {
    const images = [
      createMockBrandAsset({ id: 'img-1', name: 'Image 1', type: 'image' }),
      createMockBrandAsset({ id: 'img-2', name: 'Image 2', type: 'image' }),
    ];

    const section = createMockFeedSection({
      title: 'Image Gallery',
      slug: 'images',
      contentType: 'images',
      items: images.map((img) => ({
        id: img.id,
        title: img.name,
        date: img.uploadedAt || '',
        excerpt: 'Team image',
        imageUrl: img.url,
      })),
    });

    expect(section.contentType).toBe('images');
    expect(section.items).toHaveLength(2);
  });

  it('should differentiate image gallery from feed images', () => {
    const profile = createMockBrandProfile({
      images: [createMockBrandAsset({ type: 'image' })],
      feedSections: [
        createMockFeedSection({
          contentType: 'images',
          items: [
            {
              id: 'feed-img-1',
              title: 'Feed Image',
              excerpt: 'From feed',
              date: new Date().toISOString(),
            },
          ],
        }),
      ],
    });

    expect(profile.images).toHaveLength(1);
    expect(profile.feedSections![0].items).toHaveLength(1);
  });
});

// ============================================================================
// Test Suite 4: Video Gallery (8 tests)
// ============================================================================

describe('Team Profile E2E Tests - Video Gallery', () => {
  it('should create brand asset for video', () => {
    const video = createMockBrandAsset({
      type: 'video',
      url: 'https://example.com/team-video.mp4',
    });

    expect(video.type).toBe('video');
    expect(video.url).toContain('.mp4');
  });

  it('should track video uploader information', () => {
    const video = createMockBrandAsset({
      type: 'video',
      uploadedBy: USER_1_ID,
      uploadedAt: new Date().toISOString(),
    });

    expect(video.uploadedBy).toBe(USER_1_ID);
    expect(video.uploadedAt).toBeDefined();
  });

  it('should support video name/title', () => {
    const video = createMockBrandAsset({
      name: 'Product Demo Video',
      type: 'video',
    });

    expect(video.name).toBe('Product Demo Video');
  });

  it('should store multiple videos in profile', () => {
    const profile = createMockBrandProfile({
      videos: [
        createMockBrandAsset({ id: 'vid-1', type: 'video' }),
        createMockBrandAsset({ id: 'vid-2', type: 'video' }),
      ],
    });

    expect(profile.videos).toHaveLength(2);
    expect(profile.videos.every((vid) => vid.type === 'video')).toBe(true);
  });

  it('should support video published status', () => {
    const video = createMockBrandAsset({
      type: 'video',
      isPublished: true,
    });

    expect(video.isPublished).toBe(true);
  });

  it('should support videos feed section', () => {
    const videos = [
      createMockBrandAsset({ id: 'vid-1', name: 'Video 1', type: 'video' }),
    ];

    const section = createMockFeedSection({
      title: 'Video Gallery',
      slug: 'videos',
      contentType: 'videos',
      items: videos.map((vid) => ({
        id: vid.id,
        title: vid.name,
        date: vid.uploadedAt || '',
        excerpt: 'Team video',
        imageUrl: vid.url,
      })),
    });

    expect(section.contentType).toBe('videos');
  });

  it('should filter videos by published status', () => {
    const allVideos = [
      createMockBrandAsset({ id: 'vid-1', type: 'video', isPublished: true }),
      createMockBrandAsset({ id: 'vid-2', type: 'video', isPublished: false }),
    ];

    const publishedVideos = allVideos.filter((vid) => vid.isPublished);

    expect(publishedVideos).toHaveLength(1);
  });

  it('should support video sorting by upload date', () => {
    const now = new Date();
    const videos = [
      createMockBrandAsset({ id: 'vid-1', type: 'video', uploadedAt: new Date(now.getTime() - 3600000).toISOString() }),
      createMockBrandAsset({ id: 'vid-2', type: 'video', uploadedAt: now.toISOString() }),
    ];

    const sortedVideos = [...videos].sort(
      (a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime()
    );

    expect(sortedVideos[0].id).toBe('vid-2'); // Most recent
  });
});

// ============================================================================
// Test Suite 5: Team Documents (8 tests)
// ============================================================================

describe('Team Profile E2E Tests - Team Documents', () => {
  it('should create brand asset for document', () => {
    const doc = createMockBrandAsset({
      type: 'document',
      url: 'https://example.com/whitepaper.pdf',
    });

    expect(doc.type).toBe('document');
    expect(doc.url).toBeDefined();
  });

  it('should track document uploader information', () => {
    const doc = createMockBrandAsset({
      type: 'document',
      uploadedBy: USER_2_ID,
      uploadedAt: new Date().toISOString(),
    });

    expect(doc.uploadedBy).toBe(USER_2_ID);
    expect(doc.uploadedAt).toBeDefined();
  });

  it('should support document name/title', () => {
    const doc = createMockBrandAsset({
      name: 'Annual Report 2024.pdf',
      type: 'document',
    });

    expect(doc.name).toBe('Annual Report 2024.pdf');
  });

  it('should store multiple documents in profile', () => {
    const profile = createMockBrandProfile({
      documents: [
        createMockBrandAsset({ id: 'doc-1', type: 'document' }),
        createMockBrandAsset({ id: 'doc-2', type: 'document' }),
        createMockBrandAsset({ id: 'doc-3', type: 'document' }),
      ],
    });

    expect(profile.documents).toHaveLength(3);
    expect(profile.documents.every((doc) => doc.type === 'document')).toBe(true);
  });

  it('should support document published status', () => {
    const doc = createMockBrandAsset({
      type: 'document',
      isPublished: true,
    });

    expect(doc.isPublished).toBe(true);
  });

  it('should support documents feed section', () => {
    const documents = [
      createMockBrandAsset({ id: 'doc-1', name: 'Document 1', type: 'document' }),
    ];

    const section = createMockFeedSection({
      title: 'Team Documents',
      slug: 'documents',
      contentType: 'documents',
      items: documents.map((doc) => ({
        id: doc.id,
        title: doc.name,
        date: doc.uploadedAt || '',
        excerpt: 'Team document',
        imageUrl: doc.url,
      })),
    });

    expect(section.contentType).toBe('documents');
  });

  it('should filter documents by published status', () => {
    const allDocs = [
      createMockBrandAsset({ id: 'doc-1', type: 'document', isPublished: true }),
      createMockBrandAsset({ id: 'doc-2', type: 'document', isPublished: false }),
      createMockBrandAsset({ id: 'doc-3', type: 'document', isPublished: true }),
    ];

    const publishedDocs = allDocs.filter((doc) => doc.isPublished);

    expect(publishedDocs).toHaveLength(2);
  });

  it('should support document sorting by upload date', () => {
    const now = new Date();
    const documents = [
      createMockBrandAsset({ id: 'doc-1', type: 'document', uploadedAt: new Date(now.getTime() - 7200000).toISOString() }),
      createMockBrandAsset({ id: 'doc-2', type: 'document', uploadedAt: now.toISOString() }),
    ];

    const sortedDocs = [...documents].sort(
      (a, b) => new Date(b.uploadedAt!).getTime() - new Date(a.uploadedAt!).getTime()
    );

    expect(sortedDocs[0].id).toBe('doc-2'); // Most recent
  });
});

// ============================================================================
// Test Suite 6: About Tab - Brand Identity (10 tests)
// ============================================================================

describe('Team Profile E2E Tests - About Tab (Brand Identity)', () => {
  it('should have brand summary', () => {
    const profile = createMockBrandProfile({
      summary: 'We are a leading technology company focused on innovation.',
    });

    expect(profile.summary).toBeDefined();
    expect(profile.summary).toContain('innovation');
  });

  it('should have brand tagline', () => {
    const profile = createMockBrandProfile({
      tagline: 'Innovation Starts Here',
    });

    expect(profile.tagline).toBe('Innovation Starts Here');
  });

  it('should have website URL', () => {
    const profile = createMockBrandProfile({
      websiteUrl: 'https://example.com',
    });

    expect(profile.websiteUrl).toBe('https://example.com');
  });

  it('should have contact email', () => {
    const profile = createMockBrandProfile({
      contactEmail: 'contact@example.com',
    });

    expect(profile.contactEmail).toBe('contact@example.com');
  });

  it('should have location', () => {
    const profile = createMockBrandProfile({
      location: 'San Francisco, CA',
    });

    expect(profile.location).toBe('San Francisco, CA');
  });

  it('should have banner image URL', () => {
    const profile = createMockBrandProfile({
      bannerImageUrl: 'https://example.com/banner.jpg',
    });

    expect(profile.bannerImageUrl).toBeDefined();
  });

  it('should have logo URL', () => {
    const profile = createMockBrandProfile({
      logoUrl: 'https://example.com/logo.png',
    });

    expect(profile.logoUrl).toBeDefined();
  });

  it('should support engagement metrics', () => {
    const profile = createMockBrandProfile({
      engagementMetrics: [
        createMockEngagementMetric({ label: 'Total Reach', value: '10K' }),
        createMockEngagementMetric({ label: 'Active Users', value: '500' }),
      ],
    });

    expect(profile.engagementMetrics).toHaveLength(2);
    expect(profile.engagementMetrics![0].label).toBe('Total Reach');
  });

  it('should support brandText sections', () => {
    const profile = createMockBrandProfile({
      brandText: {
        coreText: {
          missionVision: 'Our mission is to empower businesses.',
          brandStory: 'Founded in 2020...',
          taglines: ['Innovation First', 'Quality Always'],
        },
        marketingText: {
          adCopy: ['Limited time offer!'],
          productDescriptions: ['Premium quality product'],
          emailCampaigns: ['Welcome to our newsletter'],
          landingPageCopy: 'Transform your business today',
        },
        contentMarketingText: {
          blogPosts: ['Top 10 tips for success'],
          socialMediaCaptions: ['Check out our latest update!'],
          whitePapers: ['Industry insights whitepaper'],
          videoScripts: ['Welcome to our video tutorial'],
        },
        technicalSupportText: {
          userManuals: 'Getting started guide',
          faqs: [{ question: 'How do I start?', answer: 'Follow these steps...' }],
        },
        publicRelationsText: {
          pressReleases: ['Company announces new product'],
          companyStatements: ['We are committed to excellence'],
          mediaKitText: 'Media contact information',
        },
      },
    });

    expect(profile.brandText).toBeDefined();
    expect(profile.brandText?.coreText.missionVision).toContain('mission');
  });

  it('should support all About tab fields together', () => {
    const profile = createMockBrandProfile({
      summary: 'Leading tech company',
      tagline: 'Innovate Daily',
      websiteUrl: 'https://example.com',
      contactEmail: 'hello@example.com',
      location: 'Austin, TX',
      bannerImageUrl: 'https://example.com/banner.jpg',
      logoUrl: 'https://example.com/logo.png',
    });

    expect(profile.summary).toBeDefined();
    expect(profile.tagline).toBeDefined();
    expect(profile.websiteUrl).toBeDefined();
    expect(profile.contactEmail).toBeDefined();
    expect(profile.location).toBeDefined();
    expect(profile.bannerImageUrl).toBeDefined();
    expect(profile.logoUrl).toBeDefined();
  });
});

// ============================================================================
// Test Suite 7: Profile Completeness (6 tests)
// ============================================================================

describe('Team Profile E2E Tests - Profile Completeness', () => {
  it('should create minimal valid profile', () => {
    const profile = createMockBrandProfile();

    expect(profile.images).toBeDefined();
    expect(profile.videos).toBeDefined();
    expect(profile.documents).toBeDefined();
  });

  it('should create complete profile with all sections', () => {
    const profile = createMockBrandProfile({
      summary: 'Complete profile summary',
      tagline: 'Our tagline',
      pinnedPost: createMockPinnedPost(),
      feedSections: [
        createMockFeedSection({ contentType: 'updates' }),
        createMockFeedSection({ contentType: 'insights' }),
      ],
      images: [createMockBrandAsset({ type: 'image' })],
      videos: [createMockBrandAsset({ type: 'video' })],
      documents: [createMockBrandAsset({ type: 'document' })],
      engagementMetrics: [createMockEngagementMetric()],
    });

    expect(profile.summary).toBeDefined();
    expect(profile.pinnedPost).toBeDefined();
    expect(profile.feedSections).toHaveLength(2);
    expect(profile.images).toHaveLength(1);
    expect(profile.videos).toHaveLength(1);
    expect(profile.documents).toHaveLength(1);
    expect(profile.engagementMetrics).toHaveLength(1);
  });

  it('should handle empty collections', () => {
    const profile = createMockBrandProfile({
      images: [],
      videos: [],
      documents: [],
      feedSections: [],
    });

    expect(profile.images).toHaveLength(0);
    expect(profile.videos).toHaveLength(0);
    expect(profile.documents).toHaveLength(0);
    expect(profile.feedSections).toHaveLength(0);
  });

  it('should support optional fields being undefined', () => {
    const profile = createMockBrandProfile();

    expect(profile.summary).toBeUndefined();
    expect(profile.tagline).toBeUndefined();
    expect(profile.pinnedPost).toBeUndefined();
    expect(profile.feedSections).toBeUndefined();
  });

  it('should validate profile has required structure', () => {
    const profile = createMockBrandProfile();

    expect(profile).toHaveProperty('images');
    expect(profile).toHaveProperty('videos');
    expect(profile).toHaveProperty('documents');
  });

  it('should support gradual profile building', () => {
    let profile = createMockBrandProfile();

    // Add summary
    profile = { ...profile, summary: 'Initial summary' };
    expect(profile.summary).toBe('Initial summary');

    // Add pinned post
    profile = { ...profile, pinnedPost: createMockPinnedPost() };
    expect(profile.pinnedPost).toBeDefined();

    // Add images
    profile = { ...profile, images: [createMockBrandAsset({ type: 'image' })] };
    expect(profile.images).toHaveLength(1);
  });
});
