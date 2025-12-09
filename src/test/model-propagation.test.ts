import { vi, describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies using hoisted to ensure they run before imports
vi.mock('../lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ uid: 'test-user' }),
}));

vi.mock('../lib/brand-membership', () => ({
  requireBrandAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock('../app/actions/ai-settings', () => ({
  getAIModelSettingsAction: vi.fn().mockResolvedValue({
    textModel: 'test-text-model',
    agentModel: 'test-agent-model',
    teamChatModel: 'test-team-chat-model',
    imageModel: 'test-image-model',
    imageEditModel: 'test-image-edit-model',
    videoModel: 'test-video-model',
  }),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      startChat: vi.fn().mockReturnValue({
        sendMessageStream: vi.fn().mockResolvedValue({
          stream: [
            { text: () => 'Test response' }
          ]
        }),
      }),
    }),
  })),
}));

vi.mock('../ai/flows/generate-video', () => ({
  generateVideo: vi.fn().mockResolvedValue({ videoUrl: 'data:video/mp4;base64,test' }),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  body: {
    getReader: () => ({
      read: async () => ({ done: true, value: undefined }),
    }),
  },
  json: async () => ({ success: true }),
});

// Import after mocks
import { POST } from '../app/api/chat/route';

describe('API Model Propagation', () => {

  it('should pass correct settings to ADK Agent', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello agent' }],
        mode: 'agent',
        brandId: 'test-brand',
      }),
    });

    await POST(req);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/agent/chat'),
      expect.objectContaining({
        body: expect.stringContaining('"agentModel":"test-agent-model"'),
      })
    );
  });
});
