import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deleteChatMessage,
  updateChatMessage,
  deleteMessagesAfter,
  deleteNextAssistantMessage,
  saveChatMessage,
  getChatHistory,
  clearChatHistory,
} from '../chat-history';
import { getAdminInstances } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// Mock Firebase Admin
vi.mock('@/lib/firebase/admin');

describe('Chat History Functions', () => {
  const mockAdminDb = {
    collection: vi.fn(),
    batch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminInstances).mockReturnValue({
      adminDb: mockAdminDb as any,
    } as any);
  });

  describe('deleteChatMessage', () => {
    it('should delete a message by ID', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockMessageDoc = { delete: mockDelete };
      const mockMessagesCollection = { doc: vi.fn(() => mockMessageDoc) };
      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      await deleteChatMessage(brandId, userId, messageId);

      expect(mockAdminDb.collection).toHaveBeenCalledWith('chat_history');
      expect(mockBrandCollection.doc).toHaveBeenCalledWith(brandId);
      expect(mockUsersCollection.doc).toHaveBeenCalledWith(userId);
      expect(mockMessagesCollection.doc).toHaveBeenCalledWith(messageId);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));
      const mockMessageDoc = { delete: mockDelete };
      const mockMessagesCollection = { doc: vi.fn(() => mockMessageDoc) };
      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      await expect(deleteChatMessage(brandId, userId, messageId)).rejects.toThrow();
    });
  });

  describe('updateChatMessage', () => {
    it('should update message content', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';
      const updates = { content: 'Updated content' };

      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockMessageDoc = { set: mockSet };
      const mockMessagesCollection = { doc: vi.fn(() => mockMessageDoc) };
      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      await updateChatMessage(brandId, userId, messageId, updates);

      expect(mockSet).toHaveBeenCalledWith(
        { content: 'Updated content' },
        { merge: true }
      );
    });

    it('should update message media', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';
      const updates = {
        media: [
          { type: 'image', url: 'https://example.com/image.jpg' },
        ],
      };

      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockMessageDoc = { set: mockSet };
      const mockMessagesCollection = { doc: vi.fn(() => mockMessageDoc) };
      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      await updateChatMessage(brandId, userId, messageId, updates);

      expect(mockSet).toHaveBeenCalledWith(
        {
          media: [{ type: 'image', url: 'https://example.com/image.jpg' }],
        },
        { merge: true }
      );
    });
  });

  describe('deleteNextAssistantMessage', () => {
    it('should delete only the immediate next assistant message', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockTimestamp = Timestamp.now();
      const mockMessageData = { timestamp: mockTimestamp };
      const mockMessageDoc = {
        exists: true,
        data: () => mockMessageData,
      };

      const mockNextMessageDoc = {
        id: 'next-msg-id',
        ref: { delete: vi.fn().mockResolvedValue(undefined) },
        data: () => ({ role: 'assistant', timestamp: Timestamp.now() }),
      };

      const mockGetMessage = vi.fn().mockResolvedValue(mockMessageDoc);
      const mockGetNext = vi.fn().mockResolvedValue({
        docs: [mockNextMessageDoc],
      });
      const mockLimit = vi.fn(() => ({ get: mockGetNext }));
      const mockStartAfter = vi.fn(() => ({ limit: mockLimit }));
      const mockOrderBy = vi.fn(() => ({ startAfter: mockStartAfter }));
      const mockMessageDocRef = { get: mockGetMessage };
      const mockMessagesCollection = {
        doc: vi.fn(() => mockMessageDocRef),
        orderBy: mockOrderBy,
      };

      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      const deletedId = await deleteNextAssistantMessage(brandId, userId, messageId);

      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'asc');
      expect(mockStartAfter).toHaveBeenCalledWith(mockTimestamp);
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(mockNextMessageDoc.ref.delete).toHaveBeenCalled();
      expect(deletedId).toBe('next-msg-id');
    });

    it('should return null if next message is not an assistant message', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockTimestamp = Timestamp.now();
      const mockMessageData = { timestamp: mockTimestamp };
      const mockMessageDoc = {
        exists: true,
        data: () => mockMessageData,
      };

      const mockNextMessageDoc = {
        id: 'next-msg-id',
        ref: { delete: vi.fn() },
        data: () => ({ role: 'user', timestamp: Timestamp.now() }), // Not assistant
      };

      const mockGetMessage = vi.fn().mockResolvedValue(mockMessageDoc);
      const mockGetNext = vi.fn().mockResolvedValue({
        docs: [mockNextMessageDoc],
      });
      const mockLimit = vi.fn(() => ({ get: mockGetNext }));
      const mockStartAfter = vi.fn(() => ({ limit: mockLimit }));
      const mockOrderBy = vi.fn(() => ({ startAfter: mockStartAfter }));
      const mockMessageDocRef = { get: mockGetMessage };
      const mockMessagesCollection = {
        doc: vi.fn(() => mockMessageDocRef),
        orderBy: mockOrderBy,
      };

      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      const deletedId = await deleteNextAssistantMessage(brandId, userId, messageId);

      expect(mockNextMessageDoc.ref.delete).not.toHaveBeenCalled();
      expect(deletedId).toBeNull();
    });

    it('should return null if no next message exists', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockTimestamp = Timestamp.now();
      const mockMessageData = { timestamp: mockTimestamp };
      const mockMessageDoc = {
        exists: true,
        data: () => mockMessageData,
      };

      const mockGetMessage = vi.fn().mockResolvedValue(mockMessageDoc);
      const mockGetNext = vi.fn().mockResolvedValue({
        docs: [], // No next message
      });
      const mockLimit = vi.fn(() => ({ get: mockGetNext }));
      const mockStartAfter = vi.fn(() => ({ limit: mockLimit }));
      const mockOrderBy = vi.fn(() => ({ startAfter: mockStartAfter }));
      const mockMessageDocRef = { get: mockGetMessage };
      const mockMessagesCollection = {
        doc: vi.fn(() => mockMessageDocRef),
        orderBy: mockOrderBy,
      };

      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      const deletedId = await deleteNextAssistantMessage(brandId, userId, messageId);

      expect(deletedId).toBeNull();
    });

    it('should throw error if message not found', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockMessageDoc = {
        exists: false,
        data: () => null,
      };

      const mockGet = vi.fn().mockResolvedValue(mockMessageDoc);
      const mockMessageDocRef = { get: mockGet };
      const mockMessagesCollection = { doc: vi.fn(() => mockMessageDocRef) };

      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      await expect(deleteNextAssistantMessage(brandId, userId, messageId)).resolves.toBeNull();
    });
  });

  describe('deleteMessagesAfter', () => {
    it('should delete all messages after a given message', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockTimestamp = Timestamp.now();
      const mockMessageData = { timestamp: mockTimestamp };
      const mockMessageDoc = {
        exists: true,
        data: () => mockMessageData,
      };

      const mockDelete = vi.fn();
      const mockCommit = vi.fn().mockResolvedValue(undefined);
      const mockBatch = {
        delete: mockDelete,
        commit: mockCommit,
      };

      const mockSnapshot = {
        docs: [
          { ref: 'ref1' },
          { ref: 'ref2' },
        ],
      };

      const mockGetAfter = vi.fn().mockResolvedValue(mockSnapshot);
      const mockStartAfter = vi.fn(() => ({ get: mockGetAfter }));
      const mockOrderBy = vi.fn(() => ({ startAfter: mockStartAfter }));
      const mockGetMessage = vi.fn().mockResolvedValue(mockMessageDoc);
      const mockMessageDocRef = { get: mockGetMessage };
      const mockMessagesCollection = {
        doc: vi.fn(() => mockMessageDocRef),
        orderBy: mockOrderBy,
      };

      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);
      mockAdminDb.batch.mockReturnValue(mockBatch as any);

      await deleteMessagesAfter(brandId, userId, messageId);

      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'asc');
      expect(mockStartAfter).toHaveBeenCalledWith(mockTimestamp);
      expect(mockDelete).toHaveBeenCalledTimes(2);
      expect(mockCommit).toHaveBeenCalled();
    });

    it('should throw error if message not found', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const messageId = 'msg-123';

      const mockMessageDoc = {
        exists: false,
        data: () => null,
      };

      const mockGet = vi.fn().mockResolvedValue(mockMessageDoc);
      const mockMessageDocRef = { get: mockGet };
      const mockMessagesCollection = { doc: vi.fn(() => mockMessageDocRef) };

      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      await expect(deleteMessagesAfter(brandId, userId, messageId)).rejects.toThrow(
        'Message msg-123 not found'
      );
    });
  });

  describe('saveChatMessage', () => {
    it('should save a message and return document ID', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';
      const message = {
        role: 'user' as const,
        content: 'Test message',
        timestamp: new Date(),
      };

      const mockAdd = vi.fn().mockResolvedValue({ id: 'new-msg-id' });
      const mockMessagesCollection = { add: mockAdd };
      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      const messageId = await saveChatMessage(brandId, userId, message);

      expect(mockAdd).toHaveBeenCalled();
      expect(messageId).toBe('new-msg-id');
    });
  });

  describe('getChatHistory', () => {
    it('should retrieve chat history with IDs', async () => {
      const brandId = 'test-brand';
      const userId = 'test-user';

      const mockTimestamp = Timestamp.now();
      const mockSnapshot = {
        forEach: vi.fn((callback: any) => {
          callback({
            id: 'msg-1',
            data: () => ({
              role: 'user',
              content: 'Hello',
              timestamp: mockTimestamp,
              media: [],
            }),
          });
          callback({
            id: 'msg-2',
            data: () => ({
              role: 'assistant',
              content: 'Hi there',
              timestamp: mockTimestamp,
              media: [],
            }),
          });
        }),
      };

      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockLimit = vi.fn(() => ({ get: mockGet }));
      const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
      const mockMessagesCollection = { orderBy: mockOrderBy };
      const mockUserDoc = { collection: vi.fn(() => mockMessagesCollection) };
      const mockUsersCollection = { doc: vi.fn(() => mockUserDoc) };
      const mockBrandDoc = { collection: vi.fn(() => mockUsersCollection) };
      const mockBrandCollection = { doc: vi.fn(() => mockBrandDoc) };

      mockAdminDb.collection.mockReturnValue(mockBrandCollection as any);

      const messages = await getChatHistory(brandId, userId);

      expect(messages).toHaveLength(2);
      // Messages are reversed in getChatHistory, so msg-2 comes first after reversal
      expect(messages[0].id).toBe('msg-2');
      expect(messages[1].id).toBe('msg-1');
      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
      // getChatHistory fetches limit * 3 to account for filtered messages (default limit=50, so 150)
      expect(mockLimit).toHaveBeenCalledWith(150);
    });
  });
});
