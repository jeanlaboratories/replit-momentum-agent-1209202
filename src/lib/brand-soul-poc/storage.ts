// Brand Soul POC - Storage Layer
// Two-tier storage: Firestore for metadata + Firebase Storage for large content
// Uses Firebase Admin SDK for server-side operations

import { getAdminInstances } from '@/lib/firebase/admin';
import { createHash } from 'crypto';

/**
 * Storage interface for large content (text, insights)
 * Uses Firebase Admin Storage as backing store
 */
export class BrandSoulStorage {
  /**
   * Store large text content in Firebase Storage
   * Returns: { path, size, checksum }
   */
  async storeContent(
    brandId: string, 
    artifactId: string, 
    content: string, 
    type: 'content' | 'insights'
  ): Promise<{ path: string; size: number; checksum: string }> {
    const path = `brand-soul/${brandId}/${artifactId}/${type}.txt`;
    const size = content.length;
    const checksum = createHash('md5').update(content).digest('hex');
    
    // Store in Firebase Storage using Admin SDK
    const { adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();
    const file = bucket.file(path);
    
    await file.save(content, {
      metadata: {
        contentType: 'text/plain',
        metadata: {
          checksum,
          createdAt: new Date().toISOString(),
        },
      },
    });
    
    return { path, size, checksum };
  }
  
  /**
   * Retrieve large text content from Firebase Storage
   */
  async getContent(path: string): Promise<string | null> {
    try {
      const { adminStorage } = getAdminInstances();
      const bucket = adminStorage.bucket();
      const file = bucket.file(path);
      
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }
      
      const [content] = await file.download();
      return content.toString('utf-8');
    } catch (error) {
      console.error('Error fetching content:', error);
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
      return true;
    } catch (error) {
      console.error('Error deleting content:', error);
      return false;
    }
  }
}

export const brandSoulStorage = new BrandSoulStorage();
