import { NextRequest } from 'next/server';
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
  dayIndices?: number[];
  blockIndices?: { dayIndex: number; blockIndex: number }[];
}

interface ProgressEvent {
  type: 'progress' | 'block_complete' | 'phase_complete' | 'complete' | 'error';
  progress: number;
  message: string;
  phase?: 'loading' | 'text' | 'images' | 'saving';
  currentBlock?: number;
  totalBlocks?: number;
  updatedContent?: GeneratedCampaignContent;
  error?: string;
}

/**
 * SSE endpoint for bulk content generation with real-time progress tracking.
 * Streams progress updates as each block is processed.
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Create a stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let isControllerClosed = false;

      // Helper to send SSE events safely
      const sendEvent = (event: ProgressEvent) => {
        if (isControllerClosed) return;
        try {
          // Ensure progress is a whole number for clean display
          if (typeof event.progress === 'number') {
            event.progress = Math.round(event.progress);
          }
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          console.error('[Stream Bulk Generate] Error enqueuing event:', error);
          isControllerClosed = true;
        }
      };

      const safeClose = () => {
        if (!isControllerClosed) {
          try {
            controller.close();
          } catch (e) {
            console.error('[Stream Bulk Generate] Error closing controller:', e);
          }
          isControllerClosed = true;
        }
      };

      try {
        const body: BulkGenerateRequest = await request.json();
        const { campaignId, brandId, generationType, characterConsistency, dayIndices, blockIndices } = body;

        if (!campaignId || !brandId) {
          sendEvent({
            type: 'error',
            progress: 0,
            message: 'campaignId and brandId are required',
            error: 'campaignId and brandId are required',
          });
          safeClose();
          return;
        }

        // Authenticate user
        const user = await getAuthenticatedUser();
        await requireBrandAccess(user.uid, brandId);

        sendEvent({
          type: 'progress',
          progress: 5,
          message: 'Loading campaign data...',
          phase: 'loading',
        });

        const { adminDb, adminStorage } = getAdminInstances();
        const bucket = adminStorage.bucket();

        // Load the campaign from Firestore
        const campaignDoc = await adminDb.collection('campaigns').doc(campaignId).get();
        if (!campaignDoc.exists) {
          sendEvent({
            type: 'error',
            progress: 0,
            message: 'Campaign not found',
            error: 'Campaign not found',
          });
          safeClose();
          return;
        }

        const campaignData = campaignDoc.data()!;
        const campaignName = campaignData.name;
        const campaignGoal = campaignData.campaignGoal || '';
        const effectiveCharacterConsistency = characterConsistency || campaignData.characterConsistency;
        // Load the master campaign prompt (originalPrompt) that guides all content generation
        const campaignPrompt = campaignData.originalPrompt || '';

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

        sendEvent({
          type: 'progress',
          progress: 10,
          message: 'Campaign data loaded',
          phase: 'loading',
        });

        // Calculate total blocks for progress tracking
        const totalBlocks = campaignContent.reduce((sum, day) => sum + day.contentBlocks.length, 0);
        let processedBlocks = 0;

        // Filter to only process specified days/blocks if provided
        const blocksToProcess: { dayIndex: number; blockIndex: number; block: any; date: string }[] = [];

        for (let dayIndex = 0; dayIndex < campaignContent.length; dayIndex++) {
          if (dayIndices && !dayIndices.includes(dayIndex)) continue;

          const day = campaignContent[dayIndex];
          for (let blockIndex = 0; blockIndex < day.contentBlocks.length; blockIndex++) {
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

        // Calculate progress ranges based on generation type
        // Reserve 10% for loading, 10% for saving
        const progressStart = 10;
        const progressEnd = 90;
        const progressRange = progressEnd - progressStart;

        let textProgressRange = 0;
        let imageProgressRange = 0;

        if (generationType === 'text') {
          textProgressRange = progressRange;
        } else if (generationType === 'images') {
          imageProgressRange = progressRange;
        } else {
          // 'all' - split progress between text and images
          textProgressRange = progressRange * 0.4; // 40% for text
          imageProgressRange = progressRange * 0.6; // 60% for images
        }

        // Generate TEXT content if requested
        if (generationType === 'text' || generationType === 'all') {
          sendEvent({
            type: 'progress',
            progress: progressStart,
            message: 'Generating text content...',
            phase: 'text',
            currentBlock: 0,
            totalBlocks,
          });

          // Build brand profile including the campaign prompt for text generation
          let brandProfile = `Campaign: ${campaignName}\nGoal: ${campaignGoal || 'Generate engaging content'}`;

          // Text generation is a single API call, but we can show intermediate progress
          const textStartProgress = progressStart;
          const textEndProgress = progressStart + textProgressRange;

          sendEvent({
            type: 'progress',
            progress: textStartProgress + textProgressRange * 0.3,
            message: 'AI is generating text...',
            phase: 'text',
          });

          // Helper for keep-alive during long AI calls
          const withKeepAlive = async <T>(
            promise: Promise<T>,
            baseProgress: number,
            maxProgress: number
          ): Promise<T> => {
            let currentProgress = baseProgress;
            const interval = setInterval(() => {
              if (!isControllerClosed) {
                try {
                  // Increment progress slowly up to maxProgress
                  if (currentProgress < maxProgress) {
                    currentProgress += 0.5; // Increment by 0.5% every 2 seconds
                    sendEvent({
                      type: 'progress',
                      progress: currentProgress,
                      message: 'AI is generating text...',
                      phase: 'text',
                    });
                  } else {
                    // Send a comment keep-alive if we've reached maxProgress
                    controller.enqueue(encoder.encode(': keep-alive\n\n'));
                  }
                } catch (e) {
                  clearInterval(interval);
                }
              } else {
                clearInterval(interval);
              }
            }, 2000); // 2 seconds

            try {
              return await promise;
            } finally {
              clearInterval(interval);
            }
          };

          // Create a callback to save each batch immediately as it's generated
          // This ensures partial saves even if the job fails mid-way
          const onBatchComplete: BatchProgressCallback = async (batchContent, batchStart, batchEnd, total) => {
            const batchNum = Math.floor(batchStart / 7) + 1;
            const totalBatches = Math.ceil(total / 7);
            const batchProgress = textStartProgress + (textProgressRange * (batchEnd / total));

            sendEvent({
              type: 'progress',
              progress: batchProgress,
              message: `Saving batch ${batchNum}/${totalBatches} (days ${batchStart + 1}-${batchEnd})...`,
              phase: 'text',
            });

            // Save this batch immediately to Firestore
            const now = new Date().toISOString();
            for (const aiDay of batchContent) {
              const dayIndex = aiDay.day - 1; // Convert 1-indexed day to 0-indexed
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
                processedBlocks++;

                // Immediate save to Firestore
                await blockDoc.ref.update({
                  adCopy: aiBlock.adCopy,
                  imagePrompt: aiBlock.imagePrompt,
                  updatedAt: now,
                });
              }
            }

            console.log(`[Stream Bulk Generate] Saved batch ${batchNum}/${totalBatches} to Firestore`);
          };

          let aiContent;
          let partialSaveOccurred = false;

          try {
            aiContent = await withKeepAlive(
              generateAICampaignContent({
                brandId,
                brandProfile,
                campaignPrompt: campaignPrompt || undefined,
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
              }, onBatchComplete),
              textStartProgress + textProgressRange * 0.3,
              textStartProgress + textProgressRange * 0.9
            );
          } catch (error: any) {
            // Check if we have partial content saved
            if (error.processedDays && error.processedDays > 0) {
              console.log(`[Stream Bulk Generate] Partial save: ${error.processedDays}/${error.totalDays} days saved before error`);
              partialSaveOccurred = true;

              sendEvent({
                type: 'progress',
                progress: textStartProgress + textProgressRange * (error.processedDays / error.totalDays),
                message: `Partial save: ${error.processedDays}/${error.totalDays} days saved. Error: ${error.message}`,
                phase: 'text',
              });

              // Create a partial result to continue with what we have
              aiContent = { generatedContent: error.partialContent || [] };
            } else {
              throw error;
            }
          }

          sendEvent({
            type: 'progress',
            progress: textStartProgress + textProgressRange * 0.95,
            message: partialSaveOccurred
              ? `Partial text generation complete (${aiContent.generatedContent.length} days saved)`
              : 'Processing generated text...',
            phase: 'text',
          });

          sendEvent({
            type: 'phase_complete',
            progress: textEndProgress,
            message: 'Text generation complete',
            phase: 'text',
            currentBlock: totalBlocks,
            totalBlocks,
          });
        }

        // Generate IMAGES if requested
        if (generationType === 'images' || generationType === 'all') {
          const imageStartProgress = generationType === 'all' ? progressStart + textProgressRange : progressStart;
          const imageEndProgress = progressEnd;

          const blocksNeedingImages = blocksToProcess.filter(
            item => item.block.imagePrompt && !item.block.imageUrl
          );

          const imageCount = blocksNeedingImages.length;

          if (imageCount === 0) {
            sendEvent({
              type: 'phase_complete',
              progress: imageEndProgress,
              message: 'No images to generate',
              phase: 'images',
            });
          } else {
            sendEvent({
              type: 'progress',
              progress: imageStartProgress,
              message: `Generating ${imageCount} images...`,
              phase: 'images',
              currentBlock: 0,
              totalBlocks: imageCount,
            });

            const isLargeEvent = campaignContent.length >= LARGE_EVENT_THRESHOLD_DAYS;
            const imageModel = isLargeEvent ? 'imagen-4.0-fast-generate-001' : undefined;

            const useCharacterConsistency = effectiveCharacterConsistency?.enabled &&
              effectiveCharacterConsistency.characters &&
              effectiveCharacterConsistency.characters.length > 0 &&
              effectiveCharacterConsistency.characters.some((c: any) => c.isActive);

            const characterReferenceUrls = useCharacterConsistency
              ? effectiveCharacterConsistency!.characters
                  .filter((c: any) => c.isActive)
                  .map((c: any) => c.characterSheetUrl)
              : [];

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

            let imagesCompleted = 0;

            const calculateImageProgress = () => {
              const progressPerImage = (imageEndProgress - imageStartProgress) / imageCount;
              return imageStartProgress + (imagesCompleted * progressPerImage);
            };

            if (useCharacterConsistency && effectiveCharacterConsistency!.useSceneToSceneConsistency) {
              // Sequential mode for scene-to-scene consistency
              let previousSceneUrl: string | undefined = undefined;

              for (const item of blocksNeedingImages) {
                try {
                  sendEvent({
                    type: 'progress',
                    progress: calculateImageProgress(),
                    message: `Generating image ${imagesCompleted + 1}/${imageCount}...`,
                    phase: 'images',
                    currentBlock: imagesCompleted + 1,
                    totalBlocks: imageCount,
                  });

                  const imageResult = await generateCharacterConsistentImage({
                    prompt: item.block.imagePrompt,
                    brandId,
                    campaignPrompt: campaignPrompt || undefined,
                    characterReferenceUrls,
                    previousSceneUrl,
                  });

                  if (imageResult.imageUrl) {
                    item.block.imageUrl = imageResult.imageUrl;
                    previousSceneUrl = imageResult.imageUrl;
                  }

                  imagesCompleted++;
                  sendEvent({
                    type: 'block_complete',
                    progress: calculateImageProgress(),
                    message: `Image ${imagesCompleted}/${imageCount} complete`,
                    phase: 'images',
                    currentBlock: imagesCompleted,
                    totalBlocks: imageCount,
                  });

                  // Immediate save for this block's image
                  const dayDoc = daysSnapshot.docs[item.dayIndex];
                  const blockDoc = (await dayDoc.ref.collection('contentBlocks').get()).docs[item.blockIndex];
                  await blockDoc.ref.update({
                    imageUrl: item.block.imageUrl,
                    updatedAt: new Date().toISOString(),
                  });
                } catch (error) {
                  console.error(`[Stream Bulk Generate] Error generating image:`, error);
                  imagesCompleted++;
                }
              }
            } else {
              // Parallel mode with progress tracking per batch
              const processBlock = async (item: typeof blocksNeedingImages[0]): Promise<void> => {
                try {
                  if (useCharacterConsistency) {
                    const imageResult = await generateCharacterConsistentImage({
                      prompt: item.block.imagePrompt,
                      brandId,
                      campaignPrompt: campaignPrompt || undefined,
                      characterReferenceUrls,
                    });
                    if (imageResult.imageUrl) {
                      item.block.imageUrl = imageResult.imageUrl;
                    }
                  } else {
                    const imageResult = await generateAiImage({
                      prompt: item.block.imagePrompt,
                      brandId,
                      campaignPrompt: campaignPrompt || undefined,
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

                  imagesCompleted++;
                  sendEvent({
                    type: 'block_complete',
                    progress: calculateImageProgress(),
                    message: `Image ${imagesCompleted}/${imageCount} complete`,
                    phase: 'images',
                    currentBlock: imagesCompleted,
                    totalBlocks: imageCount,
                  });

                  // Immediate save for this block's image
                  const dayDoc = daysSnapshot.docs[item.dayIndex];
                  const blockDoc = (await dayDoc.ref.collection('contentBlocks').get()).docs[item.blockIndex];
                  await blockDoc.ref.update({
                    imageUrl: item.block.imageUrl,
                    updatedAt: new Date().toISOString(),
                  });
                } catch (error) {
                  console.error(`[Stream Bulk Generate] Error generating image:`, error);
                  imagesCompleted++;
                }
              };

              // Process in batches with progress updates
              for (let i = 0; i < blocksNeedingImages.length; i += MAX_CONCURRENT_IMAGE_GENERATIONS) {
                const batch = blocksNeedingImages.slice(i, i + MAX_CONCURRENT_IMAGE_GENERATIONS);
                const batchNum = Math.floor(i / MAX_CONCURRENT_IMAGE_GENERATIONS) + 1;
                const totalBatches = Math.ceil(blocksNeedingImages.length / MAX_CONCURRENT_IMAGE_GENERATIONS);

                sendEvent({
                  type: 'progress',
                  progress: calculateImageProgress(),
                  message: `Processing batch ${batchNum}/${totalBatches}...`,
                  phase: 'images',
                  currentBlock: imagesCompleted,
                  totalBlocks: imageCount,
                });

                await Promise.all(batch.map(processBlock));
              }
            }

            sendEvent({
              type: 'phase_complete',
              progress: imageEndProgress,
              message: `All ${imageCount} images generated`,
              phase: 'images',
              currentBlock: imageCount,
              totalBlocks: imageCount,
            });
          }
        }

        // Save updated content to Firestore
        sendEvent({
          type: 'progress',
          progress: 92,
          message: 'Saving updated content...',
          phase: 'saving',
        });

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

        await adminDb.collection('campaigns').doc(campaignId).update({
          contentGenerated: true,
          updatedAt: now,
        });

        sendEvent({
          type: 'progress',
          progress: 98,
          message: 'Content saved successfully',
          phase: 'saving',
        });

        // Send final completion event with updated content
        sendEvent({
          type: 'complete',
          progress: 100,
          message: 'Generation complete',
          updatedContent: campaignContent,
        });

        safeClose();

      } catch (error) {
        console.error('[Stream Bulk Generate] Error:', error);
        sendEvent({
          type: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
