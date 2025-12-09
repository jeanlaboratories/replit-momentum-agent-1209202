import { getAdminInstances } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Conversation, ConversationListItem } from '@/lib/types/conversation';
import { generateConversationTitle, generateConversationPreview, DEFAULT_CONVERSATION_ID } from '@/lib/types/conversation';

// Lazy initialization - only get adminDb when functions are called (not at module load)
function getAdminDb() {
  return getAdminInstances().adminDb;
}

export interface ChatMessage {
  id?: string; // Firestore document ID
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  conversationId?: string; // Optional - for multi-conversation support
  media?: Array<{
    type: string;
    url: string;
    fileName?: string;
    mimeType?: string;
  }>;
  thoughts?: string[];
  structuredData?: any;
}

export async function saveChatMessage(
  brandId: string,
  userId: string,
  message: ChatMessage,
  conversationId?: string
): Promise<string> {
  try {
    const adminDb = getAdminDb();
    const chatHistoryRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages');

    const effectiveConversationId = conversationId || message.conversationId || DEFAULT_CONVERSATION_ID;

    const docRef = await chatHistoryRef.add({
      role: message.role,
      content: message.content,
      timestamp: Timestamp.fromDate(message.timestamp),
      conversationId: effectiveConversationId,
      media: message.media || [],
      thoughts: message.thoughts || [],
      structuredData: message.structuredData || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[ChatHistory] Saved ${message.role} message for ${brandId}/${userId} in conversation ${effectiveConversationId}`, {
      messageId: docRef.id,
      hasMedia: message.media && message.media.length > 0,
      mediaCount: message.media?.length || 0,
      mediaTypes: message.media?.map(m => m.type) || [],
      mediaUrls: message.media?.map(m => m.url) || [],
      mediaData: message.media
    });

    // Update conversation metadata (last message time, message count)
    if (effectiveConversationId !== DEFAULT_CONVERSATION_ID) {
      await updateConversationMetadata(brandId, userId, effectiveConversationId, message);
    }

    return docRef.id;
  } catch (error) {
    console.error('[ChatHistory] Error saving message:', error);
    throw error;
  }
}

/**
 * Get chat history messages
 * @param brandId - Brand ID
 * @param userId - User ID
 * @param limit - Maximum number of messages to return (default: 50)
 * @param conversationId - Optional conversation ID (default or specific)
 * @returns Array of chat messages
 */
export async function getChatHistory(
  brandId: string,
  userId: string,
  limit: number = 50,
  conversationId?: string
): Promise<ChatMessage[]> {
  try {
    const adminDb = getAdminDb();
    // Fetch messages without filtering by conversationId in the query
    // to avoid requiring a composite index (conversationId + timestamp)
    // We filter in code instead, fetching more to account for filtered messages
    const chatHistoryRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit * 3); // Fetch more to account for filtered messages

    const effectiveConversationId = conversationId || DEFAULT_CONVERSATION_ID;

    const snapshot = await chatHistoryRef.get();

    const messages: ChatMessage[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const msgConversationId = data.conversationId || DEFAULT_CONVERSATION_ID;

      // Filter by conversationId in code to avoid composite index requirement
      if (effectiveConversationId === DEFAULT_CONVERSATION_ID) {
        // Include both legacy messages (no conversationId) and explicit default
        if (!data.conversationId || data.conversationId === DEFAULT_CONVERSATION_ID) {
          messages.push({
            id: doc.id,
            role: data.role,
            content: data.content,
            timestamp: data.timestamp?.toDate() || new Date(),
            conversationId: msgConversationId,
            media: data.media || [],
            thoughts: data.thoughts || [],
            structuredData: data.structuredData || undefined,
          });
        }
      } else {
        // Filter for specific conversationId
        if (data.conversationId === effectiveConversationId) {
          messages.push({
            id: doc.id,
            role: data.role,
            content: data.content,
            timestamp: data.timestamp?.toDate() || new Date(),
            conversationId: msgConversationId,
            media: data.media || [],
            thoughts: data.thoughts || [],
            structuredData: data.structuredData || undefined,
          });
        }
      }
    });

    // Limit to requested count after filtering
    const limitedMessages = messages.slice(0, limit);

    // Reverse to get chronological order
    limitedMessages.reverse();

    console.log(`[ChatHistory] Retrieved ${limitedMessages.length} messages for ${brandId}/${userId} (conversation: ${effectiveConversationId})`, {
      messagesWithMedia: limitedMessages.filter(m => m.media && m.media.length > 0).length,
    });
    return limitedMessages;
  } catch (error) {
    console.error('[ChatHistory] Error retrieving messages:', error);
    return [];
  }
}

/**
 * Get chat history with pagination support
 * PERFORMANCE OPTIMIZATION: Supports cursor-based pagination for infinite scroll
 * @param brandId - Brand ID
 * @param userId - User ID
 * @param limit - Maximum number of messages to return (default: 50)
 * @param startAfterTimestamp - Optional timestamp to start after (for pagination)
 * @returns Object with messages, hasMore flag, and last timestamp for next page
 */
export async function getChatHistoryPaginated(
  brandId: string,
  userId: string,
  limit: number = 50,
  startAfterTimestamp?: Date
): Promise<{ messages: ChatMessage[]; hasMore: boolean; lastTimestamp?: Date }> {
  try {
    const adminDb = getAdminDb();
    let chatHistoryRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit + 1); // Fetch one extra to check if there are more

    // PERFORMANCE OPTIMIZATION: Add cursor for pagination
    if (startAfterTimestamp) {
      chatHistoryRef = chatHistoryRef.startAfter(startAfterTimestamp) as any;
    }

    const snapshot = await chatHistoryRef.get();

    const messages: ChatMessage[] = [];
    const hasMore = snapshot.docs.length > limit;
    const docsToProcess = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    docsToProcess.forEach((doc: any) => {
      const data = doc.data();
      messages.push({
        id: doc.id, // Include Firestore document ID
        role: data.role,
        content: data.content,
        timestamp: data.timestamp?.toDate() || new Date(),
        media: data.media || [],
        thoughts: data.thoughts || [],
        structuredData: data.structuredData || undefined,
      });
    });

    // Reverse to get chronological order
    messages.reverse();

    const lastTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : undefined;

    console.log(`[ChatHistory] Retrieved ${messages.length} messages for ${brandId}/${userId} (paginated)`, {
      messagesWithMedia: messages.filter(m => m.media && m.media.length > 0).length,
      hasMore,
      startAfterTimestamp: startAfterTimestamp?.toISOString(),
    });

    return { messages, hasMore, lastTimestamp };
  } catch (error) {
    console.error('[ChatHistory] Error retrieving messages:', error);
    return { messages: [], hasMore: false };
  }
}

export async function clearChatHistory(
  brandId: string,
  userId: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const chatHistoryRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages');

    const snapshot = await chatHistoryRef.get();
    
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();

    console.log(`[ChatHistory] Cleared history for ${brandId}/${userId}`);
  } catch (error) {
    console.error('[ChatHistory] Error clearing history:', error);
    throw error;
  }
}

export async function deleteChatMessage(
  brandId: string,
  userId: string,
  messageId: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const messageRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages')
      .doc(messageId);

    await messageRef.delete();

    console.log(`[ChatHistory] Deleted message ${messageId} for ${brandId}/${userId}`);
  } catch (error) {
    console.error('[ChatHistory] Error deleting message:', error);
    throw error;
  }
}

export async function updateChatMessage(
  brandId: string,
  userId: string,
  messageId: string,
  updates: {
    content?: string;
    media?: ChatMessage['media'];
    role?: 'user' | 'assistant';
    timestamp?: Date;
  }
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const messageRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages')
      .doc(messageId);

    const updateData: any = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.media !== undefined) updateData.media = updates.media;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.timestamp !== undefined) {
      updateData.timestamp = Timestamp.fromDate(updates.timestamp);
    }

    // Use set with merge: true to handle cases where the document might be missing
    // This effectively performs an "upsert"
    await messageRef.set(updateData, { merge: true });

    console.log(`[ChatHistory] Updated/Upserted message ${messageId} for ${brandId}/${userId}`);
  } catch (error) {
    console.error('[ChatHistory] Error updating message:', error);
    throw error;
  }
}

export async function deleteMessagesAfter(
  brandId: string,
  userId: string,
  messageId: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const messagesRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages');

    // Get the timestamp of the message to delete after
    const messageDoc = await messagesRef.doc(messageId).get();
    if (!messageDoc.exists) {
      throw new Error(`Message ${messageId} not found`);
    }

    const messageTimestamp = messageDoc.data()?.timestamp;
    if (!messageTimestamp) {
      throw new Error(`Message ${messageId} has no timestamp`);
    }

    // Get all messages after this timestamp
    const snapshot = await messagesRef
      .orderBy('timestamp', 'asc')
      .startAfter(messageTimestamp)
      .get();

    // Delete all messages after this one
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`[ChatHistory] Deleted ${snapshot.docs.length} messages after ${messageId} for ${brandId}/${userId}`);
  } catch (error) {
    console.error('[ChatHistory] Error deleting messages after:', error);
    throw error;
  }
}

export async function deleteNextAssistantMessage(
  brandId: string,
  userId: string,
  messageId: string
): Promise<string | null> {
  try {
    const adminDb = getAdminDb();
    const messagesRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages');

    // Get the timestamp of the message
    const messageDoc = await messagesRef.doc(messageId).get();
    if (!messageDoc.exists) {
      console.warn(`[ChatHistory] Message ${messageId} not found, skipping deleteNextAssistantMessage`);
      return null;
    }

    const messageTimestamp = messageDoc.data()?.timestamp;
    if (!messageTimestamp) {
      console.warn(`[ChatHistory] Message ${messageId} has no timestamp, skipping deleteNextAssistantMessage`);
      return null;
    }

    // Get the next message after this timestamp (limit to 1)
    const snapshot = await messagesRef
      .orderBy('timestamp', 'asc')
      .startAfter(messageTimestamp)
      .limit(1)
      .get();

    // Only delete if the next message is an assistant message
    if (snapshot.docs.length > 0) {
      const nextMessageDoc = snapshot.docs[0];
      const nextMessageData = nextMessageDoc.data();
      
      if (nextMessageData.role === 'assistant') {
        await nextMessageDoc.ref.delete();
        const deletedId = nextMessageDoc.id;
        console.log(`[ChatHistory] Deleted next assistant message ${deletedId} after ${messageId} for ${brandId}/${userId}`);
        return deletedId;
      }
    }

    console.log(`[ChatHistory] No assistant message found after ${messageId} for ${brandId}/${userId}`);
    return null;
  } catch (error) {
    console.error('[ChatHistory] Error deleting next assistant message:', error);
    throw error;
  }
}

// ============================================================================
// CONVERSATION MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Create a new conversation
 */
export async function createConversation(
  brandId: string,
  userId: string,
  title?: string
): Promise<Conversation> {
  try {
    const adminDb = getAdminDb();
    const now = new Date().toISOString();
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const conversation: Conversation = {
      id: conversationId,
      brandId,
      userId,
      title: title || 'New Conversation',
      preview: '',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      isArchived: false,
    };

    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    await conversationRef.set(conversation);

    console.log(`[ChatHistory] Created conversation ${conversationId} for ${brandId}/${userId}`);
    return conversation;
  } catch (error) {
    console.error('[ChatHistory] Error creating conversation:', error);
    throw error;
  }
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(
  brandId: string,
  userId: string,
  conversationId: string
): Promise<Conversation | null> {
  try {
    const adminDb = getAdminDb();
    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    const doc = await conversationRef.get();
    if (!doc.exists) {
      return null;
    }

    return doc.data() as Conversation;
  } catch (error) {
    console.error('[ChatHistory] Error getting conversation:', error);
    return null;
  }
}

/**
 * List all conversations for a user
 */
export async function listConversations(
  brandId: string,
  userId: string,
  includeArchived: boolean = false,
  limit: number = 50
): Promise<ConversationListItem[]> {
  try {
    const adminDb = getAdminDb();
    // Fetch all conversations without filtering by isArchived in the query
    // to avoid requiring a composite index (isArchived + updatedAt)
    // We filter in code instead, which is fine for typical conversation counts
    const query = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .orderBy('updatedAt', 'desc')
      .limit(limit * 2); // Fetch more to account for filtered archived items

    const snapshot = await query.get();

    const conversations: ConversationListItem[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const isArchived = data.isArchived === true;

      // Filter out archived conversations if not requested
      if (!includeArchived && isArchived) {
        return;
      }

      conversations.push({
        id: doc.id,
        title: data.title || 'Untitled Conversation',
        preview: data.preview || '',
        messageCount: data.messageCount || 0,
        updatedAt: data.updatedAt,
        isArchived: isArchived,
      });
    });

    // Limit final results after filtering
    const limitedConversations = conversations.slice(0, limit);

    console.log(`[ChatHistory] Listed ${limitedConversations.length} conversations for ${brandId}/${userId}`);
    return limitedConversations;
  } catch (error) {
    console.error('[ChatHistory] Error listing conversations:', error);
    return [];
  }
}

/**
 * Update conversation metadata (called after each message is saved)
 */
async function updateConversationMetadata(
  brandId: string,
  userId: string,
  conversationId: string,
  message: ChatMessage
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    const doc = await conversationRef.get();
    const now = new Date().toISOString();

    if (!doc.exists) {
      // Create the conversation if it doesn't exist
      const newConversation: Conversation = {
        id: conversationId,
        brandId,
        userId,
        title: message.role === 'user' ? generateConversationTitle(message.content) : 'New Conversation',
        preview: message.role === 'user' ? generateConversationPreview(message.content) : '',
        messageCount: 1,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        isArchived: false,
      };
      await conversationRef.set(newConversation);
    } else {
      const data = doc.data();
      const updates: any = {
        updatedAt: now,
        lastMessageAt: now,
        messageCount: FieldValue.increment(1),
      };

      // Update title/preview from first user message if not set
      if (message.role === 'user' && (!data?.preview || data.preview === '')) {
        updates.title = generateConversationTitle(message.content);
        updates.preview = generateConversationPreview(message.content);
      }

      await conversationRef.update(updates);
    }
  } catch (error) {
    console.error('[ChatHistory] Error updating conversation metadata:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  brandId: string,
  userId: string,
  conversationId: string,
  title: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    await conversationRef.update({
      title,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[ChatHistory] Updated title for conversation ${conversationId}`);
  } catch (error) {
    console.error('[ChatHistory] Error updating conversation title:', error);
    throw error;
  }
}

/**
 * Archive/unarchive a conversation
 */
export async function archiveConversation(
  brandId: string,
  userId: string,
  conversationId: string,
  archive: boolean = true
): Promise<void> {
  try {
    const adminDb = getAdminDb();
    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    await conversationRef.update({
      isArchived: archive,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[ChatHistory] ${archive ? 'Archived' : 'Unarchived'} conversation ${conversationId}`);
  } catch (error) {
    console.error('[ChatHistory] Error archiving conversation:', error);
    throw error;
  }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(
  brandId: string,
  userId: string,
  conversationId: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();

    // Delete all messages in this conversation
    const messagesRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages');

    const messagesSnapshot = await messagesRef
      .where('conversationId', '==', conversationId)
      .get();

    const batch = adminDb.batch();

    // Delete messages
    messagesSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    // Delete conversation document
    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    batch.delete(conversationRef);

    await batch.commit();

    console.log(`[ChatHistory] Deleted conversation ${conversationId} and ${messagesSnapshot.docs.length} messages`);
  } catch (error) {
    console.error('[ChatHistory] Error deleting conversation:', error);
    throw error;
  }
}

/**
 * Clear messages in a specific conversation (but keep the conversation)
 */
export async function clearConversationHistory(
  brandId: string,
  userId: string,
  conversationId: string
): Promise<void> {
  try {
    const adminDb = getAdminDb();

    const messagesRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('messages');

    const messagesSnapshot = await messagesRef
      .where('conversationId', '==', conversationId)
      .get();

    const batch = adminDb.batch();
    messagesSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    // Update conversation metadata
    const conversationRef = adminDb
      .collection('chat_history')
      .doc(brandId)
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .doc(conversationId);

    batch.update(conversationRef, {
      messageCount: 0,
      preview: '',
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();

    console.log(`[ChatHistory] Cleared ${messagesSnapshot.docs.length} messages in conversation ${conversationId}`);
  } catch (error) {
    console.error('[ChatHistory] Error clearing conversation history:', error);
    throw error;
  }
}

// Re-export for convenience
export { DEFAULT_CONVERSATION_ID } from '@/lib/types/conversation';
