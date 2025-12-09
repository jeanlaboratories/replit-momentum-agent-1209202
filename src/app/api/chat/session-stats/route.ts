import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    
    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    await requireBrandAccess(user.uid, brandId);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    let response;
    try {
      response = await fetch(
        `${PYTHON_SERVICE_URL}/agent/session-stats?brand_id=${brandId}&user_id=${user.uid}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // Return empty stats if Python service is unavailable
      return NextResponse.json({ stats: null, note: 'Session stats unavailable' });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch session stats', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session stats' },
      { status: 500 }
    );
  }
}
