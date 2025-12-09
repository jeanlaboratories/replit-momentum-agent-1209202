/**
 * Maximum tokens allowed by Gemini API (with safety margin)
 * Gemini 2.0 Flash has ~1M token context window (1048575 tokens)
 * 
 * We reserve significant space for:
 * - System prompts & Team Intelligence: ~50-100K tokens
 * - AI response generation: ~50K tokens  
 * - Media attachments: ~50-300K tokens per image/video
 * 
 * Therefore, messages are limited to a much smaller budget to ensure
 * total context (messages + system + media) stays under 1M tokens.
 */
export const MAX_CONTEXT_TOKENS = 400000; // Reduced from 900K to leave room for Team Intelligence + media

/**
 * Approximate tokens per character for text content
 * Gemini uses roughly 1 token per 4 characters for English text
 */
const CHARS_PER_TOKEN = 4;

/**
 * Approximate tokens for base64 encoded images/media
 * A typical base64 image is ~100KB-500KB which translates to lots of tokens
 */
const TOKENS_PER_BASE64_CHAR = 0.75; // base64 is very token-dense

/**
 * Estimate token count for a message
 */
function estimateMessageTokens(message: { role: string; content: string; media?: any[] }): number {
  let tokens = 0;

  // Text content
  if (message.content) {
    tokens += Math.ceil(message.content.length / CHARS_PER_TOKEN);
  }

  // Media content (base64 data is very token-heavy)
  if (message.media && message.media.length > 0) {
    for (const media of message.media) {
      if (media.data && typeof media.data === 'string') {
        // Base64 data is included directly
        tokens += Math.ceil(media.data.length * TOKENS_PER_BASE64_CHAR);
      } else if (media.url && typeof media.url === 'string') {
        // URL-based media - if it's a data URL, it's token-heavy
        if (media.url.startsWith('data:')) {
          tokens += Math.ceil(media.url.length * TOKENS_PER_BASE64_CHAR);
        } else {
          // Regular URL is just the URL length
          tokens += Math.ceil(media.url.length / CHARS_PER_TOKEN);
        }
      }
    }
  }

  return tokens;
}

/**
 * Truncate message history to fit within context window limits
 *
 * Strategy:
 * 1. Always keep the most recent message (current user query) with its media
 * 2. Keep as many recent messages as possible within the token limit
 * 3. Strip media from older messages if needed to fit more context
 * 4. Account for additional context that will be added (Team Intelligence, system prompts)
 *
 * @param messages - Full message history
 * @param maxTokens - Maximum tokens allowed (defaults to MAX_CONTEXT_TOKENS)
 * @param hasNewMedia - Whether the current message has media attachments (for more aggressive truncation)
 * @returns Truncated message array that fits within limits
 */
export function truncateMessagesForContextWindow(
  messages: Array<{ role: string; content: string; media?: any[] }>,
  maxTokens: number = MAX_CONTEXT_TOKENS,
  hasNewMedia: boolean = false
): Array<{ role: string; content: string; media?: any[] }> {
  if (!messages || messages.length === 0) {
    return messages;
  }

  // If new media is being uploaded, use more aggressive truncation
  // to leave room for the media attachment in the current message
  if (hasNewMedia && maxTokens === MAX_CONTEXT_TOKENS) {
    // Reduce token budget by 50% when media is present to leave room for:
    // - Current image/video (~100-300K tokens)
    // - Team Intelligence context (~50-100K tokens)
    // - System prompts (~10-50K tokens)
    maxTokens = Math.floor(maxTokens * 0.5); // Use only 200K for history
    console.log('[Context Window] Media detected - using reduced token budget for history:', maxTokens);
  }

  // Work backwards from most recent
  const result: Array<{ role: string; content: string; media?: any[] }> = [];
  let totalTokens = 0;
  let strippedMediaCount = 0;

  // Process messages from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateMessageTokens(message);

    // If this message would exceed the limit
    if (totalTokens + messageTokens > maxTokens) {
      // For the most recent message, we must include it (possibly stripped)
      if (i === messages.length - 1) {
        // For the current message, keep it but strip media from history version
        // The actual media will be sent separately in the media array
        if (message.media && message.media.length > 0) {
          const strippedMessage = { ...message, media: undefined };
          const strippedTokens = estimateMessageTokens(strippedMessage);
          if (totalTokens + strippedTokens <= maxTokens) {
            result.unshift(strippedMessage);
            totalTokens += strippedTokens;
            strippedMediaCount += message.media.length;
            console.log('[Context Window] Stripped media from current message in history (media sent separately)');
            continue;
          }
        }
        // If still too large, truncate the content
        const availableTokens = maxTokens - totalTokens;
        const availableChars = availableTokens * CHARS_PER_TOKEN;
        const truncatedContent = message.content.slice(-availableChars) + '... [content truncated]';
        result.unshift({ role: message.role, content: truncatedContent });
        totalTokens += availableTokens;
        continue;
      }

      // Try stripping media from older messages to fit more context
      if (message.media && message.media.length > 0) {
        const strippedMessage = { ...message, media: undefined };
        const strippedTokens = estimateMessageTokens(strippedMessage);
        if (totalTokens + strippedTokens <= maxTokens) {
          result.unshift(strippedMessage);
          totalTokens += strippedTokens;
          strippedMediaCount += message.media.length;
          continue;
        }
      }

      // Can't fit this message, stop adding older messages
      break;
    }

    // Message fits, add it - but strip media from older messages to save tokens
    // Keep media only in the most recent 2-3 messages
    const isRecent = (messages.length - 1 - i) < 3; // Last 3 messages
    if (!isRecent && message.media && message.media.length > 0) {
      // Strip media from older messages proactively
      const strippedMessage = { ...message, media: undefined };
      result.unshift(strippedMessage);
      totalTokens += estimateMessageTokens(strippedMessage);
      strippedMediaCount += message.media.length;
    } else {
      // Keep media for recent messages
      result.unshift(message);
      totalTokens += messageTokens;
    }
  }

  // Log if we truncated
  if (result.length < messages.length || strippedMediaCount > 0) {
    console.log(`[Context Window] Truncated messages: ${messages.length} -> ${result.length} messages, stripped ${strippedMediaCount} media attachments, ~${totalTokens} tokens`);
  }

  return result;
}

export function formatSelectedContext(selectedContext: any[], currentMessage: string): string {
  if (selectedContext && selectedContext.length > 0) {
    const contextText = selectedContext.map(m => `[${m.role === 'user' ? 'User' : 'AI'}]: ${m.content}`).join('\n');
    return `Context from previous messages:\n${contextText}\n\nCurrent Message: ${currentMessage}`;
  }
  return currentMessage;
}

/**
 * Media attachment from chat history
 */
export interface MediaAttachment {
  type: string;
  url: string;
  fileName?: string;
  mimeType?: string;
}

/**
 * Image context extracted from chat history
 * Tracks all images shared in the conversation for reference
 */
export interface ImageContext {
  /** The most recently shared/generated image URL */
  lastImageUrl: string | null;
  /** All image URLs from the conversation in chronological order */
  allImages: Array<{
    url: string;
    index: number; // 1-based for user reference (e.g., "image 1", "image 2")
    source: 'user' | 'assistant';
    fileName?: string;
  }>;
  /** Total number of images in the conversation */
  totalCount: number;
}

/**
 * Extract image context from chat messages
 * This allows users to reference previously shared images by index
 * (e.g., "edit image 1", "use the last image", "combine images 2 and 3")
 *
 * @param messages - Array of chat messages with optional media
 * @returns ImageContext with last image and all image references
 */
export function extractImageContext(messages: Array<{
  role: 'user' | 'assistant';
  content: string;
  media?: MediaAttachment[];
}>): ImageContext {
  const allImages: ImageContext['allImages'] = [];
  let lastImageUrl: string | null = null;

  // Process messages in chronological order
  for (const message of messages) {
    if (message.media && message.media.length > 0) {
      for (const media of message.media) {
        // Only track images (not videos, pdfs, etc.)
        if (media.type === 'image' && media.url) {
          allImages.push({
            url: media.url,
            index: allImages.length + 1, // 1-based index
            source: message.role,
            fileName: media.fileName,
          });
          lastImageUrl = media.url;
        }
      }
    }
  }

  return {
    lastImageUrl,
    allImages,
    totalCount: allImages.length,
  };
}

/**
 * Format image context as a text prompt addition
 * This helps the AI understand what images are available for reference
 *
 * @param imageContext - The extracted image context
 * @returns Formatted string to prepend to system prompt or message
 */
export function formatImageContextForPrompt(imageContext: ImageContext): string {
  if (imageContext.totalCount === 0) {
    return '';
  }

  let contextText = '\n\n--- AVAILABLE IMAGES FROM CONVERSATION ---\n';
  contextText += `You have access to ${imageContext.totalCount} image(s) from this conversation.\n`;

  if (imageContext.lastImageUrl) {
    contextText += `The most recent image is Image ${imageContext.totalCount}.\n`;
  }

  contextText += '\nImage references:\n';
  for (const img of imageContext.allImages) {
    const source = img.source === 'user' ? 'uploaded by user' : 'generated';
    const name = img.fileName ? ` (${img.fileName})` : '';
    contextText += `- Image ${img.index}: ${source}${name}\n`;
  }

  contextText += '\nWhen the user mentions "the last image", "previous image", "image 1", etc., use the corresponding URL from this list.\n';
  contextText += '--- END AVAILABLE IMAGES ---\n\n';

  return contextText;
}

/**
 * Resolve image reference from user text
 * Parses natural language references like "the last image", "image 2", etc.
 *
 * @param text - User message text
 * @param imageContext - The extracted image context
 * @returns Resolved image URL or null if no reference found
 */
export function resolveImageReference(text: string, imageContext: ImageContext): string | null {
  if (imageContext.totalCount === 0) {
    return null;
  }

  const lowerText = text.toLowerCase();

  // Check for "last image", "previous image", "recent image" references
  if (lowerText.includes('last image') ||
      lowerText.includes('previous image') ||
      lowerText.includes('recent image') ||
      lowerText.includes('that image') ||
      lowerText.includes('the image')) {
    return imageContext.lastImageUrl;
  }

  // Check for numbered references: "image 1", "image 2", "first image", etc.
  const numberMatch = lowerText.match(/image\s*(\d+)/);
  if (numberMatch) {
    const index = parseInt(numberMatch[1], 10);
    const image = imageContext.allImages.find(img => img.index === index);
    return image?.url || null;
  }

  // Check for ordinal references: "first image", "second image", etc.
  const ordinals: Record<string, number> = {
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
    'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
  };

  for (const [ordinal, index] of Object.entries(ordinals)) {
    if (lowerText.includes(`${ordinal} image`)) {
      const image = imageContext.allImages.find(img => img.index === index);
      return image?.url || null;
    }
  }

  return null;
}
