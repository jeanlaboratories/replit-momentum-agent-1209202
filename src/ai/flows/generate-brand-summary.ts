
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a brand summary
 * based on existing text and a collection of brand assets.
 * Integrates with Brand Soul to ensure generated summaries align with brand voice and identity.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { BrandAsset } from '@/lib/types';
import { getBrandSoulContext, getBrandSoulInstruction } from '@/lib/brand-soul/context';

const GenerateBrandSummaryInputSchema = z.object({
  brandId: z.string().describe('The brand ID to fetch Brand Soul context for.'),
  existingSummary: z.string().optional().describe('The current brand summary, if any.'),
  images: z.array(z.any()).optional().describe('An array of brand image assets.'),
  videos: z.array(z.any()).optional().describe('An array of brand video assets.'),
  documents: z.array(z.any()).optional().describe('An array of brand document assets.'),
});
export type GenerateBrandSummaryInput = z.infer<typeof GenerateBrandSummaryInputSchema>;

const GenerateBrandSummaryOutputSchema = z.object({
  summary: z.string().describe('A new, concise brand summary based on the provided context.'),
});
export type GenerateBrandSummaryOutput = z.infer<typeof GenerateBrandSummaryOutputSchema>;

export async function generateBrandSummary(
  input: GenerateBrandSummaryInput
): Promise<GenerateBrandSummaryOutput> {
    return generateBrandSummaryFlow(input);
}


const prompt = ai.definePrompt({
    name: 'generateBrandSummaryPrompt',
    input: {schema: GenerateBrandSummaryInputSchema.extend({
      brandSoulGuidelines: z.string().optional().describe('Brand Soul guidelines for consistency'),
    })},
    output: {schema: GenerateBrandSummaryOutputSchema},
    prompt: `You are an expert marketing consultant. Your task is to generate a concise and compelling brand summary.

{{#if brandSoulGuidelines}}
CRITICAL INSTRUCTION: The brand has established Brand Soul guidelines below. These guidelines represent the TRUE brand identity synthesized from multiple authentic sources.

{{{brandSoulGuidelines}}}

YOU MUST:
1. Generate a BRAND NEW summary that perfectly aligns with the Brand Soul above
2. Match the brand voice, tone, personality, and messaging framework specified
3. IGNORE any existing summary that contradicts the Brand Soul - it may be outdated or incorrect
4. Use ONLY the brand name, facts, and messaging from the Brand Soul guidelines above

{{else}}

Use the following information as context. If an existing summary is provided, you can refine it or generate a new one based on the available assets.

Existing Summary:
{{#if existingSummary}}
  {{{existingSummary}}}
{{else}}
  No summary provided.
{{/if}}

{{/if}}

Brand Assets:
{{#if images}}
  Images:
  {{#each images}}
    - {{this.name}} (URL: {{this.url}})
  {{/each}}
{{/if}}
{{#if videos}}
  Videos:
  {{#each videos}}
    - {{this.name}} (URL: {{this.url}})
  {{/each}}
{{/if}}
{{#if documents}}
  Documents:
  {{#each documents}}
    - {{this.name}} (URL: {{this.url}})
  {{/each}}
{{/if}}

{{#unless images}}{{#unless videos}}{{#unless documents}}
  No assets provided.
{{/unless}}{{/unless}}{{/unless}}


{{#if brandSoulGuidelines}}
Generate a new brand summary that STRICTLY follows the Brand Soul guidelines above. Do NOT use information from any existing summary that conflicts with the Brand Soul.
{{else}}
Based on all the available context, generate a new brand summary that captures the essence of this brand in a concise and compelling way.
{{/if}}
`,
});


const generateBrandSummaryFlow = ai.defineFlow(
  {
    name: 'generateBrandSummaryFlow',
    inputSchema: GenerateBrandSummaryInputSchema,
    outputSchema: GenerateBrandSummaryOutputSchema,
  },
  async (input) => {
    let brandSoulGuidelines: string | undefined;
    if (input.brandId) {
      const brandSoulContext = await getBrandSoulContext(input.brandId);
      if (brandSoulContext.exists) {
        brandSoulGuidelines = getBrandSoulInstruction(brandSoulContext);
      }
    }
    
    const llmResponse = await prompt({
      ...input,
      brandSoulGuidelines,
    });
    
    return llmResponse.output!;
  }
);
