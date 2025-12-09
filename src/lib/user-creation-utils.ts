/**
 * Shared utility functions for bulletproof user creation
 * 
 * This module provides atomic user creation with:
 * - Automatic rollback on failure
 * - Post-creation verification
 * - Comprehensive logging
 * - Idempotency support
 */

import 'server-only';
import { getAdminInstances } from './firebase/admin';
import { FirebaseError } from 'firebase-admin/app';

export interface CreateUserResult {
  success: boolean;
  userId?: string;
  message: string;
  error?: string;
}

export interface UserCreationData {
  email: string;
  password: string;
  displayName: string;
  emailVerified?: boolean;
  disabled?: boolean;
}

export interface UserDocumentData {
  uid: string;
  email: string;
  displayName: string;
  brandId: string;
  photoURL?: string | null;
  agentEngineId?: string; // For personal, persistent memory
}

export interface BrandMemberData {
  id: string;
  brandId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL?: string | null;
  role: 'MANAGER' | 'CONTRIBUTOR';
  status: 'ACTIVE' | 'INACTIVE';
  invitedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Verifies that all required Firestore documents exist for a user
 */
export async function verifyUserDocuments(
  userId: string,
  brandId: string,
  options: { requireBrandMember?: boolean } = {}
): Promise<{ success: boolean; missing: string[] }> {
  const { adminDb } = getAdminInstances();
  const missing: string[] = [];

  try {
    // Check user document
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      missing.push('user document');
    }

    // Check brand member document if required
    if (options.requireBrandMember) {
      const brandMemberId = `${brandId}_${userId}`;
      const memberDoc = await adminDb.collection('brandMembers').doc(brandMemberId).get();
      if (!memberDoc.exists) {
        missing.push('brandMember document');
      }
    }

    return {
      success: missing.length === 0,
      missing,
    };
  } catch (error) {
    console.error('[verifyUserDocuments] Verification failed:', error);
    return {
      success: false,
      missing: ['verification failed'],
    };
  }
}

/**
 * Deletes a Firebase Auth user (used for rollback)
 */
export async function deleteAuthUser(userId: string, context: string): Promise<void> {
  const { adminAuth } = getAdminInstances();
  
  try {
    await adminAuth.deleteUser(userId);
    console.log(`[${context}] Successfully deleted Auth user: ${userId}`);
  } catch (error: any) {
    console.error(`[${context}] CRITICAL: Failed to delete Auth user ${userId}:`, error);
    // Log to monitoring service in production
    throw new Error(`Rollback failed: Could not delete Auth user ${userId}. Manual cleanup required.`);
  }
}

/**
 * Creates a Firebase Auth user and Firestore user document atomically
 * Includes automatic rollback on failure
 */
export async function createUserWithDocument(
  authData: UserCreationData,
  userDocData: Omit<UserDocumentData, 'uid' | 'email' | 'displayName'>
): Promise<CreateUserResult> {
  const { adminAuth, adminDb } = getAdminInstances();
  let createdUserId: string | undefined;

  try {
    // Step 1: Check if user already exists (idempotency)
    try {
      const existingUser = await adminAuth.getUserByEmail(authData.email);
      console.log(`[createUserWithDocument] User already exists: ${authData.email}`);
      
      // Verify documents exist
      const verification = await verifyUserDocuments(existingUser.uid, userDocData.brandId);
      
      if (verification.success) {
        return {
          success: true,
          userId: existingUser.uid,
          message: 'User already exists with all required documents',
        };
      } else {
        // User exists but documents are missing - this is a repair scenario
        console.warn(`[createUserWithDocument] User exists but missing documents:`, verification.missing);
        
        // Create missing user document
        if (verification.missing.includes('user document')) {
          await adminDb.collection('users').doc(existingUser.uid).set({
            uid: existingUser.uid,
            email: authData.email,
            displayName: authData.displayName,
            ...userDocData,
          });
          console.log(`[createUserWithDocument] Repaired missing user document for ${existingUser.uid}`);
        }
        
        return {
          success: true,
          userId: existingUser.uid,
          message: 'User exists, missing documents repaired',
        };
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User doesn't exist, continue with creation
    }

    // Step 2: Create Firebase Auth user
    console.log(`[createUserWithDocument] Creating Auth user: ${authData.email}`);
    const userRecord = await adminAuth.createUser({
      email: authData.email,
      password: authData.password,
      displayName: authData.displayName,
      emailVerified: authData.emailVerified ?? false,
      disabled: authData.disabled ?? false,
    });
    createdUserId = userRecord.uid;
    console.log(`[createUserWithDocument] Auth user created: ${createdUserId}`);

    // Step 3: Create Firestore user document
    try {
      const userDocRef = adminDb.collection('users').doc(userRecord.uid);
      await userDocRef.set({
        uid: userRecord.uid,
        email: authData.email,
        displayName: authData.displayName,
        ...userDocData,
      });
      console.log(`[createUserWithDocument] User document created: ${userRecord.uid}`);
    } catch (firestoreError) {
      console.error(`[createUserWithDocument] Failed to create user document:`, firestoreError);
      // Rollback: Delete Auth user
      await deleteAuthUser(userRecord.uid, 'createUserWithDocument');
      throw new Error('Failed to create user document. Auth user has been rolled back.');
    }

    // Step 4: Verify all documents were created
    const verification = await verifyUserDocuments(userRecord.uid, userDocData.brandId);
    if (!verification.success) {
      console.error(`[createUserWithDocument] Verification failed. Missing:`, verification.missing);
      // Rollback: Delete Auth user and documents
      await deleteAuthUser(userRecord.uid, 'createUserWithDocument');
      throw new Error(`Document creation verification failed. Missing: ${verification.missing.join(', ')}`);
    }

    console.log(`[createUserWithDocument] User creation complete and verified: ${userRecord.uid}`);
    return {
      success: true,
      userId: userRecord.uid,
      message: 'User created successfully',
    };

  } catch (error: any) {
    console.error('[createUserWithDocument] Error:', error);
    
    // If we created an Auth user but something failed, ensure rollback happened
    if (createdUserId) {
      console.error(`[createUserWithDocument] CRITICAL: Orphaned Auth user may exist: ${createdUserId}`);
    }

    return {
      success: false,
      message: error.message || 'Failed to create user',
      error: error.code || 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Creates a brand member document with verification
 */
export async function createBrandMemberDocument(
  memberData: Omit<BrandMemberData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; message: string; memberId?: string }> {
  const { adminDb } = getAdminInstances();
  
  try {
    const memberId = `${memberData.brandId}_${memberData.userId}`;
    const now = new Date().toISOString();
    
    const brandMemberRef = adminDb.collection('brandMembers').doc(memberId);
    await brandMemberRef.set({
      ...memberData,
      id: memberId,
      createdAt: now,
      updatedAt: now,
    });
    
    // Verify it was created
    const doc = await brandMemberRef.get();
    if (!doc.exists) {
      throw new Error('Brand member document creation verification failed');
    }
    
    console.log(`[createBrandMemberDocument] Brand member created: ${memberId}`);
    return {
      success: true,
      message: 'Brand member created successfully',
      memberId,
    };
  } catch (error: any) {
    console.error('[createBrandMemberDocument] Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create brand member',
    };
  }
}

/**
 * Checks if a user has orphaned Auth account (Auth exists but Firestore docs missing)
 */
export async function checkForOrphanedUser(email: string): Promise<{
  isOrphaned: boolean;
  userId?: string;
  missing?: string[];
}> {
  const { adminAuth, adminDb } = getAdminInstances();
  
  try {
    // Check if Auth user exists
    const authUser = await adminAuth.getUserByEmail(email);
    
    // Check if user document exists
    const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
    
    if (!userDoc.exists) {
      return {
        isOrphaned: true,
        userId: authUser.uid,
        missing: ['user document'],
      };
    }
    
    // Check if brand member exists
    const userData = userDoc.data();
    if (userData?.brandId) {
      const brandMemberId = `${userData.brandId}_${authUser.uid}`;
      const memberDoc = await adminDb.collection('brandMembers').doc(brandMemberId).get();
      
      if (!memberDoc.exists) {
        return {
          isOrphaned: true,
          userId: authUser.uid,
          missing: ['brandMember document'],
        };
      }
    }
    
    return { isOrphaned: false };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { isOrphaned: false };
    }
    throw error;
  }
}

/**
 * Repairs an orphaned user by creating missing Firestore documents
 */
export async function repairOrphanedUser(
  userId: string,
  email: string,
  displayName: string,
  brandId: string,
  role: 'MANAGER' | 'CONTRIBUTOR' = 'CONTRIBUTOR'
): Promise<{ success: boolean; message: string; repaired?: string[] }> {
  const { adminDb } = getAdminInstances();
  const repaired: string[] = [];
  
  try {
    // Check user document
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await adminDb.collection('users').doc(userId).set({
        uid: userId,
        email,
        displayName,
        brandId,
        photoURL: null,
      });
      repaired.push('user document');
    }
    
    // Check brand member
    const brandMemberId = `${brandId}_${userId}`;
    const memberDoc = await adminDb.collection('brandMembers').doc(brandMemberId).get();
    if (!memberDoc.exists) {
      const now = new Date().toISOString();
      await adminDb.collection('brandMembers').doc(brandMemberId).set({
        id: brandMemberId,
        brandId,
        userId,
        userEmail: email,
        userDisplayName: displayName,
        userPhotoURL: null,
        role,
        status: 'ACTIVE',
        joinedAt: now, // Add joinedAt timestamp to match seed data structure
        createdAt: now,
        updatedAt: now,
      });
      repaired.push('brandMember document');
    }
    
    console.log(`[repairOrphanedUser] Repaired documents for ${userId}:`, repaired);
    return {
      success: true,
      message: `Repaired ${repaired.length} missing document(s)`,
      repaired,
    };
  } catch (error: any) {
    console.error('[repairOrphanedUser] Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to repair orphaned user',
    };
  }
}
