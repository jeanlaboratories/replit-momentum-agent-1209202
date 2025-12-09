# Image Proxy Guide

## Overview

MOMENTUM includes a secure image proxy that allows loading images from any external URL without requiring manual domain configuration. This solves the common Next.js "unconfigured hostname" error while maintaining security and performance.

## Why Use the Image Proxy?

### The Problem
Next.js requires all external image domains to be explicitly allowlisted in `next.config.ts`. When users enter arbitrary URLs (e.g., through Team Intelligence crawling), you'd need to constantly update the configuration.

### The Solution
The image proxy acts as a secure intermediary that:
- ✅ Validates image sources (HTTPS only, proper content types)
- ✅ Blocks malicious URLs (localhost, private IPs, SSRF attacks)
- ✅ Enforces size limits (10MB max)
- ✅ Requires authentication (users must be logged in)
- ✅ Caches responses for performance
- ✅ Works with Next.js Image optimization

## Security Features

### 1. Authentication Required
Only logged-in users can use the proxy, preventing abuse as a public image proxy.

### 2. HTTPS Only
All proxied images must use HTTPS, blocking insecure HTTP sources.

### 3. SSRF Protection
Blocks requests to:
- localhost / 127.0.0.1
- Private IP ranges (192.168.x.x, 10.x.x.x, 172.16.x.x)
- .local domains

### 4. Content Type Validation
Only serves actual images:
- image/jpeg, image/jpg
- image/png
- image/gif
- image/webp
- image/svg+xml
- image/avif

### 5. Size Limits
- Maximum image size: 10MB
- 10-second timeout for slow sources

### 6. Response Security
- Sets `X-Content-Type-Options: nosniff` header
- Proper caching headers to reduce load

## Usage

### Basic Usage

Use the `getSafeImageUrl()` helper function:

```tsx
import { getSafeImageUrl } from '@/lib/utils/image-proxy';
import Image from 'next/image';

function MyComponent({ externalUrl }: { externalUrl: string }) {
  return (
    <Image 
      src={getSafeImageUrl(externalUrl)}
      alt="External content"
      width={400}
      height={300}
    />
  );
}
```

### How It Works

The `getSafeImageUrl()` function automatically:
1. Checks if the URL is from a trusted domain (already in next.config.ts)
2. If trusted → Returns the original URL (faster, direct loading)
3. If untrusted → Returns proxied URL: `/api/image-proxy?url=...`

**Trusted domains** (configured in next.config.ts):
- storage.googleapis.com (Firebase Storage)
- firebasestorage.googleapis.com
- placehold.co
- picsum.photos
- images.unsplash.com
- umbcretrievers.com
- And many more...

### Batch Processing

For multiple URLs:

```tsx
import { getSafeImageUrls } from '@/lib/utils/image-proxy';

const safeUrls = getSafeImageUrls([
  'https://example.com/image1.jpg',
  'https://example.com/image2.jpg',
  'https://trusted-domain.com/image3.jpg', // Will use direct URL
]);
```

### Manual Proxy Usage

If you need direct access to the proxy API:

```tsx
const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(externalUrl)}`;

<Image src={proxyUrl} alt="..." width={400} height={300} />
```

## Where It's Used

The image proxy is already integrated into:

- **Media Library** (`media-grid.tsx`) - Displays images from Team Intelligence sources
- **Team Intelligence** - Shows extracted images from crawled websites
- **Any component** using `getSafeImageUrl()`

## Performance

### Caching Strategy

The proxy uses aggressive caching:
- **Browser cache**: 24 hours (`max-age=86400`)
- **CDN cache**: 24 hours (`s-maxage=86400`)
- **Stale while revalidate**: 7 days (`stale-while-revalidate=604800`)

This means:
- First request fetches from external source
- Subsequent requests served from cache
- Minimal performance impact

### When to Add to next.config.ts Instead

If you're consistently loading images from a specific domain:
- Add it to `next.config.ts` for better performance
- Direct loading is faster than proxying
- Reserve the proxy for truly dynamic/unknown sources

## Error Handling

The proxy returns clear error messages:

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | Missing URL parameter | No `url` query param provided |
| 400 | Only HTTPS URLs are allowed | Attempted to load HTTP image |
| 400 | Invalid URL format | Malformed URL |
| 400 | Invalid content type | URL doesn't point to an image |
| 401 | Unauthorized | User not logged in |
| 403 | Private/local URLs not allowed | SSRF attempt blocked |
| 413 | Image too large | Image exceeds 10MB |
| 502 | Failed to fetch image | External source unreachable |
| 504 | Request timeout | External source too slow (>10s) |

## Example: Team Intelligence Integration

When users add a website to Team Intelligence:

1. Firecrawl extracts images from the page
2. Image URLs are stored in Firestore
3. Media Library displays them using `getSafeImageUrl()`
4. Works regardless of the source domain!

```tsx
// In extracted Team Intelligence data
const artifact = {
  url: 'https://random-team-website.com/photo.jpg',
  // ... other fields
};

// In component
<Image 
  src={getSafeImageUrl(artifact.url)}
  alt={artifact.title}
  fill
  className="object-cover"
/>
```

## Monitoring & Abuse Prevention

### Current Protections
- Authentication required (prevents public abuse)
- Size limits (prevents bandwidth abuse)
- Timeout limits (prevents resource exhaustion)
- SSRF protection (prevents network scanning)

### Future Enhancements
Consider adding:
- Rate limiting per user/IP
- Usage analytics and alerting
- Cost tracking for bandwidth
- Allowlist/blocklist management UI

## API Reference

### Endpoint
```
GET /api/image-proxy?url=<encoded-url>
```

### Query Parameters
- `url` (required): The external image URL to proxy

### Request Headers
- `Cookie`: Must include valid session (authentication)

### Response Headers
- `Content-Type`: Original image MIME type
- `Cache-Control`: Caching directives
- `X-Content-Type-Options: nosniff`: Security header

### Example Request
```bash
curl -H "Cookie: session=..." \
  "https://your-app.com/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimage.jpg"
```

## Troubleshooting

### Issue: "Unauthorized" error
**Solution**: User must be logged in. The proxy requires authentication.

### Issue: "Only HTTPS URLs are allowed"
**Solution**: Change the source URL from `http://` to `https://`

### Issue: "Image too large"
**Solution**: The source image exceeds 10MB. Consider:
- Using a smaller image
- Compressing the source
- Storing in Firebase Storage instead

### Issue: Still getting "hostname not configured" error
**Solution**: Make sure you're using `getSafeImageUrl()`:
```tsx
// ❌ Wrong
<Image src={externalUrl} ... />

// ✅ Correct
<Image src={getSafeImageUrl(externalUrl)} ... />
```

## Best Practices

1. **Use for dynamic sources only** - Add known domains to next.config.ts for better performance
2. **Always use the helper** - Use `getSafeImageUrl()` instead of direct proxy URLs
3. **Handle errors gracefully** - Show fallback images if proxy fails
4. **Monitor usage** - Watch for abuse patterns in logs
5. **Update trusted domains** - Add frequently-used sources to next.config.ts

## Security Considerations

✅ **Safe to use** because:
- Authentication required
- HTTPS enforced
- SSRF protection enabled
- Content validation performed
- Size limits enforced

⚠️ **Still monitor for**:
- Unusual traffic patterns
- Bandwidth spikes
- Slow external sources
- Malicious URLs in logs
