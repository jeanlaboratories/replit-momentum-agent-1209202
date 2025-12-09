import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { clearChatHistory } from '@/lib/chat-history';

const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandId } = body;
    
    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    await requireBrandAccess(user.uid, brandId);

    // Delete ADK session (Python backend) with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(
        `${PYTHON_SERVICE_URL}/agent/delete-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: brandId,
            user_id: user.uid,
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // If Python service is unavailable, still clear Firestore history
      console.warn('Python service unavailable, clearing Firestore history only:', fetchError.message);
      await clearChatHistory(brandId, user.uid);
      return NextResponse.json({ status: 'success', note: 'Cleared local history (Python service unavailable)' });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to delete session', details: error },
        { status: response.status }
      );
    }

    // Also clear persistent chat history from Firestore
    await clearChatHistory(brandId, user.uid);

    const data = await response.json();
    if (data.status === 'success') {
      return NextResponse.json({ status: 'success' });
    } else {
      return NextResponse.json({ error: 'Failed to delete session', details: data }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
