
'use server';

/**
 * @fileOverview This file defines a Genkit flow for regenerating a specific
 * section of a brand's foundational text.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { BrandProfile } from '@/lib/types';


const RegenerateBrandTextSectionInputSchema = z.object({
  brandProfile: z.any().optional().describe('The full existing brand profile, including summary, assets, and all other text sections.'),
  sectionKey: z.string().describe('The dot-notation key of the section to regenerate (e.g., "coreText.missionVision").'),
  sectionTitle: z.string().describe('The user-friendly title of the section (e.g., "Mission & Vision").'),
});

const RegenerateBrandTextSectionOutputSchema = z.object({
  newContent: z.union([z.string(), z.array(z.string())]).describe('The newly generated content for the specified section.'),
});

export type RegenerateBrandTextSectionInput = z.infer<typeof RegenerateBrandTextSectionInputSchema>;
export type RegenerateBrandTextSectionOutput = z.infer<typeof RegenerateBrandTextSectionOutputSchema>;

export async function regenerateBrandTextSection(
  input: RegenerateBrandTextSectionInput
): Promise<RegenerateBrandTextSectionOutput> {
    return regenerateBrandTextSectionFlow(input);
}


const prompt = ai.definePrompt({
    name: 'regenerateBrandTextSectionPrompt',
    input: {schema: z.any()}, // Allow additional properties
    output: {schema: RegenerateBrandTextSectionOutputSchema},
    prompt: `You are an expert marketing consultant and copywriter. Your task is to regenerate a specific section of a brand's foundational text based on the entire existing brand profile.

The goal is to provide a fresh alternative for the requested section while maintaining consistency with the overall brand voice and information found in the other assets and text sections.

**Full Brand Profile (Context):**
- Summary: {{{brandProfile.summary}}}
- Core Text: {{{coreTextString}}}
- Marketing Text: {{{marketingTextString}}}
- Content Marketing Text: {{{contentMarketingTextString}}}
- PR Text: {{{publicRelationsTextString}}}
- Assets: The brand has {{imagesCount}} images, {{videosCount}} videos, and {{documentsCount}} documents available as reference materials.

**Task:**
Regenerate the content ONLY for the following section: **"{{sectionTitle}}"** (identified by key: \`{{sectionKey}}\`).

- If the original content is a single string, return a new string.
- If the original content is a list of strings (like taglines or ad copy), return a new list of strings.

Your output must be a valid JSON object containing only the 'newContent' field.
`,
});


const regenerateBrandTextSectionFlow = ai.defineFlow(
  {
    name: 'regenerateBrandTextSectionFlow',
    inputSchema: RegenerateBrandTextSectionInputSchema,
    outputSchema: RegenerateBrandTextSectionOutputSchema,
  },
  async (input) => {
    // Pre-stringify the brand text sections before passing to the prompt
    // Ensure arrays are defined and convert objects to arrays if needed
    const ensureArray = (data: any) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      // Convert object with numeric keys to array
      if (typeof data === 'object') {
        return Object.values(data);
      }
      return [];
    };

    const safeInput = {
      ...input,
      brandProfile: {
        ...input.brandProfile,
        images: ensureArray(input.brandProfile?.images),
        videos: ensureArray(input.brandProfile?.videos),
        documents: ensureArray(input.brandProfile?.documents),
      }
    };
    
    const promptInput = {
      ...safeInput,
      coreTextString: JSON.stringify(input.brandProfile?.brandText?.coreText || {}),
      marketingTextString: JSON.stringify(input.brandProfile?.brandText?.marketingText || {}),
      contentMarketingTextString: JSON.stringify(input.brandProfile?.brandText?.contentMarketingText || {}),
      publicRelationsTextString: JSON.stringify(input.brandProfile?.brandText?.publicRelationsText || {}),
      imagesCount: safeInput.brandProfile.images.length,
      videosCount: safeInput.brandProfile.videos.length,
      documentsCount: safeInput.brandProfile.documents.length,
    };

    const llmResponse = await prompt(promptInput);
    return llmResponse.output!;
  }
);
