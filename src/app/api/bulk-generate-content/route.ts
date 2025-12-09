import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { generateAICampaignContent, BatchProgressCallback } from '@/ai/flows/generate-ai-campaign-content';
import { generateAiImage, generateCharacterConsistentImage } from '@/ai/flows/generate-ai-images';
import { getAdminInstances } from '@/lib/firebase/admin';
import type { GeneratedCampaignContent, CharacterConsistencyConfig } from '@/lib/types';

// Constants for parallel processing
const MAX_CONCURRENT_IMAGE_GENERATIONS = 10;
const LARGE_EVENT_THRESHOLD_DAYS = 4;

type GenerationType = 'text' | 'images' | 'all';

interface BulkGenerateRequest {
  campaignId: string;
  brandId: string;
  generationType: GenerationType;
  characterConsistency?: CharacterConsistencyConfig;
  // For targeting specific blocks (optional)
  dayIndices?: number[];
  blockIndices?: { dayIndex: number; blockIndex: number }[];
}

/**
 * Bulk generate content (text and/or images) for an existing campaign.
 * This is called from the Initiative Content Editor after a campaign has been created.
 */
export async function POST(request: NextRequest) {
  try {
    const body: BulkGenerateRequest = await request.json();
    const { campaignId, brandId, generationType, characterConsistency, dayIndices, blockIndices } = body;

    if (!campaignId || !brandId) {
      return NextResponse.json(
        { error: 'campaignId and brandId are required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb, adminStorage } = getAdminInstances();
    const bucket = adminStorage.bucket();

    // Load the campaign from Firestore
    const campaignDoc = await adminDb.collection('campaigns').doc(campaignId).get();
    if (!campaignDoc.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaignData = campaignDoc.data()!;
    const campaignName = campaignData.name;
    const campaignGoal = campaignData.campaignGoal || '';

    // Use characterConsistency from request, or fall back to stored config in Firestore
    const effectiveCharacterConsistency = characterConsistency || campaignData.characterConsistency;

    // Load all days and content blocks
    const daysSnapshot = await adminDb
      .collection('campaigns')
      .doc(campaignId)
      .collection('days')
      .orderBy('day')
      .get();

    const campaignContent: GeneratedCampaignContent = [];

    for (const dayDoc of daysSnapshot.docs) {
      const dayData = dayDoc.data();
      const blocksSnapshot = await dayDoc.ref.collection('contentBlocks').get();

      const contentBlocks = blocksSnapshot.docs.map((blockDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const blockData = blockDoc.data();
        return {
          id: blockDoc.id,
          contentType: blockData.contentType as string,
          adCopy: (blockData.adCopy || '') as string,
          imagePrompt: (blockData.imagePrompt || '') as string,
          keyMessage: (blockData.keyMessage || '') as string,
          imageUrl: blockData.imageUrl as string | undefined,
          toneOfVoice: blockData.toneOfVoice as string | undefined,
          scheduledTime: blockData.scheduledTime as string | undefined,
        };
      });

      campaignContent.push({
        day: dayData.day,
        date: dayData.date,
        contentBlocks,
      });
    }

    console.log('[Bulk Generate] Starting generation:', {
      campaignId,
      campaignName,
      generationType,
      totalDays: campaignContent.length,
      totalBlocks: campaignContent.reduce((sum, day) => sum + day.contentBlocks.length, 0),
    });

    // Filter to only process specified days/blocks if provided
    let blocksToProcess: { dayIndex: number; blockIndex: number; block: any; date: string }[] = [];

    for (let dayIndex = 0; dayIndex < campaignContent.length; dayIndex++) {
      // Skip if dayIndices specified and this day not included
      if (dayIndices && !dayIndices.includes(dayIndex)) continue;

      const day = campaignContent[dayIndex];
      for (let blockIndex = 0; blockIndex < day.contentBlocks.length; blockIndex++) {
        // Skip if blockIndices specified and this block not included
        if (blockIndices && !blockIndices.some(b => b.dayIndex === dayIndex && b.blockIndex === blockIndex)) {
          continue;
        }

        blocksToProcess.push({
          dayIndex,
          blockIndex,
          block: day.contentBlocks[blockIndex],
          date: day.date || '',
        });
      }
    }

    // Generate TEXT content if requested
    if (generationType === 'text' || generationType === 'all') {
      console.log('[Bulk Generate] Generating text content...');

      // Build brand profile for AI generation
      const brandProfile = `Campaign: ${campaignName}\nGoal: ${campaignGoal || 'Generate engaging content'}`;

      // Create batch callback for incremental saves to prevent data loss on large campaigns
      const onBatchComplete: BatchProgressCallback = async (batchContent, batchStart, batchEnd, total) => {
        console.log(`[Bulk Generate] Saving batch ${Math.floor(batchStart / 7) + 1} (days ${batchStart + 1}-${batchEnd}) to Firestore`);
        const now = new Date().toISOString();

        for (const aiDay of batchContent) {
          const dayIndex = aiDay.day - 1;
          const originalDay = campaignContent[dayIndex];
          const dayDoc = daysSnapshot.docs[dayIndex];

          if (!dayDoc || !originalDay) continue;

          const blocksSnapshot = await dayDoc.ref.collection('contentBlocks').get();

          for (let blockIndex = 0; blockIndex < aiDay.contentBlocks.length; blockIndex++) {
            const aiBlock = aiDay.contentBlocks[blockIndex];
            const originalBlock = originalDay.contentBlocks[blockIndex];
            const blockDoc = blocksSnapshot.docs[blockIndex];

            if (!originalBlock || !blockDoc) continue;

            // Update in-memory content
            originalBlock.adCopy = aiBlock.adCopy;
            originalBlock.imagePrompt = aiBlock.imagePrompt;

            // Immediate save to Firestore
            await blockDoc.ref.update({
              adCopy: aiBlock.adCopy,
              imagePrompt: aiBlock.imagePrompt,
              updatedAt: now,
            });
          }
        }
      };

      // Generate AI content for all days with incremental saves
      try {
        await generateAICampaignContent({
          brandId,
          brandProfile,
          campaignTimeline: campaignContent.map(day => ({
            id: `day-${day.day}`,
            day: day.day,
            date: day.date || '',
            contentBlocks: day.contentBlocks.map(block => ({
              contentType: block.contentType,
              keyMessage: block.keyMessage || '',
              toneOfVoice: block.toneOfVoice || 'Professional',
            })),
          })),
        }, onBatchComplete);
      } catch (error: any) {
        // If partial content was saved, log it but continue
        if (error.processedDays && error.processedDays > 0) {
          console.log(`[Bulk Generate] Partial save: ${error.processedDays}/${error.totalDays} days saved before error`);
          // Continue with what we have - the callback already saved the partial content
        } else {
          throw error;
        }
      }

      console.log('[Bulk Generate] Text generation complete');
    }

    // Generate IMAGES if requested
    if (generationType === 'images' || generationType === 'all') {
      console.log('[Bulk Generate] Generating images...');

      const isLargeEvent = campaignContent.length >= LARGE_EVENT_THRESHOLD_DAYS;
      const imageModel = isLargeEvent ? 'imagen-4.0-fast-generate-001' : undefined;

      // Check character consistency config (use effective config from request or Firestore)
      const useCharacterConsistency = effectiveCharacterConsistency?.enabled &&
        effectiveCharacterConsistency.characters &&
        effectiveCharacterConsistency.characters.length > 0 &&
        effectiveCharacterConsistency.characters.some((c: any) => c.isActive);

      const characterReferenceUrls = useCharacterConsistency
        ? effectiveCharacterConsistency!.characters
            .filter((c: any) => c.isActive)
            .map((c: any) => c.characterSheetUrl)
        : [];

      // Helper function to upload base64 image to Firebase Storage
      async function uploadImageToStorage(dataUri: string, blockId: string): Promise<string> {
        const mimeType = dataUri.substring(dataUri.indexOf(':') + 1, dataUri.indexOf(';'));
        const base64Data = dataUri.substring(dataUri.indexOf(',') + 1);
        const buffer = Buffer.from(base64Data, 'base64');

        const filePath = `campaigns/${brandId}/${campaignName}/${blockId}.png`;
        const file = bucket.file(filePath);

        await file.save(buffer, { metadata: { contentType: mimeType } });

        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2500',
        });

        return signedUrl;
      }

      // Process blocks that need images
      const blocksNeedingImages = blocksToProcess.filter(
        item => item.block.imagePrompt && !item.block.imageUrl
      );

      console.log('[Bulk Generate] Generating images for', blocksNeedingImages.length, 'blocks');

      if (useCharacterConsistency && effectiveCharacterConsistency!.useSceneToSceneConsistency) {
        // Sequential mode for scene-to-scene consistency
        let previousSceneUrl: string | undefined = undefined;

        for (const item of blocksNeedingImages) {
          try {
            const imageResult = await generateCharacterConsistentImage({
              prompt: item.block.imagePrompt,
              brandId,
              characterReferenceUrls,
              previousSceneUrl,
            });

            if (imageResult.imageUrl) {
              item.block.imageUrl = imageResult.imageUrl;
              previousSceneUrl = imageResult.imageUrl;
            }
          } catch (error) {
            console.error(`[Bulk Generate] Error generating image for day ${item.dayIndex + 1}, block ${item.blockIndex + 1}:`, error);
          }
        }
      } else {
        // Parallel mode
        const processBlock = async (item: typeof blocksNeedingImages[0]): Promise<void> => {
          try {
            if (useCharacterConsistency) {
              const imageResult = await generateCharacterConsistentImage({
                prompt: item.block.imagePrompt,
                brandId,
                characterReferenceUrls,
              });
              if (imageResult.imageUrl) {
                item.block.imageUrl = imageResult.imageUrl;
              }
            } else {
              const imageResult = await generateAiImage({
                prompt: item.block.imagePrompt,
                brandId,
                model: imageModel,
              });

              if (imageResult.imageUrl?.startsWith('data:')) {
                item.block.imageUrl = await uploadImageToStorage(
                  imageResult.imageUrl,
                  `block-${item.dayIndex}-${item.blockIndex}-${Date.now()}`
                );
              } else if (imageResult.imageUrl) {
                item.block.imageUrl = imageResult.imageUrl;
              }
            }
          } catch (error) {
            console.error(`[Bulk Generate] Error generating image:`, error);
          }
        };

        // Process in batches
        for (let i = 0; i < blocksNeedingImages.length; i += MAX_CONCURRENT_IMAGE_GENERATIONS) {
          const batch = blocksNeedingImages.slice(i, i + MAX_CONCURRENT_IMAGE_GENERATIONS);
          await Promise.all(batch.map(processBlock));
        }
      }

      console.log('[Bulk Generate] Image generation complete');
    }

    // Save updated content back to Firestore
    console.log('[Bulk Generate] Saving updated content to Firestore...');

    const daysDocsSnapshot = await adminDb
      .collection('campaigns')
      .doc(campaignId)
      .collection('days')
      .orderBy('day')
      .get();

    const now = new Date().toISOString();

    for (let dayIndex = 0; dayIndex < daysDocsSnapshot.docs.length; dayIndex++) {
      const dayDoc = daysDocsSnapshot.docs[dayIndex];
      const day = campaignContent[dayIndex];

      const blocksSnapshot = await dayDoc.ref.collection('contentBlocks').get();

      for (let blockIndex = 0; blockIndex < blocksSnapshot.docs.length; blockIndex++) {
        const blockDoc = blocksSnapshot.docs[blockIndex];
        const block = day.contentBlocks[blockIndex];

        const updateData: any = {
          adCopy: block.adCopy,
          imagePrompt: block.imagePrompt,
          updatedAt: now,
        };

        if (block.imageUrl) {
          updateData.imageUrl = block.imageUrl;
        }

        await blockDoc.ref.update(updateData);
      }
    }

    // Update campaign metadata
    await adminDb.collection('campaigns').doc(campaignId).update({
      contentGenerated: true,
      updatedAt: now,
    });

    console.log('[Bulk Generate] Complete:', {
      campaignId,
      generationType,
      totalBlocksProcessed: blocksToProcess.length,
    });

    return NextResponse.json({
      success: true,
      campaignId,
      generationType,
      updatedContent: campaignContent,
    });

  } catch (error) {
    console.error('Error in bulk generate:', error);
    return NextResponse.json(
      { error: `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
