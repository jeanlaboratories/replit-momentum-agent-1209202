'use server';

/**
 * @fileOverview AI image generation flow with enhanced prompt composition.
 *
 * Phase 1 Enhancements (Matchpoint Integration):
 * - Scene type classification
 * - Photographic controls
 * - Brand Soul negative prompts
 * - Structured output schemas
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import { getBrandSoulContext } from '@/lib/brand-soul/context';
import { classifySceneType, recommendPhotographicControls } from '@/lib/scene-classifier';
import { explainBrandSoulInfluence, logBrandSoulInfluence } from '@/lib/brand-soul/explainability';
import type { EnhancedImagePrompt } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/ai-model-defaults';

const GenerateAiImageInputSchema = z.object({
  prompt: z.string().describe('The prompt to use to generate the image.'),
  brandId: z.string().optional().describe('The brand ID to fetch Brand Soul visual guidelines for.'),
  campaignPrompt: z.string().optional().describe('The master campaign prompt that provides overall context for this image generation.'),
  contentContext: z.object({
    adCopy: z.string().optional(),
    keyMessage: z.string().optional(),
  }).optional().describe('Additional content context for better scene classification.'),
  model: z.string().optional().describe('The model ID to use for generation (e.g., imagen-4.0-generate-001). If not provided, uses default.'),
  // New Imagen 4.0 parameters
  aspectRatio: z.string().optional().describe('Aspect ratio for the image (1:1, 16:9, 9:16, etc.)'),
  numberOfImages: z.number().optional().describe('Number of images to generate (1-8)'),
  personGeneration: z.string().optional().describe('Person generation control (allow_all, allow_adult)'),
});

// Character-consistent image generation schema (uses Nano Banana)
const GenerateCharacterConsistentImageInputSchema = z.object({
  prompt: z.string().describe('The prompt to use to generate the image.'),
  brandId: z.string().optional().describe('The brand ID to fetch Brand Soul visual guidelines for.'),
  campaignPrompt: z.string().optional().describe('The master campaign prompt that provides overall context for this image generation.'),
  characterReferenceUrls: z.array(z.string()).describe('URLs to character reference images (character sheets)'),
  previousSceneUrl: z.string().optional().describe('URL to the previous scene image for scene-to-scene consistency'),
  aspectRatio: z.string().optional().describe('Aspect ratio for the image'),
  // Full nano_banana parameter support
  mode: z.enum(['edit', 'compose']).optional().describe('Mode: "edit" for single image, "compose" for multi-image.'),
  numberOfImages: z.number().optional().describe('Number of images to generate (1-4).'),
  personGeneration: z.string().optional().describe('Person generation control ("allow_all", "allow_adult").'),
});
export type GenerateCharacterConsistentImageInput = z.infer<typeof GenerateCharacterConsistentImageInputSchema>;
export type GenerateAiImageInput = z.infer<typeof GenerateAiImageInputSchema>;

const GenerateAiImageOutputSchema = z.object({
  imageUrl: z.string().describe('The URL of the first generated image.'),
  imageUrls: z.array(z.string()).optional().describe('Array of all generated image URLs (for multi-image generation).'),
  enhancedPrompt: z.object({
    basePrompt: z.string(),
    sceneType: z.string(),
    sceneSubtype: z.string(),
    brandColors: z.array(z.string()).optional(),
    brandStyleTags: z.array(z.string()).optional(),
  }).optional().describe('Enhanced image prompt metadata for quality tracking.'),
  explainability: z.object({
    summary: z.string(),
    confidence: z.number(),
    appliedControls: z.array(z.string()),
    brandElements: z.array(z.string()),
    avoidedElements: z.array(z.string()),
  }).optional().describe('Explainability showing how Brand Soul influenced this image.'),
});
export type GenerateAiImageOutput = z.infer<typeof GenerateAiImageOutputSchema>;

export async function generateAiImage(input: GenerateAiImageInput): Promise<GenerateAiImageOutput> {
  return generateAiImageFlow(input);
}

const generateAiImageFlow = ai.defineFlow(
  {
    name: 'generateAiImageFlow',
    inputSchema: GenerateAiImageInputSchema,
    outputSchema: GenerateAiImageOutputSchema,
  },
  async input => {
    // Phase 1: Scene Classification
    const sceneClassification = classifySceneType(
      input.prompt,
      input.contentContext
    );
    
    // Get photographic control recommendations based on scene
    const photoControls = recommendPhotographicControls(sceneClassification);
    
    // Fetch Brand Soul context if brandId provided
    let brandSoulContext;
    if (input.brandId) {
      brandSoulContext = await getBrandSoulContext(input.brandId);
    }
    
    // Build enhanced prompt with photographic controls
    let enhancedPrompt = input.prompt;

    // Add campaign prompt context if provided (from master generation prompt)
    if (input.campaignPrompt) {
      enhancedPrompt = `CAMPAIGN CONTEXT: ${input.campaignPrompt}

IMAGE PROMPT: ${input.prompt}`;
    }

    // Add photographic controls to prompt
    const photoControlsText: string[] = [];
    if (photoControls.lighting && photoControls.lighting.length > 0) {
      photoControlsText.push(`Lighting: ${photoControls.lighting[0]}`);
    }
    if (photoControls.composition && photoControls.composition.length > 0) {
      photoControlsText.push(`Composition: ${photoControls.composition[0]}`);
    }
    if (photoControls.lens && photoControls.lens.length > 0) {
      photoControlsText.push(`Lens: ${photoControls.lens[0]}`);
    }
    if (photoControls.framing && photoControls.framing.length > 0) {
      photoControlsText.push(`Framing: ${photoControls.framing[0]}`);
    }
    
    if (photoControlsText.length > 0) {
      enhancedPrompt = `${input.prompt}

PHOTOGRAPHIC SPECIFICATIONS:
${photoControlsText.join(', ')}`;
    }
    
    // Add Brand Soul guidelines
    if (brandSoulContext?.exists) {
      if (brandSoulContext.visualGuidelines) {
        enhancedPrompt = `${enhancedPrompt}

BRAND VISUAL GUIDELINES:
${brandSoulContext.visualGuidelines}`;
      }
      
      if (brandSoulContext.brandColors && brandSoulContext.brandColors.length > 0) {
        enhancedPrompt = `${enhancedPrompt}

Brand Colors: ${brandSoulContext.brandColors.slice(0, 3).join(', ')}`;
      }
    }
    
    // Generate images - use Python service for multi-image, Genkit for single image
    // This is because Genkit's ai.generate() only returns a single image even with numberOfImages > 1
    const modelId = input.model || DEFAULT_SETTINGS.imageModel;
    let imageUrl: string;
    let imageUrls: string[] | undefined;

    const requestedImages = input.numberOfImages || 1;
    const MAX_IMAGES_PER_REQUEST = 8; // Imagen API limit

    if (requestedImages > 1) {
      const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

      if (requestedImages > MAX_IMAGES_PER_REQUEST) {
        
        const allImageUrls: string[] = [];
        const batches = Math.ceil(requestedImages / MAX_IMAGES_PER_REQUEST);
        
        for (let batch = 0; batch < batches; batch++) {
          const imagesInBatch = Math.min(MAX_IMAGES_PER_REQUEST, requestedImages - allImageUrls.length);
          const batchNum = batch + 1;
          
          // Retry logic for network errors
          const MAX_RETRIES = 3;
          let lastError: any = null;
          let response: Response | null = null;
          let timeoutId: NodeJS.Timeout | null = null;
          
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            // Use AbortController for timeout handling
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout per batch
            
            try {
              response = await fetch(`${pythonServiceUrl}/media/generate-image`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify({
                  prompt: enhancedPrompt.trim(),
                  brand_id: input.brandId || '',
                  aspect_ratio: input.aspectRatio || '1:1',
                  number_of_images: imagesInBatch,
                  person_generation: input.personGeneration || '',
                }),
              });
              
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              
              break; // Success, exit retry loop
            } catch (fetchError: any) {
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              
              lastError = fetchError;
              
              // If it's a network error and we have retries left, wait and retry
              if (attempt < MAX_RETRIES && (
                fetchError.message?.includes('network') || 
                fetchError.message?.includes('fetch') || 
                fetchError.message?.includes('Failed to fetch') ||
                fetchError instanceof TypeError ||
                fetchError.name === 'TypeError'
              )) {
                const retryDelay = attempt * 2000;
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
              }
              
              // Re-throw if not retryable or out of retries
              throw fetchError;
            }
          }
          
          if (!response) {
            throw lastError || new Error(`Failed to get response after ${MAX_RETRIES} attempts`);
          }
          
          try {

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Image generation API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
              throw new Error(result.error || result.message || 'Unknown error from image generation');
            }

            // Handle both camelCase and snake_case responses
            const batchUrls = result.imageUrls || result.image_urls || [];
            if (result.imageUrl || result.image_url) {
              batchUrls.push(result.imageUrl || result.image_url);
            }

            if (batchUrls.length === 0) {
              throw new Error(`No images returned from batch ${batchNum}`);
            }

            allImageUrls.push(...batchUrls);
            
            // Small delay between batches to avoid rate limiting
            if (batch < batches - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
          } catch (parseError: any) {
            // Error parsing response or processing result
            // Handle different error types
            if (parseError.name === 'AbortError') {
              throw new Error(`Image generation timed out after 5 minutes for batch ${batchNum}/${batches}`);
            }
            
            if (parseError.message?.includes('network') || 
                parseError.message?.includes('fetch') || 
                parseError.message?.includes('Failed to fetch') ||
                parseError instanceof TypeError) {
              throw new Error(
                `Network error while generating batch ${batchNum}/${batches}. ` +
                `Please check your connection and ensure the Python service is running at ${pythonServiceUrl}. ` +
                `Original error: ${parseError.message || parseError}`
              );
            }
            
            throw new Error(`Failed to generate images in batch ${batchNum}/${batches}: ${parseError.message || parseError}`);
          }
        }

        imageUrls = allImageUrls.slice(0, requestedImages);
        imageUrl = imageUrls[0];
      } else {

        // Use AbortController for timeout handling
        const controller = new AbortController();
        let timeoutId: NodeJS.Timeout | null = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

        try {
          let response: Response;
          try {
            response = await fetch(`${pythonServiceUrl}/media/generate-image`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              body: JSON.stringify({
                prompt: enhancedPrompt.trim(),
                brand_id: input.brandId || '',
                aspect_ratio: input.aspectRatio || '1:1',
                number_of_images: requestedImages,
                person_generation: input.personGeneration || '',
              }),
            });
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null;
          } catch (fetchError: any) {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null;
            // Re-throw fetch errors to be caught by outer catch block
            throw fetchError;
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image generation API error: ${response.status} - ${errorText}`);
          }

          const result = await response.json();

          if (result.status === 'error') {
            throw new Error(result.error || result.message || 'Unknown error from image generation');
          }

          // Handle both camelCase and snake_case responses
          imageUrl = result.imageUrl || result.image_url;
          imageUrls = result.imageUrls || result.image_urls || [imageUrl];

          if (!imageUrl) {
            throw new Error('No image URL returned from generation service');
          }
        } catch (error: any) {
          // Clear timeout if error occurred before timeout
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = null;
          
          // Handle different error types
          if (error.name === 'AbortError') {
            throw new Error('Image generation timed out after 5 minutes');
          }
          
          if (error.message?.includes('network') || 
              error.message?.includes('fetch') || 
              error.message?.includes('Failed to fetch') ||
              error instanceof TypeError) {
            throw new Error(
              `Network error while generating images. ` +
              `Please check your connection and ensure the Python service is running at ${pythonServiceUrl}. ` +
              `Original error: ${error.message || error}`
            );
          }
          
          throw error;
        }
      }
    } else {
      // Use Genkit for single image generation (original behavior)
      const generateOptions: any = {
        model: `googleai/${modelId}`,
        prompt: enhancedPrompt.trim(),
        config: {},
      };

      // Add aspect ratio
      if (input.aspectRatio) {
        generateOptions.config.aspectRatio = input.aspectRatio;
      }

      // Add person generation control
      if (input.personGeneration) {
        generateOptions.config.personGeneration = input.personGeneration;
      }

      const {media} = await ai.generate(generateOptions);

      if (!media) {
        throw new Error('No image was generated.');
      }

      imageUrl = media.url;
      imageUrls = [imageUrl];
    }

    // Build enhanced prompt metadata for tracking
    const enhancedPromptMetadata: EnhancedImagePrompt = {
      basePrompt: input.prompt,
      sceneType: sceneClassification.sceneType,
      sceneSubtype: sceneClassification.sceneSubtype,
      brandColors: brandSoulContext?.brandColors,
      brandStyleTags: brandSoulContext?.brandStyleTags,
      generatedAt: new Date().toISOString(),
      modelUsed: modelId,
    };
    
    // Generate explainability report (Phase 1)
    let explainabilityData;
    if (brandSoulContext?.exists) {
      const explainabilityReport = explainBrandSoulInfluence(
        brandSoulContext,
        sceneClassification,
        enhancedPromptMetadata
      );
      
      // Log to console for debugging (can be removed in production)
      logBrandSoulInfluence(explainabilityReport);
      
      // Prepare compact explainability for API response
      explainabilityData = {
        summary: explainabilityReport.summary,
        confidence: explainabilityReport.confidence,
        appliedControls: explainabilityReport.visualPreview.appliedControls,
        brandElements: explainabilityReport.visualPreview.brandElements,
        avoidedElements: explainabilityReport.visualPreview.avoidedElements,
      };
    }

    return {
      imageUrl: imageUrl,
      imageUrls: imageUrls,
      enhancedPrompt: {
        basePrompt: enhancedPromptMetadata.basePrompt,
        sceneType: enhancedPromptMetadata.sceneType,
        sceneSubtype: enhancedPromptMetadata.sceneSubtype,
        brandColors: enhancedPromptMetadata.brandColors,
        brandStyleTags: enhancedPromptMetadata.brandStyleTags,
      },
      explainability: explainabilityData,
    };
  }
);

// ============================================================================
// CHARACTER-CONSISTENT IMAGE GENERATION (Nano Banana / Gemini 2.5 Flash Image)
// ============================================================================

const CharacterConsistentImageOutputSchema = z.object({
  imageUrl: z.string().describe('The URL of the generated image.'),
  characterReferencesUsed: z.array(z.string()).describe('URLs of character references that were used'),
  previousSceneUsed: z.string().optional().describe('URL of previous scene used for consistency'),
  generationModel: z.literal('nano_banana').describe('Model used for generation'),
});
export type CharacterConsistentImageOutput = z.infer<typeof CharacterConsistentImageOutputSchema>;

/**
 * Generate an image with character consistency using Nano Banana (Gemini 2.5 Flash Image).
 * This function calls the Python service's nano_banana endpoint to generate images
 * that maintain visual consistency with provided character references.
 *
 * @param input - Input parameters including prompt, character references, and previous scene
 * @returns Generated image URL with metadata about references used
 */
export async function generateCharacterConsistentImage(
  input: GenerateCharacterConsistentImageInput
): Promise<CharacterConsistentImageOutput> {
  // Build enhanced prompt starting with the base prompt
  let enhancedPrompt = input.prompt;

  // Add campaign prompt context if provided (from master generation prompt)
  if (input.campaignPrompt) {
    enhancedPrompt = `CAMPAIGN CONTEXT: ${input.campaignPrompt}

IMAGE PROMPT: ${input.prompt}`;
  }

  // Get Brand Soul context for enhanced prompts
  if (input.brandId) {
    const brandSoulContext = await getBrandSoulContext(input.brandId);

    if (brandSoulContext?.exists && brandSoulContext.visualGuidelines) {
      enhancedPrompt = `${enhancedPrompt}

BRAND VISUAL GUIDELINES:
${brandSoulContext.visualGuidelines}`;

      if (brandSoulContext.brandColors && brandSoulContext.brandColors.length > 0) {
        enhancedPrompt = `${enhancedPrompt}
Brand Colors: ${brandSoulContext.brandColors.slice(0, 3).join(', ')}`;
      }
    }
  }

  // Build reference images array - character sheets first, then previous scene
  const referenceImages: string[] = [];

  // Add character reference images (limit to avoid exceeding Nano Banana's 14 image limit)
  const maxCharacterRefs = input.previousSceneUrl ? 12 : 13; // Leave room for previous scene
  for (const url of input.characterReferenceUrls.slice(0, maxCharacterRefs)) {
    referenceImages.push(url);
  }

  // Add previous scene if provided (for scene-to-scene consistency)
  if (input.previousSceneUrl) {
    referenceImages.push(input.previousSceneUrl);
  }

  // Call the unified /agent/nano-banana endpoint with full parameter support
  const pythonServiceUrl = process.env.MOMENTUM_PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

  try {
    const response = await fetch(`${pythonServiceUrl}/agent/nano-banana`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        image_url: '', // No main image, using reference images for composition
        reference_images: referenceImages.join(','),
        mask_url: '',
        // Full parameter support
        mode: input.mode || 'compose', // Default to compose for character consistency
        aspect_ratio: input.aspectRatio || '1:1',
        number_of_images: input.numberOfImages || 1,
        person_generation: input.personGeneration || 'allow_all',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.status === 'error') {
      throw new Error(result.error || 'Unknown error from Nano Banana');
    }

    // Handle both camelCase (from API) and snake_case (from raw Python response)
    const imageUrl = result.imageUrl || result.image_url || result.imageUrls?.[0] || result.image_urls?.[0];
    if (!imageUrl) {
      throw new Error('No image URL returned from Nano Banana');
    }

    return {
      imageUrl,
      characterReferencesUsed: input.characterReferenceUrls,
      previousSceneUsed: input.previousSceneUrl,
      generationModel: 'nano_banana',
    };
  } catch (error) {
    throw error;
  }
}
