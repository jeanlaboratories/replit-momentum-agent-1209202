
'use server';

/**
 * @fileOverview AI video generation flow using Veo.
 *
 * - generateVideo - A function that generates a video based on a text prompt.
 * - GenerateVideoInput - The input type for the generateVideo function.
 * - GenerateVideoOutput - The return type for the generateVideo function.
 */

import {ai} from '@/ai/index';
import {z} from 'zod';
import {googleAI} from '@genkit-ai/googleai';
import { MediaPart } from 'genkit';
import { getBrandSoulContext } from '@/lib/brand-soul/context';

const GenerateVideoInputSchema = z.object({
  prompt: z.string().describe('The prompt to use to generate the video (up to 1024 tokens).'),
  brandId: z.string().optional().describe('The brand ID to fetch Brand Soul guidelines for.'),
  imageUrl: z.string().optional().describe('URL of the image to animate (Image-to-Video).'),
  characterReferenceUrl: z.string().optional().describe('URL of the character reference image (Ingredients).'),
  startFrameUrl: z.string().optional().describe('URL of the starting frame (Frames-to-Video).'),
  endFrameUrl: z.string().optional().describe('URL of the ending frame (Frames-to-Video).'),
  aspectRatio: z.enum(['9:16', '16:9']).optional().describe('Aspect ratio for the video. Default is "9:16".'),
  resolution: z.enum(['720p', '1080p']).optional().describe('Video resolution. 1080p only for 8s duration.'),
  durationSeconds: z.union([z.literal(4), z.literal(6), z.literal(8)]).optional().describe('Video duration in seconds.'),
  personGeneration: z.string().optional().describe('Person generation setting. Use "allow_all" for people in videos.'),
  videoUrl: z.string().optional().describe('URL to previously generated video to extend (Video Extension) - deprecated, use veoVideoUri.'),
  referenceImages: z.array(z.string()).optional().describe('Array of up to 3 reference image URLs.'),
  useFastModel: z.boolean().optional().describe('Use veo-3.1-fast-generate-preview for faster generation.'),
  model: z.string().optional().describe('The model to use for generation.'),
  settings: z.any().optional().describe('AI model settings.'),
  veoVideoUri: z.string().optional().describe('Gemini API file URI for video extension (preferred over videoUrl).'),
});
export type GenerateVideoInput = z.infer<typeof GenerateVideoInputSchema>;

const GenerateVideoOutputSchema = z.object({
  videoUrl: z.string().describe('The data URI of the generated video.'),
  veoVideoUri: z.string().optional().describe('Gemini API file URI for video extension (valid for 2 days).'),
});
export type GenerateVideoOutput = z.infer<typeof GenerateVideoOutputSchema>;


async function downloadVideo(video: MediaPart): Promise<string> {
    const apiKey = process.env.MOMENTUM_GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('MOMENTUM_GOOGLE_API_KEY environment variable not set.');
    }
  
    if (!video.media?.url) {
      throw new Error('Video media URL is missing.');
    }
  
    // Add API key before fetching the video.
    const videoDownloadResponse = await fetch(
      `${video.media.url}&key=${apiKey}`
    );
  
    if (
      !videoDownloadResponse ||
      videoDownloadResponse.status !== 200 ||
      !videoDownloadResponse.body
    ) {
      throw new Error(`Failed to fetch video. Status: ${videoDownloadResponse.status}`);
    }

    const videoBuffer = await videoDownloadResponse.arrayBuffer();
    const base64Data = Buffer.from(videoBuffer).toString('base64');
    
    // The video content type is `video/mp4`.
    return `data:video/mp4;base64,${base64Data}`;
}


export async function generateVideo(
  input: GenerateVideoInput
): Promise<GenerateVideoOutput> {
  // Fetch Brand Soul guidelines if brandId provided
  let enhancedPrompt = input.prompt;
  
  if (input.brandId) {
    const brandSoulContext = await getBrandSoulContext(input.brandId);
    if (brandSoulContext.exists && brandSoulContext.visualGuidelines) {
      // Enhance prompt with Brand Soul visual guidelines
      enhancedPrompt = `${input.prompt}

BRAND VISUAL GUIDELINES - MUST FOLLOW STRICTLY:
${brandSoulContext.visualGuidelines}

Ensure the generated video adheres to the brand's visual identity including colors, style, and themes specified above.`;
    }
  }
  
  // Call Python Service endpoint instead of Genkit
  // This ensures we use the same working implementation as the Agent (with fixes for Veo 3.1)
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
    const response = await fetch(`${pythonServiceUrl}/media/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        image_url: input.imageUrl,
        character_reference: input.characterReferenceUrl,
        start_frame: input.startFrameUrl,
        end_frame: input.endFrameUrl,
        aspect_ratio: input.aspectRatio || '9:16',
        resolution: input.resolution,
        duration_seconds: input.durationSeconds,
        person_generation: input.personGeneration,
        video_url: input.videoUrl,
        reference_images: input.referenceImages,
        use_fast_model: input.useFastModel,
        brand_id: input.brandId,
        settings: input.settings,
        veo_video_uri: input.veoVideoUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python service error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (!data.videoUrl) {
      throw new Error('No video URL returned from Python service');
    }

    return {
      videoUrl: data.videoUrl,
      veoVideoUri: data.veoVideoUri,  // Gemini API file URI for video extension
    };
  } catch (error: any) {
    console.error('Video generation failed:', error);
    throw new Error(`Failed to generate video: ${error.message}`);
  }
}
