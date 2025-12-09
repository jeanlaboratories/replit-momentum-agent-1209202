'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess, getBrandMember } from '@/lib/brand-membership';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Comment, 
  CommentThread, 
  CommentContext, 
  CommentFlag, 
  CommentContextType,
  CommentStatus,
  FlagReason,
  FlagStatus,
  BrandRole
} from '@/lib/types';
import { revalidatePath } from 'next/cache';

// Collection names - using const assertion for proper typing
const COMMENT_COLLECTIONS = {
  COMMENTS: 'comments',
  COMMENT_CONTEXTS: 'commentContexts', 
  COMMENT_FLAGS: 'commentFlags',
  COMMENT_NOTIFICATIONS: 'commentNotifications'
} as const;

// Helper function to generate comment ID
function generateCommentId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 11);
}

// Helper function to generate context ID
function generateContextId(brandId: string, contextType: CommentContextType, contextId: string): string {
  // For images and videos, we want unified comments across all brands/profiles
  if (contextType === 'image' || contextType === 'video') {
    return `${contextType}_${contextId}`;
  }
  return `${brandId}_${contextType}_${contextId}`;
}

// Create a new comment
export async function createComment(
  brandId: string,
  contextType: CommentContextType,
  contextId: string,
  body: string,
  parentId?: string
): Promise<{ success: boolean; comment?: Comment; message: string }> {
  try {
    const user = await getAuthenticatedUser(true); // Get full profile including displayName and photoURL
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const now = new Date().toISOString();
    const commentId = generateCommentId();
    const contextDocId = generateContextId(brandId, contextType, contextId);

    // Create comment
    const comment: Comment = {
      id: commentId,
      brandId,
      contextType,
      contextId,
      parentId: parentId || null, // Explicitly set to null for top-level comments
      body: body.trim(),
      createdBy: user.uid,
      createdByName: user.displayName || user.email,
      ...(user.photoURL && { createdByPhoto: user.photoURL }), // Only include photo if it exists
      createdAt: now,
      status: 'active',
      replyCount: 0,
      flagCount: 0
    };

    // Use batch operation to update comment and context atomically
    const batch = adminDb.batch();

    // Add comment
    const commentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(commentId);
    batch.set(commentRef, comment);

    // Update or create context document
    const contextRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_CONTEXTS).doc(contextDocId);
    const contextDoc = await contextRef.get();
    
    if (contextDoc.exists) {
      const currentContext = contextDoc.data() as CommentContext;
      batch.update(contextRef, {
        totalComments: currentContext.totalComments + 1,
        activeComments: currentContext.activeComments + 1,
        lastCommentAt: now,
        lastCommentBy: user.uid
      });
    } else {
      const newContext: CommentContext = {
        id: contextDocId,
        brandId,
        contextType,
        contextId,
        totalComments: 1,
        activeComments: 1,
        resolvedComments: 0,
        flaggedComments: 0,
        lastCommentAt: now,
        lastCommentBy: user.uid
      };
      batch.set(contextRef, newContext);
    }

    // If this is a reply, update parent comment's reply count
    if (parentId) {
      const parentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(parentId);
      batch.update(parentRef, {
        replyCount: FieldValue.increment(1)
      });
    }

    await batch.commit();

    return { success: true, comment, message: 'Comment created successfully' };
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return { success: false, message: error.message || 'Failed to create comment' };
  }
}

// Get comments for a specific context
export async function getComments(
  brandId: string,
  contextType: CommentContextType,
  contextId: string,
  limit: number = 20,
  startAfter?: string
): Promise<{ success: boolean; comments?: CommentThread[]; hasMore?: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Build query for top-level comments (no parentId) with proper ordering
    let query = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS)
      .where('contextType', '==', contextType)
      .where('contextId', '==', contextId)
      .where('parentId', '==', null)
      .where('status', 'in', ['active', 'edited'])
      .orderBy('createdAt', 'desc')
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (startAfter) {
      const startAfterDoc = await adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, -1) : snapshot.docs;

    // Get top-level comments (already filtered and ordered by query)
    const threads: CommentThread[] = docs.map((doc: any) => ({
      ...doc.data() as Comment,
      replies: [] as Comment[]
    }));

    // Fetch replies for each thread (limited to prevent performance issues)
    // Robust fetching strategy to ensure we get active replies even with many deleted ones
    for (const thread of threads) {
      if (thread.replyCount > 0) {
        let validReplies: Comment[] = [];
        let lastDoc: any = null;
        const targetReplies = 5;
        const batchSize = 20; // Consistent batch size
        let totalFetched = 0;
        
        // Fetch all replies at once to avoid composite index issues and ensure we get active ones
        // This is not ideal for performance but ensures correctness until composite indexes are available
        const repliesSnapshot = await adminDb.collection(COMMENT_COLLECTIONS.COMMENTS)
          .where('parentId', '==', thread.id)
          .get();
        
        if (!repliesSnapshot.empty) {
          // Filter by status and sort in memory to avoid composite index requirement
          const allReplies = repliesSnapshot.docs
            .map((doc: any) => doc.data() as Comment)
            .filter((reply: Comment) => reply.status === 'active' || reply.status === 'edited')
            .sort((a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          
          validReplies = allReplies.slice(0, targetReplies);
          totalFetched = repliesSnapshot.docs.length;
        }

        thread.replies = validReplies;
        // More accurate hasMore calculation based on what we actually found
        const remainingReplies = thread.replyCount - validReplies.length;
        thread.hasMoreReplies = remainingReplies > 0 && totalFetched < 1000;
      }
    }

    return { 
      success: true, 
      comments: threads, 
      hasMore,
      message: 'Comments retrieved successfully' 
    };
  } catch (error: any) {
    console.error('Error getting comments:', error);
    return { success: false, message: error.message || 'Failed to get comments' };
  }
}

// Get replies for a specific comment
export async function getReplies(
  brandId: string,
  parentCommentId: string,
  limit: number = 10,
  startAfter?: string
): Promise<{ success: boolean; replies?: Comment[]; hasMore?: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Robust pagination strategy to ensure we get active replies
    let allReplies: Comment[] = [];
    let lastDoc: any = null;
    const batchSize = 20; // Consistent batch size
    let totalFetched = 0;
    
    if (startAfter) {
      const startAfterDoc = await adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(startAfter).get();
      if (startAfterDoc.exists) {
        lastDoc = startAfterDoc;
      }
    }
    
    // Simplified approach to avoid composite index requirement
    // Fetch all replies for the parent and filter/sort in memory
    const snapshot = await adminDb.collection(COMMENT_COLLECTIONS.COMMENTS)
      .where('parentId', '==', parentCommentId)
      .get();
    
    if (snapshot.empty) {
      allReplies = [];
    } else {
      // Filter by status and sort in memory to avoid composite index requirement
      const allDocs = snapshot.docs
        .map((doc: any) => doc.data() as Comment)
        .filter((reply: Comment) => reply.status === 'active' || reply.status === 'edited')
        .sort((a: Comment, b: Comment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      // Handle pagination by skipping to startAfter if provided
      let startIndex = 0;
      if (startAfter) {
        startIndex = allDocs.findIndex((reply: Comment) => reply.id === startAfter) + 1;
      }
      
      allReplies = allDocs.slice(startIndex);
    }
    
    // Check if there are more replies beyond the current page
    let hasMoreActive = allReplies.length > limit;
    
    const hasMore = hasMoreActive;
    const replies: Comment[] = allReplies.slice(0, limit);

    return { 
      success: true, 
      replies, 
      hasMore,
      message: 'Replies retrieved successfully' 
    };
  } catch (error: any) {
    console.error('Error getting replies:', error);
    return { success: false, message: error.message || 'Failed to get replies' };
  }
}

// Update a comment
export async function updateComment(
  commentId: string,
  newBody: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const { adminDb } = getAdminInstances();

    // Get the comment first
    const commentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return { success: false, message: 'Comment not found' };
    }

    const comment = commentDoc.data() as Comment;

    // Verify brand access
    await requireBrandAccess(user.uid, comment.brandId);

    // Check if user can edit (must be creator or manager)
    const brandMember = await getBrandMember(comment.brandId, user.uid);
    const canEdit = comment.createdBy === user.uid || brandMember?.role === 'MANAGER';

    if (!canEdit) {
      return { success: false, message: 'Not authorized to edit this comment' };
    }

    // Check if comment is editable (within 15 minutes or if user is manager)
    const createdAt = new Date(comment.createdAt);
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    const isWithinEditWindow = createdAt > fifteenMinutesAgo;
    const isManager = brandMember?.role === 'MANAGER';

    if (!isWithinEditWindow && !isManager) {
      return { success: false, message: 'Comment can no longer be edited (15 minute limit exceeded)' };
    }

    const editedAt = new Date().toISOString();

    // Save revision if this is the first edit
    const updateData: any = {
      body: newBody.trim(),
      editedAt,
      status: 'edited'
    };

    if (!comment.revisionHistory) {
      updateData.revisionHistory = [{
        body: comment.body,
        editedAt: comment.createdAt,
        editedBy: comment.createdBy
      }];
    }

    await commentRef.update(updateData);

    return { success: true, message: 'Comment updated successfully' };
  } catch (error: any) {
    console.error('Error updating comment:', error);
    return { success: false, message: error.message || 'Failed to update comment' };
  }
}

// Delete a comment (soft delete)
export async function deleteComment(
  commentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const { adminDb } = getAdminInstances();

    // Get the comment first
    const commentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return { success: false, message: 'Comment not found' };
    }

    const comment = commentDoc.data() as Comment;

    // Verify brand access
    await requireBrandAccess(user.uid, comment.brandId);

    // Check if user can delete (must be creator or manager)
    const brandMember = await getBrandMember(comment.brandId, user.uid);
    const canDelete = comment.createdBy === user.uid || brandMember?.role === 'MANAGER';

    if (!canDelete) {
      return { success: false, message: 'Not authorized to delete this comment' };
    }

    // Soft delete
    await commentRef.update({
      status: 'deleted',
      body: '[deleted]'
    });

    // Update context counters
    const contextDocId = generateContextId(comment.brandId, comment.contextType, comment.contextId);
    const contextRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_CONTEXTS).doc(contextDocId);
    
    await contextRef.update({
      activeComments: FieldValue.increment(-1)
    });

    return { success: true, message: 'Comment deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return { success: false, message: error.message || 'Failed to delete comment' };
  }
}

// Flag a comment
export async function flagComment(
  commentId: string,
  reason: FlagReason,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const { adminDb } = getAdminInstances();

    // Get the comment first
    const commentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return { success: false, message: 'Comment not found' };
    }

    const comment = commentDoc.data() as Comment;

    // Verify brand access
    await requireBrandAccess(user.uid, comment.brandId);

    // Check if user already flagged this comment
    const existingFlagSnapshot = await adminDb.collection(COMMENT_COLLECTIONS.COMMENT_FLAGS)
      .where('commentId', '==', commentId)
      .where('flaggedBy', '==', user.uid)
      .where('status', '==', 'open')
      .get();

    if (!existingFlagSnapshot.empty) {
      return { success: false, message: 'You have already flagged this comment' };
    }

    const flagId = generateCommentId();
    const now = new Date().toISOString();

    const flag: CommentFlag = {
      id: flagId,
      brandId: comment.brandId,
      commentId,
      reason,
      notes,
      flaggedBy: user.uid,
      flaggedByName: user.displayName || user.email,
      createdAt: now,
      status: 'open'
    };

    // Use batch to create flag and update comment
    const batch = adminDb.batch();

    // Create flag
    const flagRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_FLAGS).doc(flagId);
    batch.set(flagRef, flag);

    // Update comment flag count and status
    batch.update(commentRef, {
      flagCount: FieldValue.increment(1),
      status: 'flagged'
    });

    // Update context flagged count
    const contextDocId = generateContextId(comment.brandId, comment.contextType, comment.contextId);
    const contextRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_CONTEXTS).doc(contextDocId);
    batch.update(contextRef, {
      flaggedComments: FieldValue.increment(1)
    });

    await batch.commit();

    return { success: true, message: 'Comment flagged successfully' };
  } catch (error: any) {
    console.error('Error flagging comment:', error);
    return { success: false, message: error.message || 'Failed to flag comment' };
  }
}

// Get flags for moderation (managers only)
export async function getFlags(
  brandId: string,
  status?: FlagStatus,
  limit: number = 20
): Promise<{ success: boolean; flags?: CommentFlag[]; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access and manager role
    await requireBrandAccess(user.uid, brandId);
    const brandMember = await getBrandMember(brandId, user.uid);
    
    if (brandMember?.role !== 'MANAGER') {
      return { success: false, message: 'Only managers can view flags' };
    }

    const { adminDb } = getAdminInstances();

    let query = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_FLAGS)
      .where('brandId', '==', brandId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const flags: CommentFlag[] = snapshot.docs.map((doc: any) => doc.data() as CommentFlag);

    return { 
      success: true, 
      flags,
      message: 'Flags retrieved successfully' 
    };
  } catch (error: any) {
    console.error('Error getting flags:', error);
    return { success: false, message: error.message || 'Failed to get flags' };
  }
}

// Resolve a flag (managers only)
export async function resolveFlag(
  flagId: string,
  resolution: 'resolved' | 'dismissed',
  resolutionNotes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const { adminDb } = getAdminInstances();

    // Get the flag first
    const flagRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_FLAGS).doc(flagId);
    const flagDoc = await flagRef.get();

    if (!flagDoc.exists) {
      return { success: false, message: 'Flag not found' };
    }

    const flag = flagDoc.data() as CommentFlag;

    // Verify brand access and manager role
    await requireBrandAccess(user.uid, flag.brandId);
    const brandMember = await getBrandMember(flag.brandId, user.uid);
    
    if (brandMember?.role !== 'MANAGER') {
      return { success: false, message: 'Only managers can resolve flags' };
    }

    const now = new Date().toISOString();

    // Update flag
    await flagRef.update({
      status: resolution,
      reviewedBy: user.uid,
      reviewedByName: user.displayName || user.email,
      reviewedAt: now,
      resolutionNotes
    });

    // If resolving (not dismissing), update comment status
    if (resolution === 'resolved') {
      const commentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(flag.commentId);
      await commentRef.update({
        status: 'hidden'
      });
    }

    return { success: true, message: `Flag ${resolution} successfully` };
  } catch (error: any) {
    console.error('Error resolving flag:', error);
    return { success: false, message: error.message || 'Failed to resolve flag' };
  }
}

// Get comment context info
export async function getCommentContext(
  brandId: string,
  contextType: CommentContextType,
  contextId: string
): Promise<{ success: boolean; context?: CommentContext; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const contextDocId = generateContextId(brandId, contextType, contextId);
    
    const contextRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_CONTEXTS).doc(contextDocId);
    const contextDoc = await contextRef.get();

    if (!contextDoc.exists) {
      // Return empty context if it doesn't exist yet
      const emptyContext: CommentContext = {
        id: contextDocId,
        brandId,
        contextType,
        contextId,
        totalComments: 0,
        activeComments: 0,
        resolvedComments: 0,
        flaggedComments: 0
      };
      return { success: true, context: emptyContext, message: 'Context retrieved successfully' };
    }

    const context = contextDoc.data() as CommentContext;
    return { success: true, context, message: 'Context retrieved successfully' };
  } catch (error: any) {
    console.error('Error getting comment context:', error);
    return { success: false, message: error.message || 'Failed to get comment context' };
  }
}

// Export all comments for a campaign (for backup during save)
export async function exportCampaignComments(
  brandId: string,
  campaignId: string
): Promise<{ success: boolean; comments?: Comment[]; context?: CommentContext; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const contextType: CommentContextType = 'campaign';
    const contextDocId = generateContextId(brandId, contextType, campaignId);

    // Get all comments for this campaign
    const commentsSnapshot = await adminDb.collection(COMMENT_COLLECTIONS.COMMENTS)
      .where('brandId', '==', brandId)
      .where('contextType', '==', contextType)
      .where('contextId', '==', campaignId)
      .get();

    // Sort comments by createdAt in memory to avoid requiring a composite index
    const comments: Comment[] = commentsSnapshot.docs
      .map((doc: any) => doc.data() as Comment)
      .sort((a: Comment, b: Comment) => {
        // Convert ISO 8601 strings to timestamps for comparison
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime; // Sort descending (newest first)
      });

    // Get the context document
    const contextRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_CONTEXTS).doc(contextDocId);
    const contextDoc = await contextRef.get();
    const context = contextDoc.exists ? contextDoc.data() as CommentContext : undefined;

    return { 
      success: true, 
      comments,
      context,
      message: `Exported ${comments.length} comments for campaign ${campaignId}` 
    };
  } catch (error: any) {
    console.error('Error exporting campaign comments:', error);
    return { success: false, message: error.message || 'Failed to export campaign comments' };
  }
}

// Import comments with a new campaign context ID (for restore during load)
export async function importCampaignComments(
  brandId: string,
  oldCampaignId: string,
  newCampaignId: string,
  comments: Comment[],
  context?: CommentContext
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    // Verify brand access
    await requireBrandAccess(user.uid, brandId);

    if (!comments || comments.length === 0) {
      return { success: true, message: 'No comments to import' };
    }

    // If old and new campaign IDs are the same, skip import to avoid duplication
    if (oldCampaignId === newCampaignId) {
      return { success: true, message: `Comments already associated with campaign ${newCampaignId}, no import needed` };
    }

    const { adminDb } = getAdminInstances();
    const contextType: CommentContextType = 'campaign';
    const batch = adminDb.batch();

    // Create new context document with new campaign ID
    if (context) {
      const newContextDocId = generateContextId(brandId, contextType, newCampaignId);
      const newContextRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENT_CONTEXTS).doc(newContextDocId);
      
      const newContext: CommentContext = {
        ...context,
        id: newContextDocId,
        contextId: newCampaignId
      };
      
      batch.set(newContextRef, newContext);
    }

    // Import all comments with new contextId
    for (const comment of comments) {
      const newCommentId = generateCommentId();
      const newCommentRef = adminDb.collection(COMMENT_COLLECTIONS.COMMENTS).doc(newCommentId);
      
      const newComment: Comment = {
        ...comment,
        id: newCommentId,
        contextId: newCampaignId
      };
      
      batch.set(newCommentRef, newComment);
    }

    await batch.commit();

    return { 
      success: true, 
      message: `Imported ${comments.length} comments to campaign ${newCampaignId}` 
    };
  } catch (error: any) {
    console.error('Error importing campaign comments:', error);
    return { success: false, message: error.message || 'Failed to import campaign comments' };
  }
}