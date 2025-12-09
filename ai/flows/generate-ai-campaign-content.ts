'use server';
/**
 * @fileOverview Generates AI campaign content based on brand profile and user inputs.
 *
 * - generateAICampaignContent - A function that generates campaign content.
 * - GenerateAICampaignContentInput - The input type for the generateAICampaignContent function.
 * - GenerateAICampaignContentOutput - The return type for the generateAICampaignContent function.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';

const GenerateAICampaignContentInputSchema = z.object({
  brandProfile: z.string().describe('A summary of the brand profile.'),
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
  input: GenerateAICampaignContentInput
): Promise<GenerateAICampaignContentOutput> {
  return generateAICampaignContentFlow(input);
}

const generateAICampaignContentPrompt = ai.definePrompt({
  name: 'generateAICampaignContentPrompt',
  input: {schema: GenerateAICampaignContentInputSchema},
  output: {schema: GenerateAICampaignContentOutputSchema},
  prompt: `You are an AI marketing assistant. You are responsible for generating marketing campaign content, including ad copy and image prompts, based on a brand profile and a campaign timeline.

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

The image prompt should be suitable for use with an AI image generator.

Ensure the generated content aligns with the brand profile, the specified tone of voice, and any provided reference assets.

Output should be valid JSON matching this schema:
${JSON.stringify(GenerateAICampaignContentOutputSchema.shape, null, 2)}`,
});

const generateAICampaignContentFlow = ai.defineFlow(
  {
    name: 'generateAICampaignContentFlow',
    inputSchema: GenerateAICampaignContentInputSchema,
    outputSchema: GenerateAICampaignContentOutputSchema,
  },
  async input => {
    const llmResponse = await generateAICampaignContentPrompt(input);
    return llmResponse.output!;
  }
);

    