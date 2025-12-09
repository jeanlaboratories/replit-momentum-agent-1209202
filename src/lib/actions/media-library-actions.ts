// Media Library - Server Actions

'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { syncAllBrandSoulArtifacts } from '@/lib/media-library/brand-soul-sync';
import { migrateAllToUnifiedMedia } from '@/lib/media-library/migration';
import type { UnifiedMedia, MediaCollection } from '@/lib/types/media-library';
import { generateMediaPrompt } from '@/lib/media-prompt-generator';
import { getOrSetCache } from '@/lib/cache-manager';

export async function getMediaByIdAction(mediaId: string, brandId: string): Promise<UnifiedMedia | null> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();

    const doc = await adminDb.collection('unifiedMedia').doc(mediaId).get();

    if (!doc.exists) {
      return null;
    }

    const mediaData = doc.data();
    if (!mediaData) {
      return null;
    }

    // Apply privacy filter
    const isOwner = mediaData.createdBy === authenticatedUser.uid;
    const isPublished = mediaData.isPublished === true;
    if (!isOwner && !isPublished) {
      return null; // Not accessible
    }

    return {
      id: doc.id,
      ...mediaData,
    } as UnifiedMedia;

  } catch (error) {
    console.error('[Get Media By ID] Error:', error);
    return null;
  }
}

export async function getAllMediaAction(brandId: string): Promise<UnifiedMedia[]> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();

    const snapshot = await adminDb
      .collection('unifiedMedia')
      .where('brandId', '==', brandId)
      .get();

    let media = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as UnifiedMedia));

    // Apply privacy filter: PRIVATE by default - only show if published OR created by current user
    media = media.filter((item: any) => {
      const isOwner = item.createdBy === authenticatedUser.uid;
      const isPublished = item.isPublished === true; // Must be explicitly true to show to others
      return isOwner || isPublished;
    });

    media.sort((a: UnifiedMedia, b: UnifiedMedia) => {
      const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt as any).toMillis?.() || 0;
      const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt as any).toMillis?.() || 0;
      return bTime - aTime;
    });

    return media;

  } catch (error) {
    console.error('[Get All Media] Error:', error);
    return [];
  }
}

export async function getMediaPageAction(
  brandId: string,
  cursor?: string,
  limit: number = 50,
  filters?: any
): Promise<{ items: UnifiedMedia[]; nextCursor?: string; hasMore: boolean; error?: string; indexUrl?: string }> {
  const { adminDb } = getAdminInstances();
  const authenticatedUser = await getAuthenticatedUser();
  await requireBrandAccess(authenticatedUser.uid, brandId);

  try {
    let query = adminDb.collection('unifiedMedia').where('brandId', '==', brandId);

    // If no specific publication filter, we need to show (isPublished OR createdBy == user).
    // Since Firestore doesn't support OR, we must use Smart Scan.
    if (filters?.isPublished === undefined) {
      console.warn('[Get Media Page] No publication filter, switching to Smart Scan for privacy enforcement...');
      return await smartScanMedia(brandId, cursor, limit, filters, authenticatedUser.uid);
    } else {
      query = query.where('isPublished', '==', filters.isPublished);
    }

    // Apply filters
    if (filters?.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters?.source) {
      if (filters.source === 'ai-generated') {
        // AI generated content can have multiple source values
        query = query.where('source', 'in', ['ai-generated', 'chatbot', 'imagen', 'veo']);
      } else if (filters.source === 'edited') {
        // Edited content is identified by tag, not just source
        query = query.where('tags', 'array-contains', 'edited');
      } else {
        query = query.where('source', '==', filters.source);
      }
    }
    if (filters?.collections && filters.collections.length > 0) {
      // Conflict check: Cannot use array-contains-any if we already used array-contains for 'edited'
      if (filters.source === 'edited') {
        console.warn('[Get Media Page] Query conflict (multiple array filters), switching to Smart Scan...');
        throw new Error('Query conflict: multiple array filters'); // Force catch block to trigger Smart Scan
      }
      query = query.where('collections', 'array-contains-any', filters.collections);
    }
    if (filters?.tags && filters.tags.length > 0) {
      // Conflict check: Cannot use array-contains-any if we already used array-contains for 'edited'
      if (filters.source === 'edited') {
        console.warn('[Get Media Page] Query conflict (multiple array filters), switching to Smart Scan...');
        throw new Error('Query conflict: multiple array filters'); // Force catch block to trigger Smart Scan
      }
      query = query.where('tags', 'array-contains-any', filters.tags);
    }
    if (filters?.createdBy) {
      query = query.where('createdBy', '==', filters.createdBy);
    }
    if (filters?.dateRange) {
      if (filters.dateRange.start) {
        query = query.where('createdAt', '>=', filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        query = query.where('createdAt', '<=', filters.dateRange.end);
      }
    }

    // Sort by createdAt desc
    query = query.orderBy('createdAt', 'desc');

    // Pagination
    if (cursor) {
      const cursorDoc = await adminDb.collection('unifiedMedia').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as UnifiedMedia));

    const hasMore = items.length === limit;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return { items, nextCursor, hasMore };

  } catch (error: any) {
    console.error('[Get Media Page] Error:', error);

    // Extract index creation URL if present
    const indexUrlRegex = /https:\/\/console\.firebase\.google\.com\/[^\s]+/;
    const match = error.message?.match(indexUrlRegex);
    const indexUrl = match ? match[0] : undefined;

    // Fallback: Smart Scan (No index required)
    // Handle index missing errors (code 9) AND our custom query conflict error
    if (error?.code === 9 || error?.message?.includes('index') || error?.message?.includes('Query conflict')) {
      // Special optimization for Video filter: Fetch from videos collection directly
      if (filters?.type === 'video' && !filters?.source && !filters?.tags && !filters?.collections) {
        console.warn('[Get Media Page] Index missing for videos, fetching from videos collection...');
        return await fetchVideosDirectly(brandId, cursor, limit, authenticatedUser.uid);
      }

      console.warn('[Get Media Page] Index missing or query invalid, switching to Smart Scan...');
      return await smartScanMedia(brandId, cursor, limit, filters, authenticatedUser.uid);
    }

    return { items: [], hasMore: false, error: error.message, indexUrl };
  }
}

/**
 * Smart Scan: Fetches media using the base index (brandId + createdAt) and filters in-memory.
 * This avoids the need for composite indexes for every filter combination.
 */
async function smartScanMedia(
  brandId: string,
  cursor: string | undefined,
  limit: number,
  filters: any,
  currentUserId?: string
): Promise<{ items: UnifiedMedia[]; nextCursor?: string; hasMore: boolean; error?: string }> {
  const { adminDb } = getAdminInstances();
  const SCAN_BATCH_SIZE = 500;
  const MAX_SCAN_ROUNDS = 10; // Increased to 5000 items to catch older media in large libraries

  let items: UnifiedMedia[] = [];
  let currentCursor = cursor;
  let hasMoreToScan = true;
  let rounds = 0;

  while (items.length < limit && hasMoreToScan && rounds < MAX_SCAN_ROUNDS) {
    rounds++;
    let query = adminDb.collection('unifiedMedia')
      .where('brandId', '==', brandId)
      .orderBy('createdAt', 'desc')
      .limit(SCAN_BATCH_SIZE);

    if (currentCursor) {
      const doc = await adminDb.collection('unifiedMedia').doc(currentCursor).get();
      if (doc.exists) {
        query = query.startAfter(doc);
      } else {
        // Cursor invalid/deleted, stop scanning
        hasMoreToScan = false;
        break;
      }
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMoreToScan = false;
      break;
    }

    const batchItems = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as UnifiedMedia));

    // Update cursor for next batch (last scanned item)
    currentCursor = batchItems[batchItems.length - 1].id;

    // Filter batch
    const filteredBatch = batchItems.filter((item: UnifiedMedia) => {
      if (filters?.type && item.type !== filters.type) return false;

      if (filters?.source) {
        if (filters.source === 'ai-generated') {
          if (!['ai-generated', 'chatbot', 'imagen', 'veo'].includes(item.source)) return false;
        } else if (filters.source === 'edited') {
          if (!item.tags?.includes('edited')) return false;
        } else {
          if (item.source !== filters.source) return false;
        }
      }

      if (filters?.isPublished !== undefined) {
        if (item.isPublished !== filters.isPublished) return false;
      } else if (currentUserId) {
        // Default privacy logic: PRIVATE by default - only show if published OR created by current user
        const isOwner = item.createdBy === currentUserId;
        const isPublished = item.isPublished === true; // Must be explicitly true to show to others
        if (!isOwner && !isPublished) return false;
      } else {
        // No user context - only show explicitly published content
        if (item.isPublished !== true) return false;
      }

      if (filters?.collections && filters.collections.length > 0) {
        if (!item.collections?.some((c: string) => filters.collections.includes(c))) return false;
      }

      if (filters?.tags && filters.tags.length > 0) {
        if (!item.tags?.some((t: string) => filters.tags.includes(t))) return false;
      }

      if (filters?.createdBy) {
        if (item.createdBy !== filters.createdBy) return false;
      }

      if (filters?.dateRange) {
        const itemDate = typeof item.createdAt === 'string' ? new Date(item.createdAt).getTime() : (item.createdAt as any).toMillis?.() || 0;
        if (filters.dateRange.start && itemDate < new Date(filters.dateRange.start).getTime()) return false;
        if (filters.dateRange.end && itemDate > new Date(filters.dateRange.end).getTime()) return false;
      }

      return true;
    });

    items = [...items, ...filteredBatch];

    // If we fetched fewer than batch size, we hit the end
    if (snapshot.size < SCAN_BATCH_SIZE) {
      hasMoreToScan = false;
    }
  }

  // Return what we found (up to limit)
  // IMPORTANT: nextCursor must be the LAST SCANNED item (currentCursor), 
  // so the next page continues scanning from where we left off, not where we stopped matching.
  const returnItems = items.slice(0, limit);

  return {
    items: returnItems,
    nextCursor: hasMoreToScan ? currentCursor : undefined,
    hasMore: hasMoreToScan,
  };
}

/**
 * Direct Video Fetch: Fetches from the 'videos' collection which is much smaller than unifiedMedia.
 * Used as a fallback when filtering by type='video' to ensure all videos are found.
 */
async function fetchVideosDirectly(
  brandId: string,
  cursor: string | undefined,
  limit: number,
  currentUserId?: string
): Promise<{ items: UnifiedMedia[]; nextCursor?: string; hasMore: boolean; error?: string }> {
  const { adminDb } = getAdminInstances();

  try {
    // Fetch ALL videos for the brand (usually < 1000)
    // We can't easily paginate this without an index if we want to sort by createdAt
    // But since the collection is small, we can fetch all and sort in memory
    const snapshot = await adminDb.collection('videos').where('brandId', '==', brandId).get();

    let videos = snapshot.docs.map((doc: any) => {
      const video = doc.data();
      return {
        id: doc.id, // Use video ID as media ID for consistency in this fallback view
        brandId: video.brandId,
        type: 'video' as const,
        url: video.videoUrl,
        thumbnailUrl: video.videoUrl,
        title: video.title,
        description: video.description,
        tags: ['video', ...(video.generatedBy ? ['ai-generated'] : ['upload'])],
        collections: [],
        source: video.generatedBy ? 'ai-generated' : 'upload',
        sourceVideoId: video.id,
        createdAt: video.generatedAt || video.uploadedAt || new Date().toISOString(),
        createdBy: video.generatedBy || video.uploadedBy || 'system',
        isPublished: video.isPublished,
      } as UnifiedMedia;
    });

    // Apply privacy filter: PRIVATE by default - only show if published OR created by current user
    if (currentUserId) {
      videos = videos.filter((video: any) => {
        const isOwner = video.createdBy === currentUserId;
        const isPublished = video.isPublished === true; // Must be explicitly true to show to others
        return isOwner || isPublished;
      });
    } else {
      // No user context - only show explicitly published content
      videos = videos.filter((video: any) => video.isPublished === true);
    }

    // Sort by createdAt desc
    videos.sort((a: UnifiedMedia, b: UnifiedMedia) => {
      const getDate = (d: any) => {
        if (!d) return 0;
        if (typeof d === 'string') return new Date(d).getTime();
        if (typeof d.toMillis === 'function') return d.toMillis();
        if (d instanceof Date) return d.getTime();
        return 0;
      };
      return getDate(b.createdAt) - getDate(a.createdAt);
    });

    // Paginate in memory
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = videos.findIndex((v: UnifiedMedia) => v.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const items = videos.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < videos.length;
    const nextCursor = items.length > 0 ? items[items.length - 1].id : undefined;

    return { items, nextCursor, hasMore };
  } catch (error: any) {
    console.error('[Fetch Videos Directly] Error:', error);
    return { items: [], hasMore: false, error: error.message };
  }
}

export async function getMediaStatsAction(brandId: string): Promise<{
  total: number;
  images: number;
  videos: number;
  brandSoul: number;
  aiGenerated: number;
  uploads: number;
}> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    const collectionRef = adminDb.collection('unifiedMedia');

    // Parallelize count queries
    const [totalSnap, imagesSnap, videosSnap, brandSoulSnap, aiSnap, uploadsSnap] = await Promise.all([
      collectionRef.where('brandId', '==', brandId).count().get(),
      collectionRef.where('brandId', '==', brandId).where('type', '==', 'image').count().get(),
      collectionRef.where('brandId', '==', brandId).where('type', '==', 'video').count().get(),
      collectionRef.where('brandId', '==', brandId).where('source', '==', 'brand-soul').count().get(),
      collectionRef.where('brandId', '==', brandId).where('source', 'in', ['ai-generated', 'chatbot', 'imagen', 'veo']).count().get(),
      collectionRef.where('brandId', '==', brandId).where('source', '==', 'upload').count().get(),
    ]);

    return {
      total: totalSnap.data().count,
      images: imagesSnap.data().count,
      videos: videosSnap.data().count,
      brandSoul: brandSoulSnap.data().count,
      aiGenerated: aiSnap.data().count,
      uploads: uploadsSnap.data().count,
    };

  } catch (error) {
    console.error('[Get Media Stats] Error:', error);
    return { total: 0, images: 0, videos: 0, brandSoul: 0, aiGenerated: 0, uploads: 0 };
  }
}

export async function getMediaCollectionsAction(brandId: string): Promise<MediaCollection[]> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const snapshot = await adminDb
      .collection('mediaCollections')
      .where('brandId', '==', brandId)
      .get();

    const collections = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as MediaCollection));

    collections.sort((a: MediaCollection, b: MediaCollection) => a.name.localeCompare(b.name));

    return collections;

  } catch (error) {
    console.error('[Get Media Collections] Error:', error);
    return [];
  }
}

export async function createCollectionAction(
  brandId: string,
  name: string,
  description?: string
): Promise<{ success: boolean; collectionId?: string; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const collectionRef = adminDb.collection('mediaCollections').doc();
    const collectionData: MediaCollection = {
      id: collectionRef.id,
      brandId,
      name,
      description,
      createdAt: new Date().toISOString(),
      createdBy: authenticatedUser.uid,
      mediaCount: 0,
    };

    await collectionRef.set(collectionData);

    return { success: true, collectionId: collectionRef.id };

  } catch (error) {
    console.error('[Create Collection] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create collection',
    };
  }
}

export async function deleteMediaAction(
  brandId: string,
  mediaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb, adminStorage } = getAdminInstances();
    
    const mediaDoc = await adminDb.collection('unifiedMedia').doc(mediaId).get();
    const mediaData = mediaDoc.data();
    
    if (mediaData?.url) {
      try {
        const bucket = adminStorage.bucket();
        const urlPath = decodeURIComponent(mediaData.url.split('/o/')[1]?.split('?')[0] || '');
        if (urlPath) {
          await bucket.file(urlPath).delete().catch(() => {});
        }
      } catch (storageError) {
        console.warn('[Delete Media] Storage deletion failed (non-fatal):', storageError);
      }
    }
    

    // Cleanup legacy collections
    if (mediaData?.type === 'video') {
      const videoId = mediaData.sourceVideoId || mediaId;
      await adminDb.collection('videos').doc(videoId).delete().catch(() => { });
    } else if (mediaData?.type === 'image') {
      const imageId = mediaData.sourceImageId || mediaId;
      await adminDb.collection('images').doc(imageId).delete().catch(() => { });
    }

    await adminDb.collection('unifiedMedia').doc(mediaId).delete();

    return { success: true };

  } catch (error) {
    console.error('[Delete Media] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete media',
    };
  }
}

export async function bulkDeleteMediaAction(
  brandId: string,
  mediaIds: string[]
): Promise<{ success: boolean; deleted: number; failed: number; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb, adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();
    
    let deleted = 0;
    let failed = 0;

    for (const mediaId of mediaIds) {
      try {
        const mediaDoc = await adminDb.collection('unifiedMedia').doc(mediaId).get();
        
        if (!mediaDoc.exists) {
          failed++;
          continue;
        }

        const mediaData = mediaDoc.data();
        
        if (mediaData?.brandId !== brandId) {
          failed++;
          continue;
        }
        
        if (mediaData?.url) {
          try {
            const urlPath = decodeURIComponent(mediaData.url.split('/o/')[1]?.split('?')[0] || '');
            if (urlPath) {
              await bucket.file(urlPath).delete().catch(() => {});
            }
          } catch (storageError) {
            console.warn(`[Bulk Delete] Storage deletion failed for ${mediaId} (non-fatal):`, storageError);
          }
        }
        

        // Cleanup legacy collections
        if (mediaData?.type === 'video') {
          await adminDb.collection('videos').doc(mediaId).delete().catch(() => { });
        } else if (mediaData?.type === 'image') {
          await adminDb.collection('images').doc(mediaId).delete().catch(() => { });
        }

        await adminDb.collection('unifiedMedia').doc(mediaId).delete();
        deleted++;
        
      } catch (error) {
        console.error(`[Bulk Delete] Failed to delete ${mediaId}:`, error);
        failed++;
      }
    }

    return { 
      success: true, 
      deleted,
      failed,
    };

  } catch (error) {
    console.error('[Bulk Delete Media] Error:', error);
    return {
      success: false,
      deleted: 0,
      failed: mediaIds.length,
      error: error instanceof Error ? error.message : 'Failed to delete media',
    };
  }
}

export async function bulkMediaAction(
  brandId: string,
  mediaIds: string[],
  action: 'add-tags' | 'remove-tags' | 'add-to-collection' | 'remove-from-collection' | 'delete' | 'publish' | 'unpublish',
  payload?: { tags?: string[]; collectionId?: string }
): Promise<{ success: boolean; modified: number; failed: number; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();

    if (action === 'delete') {
      const result = await bulkDeleteMediaAction(brandId, mediaIds);
      return {
        success: result.success,
        modified: result.deleted,
        failed: result.failed,
        error: result.error,
      };
    }

    let modified = 0;
    let failed = 0;
    const batchSize = 500;
    const chunks = [];

    for (let i = 0; i < mediaIds.length; i += batchSize) {
      chunks.push(mediaIds.slice(i, i + batchSize));
    }

    // PERFORMANCE OPTIMIZATION: Process batches in parallel (max 3 concurrent)
    const MAX_CONCURRENT_BATCHES = 3;
    const batchPromises: Promise<number>[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const batchPromise = (async () => {
        const batch = adminDb.batch();
        let batchCount = 0;

        for (const mediaId of chunk) {
          const docRef = adminDb.collection('unifiedMedia').doc(mediaId);

          try {
            if (action === 'add-tags' && payload?.tags) {
              batch.update(docRef, {
                tags: require('firebase-admin').firestore.FieldValue.arrayUnion(...(payload.tags || [])),
                updatedAt: new Date().toISOString(),
                auditTrail: require('firebase-admin').firestore.FieldValue.arrayUnion({
                  userId: authenticatedUser.uid,
                  action: 'tagged',
                  timestamp: new Date().toISOString(),
                  details: `Added tags: ${payload.tags?.join(', ')}`
                })
              });
              batchCount++;
            } else if (action === 'remove-tags' && payload?.tags) {
              batch.update(docRef, {
                tags: require('firebase-admin').firestore.FieldValue.arrayRemove(...(payload.tags || [])),
                updatedAt: new Date().toISOString(),
                auditTrail: require('firebase-admin').firestore.FieldValue.arrayUnion({
                  userId: authenticatedUser.uid,
                  action: 'edited',
                  timestamp: new Date().toISOString(),
                  details: `Removed tags: ${payload.tags?.join(', ')}`
                })
              });
              batchCount++;
            } else if (action === 'add-to-collection' && payload?.collectionId) {
              batch.update(docRef, {
                collections: require('firebase-admin').firestore.FieldValue.arrayUnion(payload.collectionId),
                updatedAt: new Date().toISOString(),
                auditTrail: require('firebase-admin').firestore.FieldValue.arrayUnion({
                  userId: authenticatedUser.uid,
                  action: 'collected',
                  timestamp: new Date().toISOString(),
                  details: `Added to collection: ${payload.collectionId}`
                })
              });
              batchCount++;
            } else if (action === 'remove-from-collection' && payload?.collectionId) {
              batch.update(docRef, {
                collections: require('firebase-admin').firestore.FieldValue.arrayRemove(payload.collectionId),
                updatedAt: new Date().toISOString(),
                auditTrail: require('firebase-admin').firestore.FieldValue.arrayUnion({
                  userId: authenticatedUser.uid,
                  action: 'edited',
                  timestamp: new Date().toISOString(),
                  details: `Removed from collection: ${payload.collectionId}`
                })
              });
              batchCount++;
            } else if (action === 'publish') {
              batch.update(docRef, {
                isPublished: true,
                updatedAt: new Date().toISOString(),
                auditTrail: require('firebase-admin').firestore.FieldValue.arrayUnion({
                  userId: authenticatedUser.uid,
                  action: 'published',
                  timestamp: new Date().toISOString()
                })
              });
              batchCount++;
            } else if (action === 'unpublish') {
              batch.update(docRef, {
                isPublished: false,
                updatedAt: new Date().toISOString(),
                auditTrail: require('firebase-admin').firestore.FieldValue.arrayUnion({
                  userId: authenticatedUser.uid,
                  action: 'unpublished',
                  timestamp: new Date().toISOString()
                })
              });
              batchCount++;
            }
          } catch (e) {
            console.error(`[Bulk Action] Failed to prepare update for ${mediaId}:`, e);
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          return batchCount;
        }
        return 0;
      })();

      batchPromises.push(batchPromise);

      // Process in waves of MAX_CONCURRENT_BATCHES
      if (batchPromises.length >= MAX_CONCURRENT_BATCHES || i === chunks.length - 1) {
        const results = await Promise.allSettled(batchPromises);
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            modified += result.value;
          } else {
            console.error('[Bulk Action] Batch failed:', result.reason);
            failed += batchSize; // Approximate - count the whole batch as failed
          }
        });
        batchPromises.length = 0; // Clear array
      }
    }

    // If adding to collection, update collection count
    if (action === 'add-to-collection' && payload?.collectionId && modified > 0) {
      await adminDb.collection('mediaCollections').doc(payload.collectionId).update({
        mediaCount: require('firebase-admin').firestore.FieldValue.increment(modified),
        updatedAt: new Date().toISOString(),
      });
    }

    // If removing from collection, update collection count
    if (action === 'remove-from-collection' && payload?.collectionId && modified > 0) {
      await adminDb.collection('mediaCollections').doc(payload.collectionId).update({
        mediaCount: require('firebase-admin').firestore.FieldValue.increment(-modified),
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true, modified, failed };

  } catch (error) {
    console.error('[Bulk Media Action] Error:', error);
    return {
      success: false,
      modified: 0,
      failed: mediaIds.length,
      error: error instanceof Error ? error.message : 'Failed to perform bulk action',
    };
  }
}

export async function updateMediaAction(
  brandId: string,
  mediaId: string,
  updates: { title?: string; description?: string; tags?: string[]; collections?: string[] }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    await adminDb.collection('unifiedMedia').doc(mediaId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };

  } catch (error) {
    console.error('[Update Media] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update media',
    };
  }
}

export async function syncBrandSoulAction(
  brandId: string
): Promise<{ success: boolean; totalSynced?: number; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const result = await syncAllBrandSoulArtifacts(brandId, authenticatedUser.uid);
    
    return result;

  } catch (error) {
    console.error('[Sync Brand Soul] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync Brand Soul',
    };
  }
}

export async function migrateExistingMediaAction(
  brandId: string
): Promise<{ success: boolean; migrated?: { images: number; videos: number; brandSoul: number; total: number }; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const result = await migrateAllToUnifiedMedia(brandId);
    
    // Index the migrated media for search
    if (result.total > 0) {
      try {
        // Fetch all media to index
        const { adminDb } = getAdminInstances();
        const snapshot = await adminDb.collection('unifiedMedia').where('brandId', '==', brandId).limit(100).get();
        const mediaItems = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        
        if (mediaItems.length > 0) {
          const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
          
          const indexResponse = await fetch(`${pythonServiceUrl}/media/index`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              brand_id: brandId,
              media_items: mediaItems,
            }),
          });

          if (!indexResponse.ok) {
            console.warn('[Migrate Media] Search indexing failed:', await indexResponse.text());
          } else {
            console.log(`[Migrate Media] ${mediaItems.length} items indexed for search successfully`);
          }
        }
      } catch (indexError) {
        console.warn('[Migrate Media] Search indexing error:', indexError);
        // Don't fail the migration if indexing fails
      }
    }
    
    return { success: true, migrated: result };

  } catch (error) {
    console.error('[Migrate Media] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to migrate media',
    };
  }
}

export async function uploadMediaAction(
  brandId: string,
  fileData: {
    name: string;
    type: string;
    size: number;
    base64Data: string;
  }
): Promise<{ success: boolean; media?: UnifiedMedia; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb, adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();

    // Determine media type
    const isVideo = fileData.type.startsWith('video/');
    const isImage = fileData.type.startsWith('image/');

    if (!isVideo && !isImage) {
      return { success: false, error: 'Unsupported file type. Only images and videos are allowed.' };
    }

    const mediaType = isVideo ? 'video' : 'image';
    const extension = fileData.name.split('.').pop() || (isVideo ? 'mp4' : 'png');
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${extension}`;
    const storagePath = `uploads/${brandId}/${mediaType}s/${filename}`;

    // Upload to Storage
    const buffer = Buffer.from(fileData.base64Data, 'base64');
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      metadata: {
        contentType: fileData.type,
      },
    });

    // Make public or signed URL (using signed URL for consistency with other parts)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2500', // Long expiry
    });

    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const now = new Date().toISOString();

    // Generate AI prompt for the uploaded media
    let generatedPrompt = '';
    try {
      generatedPrompt = await generateMediaPrompt(signedUrl, mediaType);
    } catch (e) {
      console.warn('[Upload Media] Failed to generate prompt:', e);
    }

    const mediaData: UnifiedMedia = {
      id: mediaId,
      brandId,
      type: mediaType,
      url: signedUrl,
      thumbnailUrl: signedUrl, // For videos, we might want to generate a thumbnail later, but using video URL works for <video> tags
      title: fileData.name,
      description: generatedPrompt || '',
      tags: ['upload', mediaType],
      collections: [],
      source: 'upload',
      createdAt: now,
      createdBy: authenticatedUser.uid,
      isPublished: false,
      auditTrail: [{
        userId: authenticatedUser.uid,
        action: 'created',
        timestamp: now,
        details: 'Uploaded'
      }],
      // updatedAt: now, // Removed as it might not be in UnifiedMedia type yet
      /* metadata: {
        size: fileData.size,
        mimeType: fileData.type,
        originalName: fileData.name,
      }, */
    };

    // If it's a video, also add to 'videos' collection for consistency with other video flows
    if (isVideo) {
      await adminDb.collection('videos').doc(mediaId).set({
        id: mediaId,
        brandId,
        videoUrl: signedUrl,
        title: fileData.name,
        description: '',
        uploadedBy: authenticatedUser.uid,
        uploadedAt: now,
        source: 'upload',
      });
      mediaData.sourceVideoId = mediaId;
    }

    // If it's an image, also add to 'images' collection for consistency with Image Editor
    if (isImage) {
      await adminDb.collection('images').doc(mediaId).set({
        id: mediaId,
        brandId,
        title: fileData.name,
        prompt: generatedPrompt || '', // Use generated prompt if available
        sourceImageUrl: signedUrl,
        generatedImageUrl: '', // Uploads are source images
        uploadedBy: authenticatedUser.uid,
        uploadedAt: now,
      });
      mediaData.sourceImageId = mediaId;
    }

    await adminDb.collection('unifiedMedia').doc(mediaId).set(mediaData);

    // Index the media for search
    try {
      const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
      
      const indexResponse = await fetch(`${pythonServiceUrl}/media/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand_id: brandId,
          media_items: [mediaData],
        }),
      });

      if (!indexResponse.ok) {
        console.warn('[Upload Media] Search indexing failed:', await indexResponse.text());
      } else {
        console.log('[Upload Media] Media indexed for search successfully');
      }
    } catch (indexError) {
      console.warn('[Upload Media] Search indexing error:', indexError);
      // Don't fail the upload if indexing fails
    }

    return { success: true, media: mediaData };

  } catch (error) {
    console.error('[Upload Media] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload media',
    };
  }
}

// ============================================================================
// Vertex AI Search Integration
// ============================================================================

export interface MediaSearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  source: string;
  tags: string[];
  relevanceScore: number;
  // Vision analysis fields
  visionDescription?: string;
  visionKeywords?: string[];
  visionCategories?: string[];
  enhancedSearchText?: string;
}

export interface SemanticSearchResponse {
  results: MediaSearchResult[];
  totalCount: number;
  query: string;
  searchTimeMs: number;
  error?: string;
}

/**
 * Perform semantic search on media library using Vertex AI Search.
 * This enables natural language queries like "blue background images" or "product demo videos".
 */
export async function semanticSearchMediaAction(
  brandId: string,
  query: string,
  options?: {
    mediaType?: 'image' | 'video';
    source?: string;
    collections?: string[];
    tags?: string[];
    limit?: number;
  }
): Promise<SemanticSearchResponse> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    // Create cache key from search parameters
    const cacheKey = `media-search:${brandId}:${query.toLowerCase().trim()}:${options?.mediaType || 'all'}:${options?.source || 'all'}:${options?.limit || 20}`;
    
    // Cache search results for 30 seconds (short TTL for real-time feel)
    return await getOrSetCache(
      cacheKey,
      async () => {
        // Call Python service for Vertex AI Search
        const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

        // Build request body, only including defined fields (not undefined/null)
        const requestBody: any = {
          brand_id: brandId,
          query: query,
          limit: options?.limit || 20,
        };
        if (options?.mediaType) {
          requestBody.media_type = options.mediaType;
        }
        if (options?.source) {
          requestBody.source = options.source;
        }
        if (options?.collections && options.collections.length > 0) {
          requestBody.collections = options.collections;
        }
        if (options?.tags && options.tags.length > 0) {
          requestBody.tags = options.tags;
        }

        const response = await fetch(`${pythonServiceUrl}/media/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Semantic Search] API error:', errorText);

          // Fall back to Firestore text search (no caching for fallback to ensure fresh results)
          return await fallbackTextSearch(brandId, query, options);
        }

        const data = await response.json();
        
        // Debug: Log vision analysis data from search response
        if (data.results && data.results.length > 0) {
          const firstResult = data.results[0];
          if (firstResult.visionDescription || firstResult.visionKeywords?.length) {
            console.log('[Semantic Search Response] Vision analysis found in response:', {
              totalResults: data.results.length,
              firstResult: {
                id: firstResult.id,
                hasVisionDescription: !!firstResult.visionDescription,
                visionDescription: firstResult.visionDescription,
                hasVisionKeywords: !!firstResult.visionKeywords?.length,
                visionKeywords: firstResult.visionKeywords,
              }
            });
          } else {
            console.log('[Semantic Search Response] No vision analysis in first result:', {
              id: firstResult.id,
              availableKeys: Object.keys(firstResult),
            });
          }
        }

        return {
          results: data.results || [],
          totalCount: data.total_count || 0,
          query: data.query || query,
          searchTimeMs: data.search_time_ms || 0,
        };
      },
      30 * 1000 // 30 second cache TTL
    );
  } catch (error) {
    console.error('[Semantic Search] Error:', error);

    // Fall back to Firestore text search on error
    return await fallbackTextSearch(brandId, query, options);
  }
}

export async function indexAllMediaAction(
  brandId: string
): Promise<{ success: boolean; indexed?: number; error?: string; errors?: string[] }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    // Use the same endpoint as the Team tool - this ensures data store creation
    // and uses the exact same logic
    const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
    
    const indexResponse = await fetch(`${pythonServiceUrl}/agent/media-index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_id: brandId,
        index_all: true, // This will fetch all media and index them, creating data store if needed
      }),
    });

    if (!indexResponse.ok) {
      const errorText = await indexResponse.text();
      console.error(`[Index All Media] Failed: ${indexResponse.status} ${errorText}`);
      return {
        success: false,
        error: `Failed to index media: ${errorText}`,
      };
    }

    const result = await indexResponse.json();

    // Check the actual result status (not just HTTP status)
    if (result.status === 'success') {
      return {
        success: true,
        indexed: result.indexed_count || 0,
        errors: result.errors || undefined,
      };
    } else {
      // Handle error response
      const errorMessage = result.message || 'Failed to index media';
      return {
        success: false,
        error: errorMessage,
        errors: result.errors || undefined,
      };
    }

  } catch (error) {
    console.error('[Index All Media] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to index media',
    };
  }
}

/**
 * Trigger vision analysis on media items to enhance search capabilities.
 */
export async function analyzeMediaVisionAction(
  brandId: string,
  options?: {
    mediaIds?: string[];
    analyzeAll?: boolean;
  }
): Promise<{ success: boolean; analyzed?: number; total?: number; error?: string; errors?: string[] }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);
    
    const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
    
    const requestBody = {
      brand_id: brandId,
      analyze_all: options?.analyzeAll || false,
      media_ids: options?.mediaIds || [],
    };
    
    const response = await fetch(`${pythonServiceUrl}/media/analyze-vision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Vision Analysis] Failed: ${response.status} ${errorText}`);
      return {
        success: false,
        error: `Failed to analyze media: ${errorText}`,
      };
    }
    
    const result = await response.json();
    
    if (result.status === 'success') {
      return {
        success: true,
        analyzed: result.analyzed_count || 0,
        total: result.total_items || 0,
        errors: result.errors || undefined,
      };
    } else {
      return {
        success: false,
        error: result.message || 'Failed to analyze media',
        errors: result.errors || undefined,
      };
    }
  } catch (error) {
    console.error('[Vision Analysis] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze media',
    };
  }
}

/**
 * Get singular form of a word for search matching.
 */
function getSingular(word: string): string {
  const lower = word.toLowerCase();
  
  // Irregular singulars
  const irregularSingulars: Record<string, string> = {
    'children': 'child',
    'people': 'person',
    'men': 'man',
    'women': 'woman',
    'feet': 'foot',
    'teeth': 'tooth',
    'mice': 'mouse',
    'geese': 'goose',
    'analyses': 'analysis',
    'criteria': 'criterion',
    'data': 'datum',
    'media': 'medium',
  };
  
  if (irregularSingulars[lower]) {
    return irregularSingulars[lower];
  }
  
  // Regular singularization rules
  if (lower.endsWith('ies') && lower.length > 3) {
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('ves') && lower.length > 3) {
    return lower.slice(0, -3) + 'f';
  }
  if (lower.endsWith('es') && lower.length > 2 && ['s', 'x', 'z', 'ch', 'sh'].includes(lower[lower.length - 3])) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith('s') && lower.length > 1) {
    return lower.slice(0, -1);
  }
  
  return lower;
}

/**
 * Get plural form of a word for search matching.
 */
function getPlural(word: string): string {
  const lower = word.toLowerCase();
  
  // Irregular plurals
  const irregularPlurals: Record<string, string> = {
    'child': 'children',
    'person': 'people',
    'man': 'men',
    'woman': 'women',
    'foot': 'feet',
    'tooth': 'teeth',
    'mouse': 'mice',
    'goose': 'geese',
    'analysis': 'analyses',
    'criterion': 'criteria',
    'datum': 'data',
    'medium': 'media',
  };
  
  if (irregularPlurals[lower]) {
    return irregularPlurals[lower];
  }
  
  // Regular pluralization rules
  if (lower.endsWith('y') && lower.length > 1 && !'aeiou'.includes(lower[lower.length - 2])) {
    return lower.slice(0, -1) + 'ies';
  }
  if (lower.endsWith('f')) {
    return lower.slice(0, -1) + 'ves';
  }
  if (lower.endsWith('fe')) {
    return lower.slice(0, -2) + 'ves';
  }
  if (['s', 'x', 'z', 'ch', 'sh'].some(suffix => lower.endsWith(suffix))) {
    return lower + 'es';
  }
  
  return lower + 's';
}

/**
 * Get word variants (singular, plural) for search matching.
 */
function getWordVariants(word: string): Set<string> {
  const variants = new Set<string>();
  const lower = word.toLowerCase();
  variants.add(lower);
  
  const singular = getSingular(lower);
  const plural = getPlural(lower);
  
  variants.add(singular);
  variants.add(plural);
  
  // Also add variants of the singular and plural
  if (singular !== lower) {
    variants.add(getPlural(singular));
  }
  if (plural !== lower) {
    variants.add(getSingular(plural));
  }
  
  return variants;
}

// Cache for pre-computed word variants to avoid repeated calculations
const wordVariantsCache = new Map<string, Set<string>>();

/**
 * Get word variants with caching for performance.
 */
function getCachedWordVariants(word: string): Set<string> {
  const cacheKey = word.toLowerCase();
  if (wordVariantsCache.has(cacheKey)) {
    return wordVariantsCache.get(cacheKey)!;
  }
  
  const variants = getWordVariants(word);
  wordVariantsCache.set(cacheKey, variants);
  
  // Limit cache size to prevent memory issues (keep last 1000)
  if (wordVariantsCache.size > 1000) {
    const firstKey = wordVariantsCache.keys().next().value;
    if (firstKey !== undefined) {
      wordVariantsCache.delete(firstKey);
    }
  }
  
  return variants;
}

/**
 * Check if query word matches text considering plural/singular variants.
 * Optimized with cached variants and early exit.
 */
function wordMatches(queryWord: string, searchableText: string): boolean {
  const queryLower = queryWord.toLowerCase();
  const searchLower = searchableText.toLowerCase();
  
  // Check exact match first (fastest path)
  if (searchLower.includes(queryLower)) {
    return true;
  }
  
  // Get cached variants and check if any variant matches
  const variants = getCachedWordVariants(queryWord);
  for (const variant of variants) {
    if (variant !== queryLower && searchLower.includes(variant)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Fallback text search using Firestore when Vertex AI Search is unavailable.
 * Performs intelligent matching with plural/singular handling on title and description.
 */
async function fallbackTextSearch(
  brandId: string,
  query: string,
  options?: {
    mediaType?: 'image' | 'video';
    source?: string;
    collections?: string[];
    tags?: string[];
    limit?: number;
  }
): Promise<SemanticSearchResponse> {
  const startTime = Date.now();

  try {
    const { adminDb } = getAdminInstances();

    // Fetch a batch of media and filter client-side
    // Optimized: fetch only what we need + small buffer (limit + 20 for filtering)
    const fetchLimit = Math.min((options?.limit || 20) + 20, 100); // Max 100 docs
    let firestoreQuery = adminDb.collection('unifiedMedia')
      .where('brandId', '==', brandId)
      .limit(fetchLimit);

    if (options?.mediaType) {
      firestoreQuery = adminDb.collection('unifiedMedia')
        .where('brandId', '==', brandId)
        .where('type', '==', options.mediaType)
        .limit(fetchLimit);
    }

    const snapshot = await firestoreQuery.get();
    const queryLower = query.toLowerCase();
    const limit = options?.limit || 20;

    // Sort by createdAt in memory (since we removed orderBy to avoid index requirement)
    const docs = snapshot.docs.sort((a: any, b: any) => {
      const timeA = a.data().createdAt?.toMillis?.() || 0;
      const timeB = b.data().createdAt?.toMillis?.() || 0;
      return timeB - timeA; // Descending order
    });

    const filteredResults: MediaSearchResult[] = [];

    // Pre-compute query word variants once for all documents
    const queryWords = queryLower.trim().split(/\s+/).filter(w => w.length > 0);
    const queryWordVariants = queryWords.map(word => ({
      original: word,
      variants: getCachedWordVariants(word),
    }));

    for (const doc of docs) {
      // Early exit when we have enough results
      if (filteredResults.length >= limit) break;

      const data = doc.data();

      // Text matching on title, description, tags, prompt, and vision analysis
      const searchableText = [
        data.title || '',
        data.description || '',
        data.prompt || '',
        ...(data.tags || []),
        // Enhanced search with vision analysis data
        data.visionDescription || '',
        ...(data.visionKeywords || []),
        ...(data.visionCategories || []),
        data.enhancedSearchText || '',
      ].join(' ').toLowerCase();

      // Improved multi-word query matching with plural/singular handling
      // Use pre-computed variants for faster matching
      if (queryWordVariants.length > 0) {
        // For multi-word queries, require all words to match (including plural/singular variants)
        const allWordsMatch = queryWordVariants.every(({ original, variants }) => {
          // Fast path: check exact match first
          if (searchableText.includes(original)) return true;
          
          // Check variants
          for (const variant of variants) {
            if (variant !== original && searchableText.includes(variant)) {
              return true;
            }
          }
          return false;
        });
        if (!allWordsMatch) continue;
      }

      // Apply additional filters
      if (options?.source && data.source !== options.source) continue;
      if (options?.collections?.length && !options.collections.some(c => data.collections?.includes(c))) continue;
      if (options?.tags?.length && !options.tags.some(t => data.tags?.includes(t))) continue;

      filteredResults.push({
        id: doc.id,
        title: data.title || '',
        description: data.description,
        type: data.type || 'image',
        url: data.url || '',
        thumbnailUrl: data.thumbnailUrl || data.url,
        source: data.source || 'upload',
        tags: data.tags || [],
        relevanceScore: 0.5, // Basic relevance for fallback search
        // Include vision analysis fields
        visionDescription: data.visionDescription,
        visionKeywords: data.visionKeywords,
        visionCategories: data.visionCategories,
        enhancedSearchText: data.enhancedSearchText,
      });
    }

    return {
      results: filteredResults,
      totalCount: filteredResults.length,
      query: query,
      searchTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    console.error('[Fallback Search] Error:', error);
    return {
      results: [],
      totalCount: 0,
      query: query,
      searchTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

/**
 * Index media into Vertex AI Search for semantic search capabilities.
 * Called automatically when media is uploaded/created.
 */
export async function indexMediaForSearchAction(
  brandId: string,
  mediaIds: string[]
): Promise<{ success: boolean; indexed: number; error?: string }> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Fetch media items to index
    const mediaItems: any[] = [];
    for (const mediaId of mediaIds) {
      const doc = await adminDb.collection('unifiedMedia').doc(mediaId).get();
      if (doc.exists) {
        mediaItems.push({ id: doc.id, ...doc.data() });
      }
    }

    if (mediaItems.length === 0) {
      return { success: true, indexed: 0 };
    }

    // Call Python service to index media
    const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

    const response = await fetch(`${pythonServiceUrl}/media/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_id: brandId,
        media_items: mediaItems,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Index Media] API error:', errorText);
      return {
        success: false,
        indexed: 0,
        error: `Indexing API error: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: data.success || false,
      indexed: data.indexed_count || 0,
      error: data.error,
    };

  } catch (error) {
    console.error('[Index Media] Error:', error);
    // Don't fail the operation if indexing fails - it's a background optimization
    return {
      success: false,
      indexed: 0,
      error: error instanceof Error ? error.message : 'Indexing failed',
    };
  }
}
