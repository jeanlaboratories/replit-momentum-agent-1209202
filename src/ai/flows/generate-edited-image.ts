
'use server';

/**
 * @fileOverview Unified AI image editing flow (Nano Banana).
 *
 * This module provides image editing capabilities using the Python service backend,
 * which uses Gemini 3 Pro Image Preview for robust image editing.
 *
 * Features:
 * - Multi-image composition/fusion
 * - Mask-based selective editing
 * - Brand Soul visual guidelines integration
 * - Firebase Storage URL handling (via Python admin SDK)
 *
 * - generateEditedImage - Main function for AI image editing
 * - GenerateEditedImageInput - Input type
 * - GenerateEditedImageOutput - Output type
 */

import {z} from 'zod';
import { getBrandSoulContext } from '@/lib/brand-soul/context';

const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

const GenerateEditedImageInputSchema = z.object({
  prompt: z.string().describe('The prompt to use to edit the image.'),
  imageUrl: z
    .string()
    .optional()
    .describe(
      "The source image to edit, as a data URI or a public URL. Firebase Storage URLs are supported."
    ),
  additionalImageUrls: z.array(z.string()).optional().describe('Additional source images to blend or fuse with the main image.'),
  maskUrl: z.string().optional().describe('Optional mask image for selective editing.'),
  brandId: z.string().optional().describe('The brand ID to fetch Brand Soul visual guidelines for.'),
  model: z.string().optional().describe('The model ID to use (currently uses gemini-3-pro-image-preview).'),
  // Full nano_banana parameter support
  mode: z.enum(['edit', 'compose']).optional().describe('Edit mode: "edit" for single image editing, "compose" for multi-image composition.'),
  aspectRatio: z.string().optional().describe('Output aspect ratio (e.g., "1:1", "16:9", "9:16").'),
  numberOfImages: z.number().optional().describe('Number of images to generate (1-4).'),
  personGeneration: z.string().optional().describe('Person generation control ("allow_all", "allow_adult").'),
});
export type GenerateEditedImageInput = z.infer<
  typeof GenerateEditedImageInputSchema
>;

const GenerateEditedImageOutputSchema = z.object({
  imageUrl: z.string().describe('The URL or data URI of the generated image.'),
  imageUrls: z.array(z.string()).optional().describe('Array of all generated image URLs (for multi-image generation).'),
  format: z.enum(['url', 'base64']).optional().describe('Response format.'),
  prompt: z.string().optional().describe('The prompt used for generation.'),
  skippedReferences: z.array(z.string()).optional().describe('Reference images that could not be loaded.'),
});
export type GenerateEditedImageOutput = z.infer<
  typeof GenerateEditedImageOutputSchema
>;

/**
 * Generate an edited image using the unified Python service backend.
 * This ensures consistent behavior across Image Gallery, Agent, AI Models, and Team Tools.
 */
export async function generateEditedImage(
  input: GenerateEditedImageInput
): Promise<GenerateEditedImageOutput> {
  // Enhance prompt with brand guidelines if available
  let enhancedPrompt = input.prompt;

  // Add Character Consistency instruction
  enhancedPrompt += "\n\nIMPORTANT: Maintain high character consistency and visual style from the input image(s). If multiple images are provided, blend their elements naturally as requested.";

  if (input.brandId) {
    try {
      const brandSoulContext = await getBrandSoulContext(input.brandId);
      if (brandSoulContext.exists && brandSoulContext.visualGuidelines) {
        enhancedPrompt += `\n\nBRAND VISUAL GUIDELINES - MUST FOLLOW STRICTLY:\n${brandSoulContext.visualGuidelines}\n\nEnsure the edited image adheres to the brand's visual identity including colors, style, and themes specified above.`;
      }
    } catch (e) {
      console.warn('[generateEditedImage] Failed to fetch brand soul context:', e);
    }
  }

  // Call the unified Python service endpoint with ALL nano_banana parameters
  const response = await fetch(`${PYTHON_SERVICE_URL}/agent/nano-banana`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: enhancedPrompt,
      image_url: input.imageUrl || '',
      reference_images: input.additionalImageUrls?.join(',') || '',
      mask_url: input.maskUrl || '',
      brand_id: input.brandId || '',
      // Full parameter support
      mode: input.mode || '',
      aspect_ratio: input.aspectRatio || '1:1',
      number_of_images: input.numberOfImages || 1,
      person_generation: input.personGeneration || '',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generateEditedImage] Python service error:', response.status, errorText);

    // Try to extract detailed error message
    let errorMessage = `Image editing failed (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorJson.error || errorMessage;
    } catch {
      // Use default error message
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(data.error || 'Image editing failed');
  }

  // Handle unified camelCase response format from /agent/nano-banana
  // The endpoint now returns camelCase (imageUrl, imageUrls) instead of snake_case
  let resultUrl = data.imageUrl || data.image_url;
  const resultUrls = data.imageUrls || data.image_urls || [];

  // Fallback to base64 data URI if no URL
  if (!resultUrl && (data.imageData || data.image_data)) {
    resultUrl = `data:image/png;base64,${data.imageData || data.image_data}`;
  }

  if (!resultUrl && resultUrls.length > 0) {
    resultUrl = resultUrls[0];
  }

  if (!resultUrl) {
    throw new Error('No image was generated.');
  }

  return {
    imageUrl: resultUrl,
    imageUrls: resultUrls.length > 0 ? resultUrls : [resultUrl],
    format: data.format || 'url',
    prompt: data.prompt || input.prompt,
    skippedReferences: data.skippedReferences || data.skipped_references,
  };
}
