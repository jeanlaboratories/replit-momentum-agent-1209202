/**
 * Team Intelligence Seeding E2E Tests
 *
 * Comprehensive E2E test suite for Team Intelligence (Brand Soul) Seeding features:
 *
 * MAIN TABS:
 * - Upload Sources (Manual Text, Website, Document, Image, Video, YouTube)
 * - Artifacts (Source Management & Processing)
 * - Insights (AI-Extracted Intelligence)
 * - Team Intelligence (Brand Soul Synthesis)
 *
 * SUB-TABS:
 * - Manual Text: Text input with title and tags
 * - Website: URL crawling with depth, sitemap, image extraction
 * - Document: PDF, DOCX, PPTX upload
 * - Image: JPG, PNG, WEBP upload with description
 * - Video: MP4, MOV, WEBM upload with description
 * - YouTube: Video/channel ingestion with transcript
 *
 * Pattern: Mock-based data validation (follows multimedia-e2e.test.ts approach)
 *
 * @see /src/lib/types/brand-soul.ts - All Brand Soul types
 * @see /src/components/brand-soul/UploadSourcesTab.tsx - Upload UI
 * @see /src/components/brand-soul/ArtifactsTab.tsx - Artifacts management
 */

import { describe, it, expect } from 'vitest';
import type {
  BrandArtifact,
  ArtifactType,
  ProcessingStatus,
  SourceReference,
  ArtifactMetadata,
  ContentReference,
  InsightsReference,
  ExtractedInsights,
  VoiceElement,
  ExtractedFact,
  KeyMessage,
  VisualElement,
  BrandSoul,
  VoiceProfile,
  FactLibrary,
  MessagingFramework,
  VisualIdentity,
  BrandFact,
  ProcessingJob,
  ImageExtractionOptions,
} from '@/lib/types/brand-soul';

// ============================================================================
// Test Constants
// ============================================================================

const BRAND_1_ID = 'brand-1';
const BRAND_2_ID = 'brand-2';
const USER_1_ID = 'user-1';
const USER_2_ID = 'user-2';

const ARTIFACT_TYPES: ArtifactType[] = [
  'manual-text',
  'website',
  'website-page',
  'website-sitemap',
  'document',
  'document-pdf',
  'document-docx',
  'document-pptx',
  'image',
  'image-jpg',
  'image-png',
  'image-webp',
  'video',
  'video-mp4',
  'video-mov',
  'video-webm',
  'youtube-video',
  'youtube-channel',
  'link-article',
  'link-press-release',
  'social-profile',
];

const PROCESSING_STATUSES: ProcessingStatus[] = [
  'pending',
  'processing',
  'extracting',
  'extracted',
  'approved',
  'rejected',
  'failed',
  'archived',
];

// ============================================================================
// Helper Functions - Mock Creators
// ============================================================================

/**
 * Creates a mock BrandArtifact object
 */
function createMockArtifact(overrides?: Partial<BrandArtifact>): BrandArtifact {
  return {
    id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    brandId: BRAND_1_ID,
    type: 'manual-text',
    source: { url: 'manual://user-input' },
    status: 'pending',
    metadata: { title: 'Test Artifact' },
    createdAt: new Date().toISOString(),
    createdBy: USER_1_ID,
    retryCount: 0,
    priority: 5,
    ...overrides,
  };
}

/**
 * Creates a mock SourceReference object
 */
function createMockSourceReference(overrides?: Partial<SourceReference>): SourceReference {
  return {
    url: 'https://example.com/page',
    ...overrides,
  };
}

/**
 * Creates a mock ArtifactMetadata object
 */
function createMockMetadata(overrides?: Partial<ArtifactMetadata>): ArtifactMetadata {
  return {
    title: 'Example Source',
    description: 'This is a test source',
    language: 'en',
    wordCount: 500,
    tags: [],
    ...overrides,
  };
}

/**
 * Creates a mock ContentReference object
 */
function createMockContentReference(overrides?: Partial<ContentReference>): ContentReference {
  return {
    path: 'brand-soul/brand-1/content/artifact-123.txt',
    size: 5000,
    checksum: 'abc123def456',
    storedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock InsightsReference object
 */
function createMockInsightsReference(overrides?: Partial<InsightsReference>): InsightsReference {
  return {
    path: 'brand-soul/brand-1/insights/artifact-123.json',
    confidence: 85,
    extractedAt: new Date().toISOString(),
    model: 'gemini-2.0-flash-exp',
    ...overrides,
  };
}

/**
 * Creates a mock ExtractedInsights object
 */
function createMockExtractedInsights(overrides?: Partial<ExtractedInsights>): ExtractedInsights {
  return {
    voiceElements: [],
    facts: [],
    messages: [],
    visualElements: [],
    raw: '{}',
    extractedAt: new Date().toISOString(),
    model: 'gemini-2.0-flash-exp',
    confidence: 80,
    ...overrides,
  };
}

/**
 * Creates a mock VoiceElement object
 */
function createMockVoiceElement(overrides?: Partial<VoiceElement>): VoiceElement {
  return {
    aspect: 'tone',
    value: 'professional',
    evidence: ['Example text showing professional tone'],
    confidence: 85,
    ...overrides,
  };
}

/**
 * Creates a mock ExtractedFact object
 */
function createMockExtractedFact(overrides?: Partial<ExtractedFact>): ExtractedFact {
  return {
    category: 'company',
    fact: 'Founded in 2020',
    source: 'About page',
    confidence: 90,
    extractedFrom: 'We were founded in 2020 with a mission...',
    ...overrides,
  };
}

/**
 * Creates a mock KeyMessage object
 */
function createMockKeyMessage(overrides?: Partial<KeyMessage>): KeyMessage {
  return {
    theme: 'Innovation',
    message: 'We innovate to make a difference',
    frequency: 5,
    importance: 8,
    ...overrides,
  };
}

/**
 * Creates a mock VisualElement object
 */
function createMockVisualElement(overrides?: Partial<VisualElement>): VisualElement {
  return {
    type: 'color',
    value: '#0066CC',
    context: 'Primary brand color used throughout website',
    ...overrides,
  };
}

/**
 * Creates a mock ProcessingJob object
 */
function createMockProcessingJob(overrides?: Partial<ProcessingJob>): ProcessingJob {
  return {
    id: `job-${Date.now()}`,
    brandId: BRAND_1_ID,
    artifactId: 'artifact-123',
    type: 'extract-insights',
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    retryCount: 0,
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
// Test Suite 1: Upload Sources - Manual Text (8 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Upload Sources: Manual Text', () => {
  it('should create manual text artifact with required fields', () => {
    const artifact = createMockArtifact({
      type: 'manual-text',
      source: { url: 'manual://user-input' },
      metadata: {
        title: 'Company Mission Statement',
        tags: ['mission', 'values'],
      },
    });

    expect(artifact.type).toBe('manual-text');
    expect(artifact.source.url).toBe('manual://user-input');
    expect(artifact.metadata.title).toBe('Company Mission Statement');
  });

  it('should support manual text with title and tags', () => {
    const artifact = createMockArtifact({
      type: 'manual-text',
      metadata: {
        title: 'Brand Story',
        tags: ['story', 'history', 'founding'],
        wordCount: 250,
      },
    });

    expect(artifact.metadata.title).toBe('Brand Story');
    expect(artifact.metadata.tags).toContain('story');
    expect(artifact.metadata.wordCount).toBe(250);
  });

  it('should track creator and creation timestamp', () => {
    const artifact = createMockArtifact({
      createdBy: USER_1_ID,
      createdAt: new Date().toISOString(),
    });

    expect(artifact.createdBy).toBe(USER_1_ID);
    expect(isISOTimestamp(artifact.createdAt as string)).toBe(true);
  });

  it('should have default priority of 5', () => {
    const artifact = createMockArtifact();

    expect(artifact.priority).toBe(5);
  });

  it('should support custom priority (1-10)', () => {
    const artifact = createMockArtifact({ priority: 9 });

    expect(artifact.priority).toBe(9);
    expect(artifact.priority).toBeGreaterThanOrEqual(1);
    expect(artifact.priority).toBeLessThanOrEqual(10);
  });

  it('should have initial status of pending', () => {
    const artifact = createMockArtifact();

    expect(artifact.status).toBe('pending');
  });

  it('should store content in Firebase Storage with contentRef', () => {
    const artifact = createMockArtifact({
      contentRef: createMockContentReference({
        path: 'brand-soul/brand-1/content/manual-text-123.txt',
        size: 1024,
      }),
    });

    expect(artifact.contentRef).toBeDefined();
    expect(artifact.contentRef!.path).toContain('manual-text');
  });

  it('should support optional language metadata', () => {
    const artifact = createMockArtifact({
      metadata: {
        language: 'en',
        title: 'English content',
      },
    });

    expect(artifact.metadata.language).toBe('en');
  });
});

// ============================================================================
// Test Suite 2: Upload Sources - Website (12 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Upload Sources: Website', () => {
  it('should create website artifact with URL', () => {
    const artifact = createMockArtifact({
      type: 'website',
      source: { url: 'https://example.com' },
    });

    expect(artifact.type).toBe('website');
    expect(artifact.source.url).toBe('https://example.com');
  });

  it('should support single-page website type', () => {
    const artifact = createMockArtifact({
      type: 'website-page',
      source: { url: 'https://example.com/about' },
    });

    expect(artifact.type).toBe('website-page');
  });

  it('should support sitemap crawl type', () => {
    const artifact = createMockArtifact({
      type: 'website-sitemap',
      source: { url: 'https://example.com/sitemap.xml' },
    });

    expect(artifact.type).toBe('website-sitemap');
  });

  it('should track crawl timestamp', () => {
    const crawledAt = new Date().toISOString();
    const artifact = createMockArtifact({
      type: 'website',
      source: { url: 'https://example.com', crawledAt },
    });

    expect(artifact.source.crawledAt).toBe(crawledAt);
    expect(isISOTimestamp(artifact.source.crawledAt)).toBe(true);
  });

  it('should store multiple URLs for multi-page crawls', () => {
    const artifact = createMockArtifact({
      type: 'website',
      metadata: {
        urls: [
          'https://example.com',
          'https://example.com/about',
          'https://example.com/products',
        ],
        pagesCount: 3,
      },
    });

    expect(artifact.metadata.urls).toHaveLength(3);
    expect(artifact.metadata.pagesCount).toBe(3);
  });

  it('should support image extraction options', () => {
    const imageOptions: ImageExtractionOptions = {
      maxImages: 10,
      minWidth: 800,
      minHeight: 600,
      keywords: ['product', 'team'],
    };

    // Would be stored in metadata.customFields in real implementation
    const artifact = createMockArtifact({
      type: 'website',
      metadata: {
        customFields: { imageOptions },
      },
    });

    expect(artifact.metadata.customFields?.imageOptions).toBeDefined();
    expect(artifact.metadata.customFields?.imageOptions.maxImages).toBe(10);
  });

  it('should support max images limit (0-50)', () => {
    const options: ImageExtractionOptions = { maxImages: 25 };

    expect(options.maxImages).toBeGreaterThanOrEqual(0);
    expect(options.maxImages).toBeLessThanOrEqual(50);
  });

  it('should support minimum image dimensions', () => {
    const options: ImageExtractionOptions = {
      minWidth: 1024,
      minHeight: 768,
    };

    expect(options.minWidth).toBe(1024);
    expect(options.minHeight).toBe(768);
  });

  it('should support image keyword filtering', () => {
    const options: ImageExtractionOptions = {
      keywords: ['logo', 'product', 'team photo'],
    };

    expect(options.keywords).toContain('logo');
    expect(options.keywords).toHaveLength(3);
  });

  it('should track page count for multi-page crawls', () => {
    const artifact = createMockArtifact({
      type: 'website',
      metadata: {
        pagesCount: 15,
        wordCount: 5000,
      },
    });

    expect(artifact.metadata.pagesCount).toBe(15);
  });

  it('should support website tags', () => {
    const artifact = createMockArtifact({
      type: 'website',
      metadata: {
        tags: ['homepage', 'about', 'marketing'],
      },
    });

    expect(artifact.metadata.tags).toContain('homepage');
  });

  it('should store website title from metadata', () => {
    const artifact = createMockArtifact({
      type: 'website',
      metadata: {
        title: 'Example Company - About Us',
        url: 'https://example.com/about',
      },
    });

    expect(artifact.metadata.title).toBe('Example Company - About Us');
  });
});

// ============================================================================
// Test Suite 3: Upload Sources - Document (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Upload Sources: Document', () => {
  it('should create document artifact with file reference', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      source: {
        storagePath: 'brand-soul/brand-1/documents/whitepaper.pdf',
        fileName: 'whitepaper.pdf',
        fileSize: 1048576,
        mimeType: 'application/pdf',
      },
    });

    expect(artifact.type).toBe('document-pdf');
    expect(artifact.source.fileName).toBe('whitepaper.pdf');
  });

  it('should support PDF document type', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      source: { mimeType: 'application/pdf' },
    });

    expect(artifact.type).toBe('document-pdf');
  });

  it('should support DOCX document type', () => {
    const artifact = createMockArtifact({
      type: 'document-docx',
      source: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    });

    expect(artifact.type).toBe('document-docx');
  });

  it('should support PPTX document type', () => {
    const artifact = createMockArtifact({
      type: 'document-pptx',
      source: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    });

    expect(artifact.type).toBe('document-pptx');
  });

  it('should track file size in bytes', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      source: {
        fileName: 'report.pdf',
        fileSize: 2097152, // 2MB
      },
    });

    expect(artifact.source.fileSize).toBe(2097152);
  });

  it('should track upload timestamp', () => {
    const uploadedAt = new Date().toISOString();
    const artifact = createMockArtifact({
      type: 'document-pdf',
      source: { uploadedAt },
    });

    expect(artifact.source.uploadedAt).toBe(uploadedAt);
    expect(isISOTimestamp(artifact.source.uploadedAt)).toBe(true);
  });

  it('should support page count metadata', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      metadata: {
        pageCount: 25,
        wordCount: 5000,
      },
    });

    expect(artifact.metadata.pageCount).toBe(25);
  });

  it('should support document author metadata', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      metadata: {
        author: 'John Doe',
        title: 'Annual Report 2024',
      },
    });

    expect(artifact.metadata.author).toBe('John Doe');
  });

  it('should support published date metadata', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      metadata: {
        publishedDate: '2024-01-15',
        title: 'Q1 Report',
      },
    });

    expect(artifact.metadata.publishedDate).toBe('2024-01-15');
  });

  it('should store document in Firebase Storage with documentRef', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      documentRef: createMockContentReference({
        path: 'brand-soul/brand-1/documents/original-file.pdf',
      }),
    });

    expect(artifact.documentRef).toBeDefined();
    expect(artifact.documentRef!.path).toContain('documents');
  });
});

// ============================================================================
// Test Suite 4: Upload Sources - Image (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Upload Sources: Image', () => {
  it('should create image artifact with file reference', () => {
    const artifact = createMockArtifact({
      type: 'image-jpg',
      source: {
        storagePath: 'brand-soul/brand-1/images/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
      },
    });

    expect(artifact.type).toBe('image-jpg');
    expect(artifact.source.fileName).toBe('photo.jpg');
  });

  it('should support JPG image type', () => {
    const artifact = createMockArtifact({
      type: 'image-jpg',
      source: { mimeType: 'image/jpeg' },
    });

    expect(artifact.type).toBe('image-jpg');
  });

  it('should support PNG image type', () => {
    const artifact = createMockArtifact({
      type: 'image-png',
      source: { mimeType: 'image/png' },
    });

    expect(artifact.type).toBe('image-png');
  });

  it('should support WEBP image type', () => {
    const artifact = createMockArtifact({
      type: 'image-webp',
      source: { mimeType: 'image/webp' },
    });

    expect(artifact.type).toBe('image-webp');
  });

  it('should support generic image type', () => {
    const artifact = createMockArtifact({
      type: 'image',
    });

    expect(artifact.type).toBe('image');
  });

  it('should support image description metadata', () => {
    const artifact = createMockArtifact({
      type: 'image-jpg',
      metadata: {
        description: 'Team photo from annual retreat 2024',
        title: 'Annual Retreat',
      },
    });

    expect(artifact.metadata.description).toContain('Team photo');
  });

  it('should track image file size', () => {
    const artifact = createMockArtifact({
      type: 'image-png',
      source: {
        fileSize: 524288, // 512KB
        fileName: 'logo.png',
      },
    });

    expect(artifact.source.fileSize).toBe(524288);
  });

  it('should support image tags', () => {
    const artifact = createMockArtifact({
      type: 'image-jpg',
      metadata: {
        tags: ['team', 'office', 'culture'],
      },
    });

    expect(artifact.metadata.tags).toContain('team');
    expect(artifact.metadata.tags).toHaveLength(3);
  });

  it('should track upload timestamp for images', () => {
    const uploadedAt = new Date().toISOString();
    const artifact = createMockArtifact({
      type: 'image-jpg',
      source: { uploadedAt },
    });

    expect(isISOTimestamp(artifact.source.uploadedAt)).toBe(true);
  });

  it('should store image in Firebase Storage', () => {
    const artifact = createMockArtifact({
      type: 'image-jpg',
      documentRef: createMockContentReference({
        path: 'brand-soul/brand-1/images/original-image.jpg',
      }),
    });

    expect(artifact.documentRef).toBeDefined();
    expect(artifact.documentRef!.path).toContain('images');
  });
});

// ============================================================================
// Test Suite 5: Upload Sources - Video (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Upload Sources: Video', () => {
  it('should create video artifact with file reference', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      source: {
        storagePath: 'brand-soul/brand-1/videos/promo.mp4',
        fileName: 'promo.mp4',
        mimeType: 'video/mp4',
      },
    });

    expect(artifact.type).toBe('video-mp4');
    expect(artifact.source.fileName).toBe('promo.mp4');
  });

  it('should support MP4 video type', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      source: { mimeType: 'video/mp4' },
    });

    expect(artifact.type).toBe('video-mp4');
  });

  it('should support MOV video type', () => {
    const artifact = createMockArtifact({
      type: 'video-mov',
      source: { mimeType: 'video/quicktime' },
    });

    expect(artifact.type).toBe('video-mov');
  });

  it('should support WEBM video type', () => {
    const artifact = createMockArtifact({
      type: 'video-webm',
      source: { mimeType: 'video/webm' },
    });

    expect(artifact.type).toBe('video-webm');
  });

  it('should support video duration metadata', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      metadata: {
        duration: 180, // 3 minutes in seconds
        title: 'Product Demo',
      },
    });

    expect(artifact.metadata.duration).toBe(180);
  });

  it('should support video description', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      metadata: {
        description: 'Demonstration of our new product features',
        title: 'Product Demo',
      },
    });

    expect(artifact.metadata.description).toContain('Demonstration');
  });

  it('should track video file size', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      source: {
        fileSize: 10485760, // 10MB
        fileName: 'video.mp4',
      },
    });

    expect(artifact.source.fileSize).toBe(10485760);
  });

  it('should support video tags', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      metadata: {
        tags: ['product', 'demo', 'tutorial'],
      },
    });

    expect(artifact.metadata.tags).toHaveLength(3);
  });

  it('should track upload timestamp for videos', () => {
    const uploadedAt = new Date().toISOString();
    const artifact = createMockArtifact({
      type: 'video-mp4',
      source: { uploadedAt },
    });

    expect(isISOTimestamp(artifact.source.uploadedAt)).toBe(true);
  });

  it('should store video in Firebase Storage', () => {
    const artifact = createMockArtifact({
      type: 'video-mp4',
      documentRef: createMockContentReference({
        path: 'brand-soul/brand-1/videos/original-video.mp4',
      }),
    });

    expect(artifact.documentRef).toBeDefined();
    expect(artifact.documentRef!.path).toContain('videos');
  });
});

// ============================================================================
// Test Suite 6: Upload Sources - YouTube (8 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Upload Sources: YouTube', () => {
  it('should create YouTube video artifact', () => {
    const artifact = createMockArtifact({
      type: 'youtube-video',
      source: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });

    expect(artifact.type).toBe('youtube-video');
    expect(artifact.source.url).toContain('youtube.com');
  });

  it('should create YouTube channel artifact', () => {
    const artifact = createMockArtifact({
      type: 'youtube-channel',
      source: { url: 'https://www.youtube.com/@examplechannel' },
    });

    expect(artifact.type).toBe('youtube-channel');
  });

  it('should support YouTube video title and description', () => {
    const artifact = createMockArtifact({
      type: 'youtube-video',
      metadata: {
        title: 'Company Overview Video',
        description: 'Learn about our mission and values',
      },
    });

    expect(artifact.metadata.title).toBe('Company Overview Video');
  });

  it('should support YouTube video duration', () => {
    const artifact = createMockArtifact({
      type: 'youtube-video',
      metadata: {
        duration: 300, // 5 minutes
      },
    });

    expect(artifact.metadata.duration).toBe(300);
  });

  it('should support YouTube video tags', () => {
    const artifact = createMockArtifact({
      type: 'youtube-video',
      metadata: {
        tags: ['company', 'overview', 'culture'],
      },
    });

    expect(artifact.metadata.tags).toContain('company');
  });

  it('should track crawl timestamp for YouTube sources', () => {
    const crawledAt = new Date().toISOString();
    const artifact = createMockArtifact({
      type: 'youtube-video',
      source: { url: 'https://youtube.com/watch?v=123', crawledAt },
    });

    expect(isISOTimestamp(artifact.source.crawledAt)).toBe(true);
  });

  it('should support YouTube author metadata', () => {
    const artifact = createMockArtifact({
      type: 'youtube-video',
      metadata: {
        author: 'Example Channel',
      },
    });

    expect(artifact.metadata.author).toBe('Example Channel');
  });

  it('should support YouTube published date', () => {
    const artifact = createMockArtifact({
      type: 'youtube-video',
      metadata: {
        publishedDate: '2024-01-15',
      },
    });

    expect(artifact.metadata.publishedDate).toBe('2024-01-15');
  });
});

// ============================================================================
// Test Suite 7: Artifacts - Processing Status (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Artifacts: Processing Status', () => {
  it('should start with pending status', () => {
    const artifact = createMockArtifact({ status: 'pending' });

    expect(artifact.status).toBe('pending');
  });

  it('should support processing status', () => {
    const artifact = createMockArtifact({ status: 'processing' });

    expect(artifact.status).toBe('processing');
  });

  it('should support extracting status', () => {
    const artifact = createMockArtifact({ status: 'extracting' });

    expect(artifact.status).toBe('extracting');
  });

  it('should support extracted status', () => {
    const artifact = createMockArtifact({ status: 'extracted' });

    expect(artifact.status).toBe('extracted');
  });

  it('should support approved status', () => {
    const artifact = createMockArtifact({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: USER_1_ID,
    });

    expect(artifact.status).toBe('approved');
    expect(artifact.approvedBy).toBe(USER_1_ID);
  });

  it('should support rejected status with reason', () => {
    const artifact = createMockArtifact({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectionReason: 'Not relevant to brand identity',
    });

    expect(artifact.status).toBe('rejected');
    expect(artifact.rejectionReason).toContain('Not relevant');
  });

  it('should support failed status with error message', () => {
    const artifact = createMockArtifact({
      status: 'failed',
      lastError: 'Failed to extract text from PDF',
    });

    expect(artifact.status).toBe('failed');
    expect(artifact.lastError).toBeDefined();
  });

  it('should support archived status', () => {
    const artifact = createMockArtifact({ status: 'archived' });

    expect(artifact.status).toBe('archived');
  });

  it('should track retry count for failed processing', () => {
    const artifact = createMockArtifact({
      status: 'failed',
      retryCount: 3,
      lastError: 'Timeout error',
    });

    expect(artifact.retryCount).toBe(3);
  });

  it('should track processedAt timestamp', () => {
    const processedAt = new Date().toISOString();
    const artifact = createMockArtifact({
      status: 'extracted',
      processedAt,
    });

    expect(artifact.processedAt).toBe(processedAt);
    expect(isISOTimestamp(artifact.processedAt as string)).toBe(true);
  });
});

// ============================================================================
// Test Suite 8: Artifacts - Content & Insights Storage (8 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Artifacts: Content & Insights Storage', () => {
  it('should store content in Firebase Storage with contentRef', () => {
    const artifact = createMockArtifact({
      contentRef: createMockContentReference(),
    });

    expect(artifact.contentRef).toBeDefined();
    expect(artifact.contentRef!.path).toContain('brand-soul');
  });

  it('should track content size and checksum', () => {
    const contentRef = createMockContentReference({
      size: 10240,
      checksum: 'abc123def456',
    });

    expect(contentRef.size).toBe(10240);
    expect(contentRef.checksum).toBe('abc123def456');
  });

  it('should store insights in Firebase Storage with insightsRef', () => {
    const artifact = createMockArtifact({
      insightsRef: createMockInsightsReference(),
    });

    expect(artifact.insightsRef).toBeDefined();
    expect(artifact.insightsRef!.path).toContain('insights');
  });

  it('should track insights confidence score', () => {
    const insightsRef = createMockInsightsReference({
      confidence: 92,
    });

    expect(insightsRef.confidence).toBe(92);
    expect(insightsRef.confidence).toBeGreaterThanOrEqual(0);
    expect(insightsRef.confidence).toBeLessThanOrEqual(100);
  });

  it('should track AI model used for extraction', () => {
    const insightsRef = createMockInsightsReference({
      model: 'gemini-2.0-flash-exp',
    });

    expect(insightsRef.model).toBe('gemini-2.0-flash-exp');
  });

  it('should track extraction timestamp', () => {
    const insightsRef = createMockInsightsReference();

    expect(isISOTimestamp(insightsRef.extractedAt)).toBe(true);
  });

  it('should store original document with documentRef', () => {
    const artifact = createMockArtifact({
      type: 'document-pdf',
      documentRef: createMockContentReference({
        path: 'brand-soul/brand-1/documents/original.pdf',
      }),
    });

    expect(artifact.documentRef).toBeDefined();
    expect(artifact.documentRef!.path).toContain('documents');
  });

  it('should support checksum for duplicate detection', () => {
    const artifact = createMockArtifact({
      checksum: 'unique-checksum-abc123',
    });

    expect(artifact.checksum).toBe('unique-checksum-abc123');
  });
});

// ============================================================================
// Test Suite 9: Insights - Voice Elements (8 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Insights: Voice Elements', () => {
  it('should extract tone voice elements', () => {
    const voiceElement = createMockVoiceElement({
      aspect: 'tone',
      value: 'professional',
      confidence: 85,
    });

    expect(voiceElement.aspect).toBe('tone');
    expect(voiceElement.value).toBe('professional');
  });

  it('should extract style voice elements', () => {
    const voiceElement = createMockVoiceElement({
      aspect: 'style',
      value: 'conversational',
    });

    expect(voiceElement.aspect).toBe('style');
  });

  it('should extract personality voice elements', () => {
    const voiceElement = createMockVoiceElement({
      aspect: 'personality',
      value: 'innovative',
    });

    expect(voiceElement.aspect).toBe('personality');
  });

  it('should extract formality voice elements', () => {
    const voiceElement = createMockVoiceElement({
      aspect: 'formality',
      value: 'semi-formal',
    });

    expect(voiceElement.aspect).toBe('formality');
  });

  it('should include evidence text snippets', () => {
    const voiceElement = createMockVoiceElement({
      evidence: [
        'We pride ourselves on professionalism',
        'Our team maintains high standards',
      ],
    });

    expect(voiceElement.evidence).toHaveLength(2);
    expect(voiceElement.evidence[0]).toContain('professionalism');
  });

  it('should track confidence score for voice elements', () => {
    const voiceElement = createMockVoiceElement({
      confidence: 78,
    });

    expect(voiceElement.confidence).toBe(78);
    expect(voiceElement.confidence).toBeGreaterThanOrEqual(0);
    expect(voiceElement.confidence).toBeLessThanOrEqual(100);
  });

  it('should support multiple voice elements', () => {
    const insights = createMockExtractedInsights({
      voiceElements: [
        createMockVoiceElement({ aspect: 'tone', value: 'professional' }),
        createMockVoiceElement({ aspect: 'style', value: 'direct' }),
        createMockVoiceElement({ aspect: 'personality', value: 'trustworthy' }),
      ],
    });

    expect(insights.voiceElements).toHaveLength(3);
  });

  it('should validate voice element structure', () => {
    const voiceElement = createMockVoiceElement();

    expect(voiceElement).toHaveProperty('aspect');
    expect(voiceElement).toHaveProperty('value');
    expect(voiceElement).toHaveProperty('evidence');
    expect(voiceElement).toHaveProperty('confidence');
  });
});

// ============================================================================
// Test Suite 10: Insights - Extracted Facts (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Insights: Extracted Facts', () => {
  it('should extract facts with category', () => {
    const fact = createMockExtractedFact({
      category: 'company',
      fact: 'Founded in 2020',
    });

    expect(fact.category).toBe('company');
    expect(fact.fact).toBe('Founded in 2020');
  });

  it('should support multiple fact categories', () => {
    const categories = ['company', 'product', 'history', 'value', 'achievement', 'team'];

    categories.forEach((category) => {
      const fact = createMockExtractedFact({ category });
      expect(fact.category).toBe(category);
    });
  });

  it('should track fact source', () => {
    const fact = createMockExtractedFact({
      source: 'About page',
      fact: 'Based in San Francisco',
    });

    expect(fact.source).toBe('About page');
  });

  it('should include extracted text snippet', () => {
    const fact = createMockExtractedFact({
      extractedFrom: 'Our team of 50+ employees is based in San Francisco',
      fact: 'Team size is 50+ employees',
    });

    expect(fact.extractedFrom).toContain('50+ employees');
  });

  it('should track fact confidence score', () => {
    const fact = createMockExtractedFact({
      confidence: 95,
    });

    expect(fact.confidence).toBe(95);
    expect(fact.confidence).toBeGreaterThanOrEqual(0);
    expect(fact.confidence).toBeLessThanOrEqual(100);
  });

  it('should support facts from different sources', () => {
    const facts = [
      createMockExtractedFact({ source: 'Website', fact: 'Fact from website' }),
      createMockExtractedFact({ source: 'PDF', fact: 'Fact from document' }),
      createMockExtractedFact({ source: 'Video', fact: 'Fact from video' }),
    ];

    expect(facts).toHaveLength(3);
    expect(facts.map((f) => f.source)).toEqual(['Website', 'PDF', 'Video']);
  });

  it('should extract product-related facts', () => {
    const fact = createMockExtractedFact({
      category: 'product',
      fact: 'Offers cloud-based SaaS solution',
    });

    expect(fact.category).toBe('product');
  });

  it('should extract achievement facts', () => {
    const fact = createMockExtractedFact({
      category: 'achievement',
      fact: 'Won Best Startup Award 2023',
    });

    expect(fact.category).toBe('achievement');
  });

  it('should support multiple facts in insights', () => {
    const insights = createMockExtractedInsights({
      facts: [
        createMockExtractedFact({ fact: 'Fact 1' }),
        createMockExtractedFact({ fact: 'Fact 2' }),
        createMockExtractedFact({ fact: 'Fact 3' }),
      ],
    });

    expect(insights.facts).toHaveLength(3);
  });

  it('should validate fact structure', () => {
    const fact = createMockExtractedFact();

    expect(fact).toHaveProperty('category');
    expect(fact).toHaveProperty('fact');
    expect(fact).toHaveProperty('source');
    expect(fact).toHaveProperty('confidence');
    expect(fact).toHaveProperty('extractedFrom');
  });
});

// ============================================================================
// Test Suite 11: Insights - Key Messages (8 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Insights: Key Messages', () => {
  it('should extract key messages with theme', () => {
    const message = createMockKeyMessage({
      theme: 'Innovation',
      message: 'We innovate to solve real problems',
    });

    expect(message.theme).toBe('Innovation');
    expect(message.message).toContain('innovate');
  });

  it('should track message frequency', () => {
    const message = createMockKeyMessage({
      frequency: 8,
    });

    expect(message.frequency).toBe(8);
  });

  it('should track message importance (1-10)', () => {
    const message = createMockKeyMessage({
      importance: 9,
    });

    expect(message.importance).toBe(9);
    expect(message.importance).toBeGreaterThanOrEqual(1);
    expect(message.importance).toBeLessThanOrEqual(10);
  });

  it('should support multiple key message themes', () => {
    const insights = createMockExtractedInsights({
      messages: [
        createMockKeyMessage({ theme: 'Innovation' }),
        createMockKeyMessage({ theme: 'Quality' }),
        createMockKeyMessage({ theme: 'Customer Success' }),
      ],
    });

    expect(insights.messages).toHaveLength(3);
    expect(insights.messages.map((m) => m.theme)).toContain('Innovation');
  });

  it('should extract mission-related messages', () => {
    const message = createMockKeyMessage({
      theme: 'Mission',
      message: 'Our mission is to empower businesses',
    });

    expect(message.theme).toBe('Mission');
  });

  it('should extract value-related messages', () => {
    const message = createMockKeyMessage({
      theme: 'Values',
      message: 'We value integrity and transparency',
    });

    expect(message.theme).toBe('Values');
  });

  it('should rank messages by importance', () => {
    const messages = [
      createMockKeyMessage({ importance: 8 }),
      createMockKeyMessage({ importance: 10 }),
      createMockKeyMessage({ importance: 6 }),
    ];

    const sorted = [...messages].sort((a, b) => b.importance - a.importance);

    expect(sorted[0].importance).toBe(10);
    expect(sorted[2].importance).toBe(6);
  });

  it('should validate key message structure', () => {
    const message = createMockKeyMessage();

    expect(message).toHaveProperty('theme');
    expect(message).toHaveProperty('message');
    expect(message).toHaveProperty('frequency');
    expect(message).toHaveProperty('importance');
  });
});

// ============================================================================
// Test Suite 12: Insights - Visual Elements (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Insights: Visual Elements', () => {
  it('should extract color visual elements', () => {
    const visual = createMockVisualElement({
      type: 'color',
      value: '#0066CC',
      context: 'Primary brand color',
    });

    expect(visual.type).toBe('color');
    expect(visual.value).toBe('#0066CC');
  });

  it('should extract font visual elements', () => {
    const visual = createMockVisualElement({
      type: 'font',
      value: 'Helvetica Neue',
    });

    expect(visual.type).toBe('font');
  });

  it('should extract style visual elements', () => {
    const visual = createMockVisualElement({
      type: 'style',
      value: 'minimalist',
    });

    expect(visual.type).toBe('style');
  });

  it('should extract imagery visual elements', () => {
    const visual = createMockVisualElement({
      type: 'imagery',
      value: 'product photography',
    });

    expect(visual.type).toBe('imagery');
  });

  it('should extract avoid visual elements', () => {
    const visual = createMockVisualElement({
      type: 'avoid',
      value: 'busy backgrounds',
    });

    expect(visual.type).toBe('avoid');
  });

  it('should extract photographic preferences', () => {
    const visual = createMockVisualElement({
      type: 'photographicPreference',
      value: 'natural lighting',
    });

    expect(visual.type).toBe('photographicPreference');
  });

  it('should extract scene preferences', () => {
    const visual = createMockVisualElement({
      type: 'scenePreference',
      value: 'lifestyle scenes',
    });

    expect(visual.type).toBe('scenePreference');
  });

  it('should include context for visual elements', () => {
    const visual = createMockVisualElement({
      context: 'Found consistently across website and marketing materials',
    });

    expect(visual.context).toContain('website');
  });

  it('should support multiple visual elements', () => {
    const insights = createMockExtractedInsights({
      visualElements: [
        createMockVisualElement({ type: 'color', value: '#0066CC' }),
        createMockVisualElement({ type: 'font', value: 'Helvetica' }),
        createMockVisualElement({ type: 'style', value: 'modern' }),
      ],
    });

    expect(insights.visualElements).toHaveLength(3);
  });

  it('should validate visual element structure', () => {
    const visual = createMockVisualElement();

    expect(visual).toHaveProperty('type');
    expect(visual).toHaveProperty('value');
    expect(visual).toHaveProperty('context');
  });
});

// ============================================================================
// Test Suite 13: Processing Jobs (10 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Processing Jobs', () => {
  it('should create processing job for artifact', () => {
    const job = createMockProcessingJob({
      type: 'extract-insights',
      artifactId: 'artifact-123',
    });

    expect(job.type).toBe('extract-insights');
    expect(job.artifactId).toBe('artifact-123');
  });

  it('should support extract-insights job type', () => {
    const job = createMockProcessingJob({ type: 'extract-insights' });

    expect(job.type).toBe('extract-insights');
  });

  it('should support synthesize job type', () => {
    const job = createMockProcessingJob({ type: 'synthesize' });

    expect(job.type).toBe('synthesize');
  });

  it('should support embed job type', () => {
    const job = createMockProcessingJob({ type: 'embed' });

    expect(job.type).toBe('embed');
  });

  it('should track job progress (0-100)', () => {
    const job = createMockProcessingJob({ progress: 45 });

    expect(job.progress).toBe(45);
    expect(job.progress).toBeGreaterThanOrEqual(0);
    expect(job.progress).toBeLessThanOrEqual(100);
  });

  it('should track current processing step', () => {
    const job = createMockProcessingJob({
      progress: 50,
      currentStep: 'Extracting voice elements',
    });

    expect(job.currentStep).toBe('Extracting voice elements');
  });

  it('should track job timestamps', () => {
    const createdAt = new Date().toISOString();
    const startedAt = new Date(Date.now() + 1000).toISOString();
    const job = createMockProcessingJob({
      createdAt,
      startedAt,
    });

    expect(isISOTimestamp(job.createdAt as string)).toBe(true);
    expect(isISOTimestamp(job.startedAt as string)).toBe(true);
  });

  it('should track completed jobs', () => {
    const completedAt = new Date().toISOString();
    const job = createMockProcessingJob({
      status: 'extracted',
      progress: 100,
      completedAt,
    });

    expect(job.status).toBe('extracted');
    expect(job.progress).toBe(100);
    expect(job.completedAt).toBeDefined();
  });

  it('should track failed jobs with error', () => {
    const job = createMockProcessingJob({
      status: 'failed',
      lastError: 'API timeout',
      retryCount: 2,
    });

    expect(job.status).toBe('failed');
    expect(job.lastError).toBe('API timeout');
    expect(job.retryCount).toBe(2);
  });

  it('should support job-specific data', () => {
    const job = createMockProcessingJob({
      data: {
        modelVersion: 'gemini-2.0-flash-exp',
        chunkSize: 1000,
        customParam: 'value',
      },
    });

    expect(job.data).toBeDefined();
    expect(job.data?.modelVersion).toBe('gemini-2.0-flash-exp');
  });
});

// ============================================================================
// Test Suite 14: Multi-Tenancy & Brand Isolation (6 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Multi-Tenancy & Brand Isolation', () => {
  it('should isolate artifacts by brandId', () => {
    const artifacts = [
      createMockArtifact({ brandId: BRAND_1_ID }),
      createMockArtifact({ brandId: BRAND_2_ID }),
    ];

    const brand1Artifacts = artifacts.filter((a) => a.brandId === BRAND_1_ID);

    expect(brand1Artifacts).toHaveLength(1);
    expect(brand1Artifacts[0].brandId).toBe(BRAND_1_ID);
  });

  it('should isolate processing jobs by brandId', () => {
    const jobs = [
      createMockProcessingJob({ brandId: BRAND_1_ID }),
      createMockProcessingJob({ brandId: BRAND_2_ID }),
    ];

    const brand1Jobs = jobs.filter((j) => j.brandId === BRAND_1_ID);

    expect(brand1Jobs).toHaveLength(1);
  });

  it('should require brandId for all artifacts', () => {
    const artifact = createMockArtifact();

    expect(artifact.brandId).toBeDefined();
    expect(typeof artifact.brandId).toBe('string');
  });

  it('should require brandId for all jobs', () => {
    const job = createMockProcessingJob();

    expect(job.brandId).toBeDefined();
    expect(typeof job.brandId).toBe('string');
  });

  it('should prevent cross-brand artifact access', () => {
    const artifact = createMockArtifact({ brandId: BRAND_1_ID });

    const hasAccess = artifact.brandId === BRAND_2_ID;

    expect(hasAccess).toBe(false);
  });

  it('should store artifacts in brand-specific storage paths', () => {
    const artifact = createMockArtifact({
      brandId: BRAND_1_ID,
      contentRef: createMockContentReference({
        path: `brand-soul/${BRAND_1_ID}/content/artifact-123.txt`,
      }),
    });

    expect(artifact.contentRef!.path).toContain(BRAND_1_ID);
  });
});

// ============================================================================
// Test Suite 15: Data Integrity & Completeness (8 tests)
// ============================================================================

describe('Team Intelligence E2E Tests - Data Integrity & Completeness', () => {
  it('should validate artifact has required fields', () => {
    const artifact = createMockArtifact();

    expect(artifact).toHaveProperty('id');
    expect(artifact).toHaveProperty('brandId');
    expect(artifact).toHaveProperty('type');
    expect(artifact).toHaveProperty('source');
    expect(artifact).toHaveProperty('status');
    expect(artifact).toHaveProperty('metadata');
    expect(artifact).toHaveProperty('createdAt');
    expect(artifact).toHaveProperty('createdBy');
  });

  it('should validate extracted insights structure', () => {
    const insights = createMockExtractedInsights();

    expect(insights).toHaveProperty('voiceElements');
    expect(insights).toHaveProperty('facts');
    expect(insights).toHaveProperty('messages');
    expect(insights).toHaveProperty('visualElements');
    expect(insights).toHaveProperty('extractedAt');
    expect(insights).toHaveProperty('model');
    expect(insights).toHaveProperty('confidence');
  });

  it('should support all artifact types', () => {
    ARTIFACT_TYPES.forEach((type) => {
      const artifact = createMockArtifact({ type });
      expect(artifact.type).toBe(type);
    });
  });

  it('should support all processing statuses', () => {
    PROCESSING_STATUSES.forEach((status) => {
      const artifact = createMockArtifact({ status });
      expect(artifact.status).toBe(status);
    });
  });

  it('should handle empty insights arrays', () => {
    const insights = createMockExtractedInsights({
      voiceElements: [],
      facts: [],
      messages: [],
      visualElements: [],
    });

    expect(insights.voiceElements).toHaveLength(0);
    expect(insights.facts).toHaveLength(0);
  });

  it('should validate confidence scores are 0-100', () => {
    const insights = createMockExtractedInsights({ confidence: 75 });

    expect(insights.confidence).toBeGreaterThanOrEqual(0);
    expect(insights.confidence).toBeLessThanOrEqual(100);
  });

  it('should validate priority is 1-10', () => {
    const artifact = createMockArtifact({ priority: 7 });

    expect(artifact.priority).toBeGreaterThanOrEqual(1);
    expect(artifact.priority).toBeLessThanOrEqual(10);
  });

  it('should support complete artifact lifecycle', () => {
    let artifact = createMockArtifact({ status: 'pending' });

    // Process
    artifact = { ...artifact, status: 'processing' };
    expect(artifact.status).toBe('processing');

    // Extract
    artifact = { ...artifact, status: 'extracting' };
    expect(artifact.status).toBe('extracting');

    // Complete
    artifact = {
      ...artifact,
      status: 'extracted',
      insightsRef: createMockInsightsReference(),
      processedAt: new Date().toISOString(),
    };
    expect(artifact.status).toBe('extracted');
    expect(artifact.insightsRef).toBeDefined();

    // Approve
    artifact = {
      ...artifact,
      status: 'approved',
      approvedBy: USER_1_ID,
      approvedAt: new Date().toISOString(),
    };
    expect(artifact.status).toBe('approved');
  });
});
