// Brand Soul - Sync Artifacts to Brand Profile
// Automatically adds processed artifacts (images, videos, documents) to brand profile galleries

import { getAdminInstances } from '@/lib/firebase/admin';
import type { BrandArtifact } from '@/lib/types/brand-soul';
import type { BrandAsset } from '@/lib/types';

/**
 * Sync a processed Brand Soul artifact to the brand profile
 * Adds images, videos, and documents to their respective galleries
 */
export async function syncArtifactToProfile(
  artifact: BrandArtifact
): Promise<boolean> {
  try {
    // Only sync artifacts that have been successfully extracted
    if (artifact.status !== 'extracted' && artifact.status !== 'approved') {
      console.log(`[BrandSoulSync] Skipping artifact ${artifact.id} - status is ${artifact.status}`);
      return false;
    }

    // Only sync image, video, and document artifacts
    const isImage = artifact.type.startsWith('image');
    const isVideo = artifact.type.startsWith('video') || artifact.type === 'youtube-video';
    const isDocument = artifact.type.startsWith('document');

    if (!isImage && !isVideo && !isDocument) {
      console.log(`[BrandSoulSync] Skipping artifact ${artifact.id} - type ${artifact.type} not syncable`);
      return false;
    }

    // Get the artifact's file URL (from documentRef or contentRef)
    let assetUrl: string | null = null;

    if (artifact.documentRef) {
      // Get signed URL for the document (or permanent public URL if configured)
      const { brandSoulStorage } = await import('./storage');
      assetUrl = await brandSoulStorage.getSignedUrl(artifact.documentRef.path, 365 * 24 * 3600); // 1 year
    } else if (artifact.source.url) {
      // For YouTube videos, use the YouTube URL
      assetUrl = artifact.source.url;
    }

    if (!assetUrl) {
      console.error(`[BrandSoulSync] No URL found for artifact ${artifact.id}`);
      return false;
    }

    // Create BrandAsset from artifact
    const brandAsset: BrandAsset = {
      id: artifact.id,
      name: artifact.metadata.title || `Artifact ${artifact.id}`,
      url: assetUrl,
      type: isImage ? 'image' : isVideo ? 'video' : 'document',
    };

    // Update brand profile
    const { adminDb } = getAdminInstances();
    const brandRef = adminDb.collection('brands').doc(artifact.brandId);

    // Use Firestore transaction to safely update the profile
    await adminDb.runTransaction(async (transaction: any) => {
      const brandDoc = await transaction.get(brandRef);

      if (!brandDoc.exists) {
        throw new Error(`Brand ${artifact.brandId} not found`);
      }

      const brandData = brandDoc.data();
      const profile = brandData?.profile || {};

      // Initialize arrays if they don't exist
      profile.images = profile.images || [];
      profile.videos = profile.videos || [];
      profile.documents = profile.documents || [];

      // Determine which array to update
      let targetArray: BrandAsset[];
      let arrayKey: string;

      if (isImage) {
        targetArray = profile.images;
        arrayKey = 'profile.images';
      } else if (isVideo) {
        targetArray = profile.videos;
        arrayKey = 'profile.videos';
      } else {
        targetArray = profile.documents;
        arrayKey = 'profile.documents';
      }

      // Check if asset already exists (prevent duplicates)
      const existingIndex = targetArray.findIndex((asset: BrandAsset) => asset.id === brandAsset.id);

      if (existingIndex >= 0) {
        // Update existing asset
        targetArray[existingIndex] = brandAsset;
        console.log(`[BrandSoulSync] Updated existing ${brandAsset.type} in brand profile: ${brandAsset.name}`);
      } else {
        // Add new asset
        targetArray.push(brandAsset);
        console.log(`[BrandSoulSync] Added new ${brandAsset.type} to brand profile: ${brandAsset.name}`);
      }

      // Update the brand document
      transaction.update(brandRef, {
        [arrayKey]: targetArray,
        updatedAt: new Date().toISOString(),
      });
    });

    // UNIFIED MEDIA SYNC: Add to unifiedMedia collection for Media Library
    if (isImage || isVideo) {
      try {
        // Check if already in unified media
        const existingMedia = await adminDb
          .collection('unifiedMedia')
          .where('brandId', '==', artifact.brandId)
          .where('url', '==', assetUrl)
          .where('sourceArtifactId', '==', artifact.id)
          .limit(1)
          .get();
        
        if (existingMedia.empty) {
          const mediaId = adminDb.collection('unifiedMedia').doc().id;
          const unifiedMediaData = {
            id: mediaId,
            brandId: artifact.brandId,
            type: isImage ? 'image' : 'video',
            url: assetUrl,
            thumbnailUrl: assetUrl,
            title: artifact.metadata.title || `Artifact ${artifact.id}`,
            description: artifact.metadata.description || 'Brand Soul artifact',
            tags: ['brand-soul', artifact.type],
            collections: [],
            source: 'brand-soul',
            sourceArtifactId: artifact.id,
            createdAt: artifact.createdAt,
            createdBy: artifact.createdBy,
          };
          
          await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);
          console.log(`[BrandSoulSync] Added ${isImage ? 'image' : 'video'} to unifiedMedia: ${mediaId}`);
        }
      } catch (syncError: any) {
        console.error(`[BrandSoulSync] Failed to sync to unifiedMedia:`, syncError);
        // Don't fail the profile sync if unified media sync fails
      }
    }

    // AI IMAGE GALLERY SYNC: Add images to the images collection for AI editing
    if (isImage) {
      try {
        // Check if already in images collection
        const existingImage = await adminDb
          .collection('images')
          .where('brandId', '==', artifact.brandId)
          .where('sourceImageUrl', '==', assetUrl)
          .limit(1)
          .get();
        
        if (existingImage.empty) {
          const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          const editedImageData = {
            id: imageId,
            brandId: artifact.brandId,
            title: artifact.metadata.title || `Artifact ${artifact.id}`,
            prompt: '', // Empty prompt for Brand Soul images
            sourceImageUrl: assetUrl, // The extracted image
            generatedImageUrl: '', // No generated version yet
            uploadedBy: artifact.createdBy,
            uploadedAt: artifact.createdAt,
          };
          
          await adminDb.collection('images').doc(imageId).set(editedImageData);
          console.log(`[BrandSoulSync] Added image to AI Image Gallery: ${imageId}`);
        }
      } catch (syncError: any) {
        console.error(`[BrandSoulSync] Failed to sync image to AI Image Gallery:`, syncError);
        // Don't fail the profile sync if AI Image Gallery sync fails
      }
    }

    console.log(`[BrandSoulSync] Successfully synced artifact ${artifact.id} to brand profile`);
    return true;

  } catch (error) {
    console.error(`[BrandSoulSync] Error syncing artifact to profile:`, error);
    return false;
  }
}

/**
 * Remove an artifact from the brand profile when it's deleted
 */
export async function removeArtifactFromProfile(
  brandId: string,
  artifactId: string
): Promise<boolean> {
  try {
    const { adminDb } = getAdminInstances();
    const brandRef = adminDb.collection('brands').doc(brandId);

    await adminDb.runTransaction(async (transaction: any) => {
      const brandDoc = await transaction.get(brandRef);

      if (!brandDoc.exists) {
        throw new Error(`Brand ${brandId} not found`);
      }

      const brandData = brandDoc.data();
      const profile = brandData?.profile || {};

      // Remove from all arrays
      profile.images = (profile.images || []).filter((asset: BrandAsset) => asset.id !== artifactId);
      profile.videos = (profile.videos || []).filter((asset: BrandAsset) => asset.id !== artifactId);
      profile.documents = (profile.documents || []).filter((asset: BrandAsset) => asset.id !== artifactId);

      transaction.update(brandRef, {
        'profile.images': profile.images,
        'profile.videos': profile.videos,
        'profile.documents': profile.documents,
        updatedAt: new Date().toISOString(),
      });
    });

    // UNIFIED MEDIA SYNC: Remove from unifiedMedia collection
    try {
      const unifiedMediaSnapshot = await adminDb
        .collection('unifiedMedia')
        .where('brandId', '==', brandId)
        .where('sourceArtifactId', '==', artifactId)
        .get();
      
      if (!unifiedMediaSnapshot.empty) {
        const batch = adminDb.batch();
        unifiedMediaSnapshot.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`[BrandSoulSync] Removed ${unifiedMediaSnapshot.size} media items from unifiedMedia`);
      }
    } catch (syncError: any) {
      console.error(`[BrandSoulSync] Failed to remove from unifiedMedia:`, syncError);
      // Don't fail the profile removal if unified media removal fails
    }

    // AI IMAGE GALLERY SYNC: Remove images from the images collection
    try {
      // Find images from this artifact by looking for matching sourceImageUrl
      // We need to get the artifact's URL first
      const artifactSnapshot = await adminDb
        .collection('brandSoulArtifacts')
        .where('id', '==', artifactId)
        .where('brandId', '==', brandId)
        .limit(1)
        .get();
      
      if (!artifactSnapshot.empty) {
        const artifact = artifactSnapshot.docs[0].data();
        let assetUrl: string | null = null;
        
        if (artifact.documentRef?.path) {
          const { brandSoulStorage } = await import('./storage');
          assetUrl = await brandSoulStorage.getSignedUrl(artifact.documentRef.path, 1);
        } else if (artifact.source?.url) {
          assetUrl = artifact.source.url;
        }
        
        if (assetUrl) {
          const imagesSnapshot = await adminDb
            .collection('images')
            .where('brandId', '==', brandId)
            .where('sourceImageUrl', '==', assetUrl)
            .get();
          
          if (!imagesSnapshot.empty) {
            const batch = adminDb.batch();
            imagesSnapshot.docs.forEach((doc: any) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`[BrandSoulSync] Removed ${imagesSnapshot.size} images from AI Image Gallery`);
          }
        }
      }
    } catch (syncError: any) {
      console.error(`[BrandSoulSync] Failed to remove from AI Image Gallery:`, syncError);
      // Don't fail the profile removal if AI Image Gallery removal fails
    }

    console.log(`[BrandSoulSync] Removed artifact ${artifactId} from brand profile`);
    return true;

  } catch (error) {
    console.error(`[BrandSoulSync] Error removing artifact from profile:`, error);
    return false;
  }
}
