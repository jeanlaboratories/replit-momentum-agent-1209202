import { NextRequest, NextResponse } from 'next/server';

/**
 * API route that proxies requests to the Python service's nano-banana endpoint.
 * This avoids CORS issues when calling from the browser.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

    const response = await fetch(`${pythonServiceUrl}/media/nano-banana`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { status: 'error', error: `Python service error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[nano-banana API] Error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
