import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    // Make request to Python FastAPI service
    const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/hello`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python service responded with status: ${pythonResponse.status}`);
    }

    const data = await pythonResponse.json();
    
    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('Error communicating with Python service:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to communicate with Python service',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}