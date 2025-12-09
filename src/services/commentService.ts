import {
  Comment,
  CommentThread,
  CommentContext,
  CommentContextType,
  FlagReason
} from '@/lib/types';
import {
  createComment,
  getComments,
  getReplies,
  updateComment,
  deleteComment,
  flagComment,
  getCommentContext
} from '@/app/actions/comment-management';

// Discriminated union types for better error handling
export type CommentServiceResult<T> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

export type PaginationCursor = string | undefined;

export interface CommentQueryOptions {
  pageSize?: number;
  cursor?: PaginationCursor;
}

export interface CommentListResult {
  comments: CommentThread[];
  hasMore: boolean;
  nextCursor?: PaginationCursor;
  totalCount?: number;
}

export interface ReplyListResult {
  replies: Comment[];
  hasMore: boolean;
  nextCursor?: PaginationCursor;
}

/**
 * Comment service that wraps backend actions with typed results and error handling
 */
export class CommentService {
  /**
   * Fetch comments for a specific context
   */
  static async getComments(
    brandId: string,
    contextType: CommentContextType,
    contextId: string,
    options: CommentQueryOptions = {}
  ): Promise<CommentServiceResult<CommentListResult>> {
    try {
      const { pageSize = 20, cursor } = options;
      
      if (!brandId?.trim()) {
        return { success: false, error: 'Brand ID is required', code: 'MISSING_BRAND_ID' };
      }
      
      if (!contextId?.trim()) {
        return { success: false, error: 'Context ID is required', code: 'MISSING_CONTEXT_ID' };
      }

      const result = await getComments(brandId, contextType, contextId, pageSize, cursor);
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.message || 'Failed to fetch comments', 
          code: 'FETCH_FAILED' 
        };
      }

      return {
        success: true,
        data: {
          comments: result.comments || [],
          hasMore: result.hasMore || false,
          nextCursor: result.comments && result.comments.length > 0 
            ? result.comments[result.comments.length - 1].id 
            : undefined
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Fetch replies for a specific comment
   */
  static async getReplies(
    brandId: string,
    parentCommentId: string,
    options: CommentQueryOptions = {}
  ): Promise<CommentServiceResult<ReplyListResult>> {
    try {
      const { pageSize = 10, cursor } = options;
      
      if (!brandId?.trim()) {
        return { success: false, error: 'Brand ID is required', code: 'MISSING_BRAND_ID' };
      }
      
      if (!parentCommentId?.trim()) {
        return { success: false, error: 'Parent comment ID is required', code: 'MISSING_PARENT_ID' };
      }

      const result = await getReplies(brandId, parentCommentId, pageSize, cursor);
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.message || 'Failed to fetch replies', 
          code: 'FETCH_FAILED' 
        };
      }

      return {
        success: true,
        data: {
          replies: result.replies || [],
          hasMore: result.hasMore || false,
          nextCursor: result.replies && result.replies.length > 0 
            ? result.replies[result.replies.length - 1].id 
            : undefined
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Get comment context (metadata and counters)
   */
  static async getContext(
    brandId: string,
    contextType: CommentContextType,
    contextId: string
  ): Promise<CommentServiceResult<CommentContext>> {
    try {
      if (!brandId?.trim()) {
        return { success: false, error: 'Brand ID is required', code: 'MISSING_BRAND_ID' };
      }
      
      if (!contextId?.trim()) {
        return { success: false, error: 'Context ID is required', code: 'MISSING_CONTEXT_ID' };
      }

      const result = await getCommentContext(brandId, contextType, contextId);
      
      if (!result.success || !result.context) {
        return { 
          success: false, 
          error: result.message || 'Failed to fetch context', 
          code: 'FETCH_FAILED' 
        };
      }

      return {
        success: true,
        data: result.context
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Create a new comment or reply
   */
  static async createComment(
    brandId: string,
    contextType: CommentContextType,
    contextId: string,
    body: string,
    parentId?: string
  ): Promise<CommentServiceResult<Comment>> {
    try {
      if (!brandId?.trim()) {
        return { success: false, error: 'Brand ID is required', code: 'MISSING_BRAND_ID' };
      }
      
      if (!contextId?.trim()) {
        return { success: false, error: 'Context ID is required', code: 'MISSING_CONTEXT_ID' };
      }
      
      if (!body?.trim()) {
        return { success: false, error: 'Comment body is required', code: 'MISSING_BODY' };
      }

      // Validate body length (max 2000 characters)
      const trimmedBody = body.trim();
      if (trimmedBody.length > 2000) {
        return { 
          success: false, 
          error: 'Comment is too long (maximum 2000 characters)', 
          code: 'BODY_TOO_LONG' 
        };
      }

      const result = await createComment(brandId, contextType, contextId, trimmedBody, parentId);
      
      if (!result.success || !result.comment) {
        return { 
          success: false, 
          error: result.message || 'Failed to create comment', 
          code: 'CREATE_FAILED' 
        };
      }

      return {
        success: true,
        data: result.comment
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Update an existing comment
   */
  static async updateComment(
    commentId: string,
    body: string
  ): Promise<CommentServiceResult<void>> {
    try {
      if (!commentId?.trim()) {
        return { success: false, error: 'Comment ID is required', code: 'MISSING_COMMENT_ID' };
      }
      
      if (!body?.trim()) {
        return { success: false, error: 'Comment body is required', code: 'MISSING_BODY' };
      }

      // Validate body length (max 2000 characters)
      const trimmedBody = body.trim();
      if (trimmedBody.length > 2000) {
        return { 
          success: false, 
          error: 'Comment is too long (maximum 2000 characters)', 
          code: 'BODY_TOO_LONG' 
        };
      }

      const result = await updateComment(commentId, trimmedBody);
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.message || 'Failed to update comment', 
          code: 'UPDATE_FAILED' 
        };
      }

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Delete a comment
   */
  static async deleteComment(
    commentId: string
  ): Promise<CommentServiceResult<void>> {
    try {
      if (!commentId?.trim()) {
        return { success: false, error: 'Comment ID is required', code: 'MISSING_COMMENT_ID' };
      }

      const result = await deleteComment(commentId);
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.message || 'Failed to delete comment', 
          code: 'DELETE_FAILED' 
        };
      }

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Flag a comment
   */
  static async flagComment(
    commentId: string,
    reason: FlagReason,
    notes?: string
  ): Promise<CommentServiceResult<void>> {
    try {
      if (!commentId?.trim()) {
        return { success: false, error: 'Comment ID is required', code: 'MISSING_COMMENT_ID' };
      }

      // Validate notes length if provided
      if (notes && notes.trim().length > 500) {
        return { 
          success: false, 
          error: 'Flag notes are too long (maximum 500 characters)', 
          code: 'NOTES_TOO_LONG' 
        };
      }

      const result = await flagComment(commentId, reason, notes?.trim());
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.message || 'Failed to flag comment', 
          code: 'FLAG_FAILED' 
        };
      }

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }
}

// Helper function to check if an error is retryable
export function isRetryableError(error: string, code?: string): boolean {
  const retryableCodes = ['NETWORK_ERROR', 'FETCH_FAILED'];
  const retryableMessages = ['network', 'timeout', 'connection', 'temporarily'];
  
  return (
    (code && retryableCodes.includes(code)) ||
    retryableMessages.some(msg => error.toLowerCase().includes(msg))
  );
}

// Helper function to format error messages for user display
export function formatErrorMessage(error: string, code?: string): string {
  switch (code) {
    case 'MISSING_BRAND_ID':
    case 'MISSING_CONTEXT_ID':
    case 'MISSING_COMMENT_ID':
      return 'Missing required information. Please try refreshing the page.';
    case 'MISSING_BODY':
      return 'Please enter a comment before submitting.';
    case 'BODY_TOO_LONG':
      return 'Your comment is too long. Please keep it under 2000 characters.';
    case 'NOTES_TOO_LONG':
      return 'Flag notes are too long. Please keep them under 500 characters.';
    case 'NETWORK_ERROR':
      return 'Connection issue. Please check your internet and try again.';
    default:
      return error || 'Something went wrong. Please try again.';
  }
}