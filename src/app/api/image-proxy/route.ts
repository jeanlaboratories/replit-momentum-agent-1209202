import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
];

export async function GET(request: NextRequest) {
  try {
    // Authentication: Require user to be logged in
    const user = await getAuthenticatedUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }

    // Security: Only allow HTTPS URLs
    if (!url.startsWith('https://')) {
      return new NextResponse('Only HTTPS URLs are allowed', { status: 400 });
    }

    // Validate URL format
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (error) {
      return new NextResponse('Invalid URL format', { status: 400 });
    }

    // Security: Block localhost and private IPs to prevent SSRF attacks
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.local')
    ) {
      return new NextResponse('Private/local URLs are not allowed', { status: 403 });
    }

    // Fetch the image with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MOMENTUM-Image-Proxy/1.0',
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        return new NextResponse('Request timeout', { status: 504 });
      }
      return new NextResponse('Failed to fetch image', { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return new NextResponse(`Upstream error: ${response.status}`, { 
        status: response.status 
      });
    }

    // Validate content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !ALLOWED_CONTENT_TYPES.some(type => contentType.startsWith(type))) {
      return new NextResponse('Invalid content type. Only images are allowed.', { 
        status: 400 
      });
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      return new NextResponse('Image too large (max 10MB)', { status: 413 });
    }

    // Stream the image with size check
    const reader = response.body?.getReader();
    if (!reader) {
      return new NextResponse('Failed to read image', { status: 500 });
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > MAX_IMAGE_SIZE) {
        return new NextResponse('Image too large (max 10MB)', { status: 413 });
      }
      
      chunks.push(value);
    }

    // Combine chunks
    const buffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Return the image with caching headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('[Image Proxy] Error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
