import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import {
  createConversation,
  listConversations,
  updateConversationTitle,
  archiveConversation,
  deleteConversation,
} from '@/lib/chat-history';

/**
 * GET /api/chat/conversations - List all conversations for a user
 * Query params: brandId, includeArchived (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    await requireBrandAccess(user.uid, brandId);

    const conversations = await listConversations(brandId, user.uid, includeArchived);

    return NextResponse.json({ success: true, conversations }, { status: 200 });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/conversations - Create a new conversation
 * Body: { brandId, title? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, title } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    await requireBrandAccess(user.uid, brandId);

    const conversation = await createConversation(brandId, user.uid, title);

    return NextResponse.json({ success: true, conversation }, { status: 200 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/chat/conversations - Update a conversation (title, archive status)
 * Body: { brandId, conversationId, title?, isArchived? }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, conversationId, title, isArchived } = body;

    if (!brandId || !conversationId) {
      return NextResponse.json(
        { error: 'Brand ID and Conversation ID required' },
        { status: 400 }
      );
    }

    await requireBrandAccess(user.uid, brandId);

    // Update title if provided
    if (title !== undefined) {
      await updateConversationTitle(brandId, user.uid, conversationId, title);
    }

    // Update archive status if provided
    if (isArchived !== undefined) {
      await archiveConversation(brandId, user.uid, conversationId, isArchived);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/conversations - Delete a conversation
 * Query params: brandId, conversationId
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const conversationId = searchParams.get('conversationId');

    if (!brandId || !conversationId) {
      return NextResponse.json(
        { error: 'Brand ID and Conversation ID required' },
        { status: 400 }
      );
    }

    await requireBrandAccess(user.uid, brandId);

    await deleteConversation(brandId, user.uid, conversationId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
