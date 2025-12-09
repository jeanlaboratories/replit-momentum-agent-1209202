// Brand Soul - Website Crawling & Ingestion API (Production)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { 
  BrandArtifact, 
  IngestWebsiteRequest, 
  IngestResponse,
  ImageExtractionOptions 
} from '@/lib/types/brand-soul';

// Helper function to parse image dimensions from buffer
function getImageDimensionsFromBuffer(buffer: Uint8Array): { width: number; height: number } | null {
  try {
    // PNG signature: 89 50 4E 47
    if (buffer.length >= 24 && 
        buffer[0] === 0x89 && buffer[1] === 0x50 && 
        buffer[2] === 0x4E && buffer[3] === 0x47) {
      // PNG dimensions are at bytes 16-23 (big-endian)
      const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
      const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
      return { width, height };
    }
    
    // JPEG signature: FF D8 FF
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
      // Scan for SOF (Start of Frame) marker
      let i = 2;
      while (i < buffer.length - 9) {
        if (buffer[i] === 0xFF) {
          const marker = buffer[i + 1];
          // SOF0, SOF1, SOF2 markers
          if (marker >= 0xC0 && marker <= 0xC3) {
            const height = (buffer[i + 5] << 8) | buffer[i + 6];
            const width = (buffer[i + 7] << 8) | buffer[i + 8];
            return { width, height };
          }
          // Skip to next marker
          const len = (buffer[i + 2] << 8) | buffer[i + 3];
          i += 2 + len;
        } else {
          i++;
        }
      }
    }
    
    // GIF signature: 47 49 46 38
    if (buffer.length >= 10 && 
        buffer[0] === 0x47 && buffer[1] === 0x49 && 
        buffer[2] === 0x46 && buffer[3] === 0x38) {
      // GIF dimensions are at bytes 6-9 (little-endian)
      const width = buffer[6] | (buffer[7] << 8);
      const height = buffer[8] | (buffer[9] << 8);
      return { width, height };
    }
    
    // WebP signature: 52 49 46 46 ... 57 45 42 50
    if (buffer.length >= 30 && 
        buffer[0] === 0x52 && buffer[1] === 0x49 && 
        buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && 
        buffer[10] === 0x42 && buffer[11] === 0x50) {
      // VP8 format
      if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
        const width = (buffer[26] | (buffer[27] << 8)) & 0x3FFF;
        const height = (buffer[28] | (buffer[29] << 8)) & 0x3FFF;
        return { width, height };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Helper function to filter images based on extraction options
async function filterImages(
  images: string[],
  options?: ImageExtractionOptions
): Promise<string[]> {
  if (!options) {
    // Default: return up to 10 images
    return images.slice(0, 10);
  }

  let filtered = [...images];

  // Filter by keywords (check URL/filename)
  if (options.keywords && options.keywords.length > 0) {
    filtered = filtered.filter(imageUrl => {
      const lowerUrl = imageUrl.toLowerCase();
      return options.keywords!.some(keyword => 
        lowerUrl.includes(keyword.toLowerCase())
      );
    });
  }

  // Filter by dimensions if specified
  if (options.minWidth || options.minHeight) {
    const imageChecks = await Promise.allSettled(
      filtered.map(async (imageUrl) => {
        try {
          // Fetch first few KB of image to read dimensions
          const response = await fetch(imageUrl, {
            signal: AbortSignal.timeout(5000), // 5 second timeout
            headers: {
              'Range': 'bytes=0-4096' // First 4KB should contain image headers
            }
          });
          
          if (!response.ok) {
            // If fetch fails, exclude the image
            return { imageUrl, include: false };
          }

          const buffer = await response.arrayBuffer();
          const dimensions = getImageDimensionsFromBuffer(new Uint8Array(buffer));
          
          if (!dimensions) {
            // Can't determine dimensions, exclude to be safe
            return { imageUrl, include: false };
          }

          // Check if dimensions meet minimum requirements
          const meetsWidth = options.minWidth ? dimensions.width >= options.minWidth : true;
          const meetsHeight = options.minHeight ? dimensions.height >= options.minHeight : true;
          
          return { imageUrl, include: meetsWidth && meetsHeight };
        } catch {
          // If we can't fetch or parse, exclude the image
          return { imageUrl, include: false };
        }
      })
    );

    filtered = imageChecks
      .filter(result => result.status === 'fulfilled' && result.value.include)
      .map(result => (result as PromiseFulfilledResult<{ imageUrl: string; include: boolean }>).value.imageUrl);
  }

  // Apply maxImages limit
  const maxImages = options.maxImages ?? 10;
  return filtered.slice(0, maxImages);
}

export async function POST(request: NextRequest) {
  try {
    const body: IngestWebsiteRequest = await request.json();
    
    const { brandId, url, crawlSubpages, maxPages, tags, imageOptions } = body;
    
    // Validation
    if (!brandId || !url) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: brandId, url' 
        },
        { status: 400 }
      );
    }
    
    // Validate URL format
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(url);
      if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid URL format. Must be a valid http or https URL.' 
        },
        { status: 400 }
      );
    }
    
    console.log('[Brand Soul Website] Crawling website:', { 
      brandId, 
      url,
      crawlSubpages,
      maxPages 
    });
    
    // Get authenticated user and verify brand access
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);
    const userId = authenticatedUser.uid;
    
    // Initialize Firecrawl
    const apiKey = process.env.MOMENTUM_FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Firecrawl API key not configured' 
        },
        { status: 500 }
      );
    }
    
    // Crawl or scrape based on crawlSubpages setting
    let content: string;
    let metadata: any = {
      url,
      crawledAt: new Date().toISOString(),
      tags: tags || [],
    };
    
    if (crawlSubpages) {
      // Crawl multiple pages (using async crawl with polling)
      console.log(`[Brand Soul Website] Crawling up to ${maxPages || 10} pages from ${url}...`);
      
      const crawlResponse = await fetch(`${FIRECRAWL_API_URL}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          limit: maxPages || 10,
          scrapeOptions: {
            formats: ['markdown', 'links', 'screenshot'],
            waitFor: 5000,
            timeout: 90000,
          },
        }),
      });
      
      if (!crawlResponse.ok) {
        const errorText = await crawlResponse.text();
        throw new Error(`Firecrawl crawl API error: ${crawlResponse.status} - ${errorText}`);
      }
      
      const crawlJob = await crawlResponse.json();
      const pages = crawlJob.data || [];
      
      if (pages.length === 0) {
        throw new Error('Firecrawl crawl returned no pages');
      }
      
      // Combine all pages
      content = pages
        .map((page: any, idx: number) => 
          `\n\n--- Page ${idx + 1}: ${page.metadata?.title || page.url || 'Untitled'} ---\n\n${page.markdown || ''}`
        )
        .join('\n\n');
      
      // Extract up to 10 images from all crawled pages
      const allImages: string[] = [];
      const allScreenshots: string[] = [];
      pages.forEach((page: any) => {
        if (page.images && Array.isArray(page.images)) {
          allImages.push(...page.images);
        }
        if (page.screenshot) {
          allScreenshots.push(page.screenshot);
        }
      });
      
      // Deduplicate and filter images
      const uniqueImages = await filterImages(
        [...new Set(allImages)].filter(img => img && typeof img === 'string' && img.startsWith('http')),
        imageOptions
      );
      
      metadata.pagesCount = pages.length;
      metadata.urls = pages.map((p: any) => p.url);
      metadata.title = pages[0]?.metadata?.title || validatedUrl.hostname;
      metadata.extractedImages = uniqueImages;
      metadata.imageCount = uniqueImages.length;
      metadata.screenshots = allScreenshots.slice(0, 3);  // Store up to 3 screenshots
      
    } else {
      // Scrape single page
      console.log(`[Brand Soul Website] Scraping single page: ${url}...`);
      
      const scrapeResponse = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'links', 'screenshot'],
          waitFor: 5000,
          timeout: 90000,
        }),
      });
      
      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        throw new Error(`Firecrawl scrape API error: ${scrapeResponse.status} - ${errorText}`);
      }
      
      const scrapeResult = await scrapeResponse.json();
      const doc = scrapeResult.data || scrapeResult;
      content = doc.markdown || '';
      metadata.title = doc.metadata?.title || validatedUrl.hostname;
      metadata.pagesCount = 1;
      
      // Extract and filter images
      const extractedImages = (doc.images && Array.isArray(doc.images))
        ? await filterImages(
            doc.images.filter((img: any) => img && typeof img === 'string' && img.startsWith('http')),
            imageOptions
          )
        : [];
      
      metadata.extractedImages = extractedImages;
      metadata.imageCount = extractedImages.length;
      
      // Store screenshot for color extraction
      if (doc.screenshot) {
        metadata.screenshots = [doc.screenshot];
      }
    }
    
    // Validate we got content
    if (!content || content.trim().length < 100) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to extract meaningful content from website' 
        },
        { status: 400 }
      );
    }
    
    // Generate artifact ID
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Store content in Firebase Storage
    const contentRef = await brandSoulStorage.storeContent(
      brandId,
      artifactId,
      content,
      'source'
    );
    
    // Create artifact metadata in Firestore
    // New artifacts default to 'private' visibility - user must explicitly share to team
    const artifact: BrandArtifact = {
      id: artifactId,
      brandId,
      type: 'website',
      source: {
        url,
        crawledAt: metadata.crawledAt,
      },
      status: 'pending',
      visibility: 'private',  // Default to private, user can share to team later
      metadata: {
        ...metadata,
        wordCount: content.split(/\s+/).length,
        language: 'en', // TODO: Auto-detect
      },
      contentRef,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      retryCount: 0,
      priority: 5,
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .set(artifact);
    
    // Create processing job for AI extraction
    const jobId = await jobQueue.createJob(brandId, artifactId, 'extract-insights');
    
    const response: IngestResponse = {
      success: true,
      artifactId,
      jobId,
      message: `Website crawled successfully (${metadata.pagesCount} page${metadata.pagesCount > 1 ? 's' : ''}, ${metadata.imageCount || 0} image${metadata.imageCount !== 1 ? 's' : ''}). AI extraction queued.`,
    };
    
    console.log('[Brand Soul Website] Success:', { 
      artifactId, 
      jobId, 
      pagesCount: metadata.pagesCount,
      imageCount: metadata.imageCount
    });
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('[Brand Soul Website] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
