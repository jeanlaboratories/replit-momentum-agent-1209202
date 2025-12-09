'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a brand profile from a website URL.
 *
 * It includes:
 * - `generateBrandProfile`: An asynchronous function that takes a website URL as input and returns a brand profile.
 * - `GenerateBrandProfileInput`: The input type for the `generateBrandProfile` function (a website URL).
 * - `GenerateBrandProfileOutput`: The output type for the `generateBrandprofile` function (a brand profile string and an array of image and video URLs).
 */

import {ai} from '@/ai/index';
import {z} from 'zod';

const GenerateBrandProfileInputSchema = z.object({
  websiteUrl: z
    .string()
    .describe('The URL of the company website to analyze.'),
});
export type GenerateBrandProfileInput = z.infer<
  typeof GenerateBrandProfileInputSchema
>;

const GenerateBrandProfileOutputSchema = z.object({
  brandProfile: z
    .string()
    .describe(
      'A detailed summary of the brand, its voice, and offerings based on deep research of the website.'
    ),
  imageUrls: z
    .array(z.string())
    .describe(
      'An array of public image URLs (including logos, product shots, etc.) that are good candidates for building a brand, found on the website.'
    ),
  videoUrls: z
    .array(z.string())
    .describe(
      'An array of public video URLs that are good candidates for building a brand, found on the website.'
    ),
});
export type GenerateBrandProfileOutput = z.infer<
  typeof GenerateBrandProfileOutputSchema
>;

export async function generateBrandProfile(
  input: GenerateBrandProfileInput
): Promise<GenerateBrandProfileOutput> {
  return generateBrandProfileFlow(input);
}

const generateBrandProfilePrompt = ai.definePrompt({
  name: 'generateBrandProfilePrompt',
  input: {schema: GenerateBrandProfileInputSchema},
  output: {schema: GenerateBrandProfileOutputSchema},
  prompt: `You are an expert marketing consultant. Your task is to perform deep research on a company's website and create a comprehensive brand profile. This profile must include a concise summary of the brand, its voice, and its offerings.

Additionally, find and list all public URLs for multimedia assets on the site that would be good candidates for building a brand. This includes all relevant images (like logos, product shots, lifestyle photos) and any videos.

Analyze the following website:

{{{websiteUrl}}}

Provide the brand profile, an array of image URLs, and an array of video URLs. Ensure the output is a valid JSON object matching the requested schema.`,
});

const generateBrandProfileFlow = ai.defineFlow(
  {
    name: 'generateBrandProfileFlow',
    inputSchema: GenerateBrandProfileInputSchema,
    outputSchema: GenerateBrandProfileOutputSchema,
  },
  async input => {
    const llmResponse = await generateBrandProfilePrompt(input);
    return llmResponse.output!;
  }
);
