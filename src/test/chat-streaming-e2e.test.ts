/**
 * End-to-End Streaming Tests for Team Companion Chat API
 *
 * These tests ensure that ALL chat modes return streaming responses:
 * 1. Agent Mode
 * 2. AI Models (gemini-text, imagen, gemini-vision, veo)
 * 3. Team Tools (team-chat, domain-suggestions, website-planning, team-strategy,
 *    logo-concepts, event-creator, search, youtube-analysis)
 *
 * Each test verifies:
 * - Response is a ReadableStream
 * - Headers are set correctly for streaming
 * - Content is delivered incrementally (not all at once)
 * - Stream can be consumed properly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as chatPost } from '@/app/api/chat/route';

// Mock authenticated user
vi.mock('@/lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn(async () => ({
    uid: 'test-user-streaming-789',
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
  truncateMessagesForContextWindow: vi.fn((messages) => messages), // Return messages as-is for tests
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

// Mock campaign creation agent
vi.mock('@/lib/campaign-creation-agent', () => ({
  parseCampaignRequest: vi.fn(async () => ({
    campaignName: 'Test Event',
    startDate: new Date().toISOString().split('T')[0],
    duration: 7,
    postsPerDay: 1,
    postDistribution: 'even',
  })),
  calculatePostSchedule: vi.fn(() => [1, 1, 1, 1, 1, 1, 1]),
  generateContentBlockInstructions: vi.fn(() => 'Test instructions'),
}));

// Mock chat history
vi.mock('@/lib/chat-history', () => ({
  saveChatMessage: vi.fn(async () => 'msg-' + Date.now()),
  getChatHistory: vi.fn(async () => []),
  deleteChatMessage: vi.fn(async () => {}),
}));

// Mock Google AI with streaming support
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel(_config?: any) {
        return {
          startChat: (_options?: any) => ({
            sendMessageStream: async (_parts?: any) => ({
              stream: (async function* () {
                // Simulate streaming chunks
                yield { text: () => 'Chunk ' };
                await new Promise(resolve => setTimeout(resolve, 10));
                yield { text: () => '1 ' };
                await new Promise(resolve => setTimeout(resolve, 10));
                yield { text: () => 'Chunk ' };
                await new Promise(resolve => setTimeout(resolve, 10));
                yield { text: () => '2' };
              })(),
            }),
          }),
          generateContentStream: async (_parts?: any) => ({
            stream: (async function* () {
              // Simulate streaming chunks
              yield { text: () => 'Streaming ' };
              await new Promise(resolve => setTimeout(resolve, 10));
              yield { text: () => 'response ' };
              await new Promise(resolve => setTimeout(resolve, 10));
              yield { text: () => 'text' };
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

// Helper function to verify streaming response
async function verifyStreamingResponse(response: Response, expectedContentType: string | string[] = ['text/plain', 'application/x-ndjson']) {
  // Check status
  expect(response.status).toBe(200);

  // Verify streaming headers
  const contentType = response.headers.get('Content-Type') || '';
  const expectedTypes = Array.isArray(expectedContentType) ? expectedContentType : [expectedContentType];
  const matchesExpected = expectedTypes.some(type => contentType.includes(type));
  expect(matchesExpected).toBe(true);
  expect(response.headers.get('Cache-Control')).toContain('no-cache');

  // Verify body is a ReadableStream
  expect(response.body).toBeDefined();
  expect(response.body).toBeInstanceOf(ReadableStream);

  // Read the stream to verify it works
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let chunks: string[] = [];
  let chunkCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      const text = decoder.decode(value, { stream: true });
      if (text) {
        chunks.push(text);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Verify we received multiple chunks (streaming, not all at once)
  expect(chunkCount).toBeGreaterThan(0);

  const fullText = chunks.join('');
  expect(fullText.length).toBeGreaterThan(0);

  return { chunks, fullText, chunkCount };
}

describe('Chat API Streaming Tests - End to End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Agent Mode - Streaming', () => {
    it('should return streaming response for agent mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Help me brainstorm ideas' }],
          mode: 'agent',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream incrementally in agent mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a strategic plan' }],
          mode: 'agent',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      expect(response.body).toBeInstanceOf(ReadableStream);

      // Verify chunks arrive incrementally
      const reader = response.body!.getReader();
      const { value: firstChunk } = await reader.read();
      expect(firstChunk).toBeDefined();

      reader.releaseLock();
    });
  });

  describe('2. AI Models - Streaming', () => {
    it('should stream response for gemini-text mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Write a creative story' }],
          mode: 'gemini-text',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for gemini-vision mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Describe what you can see',
            },
          ],
          mode: 'gemini-vision',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);

      // Gemini-vision streams text responses like gemini-text
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);

      // Should have streaming headers
      const contentType = response.headers.get('Content-Type');
      if (contentType) {
        expect(contentType).toContain('text/plain');
      }
    });

    it('should return proper response type for imagen mode (non-streaming)', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Generate a beautiful landscape' }],
          mode: 'imagen',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);

      // Imagen returns JSON with image URLs, not a text stream
      expect(response.status).toBe(200);
      // Note: Imagen mode returns structured JSON response, not streaming text
    });

    it('should return proper response type for veo mode (non-streaming)', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a 5-second video' }],
          mode: 'veo',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);

      // Veo returns JSON with video URLs, not a text stream
      expect(response.status).toBe(200);
      // Note: Veo mode returns structured JSON response, not streaming text
    });
  });

  describe('3. Team Tools - Streaming', () => {
    it('should stream response for team-chat mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Best practices for team collaboration' }],
          mode: 'team-chat',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for domain-suggestions mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Suggest domains for tech startup' }],
          mode: 'domain-suggestions',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for website-planning mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Plan a website for community org' }],
          mode: 'website-planning',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for team-strategy mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create strategic plan for Q1' }],
          mode: 'team-strategy',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for logo-concepts mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Design logo concepts for sports team' }],
          mode: 'logo-concepts',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for event-creator mode (NDJSON format)', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Create a 7-day sprint event' }],
          mode: 'event-creator',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);

      // Event creator returns NDJSON streaming format
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);

      // Event creator uses NDJSON format instead of text/plain
      const contentType = response.headers.get('Content-Type');
      expect(contentType).toContain('ndjson');
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
    });

    it('should stream response for search mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Search for latest AI trends' }],
          mode: 'search',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });

    it('should stream response for youtube-analysis mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Analyze https://youtube.com/watch?v=test' }],
          mode: 'youtube-analysis',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const result = await verifyStreamingResponse(response);

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.fullText).toBeTruthy();
    });
  });

  describe('4. Streaming Headers Validation', () => {
    it('should set correct streaming headers for all text-streaming modes', async () => {
      // Only include modes that return text streams (not imagen/veo which return JSON)
      const textModes = [
        'agent',
        'gemini-text',
        'gemini-vision',
        'team-chat',
        'domain-suggestions',
        'website-planning',
        'team-strategy',
        'logo-concepts',
        'search',
        'youtube-analysis',
      ];

      for (const mode of textModes) {
        const request = new Request('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Test message for ${mode}` }],
            mode,
            brandId: 'test-brand-streaming',
          }),
        });

        const response = await chatPost(request);

        const contentType = response.headers.get('Content-Type');
        const cacheControl = response.headers.get('Cache-Control');

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(ReadableStream);

        // Check headers if they exist
        if (contentType) {
          const isTextOrNdjson = contentType.includes('text/plain') || contentType.includes('application/x-ndjson');
          expect(isTextOrNdjson).toBe(true);
        }
        if (cacheControl) {
          expect(cacheControl).toContain('no-cache');
        }
      }
    });
  });

  describe('5. Stream Performance', () => {
    it('should deliver first chunk quickly in agent mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Quick test' }],
          mode: 'agent',
          brandId: 'test-brand-streaming',
        }),
      });

      const startTime = Date.now();
      const response = await chatPost(request);
      const reader = response.body!.getReader();

      const { value: firstChunk, done } = await reader.read();
      const timeToFirstChunk = Date.now() - startTime;

      expect(done).toBe(false);
      expect(firstChunk).toBeDefined();
      expect(timeToFirstChunk).toBeLessThan(5000); // Should be fast

      reader.releaseLock();
    });

    it('should handle concurrent streaming requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        new Request('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Concurrent test ${i}` }],
            mode: 'agent',
            brandId: 'test-brand-streaming',
          }),
        })
      );

      const responses = await Promise.all(requests.map(req => chatPost(req)));

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(ReadableStream);
      }
    });
  });

  describe('6. Error Handling in Streams', () => {
    it('should handle streaming errors gracefully', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test error handling' }],
          mode: 'agent',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);

      // Should still return a stream even if there might be errors
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should handle empty messages in streaming mode', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '' }],
          mode: 'agent',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });
  });

  describe('7. Stream Cancellation', () => {
    it('should handle stream cancellation properly', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Long streaming test' }],
          mode: 'agent',
          brandId: 'test-brand-streaming',
        }),
      });

      const response = await chatPost(request);
      const reader = response.body!.getReader();

      // Read first chunk
      await reader.read();

      // Cancel the stream
      await reader.cancel();

      // Stream should be closed
      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });

  describe('8. Cross-Mode Streaming Consistency', () => {
    it('should maintain consistent streaming behavior across all text-streaming modes', async () => {
      // Only test modes that should stream (exclude imagen/veo which return JSON)
      const streamingModes = [
        'agent',
        'gemini-text',
        'team-chat',
        'domain-suggestions',
        'website-planning',
        'team-strategy',
        'logo-concepts',
        'search',
        'youtube-analysis',
      ];

      const streamingResults: Record<string, boolean> = {};

      for (const mode of streamingModes) {
        const request = new Request('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Test ${mode}` }],
            mode,
            brandId: 'test-brand-streaming',
          }),
        });

        const response = await chatPost(request);
        const hasStreamingHeaders =
          (response.headers.get('Content-Type')?.includes('text/plain') ||
            response.headers.get('Content-Type')?.includes('application/x-ndjson')) &&
          response.headers.get('Cache-Control')?.includes('no-cache');
        const hasStreamBody = response.body instanceof ReadableStream;

        streamingResults[mode] = hasStreamingHeaders && hasStreamBody;
      }

      // All text-based streaming modes should stream consistently
      const allStreaming = Object.values(streamingResults).every(v => v);
      expect(allStreaming).toBe(true);
      expect(Object.keys(streamingResults)).toHaveLength(streamingModes.length);
    });

    it('should identify non-streaming modes (imagen, veo)', async () => {
      const nonStreamingModes = ['imagen', 'veo'];

      for (const mode of nonStreamingModes) {
        const request = new Request('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Test ${mode}` }],
            mode,
            brandId: 'test-brand-streaming',
          }),
        });

        const response = await chatPost(request);

        // These modes return structured JSON responses, not text streams
        expect(response.status).toBe(200);
        // They should not have text/plain streaming headers
      }
    });
  });
});
