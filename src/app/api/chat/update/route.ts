import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { updateChatMessage, deleteMessagesAfter, deleteNextAssistantMessage } from '@/lib/chat-history';

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandId, messageId, content, media, role, timestamp, cascade = false, deleteNextOnly = true } = body;

    if (!brandId || !messageId) {
      return NextResponse.json(
        { error: 'Brand ID and Message ID required' },
        { status: 400 }
      );
    }

    if (content === undefined && media === undefined && role === undefined) {
      return NextResponse.json(
        { error: 'Content, media, or role must be provided' },
        { status: 400 }
      );
    }

    await requireBrandAccess(user.uid, brandId);

    // Update the message (Upsert)
    await updateChatMessage(brandId, user.uid, messageId, {
      content,
      media,
      role,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });

    // If deleteNextOnly is true (default), delete only the immediate next assistant message
    // If cascade is true, delete all messages after this one
    if (deleteNextOnly && !cascade) {
      await deleteNextAssistantMessage(brandId, user.uid, messageId);
    } else if (cascade) {
      await deleteMessagesAfter(brandId, user.uid, messageId);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update message' },
      { status: 500 }
    );
  }
}

