
'use server';

import {
  generateBrandProfile,
  GenerateBrandProfileOutput,
} from '@/ai/flows/generate-brand-profile';
import { generateBrandSummary } from '@/ai/flows/generate-brand-summary';
import { generateBrandText } from '@/ai/flows/generate-brand-text';
import { generatePersonalProfileText } from '@/ai/flows/generate-personal-profile-text';
import { regenerateBrandTextSection } from '@/ai/flows/regenerate-brand-text-section';
import {generateAICampaignContent} from '@/ai/flows/generate-ai-campaign-content';
import {generateAiImage, generateCharacterConsistentImage} from '@/ai/flows/generate-ai-images';
import {generateVideo} from '@/ai/flows/generate-video';
import {generateEditedImage} from '@/ai/flows/generate-edited-image';
import { regenerateAdCopy } from '@/ai/flows/regenerate-ad-copy';
import { regenerateImagePrompt } from '@/ai/flows/regenerate-image-prompt';
// import { indexMenu, menuQAFlow } from '@/ai/flows/rag-flow';
import type {
  CampaignTimeline,
  GeneratedCampaignContent,
  GeneratedDay,
  Video,
  EditedImage,
  BrandProfile,
  BrandAsset,
  BrandText,
  User,
  UserProfilePreferences,
  BrandMember,
  CharacterConsistencyConfig,
} from '@/lib/types';
import {getAdminInstances} from '@/lib/firebase/admin';
import {revalidatePath} from 'next/cache';
import _ from 'lodash';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess, requireBrandRole, getBrandMember, getBrandMembers } from '@/lib/brand-membership';
import { generationJobQueue } from '@/lib/generation/tracking';

export type BrandProfileFormState = {
  message: string;
  brandProfile?: GenerateBrandProfileOutput;
  error?: boolean;
};

// This was using zod directly, which was removed.
// The validation logic can be moved to the component or re-implemented if needed.
// For now, removing the server-side zod validation to fix the build.
export async function generateBrandProfileAction(
  prevState: BrandProfileFormState,
  formData: FormData
): Promise<BrandProfileFormState> {
  const websiteUrl = formData.get('websiteUrl') as string;

  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    return {message: 'Please enter a valid URL.', error: true};
  }

  try {
    const brandProfile = await generateBrandProfile({websiteUrl});
    return {message: 'Team profile generated successfully.', brandProfile};
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to generate team profile: ${errorMessage}`,
      error: true,
    };
  }
}

export type CampaignContentState = {
  message: string;
  generatedContent?: GeneratedCampaignContent;
  error?: boolean;
};

export async function generateCampaignContentAction(
  brandId: string,
  brandProfile: string,
  campaignTimeline: CampaignTimeline
): Promise<CampaignContentState> {
  if (!brandId || !brandProfile || !campaignTimeline || campaignTimeline.length === 0) {
    return {
      message: 'Team ID, team profile and initiative timeline are required.',
      error: true,
    };
  }

  const formattedTimeline = campaignTimeline.map(day => ({
    day: day.day,
    contentBlocks: day.contentBlocks.map(block => ({
      contentType: block.contentType,
      keyMessage: block.keyMessage,
      toneOfVoice: block.toneOfVoice,
      assetUrl: block.assetUrl,
      scheduledTime: block.scheduledTime,
    })),
  }));

  try {
    const result = await generateAICampaignContent({
      brandId,
      brandProfile,
      campaignTimeline: formattedTimeline,
    });
    return {
      message: 'Initiative content generated.',
      generatedContent: result.generatedContent
    };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to generate campaign content: ${errorMessage}`,
      error: true,
    };
  }
}

export type ImageGenerationState = {
  message: string;
  imageUrl?: string;
  error?: boolean;
  enhancedPrompt?: {
    sceneType?: string;
    sceneSubtype?: string;
  };
  explainability?: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  };
};

export async function generateImageAction(
  prompt: string,
  brandId?: string,
  contentContext?: { adCopy?: string; keyMessage?: string }
): Promise<ImageGenerationState> {
  if (!prompt) {
    return {message: 'Image prompt is required.', error: true};
  }

  try {
    const result = await generateAiImage({
      prompt,
      brandId,
      contentContext,
    });
    return {
      message: 'Image generated successfully.',
      imageUrl: result.imageUrl,
      enhancedPrompt: result.enhancedPrompt ? {
        sceneType: result.enhancedPrompt.sceneType,
        sceneSubtype: result.enhancedPrompt.sceneSubtype,
      } : undefined,
      explainability: result.explainability,
    };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to generate image: ${errorMessage}`,
      error: true,
    };
  }
}

export type CharacterConsistentImageState = {
  message: string;
  imageUrl?: string;
  error?: boolean;
};

/**
 * Generate an image with character consistency using Nano Banana (Gemini 2.5 Flash Image).
 * This action is used by individual content blocks when character sheets are configured.
 */
export async function generateCharacterConsistentImageAction(
  prompt: string,
  brandId: string,
  characterReferenceUrls: string[]
): Promise<CharacterConsistentImageState> {
  if (!prompt) {
    return { message: 'Image prompt is required.', error: true };
  }

  if (!characterReferenceUrls || characterReferenceUrls.length === 0) {
    return { message: 'At least one character reference URL is required.', error: true };
  }

  try {
    const result = await generateCharacterConsistentImage({
      prompt,
      brandId,
      characterReferenceUrls,
    });
    return {
      message: 'Image generated successfully with character consistency.',
      imageUrl: result.imageUrl,
    };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to generate character-consistent image: ${errorMessage}`,
      error: true,
    };
  }
}

async function uploadToStorage(
  id: string,
  folder: string,
  subfolder: string,
  dataUri: string,
  filename: string
): Promise<string> {
  // If it's already a URL, return it directly
  if (dataUri.startsWith('http')) {
    return dataUri;
  }

  const {adminStorage} = getAdminInstances();
  const bucket = adminStorage.bucket();

  const mimeType = dataUri.substring(
    dataUri.indexOf(':') + 1,
    dataUri.indexOf(';')
  );
  
  const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
  const buffer = Buffer.from(base64Data, 'base64');

  const filePath = `${folder}/${id}/${subfolder}/${filename}`;
  const file = bucket.file(filePath);

  await file.save(buffer, {metadata: {contentType: mimeType}});

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: '01-01-2500',
  });

  return signedUrl;
}

export async function generateVideoAction(
  brandId: string,
  videoId: string,
  prompt: string,
  title: string,
  imageUrl?: string,
  characterReferenceUrl?: string,
  startFrameUrl?: string,
  endFrameUrl?: string,
  resolution?: '720p' | '1080p',
  durationSeconds?: 4 | 6 | 8,
  personGeneration?: string,
  videoUrl?: string,
  referenceImages?: string[],
  useFastModel?: boolean,
  veoVideoUri?: string  // Gemini API file URI for video extension
): Promise<{video?: Video; error?: string[]; jobId?: string}> {
  console.log('SERVER: generateVideoAction called', { brandId, videoId });
  let jobId: string | undefined;
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    // Track this generation job for persistent notification
    jobId = await generationJobQueue.createJob(
      brandId,
      user.uid,
      'video',
      title,
      prompt,
      { videoId }
    );

    const {adminDb} = getAdminInstances();

    // Get AI model settings for this brand
    const {getAIModelSettingsAction} = await import('@/app/actions/ai-settings');
    const settings = await getAIModelSettingsAction(brandId);

    // Helper to upload data URI to storage
    const handleUpload = async (dataUri: string, prefix: string) => {
      if (dataUri.startsWith('data:')) {
        return await uploadToStorage(
          videoId,
          'videos',
          'inputs',
          dataUri,
          `${prefix}_${Date.now()}`
        );
      }
      return dataUri;
    };

    // Upload inputs if they are data URIs
    const processedImageUrl = imageUrl ? await handleUpload(imageUrl, 'image_to_video') : undefined;
    const processedCharRefUrl = characterReferenceUrl ? await handleUpload(characterReferenceUrl, 'char_ref') : undefined;
    const processedStartFrameUrl = startFrameUrl ? await handleUpload(startFrameUrl, 'start_frame') : undefined;
    const processedEndFrameUrl = endFrameUrl ? await handleUpload(endFrameUrl, 'end_frame') : undefined;
    const processedVideoUrl = videoUrl ? await handleUpload(videoUrl, 'video_extend') : undefined;

    // Process reference images if provided
    const processedRefImages = referenceImages ? await Promise.all(
      referenceImages.map((url, idx) => handleUpload(url, `ref_img_${idx}`))
    ) : undefined;

    const { videoUrl: generatedUrl, veoVideoUri: generatedVeoVideoUri } = await generateVideo({
      prompt,
      brandId,
      imageUrl: processedImageUrl,
      characterReferenceUrl: processedCharRefUrl,
      startFrameUrl: processedStartFrameUrl,
      endFrameUrl: processedEndFrameUrl,
      resolution,
      durationSeconds,
      personGeneration,
      videoUrl: processedVideoUrl,
      referenceImages: processedRefImages,
      useFastModel,
      settings, // Pass settings to Python backend
      veoVideoUri, // Pass veoVideoUri for video extension
    });

    const generatedVideoUrl = await uploadToStorage(
      videoId,
      'videos',
      'video',
      generatedUrl,
      'generated_video'
    );

    const videoData: Video = {
      id: videoId,
      brandId: brandId,
      videoUrl: generatedVideoUrl,
      title,
      description: prompt,
      generatedBy: user.uid, // Track who generated the video
      generatedAt: new Date().toISOString(), // Track when it was generated
      veoVideoUri: generatedVeoVideoUri, // Store Veo video URI for extension (valid for 2 days)
    };
    await adminDb
      .collection('videos')
      .doc(videoId)
      .set(videoData, {merge: true});

    // UNIFIED MEDIA: Also add to unified media library for immediate visibility
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const unifiedMediaData: any = {
      id: mediaId,
      brandId: brandId,
      type: 'video',
      url: generatedVideoUrl,
      thumbnailUrl: generatedVideoUrl,
      title: title,
      description: prompt,
      tags: ['ai-generated', 'veo', 'video'],
      collections: [],
      source: 'ai-generated',
      sourceVideoId: videoId,
      createdAt: videoData.generatedAt,
      createdBy: user.uid,
      generatedBy: user.uid,
      prompt: prompt,
    };

    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);

    // Mark job as completed
    if (jobId) {
      await generationJobQueue.completeJob(jobId, videoId, generatedVideoUrl);
    }

    revalidatePath('/videos');
    revalidatePath('/media');
    return {video: videoData, jobId};
  } catch (e: any) {
    console.error('Failed to generate video:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';

    // Mark job as failed
    if (jobId) {
      await generationJobQueue.failJob(jobId, errorMessage);
    }

    return {
      error: ['Failed to generate video.', errorMessage],
      jobId,
    };
  }
}

export async function getVideosAction(
  brandId: string,
  filters?: { userId?: string; dateRange?: { start: string; end: string } }
): Promise<Video[]> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    let query = adminDb.collection('videos').where('brandId', '==', brandId);

    const snapshot = await query.get();

    let videos = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as Video));

    // Fetch vision analysis data from unifiedMedia collection
    // Vision analysis is stored in unifiedMedia, not in videos collection
    const videoIds = videos.map((v: Video) => v.id);
    if (videoIds.length > 0) {
      // Fetch unifiedMedia entries that match these videos
      // Use sourceVideoId to match videos to unifiedMedia
      const unifiedMediaPromises = videoIds.map(async (videoId: string) => {
        try {
          const unifiedMediaSnapshot = await adminDb
            .collection('unifiedMedia')
            .where('sourceVideoId', '==', videoId)
            .where('brandId', '==', brandId)
            .where('type', '==', 'video')
            .limit(1)
            .get();
          
          if (!unifiedMediaSnapshot.empty) {
            const mediaData = unifiedMediaSnapshot.docs[0].data();
            return {
              videoId,
              visionDescription: mediaData.visionDescription,
              visionKeywords: mediaData.visionKeywords,
              visionCategories: mediaData.visionCategories,
            };
          }
          return { videoId, visionDescription: undefined, visionKeywords: undefined, visionCategories: undefined };
        } catch (error) {
          console.warn(`[getVideosAction] Error fetching vision analysis for video ${videoId}:`, error);
          return { videoId, visionDescription: undefined, visionKeywords: undefined, visionCategories: undefined };
        }
      });

      const visionDataMap = new Map<string, { visionDescription?: string; visionKeywords?: string[]; visionCategories?: string[] }>();
      const visionResults = await Promise.all(unifiedMediaPromises);
      visionResults.forEach(result => {
        if (result.visionDescription || result.visionKeywords || result.visionCategories) {
          visionDataMap.set(result.videoId, {
            visionDescription: result.visionDescription,
            visionKeywords: result.visionKeywords,
            visionCategories: result.visionCategories,
          });
        }
      });

      // Merge vision analysis data into videos
      videos = videos.map((video: Video) => {
        const visionData = visionDataMap.get(video.id);
        if (visionData) {
          return {
            ...video,
            visionDescription: visionData.visionDescription,
            visionKeywords: visionData.visionKeywords,
            visionCategories: visionData.visionCategories,
          };
        }
        return video;
      });
    }

    // Apply filters in memory
    if (filters?.userId) {
      videos = videos.filter((vid: Video) =>
        vid.generatedBy === filters.userId || vid.uploadedBy === filters.userId
      );
    }

    // Apply privacy filter: Show if published OR created by current user
    // Default to PRIVATE - only show to others if explicitly published
    videos = videos.filter((vid: any) => {
      const isOwner = vid.generatedBy === authenticatedUser.uid || vid.uploadedBy === authenticatedUser.uid;
      const isPublished = vid.isPublished === true; // Default to PRIVATE (must explicitly be true to show to others)
      return isOwner || isPublished;
    });

    if (filters?.dateRange) {
      const start = new Date(filters.dateRange.start).getTime();
      const end = new Date(filters.dateRange.end).getTime();

      videos = videos.filter((vid: Video) => {
        const v = vid as any;
        const dateStr = v.generatedAt || v.uploadedAt || v.createdAt;
        if (!dateStr) return false;
        const time = new Date(dateStr).getTime();
        return time >= start && time <= end;
      });
    }

    // Sort by newest first
    videos.sort((a: Video, b: Video) => {
      const vA = a as any;
      const vB = b as any;
      const dateA = new Date(vA.generatedAt || vA.uploadedAt || vA.createdAt || 0).getTime();
      const dateB = new Date(vB.generatedAt || vB.uploadedAt || vB.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return videos;
  } catch (error: any) {
    // Return empty array on auth errors (e.g., during logout) to prevent UI errors
    const errorMessage = error?.message || '';
    if (errorMessage.includes('authentication') || errorMessage.includes('session')) {
      console.log('getVideosAction: User not authenticated, returning empty array');
      return [];
    }
    console.error('Error fetching videos:', error);
    throw new Error('Failed to fetch videos');
  }
}

export async function deleteVideoAction(
  videoId: string
): Promise<{success: boolean; message: string}> {
  try {
    // SECURITY: Get video first to validate brand access
    const user = await getAuthenticatedUser();
    const {adminDb, adminStorage} = getAdminInstances();
    
    // First get the video to check brand ownership
    const videoDoc = await adminDb.collection('videos').doc(videoId).get();
    if (!videoDoc.exists) {
      return { success: false, message: 'Video not found' };
    }
    
    const videoData = videoDoc.data() as Video;
    await requireBrandAccess(user.uid, videoData.brandId);
    const bucket = adminStorage.bucket();

    const [files] = await bucket.getFiles({prefix: `videos/${videoId}/`});
    for (const file of files) {
      try {
        await file.delete();
      } catch (storageError: any) {
        if (storageError.code !== 404) {
          console.warn(
            `Error deleting file ${file.name}, but continuing.`,
            storageError
          );
        }
      }
    }

    await adminDb.collection('videos').doc(videoId).delete();

    revalidatePath('/videos');
    return {success: true, message: 'Video deleted successfully.'};
  } catch (e: any) {
    console.error('Failed to delete video:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Failed to delete video: ${errorMessage}`,
    };
  }
}

export type SaveCampaignState = {
  message: string;
  campaignId?: string;
  updatedAt?: string;
  error?: boolean;
  conflict?: boolean;
  conflictInfo?: {
    updatedBy: string;
    updatedAt: string;
  };
};

export async function saveCampaignAction(
  brandId: string,
  campaignContent: GeneratedCampaignContent,
  campaignId: string | null,
  campaignName: string,
  clientUpdatedAt?: string | null,
  originalPrompt?: string | null,
  characterConsistency?: CharacterConsistencyConfig | null,
): Promise<SaveCampaignState> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const {adminDb, adminStorage} = getAdminInstances();
    const bucket = adminStorage.bucket();

    const campaignsCollection = adminDb.collection('campaigns');

    let campaignDocRef;
    let finalCampaignId;
    let savedUpdatedAt: string | undefined;

    // Prepare campaign doc ref
    if (campaignId) {
      campaignDocRef = campaignsCollection.doc(campaignId);
      finalCampaignId = campaignId;
    } else {
      campaignDocRef = campaignsCollection.doc();
      finalCampaignId = campaignDocRef.id;
    }

    // Create a deterministic uniqueness key for the campaign name within this brand
    // This ensures we have a concrete document to lock in the transaction
    const nameSlug = campaignName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const uniquenessDocRef = adminDb
      .collection('campaign_name_uniqueness')
      .doc(`${brandId}_${nameSlug}`);

    // Use transaction to atomically check uniqueness and write campaign
    try {
      await adminDb.runTransaction(async (transaction: any) => {
        // Read the uniqueness document - this creates a lock
        const uniquenessDoc = await transaction.get(uniquenessDocRef);
        
        if (uniquenessDoc.exists) {
          const existingCampaignId = uniquenessDoc.data()?.campaignId;
          
          // If updating an existing campaign, allow it only if it's the same campaign
          if (campaignId && existingCampaignId === campaignId) {
            // Same campaign being updated - allowed
          } else {
            // Different campaign or new campaign with duplicate name
            throw new Error('DUPLICATE_NAME');
          }
        } else {
          // Fallback: Check for campaigns directly (for legacy campaigns created before uniqueness docs)
          const duplicateQuery = campaignsCollection
            .where('brandId', '==', brandId)
            .where('name', '==', campaignName);
          
          const duplicateCampaigns = await transaction.get(duplicateQuery);
          
          if (!duplicateCampaigns.empty) {
            // If updating an existing campaign, allow it only if it's the same campaign
            if (campaignId) {
              const isDifferentCampaign = duplicateCampaigns.docs.some((doc: any) => doc.id !== campaignId);
              if (isDifferentCampaign) {
                throw new Error('DUPLICATE_NAME');
              }
            } else {
              // Creating a new campaign and name already exists
              throw new Error('DUPLICATE_NAME');
            }
          }
        }

        // SECURITY: If updating existing campaign, verify it belongs to the authorized brand
        // Also check if name is changing to clean up old uniqueness doc
        let oldNameSlug: string | null = null;
        let existingUpdatedAt: any = null;
        if (campaignId) {
          const existingCampaign = await transaction.get(campaignDocRef);
          
          if (existingCampaign.exists) {
            const existingData = existingCampaign.data();
            if (existingData?.brandId !== brandId) {
              throw new Error('Access denied: Campaign belongs to a different brand');
            }
            
            // Store existing updatedAt for optimistic concurrency control
            existingUpdatedAt = existingData?.updatedAt;
            
            // CONFLICT DETECTION: Check if campaign was updated by someone else
            // Skip conflict detection if the same user made the last change (allows auto-save race conditions)
            const lastUpdatedBy = existingData?.updatedBy;
            const isSameUser = lastUpdatedBy === user.uid;

            if (clientUpdatedAt && existingUpdatedAt && !isSameUser) {
              // Convert both to timestamps for comparison
              let dbTimestamp: number;
              if (typeof existingUpdatedAt === 'string') {
                dbTimestamp = new Date(existingUpdatedAt).getTime();
              } else if (existingUpdatedAt?.toDate) {
                dbTimestamp = existingUpdatedAt.toDate().getTime();
              } else {
                dbTimestamp = 0;
              }

              const clientTimestamp = new Date(clientUpdatedAt).getTime();

              // If database version is newer than what client has, there's a conflict
              if (dbTimestamp > clientTimestamp) {
                const conflictInfo = {
                  updatedBy: existingData?.updatedBy || 'Unknown user',
                  updatedAt: typeof existingUpdatedAt === 'string'
                    ? existingUpdatedAt
                    : existingUpdatedAt?.toDate?.().toISOString() || new Date(0).toISOString(),
                };
                throw new Error(`SAVE_CONFLICT:${JSON.stringify(conflictInfo)}`);
              }
            }
            
            // Check if name is changing
            if (existingData?.name && existingData.name !== campaignName) {
              oldNameSlug = existingData.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            }
          }
        }

        // Write uniqueness document to lock the name
        transaction.set(uniquenessDocRef, {
          campaignId: finalCampaignId,
          brandId: brandId,
          campaignName: campaignName,
          updatedAt: new Date(),
        });

        // Delete old uniqueness document if name changed
        if (oldNameSlug && oldNameSlug !== nameSlug) {
          const oldUniquenessDocRef = adminDb
            .collection('campaign_name_uniqueness')
            .doc(`${brandId}_${oldNameSlug}`);
          transaction.delete(oldUniquenessDocRef);
        }

        // Write campaign document atomically with audit trail
        const now = new Date().toISOString(); // Use ISO string for consistency
        savedUpdatedAt = now; // Save for return value
        const campaignData: any = {
          name: campaignName,
          brandId: brandId,
          updatedAt: now,
          updatedBy: user.uid, // Track who saved the campaign
        };

        // Only set createdAt and createdBy for new campaigns
        if (!campaignId) {
          campaignData.createdAt = now;
          campaignData.createdBy = user.uid; // Track who created the campaign
        }

        // Update originalPrompt if provided (allows editing the master prompt)
        if (originalPrompt !== undefined && originalPrompt !== null) {
          campaignData.originalPrompt = originalPrompt;
        }

        // Update characterConsistency if provided (allows saving/editing character sheets)
        if (characterConsistency !== undefined && characterConsistency !== null) {
          campaignData.characterConsistency = characterConsistency;
        }

        transaction.set(campaignDocRef, campaignData, { merge: true });
      });
    } catch (error: any) {
      if (error.message === 'DUPLICATE_NAME') {
        return {
          message: 'An initiative with this name already exists. Please choose a different name.',
          error: true,
        };
      }
      if (error.message?.startsWith('SAVE_CONFLICT:')) {
        const conflictInfo = JSON.parse(error.message.replace('SAVE_CONFLICT:', ''));
        return {
          message: `This campaign was modified by ${conflictInfo.updatedBy} after you loaded it. Please reload the campaign to see the latest changes before saving.`,
          error: true,
          conflict: true,
          conflictInfo,
        };
      }
      throw error; // Re-throw other errors
    }

    // OPTIMIZATION: Handle subcollection operations with multiple batches and parallel processing
    // Firestore batch limit is 500 operations, so we need to split large campaigns
    const BATCH_LIMIT = 450; // Leave some headroom

    // Delete existing subcollections if updating an existing campaign (parallel fetch + batched delete)
    if (campaignId) {
      const daysSnapshot = await campaignDocRef.collection('days').get();

      // OPTIMIZATION: Fetch all contentBlocks in parallel
      const allDeleteOps: FirebaseFirestore.DocumentReference[] = [];
      const contentBlocksPromises = daysSnapshot.docs.map(async (dayDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const contentBlocksSnapshot = await dayDoc.ref.collection('contentBlocks').get();
        return { dayDoc, contentBlocksSnapshot };
      });

      const dayResults = await Promise.all(contentBlocksPromises);

      // Collect all delete operations
      for (const { dayDoc, contentBlocksSnapshot } of dayResults) {
        for (const blockDoc of contentBlocksSnapshot.docs) {
          allDeleteOps.push(blockDoc.ref);
        }
        allDeleteOps.push(dayDoc.ref);
      }

      // Delete in batches
      for (let i = 0; i < allDeleteOps.length; i += BATCH_LIMIT) {
        const deleteBatch = adminDb.batch();
        const chunk = allDeleteOps.slice(i, i + BATCH_LIMIT);
        for (const ref of chunk) {
          deleteBatch.delete(ref);
        }
        await deleteBatch.commit();
      }
    }

    // OPTIMIZATION: Upload all base64 images in parallel first
    type ImageUploadTask = {
      dayNum: number;
      blockIndex: number;
      dataUrl: string;
    };

    const imageUploadTasks: ImageUploadTask[] = [];
    const uploadedUrls: Map<string, string> = new Map(); // key: "dayNum-blockIndex"

    for (const day of campaignContent) {
      for (let blockIndex = 0; blockIndex < day.contentBlocks.length; blockIndex++) {
        const block = day.contentBlocks[blockIndex];
        if (block.imageUrl && block.imageUrl.startsWith('data:')) {
          imageUploadTasks.push({
            dayNum: day.day,
            blockIndex,
            dataUrl: block.imageUrl,
          });
        }
      }
    }

    // Upload images in parallel with concurrency limit to avoid overwhelming storage
    const UPLOAD_CONCURRENCY = 10;
    for (let i = 0; i < imageUploadTasks.length; i += UPLOAD_CONCURRENCY) {
      const chunk = imageUploadTasks.slice(i, i + UPLOAD_CONCURRENCY);
      const uploadPromises = chunk.map(async (task) => {
        const mimeType = task.dataUrl.substring(
          task.dataUrl.indexOf(':') + 1,
          task.dataUrl.indexOf(';')
        );
        const base64Data = task.dataUrl.substring(
          task.dataUrl.indexOf(',') + 1
        );
        const buffer = Buffer.from(base64Data, 'base64');

        const filePath = `campaigns/${finalCampaignId}/day_${task.dayNum}/${Date.now()}_${task.blockIndex}.png`;
        const file = bucket.file(filePath);

        await file.save(buffer, {
          metadata: { contentType: mimeType },
        });
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2500',
        });

        uploadedUrls.set(`${task.dayNum}-${task.blockIndex}`, signedUrl);
      });

      await Promise.all(uploadPromises);
    }

    // Collect all write operations
    type WriteOp = {
      ref: FirebaseFirestore.DocumentReference;
      data: any;
    };
    const allWriteOps: WriteOp[] = [];

    for (const day of campaignContent) {
      const dayDocRef = campaignDocRef.collection('days').doc(`day_${day.day}`);
      const dayData: Omit<GeneratedDay, 'contentBlocks'> = {
        day: day.day,
        ...(day.date && { date: day.date }), // Include date if it exists
      };
      allWriteOps.push({ ref: dayDocRef, data: dayData });

      for (let blockIndex = 0; blockIndex < day.contentBlocks.length; blockIndex++) {
        const block = day.contentBlocks[blockIndex];

        // Use pre-uploaded URL if available, otherwise use existing URL
        let finalImageUrl = uploadedUrls.get(`${day.day}-${blockIndex}`) || block.imageUrl;

        // Use the content block's ID as the Firestore document ID to maintain link with comments
        const contentBlockId = block.id || crypto.randomUUID();
        const contentBlockRef = dayDocRef.collection('contentBlocks').doc(contentBlockId);

        // Build content block data, excluding undefined values (Firestore doesn't accept undefined)
        const contentBlockData: any = {
          id: contentBlockId,
          imageIsGenerating: false,
        };

        // Copy block properties, excluding undefined values
        Object.keys(block).forEach(key => {
          if (block[key as keyof typeof block] !== undefined) {
            contentBlockData[key] = block[key as keyof typeof block];
          }
        });

        // Set imageUrl only if it has a value
        if (finalImageUrl !== undefined) {
          contentBlockData.imageUrl = finalImageUrl;
        }

        allWriteOps.push({ ref: contentBlockRef, data: contentBlockData });
      }
    }

    // Write in batches to handle large campaigns
    for (let i = 0; i < allWriteOps.length; i += BATCH_LIMIT) {
      const writeBatch = adminDb.batch();
      const chunk = allWriteOps.slice(i, i + BATCH_LIMIT);
      for (const op of chunk) {
        writeBatch.set(op.ref, op.data);
      }
      await writeBatch.commit();
    }

    revalidatePath('/');
    return {
      message: 'Initiative saved successfully to Firebase!',
      campaignId: finalCampaignId,
      updatedAt: savedUpdatedAt,
    };
  } catch (e) {
    console.error('Failed to save campaign to Firebase:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to save campaign: ${errorMessage}`,
      error: true,
    };
  }
}

export type LoadCampaignState = {
  message: string;
  campaigns?: {
    id: string;
    name: string;
    createdAt: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
  }[];
  error?: boolean;
  campaignContent?: GeneratedCampaignContent;
  campaignName?: string;
  updatedAt?: string;
  updatedBy?: string;
  createdAt?: string;
  createdBy?: string;
  originalPrompt?: string;
  campaignGoal?: string;
  characterConsistency?: {
    enabled: boolean;
    characters: {
      id: string;
      name: string;
      characterSheetUrl: string;
      isActive: boolean;
    }[];
    useSceneToSceneConsistency: boolean;
    maxReferenceImages: number;
  };
};

export async function loadCampaignsAction(brandId: string): Promise<LoadCampaignState> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const {adminDb} = getAdminInstances();
    const campaignsSnapshot = await adminDb
      .collection('campaigns')
      .where('brandId', '==', brandId)
      .get();
      
    const campaigns = campaignsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      
      // Handle both Firestore Timestamp and ISO string formats for backward compatibility
      let createdAt: string;
      if (typeof data.createdAt === 'string') {
        // Already an ISO string
        createdAt = data.createdAt;
      } else if (data.createdAt?.toDate) {
        // Firestore Timestamp object
        createdAt = data.createdAt.toDate().toISOString();
      } else {
        // Fallback for missing data
        createdAt = new Date(0).toISOString();
      }
      
      // Handle updatedAt timestamp the same way
      let updatedAt: string | undefined;
      if (data.updatedAt) {
        if (typeof data.updatedAt === 'string') {
          updatedAt = data.updatedAt;
        } else if (data.updatedAt?.toDate) {
          updatedAt = data.updatedAt.toDate().toISOString();
        }
      }
      
      return {
        id: doc.id,
        name: data.name || `Campaign ${doc.id.substring(0, 5)}`,
        createdAt,
        createdBy: data.createdBy,
        updatedAt,
        updatedBy: data.updatedBy,
      };
    });

    // Sort campaigns by date in descending order (newest first)
    campaigns.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {message: 'Initiatives loaded successfully.', campaigns};
  } catch (e) {
    console.error('Failed to load campaigns from Firebase:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to load campaigns: ${errorMessage}`,
      error: true,
    };
  }
}

export async function loadCampaignAction(
  campaignId: string
): Promise<LoadCampaignState> {
  try {
    const {adminDb} = getAdminInstances();
    const campaignDoc = await adminDb.collection('campaigns').doc(campaignId).get();
     if (!campaignDoc.exists) {
      return { message: 'Initiative not found.', error: true };
    }
    
    const campaignData = campaignDoc.data();
    const campaignName = campaignData?.name || `Campaign ${campaignId.substring(0, 5)}`;
    
    // Extract audit trail fields for display and conflict detection
    let updatedAt: string | undefined;
    if (campaignData?.updatedAt) {
      if (typeof campaignData.updatedAt === 'string') {
        updatedAt = campaignData.updatedAt;
      } else if (campaignData.updatedAt?.toDate) {
        updatedAt = campaignData.updatedAt.toDate().toISOString();
      }
    }
    
    let createdAt: string | undefined;
    if (campaignData?.createdAt) {
      if (typeof campaignData.createdAt === 'string') {
        createdAt = campaignData.createdAt;
      } else if (campaignData.createdAt?.toDate) {
        createdAt = campaignData.createdAt.toDate().toISOString();
      }
    }
    
    const updatedBy = campaignData?.updatedBy;
    const createdBy = campaignData?.createdBy;

    const loadedCampaign: GeneratedCampaignContent = [];

    const daysSnapshot = await campaignDoc.ref
      .collection('days')
      .orderBy('day')
      .get();

    // OPTIMIZATION: Fetch all contentBlocks in parallel instead of sequentially
    const dayDocsWithBlocks = await Promise.all(
      daysSnapshot.docs.map(async (dayDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const dayData = dayDoc.data();
        const contentBlocksSnapshot = await dayDoc.ref
          .collection('contentBlocks')
          .orderBy('adCopy')
          .get();

        const contentBlocks = contentBlocksSnapshot.docs.map((blockDoc: any) => {
          const data = blockDoc.data();
          return {
            id: blockDoc.id, // Include the Firestore document ID to maintain link with comments
            contentType: data.contentType,
            adCopy: data.adCopy,
            imagePrompt: data.imagePrompt,
            imageUrl: data.imageUrl,
            imageIsGenerating: data.imageIsGenerating,
            scheduledTime: data.scheduledTime,
            keyMessage: data.keyMessage,
            toneOfVoice: data.toneOfVoice,
            assetUrl: data.assetUrl,
            // Nano Banana AI Image Studio metadata
            sourceImageUrl: data.sourceImageUrl,
            fusionSourceUrls: data.fusionSourceUrls,
            maskUrl: data.maskUrl,
            editPrompt: data.editPrompt,
          };
        });

        return {
          day: dayData.day,
          date: dayData.date,
          contentBlocks,
        };
      })
    );

    // Build the campaign from parallel results
    for (const dayWithBlocks of dayDocsWithBlocks) {
      loadedCampaign.push({
        day: dayWithBlocks.day,
        ...(dayWithBlocks.date && { date: dayWithBlocks.date }), // Include date if it exists
        contentBlocks: dayWithBlocks.contentBlocks,
      });
    }

    loadedCampaign.sort((a: any, b: any) => a.day - b.day);

    console.log('[Load Campaign] Loaded campaign from subcollection:', {
      campaignId,
      totalDays: loadedCampaign.length,
      totalBlocks: loadedCampaign.reduce((sum: number, day: any) => sum + day.contentBlocks.length, 0)
    });

    return {
      message: 'Initiative loaded successfully.',
      campaignContent: loadedCampaign,
      campaignName,
      updatedAt,
      updatedBy,
      createdAt,
      createdBy,
      originalPrompt: campaignData?.originalPrompt,
      campaignGoal: campaignData?.campaignGoal,
      characterConsistency: campaignData?.characterConsistency,
    };
  } catch (e) {
    console.error('Failed to load campaign from Firebase:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      message: `Failed to load campaign: ${errorMessage}`,
      error: true,
    };
  }
}

export async function deleteCampaignAction(campaignId: string): Promise<{ success: boolean; message: string }> {
    try {
        const { adminDb, adminStorage } = getAdminInstances();
        const bucket = adminStorage.bucket();

        // 0. Get campaign data first to clean up uniqueness document
        const campaignRef = adminDb.collection('campaigns').doc(campaignId);
        const campaignDoc = await campaignRef.get();
        const campaignData = campaignDoc.data();

        // OPTIMIZATION: Delete storage files and Firestore docs in parallel
        const storageDeletePromise = (async () => {
          const prefix = `campaigns/${campaignId}/`;
          const [files] = await bucket.getFiles({ prefix });
          // Delete files in parallel with concurrency limit
          const DELETE_CONCURRENCY = 20;
          for (let i = 0; i < files.length; i += DELETE_CONCURRENCY) {
            const chunk = files.slice(i, i + DELETE_CONCURRENCY);
            await Promise.all(chunk.map(async (file: { name: string; delete: () => Promise<void> }) => {
              try {
                await file.delete();
              } catch (storageError: any) {
                if (storageError.code !== 404) {
                  console.warn(`Error deleting file ${file.name} from storage, but continuing deletion process.`, storageError);
                }
              }
            }));
          }
        })();

        // 2. Delete all documents in subcollections (parallel fetch + batched delete)
        const firestoreDeletePromise = (async () => {
          const BATCH_LIMIT = 450;
          const daysSnapshot = await campaignRef.collection('days').get();

          // Fetch all contentBlocks in parallel
          const contentBlocksPromises = daysSnapshot.docs.map(async (dayDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
            const contentBlocksSnapshot = await dayDoc.ref.collection('contentBlocks').get();
            return { dayDoc, contentBlocksSnapshot };
          });

          const dayResults = await Promise.all(contentBlocksPromises);

          // Collect all delete operations
          const allDeleteOps: FirebaseFirestore.DocumentReference[] = [];
          for (const { dayDoc, contentBlocksSnapshot } of dayResults) {
            for (const blockDoc of contentBlocksSnapshot.docs) {
              allDeleteOps.push(blockDoc.ref);
            }
            allDeleteOps.push(dayDoc.ref);
          }

          // Delete in batches
          for (let i = 0; i < allDeleteOps.length; i += BATCH_LIMIT) {
            const deleteBatch = adminDb.batch();
            const chunk = allDeleteOps.slice(i, i + BATCH_LIMIT);
            for (const ref of chunk) {
              deleteBatch.delete(ref);
            }
            await deleteBatch.commit();
          }
        })();

        // Wait for both storage and Firestore deletes to complete
        await Promise.all([storageDeletePromise, firestoreDeletePromise]);

        // 3. Delete uniqueness document if campaign had a name
        if (campaignData?.name && campaignData?.brandId) {
          const nameSlug = campaignData.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const uniquenessDocRef = adminDb
            .collection('campaign_name_uniqueness')
            .doc(`${campaignData.brandId}_${nameSlug}`);
          
          try {
            await uniquenessDocRef.delete();
          } catch (uniquenessError: any) {
            console.warn('Error deleting uniqueness document, but continuing deletion process.', uniquenessError);
          }
        }

        // 4. Delete the main campaign document
        await campaignRef.delete();

        revalidatePath('/'); // Revalidate the main page if it shows campaign info
        return { success: true, message: 'Initiative deleted successfully.' };
    } catch (e: any) {
        console.error('Failed to delete campaign:', e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        return { success: false, message: `Failed to delete campaign: ${errorMessage}` };
    }
}


export async function logoutAction() {
  // This function is kept for potential future use with httpOnly cookies,
  // but is currently not essential for the client-side auth flow.
}

async function deleteCollection(collectionPath: string, batchSize: number) {
  const {adminDb} = getAdminInstances();
  const collectionRef = adminDb.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  resolve: (value: unknown) => void
) {
  const {adminDb} = getAdminInstances();
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve(0);
    return;
  }

  // Delete documents in a batch
  const batch = adminDb.batch();
  snapshot.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

export async function clearDatabaseAction() {
  try {
    console.log('Clearing database...');
    const {adminAuth, adminDb, adminStorage} = getAdminInstances();

    // 1. Delete all Auth users
    const listUsersResult = await adminAuth.listUsers();
    const uidsToDelete = listUsersResult.users.map((user: any) => user.uid);
    if (uidsToDelete.length > 0) {
      await adminAuth.deleteUsers(uidsToDelete);
      console.log(
        `Successfully deleted ${uidsToDelete.length} users from Auth.`
      );
    } else {
      console.log('No users to delete from Auth.');
    }

    // 2. Delete all Firestore collections
    await deleteCollection('users', 50);
    await deleteCollection('brands', 50);
    await deleteCollection('videos', 50);
    await deleteCollection('images', 50);
    
    // Delete campaigns with subcollections (days → contentBlocks)
    const campaignsSnapshot = await adminDb.collection('campaigns').get();
    for (const campaignDoc of campaignsSnapshot.docs) {
        const daysSnapshot = await campaignDoc.ref.collection('days').get();
        for (const dayDoc of daysSnapshot.docs) {
            await deleteCollection(`campaigns/${campaignDoc.id}/days/${dayDoc.id}/contentBlocks`, 50);
        }
        await deleteCollection(`campaigns/${campaignDoc.id}/days`, 50);
    }
    await deleteCollection('campaigns', 50);
    
    // Delete Brand Soul collections (artifacts with subcollections)
    const brandArtifactsSnapshot = await adminDb.collection('brandArtifacts').get();
    for (const brandDoc of brandArtifactsSnapshot.docs) {
        await deleteCollection(`brandArtifacts/${brandDoc.id}/sources`, 50);
        await deleteCollection(`brandArtifacts/${brandDoc.id}/insights`, 50);
        await deleteCollection(`brandArtifacts/${brandDoc.id}/brandSoul`, 50);
        await deleteCollection(`brandArtifacts/${brandDoc.id}/jobs`, 50);
    }
    await deleteCollection('brandArtifacts', 50);
    
    // Delete top-level Brand Soul collections
    await deleteCollection('brandSoul', 50);
    await deleteCollection('brandSoulVersions', 50);
    await deleteCollection('brandSoulJobs', 50);
    
    // Delete brand management collections
    await deleteCollection('brandMembers', 50);
    await deleteCollection('sponsorships', 50);
    await deleteCollection('sponsorshipInvitations', 50);
    await deleteCollection('brandInvitations', 50);
    
    // Delete user profile preferences with subcollections (brands)
    const userPrefsSnapshot = await adminDb.collection('userProfilePreferences').get();
    for (const userDoc of userPrefsSnapshot.docs) {
        await deleteCollection(`userProfilePreferences/${userDoc.id}/brands`, 50);
    }
    await deleteCollection('userProfilePreferences', 50);
    
    // Delete comments and related collections
    await deleteCollection('comments', 50);
    await deleteCollection('commentContexts', 50);
    await deleteCollection('commentFlags', 50);
    await deleteCollection('commentNotifications', 50);

    console.log(
      "Successfully deleted all collections."
    );

    // 3. Delete all Storage folders
    const bucket = adminStorage.bucket();
    await bucket.deleteFiles({ prefix: 'brand_assets/' });
    await bucket.deleteFiles({ prefix: 'campaigns/' });
    await bucket.deleteFiles({ prefix: 'images/' });
    await bucket.deleteFiles({ prefix: 'videos/' });
    await bucket.deleteFiles({ prefix: 'brand-soul/' });
    console.log('Successfully deleted all files from Storage.');

    const unifiedMediaQuery = adminDb.collection('unifiedMedia').limit(500);
    await new Promise((resolve) => deleteQueryBatch(unifiedMediaQuery, resolve));
    console.log('Successfully deleted unifiedMedia.');

    const collectionsQuery = adminDb.collection('collections').limit(500);
    await new Promise((resolve) => deleteQueryBatch(collectionsQuery, resolve));
    console.log('Successfully deleted collections.');

    return {success: true, message: 'Database cleared successfully.'};
  } catch (error: any) {
    console.error('Error clearing database:', error);
    return {success: false, message: error.message};
  }
}

export async function seedDatabase() {
  try {
    console.log('Seeding database...');
    const {adminAuth, adminDb} = getAdminInstances();
    const now = new Date().toISOString();

    // Create 5 diverse team profiles
    const brands = [
      // 1. Sports Team - Lightning FC
      {
        id: 'lightning-fc',
        name: 'Lightning FC',
        profile: {
          summary: 'Lightning FC is a competitive youth soccer club focused on player development, community engagement, and championship performance. We build champions on and off the field.',
          brandName: 'Lightning FC',
          industry: 'Sports',
          targetAudience: 'Youth athletes, parents, soccer fans, and local community supporters',
          valueProposition: 'Elite soccer training with a focus on character development, teamwork, and competitive excellence.',
          missionStatement: 'To develop skilled athletes and outstanding individuals through the beautiful game of soccer, fostering teamwork, discipline, and community pride.',
          brandVoice: {
            tone: 'Energetic, motivating, and team-focused',
            style: 'Action-oriented, celebratory, and inspirational',
            personality: 'Passionate coach, proud supporter, championship mindset'
          },
          keyMessages: [
            'Champions on and off the field',
            'Elite training, exceptional character',
            'One team, one dream',
            'Building the future of soccer'
          ],
          competitiveAdvantages: [
            'Professional coaching staff',
            'State-of-the-art training facilities',
            'Proven track record of college placements',
            'Strong community partnerships'
          ],
          brandColors: {
            primary: '#2CAAA0',
            secondary: '#3DD68C',
            accent: '#FFD700',
            neutral: '#64748B'
          },
          images: [],
          videos: [],
          documents: [],
          tagline: 'Strike Fast. Play Smart. Win Together.',
          websiteUrl: 'https://lightningfc.team',
          contactEmail: 'coach@lightningfc.team',
          location: 'Austin, TX',
          bannerImageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200',
          logoUrl: 'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=400',
          engagementMetrics: [
            { label: 'Active Players', value: '250+', icon: 'users' },
            { label: 'Championships', value: '12', icon: 'trophy' },
            { label: 'College Commits', value: '45', icon: 'graduation-cap' },
            { label: 'Years Competing', value: '15', icon: 'calendar' }
          ],
          pinnedPost: {
            content: '⚡ GAME DAY! Lightning FC U16 takes on rival Storm United tonight at 7PM. Let\'s pack the stands and show our support! #LightningStrikes #MatchDay',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 423,
            shares: 87
          },
          feedSections: [
            {
              id: 'match-results',
              title: 'Match Results',
              icon: 'trophy',
              contentType: 'text',
              items: [
                {
                  id: 'result-1',
                  content: 'VICTORY! Lightning FC U18 defeats Central City 3-1 with an incredible performance. Hat trick by Sarah Martinez! ⚡🔥',
                  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'result-2',
                  content: 'Hard-fought draw 2-2 against defending champions. Our U14 squad showed incredible resilience and determination.',
                  timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            },
            {
              id: 'player-spotlights',
              title: 'Player Spotlights',
              icon: 'star',
              contentType: 'text',
              items: [
                {
                  id: 'player-1',
                  content: 'Player of the Week: Alex Chen (U16) - 2 goals, 3 assists, and exceptional leadership on the field. Future star!',
                  timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'player-2',
                  content: 'College Commit Alert! Congratulations to Emma Johnson on her commitment to play D1 soccer at UCLA! We\'re so proud! 💙💛',
                  timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            }
          ]
        }
      },
      // 2. Product Team - Nova Labs
      {
        id: 'nova-labs',
        name: 'Nova Labs',
        profile: {
          summary: 'Nova Labs builds cutting-edge SaaS productivity tools that help teams work smarter. Our flagship product, TaskFlow, revolutionizes project management with AI-powered automation.',
          brandName: 'Nova Labs',
          industry: 'Product & Technology',
          targetAudience: 'Product managers, software teams, startup founders, and productivity-focused professionals',
          valueProposition: 'AI-powered productivity tools that eliminate busywork and help teams focus on what matters most.',
          missionStatement: 'To empower teams with intelligent software that amplifies their productivity and creativity, making work feel less like work.',
          brandVoice: {
            tone: 'Innovative, helpful, and solution-focused',
            style: 'Clear, technical yet accessible, forward-thinking',
            personality: 'Product evangelist, problem solver, innovation driver'
          },
          keyMessages: [
            'Work smarter, not harder',
            'AI that actually works for you',
            'From chaos to clarity',
            'Built by makers, for makers'
          ],
          competitiveAdvantages: [
            'Advanced AI automation engine',
            'Seamless integrations with 100+ tools',
            'Beautiful, intuitive user experience',
            'Enterprise-grade security and compliance'
          ],
          brandColors: {
            primary: '#5B21B6',
            secondary: '#0EA5E9',
            accent: '#F97316',
            neutral: '#64748B'
          },
          images: [],
          videos: [],
          documents: [],
          tagline: 'Productivity Powered by Intelligence',
          websiteUrl: 'https://novalabs.io',
          contactEmail: 'hello@novalabs.io',
          location: 'San Francisco, CA',
          bannerImageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200',
          logoUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
          engagementMetrics: [
            { label: 'Active Users', value: '50K+', icon: 'users' },
            { label: 'Tasks Automated', value: '2M+', icon: 'zap' },
            { label: 'Integrations', value: '100+', icon: 'puzzle' },
            { label: 'Time Saved', value: '500K hrs', icon: 'clock' }
          ],
          pinnedPost: {
            content: '🚀 TaskFlow 3.0 is LIVE! Introducing Smart Workflows - AI that learns your team\'s patterns and automates repetitive tasks. Try it free for 14 days!',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 892,
            shares: 234
          },
          feedSections: [
            {
              id: 'releases',
              title: 'Product Releases',
              icon: 'rocket',
              contentType: 'text',
              items: [
                {
                  id: 'release-1',
                  content: 'New Feature: Dark Mode is here! Plus improved mobile app performance and faster sync across devices.',
                  timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'release-2',
                  content: 'Integration Update: Now supporting Slack threads, Linear issues, and GitHub projects. Seamless workflow, zero context switching.',
                  timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            },
            {
              id: 'customer-stories',
              title: 'Customer Success',
              icon: 'heart',
              contentType: 'text',
              items: [
                {
                  id: 'story-1',
                  content: 'Case Study: How a 50-person startup saved 20 hours per week using TaskFlow\'s automation features. Read the full story.',
                  timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'story-2',
                  content: '"TaskFlow transformed how our product team works. We ship faster and with more confidence." - Sarah M., Head of Product at TechCorp',
                  timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            }
          ]
        }
      },
      // 3. Creative Agency - Spectrum Creative Studio
      {
        id: 'spectrum-creative',
        name: 'Spectrum Creative Studio',
        profile: {
          summary: 'Spectrum Creative Studio is a boutique creative agency specializing in brand identity, digital experiences, and visual storytelling for ambitious brands.',
          brandName: 'Spectrum Creative Studio',
          industry: 'Creative & Design',
          targetAudience: 'Startups, lifestyle brands, nonprofits, and businesses seeking elevated creative work',
          valueProposition: 'Transformative creative work that doesn\'t just look beautiful - it drives results and builds lasting brand connections.',
          missionStatement: 'To craft authentic visual stories that resonate, inspire action, and elevate brands to their full potential.',
          brandVoice: {
            tone: 'Artistic, sophisticated, and collaborative',
            style: 'Visual-first, inspiring, and conceptual',
            personality: 'Creative visionary, brand storyteller, design perfectionist'
          },
          keyMessages: [
            'Your story, beautifully told',
            'Design that drives results',
            'Creativity meets strategy',
            'Brands that resonate'
          ],
          competitiveAdvantages: [
            'Award-winning creative team',
            'Strategic brand thinking',
            'Full-service capabilities',
            'Boutique agency attention'
          ],
          brandColors: {
            primary: '#EC4899',
            secondary: '#8B5CF6',
            accent: '#F59E0B',
            neutral: '#64748B'
          },
          images: [],
          videos: [],
          documents: [],
          tagline: 'Where Strategy Meets Beauty',
          websiteUrl: 'https://spectrumcreative.studio',
          contactEmail: 'hello@spectrumcreative.studio',
          location: 'Brooklyn, NY',
          bannerImageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200',
          logoUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400',
          engagementMetrics: [
            { label: 'Brands Launched', value: '120+', icon: 'sparkles' },
            { label: 'Design Awards', value: '18', icon: 'award' },
            { label: 'Client Satisfaction', value: '98%', icon: 'heart' },
            { label: 'Years Creating', value: '8', icon: 'palette' }
          ],
          pinnedPost: {
            content: '✨ Thrilled to share our latest brand identity for EcoFlow - a sustainable tech startup. Swipe through to see the full visual system. Link in bio!',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 567,
            shares: 123
          },
          feedSections: [
            {
              id: 'portfolio',
              title: 'Recent Work',
              icon: 'image',
              contentType: 'text',
              items: [
                {
                  id: 'work-1',
                  content: 'New Project: Complete brand refresh for wellness startup MindfulPath. From logo to packaging to digital experience.',
                  timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'work-2',
                  content: 'Just wrapped an amazing campaign for local nonprofit. Video case study dropping next week - stay tuned!',
                  timestamp: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            },
            {
              id: 'insights',
              title: 'Creative Insights',
              icon: 'lightbulb',
              contentType: 'text',
              items: [
                {
                  id: 'insight-1',
                  content: 'Blog Post: "The 2025 Brand Design Trends We\'re Watching" - minimal maximalism, kinetic typography, and authentic storytelling.',
                  timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'insight-2',
                  content: 'Behind the Scenes: Our creative process - from mood boards to final delivery. Sneak peek at how the magic happens.',
                  timestamp: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            }
          ]
        }
      },
      // 4. Research Lab - QuantumBio Research
      {
        id: 'quantumbio-research',
        name: 'QuantumBio Research Lab',
        profile: {
          summary: 'QuantumBio is a biotech research laboratory pioneering breakthrough discoveries in cellular biology and quantum medicine, translating complex science into life-changing therapies.',
          brandName: 'QuantumBio Research Lab',
          industry: 'Research & Science',
          targetAudience: 'Scientific community, grant agencies, research partners, and science-interested public',
          valueProposition: 'Cutting-edge biomedical research that pushes the boundaries of what\'s possible in cellular regeneration and disease treatment.',
          missionStatement: 'To advance human health through rigorous scientific research, innovative methodologies, and collaborative discovery in quantum biology.',
          brandVoice: {
            tone: 'Authoritative, precise, and intellectually curious',
            style: 'Evidence-based, scholarly yet accessible, discovery-focused',
            personality: 'Rigorous scientist, curious explorer, knowledge sharer'
          },
          keyMessages: [
            'Science at the quantum edge',
            'From discovery to impact',
            'Rigorous research, real results',
            'Advancing the frontiers of biology'
          ],
          competitiveAdvantages: [
            'State-of-the-art quantum imaging facilities',
            'Interdisciplinary research team',
            '$15M in active grant funding',
            'Publications in top-tier journals'
          ],
          brandColors: {
            primary: '#0891B2',
            secondary: '#7C3AED',
            accent: '#10B981',
            neutral: '#64748B'
          },
          images: [],
          videos: [],
          documents: [],
          tagline: 'Where Quantum Meets Biology',
          websiteUrl: 'https://quantumbio.research',
          contactEmail: 'info@quantumbio.research',
          location: 'Cambridge, MA',
          bannerImageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1200',
          logoUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400',
          engagementMetrics: [
            { label: 'Active Studies', value: '12', icon: 'flask' },
            { label: 'Publications', value: '87', icon: 'book' },
            { label: 'Grant Funding', value: '$15M', icon: 'dollar-sign' },
            { label: 'Team Scientists', value: '45', icon: 'users' }
          ],
          pinnedPost: {
            content: '🔬 Breakthrough! Our team has identified a novel pathway in cellular regeneration. Full paper published in Nature Cell Biology. Read more on our website.',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 1234,
            shares: 456
          },
          feedSections: [
            {
              id: 'discoveries',
              title: 'Latest Discoveries',
              icon: 'microscope',
              contentType: 'text',
              items: [
                {
                  id: 'discovery-1',
                  content: 'New Research: Our quantum imaging technique reveals previously unseen cellular structures. Implications for cancer treatment are significant.',
                  timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'discovery-2',
                  content: 'Lab Update: Successful completion of Phase 1 trials for our regenerative therapy. Moving to Phase 2 next quarter.',
                  timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            },
            {
              id: 'community',
              title: 'Research Community',
              icon: 'users',
              contentType: 'text',
              items: [
                {
                  id: 'community-1',
                  content: 'Public Lecture Series: Dr. Chen presents "Quantum Biology Explained" - Making cutting-edge research accessible to all. Register free!',
                  timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'community-2',
                  content: 'Grant Success: Awarded $3M NIH grant for our cellular regeneration program. Grateful to continue this important work.',
                  timestamp: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            }
          ]
        }
      },
      // 5. Volunteer Organization - Hope Harbor Community
      {
        id: 'hope-harbor',
        name: 'Hope Harbor Community',
        profile: {
          summary: 'Hope Harbor is a volunteer-driven community organization providing food assistance, shelter support, and educational programs to families in need across our city.',
          brandName: 'Hope Harbor Community',
          industry: 'Volunteer & Nonprofit',
          targetAudience: 'Volunteers, donors, community members, partner organizations, and families in need',
          valueProposition: 'Creating lasting change through compassionate community action, one neighbor at a time.',
          missionStatement: 'To build a stronger, more caring community by connecting volunteers with opportunities to serve and support our neighbors facing hardship.',
          brandVoice: {
            tone: 'Warm, hopeful, and action-oriented',
            style: 'Story-driven, heartfelt, and inclusive',
            personality: 'Compassionate neighbor, community builder, hope creator'
          },
          keyMessages: [
            'Together we can make a difference',
            'Neighbors helping neighbors',
            'Every act of kindness matters',
            'Building hope, one family at a time'
          ],
          competitiveAdvantages: [
            '500+ active volunteers',
            'Partnerships with 30+ local businesses',
            'Transparent impact reporting',
            'Low overhead - 92% to programs'
          ],
          brandColors: {
            primary: '#DC2626',
            secondary: '#2563EB',
            accent: '#F59E0B',
            neutral: '#64748B'
          },
          images: [],
          videos: [],
          documents: [],
          tagline: 'Where Community Creates Hope',
          websiteUrl: 'https://hopeharbor.org',
          contactEmail: 'volunteer@hopeharbor.org',
          location: 'Seattle, WA',
          bannerImageUrl: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200',
          logoUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400',
          engagementMetrics: [
            { label: 'Families Served', value: '2,500+', icon: 'heart' },
            { label: 'Volunteers', value: '500+', icon: 'users' },
            { label: 'Meals Provided', value: '75K+', icon: 'coffee' },
            { label: 'Hours Volunteered', value: '12K+', icon: 'clock' }
          ],
          pinnedPost: {
            content: '❤️ We did it! Thanks to your incredible generosity, we exceeded our winter fundraising goal. 100% of donations go directly to serving families in need. Thank you!',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            likes: 678,
            shares: 245
          },
          feedSections: [
            {
              id: 'impact',
              title: 'Community Impact',
              icon: 'trending-up',
              contentType: 'text',
              items: [
                {
                  id: 'impact-1',
                  content: 'This month we served 847 families through our food bank and provided emergency shelter for 23 individuals. Your support makes this possible!',
                  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'impact-2',
                  content: 'Success Story: Maria and her two children now have stable housing thanks to our rental assistance program. Read her inspiring journey.',
                  timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            },
            {
              id: 'volunteer-ops',
              title: 'Volunteer Opportunities',
              icon: 'hand-heart',
              contentType: 'text',
              items: [
                {
                  id: 'volunteer-1',
                  content: 'Join us Saturday for our community meal prep! We need 20 volunteers to help prepare 500 meals. Sign up link in bio.',
                  timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: 'volunteer-2',
                  content: 'Volunteer Spotlight: Meet James, who\'s been serving with Hope Harbor for 5 years. His dedication inspires us all! 💙',
                  timestamp: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()
                }
              ]
            }
          ]
        }
      }
    ];

    // Create brands
    for (const brand of brands) {
      await adminDb.collection('brands').doc(brand.id).set(brand);
      console.log(`Brand "${brand.name}" created with comprehensive profile.`);
    }

    // Define all users for all teams
    const allUsers = [
      // Lightning FC (Sports Team) users
      {
        uid: 'lightning-coach-01',
        email: 'coach@lightningfc.team',
        displayName: 'Coach Sarah Martinez',
        photoURL: 'https://i.pravatar.cc/150?u=coach@lightningfc.team',
        brandId: 'lightning-fc'
      },
      {
        uid: 'lightning-coordinator-01',
        email: 'alex@lightningfc.team',
        displayName: 'Alex Chen',
        photoURL: 'https://i.pravatar.cc/150?u=alex@lightningfc.team',
        brandId: 'lightning-fc'
      },
      // Nova Labs (Product Team) users
      {
        uid: 'nova-pm-01',
        email: 'sarah@novalabs.io',
        displayName: 'Sarah Kim',
        photoURL: 'https://i.pravatar.cc/150?u=sarah@novalabs.io',
        brandId: 'nova-labs'
      },
      {
        uid: 'nova-eng-01',
        email: 'james@novalabs.io',
        displayName: 'James Wilson',
        photoURL: 'https://i.pravatar.cc/150?u=james@novalabs.io',
        brandId: 'nova-labs'
      },
      // Spectrum Creative (Creative Agency) users
      {
        uid: 'spectrum-director-01',
        email: 'maya@spectrumcreative.studio',
        displayName: 'Maya Rodriguez',
        photoURL: 'https://i.pravatar.cc/150?u=maya@spectrumcreative.studio',
        brandId: 'spectrum-creative'
      },
      {
        uid: 'spectrum-designer-01',
        email: 'jordan@spectrumcreative.studio',
        displayName: 'Jordan Taylor',
        photoURL: 'https://i.pravatar.cc/150?u=jordan@spectrumcreative.studio',
        brandId: 'spectrum-creative'
      },
      // QuantumBio Research (Research Lab) users
      {
        uid: 'quantum-pi-01',
        email: 'dr.chen@quantumbio.research',
        displayName: 'Dr. Michael Chen',
        photoURL: 'https://i.pravatar.cc/150?u=dr.chen@quantumbio.research',
        brandId: 'quantumbio-research'
      },
      {
        uid: 'quantum-researcher-01',
        email: 'emma@quantumbio.research',
        displayName: 'Dr. Emma Johnson',
        photoURL: 'https://i.pravatar.cc/150?u=emma@quantumbio.research',
        brandId: 'quantumbio-research'
      },
      // Hope Harbor (Volunteer Organization) users
      {
        uid: 'harbor-director-01',
        email: 'director@hopeharbor.org',
        displayName: 'Maria Garcia',
        photoURL: 'https://i.pravatar.cc/150?u=director@hopeharbor.org',
        brandId: 'hope-harbor'
      },
      {
        uid: 'harbor-volunteer-01',
        email: 'tom@hopeharbor.org',
        displayName: 'Tom Anderson',
        photoURL: 'https://i.pravatar.cc/150?u=tom@hopeharbor.org',
        brandId: 'hope-harbor'
      }
    ];

    // Create all users for all brands
    for (const user of allUsers) {
      try {
        await adminAuth.getUserByEmail(user.email);
        console.log(`User ${user.email} already exists. Updating brandId and password.`);
        await adminAuth.updateUser(user.uid, { password: 'Welcome1!' });
        await adminDb.collection('users').doc(user.uid).set({ ...user }, { merge: true });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.log(`Creating user: ${user.email}`);
          await adminAuth.createUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            password: 'Welcome1!',
            emailVerified: true,
            disabled: false,
          });
          await adminDb.collection('users').doc(user.uid).set(user);
        } else {
          throw error;
        }
      }

      // Create brand membership record for each user
      const membershipId = `${user.brandId}_${user.uid}`;
      let userRole = 'CONTRIBUTOR';
      
      // Set manager roles for team leaders
      if (user.email === 'coach@lightningfc.team' || 
          user.email === 'sarah@novalabs.io' ||
          user.email === 'maya@spectrumcreative.studio' ||
          user.email === 'dr.chen@quantumbio.research' ||
          user.email === 'director@hopeharbor.org') {
        userRole = 'MANAGER';
      }
      
      await adminDb.collection('brandMembers').doc(membershipId).set({
        id: membershipId,
        brandId: user.brandId,
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName,
        userPhotoURL: user.photoURL || null,
        role: userRole,
        status: 'ACTIVE',
        invitedBy: user.uid,
        createdAt: now,
        updatedAt: now
      });
      
      console.log(`Brand membership created for ${user.email} with role ${userRole}`);
    }

    console.log('All users created successfully.');

    // Create team-specific sample images
    const sampleImages = [
      // Lightning FC - Sports Team Images
      {
        id: 'sports-image-01',
        brandId: 'lightning-fc',
        title: 'Game Day Action Shot',
        prompt: 'Dynamic soccer action photo, player scoring goal, energetic crowd, stadium lights',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
        generatedBy: 'lightning-coach-01',
        generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'sports-image-02',
        brandId: 'lightning-fc',
        title: 'Player Spotlight Portrait',
        prompt: 'Professional athlete portrait, soccer player in team uniform, confident pose',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?w=800',
        generatedBy: 'lightning-coordinator-01',
        generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // Nova Labs - Product Team Images
      {
        id: 'product-image-01',
        brandId: 'nova-labs',
        title: 'Product Feature Showcase',
        prompt: 'Clean SaaS product interface screenshot, modern UI design, productivity dashboard',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
        generatedBy: 'nova-pm-01',
        generatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'product-image-02',
        brandId: 'nova-labs',
        title: 'Release Announcement Graphic',
        prompt: 'Modern tech announcement design, new feature highlight, gradient background',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
        generatedBy: 'nova-eng-01',
        generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // Spectrum Creative - Creative Agency Images
      {
        id: 'creative-image-01',
        brandId: 'spectrum-creative',
        title: 'Brand Mood Board',
        prompt: 'Artistic mood board collage, color palette, typography samples, design inspiration',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
        generatedBy: 'spectrum-director-01',
        generatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'creative-image-02',
        brandId: 'spectrum-creative',
        title: 'Client Pitch Deck Cover',
        prompt: 'Professional presentation cover design, elegant typography, minimalist aesthetic',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
        generatedBy: 'spectrum-designer-01',
        generatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // QuantumBio - Research Lab Images
      {
        id: 'research-image-01',
        brandId: 'quantumbio-research',
        title: 'Lab Equipment Visualization',
        prompt: 'Scientific laboratory equipment, microscope, research facility, high-tech medical research',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800',
        generatedBy: 'quantum-pi-01',
        generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'research-image-02',
        brandId: 'quantumbio-research',
        title: 'Conference Poster Design',
        prompt: 'Academic research poster, data visualization, scientific charts, professional layout',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800',
        generatedBy: 'quantum-researcher-01',
        generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // Hope Harbor - Volunteer Organization Images
      {
        id: 'volunteer-image-01',
        brandId: 'hope-harbor',
        title: 'Community Service Event',
        prompt: 'Volunteers serving meals, community kitchen, people helping others, warm lighting',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800',
        generatedBy: 'harbor-director-01',
        generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'volunteer-image-02',
        brandId: 'hope-harbor',
        title: 'Impact Story Visual',
        prompt: 'Heartwarming volunteer story, helping hands, community support, hopeful atmosphere',
        sourceImageUrl: '',
        generatedImageUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800',
        generatedBy: 'harbor-volunteer-01',
        generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      }
    ];

    // Create team-specific sample videos
    const sampleVideos = [
      // Lightning FC - Sports Team Videos
      {
        id: 'sports-video-01',
        brandId: 'lightning-fc',
        title: 'Game Highlights Reel',
        description: 'Epic highlights from championship game win, player celebrations, best moments',
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        generatedBy: 'lightning-coach-01',
        generatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'sports-video-02',
        brandId: 'lightning-fc',
        title: 'Training Session Hype Video',
        description: 'Motivational training montage showcasing team dedication and skill development',
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
        generatedBy: 'lightning-coordinator-01',
        generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // Nova Labs - Product Team Videos
      {
        id: 'product-video-01',
        brandId: 'nova-labs',
        title: 'Feature Release Demo',
        description: 'Quick demo showcasing new TaskFlow 3.0 automation features',
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        generatedBy: 'nova-pm-01',
        generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // Spectrum Creative - Creative Agency Videos
      {
        id: 'creative-video-01',
        brandId: 'spectrum-creative',
        title: 'Client Project Case Study',
        description: 'Behind-the-scenes look at our creative process for recent brand launch',
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
        generatedBy: 'spectrum-director-01',
        generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // QuantumBio - Research Lab Videos
      {
        id: 'research-video-01',
        brandId: 'quantumbio-research',
        title: 'Research Breakthrough Explainer',
        description: 'Public-friendly explanation of our latest cellular regeneration discovery',
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        generatedBy: 'quantum-pi-01',
        generatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      },
      // Hope Harbor - Volunteer Organization Videos
      {
        id: 'volunteer-video-01',
        brandId: 'hope-harbor',
        title: 'Impact Story: Maria\'s Journey',
        description: 'Heartwarming story of how our community support changed one family\'s life',
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
        generatedBy: 'harbor-director-01',
        generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now
      }
    ];

    // Insert sample images
    for (const image of sampleImages) {
      await adminDb.collection('images').doc(image.id).set(image);
    }
    console.log('Sample images created.');

    // Insert sample videos  
    for (const video of sampleVideos) {
      await adminDb.collection('videos').doc(video.id).set(video);
    }
    console.log('Sample videos created.');

    // Create sample collections
    const sampleCollections = [
      {
        id: 'col-marketing-01',
        brandId: 'lightning-fc',
        name: 'Championship Marketing',
        description: 'Assets for the championship game marketing push',
        mediaIds: ['sports-image-01', 'sports-video-01'],
        createdAt: now,
        updatedAt: now,
        createdBy: 'lightning-coach-01'
      },
      {
        id: 'col-launch-01',
        brandId: 'nova-labs',
        name: 'TaskFlow 3.0 Launch',
        description: 'All assets for the V3 product launch',
        mediaIds: ['product-image-01', 'product-video-01'],
        createdAt: now,
        updatedAt: now,
        createdBy: 'nova-pm-01'
      },
      {
        id: 'col-pitch-01',
        brandId: 'spectrum-creative',
        name: 'EcoFlow Pitch Assets',
        description: 'Curated assets for the EcoFlow client pitch',
        mediaIds: ['creative-image-01', 'creative-video-01'],
        createdAt: now,
        updatedAt: now,
        createdBy: 'spectrum-director-01'
      }
    ];

    for (const collection of sampleCollections) {
      await adminDb.collection('collections').doc(collection.id).set(collection);
    }
    console.log('Sample collections created.');

    // Create Unified Media entries for all images and videos
    console.log('Creating Unified Media entries...');

    // Process Images
    for (const image of sampleImages) {
      const unifiedMediaId = `unified-${image.id}`;
      await adminDb.collection('unifiedMedia').doc(unifiedMediaId).set({
        id: unifiedMediaId,
        brandId: image.brandId,
        type: 'image',
        url: image.generatedImageUrl,
        thumbnailUrl: image.generatedImageUrl,
        title: image.title,
        description: image.prompt,
        tags: ['sample', 'seed-data'],
        collections: [], // Could map to collections if needed
        source: 'ai-generated',
        sourceImageId: image.id,
        createdAt: image.createdAt || new Date().toISOString(),
        createdBy: image.generatedBy || 'system',
        isPublished: false,
        generatedBy: image.generatedBy,
        prompt: image.prompt
      });
    }

    // Process Videos
    for (const video of sampleVideos) {
      const unifiedMediaId = `unified-${video.id}`;
      await adminDb.collection('unifiedMedia').doc(unifiedMediaId).set({
        id: unifiedMediaId,
        brandId: video.brandId,
        type: 'video',
        url: video.videoUrl,
        thumbnailUrl: video.videoUrl, // In a real app, this would be a thumbnail
        title: video.title,
        description: video.description,
        tags: ['sample', 'seed-data'],
        collections: [],
        source: 'ai-generated',
        sourceVideoId: video.id,
        createdAt: video.generatedAt || new Date().toISOString(),
        createdBy: video.generatedBy || 'system',
        isPublished: false,
        generatedBy: video.generatedBy,
        prompt: video.description // Using description as prompt for videos
      });
    }
    console.log('Unified Media entries created.');

    // Create team-specific sample campaigns
    const sampleCampaigns = [
      // Lightning FC - Sports Team Event
      {
        id: 'demo-campaign-01',
        brandId: 'lightning-fc',
        name: 'Championship Weekend Hype Event',
        description: 'Multi-day event coverage for our championship match weekend with game recaps and player spotlights',
        timeline: [
          {
            day: 1,
            date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-01',
                contentType: 'social-post',
                keyMessage: 'Pre-game hype and team ready announcement',
                toneOfVoice: 'Energetic and motivating',
                assetUrl: sampleImages[0].generatedImageUrl,
                scheduledTime: '08:00',
                platform: 'Instagram'
              },
              {
                id: 'block-02',
                contentType: 'video-post',
                keyMessage: 'Behind-the-scenes training montage',
                toneOfVoice: 'Inspirational and dynamic',
                assetUrl: sampleVideos[0].videoUrl,
                scheduledTime: '14:00',
                platform: 'YouTube'
              }
            ]
          },
          {
            day: 2,
            date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-03',
                contentType: 'social-post',
                keyMessage: 'Game highlights and celebration post',
                toneOfVoice: 'Celebratory and proud',
                assetUrl: sampleImages[1].generatedImageUrl,
                scheduledTime: '20:00',
                platform: 'Twitter'
              }
            ]
          }
        ],
        status: 'active',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'lightning-coach-01',
        lastSavedBy: 'lightning-coordinator-01',
        lastSavedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      // Nova Labs - Product Team Launch
      {
        id: 'demo-campaign-02',
        brandId: 'nova-labs',
        name: 'TaskFlow 3.0 Product Launch',
        description: 'Multi-channel product launch campaign with release notes and feature announcements',
        timeline: [
          {
            day: 1,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-04',
                contentType: 'social-post',
                keyMessage: 'Teaser announcement for upcoming product launch',
                toneOfVoice: 'Exciting and anticipatory',
                assetUrl: sampleImages[2].generatedImageUrl,
                scheduledTime: '09:00',
                platform: 'LinkedIn'
              },
              {
                id: 'block-05',
                contentType: 'email',
                keyMessage: 'Email announcement to subscriber list with release notes',
                toneOfVoice: 'Professional and informative',
                assetUrl: sampleImages[3].generatedImageUrl,
                scheduledTime: '10:30',
                platform: 'Email'
              }
            ]
          },
          {
            day: 2,
            date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-06',
                contentType: 'video-post',
                keyMessage: 'Product demo and feature highlights walkthrough',
                toneOfVoice: 'Educational and engaging',
                assetUrl: sampleVideos[2].videoUrl,
                scheduledTime: '14:00',
                platform: 'YouTube'
              }
            ]
          }
        ],
        status: 'draft',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'nova-pm-01',
        lastSavedBy: 'nova-eng-01',
        lastSavedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      // Spectrum Creative - Client Pitch
      {
        id: 'demo-campaign-03',
        brandId: 'spectrum-creative',
        name: 'Luxury Brand Rebrand Pitch',
        description: 'Comprehensive pitch deck and mood boards for premium client brand refresh project',
        timeline: [
          {
            day: 1,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-07',
                contentType: 'social-post',
                keyMessage: 'Case study announcement showcasing our creative process',
                toneOfVoice: 'Artistic and sophisticated',
                assetUrl: sampleImages[4].generatedImageUrl,
                scheduledTime: '09:00',
                platform: 'Instagram'
              },
              {
                id: 'block-08',
                contentType: 'video-post',
                keyMessage: 'Behind-the-scenes creative process video',
                toneOfVoice: 'Inspiring and authentic',
                assetUrl: sampleVideos[3].videoUrl,
                scheduledTime: '15:00',
                platform: 'Vimeo'
              }
            ]
          },
          {
            day: 2,
            date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-09',
                contentType: 'social-post',
                keyMessage: 'Mood board reveal and design philosophy',
                toneOfVoice: 'Refined and creative',
                assetUrl: sampleImages[5].generatedImageUrl,
                scheduledTime: '11:00',
                platform: 'Behance'
              }
            ]
          }
        ],
        status: 'draft',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now,
        createdBy: 'spectrum-director-01',
        lastSavedBy: 'spectrum-designer-01',
        lastSavedAt: now
      },
      // QuantumBio Research - Grant Proposal
      {
        id: 'demo-campaign-04',
        brandId: 'quantumbio-research',
        name: 'NIH Grant Proposal Initiative',
        description: 'Research paper summaries and grant proposal materials for cellular regeneration study',
        timeline: [
          {
            day: 1,
            date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-10',
                contentType: 'social-post',
                keyMessage: 'Research breakthrough announcement for academic community',
                toneOfVoice: 'Authoritative and scientific',
                assetUrl: sampleImages[6].generatedImageUrl,
                scheduledTime: '10:00',
                platform: 'LinkedIn'
              },
              {
                id: 'block-11',
                contentType: 'video-post',
                keyMessage: 'Research explainer video for public outreach',
                toneOfVoice: 'Educational and accessible',
                assetUrl: sampleVideos[4].videoUrl,
                scheduledTime: '14:00',
                platform: 'YouTube'
              }
            ]
          },
          {
            day: 2,
            date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-12',
                contentType: 'social-post',
                keyMessage: 'Conference poster presentation announcement',
                toneOfVoice: 'Professional and rigorous',
                assetUrl: sampleImages[7].generatedImageUrl,
                scheduledTime: '09:00',
                platform: 'ResearchGate'
              }
            ]
          }
        ],
        status: 'draft',
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'quantum-pi-01',
        lastSavedBy: 'quantum-researcher-01',
        lastSavedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      // Hope Harbor - Fundraising Appeal
      {
        id: 'demo-campaign-05',
        brandId: 'hope-harbor',
        name: 'Winter Fundraising Appeal',
        description: 'Heartfelt fundraising campaign with impact reports and volunteer stories',
        timeline: [
          {
            day: 1,
            date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-13',
                contentType: 'social-post',
                keyMessage: 'Winter needs announcement and donation appeal',
                toneOfVoice: 'Warm and compassionate',
                assetUrl: sampleImages[8].generatedImageUrl,
                scheduledTime: '07:00',
                platform: 'Facebook'
              },
              {
                id: 'block-14',
                contentType: 'email',
                keyMessage: 'Impact report showing how donations help families',
                toneOfVoice: 'Grateful and hopeful',
                assetUrl: sampleImages[9].generatedImageUrl,
                scheduledTime: '10:00',
                platform: 'Email'
              }
            ]
          },
          {
            day: 2,
            date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            contentBlocks: [
              {
                id: 'block-15',
                contentType: 'video-post',
                keyMessage: 'Volunteer impact story video featuring family testimonial',
                toneOfVoice: 'Heartfelt and authentic',
                assetUrl: sampleVideos[5].videoUrl,
                scheduledTime: '11:00',
                platform: 'YouTube'
              }
            ]
          }
        ],
        status: 'active',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'harbor-director-01',
        lastSavedBy: 'harbor-volunteer-01',
        lastSavedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Insert sample campaigns
    for (const campaign of sampleCampaigns) {
      await adminDb.collection('campaigns').doc(campaign.id).set(campaign);
    }
    console.log('Sample campaigns created with complete audit trails.');

    // ========== BRAND SOUL / TEAM INTELLIGENCE SEED DATA ==========
    console.log('Creating Brand Soul / Team Intelligence seed data...');

    // Create Brand Soul documents with synthesized brand knowledge for each brand
    const brandSoulData = [
      {
        brandId: 'lightning-fc',
        latestVersionId: 'v1',
        status: 'published',
        voiceProfile: {
          tone: {
            primary: 'Energetic',
            secondary: ['Motivating', 'Team-focused', 'Celebratory'],
            avoid: ['Negative', 'Defeatist', 'Overly casual']
          },
          personality: {
            traits: [
              { name: 'Passionate', strength: 0.95, evidence: ['Championship mindset', 'Player dedication stories'] },
              { name: 'Supportive', strength: 0.9, evidence: ['Team-first mentality', 'Community involvement'] },
              { name: 'Competitive', strength: 0.85, evidence: ['Win-loss records', 'Tournament participation'] }
            ]
          },
          writingStyle: {
            sentenceLength: 'short-to-medium',
            paragraphStructure: 'punchy',
            preferredPhrases: ['Let\'s go!', 'Game on!', 'Together we win']
          }
        },
        factLibrary: {
          facts: [
            { id: 'fact-lfc-1', category: 'Achievement', fact: 'Lightning FC has won 12 championships in 15 years', sources: [{ artifactId: 'artifact-lfc-1', snippet: 'Championship history', confidence: 0.95 }], confidence: 0.95, importance: 'high', tags: ['sports', 'achievements'], relatedFacts: [] },
            { id: 'fact-lfc-2', category: 'Community', fact: '250+ active players across all age groups', sources: [{ artifactId: 'artifact-lfc-1', snippet: 'Player roster', confidence: 0.9 }], confidence: 0.9, importance: 'high', tags: ['community', 'growth'], relatedFacts: [] },
            { id: 'fact-lfc-3', category: 'Education', fact: '45 players have committed to college soccer programs', sources: [{ artifactId: 'artifact-lfc-2', snippet: 'College placement records', confidence: 0.92 }], confidence: 0.92, importance: 'high', tags: ['education', 'achievements'], relatedFacts: [] }
          ]
        },
        messagingFramework: {
          mission: 'To develop skilled athletes and outstanding individuals through the beautiful game of soccer',
          vision: 'Building the next generation of soccer champions and community leaders',
          taglines: ['Strike Fast. Play Smart. Win Together.', 'Champions on and off the field'],
          values: [
            { name: 'Excellence', description: 'Striving for the highest standards in everything we do', examples: ['Professional coaching', 'Top facilities'], sources: ['artifact-lfc-1'] },
            { name: 'Teamwork', description: 'Success through collaboration and mutual support', examples: ['Team-first mentality', 'Peer mentoring'], sources: ['artifact-lfc-1'] },
            { name: 'Character', description: 'Building strong individuals who lead by example', examples: ['Community service', 'Academic excellence'], sources: ['artifact-lfc-2'] }
          ],
          keyMessages: [
            { theme: 'Development', messages: ['Elite training for every player', 'Skills that last a lifetime'], importance: 'high', frequency: 'weekly' },
            { theme: 'Community', messages: ['More than a team - a family', 'Supporting each other on and off the field'], importance: 'high', frequency: 'weekly' }
          ]
        },
        visualIdentity: {
          colors: { primary: ['#2CAAA0'], secondary: ['#3DD68C'], accent: ['#FFD700'] },
          typography: { fonts: ['Montserrat', 'Open Sans'], style: 'Bold and dynamic' },
          imageStyle: {
            style: 'Action-packed sports photography',
            subjects: ['Players in action', 'Team celebrations', 'Training moments'],
            examples: [],
            photographicPreferences: { lighting: 'Natural outdoor', mood: 'Energetic and triumphant', composition: 'Dynamic angles', shotPreferences: ['Action shots', 'Team huddles', 'Goal celebrations'] },
            scenePreferences: { commonScenes: ['Soccer field', 'Stadium', 'Training grounds'], avoidScenes: ['Empty venues', 'Defeat moments'] }
          }
        },
        statistics: { totalArtifacts: 3, extractedInsights: 15, lastUpdated: now },
        createdAt: now,
        updatedAt: now
      },
      {
        brandId: 'nova-labs',
        latestVersionId: 'v1',
        status: 'published',
        voiceProfile: {
          tone: {
            primary: 'Innovative',
            secondary: ['Helpful', 'Solution-focused', 'Forward-thinking'],
            avoid: ['Jargon-heavy', 'Condescending', 'Overly technical']
          },
          personality: {
            traits: [
              { name: 'Innovative', strength: 0.95, evidence: ['AI-powered features', 'Patent applications'] },
              { name: 'User-centric', strength: 0.92, evidence: ['UX research', 'Customer feedback integration'] },
              { name: 'Reliable', strength: 0.88, evidence: ['99.9% uptime', 'Security certifications'] }
            ]
          },
          writingStyle: {
            sentenceLength: 'medium',
            paragraphStructure: 'clear and structured',
            preferredPhrases: ['Work smarter', 'Seamlessly integrate', 'Boost productivity']
          }
        },
        factLibrary: {
          facts: [
            { id: 'fact-nl-1', category: 'Product', fact: 'TaskFlow serves over 50,000 active users globally', sources: [{ artifactId: 'artifact-nl-1', snippet: 'User metrics', confidence: 0.95 }], confidence: 0.95, importance: 'high', tags: ['product', 'growth'], relatedFacts: [] },
            { id: 'fact-nl-2', category: 'Technology', fact: 'AI automation has saved users over 500,000 hours', sources: [{ artifactId: 'artifact-nl-1', snippet: 'Time savings report', confidence: 0.9 }], confidence: 0.9, importance: 'high', tags: ['ai', 'productivity'], relatedFacts: [] },
            { id: 'fact-nl-3', category: 'Integration', fact: '100+ integrations with popular tools like Slack, GitHub, and Linear', sources: [{ artifactId: 'artifact-nl-2', snippet: 'Integration catalog', confidence: 0.92 }], confidence: 0.92, importance: 'medium', tags: ['integrations', 'ecosystem'], relatedFacts: [] }
          ]
        },
        messagingFramework: {
          mission: 'To empower teams with intelligent software that amplifies their productivity and creativity',
          vision: 'A world where AI handles the busywork so humans can focus on meaningful work',
          taglines: ['Productivity Powered by Intelligence', 'Work smarter, not harder'],
          values: [
            { name: 'Innovation', description: 'Pushing boundaries with cutting-edge AI technology', examples: ['Smart Workflows', 'Predictive analytics'], sources: ['artifact-nl-1'] },
            { name: 'Simplicity', description: 'Making complex technology accessible to everyone', examples: ['Intuitive UI', 'One-click automation'], sources: ['artifact-nl-2'] },
            { name: 'Trust', description: 'Enterprise-grade security and reliability', examples: ['SOC 2 compliance', '99.9% uptime'], sources: ['artifact-nl-1'] }
          ],
          keyMessages: [
            { theme: 'Productivity', messages: ['Automate repetitive tasks', 'Focus on what matters'], importance: 'high', frequency: 'daily' },
            { theme: 'Innovation', messages: ['AI that learns your workflow', 'Always improving, always evolving'], importance: 'high', frequency: 'weekly' }
          ]
        },
        visualIdentity: {
          colors: { primary: ['#5B21B6'], secondary: ['#0EA5E9'], accent: ['#F97316'] },
          typography: { fonts: ['Inter', 'JetBrains Mono'], style: 'Clean and modern' },
          imageStyle: {
            style: 'Minimalist tech aesthetic',
            subjects: ['Product screenshots', 'Team collaboration', 'Data visualizations'],
            examples: [],
            photographicPreferences: { lighting: 'Soft studio', mood: 'Professional and innovative', composition: 'Clean lines', shotPreferences: ['Product UI', 'Team moments', 'Workspace setups'] },
            scenePreferences: { commonScenes: ['Modern office', 'Home workspace', 'Coffee shop'], avoidScenes: ['Cluttered desks', 'Outdated technology'] }
          }
        },
        statistics: { totalArtifacts: 4, extractedInsights: 18, lastUpdated: now },
        createdAt: now,
        updatedAt: now
      },
      {
        brandId: 'spectrum-creative',
        latestVersionId: 'v1',
        status: 'published',
        voiceProfile: {
          tone: {
            primary: 'Artistic',
            secondary: ['Sophisticated', 'Collaborative', 'Inspiring'],
            avoid: ['Generic', 'Corporate-speak', 'Rushed']
          },
          personality: {
            traits: [
              { name: 'Creative', strength: 0.98, evidence: ['Award-winning designs', 'Client testimonials'] },
              { name: 'Strategic', strength: 0.9, evidence: ['Brand strategy work', 'Results-driven approach'] },
              { name: 'Boutique', strength: 0.85, evidence: ['Personalized service', 'Limited client roster'] }
            ]
          },
          writingStyle: {
            sentenceLength: 'varied',
            paragraphStructure: 'flowing and narrative',
            preferredPhrases: ['Beautifully crafted', 'Story-driven', 'Elevated design']
          }
        },
        factLibrary: {
          facts: [
            { id: 'fact-sc-1', category: 'Achievement', fact: 'Won 18 design awards including 3 Webby Awards', sources: [{ artifactId: 'artifact-sc-1', snippet: 'Awards page', confidence: 0.95 }], confidence: 0.95, importance: 'high', tags: ['awards', 'recognition'], relatedFacts: [] },
            { id: 'fact-sc-2', category: 'Portfolio', fact: '120+ brands launched across lifestyle, tech, and nonprofit sectors', sources: [{ artifactId: 'artifact-sc-1', snippet: 'Portfolio count', confidence: 0.92 }], confidence: 0.92, importance: 'high', tags: ['portfolio', 'experience'], relatedFacts: [] },
            { id: 'fact-sc-3', category: 'Client', fact: '98% client satisfaction rate with high repeat engagement', sources: [{ artifactId: 'artifact-sc-2', snippet: 'Client survey', confidence: 0.9 }], confidence: 0.9, importance: 'high', tags: ['clients', 'satisfaction'], relatedFacts: [] }
          ]
        },
        messagingFramework: {
          mission: 'To craft authentic visual stories that resonate, inspire action, and elevate brands',
          vision: 'A world where every brand has a story worth telling and the visuals to tell it beautifully',
          taglines: ['Where Strategy Meets Beauty', 'Your story, beautifully told'],
          values: [
            { name: 'Authenticity', description: 'Every brand has a unique story to tell', examples: ['Deep discovery process', 'Custom solutions'], sources: ['artifact-sc-1'] },
            { name: 'Craft', description: 'Attention to every detail, every pixel, every word', examples: ['Handcrafted designs', 'Quality over quantity'], sources: ['artifact-sc-2'] },
            { name: 'Impact', description: 'Design that drives real business results', examples: ['Increased conversions', 'Brand recognition'], sources: ['artifact-sc-1'] }
          ],
          keyMessages: [
            { theme: 'Craft', messages: ['Every detail matters', 'Design with purpose'], importance: 'high', frequency: 'weekly' },
            { theme: 'Results', messages: ['Beauty that converts', 'Strategy-first creativity'], importance: 'high', frequency: 'weekly' }
          ]
        },
        visualIdentity: {
          colors: { primary: ['#EC4899'], secondary: ['#8B5CF6'], accent: ['#F59E0B'] },
          typography: { fonts: ['Playfair Display', 'Lato'], style: 'Elegant with creative flair' },
          imageStyle: {
            style: 'Editorial and artistic',
            subjects: ['Portfolio pieces', 'Behind-the-scenes', 'Design details'],
            examples: [],
            photographicPreferences: { lighting: 'Dramatic studio', mood: 'Sophisticated and inspiring', composition: 'Rule of thirds with bold crops', shotPreferences: ['Close-up details', 'Lifestyle shots', 'Process moments'] },
            scenePreferences: { commonScenes: ['Design studio', 'Client workspace', 'Creative process'], avoidScenes: ['Generic stock', 'Overly posed'] }
          }
        },
        statistics: { totalArtifacts: 5, extractedInsights: 22, lastUpdated: now },
        createdAt: now,
        updatedAt: now
      }
    ];

    // Insert Brand Soul documents
    for (const soul of brandSoulData) {
      await adminDb.collection('brandSoul').doc(soul.brandId).set(soul);
    }
    console.log(`Created ${brandSoulData.length} Brand Soul documents.`);

    // Create Brand Artifacts (source documents for Brand Soul)
    const brandArtifacts = [
      // Lightning FC Artifacts
      { id: 'artifact-lfc-1', brandId: 'lightning-fc', type: 'website', metadata: { title: 'Lightning FC Official Website', url: 'https://lightningfc.team', description: 'Main website content' }, status: 'extracted', visibility: 'team', createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'lightning-coach-01', extractedInsights: ['Championship history', 'Player development program', 'Community initiatives'] },
      { id: 'artifact-lfc-2', brandId: 'lightning-fc', type: 'manual-text', metadata: { title: 'College Placement Records', description: 'Historical data on player college commitments' }, status: 'extracted', visibility: 'team', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'lightning-coordinator-01', extractedInsights: ['45 college commits', 'D1 placements', 'Scholarship values'] },
      { id: 'artifact-lfc-3', brandId: 'lightning-fc', type: 'youtube', metadata: { title: 'Championship Highlights 2024', url: 'https://youtube.com/watch?v=example1', description: 'Season highlights video' }, status: 'pending', visibility: 'private', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'lightning-coach-01', extractedInsights: [] },
      // Nova Labs Artifacts
      { id: 'artifact-nl-1', brandId: 'nova-labs', type: 'document', metadata: { title: 'TaskFlow Product Brief', fileName: 'taskflow-product-brief.pdf', description: 'Product documentation and metrics' }, status: 'extracted', visibility: 'team', createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'nova-pm-01', extractedInsights: ['50K+ users', 'AI automation features', 'Enterprise security'] },
      { id: 'artifact-nl-2', brandId: 'nova-labs', type: 'website', metadata: { title: 'Nova Labs Integration Docs', url: 'https://docs.novalabs.io', description: 'Integration documentation' }, status: 'extracted', visibility: 'team', createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'nova-eng-01', extractedInsights: ['100+ integrations', 'API documentation', 'Developer resources'] },
      { id: 'artifact-nl-3', brandId: 'nova-labs', type: 'manual-text', metadata: { title: 'Customer Success Stories', description: 'Compilation of customer testimonials' }, status: 'pending', visibility: 'pending_approval', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'nova-pm-01', extractedInsights: [] },
      // Spectrum Creative Artifacts
      { id: 'artifact-sc-1', brandId: 'spectrum-creative', type: 'website', metadata: { title: 'Spectrum Portfolio Site', url: 'https://spectrumcreative.studio', description: 'Agency portfolio and case studies' }, status: 'extracted', visibility: 'team', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'spectrum-director-01', extractedInsights: ['Award-winning work', 'Brand strategy approach', 'Client roster'] },
      { id: 'artifact-sc-2', brandId: 'spectrum-creative', type: 'document', metadata: { title: 'Brand Guidelines Template', fileName: 'brand-guidelines-template.pdf', description: 'Internal brand guidelines document' }, status: 'extracted', visibility: 'team', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'spectrum-designer-01', extractedInsights: ['Color systems', 'Typography rules', 'Voice guidelines'] },
      { id: 'artifact-sc-3', brandId: 'spectrum-creative', type: 'image', metadata: { title: 'Mood Board Collection', description: 'Visual inspiration for client projects' }, status: 'pending', visibility: 'private', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'spectrum-designer-01', extractedInsights: [] }
    ];

    // Insert Brand Artifacts
    for (const artifact of brandArtifacts) {
      await adminDb.collection('brands').doc(artifact.brandId)
        .collection('brandArtifacts').doc(artifact.id).set(artifact);
    }
    console.log(`Created ${brandArtifacts.length} Brand Artifacts.`);

    // ========== INDIVIDUAL IDENTITIES SEED DATA ==========
    console.log('Creating Individual Identities...');

    const individualIdentities = [
      {
        id: 'identity-lightning-coach-01',
        brandId: 'lightning-fc',
        userId: 'lightning-coach-01',
        roleTitle: 'Head Coach & Director of Player Development',
        skills: ['Soccer coaching', 'Youth development', 'Team leadership', 'Sports psychology'],
        achievements: ['15 years coaching experience', '12 championship titles', '45+ college placements'],
        personalMission: 'To inspire young athletes to reach their full potential on and off the field',
        values: ['Excellence', 'Integrity', 'Perseverance', 'Teamwork'],
        testimonials: [
          { author: 'Parent', quote: 'Coach Martinez transformed our son\'s confidence and skills.', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        socialLinks: { linkedin: 'https://linkedin.com/in/sarah-martinez-coach', twitter: 'https://twitter.com/coachsarah' },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'identity-nova-pm-01',
        brandId: 'nova-labs',
        userId: 'nova-pm-01',
        roleTitle: 'Head of Product',
        skills: ['Product strategy', 'User research', 'Agile methodologies', 'Data analysis', 'AI/ML'],
        achievements: ['Launched TaskFlow 3.0', 'Grew user base 300%', 'Built team of 15 PMs'],
        personalMission: 'To create products that genuinely make people\'s work lives better',
        values: ['User-first', 'Innovation', 'Transparency', 'Continuous improvement'],
        testimonials: [
          { author: 'CEO', quote: 'Sarah has been instrumental in shaping our product vision and execution.', date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        socialLinks: { linkedin: 'https://linkedin.com/in/sarah-kim-pm', twitter: 'https://twitter.com/sarahkim_pm' },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'identity-spectrum-director-01',
        brandId: 'spectrum-creative',
        userId: 'spectrum-director-01',
        roleTitle: 'Creative Director & Founder',
        skills: ['Brand strategy', 'Visual design', 'Art direction', 'Client relations', 'Team leadership'],
        achievements: ['Founded Spectrum Creative', '18 design awards', '120+ brands launched'],
        personalMission: 'To help brands tell their authentic stories through exceptional design',
        values: ['Authenticity', 'Craftsmanship', 'Collaboration', 'Impact'],
        testimonials: [
          { author: 'Client', quote: 'Maya\'s vision completely transformed our brand identity.', date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        socialLinks: { linkedin: 'https://linkedin.com/in/maya-rodriguez-design', instagram: 'https://instagram.com/mayarodriguezdesign' },
        createdAt: now,
        updatedAt: now
      }
    ];

    for (const identity of individualIdentities) {
      await adminDb.collection('individualIdentities').doc(identity.id).set(identity);
    }
    console.log(`Created ${individualIdentities.length} Individual Identities.`);

    // ========== CHAT HISTORY SEED DATA ==========
    console.log('Creating Chat History seed data...');

    const chatHistoryData = [
      // Lightning FC chat history
      {
        id: 'chat-lfc-session-1',
        brandId: 'lightning-fc',
        userId: 'lightning-coach-01',
        sessionId: 'session-lfc-001',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Help me create social media content for our upcoming championship game', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), mode: 'agent' },
          { id: 'msg-2', role: 'assistant', content: 'I\'d be happy to help you create engaging content for the championship! Based on Lightning FC\'s brand voice, here are some ideas:\n\n**Pre-Game Hype:**\n- "Game day is HERE! Lightning FC is ready to strike. Who\'s with us? #ChampionshipBound"\n\n**Player Spotlight:**\n- "Meet the players who made this journey possible. Swipe to see our championship roster!"\n\nWould you like me to generate images to accompany these posts?', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30000).toISOString(), mode: 'agent' },
          { id: 'msg-3', role: 'user', content: 'Yes, generate a hype image for the game', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60000).toISOString(), mode: 'agent' },
          { id: 'msg-4', role: 'assistant', content: 'I\'ve created a dynamic championship hype image featuring your team colors (teal and gold) with an energetic composition. The image captures the excitement and competitive spirit that defines Lightning FC. You can find it in your media library!', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 90000).toISOString(), mode: 'agent', mediaData: [{ type: 'image', url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800' }] }
        ],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 90000).toISOString()
      },
      // Nova Labs chat history
      {
        id: 'chat-nl-session-1',
        brandId: 'nova-labs',
        userId: 'nova-pm-01',
        sessionId: 'session-nl-001',
        messages: [
          { id: 'msg-1', role: 'user', content: 'I need to create a product launch announcement for TaskFlow 3.0', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), mode: 'agent' },
          { id: 'msg-2', role: 'assistant', content: 'Great! TaskFlow 3.0 sounds exciting. Let me help you craft a compelling launch announcement. Based on Nova Labs\' brand voice (innovative, helpful, solution-focused), here\'s a draft:\n\n**Headline:** "TaskFlow 3.0: Work Smarter with AI-Powered Automation"\n\n**Key Points:**\n- Smart Workflows that learn your team\'s patterns\n- 50% faster task completion on average\n- Seamless integration with your existing tools\n\nWant me to generate supporting visuals?', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 45000).toISOString(), mode: 'agent' },
          { id: 'msg-3', role: 'user', content: 'Create an event for the launch party', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 120000).toISOString(), mode: 'agent' },
          { id: 'msg-4', role: 'assistant', content: 'I\'ve created a launch event for you!\n\n**TaskFlow 3.0 Launch Party**\n- Date: Next Friday at 6:00 PM\n- Location: Nova Labs HQ, San Francisco\n- Type: Product Launch\n\nThe event has been added to your calendar. Would you like me to generate promotional materials for the event?', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 150000).toISOString(), mode: 'agent', structuredData: { type: 'event', name: 'TaskFlow 3.0 Launch Party', date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } }
        ],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 150000).toISOString()
      }
    ];

    for (const chat of chatHistoryData) {
      await adminDb.collection('brands').doc(chat.brandId)
        .collection('chatHistory').doc(chat.id).set(chat);
    }
    console.log(`Created ${chatHistoryData.length} Chat History sessions.`);

    // ========== MEMORIES SEED DATA ==========
    console.log('Creating Memories seed data...');

    const memoriesData = [
      // Team memories for Lightning FC
      { id: 'memory-lfc-team-1', brandId: 'lightning-fc', type: 'team', content: 'Lightning FC\'s primary brand color is teal (#2CAAA0) with gold accent (#FFD700)', category: 'brand', importance: 'high', sourceArtifactId: 'artifact-lfc-1', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'system' },
      { id: 'memory-lfc-team-2', brandId: 'lightning-fc', type: 'team', content: 'The team tagline is "Strike Fast. Play Smart. Win Together."', category: 'messaging', importance: 'high', sourceArtifactId: 'artifact-lfc-1', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'system' },
      { id: 'memory-lfc-team-3', brandId: 'lightning-fc', type: 'team', content: 'Championship game scheduled for next weekend against Storm United', category: 'event', importance: 'high', sourceArtifactId: null, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'lightning-coach-01' },
      // Personal memories for users
      { id: 'memory-coach-personal-1', userId: 'lightning-coach-01', type: 'personal', content: 'Coach Sarah prefers energetic, action-oriented language in posts', category: 'preference', importance: 'medium', sourceArtifactId: null, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'system' },
      // Team memories for Nova Labs
      { id: 'memory-nl-team-1', brandId: 'nova-labs', type: 'team', content: 'Nova Labs uses purple (#5B21B6) as primary brand color with blue and orange accents', category: 'brand', importance: 'high', sourceArtifactId: 'artifact-nl-1', createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'system' },
      { id: 'memory-nl-team-2', brandId: 'nova-labs', type: 'team', content: 'TaskFlow 3.0 launch focuses on Smart Workflows and AI automation', category: 'product', importance: 'high', sourceArtifactId: 'artifact-nl-1', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), createdBy: 'nova-pm-01' }
    ];

    for (const memory of memoriesData) {
      if (memory.type === 'team' && memory.brandId) {
        await adminDb.collection('brands').doc(memory.brandId)
          .collection('memories').doc(memory.id).set(memory);
      } else if (memory.type === 'personal' && memory.userId) {
        await adminDb.collection('users').doc(memory.userId)
          .collection('memories').doc(memory.id).set(memory);
      }
    }
    console.log(`Created ${memoriesData.length} Memory entries.`);

    // ========== COMMENTS SEED DATA ==========
    console.log('Creating Comments seed data...');

    const commentsData = [
      // Comments on campaigns
      {
        id: 'comment-camp-01',
        targetType: 'campaign',
        targetId: 'demo-campaign-01',
        brandId: 'lightning-fc',
        userId: 'lightning-coordinator-01',
        userDisplayName: 'Alex Chen',
        userPhotoURL: 'https://i.pravatar.cc/150?u=alex@lightningfc.team',
        content: 'Love the pre-game hype content! Should we add a countdown timer to the posts?',
        parentId: null,
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        reactions: { like: ['lightning-coach-01'] }
      },
      {
        id: 'comment-camp-02',
        targetType: 'campaign',
        targetId: 'demo-campaign-01',
        brandId: 'lightning-fc',
        userId: 'lightning-coach-01',
        userDisplayName: 'Coach Sarah Martinez',
        userPhotoURL: 'https://i.pravatar.cc/150?u=coach@lightningfc.team',
        content: '@Alex Great idea! Let\'s add countdown stickers to the stories too.',
        parentId: 'comment-camp-01',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        reactions: { like: ['lightning-coordinator-01'] },
        mentions: ['lightning-coordinator-01']
      },
      // Comments on images
      {
        id: 'comment-img-01',
        targetType: 'image',
        targetId: 'product-image-01',
        brandId: 'nova-labs',
        userId: 'nova-eng-01',
        userDisplayName: 'James Wilson',
        userPhotoURL: 'https://i.pravatar.cc/150?u=james@novalabs.io',
        content: 'The new UI looks fantastic! Can we get a dark mode version too?',
        parentId: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        reactions: { like: ['nova-pm-01'], love: ['nova-pm-01'] }
      },
      {
        id: 'comment-img-02',
        targetType: 'image',
        targetId: 'product-image-01',
        brandId: 'nova-labs',
        userId: 'nova-pm-01',
        userDisplayName: 'Sarah Kim',
        userPhotoURL: 'https://i.pravatar.cc/150?u=sarah@novalabs.io',
        content: 'Already in the works! @James should have dark mode assets by EOD tomorrow.',
        parentId: 'comment-img-01',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 7200000).toISOString(),
        reactions: {},
        mentions: ['nova-eng-01']
      },
      // Comments on creative work
      {
        id: 'comment-creative-01',
        targetType: 'image',
        targetId: 'creative-image-01',
        brandId: 'spectrum-creative',
        userId: 'spectrum-designer-01',
        userDisplayName: 'Jordan Taylor',
        userPhotoURL: 'https://i.pravatar.cc/150?u=jordan@spectrumcreative.studio',
        content: 'The color palette is perfect for EcoFlow. Should we explore more green variations?',
        parentId: null,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        reactions: { like: ['spectrum-director-01'] }
      }
    ];

    for (const comment of commentsData) {
      await adminDb.collection('comments').doc(comment.id).set(comment);
    }
    console.log(`Created ${commentsData.length} Comments.`);

    // ========== EVENTS SEED DATA ==========
    console.log('Creating Events seed data...');

    const eventsData = [
      {
        id: 'event-lfc-championship',
        brandId: 'lightning-fc',
        name: 'Championship Game vs Storm United',
        description: 'The big game! Lightning FC U16 takes on rivals Storm United for the championship title.',
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        location: 'Austin Memorial Stadium',
        type: 'Competition',
        status: 'upcoming',
        createdBy: 'lightning-coach-01',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      },
      {
        id: 'event-nl-launch',
        brandId: 'nova-labs',
        name: 'TaskFlow 3.0 Launch Party',
        description: 'Celebrate the launch of TaskFlow 3.0 with the team and special guests.',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
        location: 'Nova Labs HQ, San Francisco',
        type: 'Launch',
        status: 'upcoming',
        createdBy: 'nova-pm-01',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      },
      {
        id: 'event-sc-client-presentation',
        brandId: 'spectrum-creative',
        name: 'EcoFlow Brand Reveal',
        description: 'Final presentation of the EcoFlow brand identity to the client team.',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        location: 'Spectrum Creative Studio, Brooklyn',
        type: 'Presentation',
        status: 'upcoming',
        createdBy: 'spectrum-director-01',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      },
      {
        id: 'event-hh-food-drive',
        brandId: 'hope-harbor',
        name: 'Winter Food Drive',
        description: 'Community food collection event to support families during the winter months.',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
        location: 'Hope Harbor Community Center',
        type: 'Fundraiser',
        status: 'upcoming',
        createdBy: 'harbor-director-01',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    ];

    for (const event of eventsData) {
      await adminDb.collection('events').doc(event.id).set(event);
    }
    console.log(`Created ${eventsData.length} Events.`);

    // ========== AI MODEL SETTINGS SEED DATA ==========
    console.log('Creating AI Model Settings...');

    const aiSettingsData = [
      { brandId: 'lightning-fc', imageModel: 'imagen-3.0-generate-002', imageEditModel: 'imagen-3.0-capability-001', videoModel: 'veo-2.0-generate-001', createdAt: now, updatedAt: now },
      { brandId: 'nova-labs', imageModel: 'imagen-3.0-generate-002', imageEditModel: 'imagen-3.0-capability-001', videoModel: 'veo-2.0-generate-001', createdAt: now, updatedAt: now },
      { brandId: 'spectrum-creative', imageModel: 'imagen-3.0-generate-002', imageEditModel: 'imagen-3.0-capability-001', videoModel: 'veo-2.0-generate-001', createdAt: now, updatedAt: now },
      { brandId: 'quantumbio-research', imageModel: 'imagen-3.0-generate-002', imageEditModel: 'imagen-3.0-capability-001', videoModel: 'veo-2.0-generate-001', createdAt: now, updatedAt: now },
      { brandId: 'hope-harbor', imageModel: 'imagen-3.0-generate-002', imageEditModel: 'imagen-3.0-capability-001', videoModel: 'veo-2.0-generate-001', createdAt: now, updatedAt: now }
    ];

    for (const settings of aiSettingsData) {
      await adminDb.collection('aiModelSettings').doc(settings.brandId).set(settings);
    }
    console.log(`Created ${aiSettingsData.length} AI Model Settings.`);

    console.log('Brand Soul / Team Intelligence seed data created successfully.');

    // Create user profile preferences for all users
    console.log('Creating user profile preferences...');
    for (const user of allUsers) {
      // Create user profile preferences document
      await adminDb.collection('userProfilePreferences').doc(user.uid).set({
        userId: user.uid,
        createdAt: now,
        updatedAt: now
      });
      
      // Create brand-specific preferences subcollection
      await adminDb.collection('userProfilePreferences').doc(user.uid)
        .collection('brands').doc(user.brandId).set({
          brandId: user.brandId,
          userId: user.uid,
          displayName: user.displayName,
          bio: `Passionate about ${user.brandId === 'lightning-fc' ? 'youth soccer development' : user.brandId === 'nova-labs' ? 'productivity software' : user.brandId === 'spectrum-creative' ? 'creative design' : user.brandId === 'quantumbio-research' ? 'scientific research' : 'community service'}`,
          location: user.brandId === 'lightning-fc' ? 'Austin, TX' : user.brandId === 'nova-labs' ? 'San Francisco, CA' : user.brandId === 'spectrum-creative' ? 'Brooklyn, NY' : user.brandId === 'quantumbio-research' ? 'Cambridge, MA' : 'Seattle, WA',
          website: '',
          twitter: '',
          linkedin: '',
          createdAt: now,
          updatedAt: now
        });
    }
    console.log(`Created user profile preferences for ${allUsers.length} users.`);
    
    console.log('Database seeded successfully with comprehensive demo data.');
    return {
      success: true,
      message: 'Database seeded successfully with mock data including Team Intelligence artifacts, initiatives, user preferences, and sponsorships.',
    };
  } catch (error: any) {
    console.error('Error seeding database:', error);
    // Re-throw a more informative error that will be caught in the server action.
    if (error.code === 'auth/invalid-credential') {
      throw new Error(
        `Firebase Admin SDK Initialization Error: The GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid. Please check the value in your .env file.`
      );
    }
    throw new Error(`Firebase Admin SDK ActionError: ${error.message}`);
  }
}

// Mock data - sample users for testing
const mockUsers: Omit<User, 'brandId'>[] = [
  {
    uid: 'lightning-coach-01',
    email: 'coach@lightningfc.team',
    displayName: 'Coach Sarah Martinez',
  },
  {
    uid: 'nova-pm-01',
    email: 'sarah@novalabs.io',
    displayName: 'Sarah Kim',
  },
  {
    uid: 'spectrum-director-01',
    email: 'maya@spectrumcreative.studio',
    displayName: 'Maya Rodriguez',
  }
];


// --- Image Editing Gallery Actions ---

export async function generateEditedImageAction(
  brandId: string,
  imageId: string,
  prompt: string,
  title: string,
  sourceImageUrl: string,
  additionalImageUrls?: string[],
  maskUrl?: string
): Promise<{image?: EditedImage; error?: string[]}> {
  try {
    const {adminDb} = getAdminInstances();

    // Get AI model settings for this brand
    const {getAIModelSettingsAction} = await import('@/app/actions/ai-settings');
    const settings = await getAIModelSettingsAction(brandId);

    // 1. Upload the source image if it's a data URI
    let finalSourceUrl = sourceImageUrl;
    if (sourceImageUrl.startsWith('data:')) {
      finalSourceUrl = await uploadToStorage(
        imageId,
        'images',
        'source',
        sourceImageUrl,
        'source_image'
      );
    }

    // 1.5 Upload additional images if they are data URIs
    const finalAdditionalUrls: string[] = [];
    if (additionalImageUrls && additionalImageUrls.length > 0) {
      for (let i = 0; i < additionalImageUrls.length; i++) {
        const url = additionalImageUrls[i];
        if (url.startsWith('data:')) {
          const uploadedUrl = await uploadToStorage(
            imageId,
            'images',
            'source',
            url,
            `additional_source_${i}`
          );
          finalAdditionalUrls.push(uploadedUrl);
        } else {
          finalAdditionalUrls.push(url);
        }
      }
    }

    // 1.6 Upload mask if provided
    let finalMaskUrl: string | undefined;
    if (maskUrl) {
      if (maskUrl.startsWith('data:')) {
        finalMaskUrl = await uploadToStorage(
          imageId,
          'images',
          'mask',
          maskUrl,
          'mask_image'
        );
      } else {
        finalMaskUrl = maskUrl;
      }
    }

    // 2. Generate the new image with configured model
    const {imageUrl: generatedDataUri} = await generateEditedImage({
      prompt,
      imageUrl: finalSourceUrl,
      additionalImageUrls: finalAdditionalUrls.length > 0 ? finalAdditionalUrls : undefined,
      maskUrl: finalMaskUrl,
      brandId,
      model: settings.imageEditModel, // Use model from settings
    });

    // 3. Upload the generated image
    const generatedUrl = await uploadToStorage(
      imageId,
      'images',
      'generated',
      generatedDataUri,
      'generated_image'
    );

    // 4. Save all data to Firestore using merge to handle both create and update
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);
    
    const imageData: EditedImage = {
      id: imageId,
      brandId: brandId,
      title,
      prompt,
      sourceImageUrl: finalSourceUrl,
      generatedImageUrl: generatedUrl,
      generatedBy: user.uid, // Track who generated the image
      generatedAt: new Date().toISOString(), // Track when it was generated
    };

    if (finalAdditionalUrls.length > 0) {
      imageData.additionalImageUrls = finalAdditionalUrls;
    }
    await adminDb
      .collection('images')
      .doc(imageId)
      .set(imageData, {merge: true});

    // UNIFIED MEDIA: Also add to unified media library for immediate visibility
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const unifiedMediaData: any = {
      id: mediaId,
      brandId: brandId,
      type: 'image',
      url: generatedUrl,
      thumbnailUrl: generatedUrl,
      title: title,
      description: `Edited with nano banana: ${prompt}`,
      tags: ['edited', 'nano-banana'],
      collections: [],
      source: 'edited',
      sourceImageId: imageId,
      createdAt: imageData.generatedAt,
      createdBy: user.uid,
      generatedBy: user.uid,
      prompt: prompt,
      isPublished: false,
    };

    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);

    revalidatePath('/images');
    revalidatePath('/media');
    return {image: imageData};
  } catch (e: any) {
    console.error('Failed to generate edited image:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      error: ['Failed to generate image.', errorMessage],
    };
  }
}

export async function generateAiImageAction(
  brandId: string,
  imageId: string,
  prompt: string,
  title: string,
  aspectRatio?: string,
  numberOfImages?: number,
  personGeneration?: string
): Promise<{image?: EditedImage; images?: EditedImage[]; error?: string[]; jobId?: string}> {
  let jobId: string | undefined;
  try {
    const {adminDb} = getAdminInstances();

    // SECURITY: Verify user has access to this brand BEFORE generation
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    // Track this generation job for persistent notification
    jobId = await generationJobQueue.createJob(
      brandId,
      user.uid,
      'image',
      title,
      prompt,
      { imageId }
    );

    // Get AI model settings for this brand
    const {getAIModelSettingsAction} = await import('@/app/actions/ai-settings');
    const settings = await getAIModelSettingsAction(brandId);

    // 1. Generate image(s) from text prompt with Brand Soul context and Imagen 4.0 parameters
    const {imageUrl: generatedDataUri, imageUrls: generatedDataUris, explainability} = await generateAiImage({
      prompt,
      brandId, // ✅ Pass brandId to enable Phase 1 features
      model: settings.imageModel, // Use model from settings
      aspectRatio,
      numberOfImages,
      personGeneration,
    });

    // Handle multiple images if generated
    const allGeneratedUrls = generatedDataUris || [generatedDataUri];
    const allImages: EditedImage[] = [];
    const generatedAt = new Date().toISOString();

    for (let i = 0; i < allGeneratedUrls.length; i++) {
      const currentImageId = i === 0 ? imageId : `${imageId}_${i + 1}`;
      const currentDataUri = allGeneratedUrls[i];
      const currentTitle = allGeneratedUrls.length > 1 ? `${title} (${i + 1}/${allGeneratedUrls.length})` : title;

      // 2. Upload the generated image
      const generatedUrl = await uploadToStorage(
        currentImageId,
        'images',
        'generated',
        currentDataUri,
        'generated_image'
      );

      // 3. Save all data to Firestore using merge to handle both create and update
      const imageData: EditedImage = {
        id: currentImageId,
        brandId: brandId,
        title: currentTitle,
        prompt,
        sourceImageUrl: '', // No source image for AI generation
        generatedImageUrl: generatedUrl,
        generatedBy: user.uid, // Track who generated the image
        generatedAt, // Track when it was generated
        explainability, // ✅ Store Brand Soul influence data from Phase 1
      };
      await adminDb
        .collection('images')
        .doc(currentImageId)
        .set(imageData, {merge: true});

      // UNIFIED MEDIA: Also add to unified media library for immediate visibility
      const mediaId = adminDb.collection('unifiedMedia').doc().id;
      const unifiedMediaData: any = {
        id: mediaId,
        brandId: brandId,
        type: 'image',
        url: generatedUrl,
        thumbnailUrl: generatedUrl,
        title: currentTitle,
        description: prompt,
        tags: ['ai-generated', 'imagen'],
        collections: [],
        source: 'ai-generated',
        sourceImageId: currentImageId,
        createdAt: generatedAt,
        createdBy: user.uid,
        generatedBy: user.uid,
        prompt: prompt,
        isPublished: false,
      };

      if (explainability) {
        unifiedMediaData.explainability = explainability;
      }

      await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);
      allImages.push(imageData);
    }

    // Mark job as completed (use first image URL for job tracking)
    if (jobId) {
      await generationJobQueue.completeJob(jobId, imageId, allImages[0].generatedImageUrl || '');
    }

    revalidatePath('/images');
    revalidatePath('/media');

    // Return both single image (for backwards compatibility) and array of all images
    return {
      image: allImages[0],
      images: allImages.length > 1 ? allImages : undefined,
      jobId
    };
  } catch (e: any) {
    console.error('Failed to generate AI image:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';

    // Mark job as failed
    if (jobId) {
      await generationJobQueue.failJob(jobId, errorMessage);
    }

    return {
      error: ['Failed to generate image.', errorMessage],
      jobId,
    };
  }
}

/**
 * Save a chatbot-generated image to the gallery
 * This is called from the chatbot when a user generates an image via Imagen
 */
export async function saveChatbotImageAction(
  brandId: string,
  imageId: string,
  prompt: string,
  generatedDataUri: string,
  explainability?: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  }
): Promise<{image?: EditedImage; error?: string}> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const {adminDb} = getAdminInstances();

    // Upload the generated image to Firebase Storage if it's a data URI
    // If it's already a URL (e.g. from Agent), use it directly
    let imageUrl = generatedDataUri;
    if (generatedDataUri.startsWith('data:')) {
      imageUrl = await uploadToStorage(
        imageId,
        'images',
        'generated',
        generatedDataUri,
        'generated_image.png'
      );
    }

    // Save to Firestore
    const imageData: any = {
      id: imageId,
      brandId: brandId,
      title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      prompt,
      sourceImageUrl: imageUrl, // For generated images, source is the generated image
      generatedImageUrl: imageUrl,
      generatedBy: user.uid, // Track who generated the image
      generatedAt: new Date().toISOString(), // Track when it was generated
    };
    
    // Only add explainability if it's defined (Firestore doesn't accept undefined)
    if (explainability) {
      imageData.explainability = explainability;
    }
    
    await adminDb
      .collection('images')
      .doc(imageId)
      .set(imageData, {merge: true});

    // UNIFIED MEDIA: Also add to unified media library for immediate visibility
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const unifiedMediaData: any = {
      id: mediaId,
      brandId: brandId,
      type: 'image',
      url: imageUrl,
      thumbnailUrl: imageUrl,
      title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      description: prompt,
      tags: ['ai-generated', 'chatbot', 'imagen'],
      collections: [],
      source: 'chatbot',
      sourceImageId: imageId,
      createdAt: imageData.generatedAt,
      createdBy: user.uid,
      generatedBy: user.uid,
      prompt: prompt,
      isPublished: false,
    };

    if (explainability) {
      unifiedMediaData.explainability = explainability;
    }

    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);

    revalidatePath('/images');
    revalidatePath('/media');
    return {image: imageData};
  } catch (e: any) {
    console.error('Failed to save chatbot image:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {error: errorMessage};
  }
}

/**
 * Save a chatbot-generated video to the gallery
 * This is called from the chatbot when a user generates a video via Veo
 */
export async function saveChatbotVideoAction(
  brandId: string,
  videoId: string,
  prompt: string,
  videoDataUri: string,
  inputImageUrl?: string,
  characterReferenceUrl?: string,
  startFrameUrl?: string,
  endFrameUrl?: string
): Promise<{video?: Video; error?: string}> {
  console.log('saveChatbotVideoAction called with:', { brandId, videoId, promptLength: prompt?.length, videoDataUriLength: videoDataUri?.length });
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const {adminDb} = getAdminInstances();

    // Upload the generated video to Firebase Storage if it's a data URI
    // If it's already a URL (e.g. from Agent), use it directly
    let videoUrl = videoDataUri;
    if (videoDataUri.startsWith('data:')) {
      videoUrl = await uploadToStorage(
        videoId,
        'videos',
        'generated',
        videoDataUri,
        'generated_video.mp4'
      );
    }

    // Save to Firestore
    const videoData: any = {
      id: videoId,
      brandId: brandId,
      videoUrl: videoUrl,
      title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      description: prompt,
      generatedBy: user.uid, // Track who generated the video
      generatedAt: new Date().toISOString(), // Track when it was generated
    };

    if (inputImageUrl) videoData.inputImageUrl = inputImageUrl;
    if (characterReferenceUrl) videoData.characterReferenceUrl = characterReferenceUrl;
    if (startFrameUrl) videoData.startFrameUrl = startFrameUrl;
    if (endFrameUrl) videoData.endFrameUrl = endFrameUrl;
    await adminDb
      .collection('videos')
      .doc(videoId)
      .set(videoData, {merge: true});

    // UNIFIED MEDIA: Also add to unified media library for immediate visibility
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const unifiedMediaData: any = {
      id: mediaId,
      brandId: brandId,
      type: 'video',
      url: videoUrl,
      thumbnailUrl: videoUrl, // In a real app, this would be a thumbnail
      title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      description: prompt,
      tags: ['ai-generated', 'chatbot', 'veo'],
      collections: [],
      source: 'chatbot',
      sourceVideoId: videoId,
      createdAt: videoData.generatedAt,
      createdBy: user.uid,
      generatedBy: user.uid,
      prompt: prompt,
      isPublished: false,
    };

    if (inputImageUrl) unifiedMediaData.inputImageUrl = inputImageUrl;
    if (characterReferenceUrl) unifiedMediaData.characterReferenceUrl = characterReferenceUrl;
    if (startFrameUrl) unifiedMediaData.startFrameUrl = startFrameUrl;
    if (endFrameUrl) unifiedMediaData.endFrameUrl = endFrameUrl;

    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);
    revalidatePath('/videos');
    revalidatePath('/media');
    return {video: videoData};
  } catch (e: any) {
    console.error('Error in saveChatbotVideoAction:', e);
    return { error: e.message };
  }
}

/**
 * Save a user-uploaded image to the gallery
 */
export async function saveUploadedImageAction(
  brandId: string,
  imageId: string,
  url: string,
  fileName: string,
  mimeType: string
): Promise<{ image?: EditedImage; error?: string }> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Save to Firestore
    const imageData: any = {
      id: imageId,
      brandId: brandId,
      title: fileName,
      prompt: 'User Upload',
      sourceImageUrl: url,
      generatedImageUrl: url, // Using generatedImageUrl for consistency with grid display
      uploadedBy: user.uid,
      uploadedAt: new Date().toISOString(),
      mimeType: mimeType,
    };

    await adminDb
      .collection('images')
      .doc(imageId)
      .set(imageData, { merge: true });

    // UNIFIED MEDIA: Also add to unified media library
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const unifiedMediaData: any = {
      id: mediaId,
      brandId: brandId,
      type: 'image',
      url: url,
      thumbnailUrl: url,
      title: fileName,
      description: 'User Upload',
      tags: ['upload', 'user-upload'],
      collections: [],
      source: 'upload',
      sourceImageId: imageId,
      createdAt: imageData.uploadedAt,
      createdBy: user.uid,
      uploadedBy: user.uid,
      isPublished: false,
    };

    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);

    revalidatePath('/images');
    revalidatePath('/media');
    return { image: imageData };
  } catch (e: any) {
    console.error('Failed to save uploaded image:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: errorMessage };
  }
}

/**
 * Save a user-uploaded video to the gallery
 */
export async function saveUploadedVideoAction(
  brandId: string,
  videoId: string,
  url: string,
  fileName: string,
  mimeType: string
): Promise<{ video?: Video; error?: string }> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Save to Firestore
    const videoData: Video = {
      id: videoId,
      brandId: brandId,
      videoUrl: url,
      title: fileName,
      description: 'User Upload',
      uploadedBy: user.uid,
      uploadedAt: new Date().toISOString(),
    };

    await adminDb
      .collection('videos')
      .doc(videoId)
      .set(videoData, { merge: true });

    // UNIFIED MEDIA: Also add to unified media library
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    const unifiedMediaData: any = {
      id: mediaId,
      brandId: brandId,
      type: 'video',
      url: url,
      thumbnailUrl: url, // Video thumbnail might need processing, but using URL for now
      title: fileName,
      description: 'User Upload',
      tags: ['upload', 'user-upload'],
      collections: [],
      source: 'upload',
      sourceVideoId: videoId,
      createdAt: videoData.uploadedAt,
      createdBy: user.uid,
      uploadedBy: user.uid,
      isPublished: false,
    };

    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);

    revalidatePath('/videos');
    revalidatePath('/media');
    return { video: videoData };
  } catch (e: any) {
    console.error('Failed to save uploaded video:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: errorMessage };
  }
}

export async function getImagesAction(
  brandId: string,
  filters?: { userId?: string; dateRange?: { start: string; end: string } }
): Promise<EditedImage[]> {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    let query = adminDb.collection('images').where('brandId', '==', brandId);

    if (filters?.userId) {
      // Check both generatedBy and uploadedBy
      // Note: Firestore doesn't support logical OR in queries easily without multiple queries
      // For simplicity, we'll filter in memory if needed, or assume one field is primary
      // Let's try to filter by 'uploadedBy' OR 'generatedBy' in memory after fetching
      // OR we can just filter by one if we know which one is used.
      // Given the structure, let's fetch all and filter in memory for now as these collections are smaller
    }

    const snapshot = await query.get();

    let images = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as EditedImage));

    // Apply filters in memory
    if (filters?.userId) {
      images = images.filter((img: EditedImage) =>
        img.generatedBy === filters.userId || img.uploadedBy === filters.userId
      );
    }

    // Apply privacy filter: Show if published OR created by current user
    // Default to PRIVATE - only show to others if explicitly published
    images = images.filter((img: any) => {
      const isOwner = img.generatedBy === authenticatedUser.uid || img.uploadedBy === authenticatedUser.uid;
      const isPublished = img.isPublished === true; // Default to PRIVATE (must explicitly be true to show to others)
      return isOwner || isPublished;
    });

    // Exclude personal shared content (these should only appear on Personal Profile)
    images = images.filter((img: any) => img.isPersonal !== true);

    if (filters?.dateRange) {
      const start = new Date(filters.dateRange.start).getTime();
      const end = new Date(filters.dateRange.end).getTime();

      images = images.filter((img: EditedImage) => {
        const i = img as any;
        const dateStr = i.generatedAt || i.uploadedAt || i.createdAt;
        if (!dateStr) return false;
        const time = new Date(dateStr).getTime();
        return time >= start && time <= end;
      });
    }

    // Sort by newest first
    images.sort((a: EditedImage, b: EditedImage) => {
      const iA = a as any;
      const iB = b as any;
      const dateA = new Date(iA.generatedAt || iA.uploadedAt || iA.createdAt || 0).getTime();
      const dateB = new Date(iB.generatedAt || iB.uploadedAt || iB.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return images;
  } catch (error: any) {
    // Return empty array on auth errors (e.g., during logout) to prevent UI errors
    const errorMessage = error?.message || '';
    if (errorMessage.includes('authentication') || errorMessage.includes('session')) {
      console.log('getImagesAction: User not authenticated, returning empty array');
      return [];
    }
    console.error('Error fetching images:', error);
    throw new Error('Failed to fetch images');
  }
}

export async function deleteImageAction(
  imageId: string
): Promise<{success: boolean; message: string}> {
  try {
    // SECURITY: Get image first to validate brand access
    const user = await getAuthenticatedUser();
    const {adminDb, adminStorage} = getAdminInstances();
    
    // First get the image to check brand ownership
    const imageDoc = await adminDb.collection('images').doc(imageId).get();
    if (!imageDoc.exists) {
      return { success: false, message: 'Image not found' };
    }
    
    const imageData = imageDoc.data() as EditedImage;
    await requireBrandAccess(user.uid, imageData.brandId);
    const bucket = adminStorage.bucket();

    // 1. Delete the image files from Cloud Storage (source and generated)
    // We'll try to delete both and ignore "not found" errors.
    const [files] = await bucket.getFiles({prefix: `images/${imageId}/`});
    for (const file of files) {
      try {
        await file.delete();
      } catch (storageError: any) {
        if (storageError.code !== 404) {
          console.warn(
            `Error deleting file ${file.name}, but continuing.`,
            storageError
          );
        }
      }
    }

    // 2. Delete the image document from Firestore
    await adminDb.collection('images').doc(imageId).delete();

    revalidatePath('/images');
    return {success: true, message: 'Image deleted successfully.'};
  } catch (e: any) {
    console.error('Failed to delete image:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Failed to delete image: ${errorMessage}`,
    };
  }
}

/**
 * Update an image's title or other editable fields.
 */
export async function updateImageAction(
  imageId: string,
  updates: { title?: string; description?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    // Get image to validate brand access
    const imageDoc = await adminDb.collection('images').doc(imageId).get();
    if (!imageDoc.exists) {
      return { success: false, message: 'Image not found' };
    }

    const imageData = imageDoc.data() as EditedImage;
    await requireBrandAccess(user.uid, imageData.brandId);

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;

    await adminDb.collection('images').doc(imageId).update(updateData);

    revalidatePath('/images');
    return { success: true, message: 'Image updated successfully.' };
  } catch (e: any) {
    console.error('Failed to update image:', e);
    return {
      success: false,
      message: `Failed to update image: ${e instanceof Error ? e.message : 'An unknown error occurred.'}`,
    };
  }
}

/**
 * Update a video's title or other editable fields.
 */
export async function updateVideoAction(
  videoId: string,
  updates: { title?: string; description?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    // Get video to validate brand access
    const videoDoc = await adminDb.collection('videos').doc(videoId).get();
    if (!videoDoc.exists) {
      return { success: false, message: 'Video not found' };
    }

    const videoData = videoDoc.data() as Video;
    await requireBrandAccess(user.uid, videoData.brandId);

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;

    await adminDb.collection('videos').doc(videoId).update(updateData);

    revalidatePath('/videos');
    return { success: true, message: 'Video updated successfully.' };
  } catch (e: any) {
    console.error('Failed to update video:', e);
    return {
      success: false,
      message: `Failed to update video: ${e instanceof Error ? e.message : 'An unknown error occurred.'}`,
    };
  }
}

/**
 * Update a brand asset's name or other editable fields.
 */
export async function updateBrandAssetAction(
  brandId: string,
  assetId: string,
  assetType: 'image' | 'video' | 'document',
  updates: { name?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    // SECURITY: Verify user has access to this brand
    await requireBrandAccess(user.uid, brandId);

    const brandRef = adminDb.collection('brands').doc(brandId);
    const brandDoc = await brandRef.get();

    if (!brandDoc.exists) {
      return { success: false, message: 'Brand not found' };
    }

    const brandData = brandDoc.data();
    const assetCollection = assetType === 'image' ? 'images' : assetType === 'video' ? 'videos' : 'documents';
    const profile = brandData?.profile || {};
    const assets = (profile[assetCollection as keyof BrandProfile] as BrandAsset[]) || [];

    // Find and update the asset
    const assetIndex = assets.findIndex((asset: BrandAsset) => asset.id === assetId);
    if (assetIndex === -1) {
      return { success: false, message: 'Asset not found' };
    }

    // Update the asset with new values
    const updatedAssets = [...assets];
    updatedAssets[assetIndex] = {
      ...updatedAssets[assetIndex],
      ...(updates.name !== undefined && { name: updates.name }),
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    };

    await brandRef.update({
      [`profile.${assetCollection}`]: updatedAssets
    });

    revalidatePath('/brand-profile');
    revalidatePath('/brand-profile/personal');
    return { success: true, message: 'Asset updated successfully.' };
  } catch (e: any) {
    console.error('Failed to update brand asset:', e);
    return {
      success: false,
      message: `Failed to update asset: ${e instanceof Error ? e.message : 'An unknown error occurred.'}`,
    };
  }
}

// --- Brand Profile Actions ---

export async function getBrandProfileAction(
  brandId: string
): Promise<BrandProfile | null> {
  if (!brandId) return null;

  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(brandId).get();
    if (!brandDoc.exists) {
      return null;
    }
    const brandData = brandDoc.data();
    // The profile is nested inside the brand document
    return brandData?.profile as BrandProfile || null;
  } catch (e: any) {
    // If user is not authenticated or doesn't have access, return null gracefully
    // This prevents errors on page load/logout when authentication is not established
    if (e.message?.includes('authentication') ||
        e.message?.includes('session') ||
        e.message?.includes('Access denied')) {
      return null;
    }
    console.error('Failed to get brand profile:', e);
    return null;
  }
}

export async function getSponsorBrandProfileAction(
  sponsorBrandId: string,
  sponsoredBrandId: string
): Promise<BrandProfile | null> {
  if (!sponsorBrandId || !sponsoredBrandId) return null;

  try {
    // SECURITY: Verify sponsorship access first
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, sponsoredBrandId); // User must be member of sponsored brand
    
    // Verify the sponsorship relationship exists and is active
    const { verifySponsorshipAccessAction } = await import('./actions/sponsorship-management');
    const { sponsorship, error } = await verifySponsorshipAccessAction(sponsoredBrandId, sponsorBrandId);
    
    if (error || !sponsorship || sponsorship.status !== 'ACTIVE') {
      throw new Error('Invalid sponsorship access');
    }

    // Now fetch the sponsor brand profile directly without brand access check
    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(sponsorBrandId).get();
    if (!brandDoc.exists) {
      return null;
    }
    const brandData = brandDoc.data();
    // The profile is nested inside the brand document
    return brandData?.profile as BrandProfile || null;
  } catch (e: any) {
    console.error('Failed to get sponsor brand profile:', e);
    return null;
  }
}

export async function generateBrandSummaryAction(brandId: string): Promise<{ summary?: string, error?: string }> {
    try {
        console.log('[generateBrandSummaryAction] Starting for brandId:', brandId);
        const profile = await getBrandProfileAction(brandId);
        if (!profile) {
            return { error: 'Brand profile not found.' };
        }
        
        console.log('[generateBrandSummaryAction] Calling generateBrandSummary with brandId:', brandId);
        const { summary } = await generateBrandSummary({
            brandId,
            existingSummary: profile?.summary || '',
            images: profile?.images || [],
            videos: profile?.videos || [],
            documents: profile?.documents || [],
        });
        
        console.log('[generateBrandSummaryAction] Summary generated:', summary?.substring(0, 200));
        
        const { adminDb } = getAdminInstances();
        await adminDb.collection('brands').doc(brandId).update({
          'profile.summary': summary
        });
        
        revalidatePath('/brand-profile');
        return { summary };
    } catch (e: any) {
        console.error('[generateBrandSummaryAction] Failed to generate brand summary:', e);
        return { error: e.message || 'An unknown error occurred.' };
    }
}

export async function generateBrandTextAction(brandId: string): Promise<{ brandText?: BrandText, error?: string }> {
    try {
        // SECURITY: Only managers can generate brand text
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        const profile = await getBrandProfileAction(brandId);
         if (!profile) {
            return { error: "Brand profile not found." };
        }

        console.log('[generateBrandTextAction] Calling generateBrandText with brandId:', brandId);
        const  brandText  = await generateBrandText({
            brandId,
            existingSummary: profile.summary || '',
        });
        
        const { adminDb } = getAdminInstances();
        await adminDb.collection('brands').doc(brandId).update({
          'profile.brandText': brandText
        });
        
        revalidatePath('/brand-profile');
        return { brandText: brandText as any }; // Type assertion for compatibility
    } catch (e: any) {
        console.error('Failed to generate brand text:', e);
        return { error: e.message || 'An unknown error occurred.' };
    }
}

export async function regenerateBrandTextSectionAction(
  brandId: string,
  sectionKey: string,
  sectionTitle: string
): Promise<{ newContent?: string | string[], error?: string }> {
    try {
        // SECURITY: Only managers can regenerate brand text sections
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');
        
        const profile = await getBrandProfileAction(brandId);
        const { newContent } = await regenerateBrandTextSection({
            brandProfile: profile || undefined,
            sectionKey,
            sectionTitle,
        });

        const { adminDb } = getAdminInstances();
        // Use a dot path to update only the specific nested field.
        await adminDb.collection('brands').doc(brandId).update({
            [`profile.brandText.${sectionKey}`]: newContent
        });
        
        revalidatePath('/brand-profile');
        return { newContent };
    } catch (e: any) {
        console.error(`Failed to regenerate ${sectionKey}:`, e);
        return { error: e.message || 'An unknown error occurred.' };
    }
}

export async function generateUserBrandTextSectionAction(
  userId: string,
  brandId: string,
  sectionKey: string,
  sectionTitle: string
): Promise<{ newContent?: string | string[], error?: string }> {
    try {
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            throw new Error('Unauthorized access to user preferences');
        }
        await requireBrandAccess(user.uid, brandId);

        const profile = await getBrandProfileAction(brandId);
        const { newContent } = await regenerateBrandTextSection({
            brandProfile: profile || undefined,
            sectionKey,
            sectionTitle,
        });

        // Save to user preferences, not brand profile
        const { error: saveError } = await updateUserBrandTextFieldAction(userId, brandId, sectionKey, newContent);
        if (saveError) {
            throw new Error(saveError);
        }
        
        revalidatePath('/brand-profile');
        return { newContent };
    } catch (e: any) {
        console.error(`Failed to generate user brand text section ${sectionKey}:`, e);
        return { error: e.message || 'An unknown error occurred.' };
    }
}

export async function updateBrandTextAction(
  brandId: string,
  fieldKey: string,
  newValue: string | string[]
): Promise<{ success: boolean, error?: string }> {
    try {
        // SECURITY: Only managers can update brand text
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');
        
        const { adminDb } = getAdminInstances();
        
        // Use dot notation to safely update the nested field.
        await adminDb.collection('brands').doc(brandId).update({
            [`profile.brandText.${fieldKey}`]: newValue
        });
        
        revalidatePath('/brand-profile');
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to update ${fieldKey}:`, e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function updateBrandBannerAction(
  brandId: string,
  bannerImageUrl: string
): Promise<{ success: boolean, error?: string }> {
    try {
        // SECURITY: Only managers can update brand banner
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        const { adminDb } = getAdminInstances();
        
        await adminDb.collection('brands').doc(brandId).update({
            'profile.bannerImageUrl': bannerImageUrl
        });
        
        revalidatePath('/brand-profile');
        return { success: true };
    } catch (e: any) {
        console.error('Failed to update banner:', e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function updateBrandLogoAction(
  brandId: string,
  logoUrl: string
): Promise<{ success: boolean, error?: string }> {
    try {
        // SECURITY: Only managers can update brand logo
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        const { adminDb } = getAdminInstances();
        
        await adminDb.collection('brands').doc(brandId).update({
            'profile.logoUrl': logoUrl
        });
        
        revalidatePath('/brand-profile');
        return { success: true };
    } catch (e: any) {
        console.error('Failed to update logo:', e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function updateBrandIdentityAction(
  brandId: string,
  field: 'name' | 'tagline' | 'summary' | 'websiteUrl' | 'contactEmail' | 'location',
  value: string
): Promise<{ success: boolean, error?: string }> {
    try {
        // SECURITY: Only managers can update brand identity
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        const { adminDb } = getAdminInstances();
        
        // Brand name is stored at the top level, other fields in profile
        if (field === 'name') {
            await adminDb.collection('brands').doc(brandId).update({
                name: value
            });
        } else {
            await adminDb.collection('brands').doc(brandId).update({
                [`profile.${field}`]: value
            });
        }
        
        revalidatePath('/brand-profile');
        revalidatePath('/brand-profile/personal');
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to update ${field}:`, e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function updateUserBrandIdentityAction(
  userId: string,
  brandId: string,
  field: 'displayName' | 'tagline' | 'summary' | 'websiteUrl' | 'contactEmail' | 'location',
  value: string
): Promise<{ success: boolean, error?: string }> {
    try {
        // SECURITY: Users can only update their own profile preferences
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            throw new Error('Unauthorized: You can only update your own profile');
        }
        await requireBrandAccess(user.uid, brandId);

        const { adminDb } = getAdminInstances();
        
        // Store in user-specific preferences with brandId as subdocument
        const userPrefRef = adminDb
            .collection('userProfilePreferences')
            .doc(userId)
            .collection('brands')
            .doc(brandId);
        
        await userPrefRef.set({
            [field]: value,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        revalidatePath('/brand-profile/personal');
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to update user ${field}:`, e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function getBrandMembershipAction(
    userId: string,
    brandId: string
): Promise<BrandMember | null> {
    try {
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            console.warn(`User ${user.uid} attempted to access membership for ${userId}`);
            return null;
        }

        const member = await getBrandMember(brandId, userId);
        if (!member || member.status !== 'ACTIVE') {
            return null;
        }

        return member;
    } catch (e: any) {
        console.error('Failed to get brand membership:', e);
        return null;
    }
}

export async function getTeamMemberInfoAction(
    targetUserId: string,
    brandId: string
): Promise<BrandMember | null> {
    try {
        const currentUser = await getAuthenticatedUser();
        
        // Verify current user is an active member of the brand
        await requireBrandAccess(currentUser.uid, brandId);
        
        // Get the target user's membership
        const targetMember = await getBrandMember(brandId, targetUserId);
        
        // Return the member info if they're an active member of the same brand
        if (targetMember && targetMember.status === 'ACTIVE') {
            return targetMember;
        }
        
        return null;
    } catch (e: any) {
        console.error('Failed to get team member info:', e);
        return null;
    }
}

export async function getUserProfilePreferencesAction(
    userId: string,
    brandId: string
): Promise<UserProfilePreferences | null> {
    try {
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            console.warn(`User ${user.uid} attempted to access preferences for ${userId}`);
            return null;
        }
        await requireBrandAccess(user.uid, brandId);

        const { adminDb } = getAdminInstances();
        
        // Fetch from both locations and merge
        const legacyPrefDoc = await adminDb
            .collection('userProfilePreferences')
            .doc(userId)
            .get();
        
        const brandPrefDoc = await adminDb
            .collection('userProfilePreferences')
            .doc(userId)
            .collection('brands')
            .doc(brandId)
            .get();

        // Merge legacy preferences with brand-specific preferences
        const legacyData = legacyPrefDoc.exists ? legacyPrefDoc.data() : {};
        const brandData = brandPrefDoc.exists ? brandPrefDoc.data() : {};
        
        if (!legacyPrefDoc.exists && !brandPrefDoc.exists) {
            console.log(`No user preferences found for user ${userId}, will use brand defaults`);
            return null;
        }

        return {
            userId,
            brandId,
            ...legacyData,
            ...brandData,
        } as UserProfilePreferences;
    } catch (e: any) {
        console.log(`Could not load user preferences (will fall back to brand defaults): ${e.message}`);
        return null;
    }
}

export async function getTeamMemberPreferencesAction(
    targetUserId: string,
    brandId: string
): Promise<UserProfilePreferences | null> {
    try {
        const currentUser = await getAuthenticatedUser();
        
        // Verify current user is an active member of the brand
        await requireBrandAccess(currentUser.uid, brandId);
        
        // Verify target user is also an active member of the same brand
        const targetMember = await getBrandMember(brandId, targetUserId);
        if (!targetMember || targetMember.status !== 'ACTIVE') {
            console.warn(`Target user ${targetUserId} is not an active member of brand ${brandId}`);
            return null;
        }

        const { adminDb } = getAdminInstances();
        
        // Fetch from both locations and merge
        const legacyPrefDoc = await adminDb
            .collection('userProfilePreferences')
            .doc(targetUserId)
            .get();
        
        const brandPrefDoc = await adminDb
            .collection('userProfilePreferences')
            .doc(targetUserId)
            .collection('brands')
            .doc(brandId)
            .get();

        // Merge legacy preferences with brand-specific preferences
        const legacyData = legacyPrefDoc.exists ? legacyPrefDoc.data() : {};
        const brandData = brandPrefDoc.exists ? brandPrefDoc.data() : {};
        
        if (!legacyPrefDoc.exists && !brandPrefDoc.exists) {
            console.log(`No user preferences found for user ${targetUserId}, will use brand defaults`);
            return null;
        }

        return {
            userId: targetUserId,
            brandId,
            ...legacyData,
            ...brandData,
        } as UserProfilePreferences;
    } catch (e: any) {
        console.log(`Could not load team member preferences (will fall back to brand defaults): ${e.message}`);
        return null;
    }
}

export async function updateUserProfilePreferenceAction(
    userId: string,
    brandId: string,
    updates: {
        bannerImageUrl?: string;
        logoUrl?: string;
        brandText?: BrandText;
        timezone?: string;
    }
): Promise<{ success: boolean, error?: string }> {
    try {
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            throw new Error('Unauthorized access to user preferences');
        }
        await requireBrandAccess(user.uid, brandId);

        const { adminDb } = getAdminInstances();
        const prefRef = adminDb.collection('userProfilePreferences').doc(userId);
        const prefDoc = await prefRef.get();

        const updatedPreferences: UserProfilePreferences = {
            userId,
            brandId,
            ...(prefDoc.exists ? prefDoc.data() : {}),
            ...updates,
            updatedAt: new Date().toISOString(),
        };

        await prefRef.set(updatedPreferences, { merge: true });
        
        revalidatePath('/brand-profile');
        return { success: true };
    } catch (e: any) {
        console.error('Failed to update user profile preferences:', e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function updateUserBrandTextFieldAction(
    userId: string,
    brandId: string,
    fieldKey: string,
    newValue: string | string[]
): Promise<{ success: boolean, error?: string }> {
    try {
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            throw new Error('Unauthorized access to user preferences');
        }
        await requireBrandAccess(user.uid, brandId);

        const { adminDb } = getAdminInstances();
        const prefRef = adminDb.collection('userProfilePreferences').doc(userId);
        const prefDoc = await prefRef.get();

        let currentBrandText: BrandText;
        if (prefDoc.exists && prefDoc.data()?.brandText) {
            currentBrandText = prefDoc.data()!.brandText;
        } else {
            const brandProfile = await getBrandProfileAction(brandId);
            currentBrandText = brandProfile?.brandText || {} as BrandText;
        }

        const updatedBrandText = _.cloneDeep(currentBrandText);
        _.set(updatedBrandText, fieldKey, newValue);

        const updatedPreferences: UserProfilePreferences = {
            userId,
            brandId,
            ...(prefDoc.exists ? prefDoc.data() : {}),
            brandText: updatedBrandText,
            updatedAt: new Date().toISOString(),
        };

        await prefRef.set(updatedPreferences, { merge: true });
        
        revalidatePath('/brand-profile');
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to update user brand text field ${fieldKey}:`, e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export async function generateUserBrandTextAction(
    userId: string,
    brandId: string
): Promise<{ brandText?: BrandText, error?: string }> {
    try {
        const user = await getAuthenticatedUser();
        if (user.uid !== userId) {
            throw new Error('Unauthorized access to user preferences');
        }
        await requireBrandAccess(user.uid, brandId);

        const { adminDb, adminAuth } = getAdminInstances();
        
        // Get user's display name from Firebase Auth
        const authUser = await adminAuth.getUser(userId);
        const userDisplayName = authUser.displayName || 'Team Member';

        // Get existing user preferences for summary
        const prefRef = adminDb.collection('userProfilePreferences').doc(userId);
        const prefDoc = await prefRef.get();
        const existingSummary = prefDoc.exists ? prefDoc.data()?.summary : '';

        console.log('[generateUserBrandTextAction] Calling generatePersonalProfileText for:', userDisplayName);
        const personalText = await generatePersonalProfileText({
            brandId,
            userId,
            userDisplayName,
            existingSummary: existingSummary || '',
        });
        
        // Map personal profile text to BrandText structure
        const brandText: BrandText = {
            coreText: {
                missionVision: personalText.coreText.personalMission,
                brandStory: personalText.coreText.professionalBio,
                taglines: personalText.coreText.personalTaglines,
            },
            marketingText: {
                adCopy: personalText.professionalHighlights.expertiseAreas,
                productDescriptions: personalText.professionalHighlights.keyAchievements,
                emailCampaigns: [personalText.socialContent.emailSignature],
                landingPageCopy: personalText.professionalHighlights.valueProposition,
            },
            contentMarketingText: {
                blogPosts: personalText.personalContent.impactStories,
                socialMediaCaptions: [personalText.socialContent.socialMediaBio],
                whitePapers: personalText.personalContent.interests,
                videoScripts: [personalText.personalContent.aboutMe],
            },
            technicalSupportText: {
                userManuals: personalText.professionalHighlights.workingStyle,
                faqs: [{ 
                    question: 'How do they collaborate?', 
                    answer: personalText.personalContent.collaborationStyle 
                }],
            },
            publicRelationsText: {
                pressReleases: [personalText.socialContent.linkedInSummary],
                companyStatements: [personalText.socialContent.portfolioIntro],
                mediaKitText: personalText.personalContent.aboutMe,
            },
        };

        const updatedPreferences: UserProfilePreferences = {
            userId,
            brandId,
            ...(prefDoc.exists ? prefDoc.data() : {}),
            brandText,
            updatedAt: new Date().toISOString(),
        };

        await prefRef.set(updatedPreferences, { merge: true });
        
        console.log('[generateUserBrandTextAction] Personal profile text generated and saved');
        revalidatePath('/brand-profile');
        return { brandText };
    } catch (e: any) {
        console.error('Failed to generate user brand text:', e);
        return { error: e.message || 'An unknown error occurred.' };
    }
}


export async function uploadBrandAssetAction(
  brandId: string,
  asset: { name: string; dataUri: string; type: 'image' | 'video' | 'document' }
): Promise<{ asset?: BrandAsset, error?: string }> {
  try {
    // Validate data URI size to prevent memory issues in production
    const base64Data = asset.dataUri.substring(asset.dataUri.indexOf(',') + 1);
    const sizeInBytes = (base64Data.length * 3) / 4; // Approximate original file size
    const maxSizeBytes = 100 * 1024 * 1024; // 100MB limit for server processing
    
    if (sizeInBytes > maxSizeBytes) {
      return { error: `File too large for server processing. Maximum size is 100MB. Current size: ${(sizeInBytes / (1024 * 1024)).toFixed(1)}MB` };
    }

    const { adminDb } = getAdminInstances();
    const folder = asset.type === 'image' ? 'images' : asset.type === 'video' ? 'videos' : 'documents';
    const assetCollectionName = asset.type === 'image' ? 'images' : asset.type === 'video' ? 'videos' : 'documents';

    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);
    
    const assetUrl = await uploadToStorage(brandId, 'brand_assets', folder, asset.dataUri, asset.name);

    const newAsset: BrandAsset = {
      id: crypto.randomUUID(),
      name: asset.name,
      url: assetUrl,
      type: asset.type,
      uploadedBy: user.uid, // Track who uploaded the asset
      uploadedAt: new Date().toISOString(), // Track when it was uploaded
    };
    
    const brandRef = adminDb.collection('brands').doc(brandId);
    const brandDoc = await brandRef.get();
    
    if (!brandDoc.exists) {
        // This case should ideally not happen if brand is created on user signup
        await brandRef.set({ profile: { [assetCollectionName]: [newAsset] } });
    } else {
        // If it exists, read, update, and write back.
        const brandData = brandDoc.data();
        const existingAssets = (brandData?.profile?.[assetCollectionName as keyof BrandProfile] as BrandAsset[]) || [];
        const updatedAssets = [...existingAssets, newAsset];
        await brandRef.update({ [`profile.${assetCollectionName}`]: updatedAssets });
    }

    if (asset.type === 'document') {
        const bucketName = process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        if (bucketName) {
            const gcsUri = `gs://${bucketName}/brand_assets/${brandId}/${folder}/${asset.name}`;
            
            // indexMenu({ gcsUri }).then(result => {
            //     if (!result.success) {
            //         console.error(`Failed to index document ${gcsUri}:`, result.error);
            //     } else {
            //         console.log(`Successfully indexed ${result.documentsIndexed} chunks from ${gcsUri}`);
            //     }
            // });
        }
    }

    // AI IMAGE GALLERY SYNC: Add images to the images collection for AI editing
    let sourceImageId: string | undefined;
    if (asset.type === 'image') {
      try {
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        sourceImageId = imageId;
        const editedImageData = {
          id: imageId,
          brandId,
          title: asset.name,
          prompt: '', // Empty prompt for uploaded images
          sourceImageUrl: assetUrl, // The uploaded image
          generatedImageUrl: '', // No generated version yet
          uploadedBy: user.uid,
          uploadedAt: newAsset.uploadedAt,
        };

        await adminDb.collection('images').doc(imageId).set(editedImageData);
        console.log(`[Upload Sync] Added image to AI Image Gallery: ${imageId}`);
      } catch (syncError: any) {
        console.error(`[Upload Sync] Failed to sync image to AI Image Gallery:`, syncError);
        // Don't fail the upload if sync fails - the asset is still in brand profile
      }
    }

    // UNIFIED MEDIA SYNC: Add to unifiedMedia collection for Media Library
    if (asset.type === 'image' || asset.type === 'video') {
      try {
        const mediaId = adminDb.collection('unifiedMedia').doc().id;
        const unifiedMediaData: any = {
          id: mediaId,
          brandId,
          type: asset.type,
          url: assetUrl,
          thumbnailUrl: asset.type === 'video' ? assetUrl : assetUrl, // For videos, use same URL (will show first frame)
          title: asset.name,
          description: `Uploaded from Brand Soul`,
          tags: ['brand-soul', 'upload'],
          collections: [],
          source: 'upload',
          createdAt: newAsset.uploadedAt,
          createdBy: user.uid,
          uploadedBy: user.uid,
          isPublished: false,
          auditTrail: [{
            userId: user.uid,
            action: 'created',
            timestamp: new Date().toISOString(),
            details: 'Created from Brand Soul'
          }],
        };

        if (asset.type === 'image' && sourceImageId) {
          unifiedMediaData.sourceImageId = sourceImageId;
        }

        await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);
        console.log(`[Upload Sync] Added ${asset.type} to unifiedMedia: ${mediaId}`);
      } catch (syncError: any) {
        console.error(`[Upload Sync] Failed to sync ${asset.type} to unifiedMedia:`, syncError);
        // Don't fail the upload if sync fails - the asset is still in brand profile
      }
    }

    revalidatePath('/brand-profile');
    revalidatePath('/media');
    revalidatePath('/images');
    return { asset: newAsset };
  } catch (e: any) {
    console.error(`Failed to upload brand ${asset.type}:`, e);
    return { error: e.message || 'An unknown error occurred.' };
  }
}


export async function deleteBrandAssetAction(
  brandId: string,
  assetId: string,
  assetUrl: string,
  assetType: 'image' | 'video' | 'document'
): Promise<{ success: boolean, error?: string }> {
    try {
        const { adminDb, adminStorage } = getAdminInstances();
        const bucket = adminStorage.bucket();

        // 1. Delete file from GCS
        try {
            const url = new URL(assetUrl);
            // Handle both signed URLs and direct URLs
            let filePath: string;
            
            if (url.pathname.includes('/o/')) {
                // Firebase Storage direct URL format: /v0/b/bucket/o/path%2Fto%2Ffile
                filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
            } else {
                // Signed URL format: /path/to/file
                filePath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
            }
            
            await bucket.file(filePath).delete();
        } catch (storageError: any) {
             if (storageError.code !== 404) {
                console.warn(`Error deleting asset ${assetUrl} from storage, but continuing.`, storageError);
            }
        }
        
        // 2. Remove asset from Firestore document
        const brandRef = adminDb.collection('brands').doc(brandId);
        const brandDoc = await brandRef.get();

        if (brandDoc.exists) {
            const brandData = brandDoc.data();
            const assetCollection = assetType === 'image' ? 'images' : assetType === 'video' ? 'videos' : 'documents';
            const profile = brandData?.profile || {};
            const updatedAssets = (profile[assetCollection as keyof BrandProfile] || []).filter((asset: BrandAsset) => asset.id !== assetId);
            
            await brandRef.update({
                [`profile.${assetCollection}`]: updatedAssets
            });
        }
        
        // UNIFIED MEDIA SYNC: Remove from unifiedMedia collection
        if (assetType === 'image' || assetType === 'video') {
          try {
            const unifiedMediaSnapshot = await adminDb
              .collection('unifiedMedia')
              .where('brandId', '==', brandId)
              .where('url', '==', assetUrl)
              .where('tags', 'array-contains', 'brand-soul')
              .limit(1)
              .get();
            
            if (!unifiedMediaSnapshot.empty) {
              await unifiedMediaSnapshot.docs[0].ref.delete();
              console.log(`[Delete Sync] Removed ${assetType} from unifiedMedia`);
            }
          } catch (syncError: any) {
            console.error(`[Delete Sync] Failed to remove ${assetType} from unifiedMedia:`, syncError);
            // Don't fail the deletion if sync fails - the asset is still removed from brand profile
          }
        }

        // AI IMAGE GALLERY SYNC: Remove images from the images collection
        if (assetType === 'image') {
          try {
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
              console.log(`[Delete Sync] Removed ${imagesSnapshot.size} images from AI Image Gallery`);
            }
          } catch (syncError: any) {
            console.error(`[Delete Sync] Failed to remove from AI Image Gallery:`, syncError);
            // Don't fail the deletion if sync fails - the asset is still removed from brand profile
          }
        }
        
        revalidatePath('/brand-profile');
        revalidatePath('/media');
        revalidatePath('/images');
        return { success: true };

    } catch (e: any) {
        console.error(`Failed to delete brand asset:`, e);
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
}

export type RegenerateAdCopyState = {
    newAdCopy?: string;
    error?: string;
}

export async function regenerateAdCopyAction(
  brandProfile: string,
  contentType: string,
  keyMessage: string,
  toneOfVoice: string,
  previousAdCopy: string,
  assetUrl?: string,
): Promise<RegenerateAdCopyState> {
  try {
    const { adCopy: newAdCopy } = await regenerateAdCopy({
        brandProfile,
        contentType,
        keyMessage,
        toneOfVoice,
        previousAdCopy,
        assetUrl,
    });
    return { newAdCopy };
  } catch (e: any) {
    console.error('Failed to regenerate ad copy:', e);
    return { error: e.message || 'An unknown error occurred.' };
  }
}

export type RegenerateImagePromptState = {
    newImagePrompt?: string;
    error?: string;
}

export async function regenerateImagePromptAction(
  brandProfile: string,
  contentType: string,
  keyMessage: string,
  toneOfVoice: string,
  previousImagePrompt: string,
  assetUrl?: string,
): Promise<RegenerateImagePromptState> {
  try {
    const { imagePrompt: newImagePrompt } = await regenerateImagePrompt({
        brandProfile,
        contentType,
        keyMessage,
        toneOfVoice,
        previousImagePrompt,
        assetUrl,
    });
    return { newImagePrompt };
  } catch (e: any) {
    console.error('Failed to regenerate image prompt:', e);
    return { error: e.message || 'An unknown error occurred.' };
  }
}

export async function getBrandNameAction(brandId: string): Promise<{ name?: string; error?: string }> {
  try {
    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(brandId).get();
    
    if (!brandDoc.exists) {
      return { error: 'Brand not found' };
    }
    
    const brandData = brandDoc.data();
    return { name: brandData?.name || 'Your Team' };
  } catch (e: any) {
    console.error('Failed to get brand name:', e);
    return { error: e.message || 'An unknown error occurred.', name: 'Your Team' };
  }
}

export async function askQuestionAboutDocsAction(query: string): Promise<{ answer?: string, error?: string}> {
  // try {
  //   const { answer } = await menuQAFlow({ query });
  //   return { answer };
  // } catch (e: any) {
  //   console.error('Failed to ask question:', e);
  //   return { error: e.message || 'An unknown error occurred.' };
  // }
  return { answer: 'The document query feature is temporarily disabled.' };
}

// Get all active teammates with their profile data (including the current user)
export async function getActiveTeammatesAction(
  brandId: string
): Promise<{ teammates?: Array<{ userId: string; name: string; email: string; role: string; brandText: BrandText | null }>; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const members = await getBrandMembers(brandId);
    const activeMembers = members.filter((m) => m.status === 'ACTIVE');

    const teammates = await Promise.all(
      activeMembers.map(async (member) => {
        const prefs = await getTeamMemberPreferencesAction(member.userId, brandId);
        return {
          userId: member.userId,
          name: member.userDisplayName || member.userEmail,
          email: member.userEmail,
          role: member.role,
          brandText: prefs?.brandText || null
        };
      })
    );

    return { teammates };
  } catch (e: any) {
    console.error('Failed to get active teammates:', e);
    return { error: e.message || 'An unknown error occurred.' };
  }
}

// Copy teammate's brand text section to brand profile
export async function copyTeammateBrandTextSectionAction(
  brandId: string,
  fieldKey: string,
  teammateUserId: string,
  teammateName: string
): Promise<{ success?: boolean; newValue?: string | string[]; error?: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandRole(user.uid, brandId, 'MANAGER');

    // Get teammate's preferences
    const teammatePrefs = await getTeamMemberPreferencesAction(teammateUserId, brandId);
    const newValue = _.get(teammatePrefs?.brandText, fieldKey);

    // Validate content is meaningful (not empty/null/whitespace)
    const { hasMeaningfulContent } = await import('@/lib/utils');
    if (!hasMeaningfulContent(newValue)) {
      return { error: 'This section has no content to copy' };
    }

    // Update brand profile with teammate's content
    const { adminDb } = getAdminInstances();
    const brandRef = adminDb.collection('brands').doc(brandId);
    const brandDoc = await brandRef.get();

    if (!brandDoc.exists) {
      return { error: 'Brand not found' };
    }

    const brandData = brandDoc.data();
    const updatedBrandText = _.cloneDeep(brandData?.profile?.brandText || {});
    _.set(updatedBrandText, fieldKey, newValue);

    // Store attribution metadata
    const attributions = brandData?.profile?.brandTextAttributions || {};
    attributions[fieldKey] = {
      userId: teammateUserId,
      userName: teammateName,
      copiedAt: new Date().toISOString()
    };

    await brandRef.update({
      'profile.brandText': updatedBrandText,
      'profile.brandTextAttributions': attributions
    });

    return { success: true, newValue };
  } catch (e: any) {
    console.error('Failed to copy teammate brand text section:', e);
    return { error: e.message || 'An unknown error occurred.' };
  }
}

// Get user display names for given user IDs
export async function getUserDisplayNamesAction(
  userIds: string[]
): Promise<{ [userId: string]: string }> {
  try {
    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();
    
    const displayNames: { [userId: string]: string } = {};
    
    // Fetch user documents for all user IDs
    const userDocs = await Promise.all(
      userIds.map(uid => adminDb.collection('users').doc(uid).get())
    );
    
    userDocs.forEach((doc, index) => {
      const userId = userIds[index];
      if (doc.exists) {
        const userData = doc.data();
        displayNames[userId] = userData?.displayName || 'Unknown User';
      } else {
        displayNames[userId] = 'Unknown User';
      }
    });
    
    return displayNames;
  } catch (e) {
    console.error('Failed to fetch user display names:', e);
    return {};
  }
}

// ============================================================================
// Brand Soul Explainability Analytics
// ============================================================================

interface ExplainabilityAnalyticsEvent {
  id: string;
  brandId: string;
  timestamp: string;
  userId: string;
  imageId?: string;
  campaignId?: string;
  source: 'campaign' | 'chatbot' | 'gallery';
  explainability: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  };
}

interface ExplainabilityAnalytics {
  totalGenerations: number;
  averageConfidence: number;
  confidenceTrend: { date: string; avgConfidence: number }[];
  topPhotographicControls: { control: string; count: number }[];
  topBrandElements: { element: string; count: number }[];
  topAvoidedElements: { element: string; count: number }[];
  sourceBreakdown: { campaign: number; chatbot: number; gallery: number };
  recentGenerations: ExplainabilityAnalyticsEvent[];
}

/**
 * Track a Brand Soul explainability analytics event
 * Called whenever an image is generated with Brand Soul influence
 */
export async function trackExplainabilityAnalyticsAction(
  brandId: string,
  source: 'campaign' | 'chatbot' | 'gallery',
  explainability: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  },
  imageId?: string,
  campaignId?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const eventId = `analytics-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const event: ExplainabilityAnalyticsEvent = {
      id: eventId,
      brandId,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      imageId,
      campaignId,
      source,
      explainability,
    };

    // Store in brandSoulAnalytics/{brandId}/events/{eventId}
    await adminDb
      .collection('brandSoulAnalytics')
      .doc(brandId)
      .collection('events')
      .doc(eventId)
      .set(event);

    return { success: true };
  } catch (e: any) {
    console.error('Failed to track explainability analytics:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: errorMessage };
  }
}

/**
 * Get aggregated Brand Soul explainability analytics for a brand
 * Returns insights about how Brand Soul has been used over time
 */
export async function getExplainabilityAnalyticsAction(
  brandId: string,
  daysBack: number = 30
): Promise<{ analytics?: ExplainabilityAnalytics; error?: string }> {
  try {
    // SECURITY: Verify user has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    // Calculate date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffIso = cutoffDate.toISOString();

    // Fetch all analytics events for this brand within date range
    const eventsSnapshot = await adminDb
      .collection('brandSoulAnalytics')
      .doc(brandId)
      .collection('events')
      .where('timestamp', '>=', cutoffIso)
      .orderBy('timestamp', 'desc')
      .get();

    const events = eventsSnapshot.docs.map((doc: any) => doc.data() as ExplainabilityAnalyticsEvent);

    if (events.length === 0) {
      return {
        analytics: {
          totalGenerations: 0,
          averageConfidence: 0,
          confidenceTrend: [],
          topPhotographicControls: [],
          topBrandElements: [],
          topAvoidedElements: [],
          sourceBreakdown: { campaign: 0, chatbot: 0, gallery: 0 },
          recentGenerations: [],
        },
      };
    }

    // Calculate total generations
    const totalGenerations = events.length;

    // Calculate average confidence
    const totalConfidence = events.reduce((sum: number, e: any) => sum + e.explainability.confidence, 0);
    const averageConfidence = Math.round(totalConfidence / totalGenerations);

    // Calculate confidence trend (by day)
    const confidenceByDay = new Map<string, { sum: number; count: number }>();
    events.forEach((event: any) => {
      const dateKey = event.timestamp.split('T')[0]; // YYYY-MM-DD
      const existing = confidenceByDay.get(dateKey) || { sum: 0, count: 0 };
      existing.sum += event.explainability.confidence;
      existing.count += 1;
      confidenceByDay.set(dateKey, existing);
    });
    const confidenceTrend = Array.from(confidenceByDay.entries())
      .map(([date, data]) => ({
        date,
        avgConfidence: Math.round(data.sum / data.count),
      }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Count photographic controls
    const photographicControlCounts = new Map<string, number>();
    events.forEach((event: any) => {
      event.explainability.appliedControls.forEach((control: string) => {
        photographicControlCounts.set(control, (photographicControlCounts.get(control) || 0) + 1);
      });
    });
    const topPhotographicControls = Array.from(photographicControlCounts.entries())
      .map(([control, count]) => ({ control, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Count brand elements
    const brandElementCounts = new Map<string, number>();
    events.forEach((event: any) => {
      event.explainability.brandElements.forEach((element: string) => {
        brandElementCounts.set(element, (brandElementCounts.get(element) || 0) + 1);
      });
    });
    const topBrandElements = Array.from(brandElementCounts.entries())
      .map(([element, count]) => ({ element, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Count avoided elements
    const avoidedElementCounts = new Map<string, number>();
    events.forEach((event: any) => {
      event.explainability.avoidedElements.forEach((element: string) => {
        avoidedElementCounts.set(element, (avoidedElementCounts.get(element) || 0) + 1);
      });
    });
    const topAvoidedElements = Array.from(avoidedElementCounts.entries())
      .map(([element, count]) => ({ element, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    // Calculate source breakdown
    const sourceBreakdown = {
      campaign: events.filter((e: any) => e.source === 'campaign').length,
      chatbot: events.filter((e: any) => e.source === 'chatbot').length,
      gallery: events.filter((e: any) => e.source === 'gallery').length,
    };

    // Get recent generations (last 20)
    const recentGenerations = events.slice(0, 20);

    return {
      analytics: {
        totalGenerations,
        averageConfidence,
        confidenceTrend,
        topPhotographicControls,
        topBrandElements,
        topAvoidedElements,
        sourceBreakdown,
        recentGenerations,
      },
    };
  } catch (e: any) {
    console.error('Failed to get explainability analytics:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    return { error: errorMessage };
  }
}
