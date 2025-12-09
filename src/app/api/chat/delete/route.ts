import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { deleteChatMessage, deleteMessagesAfter } from '@/lib/chat-history';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const messageId = searchParams.get('messageId');
    const cascade = searchParams.get('cascade') === 'true'; // If true, delete all messages after this one (not recommended)

    if (!brandId || !messageId) {
      return NextResponse.json(
        { error: 'Brand ID and Message ID required' },
        { status: 400 }
      );
    }

    await requireBrandAccess(user.uid, brandId);

    // Check if this is the last message BEFORE deleting it
    // We need to know this to decide if we should sync with Python backend
    // Note: This check is approximate because we don't have a direct "isLast" method,
    // but we can check if there are any messages after it.
    // Actually, let's just try to delete from Python if it's a single delete.
    // If it's not the last one, the Python side might delete the WRONG thing (the actual last one).
    // So we MUST check.

    // We can use getChatHistory to check, but that's heavy.
    // Let's assume for now that if the user is deleting, they usually delete the last one.
    // BUT if they delete a middle one, we break context.
    // Ideally we should check.
    // Let's import getChatHistory and check.

    // Optimization: Just call deleteChatMessage first. 
    // If we implement "deleteMessagesAfter" logic, we can see if it finds anything.

    // Let's just implement the Python call for now and assume "Delete Last" behavior
    // because that's what the user is complaining about (context growing on retry).
    // If they delete a middle message, the context will be slightly out of sync (Python has it, UI doesn't),
    // which is the CURRENT state anyway.
    // But if they delete the LAST message, we fix the "only grows" issue.
    // So calling delete-last-message is an improvement, provided we only do it if it IS the last message.

    // How to check if it's the last message efficiently?
    // We can query Firestore for messages with timestamp > messageTimestamp.
    // But we don't have the message timestamp here easily without fetching it.

    // Let's fetch the message first.
    const { getChatHistory } = await import('@/lib/chat-history');
    const history = await getChatHistory(brandId, user.uid, 1); // Get just the very last message

    const isLastMessage = history.length > 0 && history[0].id === messageId;

    // Delete the message from Firestore
    await deleteChatMessage(brandId, user.uid, messageId);

    // Only cascade delete if explicitly requested (default is false - only delete the single message)
    if (cascade) {
      await deleteMessagesAfter(brandId, user.uid, messageId);
    }

    // Sync with Python backend if it was the last message
    if (isLastMessage) {
      const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
      try {
        await fetch(`${PYTHON_SERVICE_URL}/agent/delete-last-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId, user_id: user.uid }),
        });
      } catch (err) {
        console.error('Failed to sync deletion with Python agent:', err);
        // Don't fail the request, just log it
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}

