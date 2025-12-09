// Brand Soul - Production Storage Layer
// Two-tier storage: Firestore for metadata + Firebase Storage for large content

import { getAdminInstances } from '@/lib/firebase/admin';
import { createHash } from 'crypto';
import type { ContentReference, InsightsReference, ExtractedInsights } from '@/lib/types/brand-soul';

/**
 * Production storage service for Brand Soul content
 * Uses Firebase Admin SDK for server-side operations
 */
export class BrandSoulStorage {
  private readonly basePath = 'brand-soul';
  
  /**
   * Store large text content in Firebase Storage
   * Returns: ContentReference with path, size, checksum
   */
  async storeContent(
    brandId: string,
    artifactId: string,
    content: string,
    contentType: 'source' | 'processed' = 'source'
  ): Promise<ContentReference> {
    const path = `${this.basePath}/${brandId}/artifacts/${artifactId}/${contentType}.txt`;
    const size = Buffer.byteLength(content, 'utf-8');
    const checksum = createHash('md5').update(content).digest('hex');
    
    const { adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();
    const file = bucket.file(path);
    
    await file.save(content, {
      metadata: {
        contentType: 'text/plain; charset=utf-8',
        metadata: {
          checksum,
          brandId,
          artifactId,
          contentType,
        },
      },
    });
    
    return {
      path,
      size,
      checksum,
      storedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Store extracted insights as JSON in Firebase Storage
   * Returns: InsightsReference with path and metadata
   */
  async storeInsights(
    brandId: string,
    artifactId: string,
    insights: ExtractedInsights
  ): Promise<InsightsReference> {
    const path = `${this.basePath}/${brandId}/artifacts/${artifactId}/insights.json`;
    const content = JSON.stringify(insights, null, 2);
    const size = Buffer.byteLength(content, 'utf-8');
    const checksum = createHash('md5').update(content).digest('hex');
    
    const { adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();
    const file = bucket.file(path);
    
    await file.save(content, {
      metadata: {
        contentType: 'application/json',
        metadata: {
          checksum,
          brandId,
          artifactId,
          confidence: insights.confidence.toString(),
          model: insights.model,
        },
      },
    });
    
    return {
      path,
      confidence: insights.confidence,
      extractedAt: insights.extractedAt,
      model: insights.model,
    };
  }
  
  /**
   * Store uploaded document in Firebase Storage
   * Returns: ContentReference
   */
  async storeDocument(
    brandId: string,
    artifactId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<ContentReference> {
    const extension = fileName.split('.').pop() || 'bin';
    const path = `${this.basePath}/${brandId}/artifacts/${artifactId}/original.${extension}`;
    const size = fileBuffer.length;
    const checksum = createHash('md5').update(fileBuffer).digest('hex');
    
    const { adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();
    const file = bucket.file(path);
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          checksum,
          brandId,
          artifactId,
          originalFileName: fileName,
        },
      },
    });
    
    return {
      path,
      size,
      checksum,
      storedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Retrieve text content from Firebase Storage
   */
  async getContent(path: string): Promise<string | null> {
    try {
      const { adminStorage } = getAdminInstances();
      const bucket = adminStorage.bucket();
      const file = bucket.file(path);
      
      const [exists] = await file.exists();
      if (!exists) {
        console.error(`[BrandSoulStorage] Content not found: ${path}`);
        return null;
      }
      
      const [content] = await file.download();
      return content.toString('utf-8');
    } catch (error) {
      console.error('[BrandSoulStorage] Error fetching content:', error);
      return null;
    }
  }
  
  /**
   * Retrieve insights JSON from Firebase Storage
   */
  async getInsights(path: string): Promise<ExtractedInsights | null> {
    const content = await this.getContent(path);
    if (!content) {
      return null;
    }
    
    try {
      return JSON.parse(content) as ExtractedInsights;
    } catch (error) {
      console.error('[BrandSoulStorage] Error parsing insights JSON:', error);
      return null;
    }
  }
  
  /**
   * Retrieve document buffer from Firebase Storage
   */
  async getDocument(path: string): Promise<Buffer | null> {
    try {
      const { adminStorage } = getAdminInstances();
      const bucket = adminStorage.bucket();
      const file = bucket.file(path);
      
      const [exists] = await file.exists();
      if (!exists) {
        console.error(`[BrandSoulStorage] Document not found: ${path}`);
        return null;
      }
      
      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      console.error('[BrandSoulStorage] Error fetching document:', error);
      return null;
    }
  }
  
  /**
   * Delete content from Firebase Storage
   */
  async deleteContent(path: string): Promise<boolean> {
    try {
      const { adminStorage } = getAdminInstances();
      const bucket = adminStorage.bucket();
      const file = bucket.file(path);
      
      await file.delete();
      console.log(`[BrandSoulStorage] Deleted: ${path}`);
      return true;
    } catch (error) {
      console.error('[BrandSoulStorage] Error deleting content:', error);
      return false;
    }
  }
  
  /**
   * Delete all content for an artifact
   */
  async deleteArtifactContent(brandId: string, artifactId: string): Promise<boolean> {
    try {
      const { adminStorage } = getAdminInstances();
      const bucket = adminStorage.bucket();
      const prefix = `${this.basePath}/${brandId}/artifacts/${artifactId}/`;
      
      const [files] = await bucket.getFiles({ prefix });
      
      await Promise.all(files.map((file: any) => file.delete()));
      
      console.log(`[BrandSoulStorage] Deleted ${files.length} files for artifact ${artifactId}`);
      return true;
    } catch (error) {
      console.error('[BrandSoulStorage] Error deleting artifact content:', error);
      return false;
    }
  }
  
  /**
   * Generate a signed URL for direct download (for large files)
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { adminStorage } = getAdminInstances();
      const bucket = adminStorage.bucket();
      const file = bucket.file(path);
      
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });
      
      return url;
    } catch (error) {
      console.error('[BrandSoulStorage] Error generating signed URL:', error);
      return null;
    }
  }
}

export const brandSoulStorage = new BrandSoulStorage();
