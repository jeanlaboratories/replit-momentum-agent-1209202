/**
 * Utility functions for generating unique IDs.
 * Centralizes ID generation to ensure consistency and use of non-deprecated methods.
 */

/**
 * Generates a random alphanumeric string of specified length.
 * Uses substring() instead of deprecated substr().
 * @param length - Length of the random string (default: 9)
 * @returns Random alphanumeric string
 */
export function generateRandomString(length: number = 9): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generates a unique ID with a prefix and timestamp.
 * Format: {prefix}_{timestamp}_{randomString}
 * @param prefix - Prefix for the ID (e.g., 'job', 'img', 'vid')
 * @returns Unique ID string
 */
export function generateUniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${generateRandomString()}`;
}

/**
 * Generates a unique ID with a prefix and hyphen separator.
 * Format: {prefix}-{timestamp}-{randomString}
 * @param prefix - Prefix for the ID (e.g., 'chatbot-img', 'upload-vid')
 * @returns Unique ID string with hyphen separator
 */
export function generateUniqueIdWithHyphen(prefix: string): string {
  return `${prefix}-${Date.now()}-${generateRandomString()}`;
}
