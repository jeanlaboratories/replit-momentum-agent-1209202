
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a comprehensive
 * set of foundational brand texts based on a brand's assets.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { getBrandSoulContext, getBrandSoulInstruction } from '@/lib/brand-soul/context';

// Input schema for the main generation flow
const GenerateBrandTextInputSchema = z.object({
  brandId: z.string().describe('The brand ID to fetch Brand Soul context for.'),
  existingSummary: z
    .string()
    .optional()
    .describe('The current brand summary, if any.'),
});
export type GenerateBrandTextInput = z.infer<
  typeof GenerateBrandTextInputSchema
>;

const GenerateBrandTextOutputSchema = z.object({
  coreText: z
    .object({
      missionVision: z
        .string()
        .describe("Defines the company's purpose and future aspirations."),
      brandStory: z
        .string()
        .describe(
          "A narrative that explains the brand's origins, beliefs, and values."
        ),
      taglines: z
        .array(z.string())
        .describe("Memorable phrases that communicate the brand's promise."),
    })
    .describe("Core text that establishes the brand's identity."),

  marketingText: z
    .object({
      adCopy: z
        .array(z.string())
        .describe('Short, attention-grabbing text for advertisements.'),
      productDescriptions: z
        .array(z.string())
        .describe(
          'Text that explains the features and benefits of products.'
        ),
      emailCampaigns: z
        .array(z.string())
        .describe(
          'Text for promotional, educational, or transactional emails.'
        ),
      landingPageCopy: z
        .string()
        .describe(
          "Text for a website's landing page to guide visitors to an action."
        ),
    })
    .describe('Persuasive text written to sell a product or service.'),

  contentMarketingText: z
    .object({
      blogPosts: z
        .array(z.string())
        .describe(
          'Article ideas that address customer pain points and offer solutions.'
        ),
      socialMediaCaptions: z
        .array(z.string())
        .describe('Casual, conversational text for social media posts.'),
      whitePapers: z
        .array(z.string())
        .describe(
          'In-depth, technical document ideas to demonstrate expertise.'
        ),
      videoScripts: z
        .array(z.string())
        .describe(
          'Ideas for brand videos, tutorials, or branded entertainment.'
        ),
    })
    .describe('Educational and engaging content to build brand authority.'),

  technicalSupportText: z
    .object({
      userManuals: z
        .string()
        .describe('A sample of instructional text for using a product.'),
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .describe('Common questions and answers to help customers.'),
    })
    .describe('Functional and practical guidance for customers.'),

  publicRelationsText: z
    .object({
      pressReleases: z
        .array(z.string())
        .describe(
          'Formal statements announcing news or events to the media.'
        ),
      companyStatements: z
        .array(z.string())
        .describe(
          "Official text to communicate a brand's position on a public issue."
        ),
      mediaKitText: z
        .string()
        .describe(
          'Information for journalists, including company history and executive bios.'
        ),
    })
    .describe('Text designed for public-facing mediums.'),
});
export type GenerateBrandTextOutput = z.infer<
  typeof GenerateBrandTextOutputSchema
>;

/**
 * Main exported function to generate brand text. This is a simple wrapper
 * that calls the Genkit flow.
 */
export async function generateBrandText(
  input: GenerateBrandTextInput
): Promise<GenerateBrandTextOutput> {
  return generateBrandTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBrandTextPrompt',
  input: {schema: GenerateBrandTextInputSchema.extend({
    brandSoulGuidelines: z.string().optional().describe('Brand Soul guidelines for consistency'),
  })},
  output: {schema: GenerateBrandTextOutputSchema},
  prompt: `You are an expert marketing consultant and copywriter. Your task is to generate a comprehensive set of foundational brand texts for a company.

{{#if brandSoulGuidelines}}
CRITICAL INSTRUCTION: The brand has established Brand Soul guidelines below. These guidelines represent the TRUE brand identity synthesized from multiple authentic sources.

{{{brandSoulGuidelines}}}

YOU MUST:
1. Generate ALL text content that perfectly aligns with the Brand Soul above
2. Match the brand voice, tone, personality, and messaging framework specified
3. Use ONLY the brand name, facts, values, and positioning from the Brand Soul guidelines
4. IGNORE any existing summary that contradicts the Brand Soul - it may be outdated or incorrect
5. Ensure EVERY piece of text (mission, taglines, ad copy, etc.) reflects this brand's authentic identity

{{else}}

Analyze the provided context, which includes an existing summary.

Existing Summary:
{{{existingSummary}}}

{{/if}}

Based on {{#if brandSoulGuidelines}}the Brand Soul guidelines above{{else}}the context{{/if}}, generate content for all the following categories:
- Core Text (Mission/Vision, Brand Story, Taglines/Slogans)
- Marketing and Advertising Text (Ad Copy, Product Descriptions, Email Campaigns, Landing Page Copy)
- Content Marketing Text (Blog Posts, Social Media Captions, White Papers/Case Studies, Video Scripts)
- Technical and Support Text (User Manuals, FAQs)
- Public Relations (PR) Text (Press Releases, Company Statements, Media Kit Text)

Provide a rich and detailed output that is immediately usable by the marketing team.

{{#if brandSoulGuidelines}}
REMINDER: Every piece of text MUST align with the Brand Soul guidelines above. Do NOT invent a different brand identity.
{{/if}}
`,
});

const generateBrandTextFlow = ai.defineFlow(
  {
    name: 'generateBrandTextFlow',
    inputSchema: GenerateBrandTextInputSchema,
    outputSchema: GenerateBrandTextOutputSchema,
  },
  async input => {
    let brandSoulGuidelines: string | undefined;
    if (input.brandId) {
      const brandSoulContext = await getBrandSoulContext(
        input.brandId,
        true,
        1500
      );
      if (brandSoulContext.exists) {
        brandSoulGuidelines = getBrandSoulInstruction(brandSoulContext);
      }
    }
    
    const llmResponse = await prompt({
        ...input,
        existingSummary: input.existingSummary || 'No summary provided.',
        brandSoulGuidelines,
    });

    return llmResponse.output!;
  }
);
