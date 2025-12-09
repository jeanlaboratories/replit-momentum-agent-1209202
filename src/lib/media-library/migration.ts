import { getAdminInstances } from '@/lib/firebase/admin';
import type { EditedImage, Video } from '@/lib/types';
import type { BrandArtifact } from '@/lib/types/brand-soul';
import type { UnifiedMedia } from '@/lib/types/media-library';

export async function migrateImagesToUnifiedMedia(brandId: string): Promise<number> {
  const { adminDb } = getAdminInstances();
  
  console.log(`[Migration] Checking images collection for brandId: ${brandId}`);
  
  const imagesSnapshot = await adminDb
    .collection('images')
    .where('brandId', '==', brandId)
    .get();
  
  console.log(`[Migration] Found ${imagesSnapshot.size} images in collection`);
  
  if (imagesSnapshot.empty) {
    console.log('[Migration] No images found to migrate');
    return 0;
  }
  
  const batch = adminDb.batch();
  let count = 0;
  
  for (const doc of imagesSnapshot.docs) {
    const image = doc.data() as EditedImage;
    
    const existingMedia = await adminDb
      .collection('unifiedMedia')
      .where('sourceImageId', '==', image.id)
      .limit(1)
      .get();
    
    if (!existingMedia.empty) {
      continue;
    }
    
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    
    const unifiedMedia: any = {
      id: mediaId,
      brandId: image.brandId,
      type: 'image',
      url: image.generatedImageUrl || image.sourceImageUrl,
      thumbnailUrl: image.generatedImageUrl || image.sourceImageUrl,
      title: image.title,
      description: image.prompt,
      tags: image.generatedImageUrl ? ['ai-generated', 'edited'] : ['upload'],
      collections: [],
      source: image.generatedImageUrl ? 'ai-generated' : 'upload',
      sourceImageId: image.id,
      createdAt: image.generatedAt || image.uploadedAt || new Date().toISOString(),
      createdBy: image.generatedBy || image.uploadedBy || 'system',
    };
    
    if (image.generatedBy) {
      unifiedMedia.generatedBy = image.generatedBy;
    }
    
    if (image.prompt) {
      unifiedMedia.prompt = image.prompt;
    }
    
    if (image.explainability) {
      unifiedMedia.explainability = image.explainability;
    }
    
    batch.set(adminDb.collection('unifiedMedia').doc(mediaId), unifiedMedia);
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`[Migration] Successfully migrated ${count} images`);
  }
  
  return count;
}

export async function migrateVideosToUnifiedMedia(brandId: string): Promise<number> {
  const { adminDb } = getAdminInstances();
  
  console.log(`[Migration] Checking videos collection for brandId: ${brandId}`);
  
  const videosSnapshot = await adminDb
    .collection('videos')
    .where('brandId', '==', brandId)
    .get();
  
  console.log(`[Migration] Found ${videosSnapshot.size} videos in collection`);
  
  if (videosSnapshot.empty) {
    console.log('[Migration] No videos found to migrate');
    return 0;
  }
  
  const batch = adminDb.batch();
  let count = 0;
  
  for (const doc of videosSnapshot.docs) {
    const video = doc.data() as Video;
    
    const existingMedia = await adminDb
      .collection('unifiedMedia')
      .where('sourceVideoId', '==', video.id)
      .limit(1)
      .get();
    
    if (!existingMedia.empty) {
      continue;
    }
    
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    
    const unifiedMedia: any = {
      id: mediaId,
      brandId: video.brandId,
      type: 'video',
      url: video.videoUrl,
      thumbnailUrl: video.videoUrl,
      title: video.title,
      description: video.description,
      tags: video.generatedBy ? ['ai-generated', 'video'] : ['upload', 'video'],
      collections: [],
      source: video.generatedBy ? 'ai-generated' : 'upload',
      sourceVideoId: video.id,
      createdAt: video.generatedAt || video.uploadedAt || new Date().toISOString(),
      createdBy: video.generatedBy || video.uploadedBy || 'system',
    };
    
    if (video.generatedBy) {
      unifiedMedia.generatedBy = video.generatedBy;
    }
    
    if (video.description) {
      unifiedMedia.prompt = video.description;
    }
    
    batch.set(adminDb.collection('unifiedMedia').doc(mediaId), unifiedMedia);
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`[Migration] Successfully migrated ${count} videos`);
  }
  
  return count;
}

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

export async function migrateBrandSoulToUnifiedMedia(brandId: string): Promise<number> {
  const { adminDb } = getAdminInstances();
  
  const artifactsSnapshot = await adminDb
    .collection('brandArtifacts')
    .doc(brandId)
    .collection('sources')
    .where('status', '==', 'extracted')
    .get();
  
  if (artifactsSnapshot.empty) {
    return 0;
  }
  
  const batch = adminDb.batch();
  let count = 0;
  
  for (const doc of artifactsSnapshot.docs) {
    const artifact = doc.data() as BrandArtifact;
    
    const screenshots = artifact.metadata?.screenshot ? [artifact.metadata.screenshot] : [];
    const extractedImages = (artifact.metadata?.extractedImages || []).filter(isValidImageUrl);
    const allImages = [...screenshots, ...extractedImages];
    
    if (allImages.length === 0) {
      continue;
    }
    
    const artifactName = artifact.metadata?.title || 
                        artifact.source?.fileName || 
                        artifact.source?.url || 
                        'Brand Soul Asset';
    
    for (let i = 0; i < allImages.length; i++) {
      const imageUrl = allImages[i];
      const isScreenshot = i < screenshots.length;
      
      const existingMedia = await adminDb
        .collection('unifiedMedia')
        .where('url', '==', imageUrl)
        .limit(1)
        .get();
      
      if (!existingMedia.empty) {
        continue;
      }
      
      const mediaId = adminDb.collection('unifiedMedia').doc().id;
      
      const title = isScreenshot 
        ? `${artifactName} - Screenshot`
        : `${artifactName} - Image ${i - screenshots.length + 1}`;
      
      const tags = [
        'brand-soul',
        artifact.type,
        ...(isScreenshot ? ['screenshot'] : ['extracted-image'])
      ];
      
      const unifiedMedia: any = {
        id: mediaId,
        brandId: brandId,
        type: 'image',
        url: imageUrl,
        thumbnailUrl: imageUrl,
        title,
        description: artifact.metadata?.description || artifactName,
        tags,
        collections: [],
        source: 'brand-soul',
        sourceArtifactId: artifact.id,
        createdAt: artifact.createdAt,
        createdBy: artifact.createdBy,
      };
      
      if (artifact.metadata?.extractedColors && artifact.metadata.extractedColors.length > 0) {
        unifiedMedia.colors = artifact.metadata.extractedColors;
      }
      
      batch.set(adminDb.collection('unifiedMedia').doc(mediaId), unifiedMedia);
      count++;
      
      if (count % 500 === 0) {
        await batch.commit();
      }
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  return count;
}

export async function migrateAllToUnifiedMedia(brandId: string): Promise<{
  images: number;
  videos: number;
  brandSoul: number;
  total: number;
}> {
  const [images, videos, brandSoul] = await Promise.all([
    migrateImagesToUnifiedMedia(brandId),
    migrateVideosToUnifiedMedia(brandId),
    migrateBrandSoulToUnifiedMedia(brandId),
  ]);
  
  return {
    images,
    videos,
    brandSoul,
    total: images + videos + brandSoul,
  };
}
