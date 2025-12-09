import {genkit} from 'genkit';
import {googleAI, textEmbeddingGecko001} from '@genkit-ai/googleai';
import {devLocalVectorstore} from '@genkit-ai/dev-local-vectorstore';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.MOMENTUM_GOOGLE_API_KEY,
      apiVersion: 'v1beta',
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
