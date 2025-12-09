'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  Comment,
  CommentThread,
  CommentContext,
  CommentContextType,
  CommentUIState,
  FlagReason
} from '@/lib/types';
import { 
  CommentService, 
  type CommentServiceResult,
  type PaginationCursor,
  formatErrorMessage 
} from '@/services/commentService';

// Helper to handle service result errors properly
function handleServiceError<T>(result: CommentServiceResult<T>): string {
  if (result.success) {
    return '';
  }
  // Type assertion to handle the discriminated union properly
  const errorResult = result as { success: false; error: string; code?: string };
  return formatErrorMessage(errorResult.error, errorResult.code);
}

interface UseCommentsOptions {
  enabled?: boolean;
  pageSize?: number;
}

interface CommentActionResult {
  success: boolean;
  message: string;
}

/**
 * Hook for managing comments in a specific context
 * Provides data fetching, mutations, and UI state management
 */
export function useComments(
  brandId: string,
  contextType: CommentContextType,
  contextId: string,
  options: UseCommentsOptions = {}
) {
  const { enabled = true, pageSize = 20 } = options;
  const { user } = useAuth();
  
  // Data state
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [context, setContext] = useState<CommentContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<PaginationCursor>(undefined);
  
  // UI State
  const [uiState, setUIState] = useState<CommentUIState>({
    showComments: false,
    filter: 'all'
  });

  // Check if hook should be active
  const isActive = enabled && !!user && !!brandId?.trim() && !!contextId?.trim();

  /**
   * Load comments with optional pagination
   */
  const loadComments = useCallback(async (reset = false) => {
    if (!isActive) return;

    setLoading(true);
    setError(null);

    try {
      const cursor = reset ? undefined : nextCursor;
      const result = await CommentService.getComments(brandId, contextType, contextId, {
        pageSize,
        cursor
      });
      
      if (result.success && result.data) {
        if (reset) {
          setComments(result.data.comments);
        } else {
          setComments(prev => [...prev, ...result.data.comments]);
        }
        
        setHasMore(result.data.hasMore);
        setNextCursor(result.data.nextCursor);
      } else {
        setError(handleServiceError(result));
      }
    } catch (err) {
      setError('Failed to load comments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isActive, brandId, contextType, contextId, pageSize, nextCursor]);

  /**
   * Load comment context
   */
  const loadContext = useCallback(async () => {
    if (!isActive) return;

    try {
      const result = await CommentService.getContext(brandId, contextType, contextId);
      
      if (result.success && result.data) {
        setContext(result.data);
      } else {
        console.warn('Failed to load comment context:', handleServiceError(result));
      }
    } catch (err) {
      console.warn('Failed to load comment context:', err);
    }
  }, [isActive, brandId, contextType, contextId]);

  /**
   * Load initial data when dependencies change
   */
  useEffect(() => {
    if (!isActive) {
      setComments([]);
      setContext(null);
      setError(null);
      setHasMore(false);
      setNextCursor(undefined);
      return;
    }

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load comments and context in parallel
        const [commentsResult, contextResult] = await Promise.all([
          CommentService.getComments(brandId, contextType, contextId, { pageSize }),
          CommentService.getContext(brandId, contextType, contextId)
        ]);

        // Handle comments result
        if (commentsResult.success && commentsResult.data) {
          setComments(commentsResult.data.comments);
          setHasMore(commentsResult.data.hasMore);
          setNextCursor(commentsResult.data.nextCursor);
        } else {
          setError(handleServiceError(commentsResult));
        }

        // Handle context result
        if (contextResult.success && contextResult.data) {
          setContext(contextResult.data);
        }
      } catch (err) {
        setError('Failed to load comments. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [isActive, brandId, contextType, contextId, pageSize]);

  /**
   * Add a new comment or reply
   */
  const addComment = useCallback(async (body: string, parentId?: string): Promise<CommentActionResult> => {
    if (!isActive) {
      return { success: false, message: 'Not authenticated' };
    }

    setLoading(true);
    try {
      const result = await CommentService.createComment(brandId, contextType, contextId, body, parentId);
      
      if (result.success && result.data) {
        const newComment = result.data;
        
        if (parentId) {
          // Add reply to specific thread
          setComments(prev => prev.map(comment => {
            if (comment.id === parentId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), newComment],
                replyCount: comment.replyCount + 1
              };
            }
            return comment;
          }));
        } else {
          // Add as new top-level comment
          const newThread: CommentThread = { ...newComment, replies: [] };
          setComments(prev => [newThread, ...prev]);
        }
        
        // Refresh context to update counters
        await loadContext();
        
        return { success: true, message: 'Comment added successfully' };
      } else {
        const errorMessage = handleServiceError(result);
        return { success: false, message: errorMessage };
      }
    } catch (err) {
      return { success: false, message: 'Failed to add comment. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [isActive, brandId, contextType, contextId, loadContext]);

  /**
   * Edit an existing comment
   */
  const editComment = useCallback(async (commentId: string, newBody: string): Promise<CommentActionResult> => {
    if (!isActive) {
      return { success: false, message: 'Not authenticated' };
    }

    setLoading(true);
    try {
      const result = await CommentService.updateComment(commentId, newBody);
      
      if (result.success) {
        // Update local state optimistically
        setComments(prev => prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, body: newBody, status: 'edited' as const }
            : {
                ...comment,
                replies: comment.replies?.map(reply =>
                  reply.id === commentId
                    ? { ...reply, body: newBody, status: 'edited' as const }
                    : reply
                ) || []
              }
        ));
        
        return { success: true, message: 'Comment updated successfully' };
      } else {
        const errorMessage = handleServiceError(result);
        return { success: false, message: errorMessage };
      }
    } catch (err) {
      return { success: false, message: 'Failed to update comment. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [isActive]);

  /**
   * Delete a comment
   */
  const removeComment = useCallback(async (commentId: string): Promise<CommentActionResult> => {
    if (!isActive) {
      return { success: false, message: 'Not authenticated' };
    }

    setLoading(true);
    try {
      const result = await CommentService.deleteComment(commentId);
      
      if (result.success) {
        // Remove from local state optimistically
        setComments(prev => prev.filter(comment => {
          if (comment.id === commentId) {
            return false; // Remove top-level comment
          }
          // Filter out deleted replies
          comment.replies = comment.replies?.filter(reply => reply.id !== commentId) || [];
          return true;
        }));
        
        // Refresh context to update counters
        await loadContext();
        
        return { success: true, message: 'Comment deleted successfully' };
      } else {
        const errorMessage = handleServiceError(result);
        return { success: false, message: errorMessage };
      }
    } catch (err) {
      return { success: false, message: 'Failed to delete comment. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [isActive, loadContext]);

  /**
   * Flag a comment
   */
  const flagCommentAction = useCallback(async (
    commentId: string, 
    reason: string, 
    notes?: string
  ): Promise<CommentActionResult> => {
    if (!isActive) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const result = await CommentService.flagComment(commentId, reason as FlagReason, notes);
      
      if (result.success) {
        return { success: true, message: 'Comment flagged successfully' };
      } else {
        const errorMessage = handleServiceError(result);
        return { success: false, message: errorMessage };
      }
    } catch (err) {
      return { success: false, message: 'Failed to flag comment. Please try again.' };
    }
  }, [isActive]);

  /**
   * Load more replies for a specific comment thread
   */
  const loadMoreReplies = useCallback(async (parentCommentId: string) => {
    if (!isActive) return;

    try {
      const parent = comments.find(c => c.id === parentCommentId);
      if (!parent) return;

      const lastReply = parent.replies?.[parent.replies.length - 1];
      const result = await CommentService.getReplies(brandId, parentCommentId, {
        pageSize: 5,
        cursor: lastReply?.id
      });
      
      if (result.success && result.data) {
        setComments(prev => prev.map(comment => 
          comment.id === parentCommentId
            ? {
                ...comment,
                replies: [...(comment.replies || []), ...result.data.replies],
                hasMoreReplies: result.data.hasMore
              }
            : comment
        ));
      }
    } catch (err) {
      console.error('Failed to load more replies:', err);
    }
  }, [isActive, brandId, comments]);

  /**
   * Load more comments (pagination)
   */
  const loadMoreComments = useCallback(async () => {
    if (!hasMore || loading) return;
    await loadComments(false);
  }, [hasMore, loading, loadComments]);

  // UI state helpers
  const toggleComments = useCallback(() => {
    setUIState(prev => ({ ...prev, showComments: !prev.showComments }));
  }, []);

  const setFilter = useCallback((filter: CommentUIState['filter']) => {
    setUIState(prev => ({ ...prev, filter }));
  }, []);

  const setReplyingTo = useCallback((commentId?: string) => {
    setUIState(prev => ({ ...prev, replyingTo: commentId }));
  }, []);

  const setEditingComment = useCallback((commentId?: string) => {
    setUIState(prev => ({ ...prev, editingComment: commentId }));
  }, []);

  const setFlaggingComment = useCallback((commentId?: string) => {
    setUIState(prev => ({ ...prev, flaggingComment: commentId }));
  }, []);

  /**
   * Filter comments based on UI state
   */
  const filteredComments = comments.filter(comment => {
    switch (uiState.filter) {
      case 'resolved':
        return comment.status === 'resolved';
      case 'flagged':
        return comment.status === 'flagged';
      case 'open':
        return comment.status === 'active' || comment.status === 'edited';
      default:
        return comment.status !== 'deleted';
    }
  });

  return {
    // Data
    comments: filteredComments,
    context,
    loading,
    error,
    hasMore,
    
    // UI State
    uiState,
    
    // Actions
    addComment,
    editComment,
    removeComment,
    flagComment: flagCommentAction,
    loadMoreComments,
    loadMoreReplies,
    
    // UI Actions
    toggleComments,
    setFilter,
    setReplyingTo,
    setEditingComment,
    setFlaggingComment,
    
    // Utils
    refresh: () => loadComments(true)
  };
}