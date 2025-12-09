
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { brandId } = body;

    if (!brandId) {
      return NextResponse.json(
        { error: 'Brand ID required' },
        { status: 400 }
      );
    }

    await requireBrandAccess(user.uid, brandId);

    // Call Python backend to delete last interaction
    const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/agent/delete-last-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, user_id: user.uid }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to undo last turn in agent' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error undoing last turn:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
