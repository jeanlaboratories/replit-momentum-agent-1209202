import {genkit} from 'genkit';
import {googleAI, textEmbeddingGecko001} from '@genkit-ai/googleai';
import {devLocalVectorstore} from '@genkit-ai/dev-local-vectorstore';

// Lazy initialization to prevent build-time errors
let _ai: ReturnType<typeof genkit> | null = null;

function getAI() {
  if (_ai) {
    return _ai;
  }

  const apiKey = process.env.MOMENTUM_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  
  // Only use mocks during actual Next.js build phase (not runtime)
  // Check for explicit build-time indicators
  const isBuildTime = (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.__NEXT_PRIVATE_PREBUNDLED_REACT
  );

  if (!apiKey) {
    if (isBuildTime) {
      // Return a mock ai instance during build time
      // DO NOT cache it - this ensures runtime will re-check and throw proper error
      return {} as ReturnType<typeof genkit>;
    }
    // At runtime, throw an error if API key is missing
    throw new Error('Google API key is required. Set MOMENTUM_GOOGLE_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY.');
  }

  _ai = genkit({
    plugins: [
      googleAI({
        apiVersion: 'v1beta',
        apiKey: apiKey,
      }),
      devLocalVectorstore([
        {
          indexName: 'advantage-docs',
          embedder: textEmbeddingGecko001,
        }
      ]),
    ],
    model: 'googleai/gemini-3-pro-preview',
  });

  return _ai;
}

export const ai = getAI();
