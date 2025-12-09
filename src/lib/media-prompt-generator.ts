import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAdminInstances } from '@/lib/firebase/admin';
import { DEFAULT_SETTINGS } from '@/lib/ai-model-defaults';

export async function generateMediaPrompt(mediaUrl: string, mediaType: 'image' | 'video'): Promise<string> {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.warn('[Generate Prompt] Missing Google Generative AI API Key');
      return '';
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the default text model from centralized settings
    const model = genAI.getGenerativeModel({ model: DEFAULT_SETTINGS.textModel });

    let prompt = '';
    let result;

    if (mediaType === 'image') {
      prompt = "Describe this image in detail, focusing on the subject, style, colors, and composition. Create a comprehensive prompt that could be used to recreate this image using an AI image generator. Keep it under 100 words.";

      // Fetch the image and convert to base64
      const response = await fetch(mediaUrl);
      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';

      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ]);
    } else {
      // For videos, we might just describe the first frame or use a video-capable model if available.
      // For now, we'll use a text-based approach or skip if not easily supported without downloading large files.
      // Given the constraints, we'll try to get a description if it's a short video, otherwise return empty.
      return '';
    }

    const text = result.response.text();
    return text.trim();
  } catch (error) {
    console.error('[Generate Prompt] Error:', error);
    return `Error generating prompt: ${error instanceof Error ? error.message : String(error)}`;
  }
}
