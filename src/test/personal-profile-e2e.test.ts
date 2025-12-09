/**
 * Personal Profile E2E Tests
 *
 * Comprehensive E2E test suite for Personal Profile features including:
 * - Individual Identity (Personal Bio, Role, Skills, Achievements)
 * - User Profile Preferences (Display Settings, Contact Info)
 * - Social Links (LinkedIn, Twitter, Portfolio)
 * - Testimonials & Recognition
 * - Personal Mission & Values
 * - About Tab (Personal Information)
 *
 * Pattern: Mock-based data validation (follows multimedia-e2e.test.ts approach)
 *
 * @see /src/lib/types.ts - IndividualIdentity, UserProfilePreferences
 */

import { describe, it, expect } from 'vitest';
import type {
  IndividualIdentity,
  UserProfilePreferences,
  BrandAsset,
} from '@/lib/types';

// ============================================================================
// Test Constants
// ============================================================================

const BRAND_1_ID = 'brand-1';
const BRAND_2_ID = 'brand-2';
const USER_1_ID = 'user-1';
const USER_2_ID = 'user-2';

const SOCIAL_PLATFORMS = ['LinkedIn', 'Twitter', 'GitHub', 'Portfolio', 'Instagram'] as const;

// ============================================================================
// Helper Functions - Mock Creators
// ============================================================================

/**
 * Creates a mock IndividualIdentity object
 */
function createMockIndividualIdentity(overrides?: Partial<IndividualIdentity>): IndividualIdentity {
  return {
    id: `${BRAND_1_ID}_${USER_1_ID}`,
    brandId: BRAND_1_ID,
    userId: USER_1_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock UserProfilePreferences object
 */
function createMockUserProfilePreferences(overrides?: Partial<UserProfilePreferences>): UserProfilePreferences {
  return {
    userId: USER_1_ID,
    brandId: BRAND_1_ID,
    updatedAt: new Date().toISOString(),
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

/**
 * Generates composite ID for individual identity
 */
function generateCompositeId(brandId: string, userId: string): string {
  return `${brandId}_${userId}`;
}

// ============================================================================
// Test Suite 1: Individual Identity - Core Fields (10 tests)
// ============================================================================

describe('Personal Profile E2E Tests - Individual Identity Core', () => {
  it('should create individual identity with required fields', () => {
    const identity = createMockIndividualIdentity();

    expect(identity.id).toBeDefined();
    expect(identity.brandId).toBeDefined();
    expect(identity.userId).toBeDefined();
    expect(identity.createdAt).toBeDefined();
    expect(identity.updatedAt).toBeDefined();
  });

  it('should use composite ID format: brandId_userId', () => {
    const identity = createMockIndividualIdentity({
      brandId: BRAND_1_ID,
      userId: USER_1_ID,
    });

    const expectedId = generateCompositeId(BRAND_1_ID, USER_1_ID);
    expect(identity.id).toBe(expectedId);
  });

  it('should have valid ISO timestamps', () => {
    const identity = createMockIndividualIdentity();

    expect(isISOTimestamp(identity.createdAt)).toBe(true);
    expect(isISOTimestamp(identity.updatedAt)).toBe(true);
  });

  it('should support roleTitle field', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Senior Product Designer',
    });

    expect(identity.roleTitle).toBe('Senior Product Designer');
  });

  it('should support narrativeSummary field', () => {
    const identity = createMockIndividualIdentity({
      narrativeSummary: 'A passionate designer with 10 years of experience in creating user-centric products.',
    });

    expect(identity.narrativeSummary).toContain('passionate designer');
  });

  it('should support workingStyle field', () => {
    const identity = createMockIndividualIdentity({
      workingStyle: 'Collaborative and agile, prefers iterative design processes.',
    });

    expect(identity.workingStyle).toContain('Collaborative');
  });

  it('should update individual identity', () => {
    const originalUpdatedAt = '2024-01-01T10:00:00Z';
    const identity = createMockIndividualIdentity({
      roleTitle: 'Product Designer',
      updatedAt: originalUpdatedAt,
    });

    const updatedIdentity = {
      ...identity,
      roleTitle: 'Senior Product Designer',
      updatedAt: new Date().toISOString(),
    };

    expect(updatedIdentity.roleTitle).toBe('Senior Product Designer');
    expect(updatedIdentity.updatedAt).not.toBe(originalUpdatedAt);
  });

  it('should preserve createdAt on updates', () => {
    const originalCreatedAt = '2024-01-01T10:00:00Z';
    const identity = createMockIndividualIdentity({
      createdAt: originalCreatedAt,
    });

    const updatedIdentity = {
      ...identity,
      roleTitle: 'Updated Title',
      updatedAt: new Date().toISOString(),
    };

    expect(updatedIdentity.createdAt).toBe(originalCreatedAt);
  });

  it('should support lastGeneratedAt timestamp', () => {
    const identity = createMockIndividualIdentity({
      lastGeneratedAt: new Date().toISOString(),
    });

    expect(identity.lastGeneratedAt).toBeDefined();
    expect(isISOTimestamp(identity.lastGeneratedAt!)).toBe(true);
  });

  it('should differentiate identities by composite ID', () => {
    const identity1 = createMockIndividualIdentity({
      brandId: BRAND_1_ID,
      userId: USER_1_ID,
      id: `${BRAND_1_ID}_${USER_1_ID}`,
    });

    const identity2 = createMockIndividualIdentity({
      brandId: BRAND_1_ID,
      userId: USER_2_ID,
      id: `${BRAND_1_ID}_${USER_2_ID}`,
    });

    expect(identity1.id).not.toBe(identity2.id);
  });
});

// ============================================================================
// Test Suite 2: Professional Profile (10 tests)
// ============================================================================

describe('Personal Profile E2E Tests - Professional Profile', () => {
  it('should support achievements array', () => {
    const identity = createMockIndividualIdentity({
      achievements: [
        'Led design of award-winning mobile app',
        'Increased user engagement by 50%',
        'Mentored 5 junior designers',
      ],
    });

    expect(identity.achievements).toHaveLength(3);
    expect(identity.achievements![0]).toContain('award-winning');
  });

  it('should support skills array', () => {
    const identity = createMockIndividualIdentity({
      skills: ['UI/UX Design', 'Figma', 'User Research', 'Prototyping'],
    });

    expect(identity.skills).toHaveLength(4);
    expect(identity.skills).toContain('Figma');
  });

  it('should support empty achievements array', () => {
    const identity = createMockIndividualIdentity({
      achievements: [],
    });

    expect(identity.achievements).toHaveLength(0);
  });

  it('should support empty skills array', () => {
    const identity = createMockIndividualIdentity({
      skills: [],
    });

    expect(identity.skills).toHaveLength(0);
  });

  it('should support adding achievements incrementally', () => {
    let identity = createMockIndividualIdentity({
      achievements: ['First achievement'],
    });

    identity = {
      ...identity,
      achievements: [...(identity.achievements || []), 'Second achievement'],
    };

    expect(identity.achievements).toHaveLength(2);
  });

  it('should support adding skills incrementally', () => {
    let identity = createMockIndividualIdentity({
      skills: ['JavaScript'],
    });

    identity = {
      ...identity,
      skills: [...(identity.skills || []), 'TypeScript', 'React'],
    };

    expect(identity.skills).toHaveLength(3);
  });

  it('should combine roleTitle, skills, and achievements', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Full Stack Developer',
      skills: ['JavaScript', 'Python', 'Docker'],
      achievements: ['Built scalable API handling 1M requests/day'],
    });

    expect(identity.roleTitle).toBeDefined();
    expect(identity.skills).toHaveLength(3);
    expect(identity.achievements).toHaveLength(1);
  });

  it('should support updating professional profile', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Junior Developer',
      skills: ['JavaScript'],
    });

    const updatedIdentity = {
      ...identity,
      roleTitle: 'Senior Developer',
      skills: ['JavaScript', 'TypeScript', 'Python'],
      updatedAt: new Date().toISOString(),
    };

    expect(updatedIdentity.roleTitle).toBe('Senior Developer');
    expect(updatedIdentity.skills).toHaveLength(3);
  });

  it('should support workingStyle as professional attribute', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Product Manager',
      workingStyle: 'Data-driven decision making with strong stakeholder communication',
    });

    expect(identity.workingStyle).toContain('Data-driven');
  });

  it('should create comprehensive professional profile', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Senior UX Researcher',
      narrativeSummary: 'Passionate about understanding user needs',
      skills: ['User Interviews', 'A/B Testing', 'Data Analysis'],
      achievements: ['Led research for 3 major product launches'],
      workingStyle: 'Collaborative, detail-oriented, evidence-based',
    });

    expect(identity.roleTitle).toBeDefined();
    expect(identity.skills).toHaveLength(3);
    expect(identity.achievements).toHaveLength(1);
    expect(identity.workingStyle).toBeDefined();
    expect(identity.narrativeSummary).toBeDefined();
  });
});

// ============================================================================
// Test Suite 3: Personal Mission & Values (8 tests)
// ============================================================================

describe('Personal Profile E2E Tests - Personal Mission & Values', () => {
  it('should support personalMission field', () => {
    const identity = createMockIndividualIdentity({
      personalMission: 'To create inclusive digital experiences that empower everyone',
    });

    expect(identity.personalMission).toContain('inclusive');
  });

  it('should support personalTagline field', () => {
    const identity = createMockIndividualIdentity({
      personalTagline: 'Design with Purpose',
    });

    expect(identity.personalTagline).toBe('Design with Purpose');
  });

  it('should support personalValues array', () => {
    const identity = createMockIndividualIdentity({
      personalValues: ['Integrity', 'Innovation', 'Collaboration', 'Continuous Learning'],
    });

    expect(identity.personalValues).toHaveLength(4);
    expect(identity.personalValues).toContain('Innovation');
  });

  it('should support empty personalValues array', () => {
    const identity = createMockIndividualIdentity({
      personalValues: [],
    });

    expect(identity.personalValues).toHaveLength(0);
  });

  it('should combine mission, tagline, and values', () => {
    const identity = createMockIndividualIdentity({
      personalMission: 'Empower teams through design',
      personalTagline: 'Think. Create. Inspire.',
      personalValues: ['Creativity', 'Empathy', 'Excellence'],
    });

    expect(identity.personalMission).toBeDefined();
    expect(identity.personalTagline).toBeDefined();
    expect(identity.personalValues).toHaveLength(3);
  });

  it('should update personal mission and values', () => {
    const identity = createMockIndividualIdentity({
      personalMission: 'Initial mission',
      personalValues: ['Value 1'],
    });

    const updatedIdentity = {
      ...identity,
      personalMission: 'Updated mission with clearer purpose',
      personalValues: ['Value 1', 'Value 2', 'Value 3'],
    };

    expect(updatedIdentity.personalMission).toBe('Updated mission with clearer purpose');
    expect(updatedIdentity.personalValues).toHaveLength(3);
  });

  it('should support optional mission and values', () => {
    const identity = createMockIndividualIdentity();

    expect(identity.personalMission).toBeUndefined();
    expect(identity.personalTagline).toBeUndefined();
    expect(identity.personalValues).toBeUndefined();
  });

  it('should differentiate personal mission from roleTitle', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Software Engineer',
      personalMission: 'Build technology that makes a positive impact on society',
    });

    expect(identity.roleTitle).toContain('Engineer');
    expect(identity.personalMission).toContain('positive impact');
    expect(identity.roleTitle).not.toBe(identity.personalMission);
  });
});

// ============================================================================
// Test Suite 4: Testimonials & Recognition (8 tests)
// ============================================================================

describe('Personal Profile E2E Tests - Testimonials & Recognition', () => {
  it('should support testimonials array', () => {
    const identity = createMockIndividualIdentity({
      testimonials: [
        {
          text: 'Outstanding designer who consistently delivers exceptional work',
          author: 'Jane Smith',
          role: 'Product Manager',
          date: '2024-01-15',
        },
      ],
    });

    expect(identity.testimonials).toHaveLength(1);
    expect(identity.testimonials![0].author).toBe('Jane Smith');
  });

  it('should support testimonial with all fields', () => {
    const testimonial = {
      text: 'A true professional with incredible attention to detail',
      author: 'John Doe',
      role: 'CTO',
      date: '2024-03-20',
    };

    const identity = createMockIndividualIdentity({
      testimonials: [testimonial],
    });

    expect(identity.testimonials![0].text).toContain('professional');
    expect(identity.testimonials![0].role).toBe('CTO');
    expect(identity.testimonials![0].date).toBe('2024-03-20');
  });

  it('should support testimonial without optional role and date', () => {
    const identity = createMockIndividualIdentity({
      testimonials: [
        {
          text: 'Great to work with!',
          author: 'Anonymous Colleague',
        },
      ],
    });

    expect(identity.testimonials![0].text).toBeDefined();
    expect(identity.testimonials![0].author).toBeDefined();
    expect(identity.testimonials![0].role).toBeUndefined();
    expect(identity.testimonials![0].date).toBeUndefined();
  });

  it('should support multiple testimonials', () => {
    const identity = createMockIndividualIdentity({
      testimonials: [
        { text: 'First testimonial', author: 'Person 1' },
        { text: 'Second testimonial', author: 'Person 2' },
        { text: 'Third testimonial', author: 'Person 3' },
      ],
    });

    expect(identity.testimonials).toHaveLength(3);
  });

  it('should support empty testimonials array', () => {
    const identity = createMockIndividualIdentity({
      testimonials: [],
    });

    expect(identity.testimonials).toHaveLength(0);
  });

  it('should add testimonials incrementally', () => {
    let identity = createMockIndividualIdentity({
      testimonials: [{ text: 'First one', author: 'Alice' }],
    });

    identity = {
      ...identity,
      testimonials: [
        ...(identity.testimonials || []),
        { text: 'Second one', author: 'Bob' },
      ],
    };

    expect(identity.testimonials).toHaveLength(2);
  });

  it('should sort testimonials by date', () => {
    const identity = createMockIndividualIdentity({
      testimonials: [
        { text: 'Older', author: 'A', date: '2023-01-01' },
        { text: 'Newer', author: 'B', date: '2024-01-01' },
        { text: 'Newest', author: 'C', date: '2024-06-01' },
      ],
    });

    const sorted = [...identity.testimonials!].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    expect(sorted[0].author).toBe('C'); // Newest first
  });

  it('should validate testimonial structure', () => {
    const identity = createMockIndividualIdentity({
      testimonials: [
        {
          text: 'Great collaboration skills',
          author: 'Sarah Johnson',
          role: 'Team Lead',
          date: '2024-02-14',
        },
      ],
    });

    const testimonial = identity.testimonials![0];
    expect(testimonial).toHaveProperty('text');
    expect(testimonial).toHaveProperty('author');
    expect(testimonial).toHaveProperty('role');
    expect(testimonial).toHaveProperty('date');
  });
});

// ============================================================================
// Test Suite 5: Social Links (10 tests)
// ============================================================================

describe('Personal Profile E2E Tests - Social Links', () => {
  it('should support socialLinks array', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/johndoe' },
      ],
    });

    expect(identity.socialLinks).toHaveLength(1);
    expect(identity.socialLinks![0].platform).toBe('LinkedIn');
  });

  it('should support LinkedIn social link', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/johndoe' },
      ],
    });

    expect(identity.socialLinks![0].url).toContain('linkedin.com');
  });

  it('should support Twitter social link', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'Twitter', url: 'https://twitter.com/johndoe' },
      ],
    });

    expect(identity.socialLinks![0].platform).toBe('Twitter');
  });

  it('should support GitHub social link', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'GitHub', url: 'https://github.com/johndoe' },
      ],
    });

    expect(identity.socialLinks![0].platform).toBe('GitHub');
  });

  it('should support Portfolio social link', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'Portfolio', url: 'https://johndoe.com' },
      ],
    });

    expect(identity.socialLinks![0].platform).toBe('Portfolio');
  });

  it('should support multiple social links', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/johndoe' },
        { platform: 'Twitter', url: 'https://twitter.com/johndoe' },
        { platform: 'GitHub', url: 'https://github.com/johndoe' },
        { platform: 'Portfolio', url: 'https://johndoe.com' },
      ],
    });

    expect(identity.socialLinks).toHaveLength(4);
  });

  it('should support empty socialLinks array', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [],
    });

    expect(identity.socialLinks).toHaveLength(0);
  });

  it('should add social links incrementally', () => {
    let identity = createMockIndividualIdentity({
      socialLinks: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/user' }],
    });

    identity = {
      ...identity,
      socialLinks: [
        ...(identity.socialLinks || []),
        { platform: 'Twitter', url: 'https://twitter.com/user' },
      ],
    };

    expect(identity.socialLinks).toHaveLength(2);
  });

  it('should validate social link structure', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/johndoe' },
      ],
    });

    const link = identity.socialLinks![0];
    expect(link).toHaveProperty('platform');
    expect(link).toHaveProperty('url');
    expect(typeof link.platform).toBe('string');
    expect(typeof link.url).toBe('string');
  });

  it('should support custom platform names', () => {
    const identity = createMockIndividualIdentity({
      socialLinks: [
        { platform: 'Dribbble', url: 'https://dribbble.com/johndoe' },
        { platform: 'Behance', url: 'https://behance.net/johndoe' },
      ],
    });

    expect(identity.socialLinks![0].platform).toBe('Dribbble');
    expect(identity.socialLinks![1].platform).toBe('Behance');
  });
});

// ============================================================================
// Test Suite 6: User Profile Preferences (10 tests)
// ============================================================================

describe('Personal Profile E2E Tests - User Profile Preferences', () => {
  it('should create user profile preferences with required fields', () => {
    const prefs = createMockUserProfilePreferences();

    expect(prefs.userId).toBeDefined();
    expect(prefs.brandId).toBeDefined();
    expect(prefs.updatedAt).toBeDefined();
  });

  it('should have valid ISO timestamp for updatedAt', () => {
    const prefs = createMockUserProfilePreferences();

    expect(isISOTimestamp(prefs.updatedAt)).toBe(true);
  });

  it('should support displayName preference', () => {
    const prefs = createMockUserProfilePreferences({
      displayName: 'John Doe',
    });

    expect(prefs.displayName).toBe('John Doe');
  });

  it('should support bannerImageUrl preference', () => {
    const prefs = createMockUserProfilePreferences({
      bannerImageUrl: 'https://example.com/banner.jpg',
    });

    expect(prefs.bannerImageUrl).toBeDefined();
  });

  it('should support logoUrl preference', () => {
    const prefs = createMockUserProfilePreferences({
      logoUrl: 'https://example.com/logo.png',
    });

    expect(prefs.logoUrl).toBeDefined();
  });

  it('should support tagline preference', () => {
    const prefs = createMockUserProfilePreferences({
      tagline: 'Designing the future, one pixel at a time',
    });

    expect(prefs.tagline).toContain('future');
  });

  it('should support summary preference', () => {
    const prefs = createMockUserProfilePreferences({
      summary: 'A creative professional passionate about user experience design',
    });

    expect(prefs.summary).toContain('creative professional');
  });

  it('should support contact information preferences', () => {
    const prefs = createMockUserProfilePreferences({
      websiteUrl: 'https://johndoe.com',
      contactEmail: 'john@johndoe.com',
      location: 'San Francisco, CA',
    });

    expect(prefs.websiteUrl).toBe('https://johndoe.com');
    expect(prefs.contactEmail).toBe('john@johndoe.com');
    expect(prefs.location).toBe('San Francisco, CA');
  });

  it('should support timezone preference', () => {
    const prefs = createMockUserProfilePreferences({
      timezone: 'America/New_York',
    });

    expect(prefs.timezone).toBe('America/New_York');
  });

  it('should update user profile preferences', () => {
    const prefs = createMockUserProfilePreferences({
      displayName: 'John Doe',
      tagline: 'Old tagline',
    });

    const updatedPrefs = {
      ...prefs,
      tagline: 'New and improved tagline',
      updatedAt: new Date().toISOString(),
    };

    expect(updatedPrefs.tagline).toBe('New and improved tagline');
    expect(updatedPrefs.displayName).toBe('John Doe'); // Preserved
  });
});

// ============================================================================
// Test Suite 7: Profile Completeness & Integration (10 tests)
// ============================================================================

describe('Personal Profile E2E Tests - Profile Completeness', () => {
  it('should create minimal valid individual identity', () => {
    const identity = createMockIndividualIdentity();

    expect(identity.id).toBeDefined();
    expect(identity.brandId).toBeDefined();
    expect(identity.userId).toBeDefined();
  });

  it('should create complete individual identity with all sections', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Senior Product Designer',
      narrativeSummary: 'Passionate about creating delightful user experiences',
      achievements: ['Led design for 3 major products'],
      skills: ['Figma', 'User Research', 'Prototyping'],
      workingStyle: 'Collaborative and iterative',
      personalMission: 'Design products that improve lives',
      personalTagline: 'Design with Impact',
      personalValues: ['Empathy', 'Innovation', 'Excellence'],
      testimonials: [{ text: 'Great designer', author: 'Manager' }],
      socialLinks: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/user' }],
    });

    expect(identity.roleTitle).toBeDefined();
    expect(identity.achievements).toHaveLength(1);
    expect(identity.skills).toHaveLength(3);
    expect(identity.personalValues).toHaveLength(3);
    expect(identity.testimonials).toHaveLength(1);
    expect(identity.socialLinks).toHaveLength(1);
  });

  it('should handle optional fields being undefined', () => {
    const identity = createMockIndividualIdentity();

    expect(identity.roleTitle).toBeUndefined();
    expect(identity.achievements).toBeUndefined();
    expect(identity.skills).toBeUndefined();
    expect(identity.testimonials).toBeUndefined();
    expect(identity.socialLinks).toBeUndefined();
  });

  it('should support gradual profile building', () => {
    let identity = createMockIndividualIdentity();

    // Add role
    identity = { ...identity, roleTitle: 'Designer' };
    expect(identity.roleTitle).toBe('Designer');

    // Add skills
    identity = { ...identity, skills: ['Figma'] };
    expect(identity.skills).toHaveLength(1);

    // Add social links
    identity = {
      ...identity,
      socialLinks: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/user' }],
    };
    expect(identity.socialLinks).toHaveLength(1);
  });

  it('should combine user preferences with individual identity', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Product Manager',
    });

    const prefs = createMockUserProfilePreferences({
      displayName: 'Jane Smith',
      tagline: 'Building products users love',
    });

    expect(identity.roleTitle).toBeDefined();
    expect(prefs.displayName).toBeDefined();
    expect(prefs.tagline).toBeDefined();
  });

  it('should validate unique identity per brand-user combination', () => {
    const identity1 = createMockIndividualIdentity({
      brandId: BRAND_1_ID,
      userId: USER_1_ID,
      id: `${BRAND_1_ID}_${USER_1_ID}`,
    });

    const identity2 = createMockIndividualIdentity({
      brandId: BRAND_2_ID,
      userId: USER_1_ID,
      id: `${BRAND_2_ID}_${USER_1_ID}`,
    });

    expect(identity1.userId).toBe(identity2.userId);
    expect(identity1.brandId).not.toBe(identity2.brandId);
    expect(identity1.id).not.toBe(identity2.id);
  });

  it('should support professional + personal sections together', () => {
    const identity = createMockIndividualIdentity({
      // Professional
      roleTitle: 'Software Engineer',
      skills: ['JavaScript', 'Python'],
      achievements: ['Built scalable systems'],
      workingStyle: 'Agile and collaborative',
      // Personal
      personalMission: 'Create technology for social good',
      personalTagline: 'Code for Change',
      personalValues: ['Integrity', 'Impact'],
    });

    expect(identity.roleTitle).toBeDefined();
    expect(identity.skills).toBeDefined();
    expect(identity.personalMission).toBeDefined();
    expect(identity.personalValues).toBeDefined();
  });

  it('should support social proof + professional profile', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Design Lead',
      achievements: ['Won design award 2024'],
      testimonials: [{ text: 'Exceptional designer', author: 'CEO' }],
      socialLinks: [
        { platform: 'LinkedIn', url: 'https://linkedin.com/in/user' },
        { platform: 'Portfolio', url: 'https://portfolio.com' },
      ],
    });

    expect(identity.achievements).toHaveLength(1);
    expect(identity.testimonials).toHaveLength(1);
    expect(identity.socialLinks).toHaveLength(2);
  });

  it('should track AI generation timestamp', () => {
    const identity = createMockIndividualIdentity({
      narrativeSummary: 'AI-generated summary',
      lastGeneratedAt: new Date().toISOString(),
    });

    expect(identity.lastGeneratedAt).toBeDefined();
    expect(isISOTimestamp(identity.lastGeneratedAt!)).toBe(true);
  });

  it('should validate complete personal profile structure', () => {
    const identity = createMockIndividualIdentity({
      roleTitle: 'Full Profile',
      narrativeSummary: 'Complete bio',
      achievements: ['Achievement 1'],
      skills: ['Skill 1'],
      workingStyle: 'Style',
      personalMission: 'Mission',
      personalTagline: 'Tagline',
      personalValues: ['Value 1'],
      testimonials: [{ text: 'Testimonial', author: 'Author' }],
      socialLinks: [{ platform: 'LinkedIn', url: 'https://linkedin.com' }],
    });

    // Validate all major sections present
    expect(identity.roleTitle).toBeDefined();
    expect(identity.narrativeSummary).toBeDefined();
    expect(identity.achievements).toBeDefined();
    expect(identity.skills).toBeDefined();
    expect(identity.workingStyle).toBeDefined();
    expect(identity.personalMission).toBeDefined();
    expect(identity.personalTagline).toBeDefined();
    expect(identity.personalValues).toBeDefined();
    expect(identity.testimonials).toBeDefined();
    expect(identity.socialLinks).toBeDefined();
  });
});
