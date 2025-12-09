/**
 * Generate Personal Profile Text
 * 
 * AI flow specifically for individual team member profiles
 * Uses blended context: Individual Identity (70%) + Team Intelligence (30%)
 */

import { ai } from '@/ai/index';
import { z } from 'zod';
import { getIndividualContext, getIndividualContextInstruction } from '@/lib/individual-identity/context';

// Input schema
const GeneratePersonalProfileTextInputSchema = z.object({
  brandId: z.string().describe('The brand/team ID'),
  userId: z.string().describe('The individual user ID'),
  userDisplayName: z.string().describe('The user\'s display name'),
  existingSummary: z.string().optional().describe('Any existing personal summary'),
});

export type GeneratePersonalProfileTextInput = z.infer<
  typeof GeneratePersonalProfileTextInputSchema
>;

// Output schema - same structure as brand text but personalized
const GeneratePersonalProfileTextOutputSchema = z.object({
  coreText: z.object({
    professionalBio: z.string().describe('A compelling professional biography about this person'),
    personalMission: z.string().describe('Their individual purpose and goals'),
    personalTaglines: z.array(z.string()).describe('Personal catchphrases or mottos that represent them'),
  }).describe('Core personal identity text'),

  professionalHighlights: z.object({
    expertiseAreas: z.array(z.string()).describe('Their key areas of expertise and specialization'),
    keyAchievements: z.array(z.string()).describe('Notable accomplishments and successes'),
    workingStyle: z.string().describe('How they approach work and collaboration'),
    valueProposition: z.string().describe('What unique value they bring to teams and projects'),
  }).describe('Professional strengths and contributions'),

  personalContent: z.object({
    aboutMe: z.string().describe('A personal "about me" section showing personality'),
    interests: z.array(z.string()).describe('Professional interests and passions'),
    collaborationStyle: z.string().describe('How they like to work with others'),
    impactStories: z.array(z.string()).describe('Brief stories of impact or meaningful projects'),
  }).describe('Personal touch and human elements'),

  socialContent: z.object({
    linkedInSummary: z.string().describe('A LinkedIn-style professional summary'),
    portfolioIntro: z.string().describe('Introduction for a personal portfolio or website'),
    emailSignature: z.string().describe('Professional but personal email signature text'),
    socialMediaBio: z.string().describe('Short bio for social media profiles (280 chars max)'),
  }).describe('Content formatted for various platforms'),
});

export type GeneratePersonalProfileTextOutput = z.infer<
  typeof GeneratePersonalProfileTextOutputSchema
>;

export async function generatePersonalProfileText(
  input: GeneratePersonalProfileTextInput
): Promise<GeneratePersonalProfileTextOutput> {
  return generatePersonalProfileTextFlow(input);
}

// Extended input schema with individual context
const ExtendedInputSchema = GeneratePersonalProfileTextInputSchema.extend({
  individualContextGuidelines: z.string().optional(),
});

const generatePersonalProfileTextPrompt = ai.definePrompt({
  name: 'generatePersonalProfileTextPrompt',
  input: { schema: ExtendedInputSchema },
  output: { schema: GeneratePersonalProfileTextOutputSchema },
  prompt: `You are an expert personal branding consultant and career coach. Your task is to create compelling personal profile text for an individual team member.

**Person:** {{userDisplayName}}
{{#if existingSummary}}
**Current Summary:** {{existingSummary}}
{{/if}}

{{#if individualContextGuidelines}}
{{{individualContextGuidelines}}}
{{else}}
Generate content that showcases this individual's unique strengths, expertise, and personality.
Focus on THEM as a person, not the team or organization.
{{/if}}

**Instructions:**

1. **Professional Bio**: Write a compelling 3-4 paragraph biography that tells their professional story. Make it personal, not corporate.

2. **Personal Mission**: Articulate THEIR individual purpose and what drives them. This should feel authentic and inspiring.

3. **Personal Taglines**: Create 3-5 memorable phrases that capture their essence and professional identity.

4. **Expertise Areas**: List 4-6 specific areas where they excel. Be concrete, not generic.

5. **Key Achievements**: Highlight 4-6 specific accomplishments that demonstrate their impact.

6. **Working Style**: Describe how they approach work, solve problems, and collaborate. Make it feel real.

7. **Value Proposition**: Explain what makes them uniquely valuable as a team member or collaborator.

8. **About Me**: Write a warm, personable "about me" that shows their personality beyond just work.

9. **Interests**: List 4-6 professional interests or areas they're passionate about.

10. **Collaboration Style**: Describe how they like to work with others and what makes them a great teammate.

11. **Impact Stories**: Share 2-3 brief stories (2-3 sentences each) of projects or moments where they made a difference.

12. **Platform-Specific Content**: Create tailored versions for LinkedIn, portfolio intro, email signature, and social media.

**Key Principles:**
- Focus on THIS PERSON specifically - use "they/them" pronouns
- Be authentic and human, not corporate or generic
- Showcase their unique strengths and personality
- Include specific details, not vague statements
- Make it feel like a personal brand, not a company profile
- Keep team voice/tone consistent but make the content personal

Your output must be valid JSON matching the schema exactly.`,
});

const generatePersonalProfileTextFlow = ai.defineFlow(
  {
    name: 'generatePersonalProfileTextFlow',
    inputSchema: GeneratePersonalProfileTextInputSchema,
    outputSchema: GeneratePersonalProfileTextOutputSchema,
  },
  async (input) => {
    let individualContextGuidelines: string | undefined;
    
    const individualContext = await getIndividualContext(
      input.brandId,
      input.userId,
      input.userDisplayName
    );
    
    if (individualContext.exists || individualContext.fullContext) {
      individualContextGuidelines = getIndividualContextInstruction(individualContext);
    }
    
    const llmResponse = await generatePersonalProfileTextPrompt({
      ...input,
      existingSummary: input.existingSummary || 'No existing summary.',
      individualContextGuidelines,
    });

    return llmResponse.output!;
  }
);
