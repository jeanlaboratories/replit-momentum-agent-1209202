import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { getChatHistory, createConversation } from '@/lib/chat-history';
import { generateConversationTitle } from '@/lib/types/conversation';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const conversationId = searchParams.get('conversationId'); // Optional - for multi-conversation support

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    await requireBrandAccess(user.uid, brandId);

    // Load chat history from Firestore (persistent storage)
    // Pass conversationId if provided, otherwise defaults to 'default' conversation
    const messages = await getChatHistory(brandId, user.uid, 50, conversationId || undefined);

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, role, content, media, thoughts, structuredData, conversationId } = body;

    if (!brandId || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Allow empty content if media is present, otherwise require content
    if (!content && (!media || media.length === 0)) {
      return NextResponse.json({ error: 'Content or media required' }, { status: 400 });
    }

    await requireBrandAccess(user.uid, brandId);

    // Auto-create a conversation for messages without a conversationId
    // This ensures every message is saved to a browsable conversation
    let effectiveConversationId = conversationId;
    let newConversation = null;

    if (!conversationId) {
      // Create a new conversation with a title based on the message content
      // For user messages, generate title from their message
      // For assistant messages, use a default title
      const title = role === 'user'
        ? generateConversationTitle(content || 'New Chat')
        : 'New Conversation';
      newConversation = await createConversation(brandId, user.uid, title);
      effectiveConversationId = newConversation.id;
      console.log(`[ChatHistory] Auto-created conversation ${effectiveConversationId} for ${role} message`);
    }

    // Save message to Firestore with conversationId
    const { saveChatMessage } = await import('@/lib/chat-history');

    const messageId = await saveChatMessage(brandId, user.uid, {
      role,
      content,
      timestamp: new Date(),
      conversationId: effectiveConversationId,
      media,
      thoughts,
      structuredData
    }, effectiveConversationId);

    // Return the new conversationId if one was created, so the client can track it
    return NextResponse.json({
      success: true,
      messageId,
      conversationId: effectiveConversationId,
      newConversation: newConversation ? {
        id: newConversation.id,
        title: newConversation.title,
      } : undefined,
    }, { status: 200 });
  } catch (error) {
    console.error('Error saving chat message:', error);
    return NextResponse.json(
      { error: 'Failed to save chat message' },
      { status: 500 }
    );
  }
}
