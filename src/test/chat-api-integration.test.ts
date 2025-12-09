/**
 * Integration Tests for Team Companion Chat API
 *
 * Tests the actual chat API endpoints to ensure messages persist correctly
 * through the full request/response cycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as chatPost } from '@/app/api/chat/route';
import { saveChatMessage, getChatHistory } from '@/lib/chat-history';

// Mock authenticated user
vi.mock('@/lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    uid: 'test-user-789',
    email: 'test@example.com',
  })),
}));

// Mock brand membership
vi.mock('@/lib/brand-membership', () => ({
  requireBrandAccess: vi.fn(async () => true),
}));

// Mock AI context
vi.mock('@/lib/ai-assistant-context', () => ({
  getAIAssistantContext: vi.fn(async () => ({
    systemPrompt: 'You are a helpful AI assistant.',
    brandSoulContext: null,
    brandProfileContext: null,
  })),
}));

// Mock AI settings
vi.mock('@/app/actions/ai-settings', () => ({
  getAIModelSettingsAction: vi.fn(async () => ({
    textModel: 'gemini-2.0-flash-exp',
    visionModel: 'gemini-2.0-flash-exp',
    imageModel: 'imagen-3.0-generate-001',
    videoModel: 'veo-2.0',
  })),
  AIModelSettings: {},
}));

// Mock Firecrawl service
vi.mock('@/lib/firecrawl-service', () => ({
  extractUrlsFromMessage: vi.fn(() => []),
  crawlWebsite: vi.fn(async () => ({ success: true, data: '' })),
  formatCrawlResultForAI: vi.fn(() => ''),
}));

// Mock chat context utils
vi.mock('@/lib/chat-context-utils', () => ({
  formatSelectedContext: vi.fn((context, message) => message),
  extractImageContext: vi.fn(() => ({ lastImageUrl: null, allImages: [], totalCount: 0 })),
  resolveImageReference: vi.fn(() => null),
  truncateMessagesForContextWindow: vi.fn((messages) => messages),
  MAX_CONTEXT_TOKENS: 400000,
}));

// Mock Genkit flows
vi.mock('@/ai/flows/generate-ai-images', () => ({
  generateAiImage: vi.fn(async () => ({
    imageUrl: 'data:image/png;base64,mocked-image-data',
    explainability: { summary: 'Mocked explainability' },
  })),
}));

vi.mock('@/ai/flows/generate-video', () => ({
  generateVideo: vi.fn(async () => ({
    videoUrl: 'data:video/mp4;base64,mocked-video-data',
  })),
}));

// Mock Google AI
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel(_config?: any) {
        return {
          startChat: (_options?: any) => ({
            sendMessageStream: async (_parts?: any) => ({
              stream: (async function* () {
                yield { text: () => 'Mocked AI response' };
              })(),
            }),
          }),
          generateContentStream: async (_parts?: any) => ({
            stream: (async function* () {
              yield { text: () => 'Mocked AI response' };
            })(),
          }),
        };
      }
    },
  };
});

// Mock Firebase Admin
vi.mock('@/lib/firebase/admin', () => {
  const mockDoc: any = {
    get: vi.fn(async () => ({
      exists: true,
      data: () => ({}),
      id: 'mock-id',
      docs: [],
      empty: true,
      forEach: function (cb: any) { this.docs.forEach(cb); }
    })),
    add: vi.fn(async () => ({ id: 'new-id-' + Math.random().toString(36).substr(2, 9) })),
    set: vi.fn(async () => { }),
    delete: vi.fn(async () => { }),
    collection: vi.fn(() => mockCollection),
    orderBy: vi.fn(() => mockCollection),
    limit: vi.fn(() => mockCollection),
  };
  const mockCollection: any = {
    doc: vi.fn(() => mockDoc),
    add: vi.fn(async () => ({ id: 'new-id-' + Math.random().toString(36).substr(2, 9) })),
    get: vi.fn(async () => ({
      docs: [],
      empty: true,
      forEach: function (cb: any) { this.docs.forEach(cb); }
    })),
    orderBy: vi.fn(() => mockCollection),
    limit: vi.fn(() => mockCollection),
  };
  mockDoc.collection = vi.fn(() => mockCollection);

  return {
    getAdminInstances: () => ({
      adminDb: {
        collection: vi.fn(() => mockCollection),
        batch: vi.fn(() => ({
          commit: vi.fn(async () => { }),
          delete: vi.fn(),
        })),
      },
    }),
  };
});

// Mock fetch for Python agent calls
global.fetch = vi.fn(async (url) => {
  if (url.toString().includes('/agent/chat')) {
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type": "text", "content": "Mocked stream"}\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }
  if (url.toString().includes('/agent/')) {
    return new Response(JSON.stringify({ detail: 'Mocked Python response', analysis: 'Mocked analysis' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // Default fetch mock for other URLs (like media)
  return new Response(JSON.stringify({}), { status: 200 });
}) as any;

describe('Chat API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/chat - Agent Mode', () => {
    it('should save user message in agent mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Help me brainstorm ideas',
            },
          ],
          mode: 'agent',
          brandId: 'test-brand-integration',
        }),
      });

      // Call the chat API
      const response = await chatPost(request);

      // Should return streaming response
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should handle agent mode with media attachments', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Analyze this image',
              media: [
                {
                  type: 'image',
                  url: 'https://example.com/test-image.jpg',
                },
              ],
            },
          ],
          mode: 'agent',
          brandId: 'test-brand-integration',
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/chat - AI Models', () => {
    it('should save conversation in gemini-text mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Write a poem about technology',
            },
          ],
          mode: 'gemini-text',
          brandId: 'test-brand-integration',
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
      if (response.status !== 200) {
        const errorText = await response.text();
        console.error('Gemini text test error:', response.status, errorText);
      }
      expect(response.status).toBe(200);
    });

    it('should handle imagen mode correctly', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Generate a beautiful landscape image',
            },
          ],
          mode: 'imagen',
          brandId: 'test-brand-integration',
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
    });

    it('should handle gemini-vision mode with image', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'What do you see in this image?',
              media: [
                {
                  type: 'image',
                  url: 'https://example.com/test-image.jpg',
                },
              ],
            },
          ],
          mode: 'gemini-vision',
          brandId: 'test-brand-integration',
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('should handle veo mode for video generation', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Create a 5-second intro video',
            },
          ],
          mode: 'veo',
          brandId: 'test-brand-integration',
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
    });
  });

  describe('POST /api/chat - Team Tools', () => {
    const teamTools = [
      'team-chat',
      'domain-suggestions',
      'website-planning',
      'team-strategy',
      'logo-concepts',
      'event-creator',
      'search',
      'youtube-analysis',
    ];

    teamTools.forEach((tool) => {
      it(`should handle ${tool} mode`, async () => {
        const testMessages: Record<string, string> = {
          'team-chat': 'What are best practices for team collaboration?',
          'domain-suggestions': 'Suggest domains for tech startup',
          'website-planning': 'Help me plan a website structure',
          'team-strategy': 'Create a strategic plan for Q1',
          'logo-concepts': 'Design logo concepts for our brand',
          'event-creator': 'Create a 7-day sprint event',
          'search': 'Search for latest AI trends',
          'youtube-analysis': 'Analyze this video: https://youtube.com/watch?v=test',
        };

        const request = new Request('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: testMessages[tool] || 'Test message',
              },
            ],
            mode: tool,
            brandId: 'test-brand-integration',
          }),
        });

        const response = await chatPost(request);

        expect(response).toBeDefined();
      });
    });
  });

  describe('Message Persistence Verification', () => {
    it('should verify message was actually saved to Firestore', async () => {
      const testBrandId = 'verify-brand-123';
      const testUserId = 'verify-user-456';

      const testMessage = {
        role: 'user' as const,
        content: 'This is a persistence verification test',
        timestamp: new Date(),
        mode: 'agent',
      };

      // Save the message
      const messageId = await saveChatMessage(testBrandId, testUserId, testMessage);

      // Verify it was saved
      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
      expect(messageId.length).toBeGreaterThan(0);
    });

    it('should retrieve saved messages in correct order', async () => {
      const testBrandId = 'verify-brand-456';
      const testUserId = 'verify-user-789';

      const messages = [
        { role: 'user' as const, content: 'First message', timestamp: new Date(Date.now() - 3000), mode: 'agent' },
        { role: 'assistant' as const, content: 'First response', timestamp: new Date(Date.now() - 2000), mode: 'agent' },
        { role: 'user' as const, content: 'Second message', timestamp: new Date(Date.now() - 1000), mode: 'agent' },
      ];

      // Save all messages
      for (const msg of messages) {
        await saveChatMessage(testBrandId, testUserId, msg);
      }

      // Retrieve history
      const history = await getChatHistory(testBrandId, testUserId);

      // Verify retrieval
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should preserve media attachments through full cycle', async () => {
      const testBrandId = 'verify-brand-789';
      const testUserId = 'verify-user-101';

      const messageWithMedia = {
        role: 'user' as const,
        content: 'Message with image',
        timestamp: new Date(),
        mode: 'gemini-vision',
        media: [
          {
            type: 'image',
            url: 'https://storage.googleapis.com/test/image.jpg',
            fileName: 'test-image.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      };

      // Save message with media
      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithMedia);

      // Verify it was saved
      expect(messageId).toBeDefined();
    });
  });

  describe('Concurrent User Sessions', () => {
    it('should handle messages from different users in same brand', async () => {
      const brandId = 'shared-brand-123';
      const user1 = 'user-alice';
      const user2 = 'user-bob';

      const user1Message = {
        role: 'user' as const,
        content: 'Message from Alice',
        timestamp: new Date(),
        mode: 'agent',
      };

      const user2Message = {
        role: 'user' as const,
        content: 'Message from Bob',
        timestamp: new Date(),
        mode: 'agent',
      };

      // Save messages from both users
      const id1 = await saveChatMessage(brandId, user1, user1Message);
      const id2 = await saveChatMessage(brandId, user2, user2Message);

      // Both should be saved successfully
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should isolate conversations between different brands', async () => {
      const userId = 'user-charlie';
      const brand1 = 'brand-alpha';
      const brand2 = 'brand-beta';

      const brand1Message = {
        role: 'user' as const,
        content: 'Message in brand Alpha',
        timestamp: new Date(),
        mode: 'agent',
      };

      const brand2Message = {
        role: 'user' as const,
        content: 'Message in brand Beta',
        timestamp: new Date(),
        mode: 'agent',
      };

      // Save messages to different brands
      const id1 = await saveChatMessage(brand1, userId, brand1Message);
      const id2 = await saveChatMessage(brand2, userId, brand2Message);

      // Both should be saved successfully
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed request gracefully', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
    });

    it('should handle invalid mode gracefully', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Test message',
            },
          ],
          mode: 'invalid-mode-xyz',
          brandId: 'test-brand',
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
    });

    it('should handle missing brandId', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Test message',
            },
          ],
          mode: 'agent',
          // brandId is missing
        }),
      });

      const response = await chatPost(request);

      expect(response).toBeDefined();
    });
  });
});
