/**
 * Utility functions for detecting and validating image URLs in text
 */

// Common image file extensions
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'];

// Regex pattern to match URLs in text
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * Check if a URL points to an image based on extension or known image hosting patterns
 */
export function isImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Check for common image extensions
    const hasImageExtension = IMAGE_EXTENSIONS.some(ext => pathname.endsWith(`.${ext}`));
    if (hasImageExtension) {
      return true;
    }

    // Check for known image hosting patterns that may not have extensions
    // Nike images (as per the user's example)
    if (urlObj.hostname.includes('static.nike.com') && pathname.includes('/images/')) {
      return true;
    }

    // Common image CDNs and hosting services
    const imageHostPatterns = [
      /cloudinary\.com/,
      /imgix\.net/,
      /imagekit\.io/,
      /unsplash\.com\/photos/,
      /images\.unsplash\.com/,
      /pexels\.com\/photo/,
      /images\.pexels\.com/,
      /i\.imgur\.com/,
      /cdn\.shopify\.com.*\.(jpg|jpeg|png|gif|webp)/i,
      /firebasestorage\.googleapis\.com.*\.(jpg|jpeg|png|gif|webp)/i,
      /storage\.googleapis\.com.*\.(jpg|jpeg|png|gif|webp)/i,
      /amazonaws\.com.*\.(jpg|jpeg|png|gif|webp)/i,
      /blob\.core\.windows\.net.*\.(jpg|jpeg|png|gif|webp)/i,
    ];

    for (const pattern of imageHostPatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }

    // Check for image content type indicators in URL params
    const searchParams = urlObj.searchParams;
    const format = searchParams.get('format') || searchParams.get('f') || searchParams.get('fm');
    if (format && IMAGE_EXTENSIONS.includes(format.toLowerCase())) {
      return true;
    }

    // Check for f_auto pattern commonly used by Nike and other CDNs
    if (pathname.includes('/f_auto/') || pathname.includes('/f_auto,')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract all URLs from text that appear to be image URLs
 */
export function extractImageUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) || [];
  return matches.filter(url => isImageUrl(url));
}

/**
 * Check if text contains any image URLs
 */
export function hasImageUrls(text: string): boolean {
  return extractImageUrls(text).length > 0;
}

/**
 * Remove image URLs from text, optionally leaving a placeholder
 */
export function removeImageUrls(text: string, placeholder = ''): string {
  const imageUrls = extractImageUrls(text);
  let result = text;
  for (const url of imageUrls) {
    result = result.replace(url, placeholder);
  }
  // Clean up multiple spaces and trim
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Get file name from an image URL
 */
export function getImageFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];

    // If it has an extension, use it
    if (lastSegment && /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|avif)$/i.test(lastSegment)) {
      return lastSegment;
    }

    // Otherwise generate a name from the URL
    return `image-${Date.now()}.jpg`;
  } catch {
    return `image-${Date.now()}.jpg`;
  }
}

/**
 * Get the MIME type for a URL based on extension or pattern
 */
export function getImageMimeType(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.svg')) return 'image/svg+xml';
    if (pathname.endsWith('.bmp')) return 'image/bmp';
    if (pathname.endsWith('.ico')) return 'image/x-icon';
    if (pathname.endsWith('.avif')) return 'image/avif';

    // Default to JPEG for most image URLs
    return 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
}
