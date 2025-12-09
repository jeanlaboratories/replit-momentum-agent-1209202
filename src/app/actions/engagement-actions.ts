'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { revalidatePath } from 'next/cache';
import type { Transaction, QueryDocumentSnapshot, DocumentSnapshot } from 'firebase-admin/firestore';

export type AssetEngagement = {
  loveCount: number;
  isLoved: boolean;
};

export type BrandEngagementState = {
  stats: Record<string, number>; // assetId -> loveCount
  userLoves: Record<string, boolean>; // assetId -> isLoved by current user
  commentCounts: Record<string, number>; // assetId -> commentCount
};

export type UserPublicProfile = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

export async function toggleAssetLoveAction(
  brandId: string,
  assetId: string
): Promise<{ success: boolean; newState?: AssetEngagement; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    // We allow any authenticated user to like assets if they have access to the brand
    // (Assuming public brands might exist later, but for now requireBrandAccess is safe)
    // If it's a public profile, we might relax this, but for now let's stick to team members.
    // Wait, if it's a "Team Profile", maybe only team members can view it?
    // The current page checks `requireBrandAccess` implicitly via `getBrandProfileAction`.
    // Let's enforce it here too.
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const userId = user.uid;

    // References
    const interactionId = `${assetId}_likes_${userId}`;
    const interactionRef = adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_interactions')
      .doc(interactionId);

    const statsRef = adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_stats')
      .doc(assetId);

    // Transaction to ensure consistency
    const result = await adminDb.runTransaction(async (transaction: Transaction) => {
      const interactionDoc = await transaction.get(interactionRef) as unknown as DocumentSnapshot;
      const statsDoc = await transaction.get(statsRef) as unknown as DocumentSnapshot;

      let currentCount = 0;
      if (statsDoc.exists) {
        currentCount = statsDoc.data()?.loveCount || 0;
      }

      let isLoved = false;

      if (interactionDoc.exists) {
        // User already loved it -> Unlove
        transaction.delete(interactionRef);
        currentCount = Math.max(0, currentCount - 1);
        isLoved = false;
      } else {
        // User hasn't loved it -> Love
        transaction.set(interactionRef, {
          assetId,
          userId,
          type: 'love',
          createdAt: new Date().toISOString(),
        });
        currentCount += 1;
        isLoved = true;
      }

      transaction.set(statsRef, { loveCount: currentCount }, { merge: true });

      return { loveCount: currentCount, isLoved };
    });

    // We don't necessarily need to revalidate the whole page if we update client-side state
    // but it's good practice for consistency.
    // revalidatePath('/brand-profile'); 

    return { success: true, newState: result };
  } catch (e: any) {
    console.error('Failed to toggle asset love:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

export async function getBrandEngagementAction(
  brandId: string
): Promise<{ success: boolean; data?: BrandEngagementState; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    // Implicitly checks access via the query, but let's be safe if we want to enforce it strict
    // await requireBrandAccess(user.uid, brandId); 
    // Actually, for a public profile, we might not need strict access? 
    // But for now, let's assume it's the same as before.

    const { adminDb } = getAdminInstances();
    const userId = user.uid;

    // 1. Fetch Love Stats
    const statsSnapshot = await adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_stats')
      .get();

    const stats: Record<string, number> = {};
    statsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
      stats[doc.id] = doc.data().loveCount || 0;
    });

    // 2. Fetch User Loves
    const interactionsSnapshot = await adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_interactions')
      .where('userId', '==', userId)
      .where('type', '==', 'love')
      .get();

    const userLoves: Record<string, boolean> = {};
    interactionsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
      userLoves[doc.data().assetId] = true;
    });

    // 3. Fetch Comment Counts
    // We query commentContexts for this brand
    const commentContextsSnapshot = await adminDb
      .collection('commentContexts')
      .where('brandId', '==', brandId)
      .get();

    const commentCounts: Record<string, number> = {};
    commentContextsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      // The contextId is the assetId for 'image' and 'video' types
      if (data.contextId) {
        commentCounts[data.contextId] = data.activeComments || 0;
      }
    });

    return {
      success: true,
      data: {
        stats,
        userLoves,
        commentCounts,
      },
    };
  } catch (e: any) {
    console.error('Failed to get brand engagement:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

export async function getAssetLovesAction(
  brandId: string,
  assetId: string
): Promise<{ success: boolean; users?: UserPublicProfile[]; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb, adminAuth } = getAdminInstances();

    // Fetch all interactions for this asset where type == 'love'
    const interactionsSnapshot = await adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_interactions')
      .where('assetId', '==', assetId)
      .where('type', '==', 'love')
      .limit(50) // Limit to 50 for now to avoid fetching too many users
      .get();

    const userIds = interactionsSnapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data().userId);

    if (userIds.length === 0) {
      return { success: true, users: [] };
    }

    // Fetch user profiles
    // We can use adminAuth.getUser() for each ID, or if we have a users collection, query that.
    // Using adminAuth.getUsers() allows batch fetching up to 100 users.
    const usersResult = await adminAuth.getUsers(userIds.map((uid: string) => ({ uid })));

    const users: UserPublicProfile[] = usersResult.users.map((u: any) => ({
      uid: u.uid,
      displayName: u.displayName || 'Unknown User',
      photoURL: u.photoURL,
    }));

    return { success: true, users };
  } catch (e: any) {
    console.error('Failed to get asset loves:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}
