// Brand Soul - Extract Colors from Screenshot API
// Calls Python service to extract color palettes from website screenshots

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, screenshotUrl } = body;

    if (!brandId || !screenshotUrl) {
      return NextResponse.json(
        { success: false, message: 'Missing brandId or screenshotUrl' },
        { status: 400 }
      );
    }

    // Authentication & Authorization
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    // Call Python color extraction service
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(`${pythonServiceUrl}/extract-colors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot_url: screenshotUrl,
        num_colors: 5
      }),
    });

    if (!response.ok) {
      throw new Error(`Python service error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      colors: data.colors || [],
      message: `Extracted ${data.colors?.length || 0} colors from screenshot`,
    });

  } catch (error) {
    console.error('[Brand Soul Extract Colors] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
