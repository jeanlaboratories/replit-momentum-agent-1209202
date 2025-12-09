
'use server';
/**
 * @fileOverview Regenerates an image prompt based on previous content and other context.
 *
 * - regenerateImagePrompt - A function that regenerates an image prompt.
 * - RegenerateImagePromptInput - The input type for the regenerateImagePrompt function.
 * - RegenerateImagePromptOutput - The return type for the regenerateImagePrompt function.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { getBrandSoulContext } from '@/lib/brand-soul/context';

const RegenerateImagePromptInputSchema = z.object({
  brandId: z.string().optional().describe('The brand ID to fetch Brand Soul visual guidelines for.'),
  brandProfile: z.string().describe('A summary of the brand profile.'),
  contentType: z
    .string()
    .describe('The type of content (e.g., Social Media Post, Email Newsletter).'),
  keyMessage: z
    .string()
    .describe('The original instruction or message for the content block.'),
  toneOfVoice: z
    .string()
    .describe('The desired tone of voice (e.g., Professional, Playful, Urgent).'),
  previousImagePrompt: z.string().describe('The existing image prompt to be improved or replaced.'),
  assetUrl: z.string().optional().describe('An optional URL for a specific media asset to use as context.'),
});

export type RegenerateImagePromptInput = z.infer<
  typeof RegenerateImagePromptInputSchema
>;

const RegenerateImagePromptOutputSchema = z.object({
  imagePrompt: z
    .string()
    .describe('The newly generated image prompt for the content block.'),
});

export type RegenerateImagePromptOutput = z.infer<
  typeof RegenerateImagePromptOutputSchema
>;

export async function regenerateImagePrompt(
  input: RegenerateImagePromptInput
): Promise<RegenerateImagePromptOutput> {
  return regenerateImagePromptFlow(input);
}

const regenerateImagePromptFlowPrompt = ai.definePrompt({
  name: 'regenerateImagePromptFlowPrompt',
  input: {schema: RegenerateImagePromptInputSchema.extend({
    brandVisualGuidelines: z.string().optional().describe('Brand Soul visual guidelines'),
  })},
  output: {schema: RegenerateImagePromptOutputSchema},
  prompt: `You are an AI marketing assistant specializing in creating compelling visual concepts. Your task is to regenerate and improve an image prompt for an AI image generator based on the provided context and the previous version.

{{#if brandVisualGuidelines}}
BRAND VISUAL GUIDELINES - MUST FOLLOW STRICTLY:
{{{brandVisualGuidelines}}}
{{/if}}

**Context:**
- Brand Profile: {{{brandProfile}}}
- Content Type: {{{contentType}}}
- Original Message/Goal: {{{keyMessage}}}
- Tone of Voice: {{{toneOfVoice}}}
{{#if assetUrl}}
- Reference Asset: The image prompt should be directly related to this asset: {{{assetUrl}}}
{{/if}}

**Previous Image Prompt (to be improved):**
"{{{previousImagePrompt}}}"

Please generate a new, fresh version of the image prompt. The new prompt should be more descriptive, creative, and optimized for a text-to-image AI like Imagen. You can either make small tweaks to improve the existing text or write a completely new version, but it MUST strictly adhere to the Brand Visual Guidelines above and the provided context and tone.

Your response must be valid JSON.
`,
});

const regenerateImagePromptFlow = ai.defineFlow(
  {
    name: 'regenerateImagePromptFlow',
    inputSchema: RegenerateImagePromptInputSchema,
    outputSchema: RegenerateImagePromptOutputSchema,
  },
  async input => {
    // Fetch Brand Soul visual guidelines if brandId provided
    let brandVisualGuidelines: string | undefined;
    if (input.brandId) {
      const brandSoulContext = await getBrandSoulContext(input.brandId);
      brandVisualGuidelines = brandSoulContext.exists && brandSoulContext.visualGuidelines
        ? brandSoulContext.visualGuidelines
        : undefined;
    }
    
    const llmResponse = await regenerateImagePromptFlowPrompt({
      ...input,
      brandVisualGuidelines,
    });
    return llmResponse.output!;
  }
);
