import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { parseCampaignRequest, calculatePostSchedule, generateContentBlockInstructions } from '@/lib/campaign-creation-agent';
import { addDaysToISODate } from '@/lib/utils';
import { verifyServiceToken } from '@/lib/auth-helpers';
import { getAdminInstances } from '@/lib/firebase/admin';
import type { CampaignDay, GeneratedContentBlock } from '@/lib/types';

/**
 * Create a campaign without generating AI content (text/images).
 * This creates the campaign structure with days and empty content blocks,
 * allowing the user to generate content later from the Initiative Content Editor.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, brandId, characterConsistency } = body;

    if (!prompt || !brandId) {
      return NextResponse.json(
        { error: 'Prompt and brandId are required' },
        { status: 400 }
      );
    }

    // Check for service token authentication (for backend agent calls)
    let userId: string;

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

      // Still enforce brand access for the user on behalf of whom the agent is acting
      await requireBrandAccess(userId, brandId);
    } else {
      // Regular user authentication
      const user = await getAuthenticatedUser();
      userId = user.uid;
      await requireBrandAccess(userId, brandId);
    }

    // Parse the campaign request from natural language
    const campaignRequest = await parseCampaignRequest(prompt);

    const startDateISO = campaignRequest.startDate;
    const startDate = new Date(startDateISO + 'T00:00:00');
    const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const uniqueCampaignName = `${campaignRequest.campaignName} - ${dateStr}`;

    // Calculate post distribution across days
    const postSchedule = calculatePostSchedule(
      campaignRequest.duration,
      campaignRequest.postsPerDay,
      campaignRequest.postDistribution
    );

    // Build campaign days with empty content blocks (no AI generation)
    const campaignDays: CampaignDay[] = [];

    for (let i = 0; i < campaignRequest.duration; i++) {
      const currentDateISO = addDaysToISODate(startDateISO, i);
      const postsForDay = postSchedule[i];
      const contentBlocks: GeneratedContentBlock[] = [];

      // Generate content block instructions for metadata
      const blockInstructions = generateContentBlockInstructions(
        campaignRequest.campaignGoal,
        campaignRequest.contentTypes,
        campaignRequest.tones
      );

      for (let j = 0; j < postsForDay; j++) {
        const instruction = blockInstructions[Math.floor(Math.random() * blockInstructions.length)];

        // Create empty content block with metadata but no generated content
        contentBlocks.push({
          id: `block-${i}-${j}-${Date.now()}`,
          contentType: instruction.contentType,
          adCopy: '', // Empty - to be generated later
          imagePrompt: '', // Empty - to be generated later
          keyMessage: instruction.keyMessage,
          toneOfVoice: instruction.toneOfVoice,
          // No imageUrl - to be generated later
        });
      }

      campaignDays.push({
        id: `day-${i}-${Date.now()}`,
        day: i + 1,
        date: currentDateISO,
        contentBlocks: contentBlocks as any,
      });
    }

    console.log('[Create Campaign] Creating campaign without AI generation:', {
      campaignName: uniqueCampaignName,
      totalDays: campaignDays.length,
      totalBlocks: campaignDays.reduce((sum, day) => sum + day.contentBlocks.length, 0),
    });

    // Save to Firestore
    const { adminDb } = getAdminInstances();
    const campaignDocRef = adminDb.collection('campaigns').doc();
    const campaignId = campaignDocRef.id;
    const now = new Date().toISOString();

    // Calculate total operations for batch decision
    const totalOps = 1 + campaignDays.reduce((sum, day) => sum + 1 + day.contentBlocks.length, 0);
    const BATCH_LIMIT = 500;

    // Store the original prompt and character consistency config for later generation
    const campaignMetadata = {
      id: campaignId,
      brandId,
      name: uniqueCampaignName,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      // Store the prompt for later bulk generation
      originalPrompt: prompt,
      campaignGoal: campaignRequest.campaignGoal || '',
      // Store character consistency config if provided
      ...(characterConsistency && { characterConsistency }),
      // Flag that content hasn't been generated yet
      contentGenerated: false,
    };

    if (totalOps > BATCH_LIMIT) {
      // For large campaigns, use sequential writes
      console.log(`[Create Campaign] Large campaign (${totalOps} ops), using sequential writes`);

      await campaignDocRef.set(campaignMetadata);

      for (const dayData of campaignDays) {
        const dayDocRef = campaignDocRef.collection('days').doc();
        await dayDocRef.set({
          day: dayData.day,
          date: dayData.date,
          createdAt: now,
          updatedAt: now,
        });

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
            if (block.toneOfVoice) {
              blockData.toneOfVoice = block.toneOfVoice;
            }
            await blockDocRef.set(blockData);
          })
        );
      }
    } else {
      // Use batched writes for better performance
      console.log(`[Create Campaign] Normal campaign (${totalOps} ops), using batched writes`);

      const batch = adminDb.batch();
      batch.set(campaignDocRef, campaignMetadata);

      for (const dayData of campaignDays) {
        const dayDocRef = campaignDocRef.collection('days').doc();

        batch.set(dayDocRef, {
          day: dayData.day,
          date: dayData.date,
          createdAt: now,
          updatedAt: now,
        });

        for (const block of dayData.contentBlocks) {
          const blockDocRef = dayDocRef.collection('contentBlocks').doc();
          const blockData: any = {
            contentType: block.contentType,
            adCopy: (block as any).adCopy,
            imagePrompt: (block as any).imagePrompt,
            keyMessage: block.keyMessage,
            createdAt: now,
            updatedAt: now,
          };
          if ((block as any).toneOfVoice) {
            blockData.toneOfVoice = (block as any).toneOfVoice;
          }
          batch.set(blockDocRef, blockData);
        }
      }

      await batch.commit();
    }

    console.log('[Create Campaign] Campaign saved to Firestore:', {
      campaignId,
      totalDays: campaignDays.length,
      totalBlocks: campaignDays.reduce((sum, day) => sum + day.contentBlocks.length, 0),
    });

    return NextResponse.json({
      success: true,
      campaignId,
      campaignName: uniqueCampaignName,
      campaignDays,
      campaignRequest,
      contentGenerated: false,
    });

  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: `Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
