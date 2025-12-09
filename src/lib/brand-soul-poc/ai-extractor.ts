// Brand Soul POC - AI Extraction using Gemini via Genkit

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ExtractedInsightsPOC } from '@/lib/types/brand-soul-poc';
import { DEFAULT_SETTINGS } from '@/lib/ai-model-defaults';

// Schema for AI extraction output
const ExtractionOutputSchema = z.object({
  voiceElements: z.object({
    tone: z.string().describe('Primary tone (e.g., professional, casual, friendly)'),
    style: z.string().describe('Writing style description'),
    formality: z.number().min(1).max(10).describe('Formality level 1-10'),
    examples: z.array(z.string()).describe('Example sentences in brand voice'),
  }),
  keyFacts: z.array(z.object({
    category: z.string().describe('Fact category (e.g., product, company, value)'),
    fact: z.string().describe('The actual fact'),
    confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
  })),
  coreValues: z.array(z.string()).describe('Core brand values'),
  confidence: z.number().min(0).max(100).describe('Overall extraction confidence'),
});

/**
 * AI Extraction Service using Gemini
 */
export class AIExtractor {
  /**
   * Extract brand insights from text content
   */
  async extractInsights(
    content: string,
    sourceType: 'manual-text'
  ): Promise<ExtractedInsightsPOC> {
    console.log('[AIExtractor] Starting extraction for content length:', content.length);
    
    // Define the extraction prompt
    const extractionPrompt = ai.definePrompt({
      name: 'extractBrandInsightsPOC',
      input: { schema: z.object({ content: z.string() }) },
      output: { schema: ExtractionOutputSchema },
      prompt: `You are an expert brand strategist analyzing brand content.

Analyze the following brand content and extract:
1. Voice Elements: tone, style, formality (1-10 scale), and example sentences
2. Key Facts: important facts about the brand with categories and confidence scores
3. Core Values: fundamental values the brand represents

Content:
{{{content}}}

Provide a structured analysis as JSON matching the schema.
Be thorough but accurate. If confidence is low, reflect that in the scores.`,
    });
    
    try {
      // Call Gemini for extraction
      const result = await extractionPrompt({
        content: content.substring(0, 10000), // Limit to 10k chars for POC
      });
      
      console.log('[AIExtractor] Extraction successful');
      
      return {
        ...result.output!,
        extractedAt: new Date().toISOString(),
        model: DEFAULT_SETTINGS.textModel,
      };
    } catch (error) {
      console.error('[AIExtractor] Extraction failed:', error);
      throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const aiExtractor = new AIExtractor();
