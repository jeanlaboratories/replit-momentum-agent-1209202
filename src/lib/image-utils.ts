
/**
 * List of allowed domains for Next.js Image Optimization.
 * This must match the domains/patterns in next.config.ts.
 */
export const ALLOWED_IMAGE_DOMAINS = [
  'placehold.co',
  'picsum.photos',
  'storage.googleapis.com',
  'images.unsplash.com',
  'sample-videos.com',
  'firebasestorage.googleapis.com',
  'mailchimp.com',
  'assets.tfrrs.org',
  'www2.umbc.edu',
  'umbcretrievers.com',
  'upload.wikimedia.org',
  'worldathletics.org',
  // Wildcards (simplified check)
  'nike.com',
  'cloudfront.net',
  'amazonaws.com',
  'cloudinary.com',
  'imgix.net',
  'shopify.com',
  'shopifycdn.com',
  'akamaized.net',
  'wp.com',
  'wixstatic.com',
  'squarespace.com',
  'googleusercontent.com',
  'ctfassets.net',
  'fastly.net',
  'azureedge.net',
  'brightcove.com',
  'olympics.com', // Added recently
  'edu', // *.edu
];

/**
 * Checks if an image URL should be optimized by Next.js.
 * Returns true if the hostname is in the allowed list, false otherwise.
 */
export const shouldOptimizeImage = (url: string): boolean => {
  if (!url || url.startsWith('/')) return true; // Local images are always optimized

  try {
    const hostname = new URL(url).hostname;

    // Check exact matches
    if (ALLOWED_IMAGE_DOMAINS.includes(hostname)) return true;

    // Check wildcard matches (e.g., *.nike.com)
    // We check if the hostname ends with any of the allowed domains
    return ALLOWED_IMAGE_DOMAINS.some(domain => {
      if (domain === 'edu') return hostname.endsWith('.edu');
      return hostname.endsWith(`.${domain}`) || hostname === domain;
    });
  } catch (e) {
    // Invalid URL, default to unoptimized to be safe, or optimized if it's a relative path we missed
    return false;
  }
};

/**
 * Converts a URL to a data URI.
 * Fetches the resource, converts to buffer, and returns base64 data URI.
 */
export async function convertUrlToDataUri(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting URL to data URI:', error);
    throw error;
  }
}
