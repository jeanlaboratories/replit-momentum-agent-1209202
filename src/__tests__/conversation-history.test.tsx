/**
 * Tests for Conversation History Feature
 *
 * This test file ensures that conversation history for Team Companion:
 * 1. Data model types are properly defined
 * 2. Conversation types and interfaces are correct
 * 3. Chat history functions support conversation IDs
 * 4. API routes support conversation CRUD operations
 * 5. Global context manages conversation state
 * 6. Conversation sidebar component exists
 * 7. Gemini chatbot integrates conversation switching
 * 8. Helper functions work correctly
 */

import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_CONVERSATION_ID,
  generateConversationTitle,
  generateConversationPreview,
} from '@/lib/types/conversation';

// Mock JobQueueProvider to prevent context errors
vi.mock('@/contexts/job-queue-context', () => ({
  JobQueueProvider: ({ children }: any) => children,
  useJobQueue: () => ({
    state: { jobs: [], isExpanded: false, isPanelVisible: true },
    addJob: vi.fn(() => 'mock-job-id'),
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    clearCompleted: vi.fn(),
    cancelJob: vi.fn(),
    startJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    setProgress: vi.fn(),
    toggleExpanded: vi.fn(),
    setExpanded: vi.fn(),
    setPanelVisible: vi.fn(),
    getActiveJobs: vi.fn(() => []),
    getCompletedJobs: vi.fn(() => []),
    getJobById: vi.fn(),
    hasActiveJobs: vi.fn(() => false),
    isJobStalled: vi.fn(() => false),
    getStalledJobs: vi.fn(() => []),
  }),
  useJob: () => ({
    jobId: null,
    create: vi.fn(() => 'mock-job-id'),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    progress: vi.fn(),
    update: vi.fn(),
    getJob: vi.fn(),
  }),
}));

describe('Conversation History Feature', () => {
  const srcDir = path.join(__dirname, '..');

  describe('Conversation Types', () => {
    const typesPath = path.join(srcDir, 'lib/types/conversation.ts');

    it('should exist', () => {
      expect(fs.existsSync(typesPath)).toBe(true);
    });

    it('should have Conversation interface', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export interface Conversation');
    });

    it('Conversation should have required fields', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('id: string');
      expect(content).toContain('brandId: string');
      expect(content).toContain('userId: string');
      expect(content).toContain('title: string');
      expect(content).toContain('preview: string');
      expect(content).toContain('messageCount: number');
      expect(content).toContain('createdAt: string');
      expect(content).toContain('updatedAt: string');
      expect(content).toContain('isArchived: boolean');
    });

    it('should have ConversationListItem interface', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export interface ConversationListItem');
    });

    it('ConversationListItem should have display fields', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('title: string');
      expect(content).toContain('preview: string');
      expect(content).toContain('messageCount: number');
      expect(content).toContain('updatedAt: string');
    });

    it('should have DEFAULT_CONVERSATION_ID constant', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain("DEFAULT_CONVERSATION_ID = 'default'");
    });

    it('should have generateConversationTitle function', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export function generateConversationTitle');
    });

    it('should have generateConversationPreview function', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export function generateConversationPreview');
    });

    it('should export request/response interfaces', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export interface CreateConversationRequest');
      expect(content).toContain('export interface CreateConversationResponse');
      expect(content).toContain('export interface ListConversationsResponse');
      expect(content).toContain('export interface UpdateConversationRequest');
      expect(content).toContain('export interface DeleteConversationRequest');
    });
  });

  describe('Helper Functions', () => {
    it('DEFAULT_CONVERSATION_ID should be "default"', () => {
      expect(DEFAULT_CONVERSATION_ID).toBe('default');
    });

    describe('generateConversationTitle', () => {
      it('should return "New Conversation" for empty string', () => {
        expect(generateConversationTitle('')).toBe('New Conversation');
      });

      it('should return full message if under 60 chars', () => {
        // Using a message that doesn't start with a greeting pattern
        const shortMessage = 'What is the weather like today?';
        const result = generateConversationTitle(shortMessage);
        // Should capitalize and remove trailing punctuation
        expect(result).toBe('What is the weather like today');
      });

      it('should truncate long messages at word boundary', () => {
        const longMessage = 'This is a very long message that exceeds sixty characters and needs truncation at a reasonable boundary';
        const result = generateConversationTitle(longMessage);
        expect(result.length).toBeLessThanOrEqual(63); // 60 chars + "..."
        expect(result).toContain('...');
      });

      it('should replace newlines with spaces', () => {
        const multilineMessage = 'This is line one\nline two\nline three';
        const result = generateConversationTitle(multilineMessage);
        expect(result).toBe('This is line one line two line three');
      });

      it('should trim whitespace', () => {
        const paddedMessage = '   Project updates   ';
        const result = generateConversationTitle(paddedMessage);
        expect(result).toBe('Project updates');
      });

      it('should remove filler phrases like "Can you"', () => {
        const message = 'Can you help me write a marketing plan';
        const result = generateConversationTitle(message);
        expect(result).toBe('Help me write a marketing plan');
      });

      it('should remove greetings like "Hello, "', () => {
        const message = 'Hello, I need help with my project';
        const result = generateConversationTitle(message);
        expect(result).toBe('I need help with my project');
      });

      it('should capitalize first letter after removing fillers', () => {
        const message = 'please fix the bug in my code';
        const result = generateConversationTitle(message);
        expect(result.charAt(0)).toBe('F'); // "please" removed, "fix" capitalized
      });

      it('should remove trailing punctuation', () => {
        const message = 'What is the meaning of life?';
        const result = generateConversationTitle(message);
        expect(result).toBe('What is the meaning of life');
      });
    });

    describe('generateConversationPreview', () => {
      it('should return full message if under 100 chars', () => {
        const shortMessage = 'This is a short preview message.';
        expect(generateConversationPreview(shortMessage)).toBe(shortMessage);
      });

      it('should truncate at 100 chars for long messages', () => {
        const longMessage = 'A'.repeat(150);
        const result = generateConversationPreview(longMessage);
        expect(result.length).toBe(103); // 100 chars + "..."
        expect(result).toContain('...');
      });

      it('should replace newlines with spaces', () => {
        const multilineMessage = 'Line 1\nLine 2\nLine 3';
        expect(generateConversationPreview(multilineMessage)).toBe('Line 1 Line 2 Line 3');
      });
    });
  });

  describe('Chat History Functions', () => {
    const chatHistoryPath = path.join(srcDir, 'lib/chat-history.ts');

    it('should exist', () => {
      expect(fs.existsSync(chatHistoryPath)).toBe(true);
    });

    it('should have getChatHistory with conversationId parameter', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function getChatHistory');
      expect(content).toContain('conversationId');
    });

    it('should have saveChatMessage with conversationId parameter', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function saveChatMessage');
      expect(content).toContain('conversationId');
    });

    it('should have createConversation function', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function createConversation');
    });

    it('should have listConversations function', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function listConversations');
    });

    it('should filter archived conversations in code to avoid composite index', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      // Verify we filter archived conversations in code rather than using Firestore where clause
      // This avoids requiring a composite index (isArchived + updatedAt)
      expect(content).toContain('isArchived === true');
      expect(content).toContain('!includeArchived && isArchived');
    });

    it('should filter messages by conversationId in code to avoid composite index', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      // Verify getChatHistory filters by conversationId in code rather than using Firestore where clause
      // This avoids requiring a composite index (conversationId + timestamp)
      expect(content).toContain('Filter by conversationId in code to avoid composite index');
      expect(content).toContain('data.conversationId === effectiveConversationId');
    });

    it('should have updateConversationTitle function', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function updateConversationTitle');
    });

    it('should have archiveConversation function', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function archiveConversation');
    });

    it('should have deleteConversation function', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('export async function deleteConversation');
    });

    it('should import DEFAULT_CONVERSATION_ID', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      expect(content).toContain('DEFAULT_CONVERSATION_ID');
    });

    it('should filter messages by conversationId', () => {
      const content = fs.readFileSync(chatHistoryPath, 'utf-8');
      // Verify there's filtering logic for conversation ID
      expect(content).toContain('conversationId');
    });
  });

  describe('Conversations API Route', () => {
    const routePath = path.join(srcDir, 'app/api/chat/conversations/route.ts');

    it('should exist', () => {
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('should export GET handler', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function GET');
    });

    it('should export POST handler', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function POST');
    });

    it('should export PUT handler', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function PUT');
    });

    it('should export DELETE handler', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('export async function DELETE');
    });

    it('should import conversation functions from chat-history', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('createConversation');
      expect(content).toContain('listConversations');
      expect(content).toContain('updateConversationTitle');
      expect(content).toContain('archiveConversation');
      expect(content).toContain('deleteConversation');
    });

    it('should validate brandId in GET', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("error: 'Brand ID required'");
    });

    it('should support includeArchived parameter', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('includeArchived');
    });

    it('should require authentication', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('getAuthenticatedUser');
      expect(content).toContain('requireBrandAccess');
    });
  });

  describe('Chat History API Route', () => {
    const routePath = path.join(srcDir, 'app/api/chat/history/route.ts');

    it('should exist', () => {
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('should support conversationId query parameter', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain("conversationId = searchParams.get('conversationId')");
    });

    it('should pass conversationId to getChatHistory', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('conversationId');
    });

    it('should support conversationId in POST body', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('conversationId');
    });

    // Auto-save conversation tests
    describe('Auto-create Conversation', () => {
      it('should import createConversation from chat-history', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('createConversation');
      });

      it('should import generateConversationTitle from types/conversation', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('generateConversationTitle');
        expect(content).toContain("from '@/lib/types/conversation'");
      });

      it('should auto-create conversation when no conversationId provided', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('if (!conversationId)');
        expect(content).toContain('newConversation = await createConversation');
      });

      it('should generate title for user messages from content', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain("role === 'user'");
        expect(content).toContain('generateConversationTitle(content');
      });

      it('should use default title for assistant messages', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain("'New Conversation'");
      });

      it('should return conversationId in response', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('conversationId: effectiveConversationId');
      });

      it('should return newConversation info in response when created', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('newConversation:');
        expect(content).toContain('newConversation.id');
        expect(content).toContain('newConversation.title');
      });

      it('should log when auto-creating conversation', () => {
        const content = fs.readFileSync(routePath, 'utf-8');
        expect(content).toContain('[ChatHistory] Auto-created conversation');
      });
    });
  });

  describe('Global Chatbot Context', () => {
    const contextPath = path.join(srcDir, 'contexts/global-chatbot-context.tsx');

    it('should exist', () => {
      expect(fs.existsSync(contextPath)).toBe(true);
    });

    it('should have currentConversationId state', () => {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('currentConversationId');
      expect(content).toContain('setCurrentConversationId');
    });

    it('should have conversations state', () => {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('conversations');
      expect(content).toContain('setConversations');
    });

    it('should have conversation sidebar state', () => {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('isConversationSidebarOpen');
      expect(content).toContain('toggleConversationSidebar');
      expect(content).toContain('openConversationSidebar');
      expect(content).toContain('closeConversationSidebar');
    });

    it('should have refreshConversations function', () => {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('refreshConversations');
      expect(content).toContain('conversationRefreshKey');
    });

    it('should export DEFAULT_CONVERSATION_ID', () => {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('export { DEFAULT_CONVERSATION_ID }');
    });

    it('should import from conversation types', () => {
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('ConversationListItem');
      expect(content).toContain('DEFAULT_CONVERSATION_ID');
    });
  });

  describe('Conversation Sidebar Component', () => {
    const sidebarPath = path.join(srcDir, 'components/conversation-sidebar.tsx');

    it('should exist', () => {
      expect(fs.existsSync(sidebarPath)).toBe(true);
    });

    it('should be a client component', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain("'use client'");
    });

    it('should export ConversationSidebar component', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('export function ConversationSidebar');
    });

    it('should accept brandId prop', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('brandId: string');
    });

    it('should have onSelectConversation callback', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('onSelectConversation');
    });

    it('should have onNewConversation callback', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('onNewConversation');
    });

    it('should use global chatbot context', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('useGlobalChatbot');
    });

    it('should fetch conversations from API', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('/api/chat/conversations');
    });

    it('should have new conversation button', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('New Conversation');
    });

    it('should have current session option', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('Current Session');
    });

    it('should support editing conversation titles', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('editingId');
      expect(content).toContain('editTitle');
      expect(content).toContain('handleSaveEdit');
    });

    it('should support archiving conversations', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('handleToggleArchive');
      expect(content).toContain('isArchived');
    });

    it('should support deleting conversations', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('handleDelete');
      expect(content).toContain('DELETE');
    });

    it('should show/hide archived toggle', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('showArchived');
      expect(content).toContain('Show archived');
      expect(content).toContain('Hide archived');
    });

    it('should format relative time', () => {
      const content = fs.readFileSync(sidebarPath, 'utf-8');
      expect(content).toContain('formatRelativeTime');
    });
  });

  describe('Gemini Chatbot Integration', () => {
    const chatbotPath = path.join(srcDir, 'components/gemini-chatbot.tsx');

    it('should exist', () => {
      expect(fs.existsSync(chatbotPath)).toBe(true);
    });

    it('should import DEFAULT_CONVERSATION_ID from context', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('DEFAULT_CONVERSATION_ID');
    });

    it('should import ConversationSidebar', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('ConversationSidebar');
    });

    it('should use currentConversationId from context', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('currentConversationId');
    });

    it('should have handleSelectConversation function', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('handleSelectConversation');
    });

    it('should have handleNewConversation function', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('handleNewConversation');
    });

    it('should include conversationId in chat history requests', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('conversationId:');
    });

    it('should render ConversationSidebar component', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('<ConversationSidebar');
    });

    it('should have browse conversations menu item', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('Browse Conversations');
      expect(content).toContain('openConversationSidebar');
    });

    it('should call refreshConversations after saving messages', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('refreshConversations');
    });

    it('should handle conversation switching via useEffect', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('previousConversationIdRef');
    });

    it('should track activeConversationId in handleSend', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('activeConversationId');
      expect(content).toContain('let activeConversationId');
    });

    it('should use activeConversationId for assistant message saves (not stale currentConversationId)', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      // Count occurrences of the fix pattern
      const matches = content.match(/conversationId: activeConversationId/g);
      expect(matches).not.toBeNull();
      // Should be at least 3 (user message + multiple assistant message save points)
      expect(matches!.length).toBeGreaterThanOrEqual(3);
    });

    it('should update activeConversationId when new conversation is created', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('saveData.conversationId');
      expect(content).toContain('activeConversationId = saveData.conversationId');
    });
  });

  describe('Integration - Data Flow', () => {
    it('all components should work together', () => {
      const contextContent = fs.readFileSync(
        path.join(srcDir, 'contexts/global-chatbot-context.tsx'),
        'utf-8'
      );
      const sidebarContent = fs.readFileSync(
        path.join(srcDir, 'components/conversation-sidebar.tsx'),
        'utf-8'
      );
      const chatbotContent = fs.readFileSync(
        path.join(srcDir, 'components/gemini-chatbot.tsx'),
        'utf-8'
      );
      const apiContent = fs.readFileSync(
        path.join(srcDir, 'app/api/chat/conversations/route.ts'),
        'utf-8'
      );

      // Context provides state management
      expect(contextContent).toContain('currentConversationId');
      expect(contextContent).toContain('conversations');

      // Sidebar uses context
      expect(sidebarContent).toContain('useGlobalChatbot');
      expect(sidebarContent).toContain('setCurrentConversationId');

      // Chatbot uses context
      expect(chatbotContent).toContain('useGlobalChatbot');
      expect(chatbotContent).toContain('currentConversationId');

      // API provides CRUD operations
      expect(apiContent).toContain('createConversation');
      expect(apiContent).toContain('listConversations');
      expect(apiContent).toContain('deleteConversation');
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy messages without conversationId', () => {
      const chatHistoryContent = fs.readFileSync(
        path.join(srcDir, 'lib/chat-history.ts'),
        'utf-8'
      );
      // Should handle messages without conversationId (default conversation)
      expect(chatHistoryContent).toContain('DEFAULT_CONVERSATION_ID');
    });

    it('should use "default" as conversation ID for backward compatibility', () => {
      expect(DEFAULT_CONVERSATION_ID).toBe('default');
    });

    it('chat history API should work without conversationId param', () => {
      const historyApiContent = fs.readFileSync(
        path.join(srcDir, 'app/api/chat/history/route.ts'),
        'utf-8'
      );
      // Should have fallback when no conversationId is provided
      expect(historyApiContent).toContain('conversationId || undefined');
    });
  });
});
