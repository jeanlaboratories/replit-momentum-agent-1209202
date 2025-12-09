import { FlagReason } from '@/lib/types';

// Comment validation constraints
export const COMMENT_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 1000,
  MAX_FLAG_NOTES_LENGTH: 500,
  EDIT_WINDOW_MINUTES: 15
} as const;

// Validation error types with specific error codes
export type CommentValidationError = 
  | { code: 'COMMENT_TOO_SHORT'; message: string }
  | { code: 'COMMENT_TOO_LONG'; message: string; maxLength: number }
  | { code: 'COMMENT_EMPTY'; message: string }
  | { code: 'FLAG_NOTES_TOO_LONG'; message: string; maxLength: number }
  | { code: 'EDIT_WINDOW_EXPIRED'; message: string; windowMinutes: number }
  | { code: 'INVALID_FLAG_REASON'; message: string; validReasons: readonly FlagReason[] }
  | { code: 'INVALID_CHARACTERS'; message: string };

// Validation result type
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: CommentValidationError };

// Type guard for valid comment body
export function isValidCommentBody(body: unknown): body is string {
  return typeof body === 'string' && body.trim().length > 0;
}

// Type guard for valid flag reason
export function isValidFlagReason(reason: unknown): reason is FlagReason {
  const validReasons: readonly FlagReason[] = ['inappropriate', 'spam', 'off_topic', 'harassment', 'other'];
  return typeof reason === 'string' && validReasons.includes(reason as FlagReason);
}

// Validated comment body type
export type ValidatedCommentBody = string & { readonly __brand: 'ValidatedCommentBody' };

// Validated flag notes type  
export type ValidatedFlagNotes = string & { readonly __brand: 'ValidatedFlagNotes' };

// Comment body validation function
export function validateCommentBody(body: unknown): ValidationResult<ValidatedCommentBody> {
  // Check if body is a string
  if (typeof body !== 'string') {
    return {
      success: false,
      error: {
        code: 'COMMENT_EMPTY',
        message: 'Comment body must be a string'
      }
    };
  }

  const trimmedBody = body.trim();

  // Check if empty
  if (trimmedBody.length === 0) {
    return {
      success: false,
      error: {
        code: 'COMMENT_EMPTY',
        message: 'Please enter a comment before submitting'
      }
    };
  }

  // Check minimum length
  if (trimmedBody.length < COMMENT_CONSTRAINTS.MIN_LENGTH) {
    return {
      success: false,
      error: {
        code: 'COMMENT_TOO_SHORT',
        message: 'Comment is too short'
      }
    };
  }

  // Check maximum length
  if (trimmedBody.length > COMMENT_CONSTRAINTS.MAX_LENGTH) {
    return {
      success: false,
      error: {
        code: 'COMMENT_TOO_LONG',
        message: `Comment must be under ${COMMENT_CONSTRAINTS.MAX_LENGTH} characters`,
        maxLength: COMMENT_CONSTRAINTS.MAX_LENGTH
      }
    };
  }

  // Check for potentially harmful characters (basic XSS prevention)
  const dangerousPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  if (dangerousPattern.test(trimmedBody)) {
    return {
      success: false,
      error: {
        code: 'INVALID_CHARACTERS',
        message: 'Comment contains invalid characters'
      }
    };
  }

  return {
    success: true,
    data: trimmedBody as ValidatedCommentBody
  };
}

// Flag notes validation function
export function validateFlagNotes(notes: unknown): ValidationResult<ValidatedFlagNotes | undefined> {
  // Notes are optional
  if (notes === null || notes === undefined || notes === '') {
    return { success: true, data: undefined };
  }

  // Check if notes is a string
  if (typeof notes !== 'string') {
    return {
      success: false,
      error: {
        code: 'FLAG_NOTES_TOO_LONG',
        message: 'Flag notes must be a string',
        maxLength: COMMENT_CONSTRAINTS.MAX_FLAG_NOTES_LENGTH
      }
    };
  }

  const trimmedNotes = notes.trim();

  // Check maximum length
  if (trimmedNotes.length > COMMENT_CONSTRAINTS.MAX_FLAG_NOTES_LENGTH) {
    return {
      success: false,
      error: {
        code: 'FLAG_NOTES_TOO_LONG',
        message: `Flag notes must be under ${COMMENT_CONSTRAINTS.MAX_FLAG_NOTES_LENGTH} characters`,
        maxLength: COMMENT_CONSTRAINTS.MAX_FLAG_NOTES_LENGTH
      }
    };
  }

  return {
    success: true,
    data: trimmedNotes as ValidatedFlagNotes
  };
}

// Flag reason validation function
export function validateFlagReason(reason: unknown): ValidationResult<FlagReason> {
  if (!isValidFlagReason(reason)) {
    const validReasons: readonly FlagReason[] = ['inappropriate', 'spam', 'off_topic', 'harassment', 'other'];
    return {
      success: false,
      error: {
        code: 'INVALID_FLAG_REASON',
        message: 'Invalid flag reason',
        validReasons
      }
    };
  }

  return {
    success: true,
    data: reason
  };
}

// Edit window validation function
export function validateEditWindow(createdAt: string | Date): ValidationResult<void> {
  const createdTime = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const windowMs = COMMENT_CONSTRAINTS.EDIT_WINDOW_MINUTES * 60 * 1000;
  
  if (now.getTime() - createdTime.getTime() > windowMs) {
    return {
      success: false,
      error: {
        code: 'EDIT_WINDOW_EXPIRED',
        message: `Comments can only be edited within ${COMMENT_CONSTRAINTS.EDIT_WINDOW_MINUTES} minutes of posting`,
        windowMinutes: COMMENT_CONSTRAINTS.EDIT_WINDOW_MINUTES
      }
    };
  }

  return { success: true, data: undefined };
}

// Type guard for validation error result
export function isValidationError<T>(result: ValidationResult<T>): result is { success: false; error: CommentValidationError } {
  return !result.success;
}

// Helper function to get user-friendly error message
export function getValidationErrorMessage(error: CommentValidationError): string {
  switch (error.code) {
    case 'COMMENT_EMPTY':
      return 'Please enter a comment before submitting.';
    case 'COMMENT_TOO_SHORT':
      return 'Comment is too short.';
    case 'COMMENT_TOO_LONG':
      return `Comment is too long. Maximum ${error.maxLength} characters allowed.`;
    case 'FLAG_NOTES_TOO_LONG':
      return `Flag notes are too long. Maximum ${error.maxLength} characters allowed.`;
    case 'EDIT_WINDOW_EXPIRED':
      return `Comments can only be edited within ${error.windowMinutes} minutes of posting.`;
    case 'INVALID_FLAG_REASON':
      return 'Please select a valid flag reason.';
    case 'INVALID_CHARACTERS':
      return 'Comment contains invalid characters.';
    default:
      return 'Invalid input.';
  }
}