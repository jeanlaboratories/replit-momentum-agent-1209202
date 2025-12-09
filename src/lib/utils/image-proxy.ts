/**
 * Image Proxy Utilities
 * 
 * Provides secure image loading from external sources through a validated proxy.
 * This prevents Next.js image configuration errors when loading images from
 * user-entered URLs while maintaining security and performance.
 */

const TRUSTED_DOMAINS = [
  'storage.googleapis.com',
  'firebasestorage.googleapis.com',
  'placehold.co',
  'picsum.photos',
  'images.unsplash.com',
  'umbcretrievers.com',
];

/**
 * Checks if a URL is from a trusted domain that's already configured in next.config.ts
 */
export function isTrustedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return TRUSTED_DOMAINS.some(domain => {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return hostname.endsWith(baseDomain);
      }
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

/**
 * Returns a safe image URL that works with Next.js Image component
 * 
 * For data URLs (base64): Returns original URL (Next.js supports data URLs)
 * For signed GCS URLs: Returns original URL but should use unoptimized prop
 * For trusted domains (configured in next.config.ts): Returns original URL
 * For external domains: Returns proxied URL through /api/image-proxy
 * 
 * @param url - The original image URL
 * @returns Safe URL that can be used with next/image
 * 
 * @example
 * ```tsx
 * import { getSafeImageUrl } from '@/lib/utils/image-proxy';
 * 
 * <Image src={getSafeImageUrl(externalUrl)} alt="..." />
 * ```
 */
export function getSafeImageUrl(url: string): string {
  if (!url) return url;
  
  // Handle data URLs (base64 encoded images) - Next.js supports these directly
  if (url.startsWith('data:image/')) {
    return url;
  }
  
  if (isTrustedDomain(url)) {
    return url;
  }
  
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Checks if a URL is a signed Google Cloud Storage URL that should bypass Next.js optimization
 * Signed URLs have query parameters (GoogleAccessId, Expires, Signature) and can expire
 */
export function isSignedGcsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      (urlObj.hostname === 'storage.googleapis.com' || 
       urlObj.hostname === 'firebasestorage.googleapis.com') &&
      (urlObj.searchParams.has('GoogleAccessId') || 
       urlObj.searchParams.has('Expires') || 
       urlObj.searchParams.has('Signature'))
    );
  } catch {
    return false;
  }
}

/**
 * Batch version of getSafeImageUrl for processing multiple URLs
 */
export function getSafeImageUrls(urls: string[]): string[] {
  return urls.map(getSafeImageUrl);
}
