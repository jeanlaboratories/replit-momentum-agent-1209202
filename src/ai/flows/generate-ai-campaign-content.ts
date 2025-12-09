'use server';
/**
 * @fileOverview Generates AI campaign content based on brand profile and user inputs.
 *
 * - generateAICampaignContent - A function that generates campaign content.
 * - GenerateAICampaignContentInput - The input type for the generateAICampaignContent function.
 * - GenerateAICampaignContentOutput - The return type for the generateAICampaignContent function.
 *
 * OPTIMIZATION: Large campaigns (7+ days) are processed in batches to avoid LLM output limits.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { getBrandSoulContext, getBrandSoulInstruction } from '@/lib/brand-soul/context';

// Process campaigns in batches of this many days to avoid LLM output token limits
const DAYS_PER_BATCH = 7;

const GenerateAICampaignContentInputSchema = z.object({
  brandId: z.string().describe('The brand ID to fetch Brand Soul guidelines for.'),
  brandProfile: z.string().describe('A summary of the brand profile.'),
  campaignPrompt: z.string().optional().describe('The master campaign prompt that guides all content generation. This is the originalPrompt saved with the campaign.'),
  campaignTimeline: z
    .array(
      z.object({
        day: z.number().describe('The day of the campaign.'),
        contentBlocks: z.array(
          z.object({
            contentType: z
              .string()
              .describe('The type of content (e.g., Social Media Post, Email Newsletter).'),
            keyMessage: z
              .string()
              .describe('The specific instruction or message for that day.'),
            toneOfVoice: z
              .string()
              .describe('The desired tone of voice (e.g., Professional, Playful, Urgent).'),
            assetUrl: z.string().optional().describe('An optional URL for a specific media asset to use as context for this block.'),
            scheduledTime: z.string().optional().describe('The optional scheduled time for the post (e.g., "09:00").'),
          })
        ),
      })
    )
    .describe(
      'The timeline of the campaign, including content blocks for each day.'
    ),
});

export type GenerateAICampaignContentInput = z.infer<
  typeof GenerateAICampaignContentInputSchema
>;

/**
 * Callback function called after each batch is generated.
 * Used for incremental saves to prevent data loss on large campaigns.
 */
export type BatchProgressCallback = (
  batchContent: GenerateAICampaignContentOutput['generatedContent'],
  batchStartIndex: number,
  batchEndIndex: number,
  totalDays: number
) => Promise<void>;

const GenerateAICampaignContentOutputSchema = z.object({
  generatedContent: z
    .array(
      z.object({
        day: z.number().describe('The day of the campaign.'),
        contentBlocks: z.array(
          z.object({
            contentType: z.string().describe('The type of content.'),
            adCopy: z
              .string()
              .describe('The generated ad copy for the content block.'),
            imagePrompt: z
              .string()
              .describe(
                'The generated image prompt for the content block.'
              ),
            scheduledTime: z.string().optional().describe('The scheduled time for the post, if provided.'),
          })
        ),
      })
    )
    .describe(
      'The AI-generated content for each content block in the campaign timeline.'
    ),
});

export type GenerateAICampaignContentOutput = z.infer<
  typeof GenerateAICampaignContentOutputSchema
>;

export async function generateAICampaignContent(
  input: GenerateAICampaignContentInput,
  onBatchComplete?: BatchProgressCallback
): Promise<GenerateAICampaignContentOutput> {
  return generateAICampaignContentFlow(input, onBatchComplete);
}

const generateAICampaignContentPrompt = ai.definePrompt({
  name: 'generateAICampaignContentPrompt',
  input: {schema: GenerateAICampaignContentInputSchema.extend({
    brandSoulGuidelines: z.string().optional().describe('Brand Soul guidelines for consistency'),
  })},
  output: {schema: GenerateAICampaignContentOutputSchema},
  prompt: `You are an AI marketing assistant. You are responsible for generating marketing campaign content, including ad copy and image prompts, based on a brand profile and a campaign timeline.

{{#if campaignPrompt}}
=== MASTER CAMPAIGN PROMPT (IMPORTANT - THIS GUIDES ALL CONTENT) ===
{{{campaignPrompt}}}
=== END MASTER CAMPAIGN PROMPT ===

The above Master Campaign Prompt is the primary guidance for this event. ALL generated content (both ad copy text AND image prompts) MUST be informed by and aligned with this prompt.
{{/if}}

{{#if brandSoulGuidelines}}
{{{brandSoulGuidelines}}}
{{/if}}

Brand Profile Summary:
{{{brandProfile}}}

Campaign Timeline:
{{#each campaignTimeline}}
  Day {{this.day}}:
  {{#each this.contentBlocks}}
    Content Type: {{this.contentType}}
    Key Message: {{this.keyMessage}}
    Tone of Voice: {{this.toneOfVoice}}
    {{#if this.scheduledTime}}
    Scheduled Time: {{this.scheduledTime}}
    {{/if}}
    {{#if this.assetUrl}}
    Reference Asset: Use this image or video at {{this.assetUrl}} as primary inspiration. The generated ad copy and image prompt should be directly related to this asset.
    {{/if}}
  {{/each}}
{{/each}}


Generate ad copy and an image prompt for each content block in the campaign timeline. If a scheduledTime is provided, you can use it as context for the ad copy (e.g. a morning post might say "Good morning!"). Also, pass the scheduledTime through to the output if it was present in the input.

The image prompt should be suitable for use with an AI image generator and MUST follow the visual identity guidelines in the Brand Soul.

CRITICAL: Ensure ALL generated content:
1. Is strongly guided by the Master Campaign Prompt (if provided) - this is the user's primary intent for the campaign
2. Adheres to the Brand Soul guidelines above
3. Aligns with the brand profile and specified tone of voice
4. Incorporates any provided reference assets

Output should be valid JSON matching this schema:
${JSON.stringify(GenerateAICampaignContentOutputSchema.shape, null, 2)}`,
});

/**
 * Internal flow implementation that supports batch progress callbacks for incremental saves.
 * This prevents data loss when processing large campaigns (700+ posts).
 */
async function generateAICampaignContentFlow(
  input: GenerateAICampaignContentInput,
  onBatchComplete?: BatchProgressCallback
): Promise<GenerateAICampaignContentOutput> {
  // Fetch Brand Soul context once for all batches
  const brandSoulContext = await getBrandSoulContext(input.brandId);
  const brandSoulGuidelines = brandSoulContext.exists
    ? getBrandSoulInstruction(brandSoulContext)
    : undefined;

  const totalDays = input.campaignTimeline.length;

  // For small campaigns (<=7 days), process in a single request
  if (totalDays <= DAYS_PER_BATCH) {
    const llmResponse = await generateAICampaignContentPrompt({
      ...input,
      brandSoulGuidelines,
    });

    const result = llmResponse.output!;

    // Still call the callback for small campaigns so saves happen
    if (onBatchComplete && result.generatedContent) {
      await onBatchComplete(result.generatedContent, 0, totalDays, totalDays);
    }

    return result;
  }

  const allGeneratedContent: GenerateAICampaignContentOutput['generatedContent'] = [];

  for (let batchStart = 0; batchStart < totalDays; batchStart += DAYS_PER_BATCH) {
    const batchEnd = Math.min(batchStart + DAYS_PER_BATCH, totalDays);
    const batchTimeline = input.campaignTimeline.slice(batchStart, batchEnd);

    try {
      const batchResponse = await generateAICampaignContentPrompt({
        brandId: input.brandId,
        brandProfile: input.brandProfile,
        campaignPrompt: input.campaignPrompt,
        campaignTimeline: batchTimeline,
        brandSoulGuidelines,
      });

      if (batchResponse.output?.generatedContent) {
        // Adjust day numbers to be absolute (not relative to batch)
        const adjustedContent = batchResponse.output.generatedContent.map((dayContent, idx) => ({
          ...dayContent,
          day: batchStart + idx + 1, // Ensure day numbers are correct
        }));

        allGeneratedContent.push(...adjustedContent);

        if (onBatchComplete) {
          await onBatchComplete(adjustedContent, batchStart, batchEnd, totalDays);
        }
      }
    } catch (error) {
      console.error(`[Campaign Content] Batch ${batchStart + 1}-${batchEnd} failed:`, error);
      const partialError = new Error(
        `Batch ${Math.floor(batchStart / DAYS_PER_BATCH) + 1} failed after processing ${allGeneratedContent.length} days. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
      (partialError as any).partialContent = allGeneratedContent;
      (partialError as any).processedDays = allGeneratedContent.length;
      (partialError as any).totalDays = totalDays;
      throw partialError;
    }
  }

  return { generatedContent: allGeneratedContent };
}
