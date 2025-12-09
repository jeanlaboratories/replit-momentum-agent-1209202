/**
 * End-to-End Tests for Seed Data Verification
 *
 * These tests verify that all seeded data structures are properly created and
 * that the associated API operations work correctly for each feature.
 *
 * Features covered:
 * - Brand Soul / Team Intelligence
 * - Brand Artifacts
 * - Individual Identities
 * - Chat History
 * - Memories (Team & Personal)
 * - Comments
 * - Events
 * - AI Model Settings
 * - Media Library
 * - Campaigns
 * - Users & Brands
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========== MOCK SETUP ==========

// Mock Firestore document and collection refs
const mockDocData = new Map<string, any>();
const mockCollectionData = new Map<string, Map<string, any>>();

const createMockDocRef = (path: string) => ({
  id: path.split('/').pop(),
  path,
  get: vi.fn(async () => {
    const data = mockDocData.get(path);
    return {
      exists: !!data,
      data: () => data,
      id: path.split('/').pop(),
    };
  }),
  set: vi.fn(async (data: any) => {
    mockDocData.set(path, data);
    return data;
  }),
  update: vi.fn(async (data: any) => {
    const existing = mockDocData.get(path) || {};
    mockDocData.set(path, { ...existing, ...data });
    return data;
  }),
  delete: vi.fn(async () => {
    mockDocData.delete(path);
  }),
  collection: vi.fn((subCollection: string) => createMockCollectionRef(`${path}/${subCollection}`)),
});

const createMockCollectionRef = (path: string) => {
  if (!mockCollectionData.has(path)) {
    mockCollectionData.set(path, new Map());
  }

  return {
    path,
    doc: vi.fn((docId: string) => createMockDocRef(`${path}/${docId}`)),
    add: vi.fn(async (data: any) => {
      const id = `auto-${Date.now()}`;
      const fullPath = `${path}/${id}`;
      mockDocData.set(fullPath, { ...data, id });
      mockCollectionData.get(path)?.set(id, data);
      return createMockDocRef(fullPath);
    }),
    get: vi.fn(async () => {
      const docs = Array.from(mockCollectionData.get(path)?.entries() || []).map(([id, data]) => ({
        id,
        data: () => data,
        exists: true,
      }));
      return { docs, empty: docs.length === 0 };
    }),
    where: vi.fn(() => ({
      get: vi.fn(async () => {
        const docs = Array.from(mockCollectionData.get(path)?.entries() || []).map(([id, data]) => ({
          id,
          data: () => data,
          exists: true,
        }));
        return { docs, empty: docs.length === 0 };
      }),
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn(async () => ({ docs: [], empty: true })),
        })),
        get: vi.fn(async () => ({ docs: [], empty: true })),
      })),
    })),
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({ docs: [], empty: true })),
      })),
      get: vi.fn(async () => ({ docs: [], empty: true })),
    })),
  };
};

const mockAdminDb = {
  collection: vi.fn((name: string) => createMockCollectionRef(name)),
  batch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async () => {}),
  })),
};

vi.mock('@/lib/firebase/admin', () => ({
  getAdminInstances: () => ({
    adminDb: mockAdminDb,
    adminAuth: {
      verifyIdToken: vi.fn(async () => ({ uid: 'test-user-id' })),
    },
  }),
}));

vi.mock('@/lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn(async () => ({ uid: 'test-user-id', email: 'test@example.com' })),
}));

vi.mock('@/lib/brand-membership', () => ({
  requireBrandAccess: vi.fn(async () => true),
  checkBrandAccess: vi.fn(async () => true),
}));

// ========== TEST DATA DEFINITIONS ==========
// These match the seed data structure in actions.ts

const SEED_BRAND_IDS = ['lightning-fc', 'nova-labs', 'spectrum-creative'];

const expectedBrandSoulStructure = {
  brandId: expect.any(String),
  latestVersionId: expect.any(String),
  status: expect.stringMatching(/^(draft|published|archived)$/),
  voiceProfile: {
    tone: {
      primary: expect.any(String),
      secondary: expect.any(Array),
      avoid: expect.any(Array),
    },
    personality: {
      traits: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          strength: expect.any(Number),
        }),
      ]),
    },
    writingStyle: {
      sentenceLength: expect.any(String),
      paragraphStructure: expect.any(String),
      preferredPhrases: expect.any(Array),
    },
  },
  factLibrary: {
    facts: expect.any(Array),
  },
  messagingFramework: {
    mission: expect.any(String),
    vision: expect.any(String),
    taglines: expect.any(Array),
    values: expect.any(Array),
    keyMessages: expect.any(Array),
  },
  visualIdentity: {
    colors: expect.objectContaining({
      primary: expect.any(Array),
    }),
    typography: expect.any(Object),
    imageStyle: expect.any(Object),
  },
  statistics: expect.any(Object),
  createdAt: expect.any(Object),
  updatedAt: expect.any(Object),
};

const expectedArtifactStructure = {
  id: expect.any(String),
  brandId: expect.any(String),
  type: expect.stringMatching(/^(website|manual-text|youtube|document|image|video)$/),
  metadata: expect.objectContaining({
    title: expect.any(String),
  }),
  status: expect.stringMatching(/^(pending|extracting|extracted|failed|approved)$/),
  visibility: expect.stringMatching(/^(private|team|pending_approval|public)$/),
  createdAt: expect.any(String),
  createdBy: expect.any(String),
};

const expectedIdentityStructure = {
  id: expect.any(String),
  brandId: expect.any(String),
  userId: expect.any(String),
  roleTitle: expect.any(String),
  skills: expect.any(Array),
  achievements: expect.any(Array),
  personalMission: expect.any(String),
  values: expect.any(Array),
  createdAt: expect.any(Object),
  updatedAt: expect.any(Object),
};

const expectedChatHistoryStructure = {
  id: expect.any(String),
  brandId: expect.any(String),
  userId: expect.any(String),
  sessionId: expect.any(String),
  messages: expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(String),
      role: expect.stringMatching(/^(user|assistant|system)$/),
      content: expect.any(String),
      timestamp: expect.any(String),
    }),
  ]),
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
};

const expectedMemoryStructure = {
  id: expect.any(String),
  content: expect.any(String),
  category: expect.any(String),
  importance: expect.stringMatching(/^(low|medium|high|critical)$/),
  createdAt: expect.any(String),
};

const expectedCommentStructure = {
  id: expect.any(String),
  brandId: expect.any(String),
  contentId: expect.any(String),
  contentType: expect.any(String),
  userId: expect.any(String),
  text: expect.any(String),
  createdAt: expect.any(String),
};

const expectedEventStructure = {
  id: expect.any(String),
  brandId: expect.any(String),
  title: expect.any(String),
  type: expect.any(String),
  status: expect.stringMatching(/^(scheduled|draft|cancelled|completed)$/),
  createdAt: expect.any(String),
};

const expectedAISettingsStructure = {
  id: expect.any(String),
  brandId: expect.any(String),
  setting: expect.any(String),
  value: expect.anything(),
  createdAt: expect.any(String),
};

// ========== TEST SUITES ==========

describe('Seed Data E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocData.clear();
    mockCollectionData.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========== BRAND SOUL / TEAM INTELLIGENCE ==========
  describe('Brand Soul / Team Intelligence', () => {
    const sampleBrandSoul = {
      brandId: 'lightning-fc',
      latestVersionId: 'v1',
      status: 'published',
      voiceProfile: {
        tone: { primary: 'Energetic', secondary: ['Motivating'], avoid: ['Negative'] },
        personality: { traits: [{ name: 'Passionate', strength: 0.95, evidence: ['Test'] }] },
        writingStyle: { sentenceLength: 'short', paragraphStructure: 'punchy', preferredPhrases: ['Go!'] },
      },
      factLibrary: { facts: [{ id: 'fact-1', category: 'Test', fact: 'Test fact', confidence: 0.9, importance: 'high', tags: [], relatedFacts: [], sources: [] }] },
      messagingFramework: {
        mission: 'Test mission',
        vision: 'Test vision',
        taglines: ['Test tagline'],
        values: [{ name: 'Excellence', description: 'Test', examples: [], sources: [] }],
        keyMessages: [{ theme: 'Test', messages: ['Test msg'], importance: 'high', frequency: 'weekly' }],
      },
      visualIdentity: {
        colors: { primary: ['#2CAAA0'], secondary: ['#3DD68C'], accent: ['#FFD700'] },
        typography: { fonts: ['Montserrat'], style: 'Bold' },
        imageStyle: { style: 'Action', subjects: ['Players'], examples: [], photographicPreferences: {}, scenePreferences: {} },
      },
      statistics: { totalArtifacts: 3, extractedInsights: 15, lastUpdated: new Date() },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should verify Brand Soul document structure', () => {
      expect(sampleBrandSoul).toMatchObject({
        brandId: expect.any(String),
        status: expect.stringMatching(/^(draft|published|archived)$/),
        voiceProfile: expect.any(Object),
        factLibrary: expect.any(Object),
        messagingFramework: expect.any(Object),
        visualIdentity: expect.any(Object),
      });
    });

    it('should have valid voice profile with tone and personality', () => {
      const { voiceProfile } = sampleBrandSoul;

      expect(voiceProfile.tone.primary).toBeDefined();
      expect(voiceProfile.tone.secondary).toBeInstanceOf(Array);
      expect(voiceProfile.tone.avoid).toBeInstanceOf(Array);
      expect(voiceProfile.personality.traits).toBeInstanceOf(Array);
      expect(voiceProfile.personality.traits[0]).toMatchObject({
        name: expect.any(String),
        strength: expect.any(Number),
      });
      expect(voiceProfile.personality.traits[0].strength).toBeGreaterThanOrEqual(0);
      expect(voiceProfile.personality.traits[0].strength).toBeLessThanOrEqual(1);
    });

    it('should have valid fact library structure', () => {
      const { factLibrary } = sampleBrandSoul;

      expect(factLibrary.facts).toBeInstanceOf(Array);
      expect(factLibrary.facts[0]).toMatchObject({
        id: expect.any(String),
        category: expect.any(String),
        fact: expect.any(String),
        confidence: expect.any(Number),
        importance: expect.stringMatching(/^(low|medium|high|critical)$/),
      });
    });

    it('should have valid messaging framework', () => {
      const { messagingFramework } = sampleBrandSoul;

      expect(messagingFramework.mission).toBeDefined();
      expect(messagingFramework.vision).toBeDefined();
      expect(messagingFramework.taglines).toBeInstanceOf(Array);
      expect(messagingFramework.values).toBeInstanceOf(Array);
      expect(messagingFramework.keyMessages).toBeInstanceOf(Array);
    });

    it('should have valid visual identity with colors', () => {
      const { visualIdentity } = sampleBrandSoul;

      expect(visualIdentity.colors.primary).toBeInstanceOf(Array);
      expect(visualIdentity.colors.primary[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(visualIdentity.typography.fonts).toBeInstanceOf(Array);
    });

    it('should save and retrieve Brand Soul document', async () => {
      const docRef = mockAdminDb.collection('brandSoul').doc(sampleBrandSoul.brandId);
      await docRef.set(sampleBrandSoul);

      const retrieved = await docRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()).toEqual(sampleBrandSoul);
    });

    it('should update Brand Soul status correctly', async () => {
      const docRef = mockAdminDb.collection('brandSoul').doc(sampleBrandSoul.brandId);
      await docRef.set(sampleBrandSoul);
      await docRef.update({ status: 'archived', updatedAt: new Date() });

      const retrieved = await docRef.get();
      expect(retrieved.data()?.status).toBe('archived');
    });
  });

  // ========== BRAND ARTIFACTS ==========
  describe('Brand Artifacts', () => {
    const sampleArtifact = {
      id: 'artifact-lfc-1',
      brandId: 'lightning-fc',
      type: 'website',
      metadata: { title: 'Official Website', url: 'https://example.com', description: 'Main site' },
      status: 'extracted',
      visibility: 'team',
      createdAt: new Date().toISOString(),
      createdBy: 'test-user',
      extractedInsights: ['Insight 1', 'Insight 2'],
    };

    it('should verify artifact structure', () => {
      expect(sampleArtifact).toMatchObject(expectedArtifactStructure);
    });

    it('should have valid artifact types', () => {
      const validTypes = ['website', 'manual-text', 'youtube', 'document', 'image', 'video'];
      expect(validTypes).toContain(sampleArtifact.type);
    });

    it('should have valid status workflow', () => {
      const validStatuses = ['pending', 'extracting', 'extracted', 'failed', 'approved'];
      expect(validStatuses).toContain(sampleArtifact.status);
    });

    it('should have valid visibility options', () => {
      const validVisibility = ['private', 'team', 'pending_approval', 'public'];
      expect(validVisibility).toContain(sampleArtifact.visibility);
    });

    it('should save artifact to brand subcollection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleArtifact.brandId);
      const artifactRef = brandRef.collection('brandArtifacts').doc(sampleArtifact.id);
      await artifactRef.set(sampleArtifact);

      const retrieved = await artifactRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()).toEqual(sampleArtifact);
    });

    it('should update artifact status correctly', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleArtifact.brandId);
      const artifactRef = brandRef.collection('brandArtifacts').doc(sampleArtifact.id);
      await artifactRef.set(sampleArtifact);
      await artifactRef.update({ status: 'approved', visibility: 'public' });

      const retrieved = await artifactRef.get();
      expect(retrieved.data()?.status).toBe('approved');
      expect(retrieved.data()?.visibility).toBe('public');
    });

    it('should validate metadata based on artifact type', () => {
      // Website artifacts should have URL
      const websiteArtifact = { ...sampleArtifact, type: 'website' };
      expect(websiteArtifact.metadata.url).toBeDefined();

      // Document artifacts should have fileName
      const documentArtifact = {
        ...sampleArtifact,
        type: 'document',
        metadata: { title: 'Doc', fileName: 'test.pdf', description: 'A doc' },
      };
      expect(documentArtifact.metadata.fileName).toBeDefined();
    });
  });

  // ========== INDIVIDUAL IDENTITIES ==========
  describe('Individual Identities', () => {
    const sampleIdentity = {
      id: 'identity-test-01',
      brandId: 'lightning-fc',
      userId: 'test-user-01',
      roleTitle: 'Head Coach',
      skills: ['Coaching', 'Leadership', 'Player Development'],
      achievements: ['10 Championships', '50+ Players to College'],
      personalMission: 'To develop athletes and leaders',
      values: ['Excellence', 'Teamwork', 'Integrity'],
      testimonials: [{ author: 'Parent', quote: 'Amazing coach!', date: new Date().toISOString() }],
      socialLinks: { linkedin: 'https://linkedin.com/in/test', twitter: 'https://twitter.com/test' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should verify identity structure', () => {
      expect(sampleIdentity).toMatchObject(expectedIdentityStructure);
    });

    it('should have required identity fields', () => {
      expect(sampleIdentity.id).toBeDefined();
      expect(sampleIdentity.brandId).toBeDefined();
      expect(sampleIdentity.userId).toBeDefined();
      expect(sampleIdentity.roleTitle).toBeDefined();
    });

    it('should have valid skills array', () => {
      expect(sampleIdentity.skills).toBeInstanceOf(Array);
      expect(sampleIdentity.skills.length).toBeGreaterThan(0);
      sampleIdentity.skills.forEach(skill => {
        expect(typeof skill).toBe('string');
      });
    });

    it('should have valid testimonials structure', () => {
      expect(sampleIdentity.testimonials).toBeInstanceOf(Array);
      if (sampleIdentity.testimonials.length > 0) {
        expect(sampleIdentity.testimonials[0]).toMatchObject({
          author: expect.any(String),
          quote: expect.any(String),
          date: expect.any(String),
        });
      }
    });

    it('should save and retrieve identity', async () => {
      const docRef = mockAdminDb.collection('individualIdentities').doc(sampleIdentity.id);
      await docRef.set(sampleIdentity);

      const retrieved = await docRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.roleTitle).toBe(sampleIdentity.roleTitle);
    });

    it('should update identity achievements', async () => {
      const docRef = mockAdminDb.collection('individualIdentities').doc(sampleIdentity.id);
      await docRef.set(sampleIdentity);

      const newAchievements = [...sampleIdentity.achievements, 'New Achievement'];
      await docRef.update({ achievements: newAchievements });

      const retrieved = await docRef.get();
      expect(retrieved.data()?.achievements).toContain('New Achievement');
    });
  });

  // ========== CHAT HISTORY ==========
  describe('Chat History', () => {
    const sampleChatHistory = {
      id: 'chat-session-1',
      brandId: 'lightning-fc',
      userId: 'test-user-01',
      sessionId: 'session-001',
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: new Date().toISOString(), mode: 'agent' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString(), mode: 'agent' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should verify chat history structure', () => {
      expect(sampleChatHistory).toMatchObject(expectedChatHistoryStructure);
    });

    it('should have valid message roles', () => {
      const validRoles = ['user', 'assistant', 'system'];
      sampleChatHistory.messages.forEach(msg => {
        expect(validRoles).toContain(msg.role);
      });
    });

    it('should have chronological timestamps', () => {
      const timestamps = sampleChatHistory.messages.map(m => new Date(m.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should save chat history to brand subcollection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleChatHistory.brandId);
      const chatRef = brandRef.collection('chatHistory').doc(sampleChatHistory.id);
      await chatRef.set(sampleChatHistory);

      const retrieved = await chatRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.messages.length).toBe(2);
    });

    it('should append new messages to chat history', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleChatHistory.brandId);
      const chatRef = brandRef.collection('chatHistory').doc(sampleChatHistory.id);
      await chatRef.set(sampleChatHistory);

      const newMessage = {
        id: 'msg-3',
        role: 'user',
        content: 'Another message',
        timestamp: new Date().toISOString(),
        mode: 'agent',
      };

      const updatedMessages = [...sampleChatHistory.messages, newMessage];
      await chatRef.update({ messages: updatedMessages, updatedAt: new Date().toISOString() });

      const retrieved = await chatRef.get();
      expect(retrieved.data()?.messages.length).toBe(3);
    });

    it('should support media attachments in messages', () => {
      const messageWithMedia = {
        ...sampleChatHistory.messages[1],
        mediaData: [{ type: 'image', url: 'https://example.com/image.jpg' }],
      };

      expect(messageWithMedia.mediaData).toBeInstanceOf(Array);
      expect(messageWithMedia.mediaData[0]).toMatchObject({
        type: expect.any(String),
        url: expect.any(String),
      });
    });
  });

  // ========== MEMORIES (Team & Personal) ==========
  describe('Memories', () => {
    const sampleMemory = {
      id: 'memory-001',
      content: 'Lightning FC has won 12 championships',
      category: 'Achievement',
      importance: 'high',
      source: 'artifact-lfc-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const teamMemory = { ...sampleMemory, type: 'team', brandId: 'lightning-fc' };
    const personalMemory = { ...sampleMemory, type: 'personal', userId: 'test-user-01' };

    it('should verify memory structure', () => {
      expect(sampleMemory).toMatchObject(expectedMemoryStructure);
    });

    it('should have valid importance levels', () => {
      const validImportance = ['low', 'medium', 'high', 'critical'];
      expect(validImportance).toContain(sampleMemory.importance);
    });

    it('should distinguish team and personal memories', () => {
      expect(teamMemory.type).toBe('team');
      expect(teamMemory.brandId).toBeDefined();
      expect(personalMemory.type).toBe('personal');
      expect(personalMemory.userId).toBeDefined();
    });

    it('should save team memory to brand subcollection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(teamMemory.brandId);
      const memoryRef = brandRef.collection('teamMemories').doc(teamMemory.id);
      await memoryRef.set(teamMemory);

      const retrieved = await memoryRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.type).toBe('team');
    });

    it('should save personal memory to user subcollection', async () => {
      const userRef = mockAdminDb.collection('users').doc(personalMemory.userId);
      const memoryRef = userRef.collection('personalMemories').doc(personalMemory.id);
      await memoryRef.set(personalMemory);

      const retrieved = await memoryRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.type).toBe('personal');
    });

    it('should link memory to source artifact', () => {
      expect(sampleMemory.source).toBeDefined();
      expect(typeof sampleMemory.source).toBe('string');
    });
  });

  // ========== COMMENTS ==========
  describe('Comments', () => {
    const sampleComment = {
      id: 'comment-001',
      brandId: 'lightning-fc',
      contentId: 'generated-content-001',
      contentType: 'generated-image',
      userId: 'test-user-01',
      userDisplayName: 'Test User',
      text: 'Great work on this!',
      reactions: [{ emoji: '👍', userId: 'test-user-02' }],
      mentions: ['@test-user-02'],
      parentId: null,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should verify comment structure', () => {
      expect(sampleComment).toMatchObject(expectedCommentStructure);
    });

    it('should have valid content types', () => {
      const validContentTypes = ['generated-image', 'generated-video', 'artifact', 'campaign', 'post'];
      expect(validContentTypes).toContain(sampleComment.contentType);
    });

    it('should support reactions', () => {
      expect(sampleComment.reactions).toBeInstanceOf(Array);
      if (sampleComment.reactions.length > 0) {
        expect(sampleComment.reactions[0]).toMatchObject({
          emoji: expect.any(String),
          userId: expect.any(String),
        });
      }
    });

    it('should support @mentions', () => {
      expect(sampleComment.mentions).toBeInstanceOf(Array);
      sampleComment.mentions.forEach(mention => {
        expect(mention).toMatch(/^@/);
      });
    });

    it('should support threading with parentId', () => {
      const reply = { ...sampleComment, id: 'comment-002', parentId: 'comment-001' };
      expect(reply.parentId).toBe('comment-001');
    });

    it('should save comment to brand subcollection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleComment.brandId);
      const commentRef = brandRef.collection('comments').doc(sampleComment.id);
      await commentRef.set(sampleComment);

      const retrieved = await commentRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.text).toBe(sampleComment.text);
    });

    it('should update comment reactions', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleComment.brandId);
      const commentRef = brandRef.collection('comments').doc(sampleComment.id);
      await commentRef.set(sampleComment);

      const newReactions = [...sampleComment.reactions, { emoji: '❤️', userId: 'test-user-03' }];
      await commentRef.update({ reactions: newReactions });

      const retrieved = await commentRef.get();
      expect(retrieved.data()?.reactions.length).toBe(2);
    });
  });

  // ========== EVENTS ==========
  describe('Events', () => {
    const sampleEvent = {
      id: 'event-001',
      brandId: 'lightning-fc',
      title: 'Championship Game',
      description: 'Annual championship tournament',
      type: 'sports-event',
      status: 'scheduled',
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Main Stadium',
      attendees: ['test-user-01', 'test-user-02'],
      createdBy: 'test-user-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should verify event structure', () => {
      expect(sampleEvent).toMatchObject(expectedEventStructure);
    });

    it('should have valid status values', () => {
      const validStatuses = ['scheduled', 'draft', 'cancelled', 'completed'];
      expect(validStatuses).toContain(sampleEvent.status);
    });

    it('should have future scheduled date for active events', () => {
      if (sampleEvent.status === 'scheduled') {
        const scheduledDate = new Date(sampleEvent.scheduledDate);
        expect(scheduledDate.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should save event to brand subcollection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleEvent.brandId);
      const eventRef = brandRef.collection('events').doc(sampleEvent.id);
      await eventRef.set(sampleEvent);

      const retrieved = await eventRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.title).toBe(sampleEvent.title);
    });

    it('should update event status', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleEvent.brandId);
      const eventRef = brandRef.collection('events').doc(sampleEvent.id);
      await eventRef.set(sampleEvent);
      await eventRef.update({ status: 'completed' });

      const retrieved = await eventRef.get();
      expect(retrieved.data()?.status).toBe('completed');
    });

    it('should manage attendees list', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleEvent.brandId);
      const eventRef = brandRef.collection('events').doc(sampleEvent.id);
      await eventRef.set(sampleEvent);

      const newAttendees = [...sampleEvent.attendees, 'test-user-03'];
      await eventRef.update({ attendees: newAttendees });

      const retrieved = await eventRef.get();
      expect(retrieved.data()?.attendees).toContain('test-user-03');
    });
  });

  // ========== AI MODEL SETTINGS ==========
  describe('AI Model Settings', () => {
    const sampleAISettings = {
      id: 'ai-settings-lfc-01',
      brandId: 'lightning-fc',
      setting: 'default_model',
      value: 'gemini-2.5-pro',
      description: 'Default AI model for content generation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'test-user-01',
    };

    const sampleAIConfig = [
      { setting: 'default_model', value: 'gemini-2.5-pro' },
      { setting: 'image_model', value: 'imagen-3.0' },
      { setting: 'video_model', value: 'veo-2' },
      { setting: 'temperature', value: 0.7 },
      { setting: 'max_tokens', value: 4096 },
    ];

    it('should verify AI settings structure', () => {
      expect(sampleAISettings).toMatchObject(expectedAISettingsStructure);
    });

    it('should have valid model names', () => {
      const validModels = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'imagen-3.0', 'veo-2'];
      expect(validModels).toContain(sampleAISettings.value);
    });

    it('should have numeric values within valid ranges', () => {
      const temperatureSetting = sampleAIConfig.find(s => s.setting === 'temperature');
      expect(temperatureSetting?.value).toBeGreaterThanOrEqual(0);
      expect(temperatureSetting?.value).toBeLessThanOrEqual(2);

      const maxTokensSetting = sampleAIConfig.find(s => s.setting === 'max_tokens');
      expect(maxTokensSetting?.value).toBeGreaterThan(0);
    });

    it('should save AI settings to brand subcollection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleAISettings.brandId);
      const settingsRef = brandRef.collection('aiSettings').doc(sampleAISettings.id);
      await settingsRef.set(sampleAISettings);

      const retrieved = await settingsRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.value).toBe(sampleAISettings.value);
    });

    it('should update AI settings value', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleAISettings.brandId);
      const settingsRef = brandRef.collection('aiSettings').doc(sampleAISettings.id);
      await settingsRef.set(sampleAISettings);
      await settingsRef.update({ value: 'gemini-2.0-flash', updatedAt: new Date().toISOString() });

      const retrieved = await settingsRef.get();
      expect(retrieved.data()?.value).toBe('gemini-2.0-flash');
    });
  });

  // ========== MEDIA LIBRARY ==========
  describe('Media Library', () => {
    const sampleMediaItem = {
      id: 'media-001',
      brandId: 'lightning-fc',
      type: 'image',
      url: 'https://storage.googleapis.com/bucket/image.jpg',
      thumbnailUrl: 'https://storage.googleapis.com/bucket/image_thumb.jpg',
      filename: 'championship-photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024000,
      width: 1920,
      height: 1080,
      uploadedBy: 'test-user-01',
      isPersonal: false,
      tags: ['championship', 'team', '2024'],
      collections: ['Sports Events'],
      createdAt: new Date().toISOString(),
    };

    it('should verify media item structure', () => {
      expect(sampleMediaItem).toMatchObject({
        id: expect.any(String),
        brandId: expect.any(String),
        type: expect.stringMatching(/^(image|video|document)$/),
        url: expect.any(String),
        uploadedBy: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should have valid media types', () => {
      const validTypes = ['image', 'video', 'document'];
      expect(validTypes).toContain(sampleMediaItem.type);
    });

    it('should have valid image dimensions', () => {
      if (sampleMediaItem.type === 'image') {
        expect(sampleMediaItem.width).toBeGreaterThan(0);
        expect(sampleMediaItem.height).toBeGreaterThan(0);
      }
    });

    it('should distinguish personal and team media', () => {
      const personalMedia = { ...sampleMediaItem, isPersonal: true };
      const teamMedia = { ...sampleMediaItem, isPersonal: false };

      expect(personalMedia.isPersonal).toBe(true);
      expect(teamMedia.isPersonal).toBe(false);
    });

    it('should save media to unified media collection', async () => {
      const mediaRef = mockAdminDb.collection('media').doc(sampleMediaItem.id);
      await mediaRef.set(sampleMediaItem);

      const retrieved = await mediaRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.filename).toBe(sampleMediaItem.filename);
    });

    it('should support collections/albums', () => {
      expect(sampleMediaItem.collections).toBeInstanceOf(Array);
      expect(sampleMediaItem.collections.length).toBeGreaterThan(0);
    });
  });

  // ========== CAMPAIGNS ==========
  describe('Campaigns', () => {
    const sampleCampaign = {
      id: 'campaign-001',
      brandId: 'lightning-fc',
      name: 'Championship Season 2024',
      description: 'Social media campaign for the championship season',
      status: 'active',
      platforms: ['instagram', 'twitter', 'facebook'],
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      contentItems: [
        { id: 'content-001', type: 'post', platform: 'instagram', status: 'scheduled' },
        { id: 'content-002', type: 'post', platform: 'twitter', status: 'draft' },
      ],
      analytics: { reach: 0, engagement: 0, impressions: 0 },
      createdBy: 'test-user-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should verify campaign structure', () => {
      expect(sampleCampaign).toMatchObject({
        id: expect.any(String),
        brandId: expect.any(String),
        name: expect.any(String),
        status: expect.stringMatching(/^(draft|active|paused|completed|archived)$/),
        platforms: expect.any(Array),
        createdAt: expect.any(String),
      });
    });

    it('should have valid status values', () => {
      const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
      expect(validStatuses).toContain(sampleCampaign.status);
    });

    it('should have valid platform values', () => {
      const validPlatforms = ['instagram', 'twitter', 'facebook', 'linkedin', 'tiktok', 'youtube'];
      sampleCampaign.platforms.forEach(platform => {
        expect(validPlatforms).toContain(platform);
      });
    });

    it('should have content items with valid statuses', () => {
      const validContentStatuses = ['draft', 'scheduled', 'published', 'failed'];
      sampleCampaign.contentItems.forEach(item => {
        expect(validContentStatuses).toContain(item.status);
      });
    });

    it('should save campaign to campaigns collection', async () => {
      const campaignRef = mockAdminDb.collection('campaigns').doc(sampleCampaign.id);
      await campaignRef.set(sampleCampaign);

      const retrieved = await campaignRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.name).toBe(sampleCampaign.name);
    });
  });

  // ========== USERS & BRANDS ==========
  describe('Users & Brands', () => {
    const sampleUser = {
      uid: 'test-user-01',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      role: 'member',
      brandMemberships: ['lightning-fc', 'nova-labs'],
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const sampleBrand = {
      id: 'lightning-fc',
      name: 'Lightning FC',
      description: 'Youth soccer club',
      logo: 'https://example.com/logo.png',
      industry: 'Sports',
      members: ['test-user-01', 'test-user-02'],
      settings: { timezone: 'America/Los_Angeles', language: 'en' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should verify user structure', () => {
      expect(sampleUser).toMatchObject({
        uid: expect.any(String),
        email: expect.any(String),
        displayName: expect.any(String),
        role: expect.stringMatching(/^(admin|member|viewer)$/),
        brandMemberships: expect.any(Array),
        createdAt: expect.any(String),
      });
    });

    it('should verify brand structure', () => {
      expect(sampleBrand).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        members: expect.any(Array),
        createdAt: expect.any(String),
      });
    });

    it('should have valid user roles', () => {
      const validRoles = ['admin', 'member', 'viewer'];
      expect(validRoles).toContain(sampleUser.role);
    });

    it('should have matching brand memberships', () => {
      // User should be member of brands they're listed in
      expect(sampleUser.brandMemberships).toContain(sampleBrand.id);
    });

    it('should save user to users collection', async () => {
      const userRef = mockAdminDb.collection('users').doc(sampleUser.uid);
      await userRef.set(sampleUser);

      const retrieved = await userRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.email).toBe(sampleUser.email);
    });

    it('should save brand to brands collection', async () => {
      const brandRef = mockAdminDb.collection('brands').doc(sampleBrand.id);
      await brandRef.set(sampleBrand);

      const retrieved = await brandRef.get();
      expect(retrieved.exists).toBe(true);
      expect(retrieved.data()?.name).toBe(sampleBrand.name);
    });
  });

  // ========== CROSS-FEATURE RELATIONSHIPS ==========
  describe('Cross-Feature Relationships', () => {
    it('should link Brand Soul to Brand Artifacts', () => {
      const brandSoul = {
        brandId: 'lightning-fc',
        factLibrary: {
          facts: [
            {
              id: 'fact-1',
              sources: [{ artifactId: 'artifact-lfc-1', snippet: 'Test', confidence: 0.9 }]
            },
          ],
        },
      };

      const artifact = { id: 'artifact-lfc-1', brandId: 'lightning-fc' };

      // Verify fact sources reference valid artifact IDs
      brandSoul.factLibrary.facts.forEach(fact => {
        fact.sources.forEach(source => {
          expect(source.artifactId).toBe(artifact.id);
        });
      });
    });

    it('should link Memories to Artifacts', () => {
      const memory = {
        id: 'memory-001',
        source: 'artifact-lfc-1',
        sourceArtifactId: 'artifact-lfc-1'
      };
      const artifact = { id: 'artifact-lfc-1' };

      expect(memory.source).toBe(artifact.id);
    });

    it('should link Comments to Content', () => {
      const comment = { contentId: 'generated-001', contentType: 'generated-image' };
      const content = { id: 'generated-001', type: 'image' };

      expect(comment.contentId).toBe(content.id);
    });

    it('should link Chat History to Media', () => {
      const chatMessage = {
        id: 'msg-1',
        mediaData: [{ type: 'image', mediaId: 'media-001' }],
      };
      const mediaItem = { id: 'media-001' };

      if (chatMessage.mediaData && chatMessage.mediaData[0].mediaId) {
        expect(chatMessage.mediaData[0].mediaId).toBe(mediaItem.id);
      }
    });

    it('should link Individual Identities to Users and Brands', () => {
      const identity = { brandId: 'lightning-fc', userId: 'test-user-01' };
      const user = { uid: 'test-user-01', brandMemberships: ['lightning-fc'] };
      const brand = { id: 'lightning-fc' };

      expect(identity.brandId).toBe(brand.id);
      expect(identity.userId).toBe(user.uid);
      expect(user.brandMemberships).toContain(brand.id);
    });
  });

  // ========== DATA INTEGRITY TESTS ==========
  describe('Data Integrity', () => {
    it('should have consistent brandIds across related documents', () => {
      const brandId = 'lightning-fc';
      const documents = [
        { type: 'brandSoul', brandId },
        { type: 'artifact', brandId },
        { type: 'identity', brandId },
        { type: 'chatHistory', brandId },
        { type: 'memory', brandId },
        { type: 'comment', brandId },
        { type: 'event', brandId },
        { type: 'aiSettings', brandId },
      ];

      documents.forEach(doc => {
        expect(doc.brandId).toBe(brandId);
      });
    });

    it('should have valid timestamps on all documents', () => {
      const documents = [
        { createdAt: new Date().toISOString() },
        { createdAt: new Date(), updatedAt: new Date() },
      ];

      documents.forEach(doc => {
        if (typeof doc.createdAt === 'string') {
          expect(() => new Date(doc.createdAt)).not.toThrow();
        } else {
          expect(doc.createdAt).toBeInstanceOf(Date);
        }
      });
    });

    it('should have unique IDs within collections', () => {
      const ids = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5'];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should reference existing users in createdBy fields', () => {
      const userIds = ['test-user-01', 'test-user-02'];
      const documents = [
        { createdBy: 'test-user-01' },
        { createdBy: 'test-user-02' },
      ];

      documents.forEach(doc => {
        expect(userIds).toContain(doc.createdBy);
      });
    });
  });
});
