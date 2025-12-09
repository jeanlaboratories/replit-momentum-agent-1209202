
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User as FirebaseAuthUser
} from 'firebase/auth';
import { auth, db, getGoogleProvider } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { logoutAction } from '@/app/actions';
import { createSecureSession, clearSecureSession } from '@/lib/client-session';

interface AuthContextType {
  user: (FirebaseAuthUser & AppUser) | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; message: string; requiresVerification?: boolean; }>;
  loginWithGoogle: () => Promise<{ success: boolean; message: string; isNewUser?: boolean; }>;
  signupWithEmail: (email: string, password: string, displayName: string, brandName: string) => Promise<{ success: boolean; message: string; requiresVerification?: boolean; }>;
  logout: () => Promise<void>;
  brandId: string | null;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithEmail: async () => ({ success: false, message: 'Not initialized' }),
  loginWithGoogle: async () => ({ success: false, message: 'Not initialized' }),
  signupWithEmail: async () => ({ success: false, message: 'Not initialized' }),
  logout: async () => {},
  brandId: null,
  refreshUserProfile: async () => { },
});

const getUserProfile = async (uid: string): Promise<AppUser | null> => {
    console.log('[AUTH] getUserProfile called for uid:', uid);
    try {
      // Fetch user profile from server-side API (bypasses Firestore security rules)
      console.log('[AUTH] Fetching user profile from API...');
      const response = await fetch('/api/user/profile');
      
      if (!response.ok) {
        console.log('[AUTH] API response not OK:', response.status);
        return null;
      }
      
      const data = await response.json();
      if (data.success && data.user) {
        console.log('[AUTH] User profile retrieved successfully:', data.user);
        return data.user as AppUser;
      }
      
      console.log('[AUTH] No user profile in API response');
      return null;
    } catch (error) {
      console.error('[AUTH] Error fetching user profile from API:', error);
      return null;
    }
};


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState< (FirebaseAuthUser & AppUser) | null>(null);
  const [loading, setLoading] = useState(true);
  const [brandId, setBrandId] = useState<string | null>(null);

  const handleAuthStateChanged = useCallback(async (firebaseUser: FirebaseAuthUser | null) => {
    console.log('[AUTH] Auth state changed. Firebase user:', firebaseUser?.uid, 'Email verified:', firebaseUser?.emailVerified);
    if (firebaseUser) {
        // CRITICAL: Check email verification FIRST
        if (!firebaseUser.emailVerified) {
          console.log('[AUTH] Email not verified - blocking authentication');
          await signOut(auth);
          setUser(null);
          setBrandId(null);
          setLoading(false);
          return;
        }

        // Create secure session FIRST (needed for API calls)
        try {
          console.log('[AUTH] Creating secure session...');
          await createSecureSession();
          console.log('[AUTH] Secure session created successfully');
        } catch (error) {
          console.error('[AUTH] Failed to create secure session:', error);
          setLoading(false);
          return;
        }

        // Now fetch user profile (requires session cookie)
        const userProfile = await getUserProfile(firebaseUser.uid);
        console.log('[AUTH] User profile from API:', userProfile ? 'Found' : 'NOT FOUND', userProfile);
        
        if (userProfile) {
            // Check if user has a pending invitation to consume
            try {
              if (firebaseUser.email) {
                await fetch('/api/auth/consume-invitation', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    userId: firebaseUser.uid, 
                    userEmail: firebaseUser.email 
                  })
                });
              }
            } catch (error) {
              console.error('Failed to consume pending invitation:', error);
              // Don't block login if invitation consumption fails
            }
            
            const fullUser = { 
              ...firebaseUser, 
              ...userProfile,
              photoURL: firebaseUser.photoURL ?? null 
            } as (FirebaseAuthUser & AppUser);
            setUser(fullUser);
            setBrandId(fullUser.brandId);
        } else {
            // User is authenticated with Firebase, but we don't have a profile in our database.
            // This can happen, so we log them out.
            console.log('[AUTH] No Firestore profile found for user', firebaseUser.uid, '- logging out');
            await signOut(auth);
            setUser(null);
            setBrandId(null);
        }
    } else {
        setUser(null);
        setBrandId(null);
        // Clear secure session when user logs out
        try {
          await clearSecureSession();
        } catch (error) {
          console.error('Failed to clear secure session:', error);
        }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, handleAuthStateChanged);
    return () => unsubscribe();
  }, [handleAuthStateChanged]);

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        
        // Check if email is verified
        if (!userCredential.user.emailVerified) {
          await signOut(auth);
          setLoading(false);
          return { 
            success: false, 
            message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
            requiresVerification: true
          };
        }
        
        // The onAuthStateChanged listener will handle setting the user state.
        return { success: true, message: 'Logged in successfully.' };
    } catch (error: any) {
        let message = 'An unknown error occurred.';
        if (error.code) {
            switch(error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    message = 'Invalid email or password.';
                    break;
                case 'auth/invalid-email':
                    message = 'Please enter a valid email address.';
                    break;
                default:
                    message = `An unhandled error occurred: ${error.code}`;
            }
        }
        setLoading(false); // Only set loading to false on error, success is handled by listener
        return { success: false, message };
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, getGoogleProvider());
      const firebaseUser = result.user;

      // Google accounts are always verified, so no need to check emailVerified
      // Check if user exists in our database
      const userProfile = await getUserProfile(firebaseUser.uid);

      if (!userProfile) {
        // New user - they need to complete signup with a brand name
        // Sign them out and redirect to complete profile
        console.log('[AUTH] New Google user detected, needs to complete profile');

        // Call server action to create user profile for Google sign-in
        try {
          const { googleSignupAction } = await import('@/app/actions/signup');
          const signupResult = await googleSignupAction({
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
            photoURL: firebaseUser.photoURL || undefined,
          });

          if (!signupResult.success) {
            await signOut(auth);
            setLoading(false);
            return { success: false, message: signupResult.message };
          }

          // User profile created, onAuthStateChanged will handle the rest
          return { success: true, message: 'Account created successfully!', isNewUser: true };
        } catch (error) {
          console.error('[AUTH] Failed to create profile for Google user:', error);
          await signOut(auth);
          setLoading(false);
          return { success: false, message: 'Failed to create your account. Please try again.' };
        }
      }

      // Existing user - onAuthStateChanged will handle setting user state
      return { success: true, message: 'Signed in with Google successfully.' };
    } catch (error: any) {
      let message = 'Failed to sign in with Google.';
      if (error.code) {
        switch (error.code) {
          case 'auth/popup-closed-by-user':
            message = 'Sign-in cancelled. Please try again.';
            break;
          case 'auth/popup-blocked':
            message = 'Pop-up was blocked. Please allow pop-ups for this site.';
            break;
          case 'auth/account-exists-with-different-credential':
            message = 'An account already exists with this email using a different sign-in method.';
            break;
          default:
            message = `Sign-in failed: ${error.code}`;
        }
      }
      setLoading(false);
      return { success: false, message };
    }
  };

  const signupWithEmail = async (email: string, password: string, displayName: string, brandName: string) => {
    try {
      const { signupAction } = await import('@/app/actions/signup');
      const result = await signupAction({ email, password, displayName, brandName });
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to create account. Please try again.',
      };
    }
  };

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    // Also call the server action to clear the httpOnly cookie if it exists
    await logoutAction();
    setUser(null);
    setBrandId(null);
    setLoading(false);
  };


  const refreshUserProfile = useCallback(async () => {
    if (user) {
      const userProfile = await getUserProfile(user.uid);
      if (userProfile) {
        const fullUser = {
          ...user,
          ...userProfile,
        } as (FirebaseAuthUser & AppUser);
        setUser(fullUser);
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, loginWithGoogle, signupWithEmail, logout, brandId, refreshUserProfile }}>
        {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
