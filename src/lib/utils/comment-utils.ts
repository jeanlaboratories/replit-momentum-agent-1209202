/**
 * Utility functions for comment components
 */

/**
 * Generate user initials from a full name
 * @param name - Full name string
 * @returns Initials (up to 2 characters)
 */
export function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}