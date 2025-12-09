import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAiImage } from '@/ai/flows/generate-ai-images';
import { generateVideo } from '@/ai/flows/generate-video';
import { saveChatbotImageAction, saveChatbotVideoAction } from '@/app/actions';

const GOOGLE_API_KEY = process.env.MOMENTUM_GOOGLE_API_KEY;

interface MediaData {
  type: 'image' | 'video';
  data: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, model = 'gemini-text', media, brandId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    switch (model) {
      case 'gemini-text':
        return await handleGeminiText(genAI, messages, media);
      
      case 'gemini-vision':
        return await handleGeminiVision(genAI, messages, media);
      
      case 'imagen':
        return await handleImagen(messages, brandId);
      
      case 'veo':
        return await handleVeo(messages, brandId);
      
      default:
        return await handleGeminiText(genAI, messages, media);
    }

  } catch (error) {
    console.error('AI chat error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process chat request',
        success: false 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGeminiText(genAI: GoogleGenerativeAI, messages: any[], media?: MediaData[]) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const history = messages.slice(0, -1).map((msg: any) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const currentMessage = messages[messages.length - 1]?.content || '';
  const chat = model.startChat({ history });

  const parts: any[] = [];
  
  if (media && media.length > 0) {
    for (const m of media) {
      const base64Data = m.data.split(',')[1];
      const mimeType = m.data.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
      
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType,
        },
      });
    }
  }
  
  if (currentMessage) {
    parts.push({ text: currentMessage });
  }

  const result = await chat.sendMessageStream(parts.length > 0 ? parts : currentMessage);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            try {
              controller.enqueue(encoder.encode(text));
            } catch (err) {
              console.error('Enqueue error:', err);
              break;
            }
          }
        }
        try {
          controller.close();
        } catch (err) {
          console.error('Close error (already closed):', err);
        }
      } catch (error) {
        console.error('Streaming error:', error);
        try {
          controller.error(error);
        } catch (err) {
          console.error('Error setting error (already closed):', err);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

async function handleGeminiVision(genAI: GoogleGenerativeAI, messages: any[], media?: MediaData[]) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  if (!media || media.length === 0) {
    const encoder = new TextEncoder();
    const errorMessage = 'Please upload an image to use Gemini Vision for analysis or editing.';
    
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  }

  const currentMessage = messages[messages.length - 1]?.content || 'Analyze this image in detail and provide insights.';
  
  const parts: any[] = [];
  
  for (const m of media) {
    if (m.type === 'image') {
      const base64Data = m.data.split(',')[1];
      const mimeType = m.data.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
      
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType,
        },
      });
    }
  }
  
  parts.push({ text: currentMessage });

  const result = await model.generateContentStream(parts);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            try {
              controller.enqueue(encoder.encode(text));
            } catch (err) {
              console.error('Enqueue error:', err);
              break;
            }
          }
        }
        try {
          controller.close();
        } catch (err) {
          console.error('Close error (already closed):', err);
        }
      } catch (error) {
        console.error('Vision streaming error:', error);
        try {
          controller.error(error);
        } catch (err) {
          console.error('Error setting error (already closed):', err);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

async function handleImagen(messages: any[], brandId?: string) {
  const encoder = new TextEncoder();
  const currentMessage = messages[messages.length - 1]?.content || '';

  if (!currentMessage) {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('Please provide a text prompt for image generation.'));
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  }

  try {
    // Use the same Genkit approach as the Image Gallery
    const { imageUrl } = await generateAiImage({ prompt: currentMessage });

    // Fetch the image and convert to base64 for embedding in chat
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageDataUri = `data:image/png;base64,${base64Image}`;
    
    console.log('✅ Image generated, base64 length:', base64Image.length);

    // Save to Image Gallery if brandId is provided
    if (brandId) {
      const imageId = `chatbot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const saveResult = await saveChatbotImageAction(brandId, imageId, currentMessage, imageDataUri);
      
      if (saveResult.error) {
        console.error('Failed to save image to gallery:', saveResult.error);
      } else {
        console.log('✅ Image saved to gallery');
      }
    }

    const message = `✅ Image Generated Successfully!\n\nPrompt: "${currentMessage}"\n\nModel: Imagen 4.0 Fast\n\n${brandId ? '💾 Saved to Image Gallery\n\n' : ''}[Image displayed below]`;

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(message));
          controller.enqueue(encoder.encode(`\n\n__IMAGE_DATA__${base64Image}`));
          console.log('✅ Image data sent to frontend');
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );

  } catch (error) {
    const errorMsg = `❌ Image Generation Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease ensure your Google API key is configured correctly.`;

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  }
}

async function handleVeo(messages: any[], brandId?: string) {
  const encoder = new TextEncoder();
  const currentMessage = messages[messages.length - 1]?.content || '';

  if (!currentMessage) {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('Please provide a text prompt for video generation.'));
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  }

  try {
    // Inform user that video generation is in progress
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode('🎬 Generating video with Veo 3.0...\n\n'));
          controller.enqueue(encoder.encode(`Prompt: "${currentMessage}"\n\n`));
          controller.enqueue(encoder.encode('⏳ This may take 30-90 seconds. Please wait...\n\n'));

          // Use the same Genkit approach as the Video Gallery
          const { videoUrl } = await generateVideo({ prompt: currentMessage });

          // Save to Video Gallery if brandId is provided
          if (brandId) {
            const videoId = `chatbot_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const saveResult = await saveChatbotVideoAction(brandId, videoId, currentMessage, videoUrl);
            
            if (saveResult.error) {
              console.error('Failed to save video to gallery:', saveResult.error);
            } else {
              console.log('✅ Video saved to gallery');
            }
          }

          controller.enqueue(encoder.encode('✅ Video Generated Successfully!\n\n'));
          if (brandId) {
            controller.enqueue(encoder.encode('💾 Saved to Video Gallery\n\n'));
          }
          controller.enqueue(encoder.encode('[Video displayed below]\n\n'));
          
          // Send video data marker with base64 data
          const base64Video = videoUrl.split(',')[1];
          console.log('✅ Video generated, base64 length:', base64Video?.length);
          controller.enqueue(encoder.encode(`__VIDEO_DATA__${base64Video}`));
          console.log('✅ Video data sent to frontend');
          
          controller.close();
        } catch (error) {
          const errorMsg = `❌ Video Generation Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`;
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    const errorMsg = `❌ Video Generation Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`;

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  }
}
