import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { parseCampaignRequest, calculatePostSchedule, generateContentBlockInstructions, CampaignRequest } from '@/lib/campaign-creation-agent';
import { generateAICampaignContent } from '@/ai/flows/generate-ai-campaign-content';
import { generateAiImage, generateCharacterConsistentImage } from '@/ai/flows/generate-ai-images';
import { addDaysToISODate } from '@/lib/utils';
import { verifyServiceToken } from '@/lib/auth-helpers';
import { getAdminInstances } from '@/lib/firebase/admin';
import type { CampaignTimeline, CampaignDay, GeneratedContentBlock, CharacterConsistencyConfig } from '@/lib/types';

// Constants for parallel processing
// Imagen 4.0 supports 50 RPM default, up to 500 RPM for enterprise (Dynamic Shared Quota)
// Using 10 concurrent for optimal throughput without hitting rate limits
const MAX_CONCURRENT_IMAGE_GENERATIONS = 10;
const LARGE_EVENT_THRESHOLD_DAYS = 4; // Events >= 4 days use optimized processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, brandId, characterConsistency } = body;

    // Extract character consistency config if provided
    const characterConfig: CharacterConsistencyConfig | undefined = characterConsistency ? {
      enabled: characterConsistency.enabled ?? false,
      characters: characterConsistency.characters ?? [],
      useSceneToSceneConsistency: characterConsistency.useSceneToSceneConsistency ?? true,
      maxReferenceImages: characterConsistency.maxReferenceImages ?? 14,
    } : undefined;

    if (!prompt || !brandId) {
      return NextResponse.json(
        { error: 'Prompt and brandId are required' },
        { status: 400 }
      );
    }

    // Check for service token authentication (for backend agent calls)
    let userId: string;
    let isServiceCall = false;
    
    const serviceAuth = await verifyServiceToken();
    
    if (serviceAuth) {
      // Service-to-service call from agent
      if (serviceAuth.brandId !== brandId) {
        return NextResponse.json(
          { error: 'Brand ID mismatch' },
          { status: 400 }
        );
      }
      userId = serviceAuth.userId;
      isServiceCall = true;
      
      // Still enforce brand access for the user on behalf of whom the agent is acting
      await requireBrandAccess(userId, brandId);
    } else {
      // Regular user authentication
      const user = await getAuthenticatedUser();
      userId = user.uid;
      await requireBrandAccess(userId, brandId);
    }

    const campaignRequest = await parseCampaignRequest(prompt);
    
    const startDateISO = campaignRequest.startDate;
    const startDate = new Date(startDateISO + 'T00:00:00');
    const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const uniqueCampaignName = `${campaignRequest.campaignName} - ${dateStr}`;
    
    const postSchedule = calculatePostSchedule(
      campaignRequest.duration,
      campaignRequest.postsPerDay,
      campaignRequest.postDistribution
    );

    // Extract scheduled times from campaignRequest (format: HH:mm, e.g., "14:00", "17:30")
    const scheduledTimes = campaignRequest.scheduledTimes || [];

    const campaignTimeline: CampaignTimeline = [];

    // Track scheduled time index across all social media posts
    let scheduledTimeIndex = 0;

    for (let i = 0; i < campaignRequest.duration; i++) {
      const currentDateISO = addDaysToISODate(startDateISO, i);

      const postsForDay = postSchedule[i];
      const contentBlocks: Array<{
        contentType: string;
        keyMessage: string;
        toneOfVoice: string;
        scheduledTime?: string;
      }> = [];

      for (let j = 0; j < postsForDay; j++) {
        const blockInstructions = generateContentBlockInstructions(
          campaignRequest.campaignGoal,
          campaignRequest.contentTypes,
          campaignRequest.tones
        );

        const randomBlock = blockInstructions[Math.floor(Math.random() * blockInstructions.length)];

        // Only assign scheduledTime to Social Media Posts
        // Email Newsletter and Blog Post Idea don't require scheduled times
        let scheduledTime: string | undefined = undefined;
        if (randomBlock.contentType === 'Social Media Post' && scheduledTimes.length > 0) {
          // Cycle through available scheduled times
          scheduledTime = scheduledTimes[scheduledTimeIndex % scheduledTimes.length];
          scheduledTimeIndex++;
        }

        contentBlocks.push({
          contentType: randomBlock.contentType,
          keyMessage: randomBlock.keyMessage,
          toneOfVoice: randomBlock.toneOfVoice,
          scheduledTime,
        });
      }

      campaignTimeline.push({
        id: `temp-day-${i + 1}`,
        day: i + 1,
        date: currentDateISO,
        contentBlocks: contentBlocks as any, // Temporary type cast - these will be replaced by GeneratedContentBlock
      } as CampaignDay);
    }

    const brandProfile = `Campaign: ${uniqueCampaignName}\nGoal: ${campaignRequest.campaignGoal || 'Generate engaging content'}`;

    console.log('[Campaign Generator] Generating AI content for campaign:', {
      campaignName: uniqueCampaignName,
      totalDays: campaignTimeline.length,
      totalBlocks: campaignTimeline.reduce((sum, day) => sum + day.contentBlocks.length, 0),
    });

    const aiContent = await generateAICampaignContent({
      brandId,
      brandProfile,
      campaignTimeline,
    });

    console.log('[Campaign Generator] AI content generated:', {
      generatedDays: aiContent.generatedContent.length,
      generatedBlocks: aiContent.generatedContent.reduce((sum, day) => sum + day.contentBlocks.length, 0),
    });

    // Get Firebase instances once at the start (optimization: avoid repeated dynamic imports)
    const { adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();

    // Helper function to upload base64 image to Firebase Storage (optimized: uses pre-initialized bucket)
    async function uploadImageToStorage(dataUri: string, blockId: string): Promise<string> {
      const mimeType = dataUri.substring(
        dataUri.indexOf(':') + 1,
        dataUri.indexOf(';')
      );

      const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
      const buffer = Buffer.from(base64Data, 'base64');

      const filePath = `campaigns/${brandId}/${uniqueCampaignName}/${blockId}.png`;
      const file = bucket.file(filePath);

      await file.save(buffer, { metadata: { contentType: mimeType } });

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2500',
      });

      return signedUrl;
    }

    // Check if character consistency is enabled
    const useCharacterConsistency = characterConfig?.enabled &&
      characterConfig.characters.length > 0 &&
      characterConfig.characters.some(c => c.isActive);

    // Get active character reference URLs
    const characterReferenceUrls = useCharacterConsistency
      ? characterConfig!.characters
          .filter(c => c.isActive)
          .map(c => c.characterSheetUrl)
      : [];

    if (useCharacterConsistency) {
      console.log('[Campaign Generator] Character consistency enabled:', {
        activeCharacters: characterReferenceUrls.length,
        useSceneToSceneConsistency: characterConfig!.useSceneToSceneConsistency,
      });
    }

    // =========================================================================
    // OPTIMIZED IMAGE GENERATION: Parallel processing for standard images
    // Character consistency mode still uses sequential for scene-to-scene refs
    // =========================================================================

    const imageGenerationStartTime = Date.now();

    // Flatten all blocks with their metadata for parallel processing
    interface BlockTask {
      dayIndex: number;
      blockIndex: number;
      block: { contentType: string; adCopy: string; imagePrompt: string; scheduledTime?: string };
      date: string;
      toneOfVoice: string; // Preserved from original campaignTimeline input
    }

    const allBlocks: BlockTask[] = [];
    for (let i = 0; i < aiContent.generatedContent.length; i++) {
      const day = aiContent.generatedContent[i];
      const currentDateISO = addDaysToISODate(startDateISO, i);
      // Get the original toneOfVoice from the input campaignTimeline
      const originalDay = campaignTimeline[i];
      for (let j = 0; j < day.contentBlocks.length; j++) {
        // Get the toneOfVoice from the original input block
        const originalToneOfVoice = originalDay?.contentBlocks[j]?.toneOfVoice || 'Professional';
        allBlocks.push({
          dayIndex: i,
          blockIndex: j,
          block: day.contentBlocks[j],
          date: currentDateISO,
          toneOfVoice: originalToneOfVoice,
        });
      }
    }

    // Use Imagen 4.0 Fast for large campaigns (4+ days) for better throughput
    const isLargeEvent = campaignRequest.duration >= LARGE_EVENT_THRESHOLD_DAYS;
    const imageModel = isLargeEvent ? 'imagen-4.0-fast-generate-001' : undefined; // undefined = use default

    console.log('[Campaign Generator] Starting image generation:', {
      totalImages: allBlocks.length,
      campaignDuration: campaignRequest.duration,
      isLargeEvent,
      imageModel: imageModel || 'default (imagen-4.0-generate-001)',
      mode: useCharacterConsistency ? 'character-consistent (sequential)' : 'parallel',
      maxConcurrent: useCharacterConsistency ? 1 : MAX_CONCURRENT_IMAGE_GENERATIONS,
    });

    // Results map: key = "dayIndex-blockIndex", value = imageUrl
    const imageResults: Map<string, string | undefined> = new Map();

    if (useCharacterConsistency && characterConfig!.useSceneToSceneConsistency) {
      // SEQUENTIAL mode: Character consistency with scene-to-scene requires previous image
      let previousSceneUrl: string | undefined = undefined;

      for (const task of allBlocks) {
        const key = `${task.dayIndex}-${task.blockIndex}`;
        let imageUrl: string | undefined = undefined;

        try {
          const imageResult = await generateCharacterConsistentImage({
            prompt: task.block.imagePrompt,
            brandId,
            characterReferenceUrls,
            previousSceneUrl,
          });
          imageUrl = imageResult.imageUrl;

          // Update previous scene URL for next iteration
          if (imageUrl) {
            previousSceneUrl = imageUrl;
          }
        } catch (error) {
          console.error(`Error generating character-consistent image for ${key}:`, error);
          // Fallback to standard generation
          console.log('Falling back to standard image generation');
          try {
            const fallbackResult = await generateAiImage({
              prompt: task.block.imagePrompt,
              brandId,
              model: imageModel, // Uses imagen-4.0-fast for large events
            });
            if (fallbackResult.imageUrl?.startsWith('data:')) {
              imageUrl = await uploadImageToStorage(fallbackResult.imageUrl, `block-${task.dayIndex}-${task.blockIndex}-${Date.now()}`);
            } else {
              imageUrl = fallbackResult.imageUrl || undefined;
            }
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
          }
        }

        imageResults.set(key, imageUrl);
      }
    } else if (useCharacterConsistency) {
      // Character consistency WITHOUT scene-to-scene: Can parallelize with concurrency limit
      const processBlock = async (task: BlockTask): Promise<void> => {
        const key = `${task.dayIndex}-${task.blockIndex}`;
        let imageUrl: string | undefined = undefined;

        try {
          const imageResult = await generateCharacterConsistentImage({
            prompt: task.block.imagePrompt,
            brandId,
            characterReferenceUrls,
            previousSceneUrl: undefined, // No scene-to-scene
          });
          imageUrl = imageResult.imageUrl;
        } catch (error) {
          console.error(`Error generating image for ${key}:`, error);
          console.log('Falling back to standard image generation');
          try {
            const fallbackResult = await generateAiImage({ prompt: task.block.imagePrompt, brandId, model: imageModel });
            if (fallbackResult.imageUrl?.startsWith('data:')) {
              imageUrl = await uploadImageToStorage(fallbackResult.imageUrl, `block-${task.dayIndex}-${task.blockIndex}-${Date.now()}`);
            } else {
              imageUrl = fallbackResult.imageUrl || undefined;
            }
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
          }
        }

        imageResults.set(key, imageUrl);
      };

      // Process in batches with concurrency limit
      for (let i = 0; i < allBlocks.length; i += MAX_CONCURRENT_IMAGE_GENERATIONS) {
        const batch = allBlocks.slice(i, i + MAX_CONCURRENT_IMAGE_GENERATIONS);
        await Promise.all(batch.map(processBlock));
      }
    } else {
      // PARALLEL mode: Standard image generation - process in concurrent batches
      // Use Imagen 4.0 Fast for large events (4+ days) for ~40% faster generation
      const processBlock = async (task: BlockTask): Promise<void> => {
        const key = `${task.dayIndex}-${task.blockIndex}`;
        let imageUrl: string | undefined = undefined;

        try {
          const imageResult = await generateAiImage({
            prompt: task.block.imagePrompt,
            brandId,
            model: imageModel, // Uses imagen-4.0-fast for large events
          });

          // Upload base64 image to Firebase Storage
          if (imageResult.imageUrl?.startsWith('data:')) {
            const blockId = `block-${task.dayIndex}-${task.blockIndex}-${Date.now()}`;
            imageUrl = await uploadImageToStorage(imageResult.imageUrl, blockId);
          } else {
            imageUrl = imageResult.imageUrl || undefined;
          }
        } catch (error) {
          console.error(`Error generating image for ${key}:`, error);
        }

        imageResults.set(key, imageUrl);
      };

      // Process ALL blocks in parallel with concurrency limit
      for (let i = 0; i < allBlocks.length; i += MAX_CONCURRENT_IMAGE_GENERATIONS) {
        const batch = allBlocks.slice(i, i + MAX_CONCURRENT_IMAGE_GENERATIONS);
        await Promise.all(batch.map(processBlock));
      }
    }

    const imageGenerationTime = Date.now() - imageGenerationStartTime;
    console.log('[Campaign Generator] Image generation complete:', {
      totalImages: allBlocks.length,
      timeMs: imageGenerationTime,
      avgTimePerImage: Math.round(imageGenerationTime / allBlocks.length),
    });

    // Create a map for toneOfVoice lookup during reconstruction
    const toneOfVoiceMap: Map<string, string> = new Map();
    for (const task of allBlocks) {
      const key = `${task.dayIndex}-${task.blockIndex}`;
      toneOfVoiceMap.set(key, task.toneOfVoice);
    }

    // Reconstruct campaign days from results
    const campaignDaysWithImages: CampaignDay[] = [];

    for (let i = 0; i < aiContent.generatedContent.length; i++) {
      const day = aiContent.generatedContent[i];
      const currentDateISO = addDaysToISODate(startDateISO, i);
      const contentBlocksWithImages: GeneratedContentBlock[] = [];

      for (let j = 0; j < day.contentBlocks.length; j++) {
        const block = day.contentBlocks[j];
        const key = `${i}-${j}`;
        const imageUrl = imageResults.get(key);
        const toneOfVoice = toneOfVoiceMap.get(key) || 'Professional';

        // Build block data, filtering out undefined values to avoid Firestore errors
        const blockData: GeneratedContentBlock = {
          id: `block-${i}-${j}-${Date.now()}`,
          contentType: block.contentType,
          adCopy: block.adCopy,
          imagePrompt: block.imagePrompt,
          keyMessage: block.adCopy,
          toneOfVoice: toneOfVoice,
        };
        // Only add imageUrl if it exists (Firestore doesn't allow undefined)
        if (imageUrl) {
          blockData.imageUrl = imageUrl;
        }
        // Only add scheduledTime if it exists
        if (block.scheduledTime) {
          blockData.scheduledTime = block.scheduledTime;
        }
        contentBlocksWithImages.push(blockData);
      }

      campaignDaysWithImages.push({
        id: `day-${i}-${Date.now()}`,
        day: i + 1,
        date: currentDateISO,
        contentBlocks: contentBlocksWithImages as any,
      });
    }

    console.log('[Campaign Generator] Complete campaign generated:', {
      totalDays: campaignDaysWithImages.length,
      totalBlocks: campaignDaysWithImages.reduce((sum, day) => sum + day.contentBlocks.length, 0),
      sampleDay: campaignDaysWithImages[0] ? {
        day: campaignDaysWithImages[0].day,
        date: campaignDaysWithImages[0].date,
        blocksCount: campaignDaysWithImages[0].contentBlocks.length,
        firstBlock: campaignDaysWithImages[0].contentBlocks[0],
      } : null,
    });

    // Auto-save the generated campaign to Firestore for preview using batched writes
    const startTime = Date.now();
    const { adminDb } = getAdminInstances();
    
    const campaignDocRef = adminDb.collection('campaigns').doc();
    const campaignId = campaignDocRef.id;
    const now = new Date().toISOString();
    
    // Firestore batch limit is 500 operations. Calculate total operations needed.
    const totalOps = 1 + campaignDaysWithImages.reduce((sum, day) => sum + 1 + day.contentBlocks.length, 0);
    const BATCH_LIMIT = 500;
    
    if (totalOps > BATCH_LIMIT) {
      // For large campaigns, use sequential writes to avoid batch limit
      console.log(`[Campaign Generator] Large campaign detected (${totalOps} operations), using sequential writes`);
      
      // Save campaign metadata
      await campaignDocRef.set({
        id: campaignId,
        brandId,
        name: uniqueCampaignName,
        originalPrompt: prompt, // Master prompt - persists and is editable
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });
      
      // Save days and blocks sequentially
      for (const dayData of campaignDaysWithImages) {
        const dayDocRef = campaignDocRef.collection('days').doc();
        await dayDocRef.set({
          day: dayData.day,
          date: dayData.date,
          createdAt: now,
          updatedAt: now,
        });
        
        // Use Promise.all to parallelize block writes within each day
        await Promise.all(
          dayData.contentBlocks.map(async (block: any) => {
            const blockDocRef = dayDocRef.collection('contentBlocks').doc();
            const blockData: any = {
              contentType: block.contentType,
              adCopy: block.adCopy,
              imagePrompt: block.imagePrompt,
              keyMessage: block.keyMessage,
              createdAt: now,
              updatedAt: now,
            };
            // Only add imageUrl if it exists (Firestore doesn't allow undefined)
            if (block.imageUrl) {
              blockData.imageUrl = block.imageUrl;
            }
            if (block.scheduledTime !== undefined) {
              blockData.scheduledTime = block.scheduledTime;
            }
            if (block.toneOfVoice) {
              blockData.toneOfVoice = block.toneOfVoice;
            }
            await blockDocRef.set(blockData);
          })
        );
      }
    } else {
      // For normal-sized campaigns, use single batched write for best performance
      console.log(`[Campaign Generator] Normal campaign size (${totalOps} operations), using batched writes`);
      
      const batch = adminDb.batch();
      
      // Save campaign metadata to main document
      batch.set(campaignDocRef, {
        id: campaignId,
        brandId,
        name: uniqueCampaignName,
        originalPrompt: prompt, // Master prompt - persists and is editable
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });
      
      // Prepare all day and content block writes in batch
      for (const dayData of campaignDaysWithImages) {
        const dayDocRef = campaignDocRef.collection('days').doc();
        
        batch.set(dayDocRef, {
          day: dayData.day,
          date: dayData.date,
          createdAt: now,
          updatedAt: now,
        });
        
        // Add each content block to the batch
        for (const block of dayData.contentBlocks) {
          const blockDocRef = dayDocRef.collection('contentBlocks').doc();

          // Build block data object, filtering out undefined values
          const blockData: any = {
            contentType: block.contentType,
            adCopy: block.adCopy,
            imagePrompt: (block as any).imagePrompt,
            keyMessage: block.keyMessage,
            createdAt: now,
            updatedAt: now,
          };

          // Only add imageUrl if it exists (Firestore doesn't allow undefined)
          if (block.imageUrl) {
            blockData.imageUrl = block.imageUrl;
          }

          // Only add scheduledTime if it's defined
          if (block.scheduledTime !== undefined) {
            blockData.scheduledTime = block.scheduledTime;
          }

          // Only add toneOfVoice if it exists
          if (block.toneOfVoice) {
            blockData.toneOfVoice = block.toneOfVoice;
          }

          batch.set(blockDocRef, blockData);
        }
      }
      
      // Commit all writes atomically in a single batch operation
      await batch.commit();
    }
    
    const saveTime = Date.now() - startTime;
    console.log('[Campaign Generator] Campaign auto-saved to Firestore:', {
      campaignId,
      totalDays: campaignDaysWithImages.length,
      totalBlocks: campaignDaysWithImages.reduce((sum, day) => sum + day.contentBlocks.length, 0),
      totalOperations: totalOps,
      saveTimeMs: saveTime,
    });

    return NextResponse.json({
      success: true,
      campaignId,
      campaignName: uniqueCampaignName,
      campaignDays: campaignDaysWithImages,
      campaignRequest,
      originalPrompt: prompt, // Return master prompt for frontend to display/edit
    });

  } catch (error) {
    console.error('Error generating campaign content:', error);
    return NextResponse.json(
      { error: `Failed to generate campaign: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
