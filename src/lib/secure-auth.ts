
'use server';

import { cookies } from 'next/headers';
import { getAdminInstances } from '@/lib/firebase/admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthenticatedUser extends DecodedIdToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
}

// SECURE: Server-side authentication using session cookies
export async function getAuthenticatedUser(getFullProfile = false): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  
  if (!sessionCookie) {
    throw new Error('No authentication session found');
  }

  try {
    const { adminAuth } = getAdminInstances();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    let fullUser: AuthenticatedUser = {
      ...decodedClaims,
      uid: decodedClaims.uid,
      email: decodedClaims.email || '',
      emailVerified: decodedClaims.email_verified || false
    };

    if (getFullProfile) {
        const userRecord = await adminAuth.getUser(decodedClaims.uid);
        fullUser = {
            ...fullUser,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL,
        };
    }
    
    return fullUser;

  } catch (error) {
    console.error('Auth error in getAuthenticatedUser:', error);
    throw new Error('Invalid or expired authentication session');
  }
}

// SECURE: Create session cookie from ID token
export async function createSessionCookie(idToken: string): Promise<void> {
  try {
    const { adminAuth } = getAdminInstances();
    
    // Create session cookie with 5 days expiry
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    // Always use secure cookies for HTTPS (custom domains) or production
    // Custom domains like jeanlabs.ai use HTTPS even in dev mode
    const isSecure = process.env.NODE_ENV === 'production' || 
                     process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') ||
                     true; // Always secure for safety
    
    const cookieStore = await cookies();
    cookieStore.set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/'
    });
  } catch (error) {
    throw new Error('Failed to create authentication session');
  }
}

// SECURE: Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('__session');
}
