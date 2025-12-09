
'use server';
/**
 * @fileOverview Regenerates ad copy based on previous content and other context.
 *
 * - regenerateAdCopy - A function that regenerates ad copy.
 * - RegenerateAdCopyInput - The input type for the regenerateAdCopy function.
 * - RegenerateAdCopyOutput - The return type for the regenerateAdCopy function.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { getBrandSoulContext, getBrandSoulInstruction } from '@/lib/brand-soul/context';

const RegenerateAdCopyInputSchema = z.object({
  brandId: z.string().optional().describe('The brand ID to fetch Brand Soul guidelines for.'),
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
  previousAdCopy: z.string().describe('The existing ad copy to be improved or replaced.'),
  assetUrl: z.string().optional().describe('An optional URL for a specific media asset to use as context.'),
});

export type RegenerateAdCopyInput = z.infer<
  typeof RegenerateAdCopyInputSchema
>;

const RegenerateAdCopyOutputSchema = z.object({
  adCopy: z
    .string()
    .describe('The newly generated ad copy for the content block.'),
});

export type RegenerateAdCopyOutput = z.infer<
  typeof RegenerateAdCopyOutputSchema
>;

export async function regenerateAdCopy(
  input: RegenerateAdCopyInput
): Promise<RegenerateAdCopyOutput> {
  return regenerateAdCopyFlow(input);
}

const regenerateAdCopyPrompt = ai.definePrompt({
  name: 'regenerateAdCopyPrompt',
  input: {schema: RegenerateAdCopyInputSchema.extend({
    brandSoulGuidelines: z.string().optional().describe('Brand Soul guidelines for consistency'),
  })},
  output: {schema: RegenerateAdCopyOutputSchema},
  prompt: `You are an AI marketing assistant. Your task is to regenerate and improve a piece of ad copy based on the provided context and the previous version.

{{#if brandSoulGuidelines}}
{{{brandSoulGuidelines}}}
{{/if}}

**Context:**
- Brand Profile: {{{brandProfile}}}
- Content Type: {{{contentType}}}
- Original Message/Goal: {{{keyMessage}}}
- Tone of Voice: {{{toneOfVoice}}}
{{#if assetUrl}}
- Reference Asset: The content should be directly related to this asset: {{{assetUrl}}}
{{/if}}

**Previous Ad Copy (to be improved):**
"{{{previousAdCopy}}}"

Please generate a new, fresh version of the ad copy. You can either make small tweaks to improve the existing text or write a completely new version, but it MUST strictly adhere to the Brand Soul guidelines above, the provided context and tone.

Your response must be valid JSON.
`,
});

const regenerateAdCopyFlow = ai.defineFlow(
  {
    name: 'regenerateAdCopyFlow',
    inputSchema: RegenerateAdCopyInputSchema,
    outputSchema: RegenerateAdCopyOutputSchema,
  },
  async input => {
    // Fetch Brand Soul context if brandId provided
    let brandSoulGuidelines: string | undefined;
    if (input.brandId) {
      const brandSoulContext = await getBrandSoulContext(input.brandId);
      brandSoulGuidelines = brandSoulContext.exists 
        ? getBrandSoulInstruction(brandSoulContext)
        : undefined;
    }
    
    const llmResponse = await regenerateAdCopyPrompt({
      ...input,
      brandSoulGuidelines,
    });
    return llmResponse.output!;
  }
);
