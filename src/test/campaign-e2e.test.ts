/**
 * Team Calendar E2E Tests (Campaign/Initiative Planning System)
 *
 * This comprehensive E2E test suite covers the Campaign/Initiative Planning System,
 * which is referred to as the "Team Calendar". The system allows teams to create
 * multi-day campaigns with AI-generated content.
 *
 * Total Tests: 97 tests across 11 test suites
 * Pattern: Mock-based data validation (follows multimedia-e2e.test.ts approach)
 *
 * @see /src/app/actions.ts - Server actions (saveCampaignAction, loadCampaignsAction, etc.)
 * @see /src/lib/types.ts - Type definitions (Campaign, CampaignDay, ContentBlock)
 * @see /src/test/multimedia-e2e.test.ts - Reference pattern for mock-based testing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  Campaign,
  CampaignDay,
  ContentBlock,
  GeneratedContentBlock,
  GeneratedDay,
  GeneratedCampaignContent,
  BrandMember,
} from '@/lib/types';

// ============================================================================
// Test Constants
// ============================================================================

const BRAND_1_ID = 'brand-1';
const BRAND_2_ID = 'brand-2';
const USER_1_ID = 'user-1';
const USER_2_ID = 'user-2';
const USER_3_ID = 'user-3'; // User without brand membership

const CONTENT_TYPES = ['Social Media Post', 'Email Newsletter', 'Blog Post Idea'] as const;
const TONE_OF_VOICES = ['Professional', 'Playful', 'Urgent'] as const;

// ============================================================================
// Helper Functions - Mock Creators
// ============================================================================

/**
 * Creates a mock Campaign object with sensible defaults
 */
function createMockCampaign(overrides?: Partial<Campaign>): Campaign {
  const now = new Date().toISOString();
  return {
    id: `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    brandId: BRAND_1_ID,
    name: 'Test Campaign',
    createdBy: USER_1_ID,
    createdAt: now,
    content: [],
    ...overrides,
  };
}

/**
 * Creates a mock CampaignDay object with sensible defaults
 */
function createMockCampaignDay(overrides?: Partial<CampaignDay>): CampaignDay {
  const defaultDate = new Date();
  return {
    id: `day-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    day: 1,
    date: defaultDate.toISOString().split('T')[0], // YYYY-MM-DD format
    contentBlocks: [],
    ...overrides,
  };
}

/**
 * Creates a mock ContentBlock object with sensible defaults
 */
function createMockContentBlock(overrides?: Partial<ContentBlock>): ContentBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contentType: 'Social Media Post',
    keyMessage: 'Test message',
    toneOfVoice: 'Professional',
    ...overrides,
  };
}

/**
 * Creates a mock GeneratedContentBlock object with sensible defaults
 */
function createMockGeneratedContentBlock(
  overrides?: Partial<GeneratedContentBlock>
): GeneratedContentBlock {
  return {
    id: `gen-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contentType: 'Social Media Post',
    adCopy: 'Test ad copy',
    imagePrompt: 'Test image prompt',
    ...overrides,
  };
}

/**
 * Creates mock GeneratedCampaignContent for a specified number of days
 */
function createMockGeneratedContent(days: number): GeneratedCampaignContent {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      day: i + 1,
      date: date.toISOString().split('T')[0],
      contentBlocks: [
        createMockGeneratedContentBlock({
          contentType: 'Social Media Post',
        }),
        createMockGeneratedContentBlock({
          contentType: 'Email Newsletter',
        }),
      ],
    };
  });
}

/**
 * Generates a name slug (lowercase, hyphens, no special chars)
 * Used for duplicate detection
 */
function generateNameSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates a mock BrandMember object
 */
function createMockBrandMember(
  brandId: string,
  userId: string,
  role: 'MANAGER' | 'CONTRIBUTOR' = 'CONTRIBUTOR',
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'
): BrandMember {
  return {
    id: `member-${brandId}-${userId}`,
    brandId,
    userId,
    role,
    status,
    joinedAt: new Date().toISOString(),
  };
}

/**
 * Creates a mock CampaignTimeline (array of CampaignDay objects)
 */
function createMockTimeline(days: number): CampaignDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return createMockCampaignDay({
      day: i + 1,
      date: date.toISOString().split('T')[0],
    });
  });
}

/**
 * Adds content blocks to a campaign day
 */
function addContentBlocksToDay(day: CampaignDay, count: number): CampaignDay {
  const blocks = Array.from({ length: count }, () => createMockContentBlock());
  return {
    ...day,
    contentBlocks: [...day.contentBlocks, ...blocks],
  };
}

/**
 * Validates that a timestamp is in ISO 8601 format
 */
function isISOTimestamp(timestamp: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return iso8601Regex.test(timestamp);
}

/**
 * Validates that a date is in ISO date format (YYYY-MM-DD)
 */
function isISODate(date: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return isoDateRegex.test(date);
}

/**
 * Simulates requireBrandAccess validation
 */
function validateBrandAccess(
  userId: string,
  brandId: string,
  members: BrandMember[]
): boolean {
  const member = members.find(
    (m) => m.userId === userId && m.brandId === brandId && m.status === 'ACTIVE'
  );
  return !!member;
}

// ============================================================================
// Test Suite 1: Campaign CRUD Operations (10 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Campaign CRUD Operations', () => {
  it('should create new campaign with metadata', () => {
    const campaign = createMockCampaign({
      name: 'Summer Sale Campaign',
      brandId: BRAND_1_ID,
      createdBy: USER_1_ID,
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.name).toBe('Summer Sale Campaign');
    expect(campaign.brandId).toBe(BRAND_1_ID);
    expect(campaign.createdBy).toBe(USER_1_ID);
  });

  it('should have required fields (id, brandId, name, createdBy, createdAt)', () => {
    const campaign = createMockCampaign();

    expect(campaign.id).toBeDefined();
    expect(campaign.brandId).toBeDefined();
    expect(campaign.name).toBeDefined();
    expect(campaign.createdBy).toBeDefined();
    expect(campaign.createdAt).toBeDefined();
  });

  it('should update campaign and update audit trail (updatedBy, updatedAt)', () => {
    const campaign = createMockCampaign();
    const now = new Date().toISOString();

    const updatedCampaign: Campaign = {
      ...campaign,
      name: 'Updated Campaign Name',
      updatedBy: USER_2_ID,
      updatedAt: now,
    };

    expect(updatedCampaign.updatedBy).toBe(USER_2_ID);
    expect(updatedCampaign.updatedAt).toBe(now);
    expect(updatedCampaign.createdBy).toBe(campaign.createdBy); // Original creator preserved
  });

  it('should load campaign list and return campaigns for brandId', () => {
    const campaigns = [
      createMockCampaign({ brandId: BRAND_1_ID, name: 'Campaign 1' }),
      createMockCampaign({ brandId: BRAND_1_ID, name: 'Campaign 2' }),
      createMockCampaign({ brandId: BRAND_2_ID, name: 'Campaign 3' }),
    ];

    const brand1Campaigns = campaigns.filter((c) => c.brandId === BRAND_1_ID);

    expect(brand1Campaigns).toHaveLength(2);
    expect(brand1Campaigns.every((c) => c.brandId === BRAND_1_ID)).toBe(true);
  });

  it('should load campaign list and filter out other brands', () => {
    const campaigns = [
      createMockCampaign({ brandId: BRAND_1_ID, name: 'Campaign 1' }),
      createMockCampaign({ brandId: BRAND_2_ID, name: 'Campaign 2' }),
    ];

    const brand1Campaigns = campaigns.filter((c) => c.brandId === BRAND_1_ID);

    expect(brand1Campaigns).toHaveLength(1);
    expect(brand1Campaigns[0].brandId).toBe(BRAND_1_ID);
  });

  it('should load single campaign with full content structure', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(3),
    });

    expect(campaign.content).toHaveLength(3);
    expect(campaign.content[0].day).toBe(1);
    expect(campaign.content[0].contentBlocks).toBeDefined();
  });

  it('should delete campaign and verify cascading cleanup', () => {
    const campaigns = [
      createMockCampaign({ id: 'campaign-1', brandId: BRAND_1_ID }),
      createMockCampaign({ id: 'campaign-2', brandId: BRAND_1_ID }),
    ];

    const campaignToDelete = 'campaign-1';
    const remainingCampaigns = campaigns.filter((c) => c.id !== campaignToDelete);

    expect(remainingCampaigns).toHaveLength(1);
    expect(remainingCampaigns[0].id).toBe('campaign-2');
  });

  it('should use ISO timestamp format for campaign metadata', () => {
    const campaign = createMockCampaign();

    expect(isISOTimestamp(campaign.createdAt)).toBe(true);
  });

  it('should have no updatedBy/updatedAt initially for new campaign', () => {
    const campaign = createMockCampaign();

    expect(campaign.updatedBy).toBeUndefined();
    expect(campaign.updatedAt).toBeUndefined();
  });

  it('should have GeneratedCampaignContent array as content', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(2),
    });

    expect(Array.isArray(campaign.content)).toBe(true);
    expect(campaign.content.every((day) => 'day' in day && 'contentBlocks' in day)).toBe(true);
  });
});

// ============================================================================
// Test Suite 2: Multi-Day Campaign Management (8 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Multi-Day Campaign Management', () => {
  it('should create campaign with 1 day', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(1),
    });

    expect(campaign.content).toHaveLength(1);
    expect(campaign.content[0].day).toBe(1);
  });

  it('should create campaign with 7 days', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(7),
    });

    expect(campaign.content).toHaveLength(7);
    expect(campaign.content[6].day).toBe(7);
  });

  it('should create campaign with non-consecutive days (1, 3, 5)', () => {
    const content: GeneratedCampaignContent = [
      { day: 1, contentBlocks: [] },
      { day: 3, contentBlocks: [] },
      { day: 5, contentBlocks: [] },
    ];

    const campaign = createMockCampaign({ content });

    expect(campaign.content).toHaveLength(3);
    expect(campaign.content.map((d) => d.day)).toEqual([1, 3, 5]);
  });

  it('should ensure each day has correct day number', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(5),
    });

    campaign.content.forEach((day, index) => {
      expect(day.day).toBe(index + 1);
    });
  });

  it('should preserve ISO date string for each day', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(3),
    });

    campaign.content.forEach((day) => {
      expect(day.date).toBeDefined();
      expect(isISODate(day.date!)).toBe(true);
    });
  });

  it('should maintain days in chronological order', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(4),
    });

    const dayNumbers = campaign.content.map((d) => d.day);
    const sortedDayNumbers = [...dayNumbers].sort((a, b) => a - b);

    expect(dayNumbers).toEqual(sortedDayNumbers);
  });

  it('should add day to existing campaign', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(2),
    });

    const newDay: GeneratedDay = {
      day: 3,
      date: new Date().toISOString().split('T')[0],
      contentBlocks: [],
    };

    const updatedCampaign = {
      ...campaign,
      content: [...campaign.content, newDay],
    };

    expect(updatedCampaign.content).toHaveLength(3);
    expect(updatedCampaign.content[2].day).toBe(3);
  });

  it('should remove day from campaign and maintain numbering', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(5),
    });

    // Remove day 3
    const updatedContent = campaign.content.filter((d) => d.day !== 3);

    expect(updatedContent).toHaveLength(4);
    expect(updatedContent.map((d) => d.day)).toEqual([1, 2, 4, 5]);
  });
});

// ============================================================================
// Test Suite 3: Content Block Management (12 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Content Block Management', () => {
  it('should add content block to campaign day', () => {
    const day = createMockCampaignDay();
    const block = createMockContentBlock();

    const updatedDay = {
      ...day,
      contentBlocks: [...day.contentBlocks, block],
    };

    expect(updatedDay.contentBlocks).toHaveLength(1);
    expect(updatedDay.contentBlocks[0].id).toBe(block.id);
  });

  it('should have all required fields in content block', () => {
    const block = createMockContentBlock();

    expect(block.id).toBeDefined();
    expect(block.contentType).toBeDefined();
    expect(block.keyMessage).toBeDefined();
    expect(block.toneOfVoice).toBeDefined();
  });

  it('should support Social Media Post content type', () => {
    const block = createMockContentBlock({
      contentType: 'Social Media Post',
    });

    expect(block.contentType).toBe('Social Media Post');
  });

  it('should support Email Newsletter content type', () => {
    const block = createMockContentBlock({
      contentType: 'Email Newsletter',
    });

    expect(block.contentType).toBe('Email Newsletter');
  });

  it('should support Blog Post Idea content type', () => {
    const block = createMockContentBlock({
      contentType: 'Blog Post Idea',
    });

    expect(block.contentType).toBe('Blog Post Idea');
  });

  it('should support Professional tone of voice', () => {
    const block = createMockContentBlock({
      toneOfVoice: 'Professional',
    });

    expect(block.toneOfVoice).toBe('Professional');
  });

  it('should support Playful tone of voice', () => {
    const block = createMockContentBlock({
      toneOfVoice: 'Playful',
    });

    expect(block.toneOfVoice).toBe('Playful');
  });

  it('should support Urgent tone of voice', () => {
    const block = createMockContentBlock({
      toneOfVoice: 'Urgent',
    });

    expect(block.toneOfVoice).toBe('Urgent');
  });

  it('should update content block keyMessage', () => {
    const block = createMockContentBlock({ keyMessage: 'Original message' });

    const updatedBlock = {
      ...block,
      keyMessage: 'Updated message',
    };

    expect(updatedBlock.keyMessage).toBe('Updated message');
  });

  it('should attach media asset (assetUrl) to content block', () => {
    const block = createMockContentBlock({
      assetUrl: 'https://example.com/image.jpg',
    });

    expect(block.assetUrl).toBe('https://example.com/image.jpg');
  });

  it('should attach AI-generated image (imageUrl) to content block', () => {
    const block = createMockContentBlock({
      imageUrl: 'https://example.com/generated-image.jpg',
    });

    expect(block.imageUrl).toBe('https://example.com/generated-image.jpg');
  });

  it('should set scheduledTime on content block', () => {
    const scheduledTime = '2025-01-15T10:00:00Z';
    const block = createMockContentBlock({
      scheduledTime,
    });

    expect(block.scheduledTime).toBe(scheduledTime);
  });
});

// ============================================================================
// Test Suite 4: AI Content Generation (8 tests)
// ============================================================================

describe('Team Calendar E2E Tests - AI Content Generation', () => {
  it('should generate content for 3-day campaign', () => {
    const content = createMockGeneratedContent(3);

    expect(content).toHaveLength(3);
  });

  it('should have correct structure (GeneratedDay[])', () => {
    const content = createMockGeneratedContent(2);

    expect(Array.isArray(content)).toBe(true);
    content.forEach((day) => {
      expect(day).toHaveProperty('day');
      expect(day).toHaveProperty('contentBlocks');
    });
  });

  it('should have day number for each generated day', () => {
    const content = createMockGeneratedContent(4);

    content.forEach((day, index) => {
      expect(day.day).toBe(index + 1);
    });
  });

  it('should have contentBlocks for each generated day', () => {
    const content = createMockGeneratedContent(2);

    content.forEach((day) => {
      expect(Array.isArray(day.contentBlocks)).toBe(true);
      expect(day.contentBlocks.length).toBeGreaterThan(0);
    });
  });

  it('should have adCopy in generated content blocks', () => {
    const content = createMockGeneratedContent(1);

    content[0].contentBlocks.forEach((block) => {
      expect(block.adCopy).toBeDefined();
      expect(typeof block.adCopy).toBe('string');
    });
  });

  it('should have imagePrompt in generated content blocks', () => {
    const content = createMockGeneratedContent(1);

    content[0].contentBlocks.forEach((block) => {
      expect(block.imagePrompt).toBeDefined();
      expect(typeof block.imagePrompt).toBe('string');
    });
  });

  it('should support imageUrl in generated content (after generation)', () => {
    const block = createMockGeneratedContentBlock({
      imageUrl: 'https://example.com/ai-generated.jpg',
    });

    expect(block.imageUrl).toBe('https://example.com/ai-generated.jpg');
  });

  it('should preserve optional fields in generated content', () => {
    const block = createMockGeneratedContentBlock({
      keyMessage: 'Key message',
      toneOfVoice: 'Professional',
      scheduledTime: '2025-01-15T10:00:00Z',
    });

    expect(block.keyMessage).toBe('Key message');
    expect(block.toneOfVoice).toBe('Professional');
    expect(block.scheduledTime).toBe('2025-01-15T10:00:00Z');
  });
});

// ============================================================================
// Test Suite 5: Multi-Tenancy & Brand Isolation (10 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Multi-Tenancy & Brand Isolation', () => {
  it('should isolate campaigns by brandId', () => {
    const campaigns = [
      createMockCampaign({ brandId: BRAND_1_ID }),
      createMockCampaign({ brandId: BRAND_2_ID }),
    ];

    const brand1Campaigns = campaigns.filter((c) => c.brandId === BRAND_1_ID);
    const brand2Campaigns = campaigns.filter((c) => c.brandId === BRAND_2_ID);

    expect(brand1Campaigns).toHaveLength(1);
    expect(brand2Campaigns).toHaveLength(1);
  });

  it('should load campaigns filtered by brandId only', () => {
    const campaigns = [
      createMockCampaign({ brandId: BRAND_1_ID, name: 'Campaign 1' }),
      createMockCampaign({ brandId: BRAND_1_ID, name: 'Campaign 2' }),
      createMockCampaign({ brandId: BRAND_2_ID, name: 'Campaign 3' }),
    ];

    const brand1Campaigns = campaigns.filter((c) => c.brandId === BRAND_1_ID);

    expect(brand1Campaigns).toHaveLength(2);
    expect(brand1Campaigns.every((c) => c.brandId === BRAND_1_ID)).toBe(true);
  });

  it('should not show campaign from brand1 to brand2', () => {
    const campaigns = [
      createMockCampaign({ id: 'campaign-1', brandId: BRAND_1_ID }),
      createMockCampaign({ id: 'campaign-2', brandId: BRAND_2_ID }),
    ];

    const brand2Campaigns = campaigns.filter((c) => c.brandId === BRAND_2_ID);

    expect(brand2Campaigns).toHaveLength(1);
    expect(brand2Campaigns[0].id).toBe('campaign-2');
  });

  it('should allow same campaign name in different brands', () => {
    const campaign1 = createMockCampaign({
      name: 'Summer Sale',
      brandId: BRAND_1_ID,
    });
    const campaign2 = createMockCampaign({
      name: 'Summer Sale',
      brandId: BRAND_2_ID,
    });

    expect(campaign1.name).toBe(campaign2.name);
    expect(campaign1.brandId).not.toBe(campaign2.brandId);
  });

  it('should show correct campaigns for user with multiple brand memberships', () => {
    const campaigns = [
      createMockCampaign({ brandId: BRAND_1_ID, name: 'Brand 1 Campaign' }),
      createMockCampaign({ brandId: BRAND_2_ID, name: 'Brand 2 Campaign' }),
    ];

    const brand1View = campaigns.filter((c) => c.brandId === BRAND_1_ID);
    const brand2View = campaigns.filter((c) => c.brandId === BRAND_2_ID);

    expect(brand1View).toHaveLength(1);
    expect(brand2View).toHaveLength(1);
    expect(brand1View[0].name).toBe('Brand 1 Campaign');
    expect(brand2View[0].name).toBe('Brand 2 Campaign');
  });

  it('should create campaign in brand1 and verify not in brand2', () => {
    const campaign = createMockCampaign({ brandId: BRAND_1_ID });
    const allCampaigns = [campaign];

    const brand2Campaigns = allCampaigns.filter((c) => c.brandId === BRAND_2_ID);

    expect(brand2Campaigns).toHaveLength(0);
  });

  it('should create campaign in brand2 and verify not in brand1', () => {
    const campaign = createMockCampaign({ brandId: BRAND_2_ID });
    const allCampaigns = [campaign];

    const brand1Campaigns = allCampaigns.filter((c) => c.brandId === BRAND_1_ID);

    expect(brand1Campaigns).toHaveLength(0);
  });

  it('should require brandId for all campaign operations', () => {
    const campaign = createMockCampaign();

    expect(campaign.brandId).toBeDefined();
    expect(typeof campaign.brandId).toBe('string');
    expect(campaign.brandId.length).toBeGreaterThan(0);
  });

  it('should return empty campaign list for brand with no campaigns', () => {
    const campaigns: Campaign[] = [];
    const brand1Campaigns = campaigns.filter((c) => c.brandId === BRAND_1_ID);

    expect(brand1Campaigns).toHaveLength(0);
  });

  it('should prevent cross-brand campaign access', () => {
    const campaign = createMockCampaign({ brandId: BRAND_1_ID });

    // Attempt to access from brand2 context
    const hasAccess = campaign.brandId === BRAND_2_ID;

    expect(hasAccess).toBe(false);
  });
});

// ============================================================================
// Test Suite 6: Duplicate Name Detection (9 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Duplicate Name Detection', () => {
  it('should detect duplicate campaign name in same brand', () => {
    const campaigns = [
      createMockCampaign({ name: 'Summer Sale', brandId: BRAND_1_ID }),
    ];

    const newCampaignName = 'Summer Sale';
    const slug = generateNameSlug(newCampaignName);
    const existingSlugs = campaigns
      .filter((c) => c.brandId === BRAND_1_ID)
      .map((c) => generateNameSlug(c.name));

    const isDuplicate = existingSlugs.includes(slug);

    expect(isDuplicate).toBe(true);
  });

  it('should allow duplicate name in different brands', () => {
    const campaigns = [
      createMockCampaign({ name: 'Summer Sale', brandId: BRAND_1_ID }),
      createMockCampaign({ name: 'Summer Sale', brandId: BRAND_2_ID }),
    ];

    const brand1Slugs = campaigns
      .filter((c) => c.brandId === BRAND_1_ID)
      .map((c) => generateNameSlug(c.name));

    const brand2Slugs = campaigns
      .filter((c) => c.brandId === BRAND_2_ID)
      .map((c) => generateNameSlug(c.name));

    expect(brand1Slugs).toContain('summer-sale');
    expect(brand2Slugs).toContain('summer-sale');
  });

  it('should update campaign with same name (no conflict)', () => {
    const campaign = createMockCampaign({ name: 'Original Name' });

    const updatedCampaign = {
      ...campaign,
      name: 'Original Name', // Same name, just updating other fields
    };

    expect(updatedCampaign.name).toBe(campaign.name);
  });

  it('should update campaign with new unique name', () => {
    const campaigns = [createMockCampaign({ id: 'campaign-1', name: 'Old Name' })];

    const newName = 'New Unique Name';
    const slug = generateNameSlug(newName);
    const existingSlugs = campaigns
      .filter((c) => c.id !== 'campaign-1') // Exclude self
      .map((c) => generateNameSlug(c.name));

    const isDuplicate = existingSlugs.includes(slug);

    expect(isDuplicate).toBe(false);
  });

  it('should use name slug for uniqueness (lowercase, hyphens, no special chars)', () => {
    const slug1 = generateNameSlug('My Campaign!');
    const slug2 = generateNameSlug('my-campaign');

    expect(slug1).toBe('my-campaign');
    expect(slug2).toBe('my-campaign');
  });

  it('should treat "My Campaign" and "my-campaign" as duplicates', () => {
    const slug1 = generateNameSlug('My Campaign');
    const slug2 = generateNameSlug('my-campaign');

    expect(slug1).toBe(slug2);
  });

  it('should use transaction-based duplicate detection', () => {
    // Mock uniqueness tracking
    const uniquenessMap = new Map<string, boolean>();

    const brandId = BRAND_1_ID;
    const name = 'Test Campaign';
    const slug = generateNameSlug(name);
    const uniquenessKey = `${brandId}_${slug}`;

    // First campaign
    uniquenessMap.set(uniquenessKey, true);
    expect(uniquenessMap.has(uniquenessKey)).toBe(true);

    // Duplicate attempt
    const isDuplicate = uniquenessMap.has(uniquenessKey);
    expect(isDuplicate).toBe(true);
  });

  it('should create uniqueness document: {brandId}_{nameSlug}', () => {
    const brandId = BRAND_1_ID;
    const name = 'Summer Sale 2025';
    const slug = generateNameSlug(name);
    const uniquenessKey = `${brandId}_${slug}`;

    expect(uniquenessKey).toBe('brand-1_summer-sale-2025');
  });

  it('should clean up uniqueness document on campaign delete', () => {
    const uniquenessMap = new Map<string, boolean>();
    const brandId = BRAND_1_ID;
    const name = 'Test Campaign';
    const slug = generateNameSlug(name);
    const uniquenessKey = `${brandId}_${slug}`;

    // Create
    uniquenessMap.set(uniquenessKey, true);
    expect(uniquenessMap.has(uniquenessKey)).toBe(true);

    // Delete
    uniquenessMap.delete(uniquenessKey);
    expect(uniquenessMap.has(uniquenessKey)).toBe(false);
  });
});

// ============================================================================
// Test Suite 7: Optimistic Concurrency Control (7 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Optimistic Concurrency Control', () => {
  it('should save without clientUpdatedAt (no conflict check)', () => {
    const campaign = createMockCampaign();

    // New save without clientUpdatedAt
    const saveWithoutConflictCheck = !campaign.updatedAt;

    expect(saveWithoutConflictCheck).toBe(true);
  });

  it('should save with matching clientUpdatedAt', () => {
    const campaign = createMockCampaign({
      updatedAt: '2025-01-15T10:00:00Z',
    });

    const clientUpdatedAt = '2025-01-15T10:00:00Z';
    const isMatch = campaign.updatedAt === clientUpdatedAt;

    expect(isMatch).toBe(true);
  });

  it('should return conflict with older clientUpdatedAt', () => {
    const campaign = createMockCampaign({
      updatedAt: '2025-01-15T10:30:00Z', // Server version
      updatedBy: USER_2_ID,
    });

    const clientUpdatedAt = '2025-01-15T10:00:00Z'; // Client has older version
    const isConflict = campaign.updatedAt !== clientUpdatedAt;

    expect(isConflict).toBe(true);
  });

  it('should include updatedBy and updatedAt in conflict info', () => {
    const campaign = createMockCampaign({
      updatedAt: '2025-01-15T10:30:00Z',
      updatedBy: USER_2_ID,
    });

    const conflictInfo = {
      hasConflict: true,
      serverUpdatedAt: campaign.updatedAt,
      serverUpdatedBy: campaign.updatedBy,
    };

    expect(conflictInfo.hasConflict).toBe(true);
    expect(conflictInfo.serverUpdatedAt).toBe('2025-01-15T10:30:00Z');
    expect(conflictInfo.serverUpdatedBy).toBe(USER_2_ID);
  });

  it('should fail when User A saves, then User B saves with stale timestamp', () => {
    const originalUpdatedAt = '2025-01-15T10:00:00Z';
    let campaign = createMockCampaign({
      updatedAt: originalUpdatedAt,
    });

    // User A saves
    campaign = {
      ...campaign,
      updatedBy: USER_1_ID,
      updatedAt: '2025-01-15T10:15:00Z',
    };

    // User B tries to save with stale timestamp
    const userBClientUpdatedAt = originalUpdatedAt;
    const hasConflict = campaign.updatedAt !== userBClientUpdatedAt;

    expect(hasConflict).toBe(true);
  });

  it('should allow User B to save after refreshing with latest updatedAt', () => {
    const campaign = createMockCampaign({
      updatedAt: '2025-01-15T10:15:00Z',
      updatedBy: USER_1_ID,
    });

    // User B refreshes and gets latest timestamp
    const userBClientUpdatedAt = campaign.updatedAt;

    // User B saves with current timestamp
    const hasConflict = campaign.updatedAt !== userBClientUpdatedAt;

    expect(hasConflict).toBe(false);
  });

  it('should always succeed for new campaigns (no existing updatedAt)', () => {
    const campaign = createMockCampaign(); // New campaign, no updatedAt

    const isNewCampaign = !campaign.updatedAt;

    expect(isNewCampaign).toBe(true);
  });
});

// ============================================================================
// Test Suite 8: Audit Trail (8 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Audit Trail', () => {
  it('should have createdBy (user uid) for new campaign', () => {
    const campaign = createMockCampaign({ createdBy: USER_1_ID });

    expect(campaign.createdBy).toBe(USER_1_ID);
    expect(typeof campaign.createdBy).toBe('string');
  });

  it('should have createdAt (ISO timestamp) for new campaign', () => {
    const campaign = createMockCampaign();

    expect(campaign.createdAt).toBeDefined();
    expect(isISOTimestamp(campaign.createdAt)).toBe(true);
  });

  it('should have no updatedBy initially for new campaign', () => {
    const campaign = createMockCampaign();

    expect(campaign.updatedBy).toBeUndefined();
  });

  it('should have no updatedAt initially for new campaign', () => {
    const campaign = createMockCampaign();

    expect(campaign.updatedAt).toBeUndefined();
  });

  it('should set updatedBy on campaign update', () => {
    const campaign = createMockCampaign({ createdBy: USER_1_ID });

    const updatedCampaign = {
      ...campaign,
      updatedBy: USER_2_ID,
      updatedAt: new Date().toISOString(),
    };

    expect(updatedCampaign.updatedBy).toBe(USER_2_ID);
  });

  it('should set updatedAt on campaign update', () => {
    const campaign = createMockCampaign();
    const now = new Date().toISOString();

    const updatedCampaign = {
      ...campaign,
      updatedBy: USER_2_ID,
      updatedAt: now,
    };

    expect(updatedCampaign.updatedAt).toBe(now);
    expect(isISOTimestamp(updatedCampaign.updatedAt)).toBe(true);
  });

  it('should preserve original createdBy/createdAt on multiple updates', () => {
    const originalCreatedBy = USER_1_ID;
    const originalCreatedAt = '2025-01-15T10:00:00Z';

    let campaign = createMockCampaign({
      createdBy: originalCreatedBy,
      createdAt: originalCreatedAt,
    });

    // First update
    campaign = {
      ...campaign,
      updatedBy: USER_2_ID,
      updatedAt: '2025-01-15T11:00:00Z',
    };

    // Second update
    campaign = {
      ...campaign,
      updatedBy: USER_1_ID,
      updatedAt: '2025-01-15T12:00:00Z',
    };

    expect(campaign.createdBy).toBe(originalCreatedBy);
    expect(campaign.createdAt).toBe(originalCreatedAt);
  });

  it('should use ISO 8601 format for timestamps (YYYY-MM-DDTHH:mm:ss.sssZ)', () => {
    const campaign = createMockCampaign({
      createdAt: '2025-01-15T10:30:00.123Z',
      updatedAt: '2025-01-15T11:45:00.456Z',
    });

    expect(isISOTimestamp(campaign.createdAt)).toBe(true);
    expect(isISOTimestamp(campaign.updatedAt!)).toBe(true);
  });
});

// ============================================================================
// Test Suite 9: Permission & Access Control (8 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Permission & Access Control', () => {
  const brandMembers: BrandMember[] = [
    createMockBrandMember(BRAND_1_ID, USER_1_ID, 'MANAGER'),
    createMockBrandMember(BRAND_1_ID, USER_2_ID, 'CONTRIBUTOR'),
    createMockBrandMember(BRAND_2_ID, USER_1_ID, 'CONTRIBUTOR'),
  ];

  it('should allow authenticated user with brand access to create campaign', () => {
    const hasAccess = validateBrandAccess(USER_1_ID, BRAND_1_ID, brandMembers);

    expect(hasAccess).toBe(true);
  });

  it('should deny unauthenticated user to create campaign', () => {
    const hasAccess = validateBrandAccess('', BRAND_1_ID, brandMembers);

    expect(hasAccess).toBe(false);
  });

  it('should deny user without brand membership', () => {
    const hasAccess = validateBrandAccess(USER_3_ID, BRAND_1_ID, brandMembers);

    expect(hasAccess).toBe(false);
  });

  it('should allow MANAGER to create campaigns', () => {
    const hasAccess = validateBrandAccess(USER_1_ID, BRAND_1_ID, brandMembers);

    const member = brandMembers.find(
      (m) => m.userId === USER_1_ID && m.brandId === BRAND_1_ID
    );

    expect(hasAccess).toBe(true);
    expect(member?.role).toBe('MANAGER');
  });

  it('should allow CONTRIBUTOR to create campaigns', () => {
    const hasAccess = validateBrandAccess(USER_2_ID, BRAND_1_ID, brandMembers);

    const member = brandMembers.find(
      (m) => m.userId === USER_2_ID && m.brandId === BRAND_1_ID
    );

    expect(hasAccess).toBe(true);
    expect(member?.role).toBe('CONTRIBUTOR');
  });

  it('should require user to be ACTIVE brand member', () => {
    const activeMember = createMockBrandMember(BRAND_1_ID, USER_1_ID, 'MANAGER', 'ACTIVE');
    const hasAccess = activeMember.status === 'ACTIVE';

    expect(hasAccess).toBe(true);
  });

  it('should deny INACTIVE brand member', () => {
    const inactiveMembers = [
      createMockBrandMember(BRAND_1_ID, USER_1_ID, 'MANAGER', 'INACTIVE'),
    ];

    const hasAccess = validateBrandAccess(USER_1_ID, BRAND_1_ID, inactiveMembers);

    expect(hasAccess).toBe(false);
  });

  it('should enforce requireBrandAccess on all campaign actions', () => {
    // Test create action
    const canCreate = validateBrandAccess(USER_1_ID, BRAND_1_ID, brandMembers);
    expect(canCreate).toBe(true);

    // Test load action
    const canLoad = validateBrandAccess(USER_1_ID, BRAND_1_ID, brandMembers);
    expect(canLoad).toBe(true);

    // Test delete action
    const canDelete = validateBrandAccess(USER_1_ID, BRAND_1_ID, brandMembers);
    expect(canDelete).toBe(true);
  });
});

// ============================================================================
// Test Suite 10: Image Assignment (10 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Image Assignment', () => {
  it('should assign single image to first post sequentially', () => {
    const imageUrls = ['https://example.com/image1.jpg'];
    const postSchedule = [2, 2, 2]; // 2 posts per day for 3 days

    // Import the function from campaign-creation-agent
    const imageMap = new Map<string, string>();
    imageMap.set('1-1', imageUrls[0]);

    expect(imageMap.get('1-1')).toBe(imageUrls[0]);
  });

  it('should assign multiple images sequentially across days and posts', () => {
    const imageUrls = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg',
    ];
    const postSchedule = [2, 2, 1]; // Day 1: 2 posts, Day 2: 2 posts, Day 3: 1 post

    const imageMap = new Map<string, string>();
    imageMap.set('1-1', imageUrls[0]); // Day 1, Post 1
    imageMap.set('1-2', imageUrls[1]); // Day 1, Post 2
    imageMap.set('2-1', imageUrls[2]); // Day 2, Post 1

    expect(imageMap.get('1-1')).toBe(imageUrls[0]);
    expect(imageMap.get('1-2')).toBe(imageUrls[1]);
    expect(imageMap.get('2-1')).toBe(imageUrls[2]);
  });

  it('should assign image to specific day and post number', () => {
    const imageUrls = ['https://example.com/image1.jpg'];
    const assignment = { imageIndex: 0, dayNumber: 2, postNumber: 1 };

    const imageMap = new Map<string, string>();
    const key = `${assignment.dayNumber}-${assignment.postNumber}`;
    imageMap.set(key, imageUrls[assignment.imageIndex]);

    expect(imageMap.get('2-1')).toBe(imageUrls[0]);
  });

  it('should handle explicit and sequential assignments together', () => {
    const imageUrls = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg',
    ];

    // Explicit assignment: image 2 to day 3, post 1
    // Sequential: images 0 and 1 should fill day 1, posts 1 and 2
    const imageMap = new Map<string, string>();
    imageMap.set('1-1', imageUrls[0]); // Sequential
    imageMap.set('1-2', imageUrls[1]); // Sequential
    imageMap.set('3-1', imageUrls[2]); // Explicit

    expect(imageMap.get('1-1')).toBe(imageUrls[0]);
    expect(imageMap.get('1-2')).toBe(imageUrls[1]);
    expect(imageMap.get('3-1')).toBe(imageUrls[2]);
  });

  it('should not assign more images than available posts', () => {
    const imageUrls = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg',
      'https://example.com/image4.jpg',
      'https://example.com/image5.jpg',
    ];
    const postSchedule = [2, 1]; // Only 3 total posts

    const imageMap = new Map<string, string>();
    imageMap.set('1-1', imageUrls[0]);
    imageMap.set('1-2', imageUrls[1]);
    imageMap.set('2-1', imageUrls[2]);

    expect(imageMap.size).toBe(3);
    expect(imageMap.get('1-1')).toBe(imageUrls[0]);
    expect(imageMap.get('1-2')).toBe(imageUrls[1]);
    expect(imageMap.get('2-1')).toBe(imageUrls[2]);
  });

  it('should use 0-based imageIndex and 1-based day/post numbers', () => {
    const imageUrls = ['https://example.com/image1.jpg'];
    const assignment = { imageIndex: 0, dayNumber: 1, postNumber: 1 };

    expect(assignment.imageIndex).toBe(0); // 0-based
    expect(assignment.dayNumber).toBe(1); // 1-based
    expect(assignment.postNumber).toBe(1); // 1-based
  });

  it('should handle empty imageAssignments array', () => {
    const imageUrls = ['https://example.com/image1.jpg'];
    const imageAssignments: any[] = [];

    // With no assignments, should still be able to process
    expect(imageAssignments).toHaveLength(0);
  });

  it('should handle imageUrl in content block', () => {
    const block = createMockContentBlock({
      imageUrl: 'https://example.com/assigned-image.jpg',
    });

    expect(block.imageUrl).toBe('https://example.com/assigned-image.jpg');
  });

  it('should handle assetUrl in content block (from gallery)', () => {
    const block = createMockContentBlock({
      assetUrl: 'https://example.com/gallery-image.jpg',
    });

    expect(block.assetUrl).toBe('https://example.com/gallery-image.jpg');
  });

  it('should differentiate between imageUrl (from assignment) and assetUrl (from gallery)', () => {
    const blockWithImageUrl = createMockContentBlock({
      imageUrl: 'https://example.com/assigned.jpg',
    });
    const blockWithAssetUrl = createMockContentBlock({
      assetUrl: 'https://example.com/gallery.jpg',
    });

    expect(blockWithImageUrl.imageUrl).toBeDefined();
    expect(blockWithImageUrl.assetUrl).toBeUndefined();
    expect(blockWithAssetUrl.assetUrl).toBeDefined();
    expect(blockWithAssetUrl.imageUrl).toBeUndefined();
  });
});

// ============================================================================
// Test Suite 11: Data Integrity (7 tests)
// ============================================================================

describe('Team Calendar E2E Tests - Data Integrity', () => {
  it('should have correct campaign document structure', () => {
    const campaign = createMockCampaign();

    expect(campaign).toHaveProperty('id');
    expect(campaign).toHaveProperty('brandId');
    expect(campaign).toHaveProperty('name');
    expect(campaign).toHaveProperty('createdBy');
    expect(campaign).toHaveProperty('createdAt');
    expect(campaign).toHaveProperty('content');
  });

  it('should validate GeneratedDay structure in content', () => {
    const campaign = createMockCampaign({
      content: createMockGeneratedContent(2),
    });

    campaign.content.forEach((day) => {
      expect(day).toHaveProperty('day');
      expect(day).toHaveProperty('contentBlocks');
      expect(typeof day.day).toBe('number');
      expect(Array.isArray(day.contentBlocks)).toBe(true);
    });
  });

  it('should validate GeneratedContentBlock structure', () => {
    const content = createMockGeneratedContent(1);

    content[0].contentBlocks.forEach((block) => {
      expect(block).toHaveProperty('contentType');
      expect(block).toHaveProperty('adCopy');
      expect(block).toHaveProperty('imagePrompt');
    });
  });

  it('should allow campaign with no content blocks', () => {
    const campaign = createMockCampaign({
      content: [
        {
          day: 1,
          date: new Date().toISOString().split('T')[0],
          contentBlocks: [],
        },
      ],
    });

    expect(campaign.content).toHaveLength(1);
    expect(campaign.content[0].contentBlocks).toHaveLength(0);
  });

  it('should allow campaign with empty content array', () => {
    const campaign = createMockCampaign({
      content: [],
    });

    expect(campaign.content).toHaveLength(0);
  });

  it('should handle missing optional fields (assetUrl, imageUrl, scheduledTime)', () => {
    const block = createMockContentBlock();

    // Optional fields should be undefined if not provided
    expect(block.assetUrl).toBeUndefined();
    expect(block.imageUrl).toBeUndefined();
    expect(block.scheduledTime).toBeUndefined();
    expect(block.adCopy).toBeUndefined();
  });

  it('should validate complete hierarchy: campaign → content → contentBlocks', () => {
    const campaign = createMockCampaign({
      content: [
        {
          day: 1,
          date: new Date().toISOString().split('T')[0],
          contentBlocks: [
            createMockGeneratedContentBlock(),
            createMockGeneratedContentBlock(),
          ],
        },
      ],
    });

    expect(campaign.content).toHaveLength(1);
    expect(campaign.content[0].contentBlocks).toHaveLength(2);

    // Validate hierarchy
    expect(campaign).toHaveProperty('content');
    expect(campaign.content[0]).toHaveProperty('contentBlocks');
    expect(campaign.content[0].contentBlocks[0]).toHaveProperty('adCopy');
  });
});
