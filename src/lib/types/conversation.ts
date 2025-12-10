/**
 * Conversation types for Team Companion chat history
 * Supports multiple conversations per user with metadata tracking
 */

export interface Conversation {
  id: string;
  brandId: string;
  userId: string;
  title: string;
  preview: string; // First ~100 chars of first message
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  isArchived: boolean;
  // Track dominant mode used in conversation
  primaryMode?: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
  isArchived: boolean;
}

export interface CreateConversationRequest {
  brandId: string;
  title?: string; // Optional - will auto-generate if not provided
}

export interface CreateConversationResponse {
  success: boolean;
  conversation?: Conversation;
  error?: string;
}

export interface ListConversationsResponse {
  success: boolean;
  conversations?: ConversationListItem[];
  error?: string;
}

export interface UpdateConversationRequest {
  conversationId: string;
  brandId: string;
  title?: string;
  isArchived?: boolean;
}

export interface DeleteConversationRequest {
  conversationId: string;
  brandId: string;
}

// Default conversation ID for backward compatibility
// Messages without a conversationId belong to this "default" conversation
export const DEFAULT_CONVERSATION_ID = 'default';

/**
 * Generate a title from the first message content
 * Creates a concise, descriptive title based on the message intent
 */
export function generateConversationTitle(firstMessage: string): string {
  // Clean up the message
  let cleaned = firstMessage.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');

  if (!cleaned) {
    return 'New Conversation';
  }

  // Remove common filler phrases at the start to get to the core topic
  const fillerPatterns = [
    /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s,!.]*/i,
    /^(can you|could you|would you|please|i want to|i need to|i'd like to|help me|i want you to)\s*/i,
    /^(tell me about|explain|describe|show me|give me|create|make|generate|write)\s*/i,
  ];

  let topic = cleaned;
  for (const pattern of fillerPatterns) {
    topic = topic.replace(pattern, '');
  }
  topic = topic.trim();

  // If we stripped too much, use the original
  if (topic.length < 5) {
    topic = cleaned;
  }

  // Capitalize first letter
  topic = topic.charAt(0).toUpperCase() + topic.slice(1);

  // Truncate to reasonable length (60 chars) at word boundary
  if (topic.length <= 60) {
    // Remove trailing punctuation for cleaner look
    return topic.replace(/[.?!,;:]+$/, '') || 'New Conversation';
  }

  // Find a good break point (space, comma, or other natural breaks)
  const truncated = topic.substring(0, 60);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastComma = truncated.lastIndexOf(',');
  const breakPoint = Math.max(lastSpace, lastComma);

  if (breakPoint > 35) {
    return truncated.substring(0, breakPoint).replace(/[.?!,;:]+$/, '') + '...';
  }
  return truncated.replace(/[.?!,;:]+$/, '') + '...';
}

/**
 * Generate a preview from the first message
 * Creates full, complete sentences that wrap properly
 */
export function generateConversationPreview(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
  
  if (!cleaned) {
    return 'New conversation';
  }

  // If the message is short enough, return it as-is (increased to 200 chars for better preview)
  if (cleaned.length <= 200) {
    // Ensure it ends with proper punctuation
    if (!/[.!?]$/.test(cleaned)) {
      return cleaned + '.';
    }
    return cleaned;
  }

  // Find the end of the first complete sentence (up to 200 chars for better previews)
  // Look for sentence-ending punctuation
  const sentenceEnders = /[.!?]\s+/;
  const first200 = cleaned.substring(0, 200);
  const match = first200.match(sentenceEnders);
  
  if (match && match.index !== undefined && match.index > 20) {
    // Found a sentence end within the first 200 chars, use it
    return cleaned.substring(0, match.index! + 1);
  }

  // If no sentence end found, find the last space before 200 chars
  const lastSpace = first200.lastIndexOf(' ');
  if (lastSpace > 100) {
    // Found a good break point, ensure it's a complete thought
    const truncated = cleaned.substring(0, lastSpace);
    // Add ellipsis only if we're cutting off significant content
    if (cleaned.length > lastSpace + 20) {
      return truncated + '...';
    }
    return truncated + '.';
  }

  // Fallback: truncate at 200 chars with ellipsis (increased from 120)
  return cleaned.substring(0, 200) + '...';
}
