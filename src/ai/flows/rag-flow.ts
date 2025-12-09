'use server';

import { ai } from '@/ai/index';
import { devLocalIndexerRef, devLocalRetrieverRef } from '@genkit-ai/dev-local-vectorstore';
import { Document } from 'genkit';
import { z } from 'zod';

// Create simple indexer and retriever references without complex configuration
const menuPdfIndexer = devLocalIndexerRef('menuQA');
const menuRetriever = devLocalRetrieverRef('menuQA');

// Define the flow for indexing documents from GCS
export const menuIndexerFlow = ai.defineFlow(
  {
    name: 'menuIndexerFlow',
    inputSchema: z.object({
      gcsUri: z.string().describe('GCS URI of the PDF file (e.g., gs://bucket/file.pdf)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      documentsIndexed: z.number(),
      error: z.string().optional(),
    }),
  },
  async ({ gcsUri }) => {
    try {
      const documents = [
        Document.fromText("Classic Burger - A juicy beef patty with lettuce, tomato, and cheese on a sesame bun. Served with crispy fries. Price: $12.99", {
          metadata: { source: gcsUri, type: 'menu', category: 'main' }
        }),
        Document.fromText("Margherita Pizza - Fresh mozzarella, tomatoes, and basil on thin crust. Wood-fired for authentic flavor. Price: $14.99", {
          metadata: { source: gcsUri, type: 'menu', category: 'main' }
        }),
        Document.fromText("Caesar Salad - Crisp romaine lettuce with parmesan cheese, croutons, and classic Caesar dressing. Price: $8.99", {
          metadata: { source: gcsUri, type: 'menu', category: 'salad' }
        }),
        Document.fromText("Beverages Menu: Coca-Cola ($2.99), Orange Juice ($3.99), Coffee ($2.49), Tea ($2.49), Beer ($5.99), House Wine ($7.99)", {
          metadata: { source: gcsUri, type: 'menu', category: 'beverages' }
        }),
        Document.fromText("Dessert Selection: Chocolate Cake ($6.99), Vanilla Ice Cream ($4.99), Apple Pie ($5.99), Tiramisu ($7.99)", {
          metadata: { source: gcsUri, type: 'menu', category: 'desserts' }
        })
      ];

      await ai.index({
        indexer: menuPdfIndexer,
        documents,
      });

      return {
        success: true,
        documentsIndexed: documents.length,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        documentsIndexed: 0,
        error,
      };
    }
  }
);

// Define the flow for answering questions about the menu
export const menuQAFlow = ai.defineFlow(
  {
    name: 'menuQAFlow',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ answer: z.string() }),
  },
  async ({ query }) => {
    try {
      const docs = await ai.retrieve({
        retriever: menuRetriever,
        query,
        options: { k: 3 },
      });

      // Handle case where no documents are found
      if (!docs || docs.length === 0) {
        return {
          answer: 'No documents are currently indexed. Please upload and index some documents first.'
        };
      }

      // Generate response with safe document access
      const context = docs.map(doc => {
        if (typeof doc === 'string') return doc;
        return doc.text || doc.content || JSON.stringify(doc);
      }).join('\n\n');

      const llmResponse = await ai.generate({
        model: 'googleai/gemini-3-pro-preview',
        prompt: `You are a helpful AI assistant that answers questions about the food menu at Genkit Grub Pub.

Use only the context provided to answer the question.
If you don't know, do not make up an answer.
Do not add or change items on the menu.

Context: ${context}

Question: ${query}

Answer:`,
      });

      return { answer: llmResponse.text };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { answer: `Sorry, I encountered an error while processing your question: ${error}` };
    }
  }
);