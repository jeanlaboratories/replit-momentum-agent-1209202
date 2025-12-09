'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess, getBrandMember } from '@/lib/brand-membership';
import { revalidatePath } from 'next/cache';

export interface ShareContentToProfileInput {
  brandId: string;
  targetType: 'team' | 'personal';
  text: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  sourceContentBlockId?: string;
  isPublished?: boolean; // Optional: defaults to false (PRIVATE). Set to true to share publicly.
  campaignId?: string; // Campaign ID for linking back to the source campaign
  campaignDate?: string; // Campaign day date (ISO string) for opening the correct day in calendar view
}

export interface ShareContentResult {
  success: boolean;
  sharedContentId?: string;
  error?: string;
}

/**
 * Share content to either the Team Profile (brand) or Personal Profile (user).
 *
 * - Team Profile: Only managers can share to the team profile. Content is added
 *   to the top-level images collection with brandId set, so it appears alongside
 *   other brand images.
 * - Personal Profile: Any team member can share to their personal profile.
 *   Content is added to the top-level images collection with isPersonal=true and
 *   uploadedBy set, so it appears on the user's personal profile.
 *
 * This function also copies engagement data (loves and comments) from the source
 * content block to the new shared content so engagement is preserved.
 */
export async function shareContentToProfileAction(
  input: ShareContentToProfileInput
): Promise<ShareContentResult> {
  try {
    const user = await getAuthenticatedUser();
    const { brandId, targetType, text, mediaUrl, mediaType, sourceContentBlockId, isPublished: inputIsPublished, campaignId, campaignDate } = input;

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    // Get user's membership to check role
    const membership = await getBrandMember(brandId, user.uid);
    if (!membership) {
      return { success: false, error: 'You are not a member of this team.' };
    }

    // Check permissions for team sharing
    if (targetType === 'team' && membership.role !== 'MANAGER') {
      return { success: false, error: 'Only team managers can share to the Team Profile.' };
    }

    const { adminDb } = getAdminInstances();
    const now = new Date().toISOString();
    const sharedContentId = `shared_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Save to the top-level 'images' collection so getImagesAction can find it
    const sharedImageDoc = {
      id: sharedContentId,
      title: text.substring(0, 100) || 'Shared Content',
      description: text,
      sourceImageUrl: mediaUrl,
      generatedImageUrl: mediaUrl,
      prompt: '',
      mediaType: mediaType,
      brandId: brandId,
      createdAt: now,
      updatedAt: now,
      generatedAt: now,
      generatedBy: user.uid,
      uploadedBy: user.uid,
      sourceType: 'shared',
      sourceContentBlockId: sourceContentBlockId || null,
      sharedAt: now,
      sharedBy: user.uid,
      sharedByName: user.displayName || user.email || 'Unknown',
      isPublished: inputIsPublished === true, // Default to PRIVATE - must explicitly pass true to be public
      isPersonal: targetType === 'personal',
      targetType: targetType,
      // Campaign linking - allows "View Campaign" button on profile pages
      sourceCampaignId: campaignId || null,
      sourceCampaignDate: campaignDate || null,
    };

    await adminDb
      .collection('images')
      .doc(sharedContentId)
      .set(sharedImageDoc);

    // Copy engagement data from source content block if it exists
    if (sourceContentBlockId) {
      await copyEngagementData(adminDb, brandId, sourceContentBlockId, sharedContentId, mediaType);
    }

    if (targetType === 'team') {
      revalidatePath('/brand-profile');
    } else {
      revalidatePath('/brand-profile/personal');
    }

    return { success: true, sharedContentId };
  } catch (e: any) {
    console.error('Failed to share content to profile:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

/**
 * Helper function to copy engagement data (loves, comments) from source to target asset.
 * This preserves the engagement when content is shared to profiles.
 *
 * @param targetMediaType - The media type of the target asset ('image' or 'video').
 *                          This is used to set the contextType on copied comments so they
 *                          can be queried correctly on the profile pages where the
 *                          CommentPanel uses the asset type as the contextType.
 */
async function copyEngagementData(
  adminDb: FirebaseFirestore.Firestore,
  brandId: string,
  sourceAssetId: string,
  targetAssetId: string,
  targetMediaType: 'image' | 'video'
): Promise<void> {
  try {
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    // 1. Copy love stats from source to target
    const sourceStatsRef = adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_stats')
      .doc(sourceAssetId);

    const sourceStatsDoc = await sourceStatsRef.get();
    if (sourceStatsDoc.exists) {
      const statsData = sourceStatsDoc.data();
      const targetStatsRef = adminDb
        .collection('brands')
        .doc(brandId)
        .collection('asset_stats')
        .doc(targetAssetId);

      batch.set(targetStatsRef, {
        loveCount: statsData?.loveCount || 0,
        copiedFrom: sourceAssetId,
        copiedAt: now,
      });
    }

    // 2. Copy individual love interactions
    const sourceInteractionsSnapshot = await adminDb
      .collection('brands')
      .doc(brandId)
      .collection('asset_interactions')
      .where('assetId', '==', sourceAssetId)
      .where('type', '==', 'love')
      .get();

    sourceInteractionsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const newInteractionId = `${targetAssetId}_likes_${data.userId}`;
      const newInteractionRef = adminDb
        .collection('brands')
        .doc(brandId)
        .collection('asset_interactions')
        .doc(newInteractionId);

      batch.set(newInteractionRef, {
        assetId: targetAssetId,
        userId: data.userId,
        type: 'love',
        createdAt: data.createdAt,
        copiedFrom: sourceAssetId,
      });
    });

    // 3. Copy comments from the top-level 'comments' collection
    // Comments are stored with contextId field, not in subcollections
    const sourceCommentsSnapshot = await adminDb
      .collection('comments')
      .where('contextId', '==', sourceAssetId)
      .get();

    if (!sourceCommentsSnapshot.empty) {
      let totalComments = 0;
      let activeComments = 0;

      // Build a map of old comment IDs to new comment IDs for reply linking
      const commentIdMap: Record<string, string> = {};

      // First pass: generate new IDs for all comments
      sourceCommentsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const newCommentId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        commentIdMap[doc.id] = newCommentId;
      });

      // Second pass: copy comments with updated contextId, contextType, and parentId references
      sourceCommentsSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const commentData = doc.data();
        const newCommentId = commentIdMap[doc.id];
        const newCommentRef = adminDb.collection('comments').doc(newCommentId);

        // Map the parentId to the new comment ID if this is a reply
        let newParentId = commentData.parentId;
        if (newParentId && commentIdMap[newParentId]) {
          newParentId = commentIdMap[newParentId];
        }

        batch.set(newCommentRef, {
          ...commentData,
          id: newCommentId,
          contextId: targetAssetId,
          contextType: targetMediaType, // Use target media type so comments load on profile pages
          parentId: newParentId,
          copiedFrom: doc.id,
          copiedAt: now,
        });

        totalComments++;
        if (commentData.status === 'active' || commentData.status === 'edited') {
          activeComments++;
        }
      });

      // 4. Create/update comment context for the target asset
      // Use the same ID format as comment-management.ts: generateContextId
      // Use targetMediaType for contextType so it matches what the profile page queries
      const newContextDocId = `${brandId}_${targetMediaType}_${targetAssetId}`;
      const newContextRef = adminDb.collection('commentContexts').doc(newContextDocId);

      batch.set(newContextRef, {
        id: newContextDocId,
        brandId: brandId,
        contextId: targetAssetId,
        contextType: targetMediaType,
        activeComments: activeComments,
        totalComments: totalComments,
        resolvedComments: 0,
        flaggedComments: 0,
        lastCommentAt: now,
        copiedFrom: sourceAssetId,
        copiedAt: now,
      });
    }

    await batch.commit();
  } catch (error) {
    // Log error but don't fail the share operation
    console.error('Failed to copy engagement data:', error);
  }
}

/**
 * Toggle visibility (public/private) of a shared content item.
 * Only the author of the content can toggle visibility.
 * Public content is visible to all team members; private content is only visible to the author.
 */
export async function toggleVisibilityAction(
  contentId: string,
  brandId: string
): Promise<{ success: boolean; isPublished?: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const now = new Date().toISOString();

    // Get the content document
    const contentRef = adminDb.collection('images').doc(contentId);
    const contentDoc = await contentRef.get();

    if (!contentDoc.exists) {
      return { success: false, error: 'Content not found.' };
    }

    const data = contentDoc.data();

    // Verify user is the author
    const isAuthor = data?.uploadedBy === user.uid || data?.sharedBy === user.uid || data?.generatedBy === user.uid;
    if (!isAuthor) {
      return { success: false, error: 'You can only change visibility of content you created.' };
    }

    // Toggle visibility
    const currentIsPublished = data?.isPublished !== false; // Default to true if not set
    const newIsPublished = !currentIsPublished;

    await contentRef.update({
      isPublished: newIsPublished,
      updatedAt: now,
    });

    // Also update unifiedMedia if it exists
    const unifiedMediaRef = adminDb.collection('unifiedMedia').doc(contentId);
    const unifiedDoc = await unifiedMediaRef.get();
    if (unifiedDoc.exists) {
      await unifiedMediaRef.update({
        isPublished: newIsPublished,
        updatedAt: now,
      });
    }

    revalidatePath('/brand-profile');
    revalidatePath('/brand-profile/personal');

    return { success: true, isPublished: newIsPublished };
  } catch (e: any) {
    console.error('Failed to toggle visibility:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

/**
 * Get shared content for a user's personal profile from the images collection
 */
export async function getPersonalSharedContentAction(
  brandId: string,
  limit = 50
): Promise<{ success: boolean; content?: any[]; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Query from images collection for personal shared content
    const snapshot = await adminDb
      .collection('images')
      .where('brandId', '==', brandId)
      .where('isPersonal', '==', true)
      .where('uploadedBy', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const content = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        sharedAt: data.sharedAt?.toDate ? data.sharedAt.toDate().toISOString() : data.sharedAt,
      };
    });

    return { success: true, content };
  } catch (e: any) {
    console.error('Failed to get personal shared content:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}

/**
 * Get another user's shared content for their personal profile.
 * Only returns public content (isPublished=true) since the viewer is not the owner.
 * This is used when viewing a teammate's profile.
 */
export async function getTeamMemberSharedContentAction(
  targetUserId: string,
  brandId: string,
  limit = 50
): Promise<{ success: boolean; content?: any[]; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Query from images collection for the target user's personal shared content
    // Only return public content (isPublished=true)
    const snapshot = await adminDb
      .collection('images')
      .where('brandId', '==', brandId)
      .where('isPersonal', '==', true)
      .where('uploadedBy', '==', targetUserId)
      .where('isPublished', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const content = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        sharedAt: data.sharedAt?.toDate ? data.sharedAt.toDate().toISOString() : data.sharedAt,
      };
    });

    return { success: true, content };
  } catch (e: any) {
    console.error('Failed to get team member shared content:', e);
    return { success: false, error: e.message || 'An unknown error occurred.' };
  }
}
