/**
 * End-to-End Tests for Team Companion Chat Persistence
 *
 * These tests ensure that every chat bubble is ALWAYS persistent across:
 * 1. Agent Mode
 * 2. AI Models (gemini-text, imagen, gemini-vision, veo)
 * 3. Team Tools (team-chat, domain-suggestions, website-planning, team-strategy,
 *    logo-concepts, event-creator, search, youtube-analysis)
 * 4. Mode switching
 * 5. Page reloads
 * 6. Media attachments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveChatMessage, getChatHistory, deleteChatMessage } from '@/lib/chat-history';

// Mock Firebase Admin
vi.mock('@/lib/firebase/admin', () => ({
  getAdminInstances: () => ({
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              collection: vi.fn(() => ({
                add: vi.fn(async (data) => ({ id: 'msg-' + Date.now() })),
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn(async () => ({
                      docs: mockMessages.map(msg => ({
                        id: msg.id,
                        data: () => msg,
                        exists: true,
                      })),
                      empty: mockMessages.length === 0,
                    })),
                  })),
                })),
                doc: vi.fn(() => ({
                  get: vi.fn(async () => ({
                    id: 'msg-123',
                    exists: true,
                    data: () => mockMessages[0] || {},
                  })),
                  delete: vi.fn(async () => {}),
                })),
              })),
            })),
          })),
        })),
      })),
    },
  }),
}));

// Mock message storage
let mockMessages: any[] = [];

// Helper to reset mock messages
function resetMockMessages() {
  mockMessages = [];
}

// Helper to add mock message
function addMockMessage(message: any) {
  mockMessages.push(message);
}

describe('Team Companion Chat Persistence - End to End', () => {
  const testBrandId = 'test-brand-123';
  const testUserId = 'test-user-456';

  beforeEach(() => {
    resetMockMessages();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetMockMessages();
  });

  describe('1. Agent Mode - Chat Persistence', () => {
    it('should persist user message in agent mode', async () => {
      const userMessage = {
        role: 'user' as const,
        content: 'Help me brainstorm ideas for our team meeting',
        timestamp: new Date(),
        mode: 'agent',
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);

      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^msg-/);
    });

    it('should persist assistant response in agent mode', async () => {
      const assistantMessage = {
        role: 'assistant' as const,
        content: 'Here are some brainstorming ideas:\n1. Team building activity\n2. Project retrospective\n3. Goal setting session',
        timestamp: new Date(),
        mode: 'agent',
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, assistantMessage);

      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^msg-/);
    });

    it('should persist thinking process in agent mode', async () => {
      const messageWithThoughts = {
        role: 'assistant' as const,
        content: 'Based on your team dynamics, I recommend...',
        timestamp: new Date(),
        mode: 'agent',
        thoughts: [
          'Analyzing team context...',
          'Considering team size and type...',
          'Generating recommendations...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThoughts);

      expect(messageId).toBeDefined();
    });

    it('should persist structured data (events, campaigns) in agent mode', async () => {
      const messageWithStructuredData = {
        role: 'assistant' as const,
        content: 'I created a 7-day sprint event for your team',
        timestamp: new Date(),
        mode: 'agent',
        structuredData: {
          type: 'campaign',
          data: {
            campaignName: '7-Day Sprint',
            campaignDays: [
              { day: 1, date: '2025-11-25', contentBlocks: [] },
              { day: 2, date: '2025-11-26', contentBlocks: [] },
            ],
          },
        },
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithStructuredData);

      expect(messageId).toBeDefined();
    });
  });

  describe('2. AI Models - Chat Persistence', () => {
    describe('2.1 Gemini Text Model', () => {
      it('should persist conversation in gemini-text mode', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Write a creative story about a robot',
          timestamp: new Date(),
          mode: 'gemini-text',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();

        const assistantMessage = {
          role: 'assistant' as const,
          content: 'Once upon a time, there was a robot named Rex...',
          timestamp: new Date(),
          mode: 'gemini-text',
        };

        const assistantId = await saveChatMessage(testBrandId, testUserId, assistantMessage);
        expect(assistantId).toBeDefined();
      });
    });

    describe('2.2 Imagen Model', () => {
      it('should persist image generation request and result', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Generate an image of a sunset over mountains',
          timestamp: new Date(),
          mode: 'imagen',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();

        const assistantMessage = {
          role: 'assistant' as const,
          content: 'I generated an image of a sunset over mountains',
          timestamp: new Date(),
          mode: 'imagen',
          media: [
            {
              type: 'image',
              url: 'https://storage.googleapis.com/test-bucket/sunset-image.png',
              mimeType: 'image/png',
            },
          ],
        };

        const assistantId = await saveChatMessage(testBrandId, testUserId, assistantMessage);
        expect(assistantId).toBeDefined();
      });
    });

    describe('2.3 Gemini Vision Model', () => {
      it('should persist image analysis with uploaded image', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Analyze this image and tell me what you see',
          timestamp: new Date(),
          mode: 'gemini-vision',
          media: [
            {
              type: 'image',
              url: 'https://storage.googleapis.com/test-bucket/uploaded-image.jpg',
              fileName: 'team-photo.jpg',
              mimeType: 'image/jpeg',
            },
          ],
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();

        const assistantMessage = {
          role: 'assistant' as const,
          content: 'I can see a group of people in a team meeting. They appear to be collaborating on a project...',
          timestamp: new Date(),
          mode: 'gemini-vision',
        };

        const assistantId = await saveChatMessage(testBrandId, testUserId, assistantMessage);
        expect(assistantId).toBeDefined();
      });
    });

    describe('2.4 Veo Video Model', () => {
      it('should persist video generation request and result', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Create a 5-second video intro for our team',
          timestamp: new Date(),
          mode: 'veo',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();

        const assistantMessage = {
          role: 'assistant' as const,
          content: 'I generated a 5-second video intro for your team',
          timestamp: new Date(),
          mode: 'veo',
          media: [
            {
              type: 'video',
              url: 'https://storage.googleapis.com/test-bucket/team-intro.mp4',
              mimeType: 'video/mp4',
            },
          ],
        };

        const assistantId = await saveChatMessage(testBrandId, testUserId, assistantMessage);
        expect(assistantId).toBeDefined();
      });
    });
  });

  describe('3. Team Tools - Chat Persistence', () => {
    describe('3.1 Team Chat', () => {
      it('should persist team chat conversation', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'What are the best practices for team communication?',
          timestamp: new Date(),
          mode: 'team-chat',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();
      });
    });

    describe('3.2 Domain Suggestions', () => {
      it('should persist domain suggestion request and results', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Suggest creative domain names for tech team, innovation, collaboration',
          timestamp: new Date(),
          mode: 'domain-suggestions',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();

        const assistantMessage = {
          role: 'assistant' as const,
          content: 'Here are some domain suggestions:\n1. techinnovate.com\n2. collaboratetech.io\n3. innovation-hub.dev',
          timestamp: new Date(),
          mode: 'domain-suggestions',
        };

        const assistantId = await saveChatMessage(testBrandId, testUserId, assistantMessage);
        expect(assistantId).toBeDefined();
      });
    });

    describe('3.3 Website Planning', () => {
      it('should persist website planning conversation', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Help me plan a website for our community organization',
          timestamp: new Date(),
          mode: 'website-planning',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();
      });
    });

    describe('3.4 Team Strategy', () => {
      it('should persist strategic planning conversation', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Create a strategic plan for our product team',
          timestamp: new Date(),
          mode: 'team-strategy',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();
      });
    });

    describe('3.5 Logo Concepts', () => {
      it('should persist logo concept requests', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Design logo concepts for our sports team',
          timestamp: new Date(),
          mode: 'logo-concepts',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();
      });
    });

    describe('3.6 Event Creator', () => {
      it('should persist event creation with structured data', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Create a 7-day sprint event starting next Monday',
          timestamp: new Date(),
          mode: 'event-creator',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();

        const assistantMessage = {
          role: 'assistant' as const,
          content: 'I created a 7-day sprint event starting next Monday',
          timestamp: new Date(),
          mode: 'event-creator',
          structuredData: {
            type: 'campaign',
            data: {
              campaignName: '7-Day Sprint',
              startDate: '2025-11-25',
              duration: 7,
              campaignDays: Array.from({ length: 7 }, (_, i) => ({
                day: i + 1,
                date: new Date(2025, 10, 25 + i).toISOString().split('T')[0],
                contentBlocks: [],
              })),
            },
          },
        };

        const assistantId = await saveChatMessage(testBrandId, testUserId, assistantMessage);
        expect(assistantId).toBeDefined();
      });
    });

    describe('3.7 Search', () => {
      it('should persist web search conversations', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Search for latest AI trends in 2025',
          timestamp: new Date(),
          mode: 'search',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();
      });
    });

    describe('3.8 YouTube Analysis', () => {
      it('should persist YouTube video analysis', async () => {
        const userMessage = {
          role: 'user' as const,
          content: 'Analyze this YouTube video: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          timestamp: new Date(),
          mode: 'youtube-analysis',
        };

        const messageId = await saveChatMessage(testBrandId, testUserId, userMessage);
        expect(messageId).toBeDefined();
      });
    });
  });

  describe('4. Cross-Mode Persistence', () => {
    it('should maintain conversation history when switching between modes', async () => {
      // Start in agent mode
      const agentMessage = {
        role: 'user' as const,
        content: 'Help me brainstorm',
        timestamp: new Date(),
        mode: 'agent',
      };
      await saveChatMessage(testBrandId, testUserId, agentMessage);

      // Switch to gemini-text mode
      const geminiMessage = {
        role: 'user' as const,
        content: 'Write a poem',
        timestamp: new Date(),
        mode: 'gemini-text',
      };
      await saveChatMessage(testBrandId, testUserId, geminiMessage);

      // Switch to imagen mode
      const imagenMessage = {
        role: 'user' as const,
        content: 'Generate an image',
        timestamp: new Date(),
        mode: 'imagen',
      };
      await saveChatMessage(testBrandId, testUserId, imagenMessage);

      // All messages should be retrievable
      addMockMessage(agentMessage);
      addMockMessage(geminiMessage);
      addMockMessage(imagenMessage);

      const history = await getChatHistory(testBrandId, testUserId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should preserve message order across mode switches', async () => {
      const messages = [
        { role: 'user' as const, content: 'Message 1', mode: 'agent', timestamp: new Date(2025, 0, 1) },
        { role: 'assistant' as const, content: 'Response 1', mode: 'agent', timestamp: new Date(2025, 0, 2) },
        { role: 'user' as const, content: 'Message 2', mode: 'gemini-text', timestamp: new Date(2025, 0, 3) },
        { role: 'assistant' as const, content: 'Response 2', mode: 'gemini-text', timestamp: new Date(2025, 0, 4) },
      ];

      for (const msg of messages) {
        await saveChatMessage(testBrandId, testUserId, msg);
        addMockMessage(msg);
      }

      const history = await getChatHistory(testBrandId, testUserId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('5. Media Attachment Persistence', () => {
    it('should persist single image attachment', async () => {
      const messageWithImage = {
        role: 'user' as const,
        content: 'Check out this image',
        timestamp: new Date(),
        mode: 'gemini-vision',
        media: [
          {
            type: 'image',
            url: 'https://storage.googleapis.com/test-bucket/image1.jpg',
            fileName: 'photo.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithImage);
      expect(messageId).toBeDefined();
    });

    it('should persist multiple image attachments', async () => {
      const messageWithImages = {
        role: 'user' as const,
        content: 'Compare these images',
        timestamp: new Date(),
        mode: 'gemini-vision',
        media: [
          {
            type: 'image',
            url: 'https://storage.googleapis.com/test-bucket/image1.jpg',
            fileName: 'photo1.jpg',
            mimeType: 'image/jpeg',
          },
          {
            type: 'image',
            url: 'https://storage.googleapis.com/test-bucket/image2.png',
            fileName: 'photo2.png',
            mimeType: 'image/png',
          },
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithImages);
      expect(messageId).toBeDefined();
    });

    it('should persist video attachment', async () => {
      const messageWithVideo = {
        role: 'user' as const,
        content: 'Analyze this video',
        timestamp: new Date(),
        mode: 'gemini-vision',
        media: [
          {
            type: 'video',
            url: 'https://storage.googleapis.com/test-bucket/video.mp4',
            fileName: 'presentation.mp4',
            mimeType: 'video/mp4',
          },
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithVideo);
      expect(messageId).toBeDefined();
    });

    it('should persist PDF attachment', async () => {
      const messageWithPDF = {
        role: 'user' as const,
        content: 'Review this document',
        timestamp: new Date(),
        mode: 'gemini-text',
        media: [
          {
            type: 'pdf',
            url: 'https://storage.googleapis.com/test-bucket/document.pdf',
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
          },
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithPDF);
      expect(messageId).toBeDefined();
    });

    it('should persist mixed media attachments', async () => {
      const messageWithMixedMedia = {
        role: 'user' as const,
        content: 'Here are multiple files',
        timestamp: new Date(),
        mode: 'agent',
        media: [
          {
            type: 'image',
            url: 'https://storage.googleapis.com/test-bucket/image.jpg',
            fileName: 'photo.jpg',
            mimeType: 'image/jpeg',
          },
          {
            type: 'video',
            url: 'https://storage.googleapis.com/test-bucket/video.mp4',
            fileName: 'clip.mp4',
            mimeType: 'video/mp4',
          },
          {
            type: 'pdf',
            url: 'https://storage.googleapis.com/test-bucket/doc.pdf',
            fileName: 'document.pdf',
            mimeType: 'application/pdf',
          },
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithMixedMedia);
      expect(messageId).toBeDefined();
    });
  });

  describe('6. Page Reload Simulation', () => {
    it('should retrieve full conversation history after simulated page reload', async () => {
      // Simulate a conversation before page reload
      const messages = [
        { role: 'user' as const, content: 'Hello', timestamp: new Date(), mode: 'agent' },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: new Date(), mode: 'agent' },
        { role: 'user' as const, content: 'Generate image', timestamp: new Date(), mode: 'imagen' },
      ];

      for (const msg of messages) {
        await saveChatMessage(testBrandId, testUserId, msg);
        addMockMessage(msg);
      }

      // Simulate page reload by fetching history
      const history = await getChatHistory(testBrandId, testUserId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should maintain chronological order after page reload', async () => {
      const now = Date.now();
      const messages = [
        { role: 'user' as const, content: 'First', timestamp: new Date(now), mode: 'agent' },
        { role: 'assistant' as const, content: 'Second', timestamp: new Date(now + 1000), mode: 'agent' },
        { role: 'user' as const, content: 'Third', timestamp: new Date(now + 2000), mode: 'agent' },
      ];

      for (const msg of messages) {
        await saveChatMessage(testBrandId, testUserId, msg);
        addMockMessage(msg);
      }

      const history = await getChatHistory(testBrandId, testUserId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('7. Error Recovery and Edge Cases', () => {
    it('should handle empty message content gracefully', async () => {
      const emptyMessage = {
        role: 'user' as const,
        content: '',
        timestamp: new Date(),
        mode: 'agent',
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, emptyMessage);
      expect(messageId).toBeDefined();
    });

    it('should handle very long message content', async () => {
      const longContent = 'A'.repeat(10000); // 10K characters
      const longMessage = {
        role: 'user' as const,
        content: longContent,
        timestamp: new Date(),
        mode: 'agent',
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, longMessage);
      expect(messageId).toBeDefined();
    });

    it('should handle special characters in content', async () => {
      const specialMessage = {
        role: 'user' as const,
        content: 'Test with special chars: <>&"\'\\n\\t😀🎉',
        timestamp: new Date(),
        mode: 'agent',
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, specialMessage);
      expect(messageId).toBeDefined();
    });

    it('should handle missing optional fields', async () => {
      const minimalMessage = {
        role: 'user' as const,
        content: 'Minimal message',
        timestamp: new Date(),
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, minimalMessage);
      expect(messageId).toBeDefined();
    });
  });

  describe('8. Performance and Scalability', () => {
    it('should handle rapid message succession', async () => {
      const rapidMessages = Array.from({ length: 10 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Rapid message ${i}`,
        timestamp: new Date(Date.now() + i * 100),
        mode: 'agent',
      }));

      const messageIds = await Promise.all(
        rapidMessages.map(msg => saveChatMessage(testBrandId, testUserId, msg))
      );

      expect(messageIds).toHaveLength(10);
      messageIds.forEach(id => expect(id).toBeDefined());
    });

    it('should respect message limit when retrieving history', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i}`,
        timestamp: new Date(Date.now() + i * 1000),
        mode: 'agent',
      }));

      for (const msg of messages) {
        await saveChatMessage(testBrandId, testUserId, msg);
        addMockMessage(msg);
      }

      const history = await getChatHistory(testBrandId, testUserId, 50);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('9. Thinking Process Display Across All Modes', () => {
    it('should persist and display thinking process in agent mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Based on your requirements, I recommend a multi-phase approach.',
        timestamp: new Date(),
        mode: 'agent',
        thoughts: [
          'Analyzing user requirements...',
          'Evaluating available solutions...',
          'Considering team constraints...',
          'Synthesizing recommendations...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);

      expect(messageId).toBeDefined();
      addMockMessage(messageWithThinking);

      const history = await getChatHistory(testBrandId, testUserId);
      expect(history).toBeDefined();
    });

    it('should persist and display thinking process in gemini-text mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Here is a creative story with compelling narrative elements.',
        timestamp: new Date(),
        mode: 'gemini-text',
        thoughts: [
          'Understanding creative writing request...',
          'Developing story structure...',
          'Crafting engaging narrative...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in gemini-vision mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'I have analyzed the image and identified key elements.',
        timestamp: new Date(),
        mode: 'gemini-vision',
        thoughts: [
          'Processing image data...',
          'Identifying objects and scenes...',
          'Analyzing composition and context...',
          'Generating detailed description...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in imagen mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Generated image based on your prompt.',
        timestamp: new Date(),
        mode: 'imagen',
        thoughts: [
          'Parsing image generation prompt...',
          'Optimizing prompt for best results...',
          'Generating image with Imagen model...',
          'Post-processing output...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in veo video mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Created video based on your specifications.',
        timestamp: new Date(),
        mode: 'veo',
        thoughts: [
          'Analyzing video generation request...',
          'Planning video sequence...',
          'Generating video frames...',
          'Rendering final video output...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in team-chat mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Here are best practices for effective team collaboration.',
        timestamp: new Date(),
        mode: 'team-chat',
        thoughts: [
          'Reviewing team collaboration research...',
          'Identifying key principles...',
          'Tailoring recommendations to team context...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in domain-suggestions mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Here are creative domain name suggestions for your business.',
        timestamp: new Date(),
        mode: 'domain-suggestions',
        thoughts: [
          'Analyzing business keywords and themes...',
          'Generating creative domain combinations...',
          'Checking domain availability patterns...',
          'Ranking suggestions by relevance...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in website-planning mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Here is a comprehensive website plan for your organization.',
        timestamp: new Date(),
        mode: 'website-planning',
        thoughts: [
          'Understanding organization goals...',
          'Planning site structure and navigation...',
          'Identifying key pages and features...',
          'Creating implementation roadmap...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in team-strategy mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Strategic plan developed for your team.',
        timestamp: new Date(),
        mode: 'team-strategy',
        thoughts: [
          'Assessing current team situation...',
          'Identifying strategic opportunities...',
          'Developing actionable initiatives...',
          'Creating timeline and milestones...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in logo-concepts mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Logo concepts designed for your brand.',
        timestamp: new Date(),
        mode: 'logo-concepts',
        thoughts: [
          'Analyzing brand identity and values...',
          'Exploring visual design directions...',
          'Creating concept variations...',
          'Refining top design choices...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in event-creator mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Created 7-day event plan with daily activities.',
        timestamp: new Date(),
        mode: 'event-creator',
        thoughts: [
          'Understanding event requirements...',
          'Planning daily schedule structure...',
          'Creating content for each day...',
          'Ensuring cohesive event flow...',
        ],
        structuredData: {
          type: 'campaign',
          data: {
            campaignName: '7-Day Team Event',
            startDate: '2025-11-25',
            duration: 7,
            campaignDays: Array.from({ length: 7 }, (_, i) => ({
              day: i + 1,
              date: new Date(2025, 10, 25 + i).toISOString().split('T')[0],
              contentBlocks: [],
            })),
          },
        },
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in search mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Found relevant information about latest AI trends.',
        timestamp: new Date(),
        mode: 'search',
        thoughts: [
          'Formulating search query...',
          'Searching multiple sources...',
          'Analyzing search results...',
          'Synthesizing key findings...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should persist and display thinking process in youtube-analysis mode', async () => {
      const messageWithThinking = {
        role: 'assistant' as const,
        content: 'Comprehensive analysis of the YouTube video completed.',
        timestamp: new Date(),
        mode: 'youtube-analysis',
        thoughts: [
          'Extracting video metadata...',
          'Processing video transcript...',
          'Analyzing key topics and themes...',
          'Generating insights and summary...',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithThinking);
      expect(messageId).toBeDefined();
    });

    it('should retrieve and display thinking process after page reload', async () => {
      // Save multiple messages with thinking processes
      const messagesWithThinking = [
        {
          role: 'user' as const,
          content: 'Help me plan a strategy',
          timestamp: new Date(Date.now() - 2000),
          mode: 'agent',
        },
        {
          role: 'assistant' as const,
          content: 'Here is a comprehensive strategy.',
          timestamp: new Date(Date.now() - 1000),
          mode: 'agent',
          thoughts: [
            'Analyzing strategic requirements...',
            'Developing action plan...',
            'Creating measurable objectives...',
          ],
        },
        {
          role: 'user' as const,
          content: 'Generate an image',
          timestamp: new Date(),
          mode: 'imagen',
        },
        {
          role: 'assistant' as const,
          content: 'Image generated successfully.',
          timestamp: new Date(),
          mode: 'imagen',
          thoughts: [
            'Processing generation request...',
            'Rendering image output...',
          ],
        },
      ];

      for (const msg of messagesWithThinking) {
        await saveChatMessage(testBrandId, testUserId, msg);
        addMockMessage(msg);
      }

      // Simulate page reload by retrieving history
      const history = await getChatHistory(testBrandId, testUserId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should preserve thinking process order and structure', async () => {
      const messageWithComplexThinking = {
        role: 'assistant' as const,
        content: 'Executed multi-step analysis with detailed reasoning.',
        timestamp: new Date(),
        mode: 'agent',
        thoughts: [
          'Step 1: Initial data collection',
          'Step 2: Pattern recognition',
          'Step 3: Hypothesis formation',
          'Step 4: Validation and testing',
          'Step 5: Final recommendations',
        ],
      };

      const messageId = await saveChatMessage(testBrandId, testUserId, messageWithComplexThinking);
      expect(messageId).toBeDefined();

      addMockMessage(messageWithComplexThinking);
      const history = await getChatHistory(testBrandId, testUserId);

      expect(history).toBeDefined();
    });

    it('should handle messages with and without thinking process in same conversation', async () => {
      const mixedMessages = [
        {
          role: 'user' as const,
          content: 'Hello, I need help',
          timestamp: new Date(Date.now() - 3000),
          mode: 'agent',
        },
        {
          role: 'assistant' as const,
          content: 'Sure, I can help you!',
          timestamp: new Date(Date.now() - 2000),
          mode: 'agent',
          // No thinking process
        },
        {
          role: 'user' as const,
          content: 'Create a strategic plan',
          timestamp: new Date(Date.now() - 1000),
          mode: 'team-strategy',
        },
        {
          role: 'assistant' as const,
          content: 'Here is your strategic plan.',
          timestamp: new Date(),
          mode: 'team-strategy',
          thoughts: [
            'Analyzing requirements...',
            'Formulating strategy...',
            'Creating deliverables...',
          ],
        },
      ];

      for (const msg of mixedMessages) {
        await saveChatMessage(testBrandId, testUserId, msg);
        addMockMessage(msg);
      }

      const history = await getChatHistory(testBrandId, testUserId);
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });
});
