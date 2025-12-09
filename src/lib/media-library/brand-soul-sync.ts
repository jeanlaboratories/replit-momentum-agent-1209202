// Media Library - Brand Soul Sync Service
// Automatically syncs Brand Soul extracted images to unified media library

import { getAdminInstances } from '@/lib/firebase/admin';
import type { BrandArtifact } from '@/lib/types/brand-soul';
import type { UnifiedMedia } from '@/lib/types/media-library';

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('tracker') || 
      urlLower.includes('analytics') || 
      urlLower.includes('metrics') ||
      urlLower.includes('event=')) {
    return false;
  }
  
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const hasValidExtension = validExtensions.some(ext => urlLower.includes(ext));
  
  const hasImagePath = urlLower.includes('/image') || 
                       urlLower.includes('/img') || 
                       urlLower.includes('/photo') ||
                       urlLower.includes('/picture');
  
  return hasValidExtension || hasImagePath;
}

/**
 * Sync a Brand Soul artifact's images to the unified media library
 */
export async function syncBrandSoulArtifactToMediaLibrary(
  brandId: string,
  artifactId: string,
  userId: string
): Promise<{ success: boolean; mediaIds?: string[]; error?: string }> {
  try {
    const { adminDb } = getAdminInstances();
    
    // Get the artifact
    const artifactDoc = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .get();
    
    if (!artifactDoc.exists) {
      return { success: false, error: 'Artifact not found' };
    }
    
    const artifact = artifactDoc.data() as BrandArtifact;
    
    // Check if artifact has extracted images
    const extractedImages = (artifact.metadata?.extractedImages || []).filter(isValidImageUrl);
    const screenshots = artifact.metadata?.screenshots || [];
    const extractedColors = artifact.metadata?.extractedColors || [];
    
    const allImages = [...extractedImages, ...screenshots];
    
    if (allImages.length === 0) {
      return { success: true, mediaIds: [] };
    }
    
    const mediaIds: string[] = [];
    const batch = adminDb.batch();
    
    for (let i = 0; i < allImages.length; i++) {
      const imageUrl = allImages[i];
      const isScreenshot = i >= extractedImages.length;
      
      // Check if this image is already in the media library
      const existingMedia = await adminDb
        .collection('unifiedMedia')
        .where('brandId', '==', brandId)
        .where('url', '==', imageUrl)
        .where('sourceArtifactId', '==', artifactId)
        .limit(1)
        .get();
      
      if (!existingMedia.empty) {
        console.log(`[Brand Soul Sync] Image already in library: ${imageUrl}`);
        mediaIds.push(existingMedia.docs[0].id);
        continue;
      }
      
      // Create unified media entry
      const mediaRef = adminDb.collection('unifiedMedia').doc();
      
      // Determine artifact display name
      const artifactName = artifact.metadata?.title || 
                          artifact.source?.fileName || 
                          artifact.source?.url || 
                          'Brand Soul Asset';
      
      const mediaData: any = {
        id: mediaRef.id,
        brandId,
        type: 'image',
        url: imageUrl,
        thumbnailUrl: imageUrl,
        title: isScreenshot 
          ? `${artifactName} - Screenshot`
          : `${artifactName} - Image ${i + 1}`,
        description: artifact.type === 'website' 
          ? `Extracted from ${artifact.metadata?.url || artifact.source?.url || artifactName}`
          : `Extracted from ${artifactName}`,
        tags: [
          'brand-soul',
          artifact.type,
          ...(isScreenshot ? ['screenshot'] : ['extracted-image']),
        ],
        collections: [],
        source: 'brand-soul',
        sourceArtifactId: artifactId,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };
      
      if (extractedColors && extractedColors.length > 0 && isScreenshot) {
        mediaData.colors = extractedColors;
      }
      
      batch.set(mediaRef, mediaData);
      mediaIds.push(mediaRef.id);
    }
    
    await batch.commit();
    
    console.log(`[Brand Soul Sync] Synced ${mediaIds.length} images from artifact ${artifactId}`);
    
    return { success: true, mediaIds };
    
  } catch (error) {
    console.error('[Brand Soul Sync] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync artifact',
    };
  }
}

/**
 * Sync all Brand Soul artifacts for a brand to the media library
 */
export async function syncAllBrandSoulArtifacts(
  brandId: string,
  userId: string
): Promise<{ success: boolean; totalSynced?: number; error?: string }> {
  try {
    const { adminDb } = getAdminInstances();
    
    // Get all artifacts with extracted status
    const artifactsSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .where('status', '==', 'extracted')
      .get();
    
    let totalSynced = 0;
    
    for (const artifactDoc of artifactsSnapshot.docs) {
      const result = await syncBrandSoulArtifactToMediaLibrary(
        brandId,
        artifactDoc.id,
        userId
      );
      
      if (result.success && result.mediaIds) {
        totalSynced += result.mediaIds.length;
      }
    }
    
    console.log(`[Brand Soul Sync] Synced ${totalSynced} total images from ${artifactsSnapshot.docs.length} artifacts`);
    
    return { success: true, totalSynced };
    
  } catch (error) {
    console.error('[Brand Soul Sync] Error syncing all artifacts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync artifacts',
    };
  }
}
