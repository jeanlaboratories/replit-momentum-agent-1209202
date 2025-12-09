'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { IndividualIdentity } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Get Individual Identity for a user
 */
export async function getIndividualIdentityAction(
  brandId: string,
  userId: string
): Promise<{ identity?: IndividualIdentity; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const identityId = `${brandId}_${userId}`;
    const identityDoc = await adminDb
      .collection('individualIdentities')
      .doc(identityId)
      .get();

    if (!identityDoc.exists) {
      return { identity: undefined };
    }

    return { identity: identityDoc.data() as IndividualIdentity };
  } catch (e: any) {
    console.error('[getIndividualIdentityAction] Error:', e);
    return { error: e.message || 'Failed to fetch individual identity' };
  }
}

/**
 * Update Individual Identity
 * Only the identity owner or team managers can update
 */
export async function updateIndividualIdentityAction(
  brandId: string,
  userId: string,
  updates: Partial<Omit<IndividualIdentity, 'id' | 'brandId' | 'userId' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    
    // Check authorization: must be the owner OR a manager
    if (user.uid !== userId) {
      // Non-owner must be a manager to edit someone else's identity
      const { requireBrandRole } = await import('@/lib/brand-membership');
      await requireBrandRole(user.uid, brandId, 'MANAGER');
    } else {
      // Owner just needs brand access
      await requireBrandAccess(user.uid, brandId);
    }

    const { adminDb } = getAdminInstances();
    const identityId = `${brandId}_${userId}`;
    const identityRef = adminDb.collection('individualIdentities').doc(identityId);
    const identityDoc = await identityRef.get();

    const now = new Date().toISOString();

    if (!identityDoc.exists) {
      // Create new identity
      const newIdentity: IndividualIdentity = {
        id: identityId,
        brandId,
        userId,
        ...updates,
        createdAt: now,
        updatedAt: now,
      };
      await identityRef.set(newIdentity);
    } else {
      // Update existing identity
      await identityRef.update({
        ...updates,
        updatedAt: now,
      });
    }

    revalidatePath('/brand-profile/personal');
    return { success: true };
  } catch (e: any) {
    console.error('[updateIndividualIdentityAction] Error:', e);
    return { success: false, error: e.message || 'Failed to update individual identity' };
  }
}

/**
 * Add achievement to Individual Identity
 * Can be done by the owner or team managers
 */
export async function addAchievementAction(
  brandId: string,
  userId: string,
  achievement: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    
    // Check authorization: must be the owner OR a manager
    if (user.uid !== userId) {
      const { requireBrandRole } = await import('@/lib/brand-membership');
      await requireBrandRole(user.uid, brandId, 'MANAGER');
    } else {
      await requireBrandAccess(user.uid, brandId);
    }

    const { adminDb } = getAdminInstances();
    const identityId = `${brandId}_${userId}`;
    const identityRef = adminDb.collection('individualIdentities').doc(identityId);
    const identityDoc = await identityRef.get();

    const currentAchievements = identityDoc.exists 
      ? (identityDoc.data() as IndividualIdentity).achievements || []
      : [];

    await updateIndividualIdentityAction(brandId, userId, {
      achievements: [...currentAchievements, achievement],
    });

    return { success: true };
  } catch (e: any) {
    console.error('[addAchievementAction] Error:', e);
    return { success: false, error: e.message || 'Failed to add achievement' };
  }
}

/**
 * Add skill to Individual Identity
 * Can be done by the owner or team managers
 */
export async function addSkillAction(
  brandId: string,
  userId: string,
  skill: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    
    // Check authorization: must be the owner OR a manager
    if (user.uid !== userId) {
      const { requireBrandRole } = await import('@/lib/brand-membership');
      await requireBrandRole(user.uid, brandId, 'MANAGER');
    } else {
      await requireBrandAccess(user.uid, brandId);
    }

    const { adminDb } = getAdminInstances();
    const identityId = `${brandId}_${userId}`;
    const identityRef = adminDb.collection('individualIdentities').doc(identityId);
    const identityDoc = await identityRef.get();

    const currentSkills = identityDoc.exists 
      ? (identityDoc.data() as IndividualIdentity).skills || []
      : [];

    await updateIndividualIdentityAction(brandId, userId, {
      skills: [...currentSkills, skill],
    });

    return { success: true };
  } catch (e: any) {
    console.error('[addSkillAction] Error:', e);
    return { success: false, error: e.message || 'Failed to add skill' };
  }
}
