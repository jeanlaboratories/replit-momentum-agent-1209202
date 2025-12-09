import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';

// SECURE: Create authentication session
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    // Create session cookie using Firebase Admin
    const { adminAuth } = getAdminInstances();
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Create response with Set-Cookie header
    const response = NextResponse.json({ success: true });

    // Set the session cookie in the response
    response.cookies.set('__session', sessionCookie, {
      maxAge: expiresIn / 1000, // maxAge is in seconds
      httpOnly: true,
      secure: true, // Always secure for Cloud Run (HTTPS)
      sameSite: 'lax',
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// SECURE: Clear authentication session
export async function DELETE() {
  try {
    const response = NextResponse.json({ success: true });

    // Clear the session cookie by setting it to expire immediately
    response.cookies.set('__session', '', {
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Session cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}