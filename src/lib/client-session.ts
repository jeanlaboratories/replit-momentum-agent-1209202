'use client';

import { auth } from '@/lib/firebase';

// SECURE: Client-side session management via API routes only
export async function createSecureSession(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    const idToken = await user.getIdToken(true);
    
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to create session:', error);
    return false;
  }
}

// SECURE: Clear session via API
export async function clearSecureSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'DELETE'
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to clear session:', error);
    return false;
  }
}

// SECURE: Get current user info
export function getCurrentUser() {
  return auth.currentUser;
}

// SECURE: Check if user is authenticated
export function isUserAuthenticated(): boolean {
  return !!auth.currentUser;
}