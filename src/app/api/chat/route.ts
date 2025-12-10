import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateAiImage } from '@/ai/flows/generate-ai-images';
import { generateVideo } from '@/ai/flows/generate-video';
import { saveChatbotImageAction, saveChatbotVideoAction } from '@/app/actions';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { getAIAssistantContext } from '@/lib/ai-assistant-context';
import { extractUrlsFromMessage, crawlWebsite, formatCrawlResultForAI } from '@/lib/firecrawl-service';
import { requireBrandAccess } from '@/lib/brand-membership';
import { parseCampaignRequest, calculatePostSchedule, generateContentBlockInstructions } from '@/lib/campaign-creation-agent';
import { saveChatMessage } from '@/lib/chat-history';
import { getAIModelSettingsAction, AIModelSettings } from '@/app/actions/ai-settings';
import { formatSelectedContext, extractImageContext, resolveImageReference, ImageContext, truncateMessagesForContextWindow, MAX_CONTEXT_TOKENS } from '@/lib/chat-context-utils';
import { 
  resolveMediaReferences, 
  buildMediaRegistry, 
  createEnhancedMedia,
  formatMediaContextForAI,
  extractSemanticTagsFromFilename,
  type RobustMediaContext,
  type EnhancedMedia 
} from '@/lib/robust-media-context';

const GOOGLE_API_KEY = process.env.MOMENTUM_GOOGLE_API_KEY;
const PYTHON_AGENT_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

// Marketing Agent proxy handler
async function callMarketingAgent(endpoint: string, payload: any) {
  const startTime = Date.now();
  console.log('[Marketing Agent] Calling endpoint:', endpoint, {
    pythonAgentUrl: PYTHON_AGENT_URL,
    payloadSize: JSON.stringify(payload).length,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(`${PYTHON_AGENT_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Marketing Agent request failed' }));
      console.error('[Marketing Agent] Request failed:', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        error: error.detail,
        duration: `${duration}ms`
      });
      throw new Error(error.detail || 'Marketing Agent request failed');
    }

    console.log('[Marketing Agent] ✓ Request successful:', {
      endpoint,
      status: response.status,
      duration: `${duration}ms`
    });

    return response.json();
  } catch (error) {
    const duration = Date.now() - startTime;
    // If Python agent is unreachable, log and rethrow with context
    console.error('[Marketing Agent] Unavailable:', {
      endpoint,
      pythonAgentUrl: PYTHON_AGENT_URL,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    throw new Error('Python Agent service is currently unavailable. Please try again later.');
  }
}

// Build team info object from context
function buildTeamInfo(teamContext: any = {}) {
  return {
    name: teamContext.teamName || undefined,
    type: teamContext.teamType || undefined,
    focus: teamContext.focus || undefined,
    target_audience: teamContext.targetAudience || undefined,
    keywords: teamContext.keywords || undefined,
    domain: teamContext.domain || undefined,
    colors: teamContext.colors || undefined,
    style: teamContext.style || undefined,
  };
}

// Handle Gemini Text model
async function handleGeminiText(messages: any[], media: any[], brandId?: string, userId?: string, settings?: AIModelSettings, selectedContext: any[] = []) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);

  let systemInstruction: string | undefined = undefined;

  if (brandId && userId) {
    const aiContext = await getAIAssistantContext(brandId, userId);
    systemInstruction = aiContext.systemPrompt;
  }

  const modelName = settings?.textModel || 'gemini-2.0-flash-exp';
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemInstruction,
  });

  // Truncate messages to fit within context window limits
  // Pass hasNewMedia flag to use more aggressive truncation when media is present
  const hasMedia = media && media.length > 0;
  const truncatedMessages = truncateMessagesForContextWindow(messages, MAX_CONTEXT_TOKENS, hasMedia);

  let history = truncatedMessages.slice(0, -1).map((msg: any) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  // Gemini requires history to start with a user message.
  // If the first message is from the model, remove it and any subsequent model messages until we find a user message.
  while (history.length > 0 && history[0].role === 'model') {
    history.shift();
  }

  let currentMessage = truncatedMessages[truncatedMessages.length - 1]?.content || '';
  currentMessage = formatSelectedContext(selectedContext, currentMessage);
  
  const urls = extractUrlsFromMessage(currentMessage);
  let enhancedMessage = currentMessage;
  
  if (urls.length > 0) {
    const crawlResults = await Promise.all(urls.map(url => crawlWebsite(url)));
    const crawlTexts = crawlResults.map(result => formatCrawlResultForAI(result));
    
    if (crawlTexts.length > 0) {
      enhancedMessage = `${currentMessage}\n\n--- WEBSITE INFORMATION ---\n${crawlTexts.join('\n\n')}`;
    }
  }
  
  const chat = model.startChat({ 
    history,
  });

  const parts: any[] = [];
  
  if (media && media.length > 0) {
    for (const m of media) {
      let base64Data;
      if (m.data) {
        base64Data = m.data.split(',')[1] || m.data;
      } else if (m.url) {
        try {
          const response = await fetch(m.url);
          const arrayBuffer = await response.arrayBuffer();
          base64Data = Buffer.from(arrayBuffer).toString('base64');
        } catch (error) {
          console.error('Failed to fetch media from URL:', m.url, error);
          continue;
        }
      } else {
        continue;
      }

      parts.push({
        inlineData: {
          mimeType: m.type === 'image' ? 'image/png' : 'video/mp4',
          data: base64Data,
        },
      });
    }
  }
  
  parts.push({ text: enhancedMessage });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await chat.sendMessageStream(parts);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.close();
      } catch (error) {
        console.error('Error in Gemini Text:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle Gemini Vision model
async function handleGeminiVision(messages: any[], media: any[], settings?: AIModelSettings) {
  if (!media || media.length === 0) {
    return new Response('Error: Gemini Vision requires at least one image to analyze', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
  const modelName = settings?.textModel || 'gemini-2.0-flash-exp'; // Vision uses same text model or we could add a vision model setting
  const model = genAI.getGenerativeModel({ model: modelName });

  const lastMessage = messages[messages.length - 1];
  const prompt = lastMessage.content || 'Analyze this image';

  const parts: any[] = [];
  for (const m of media) {
    let base64Data;
    if (m.data) {
      base64Data = m.data.split(',')[1] || m.data;
    } else if (m.url) {
      try {
        const response = await fetch(m.url);
        const arrayBuffer = await response.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString('base64');
      } catch (error) {
        console.error('Failed to fetch media from URL:', m.url, error);
        continue;
      }
    } else {
      continue;
    }

    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Data,
      },
    });
  }
  parts.push({ text: prompt });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(parts);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.close();
      } catch (error) {
        console.error('Error in Gemini Vision:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle Imagen 4.0 image generation
async function handleImagen(prompt: string, brandId?: string, settings?: AIModelSettings) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const modelName = settings?.imageModel || 'imagen-3.0-generate-001';
        controller.enqueue(encoder.encode(`Generating image with ${modelName}...\n\n`));

        const result = await generateAiImage({ prompt, brandId, model: modelName });
        
        if (result.imageUrl) {
          // Extract base64 data from data URI
          const base64Data = result.imageUrl.split(',')[1] || result.imageUrl;
          
          let responseText = `✅ Image generated successfully!`;
          
          // Save to gallery has been moved to frontend to avoid double saving and ensure permanent URL
          /*
          if (brandId) {
            try {
              const imageId = `chatbot-img-${Date.now()}`;
              await saveChatbotImageAction(brandId, imageId, prompt, base64Data, result.explainability);
              responseText += '\n\n💾 Saved to Image Gallery';
              
              // Track analytics if explainability available
              if (result.explainability) {
                const { trackExplainabilityAnalyticsAction } = await import('@/app/actions');
                await trackExplainabilityAnalyticsAction(
                  brandId,
                  'chatbot',
                  result.explainability,
                  imageId
                ).catch(err => console.error('Analytics tracking failed:', err));
              }
            } catch (saveError) {
              console.error('Failed to save image to gallery:', saveError);
            }
          }
          */
          
          // Include explainability data in response if available
          if (result.explainability) {
            responseText += `\n\n✨ Brand Soul Applied:\n${result.explainability.summary}`;
          }
          
          responseText += `\n\n__IMAGE_DATA__${base64Data}`;
          
          // Append explainability as structured data marker
          if (result.explainability) {
            responseText += `\n__EXPLAINABILITY__${JSON.stringify(result.explainability)}`;
          }
          
          controller.enqueue(encoder.encode(responseText));
        } else {
          controller.enqueue(encoder.encode(`Error: Image generation failed`));
        }

        controller.close();
      } catch (error) {
        console.error('Error in Imagen:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle Veo 3.0 video generation
async function handleVeo(prompt: string, brandId?: string, settings?: AIModelSettings) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const modelName = settings?.videoModel || 'veo-3.1-generate-preview';
        controller.enqueue(encoder.encode(`Generating video with ${modelName}...\n\nThis may take 30-90 seconds. Please wait...\n\n`));

        const result = await generateVideo({ prompt, model: modelName, settings });
        
        if (result.videoUrl) {
          // Extract base64 data from data URI
          const base64Data = result.videoUrl.split(',')[1] || result.videoUrl;
          
          let responseText = `✅ Video generated successfully!`;
          
          // Save to gallery has been moved to frontend to avoid double saving and ensure permanent URL
          /*
          if (brandId) {
            try {
              const videoId = `chatbot-vid-${Date.now()}`;
              await saveChatbotVideoAction(brandId, videoId, prompt, base64Data);
              responseText += '\n\n💾 Saved to Video Gallery';
            } catch (saveError) {
              console.error('Failed to save video to gallery:', saveError);
            }
          }
          */
          
          responseText += `\n\n__VIDEO_DATA__${base64Data}`;
          controller.enqueue(encoder.encode(responseText));
        } else {
          controller.enqueue(encoder.encode(`Error: Video generation failed`));
        }

        controller.close();
      } catch (error) {
        console.error('Error in Veo:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle ADK Agent (Default Agentic Mode)
async function handleAgentChat(messages: any[], media: any[] = [], teamContext: any = {}, brandId?: string, userId?: string, settings?: AIModelSettings, selectedContext: any[] = []) {
  const lastMessage = messages[messages.length - 1];
  let userMessage = lastMessage.content;
  userMessage = formatSelectedContext(selectedContext, userMessage);

  // =====================================================================
  // ROBUST MEDIA REFERENCE RESOLUTION SYSTEM
  // =====================================================================
  
  console.log('[ADK Agent] Starting robust media resolution...');
  
  // Step 1: Build complete media registry from conversation history
  const conversationMedia = buildMediaRegistry(messages as Array<{
    role: 'user' | 'assistant';
    content: string;
    media?: Array<{
      type: string;
      url: string;
      fileName?: string;
      mimeType?: string;
      persistentId?: string;
    }>;
  }>);
  
  console.log('[ADK Agent] Media registry built:', {
    totalMedia: conversationMedia.length,
    indices: conversationMedia.map(m => m.displayIndex),
  });
  
  // Step 2: Convert current turn uploads to EnhancedMedia
  const currentTurn = messages.length;
  const currentTurnUploads: EnhancedMedia[] = media && media.length > 0
    ? media.map((m: any, index: number) => {
        const enhanced = createEnhancedMedia(
          {
            type: m.type,
            url: m.url,
            fileName: m.fileName || `${m.type}_${Date.now()}`,
            mimeType: m.mimeType,
            file: m.file,
          },
          currentTurn,
          'user_upload',
          m.persistentId
        );
        
        // Extract semantic tags from filename (in production, use Vision API)
        enhanced.semanticTags = extractSemanticTagsFromFilename(enhanced.fileName);
        
        // CRITICAL: Preserve re-injection marker (explicit user selection)
        enhanced.isReinjected = m.isReinjected || false;
        
        // Assign display index - for re-injected media, use INPUT BOX index (1-based)
        // This means "image 1" refers to the FIRST media in the input box, not conversation history
        enhanced.displayIndex = index + 1;
        
        return enhanced;
      })
    : [];
  
  console.log('[ADK Agent] Current turn uploads:', {
    count: currentTurnUploads.length,
    files: currentTurnUploads.map(m => m.fileName),
  });
  
  // Step 3: Resolve media references using robust algorithm
  const mediaContext: RobustMediaContext = resolveMediaReferences(
    userMessage,
    currentTurnUploads,
    conversationMedia,
    currentTurn
  );
  
  console.log('[ADK Agent] Media resolution complete:', {
    method: mediaContext.resolution.method,
    confidence: mediaContext.resolution.confidence,
    resolvedCount: mediaContext.resolvedMedia.length,
    requiresDisambiguation: mediaContext.disambiguation.required,
  });
  
  // Step 4: Handle disambiguation if needed
  if (mediaContext.disambiguation.required) {
    console.warn('[ADK Agent] Disambiguation required:', mediaContext.disambiguation.reason);
    
    // Return disambiguation request to user
    const disambiguationMessage = `I need clarification on which media you want to work with.\n\n${mediaContext.disambiguation.suggestedAction}\n\n` +
      mediaContext.disambiguation.options.map((opt, i) => 
        `${i + 1}. Image ${opt.media.displayIndex}: ${opt.media.fileName} - ${opt.reason}`
      ).join('\n') +
      '\n\nPlease specify which one (e.g., "use image 1" or "the blue car").';
    
    return new Response(disambiguationMessage, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
  
  // Step 5: Use resolved media for AI request
  const resolvedMedia = mediaContext.resolvedMedia;
  
  // CRITICAL: hasMedia should ONLY be true for NEW uploads in THIS turn
  // Not for media referenced from history (to match handleGeminiText behavior)
  // This controls aggressive truncation which should only happen when uploading new media
  const hasNewMedia = media && media.length > 0;
  
  console.log('[ADK Agent] Final resolved media:', {
    count: resolvedMedia.length,
    files: resolvedMedia.map(m => `${m.fileName} (${m.role || 'primary'})`),
    resolution: mediaContext.resolution.userIntent,
    hasNewMedia, // Only new uploads trigger aggressive truncation
  });
  
  // =====================================================================
  // END ROBUST MEDIA RESOLUTION
  // =====================================================================
  
  // Truncate messages to fit within context window limits
  // Use aggressive truncation ONLY if NEW media is being uploaded (not for historical references)
  const truncatedMessages = truncateMessagesForContextWindow(messages, MAX_CONTEXT_TOKENS, hasNewMedia);
  
  // Generate session ID from brandId or use default
  const sessionId = brandId || 'default';
  
  // Fetch full AI Assistant Context for enriched team knowledge
  let enrichedContext: any = teamContext;
  const hasMedia = resolvedMedia && resolvedMedia.length > 0; // For checking if media exists at all
  
  if (brandId && userId) {
    try {
      const aiContext = await getAIAssistantContext(brandId, userId);
      
      // Use minimal context for media operations to reduce token usage and avoid quota issues
      const contextPrompt = hasMedia ? aiContext.systemPromptMinimal : aiContext.systemPrompt;
      
      enrichedContext = {
        ...teamContext,
        systemPrompt: contextPrompt,
        brandProfile: aiContext.brandProfile,
        brandSoul: aiContext.brandSoul,
        teamMembers: aiContext.teamMembers,
        currentUser: aiContext.currentUser,
      };
      
      if (hasMedia) {
        console.log('[ADK Agent] Using minimal context for media operation (quota optimization)');
      } else {
        console.log('[ADK Agent] Enriched context loaded with Team Intelligence, members, and Brand Soul');
      }
    } catch (error) {
      console.warn('[ADK Agent] Failed to load enriched context, using basic context:', error);
      // Fall back to basic teamContext if enriched context fails
    }
  }

  // Process media files for multimodal input (using resolvedMedia which may include auto-attached referenced images)
  const mediaFiles = resolvedMedia && resolvedMedia.length > 0 ? resolvedMedia.map((m: any) => {
    // Handle both Firebase Storage URLs (new) and base64 data (legacy)
    let processedData = m.data;
    if (m.data && typeof m.data === 'string' && m.data.includes(',')) {
      // Legacy base64 data URL format
      processedData = m.data.split(',')[1] || m.data;
    }
    
    return {
      type: m.type,
      data: processedData, // May be undefined if using URL
      url: m.url, // Firebase Storage URL (new format)
      fileName: m.fileName,
      mimeType: m.mimeType || (
        m.type === 'image' ? 'image/png' :
        m.type === 'video' ? 'video/mp4' :
        m.type === 'pdf' ? 'application/pdf' :
        m.type === 'audio' ? 'audio/mpeg' :
        'application/octet-stream'
      ),
    };
  }) : undefined;

  // User message saving is handled by the client (gemini-chatbot.tsx)
  // to avoid duplicates and ensure consistent behavior across modes.

  try {
    const response = await fetch(`${PYTHON_AGENT_URL}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        session_id: sessionId,
        brand_id: brandId,
        user_id: userId,
        team_context: enrichedContext,
        media: mediaFiles,
        settings: settings, // Pass settings to agent
        // Pass ROBUST image context with accurate media resolution
        image_context: (() => {
          // Use resolved media from robust system
          if (resolvedMedia.length > 0) {
            const images = resolvedMedia.filter(m => m.type === 'image');
            
            return {
              last_image_url: images[images.length - 1]?.url || null,
              total_count: images.length,
              images: images.map(m => ({
                url: m.url,
                index: m.displayIndex, // Use persistent display index
                source: m.source === 'user_upload' ? 'user' : 'assistant',
                file_name: m.fileName,
                persistent_id: m.persistentId, // Include for tracking
                role: m.role, // primary, reference, mask, etc.
              })),
              is_new_media: currentTurnUploads.length > 0, // True if uploaded THIS turn
              resolution_method: mediaContext.resolution.method,
              resolution_confidence: mediaContext.resolution.confidence,
              user_intent: mediaContext.resolution.userIntent,
            };
          }
          
          // No media resolved
          return undefined;
        })(),
        // Pass complete media context for advanced agent decision-making
        robust_media_context: {
          resolved_media_count: resolvedMedia.length,
          available_media_count: conversationMedia.length,
          resolution_method: mediaContext.resolution.method,
          resolution_confidence: mediaContext.resolution.confidence,
          user_intent: mediaContext.resolution.userIntent,
          debug_info: mediaContext.resolution.debugInfo,
        },
      }),
      // No timeout for streaming response, or very long one
      signal: AbortSignal.timeout(300000), // 5 minutes
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ADK Agent request failed: ${response.status} ${errorText}`);
    }

    // Forward the stream directly to the client
    // We need to process the stream to save artifacts to Firestore as they arrive or at the end
    // For now, we'll just forward the stream and let the client handle display.
    // Ideally, we should have a side-effect stream reader here to save to DB, 
    // but Vercel/Next.js edge functions might terminate early if we don't return response.
    // So we will return the stream immediately.
    
    // NOTE: Saving to Firestore history is now tricky because we don't have the full response yet.
    // We might need the client to send a "save history" request after completion, 
    // or use a separate background process/queue if possible.
    // For this implementation, we will skip server-side saving of the ASSISTANT response for now
    // and rely on the client state or a future "sync history" call.
    // Alternatively, we can tee the stream?
    
    const stream = new ReadableStream({
        async start(controller) {
            if (!response.body) return;
            const reader = response.body.getReader();
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                  if (done) {
                    console.log('[ADK Agent] Stream finished');
                    break;
                  }
                  // console.log('[ADK Agent] Received chunk', value.length);
                    controller.enqueue(value);
                }
                controller.close();
            } catch (e) {
                controller.error(e);
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive',
        }
    });
    
  } catch (error) {
    console.warn('[ADK Agent] Python agent unavailable or timed out, falling back to Gemini Text');
    console.error('ADK Agent error details:', error instanceof Error ? error.message : 'Unknown error');
    // Fallback to basic Gemini text if agent fails completely
    return handleGeminiText(messages, [], brandId, userId, settings, selectedContext);
  }
}

// Handle Team Assistant chat (Legacy - kept for backward compatibility)
async function handleTeamChat(messages: any[], teamContext: any = {}, brandId?: string, settings?: AIModelSettings) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
  const modelName = settings?.teamChatModel || settings?.textModel || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({ model: modelName });

  const history = messages.slice(0, -1).map((msg: any) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
  const lastMessage = messages[messages.length - 1]?.content || '';

  const chat = model.startChat({ history });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await chat.sendMessageStream(lastMessage);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('Error in Team Chat:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle domain suggestions
async function handleDomainSuggestions(prompt: string, teamContext: any = {}, settings?: AIModelSettings) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
  const modelName = settings?.domainSuggestionsModel || settings?.textModel || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const fallbackPrompt = `Generate 5-7 creative domain name suggestions based on: ${prompt}. For each domain, suggest a .com, .io, or .team extension. Keep names short, memorable, and brandable. Team context: ${JSON.stringify(teamContext)}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(fallbackPrompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('Error in Domain Suggestions:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle website planning
async function handleWebsitePlanning(prompt: string, teamContext: any = {}, settings?: AIModelSettings) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
  const modelName = settings?.websitePlanningModel || settings?.textModel || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const fallbackPrompt = `Create a comprehensive website plan for: ${prompt}. Include: site structure, key pages, features, and content strategy. Team context: ${JSON.stringify(teamContext)}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(fallbackPrompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('Error in Website Planning:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle team strategy
async function handleTeamStrategy(prompt: string, teamContext: any = {}, settings?: AIModelSettings) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
  const modelName = settings?.teamStrategyModel || settings?.textModel || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const fallbackPrompt = `Create a comprehensive strategic plan for: ${prompt}. Include: goals, tactics, timeline, and success metrics. Team context: ${JSON.stringify(teamContext)}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(fallbackPrompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('Error in Team Strategy:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle logo concepts
async function handleLogoConcepts(prompt: string, teamContext: any = {}, settings?: AIModelSettings) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY!);
  const modelName = settings?.logoConceptsModel || settings?.textModel || 'gemini-2.0-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const fallbackPrompt = `Generate creative logo design concepts for: ${prompt}. Include: visual style, color palette, symbolism, and 3-5 specific design directions. Team context: ${JSON.stringify(teamContext)}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(fallbackPrompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        console.error('Error in Logo Concepts:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle YouTube Analysis
async function handleYoutubeAnalysis(prompt: string, brandId?: string, userId?: string, settings?: AIModelSettings) {
  const urls = extractUrlsFromMessage(prompt);
  const url = urls.length > 0 ? urls[0] : prompt; // Fallback to prompt if no URL found

  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${PYTHON_AGENT_URL}/agent/youtube-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, prompt, settings }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const analysis = data.analysis || 'No analysis returned';
        console.log('[YouTube Analysis] Received analysis from Python, sending to client');

        fullResponse = analysis;
        controller.enqueue(encoder.encode(analysis));
        controller.close();

        // Save to chat history if we have identifiers
        if (brandId && userId && fullResponse) {
          await saveChatMessage(brandId, userId, {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date(),
          }).catch(err => console.error('Failed to save YouTube analysis to history:', err));
        }
      } catch (error) {
        console.error('Error in YouTube Analysis:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}

// Handle Search Mode - Use ADK Agent with web_search_agent tool (same as Agent mode)
async function handleSearch(prompt: string, brandId?: string, userId?: string, settings?: AIModelSettings) {
  // Use the same agent chat handler but with a message that explicitly requests web search
  // This ensures Team Tools search uses the same web_search_agent tool as Agent mode
  const messages = [
    {
      role: 'user' as const,
      content: `Search the web for: ${prompt}`,
      timestamp: new Date().toISOString(),
    }
  ];

  // Use the agent chat handler which will use the web_search_agent tool
  return handleAgentChat(messages, [], undefined, brandId, userId || '', settings, undefined);
}

// Handle Nano Banana (Image Editing)
// Unified handler for Agent, AI Models, and Team Tools
// Supports: multi-image composition, mask-based editing, brand guidelines
async function handleNanoBanana(prompt: string, media?: Array<{ type: string; data?: string; url?: string; fileName?: string; mimeType?: string }>, brandId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Validate we have at least a prompt
        if (!prompt?.trim()) {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'final_response',
            content: '❌ Please provide an editing prompt describing what changes you want to make.'
          }) + '\n'));
          controller.close();
          return;
        }

        // Get all image attachments
        const imageAttachments = media?.filter(m => m.type === 'image') || [];

        // Check if we have an image to edit
        if (imageAttachments.length === 0) {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'final_response',
            content: '❌ Please attach at least one image to edit. You can:\n\n• Upload an image file\n• Paste an image URL\n• Use an image from a previous message'
          }) + '\n'));
          controller.close();
          return;
        }

        // First image is the primary image to edit
        const primaryImage = imageAttachments[0];
        const imageUrl = primaryImage?.url || primaryImage?.data || '';

        // Additional images become reference images for composition/fusion
        // User can reference them as "image 1", "image 2", etc. in the prompt
        const referenceImages = imageAttachments.slice(1).map(m => m.url || m.data || '').filter(Boolean);

        // Check if any attachment is marked as a mask (by filename or type hint)
        const maskAttachment = media?.find(m =>
          m.fileName?.toLowerCase().includes('mask') ||
          m.type === 'mask'
        );
        const maskUrl = maskAttachment?.url || maskAttachment?.data || '';

        // Log what we're processing
        console.log('[Nano Banana] Processing:', {
          prompt: prompt.substring(0, 100),
          primaryImage: imageUrl ? `${imageUrl.substring(0, 50)}...` : 'none',
          referenceCount: referenceImages.length,
          hasMask: !!maskUrl,
          brandId
        });

        // Send thinking message with details
        let thinkingMsg = '🍌 Editing image with Nano Banana';
        if (referenceImages.length > 0) {
          thinkingMsg += ` (using ${referenceImages.length + 1} images for composition)`;
        }
        if (maskUrl) {
          thinkingMsg += ' with mask';
        }
        thinkingMsg += '...';

        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'log',
          content: thinkingMsg
        }) + '\n'));

        // Add timeout for the Python service call
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2 minute timeout for image generation

        try {
          const response = await fetch(`${PYTHON_AGENT_URL}/agent/nano-banana`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              image_url: imageUrl,
              reference_images: referenceImages.join(','),
              mask_url: maskUrl,
              brand_id: brandId || '',
            }),
            signal: abortController.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[Nano Banana] Python service error:', response.status, errorText);

            // Provide user-friendly error messages
            let errorMsg = '❌ Image editing failed: ';
            if (response.status === 400) {
              errorMsg += 'Invalid request. Please check your image and prompt.';
            } else if (response.status === 500) {
              // Try to parse JSON error
              try {
                const errorJson = JSON.parse(errorText);
                errorMsg += errorJson.detail || errorJson.error || 'Internal server error';
              } catch {
                errorMsg += 'The AI service encountered an error. Please try again.';
              }
            } else {
              errorMsg += `Service returned status ${response.status}`;
            }

            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final_response',
              content: errorMsg
            }) + '\n'));
            controller.close();
            return;
          }

          const data = await response.json();

          // Handle both camelCase (imageUrl) and snake_case (image_url) response formats
          const imageUrlFromResponse = data.imageUrl || data.image_url;
          const imageDataFromResponse = data.imageData || data.image_data;

          if (data.status === 'success' && (imageUrlFromResponse || imageDataFromResponse)) {
            const resultUrl = imageUrlFromResponse || (imageDataFromResponse ? `data:image/png;base64,${imageDataFromResponse}` : '');

            // Send image event
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'image',
              data: {
                format: data.format || 'url',
                url: resultUrl,
                data: imageDataFromResponse,
                prompt
              }
            }) + '\n'));

            // Build success message
            let successMsg = `✅ **Image edited successfully!**\n\n**Prompt:** "${prompt}"`;
            if (referenceImages.length > 0) {
              successMsg += `\n\n📎 **Composition:** Used ${referenceImages.length + 1} images`;
            }
            if (maskUrl) {
              successMsg += `\n🎭 **Mask:** Applied selective editing`;
            }
            successMsg += '\n\n_The edited image has been saved to your Media Library._';

            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final_response',
              content: successMsg
            }) + '\n'));
          } else {
            // Handle specific error types
            let errorDetail = data.error || 'Unknown error';
            let userMsg = '❌ Image editing failed';

            if (errorDetail.includes('filename')) {
              userMsg += ': Please provide the full URL of the image, not just the filename.';
            } else if (errorDetail.includes('not initialized')) {
              userMsg += ': AI service is not configured. Please check API credentials.';
            } else if (errorDetail.includes('download') || errorDetail.includes('Firebase')) {
              userMsg += ': Could not access the image. Please try uploading it again.';
            } else {
              userMsg += `: ${errorDetail}`;
            }

            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final_response',
              content: userMsg
            }) + '\n'));
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);

          if (fetchError.name === 'AbortError') {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final_response',
              content: '❌ Image editing timed out. The operation took too long. Please try with a simpler edit or smaller images.'
            }) + '\n'));
          } else {
            throw fetchError;
          }
        }

        controller.close();
      } catch (error) {
        console.error('[Nano Banana] Unexpected error:', error);
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'final_response',
          content: `❌ An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
        }) + '\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

// Handle Website Crawling
async function handleCrawlWebsite(prompt: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Extract URL from prompt
        const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0] : prompt;

        const response = await fetch(`${PYTHON_AGENT_URL}/agent/crawl-website`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        let formattedResult = '';
        if (data.status === 'success') {
          formattedResult = `## Content from ${url}\n\n${data.content || data.text || JSON.stringify(data, null, 2)}`;
        } else {
          formattedResult = `Error crawling website: ${data.error || 'Unknown error'}`;
        }

        controller.enqueue(encoder.encode(formattedResult));
        controller.close();
      } catch (error) {
        console.error('Error in Website Crawler:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Handle Memory (Recall/Save)
async function handleMemory(prompt: string, brandId?: string, userId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Determine if this is a recall or save operation
        const isRecall = prompt.toLowerCase().includes('recall') ||
                         prompt.toLowerCase().includes('remember') ||
                         prompt.toLowerCase().includes('what do you know') ||
                         prompt.toLowerCase().startsWith('?');

        const endpoint = isRecall ? '/agent/memory/recall' : '/agent/memory/save';
        const body = isRecall
          ? { query: prompt, brand_id: brandId, user_id: userId }
          : { content: prompt, brand_id: brandId, user_id: userId };

        const response = await fetch(`${PYTHON_AGENT_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        let formattedResult = '';
        if (data.status === 'success') {
          if (isRecall) {
            formattedResult = data.memories?.length > 0
              ? `## Memories Found\n\n${data.memories.map((m: any) => `- ${m.content || m}`).join('\n')}`
              : '🤔 No relevant memories found.';
          } else {
            formattedResult = '✅ Memory saved successfully!';
          }
        } else {
          formattedResult = `${isRecall ? '🤔' : '❌'} ${data.error || data.message || 'Operation completed'}`;
        }

        controller.enqueue(encoder.encode(formattedResult));
        controller.close();
      } catch (error) {
        console.error('Error in Memory:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Handle RAG Search (Document Search)
async function handleRagSearch(prompt: string, brandId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!brandId) {
          controller.enqueue(encoder.encode('Error: Brand ID is required for document search'));
          controller.close();
          return;
        }

        const response = await fetch(`${PYTHON_AGENT_URL}/agent/rag-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: prompt, brand_id: brandId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        let formattedResult = '';
        if (data.status === 'success') {
          formattedResult = data.results?.length > 0
            ? `## Document Search Results\n\n${data.results.map((r: any) => `### ${r.title || 'Document'}\n${r.content || r.text || r.snippet}\n`).join('\n')}`
            : '📄 No relevant documents found.';
          if (data.answer) {
            formattedResult = `${data.answer}\n\n---\n\n${formattedResult}`;
          }
        } else {
          formattedResult = `📄 ${data.error || 'No documents found'}`;
        }

        controller.enqueue(encoder.encode(formattedResult));
        controller.close();
      } catch (error) {
        console.error('Error in RAG Search:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Handle YouTube Search
async function handleYouTubeSearch(prompt: string, brandId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!brandId) {
          controller.enqueue(encoder.encode('Error: Brand ID is required for YouTube search'));
          controller.close();
          return;
        }

        // Add timeout
        const controller2 = new AbortController();
        const timeoutId = setTimeout(() => controller2.abort(), 30000); // 30 seconds for YouTube API

        let response;
        try {
          response = await fetch(`${PYTHON_AGENT_URL}/agent/youtube-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: prompt, brand_id: brandId, max_results: 10 }),
            signal: controller2.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // Handle API errors (like YouTube API 403)
        if (data.status === 'error') {
          let errorMessage = data.error || 'Unknown error';
          
          // Provide user-friendly error messages
          if (errorMessage.includes('403') || errorMessage.includes('blocked') || errorMessage.includes('forbidden')) {
            errorMessage = 'YouTube Data API v3 is not enabled or the API key does not have permission to search. Please enable YouTube Data API v3 in Google Cloud Console and ensure your API key has the correct permissions.';
          } else if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
            errorMessage = 'YouTube API key is not configured. Please set MOMENTUM_GOOGLE_API_KEY environment variable with a valid YouTube Data API v3 key.';
          }
          
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'final_response',
            content: `❌ YouTube Search Error: ${errorMessage}`
          }) + '\n'));
          controller.close();
          return;
        }

        let formattedResult = '';
        if (data.status === 'success') {
          if (data.videos && data.videos.length > 0) {
            formattedResult = `## Found ${data.videos.length} YouTube Video(s)\n\n`;
            for (const video of data.videos) {
              formattedResult += `### ${video.title}\n`;
              if (video.channel_title) {
                formattedResult += `Channel: ${video.channel_title}\n`;
              }
              if (video.duration_seconds) {
                const minutes = Math.floor(video.duration_seconds / 60);
                const seconds = video.duration_seconds % 60;
                formattedResult += `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
              }
              if (video.view_count) {
                formattedResult += `Views: ${video.view_count.toLocaleString()}\n`;
              }
              formattedResult += `${video.url}\n\n`;
              
              // Add video URL marker for display
              formattedResult += `__VIDEO_URL__${video.url}__VIDEO_URL__\n\n`;
            }
          } else {
            formattedResult = '📺 No YouTube videos found. Try different search terms.';
          }
        } else {
          formattedResult = `📺 ${data.error || 'Failed to search YouTube'}`;
        }

        controller.enqueue(encoder.encode(formattedResult));
        controller.close();
      } catch (error) {
        console.error('Error in YouTube Search:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`Error: ${errorMessage}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Handle Media Search
async function handleMediaSearch(prompt: string, brandId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!brandId) {
          controller.enqueue(encoder.encode('Error: Brand ID is required for media search'));
          controller.close();
          return;
        }

        // Detect if user wants specific media type
        const wantsImages = prompt.toLowerCase().includes('image') || prompt.toLowerCase().includes('photo');
        const wantsVideos = prompt.toLowerCase().includes('video');
        const mediaType = wantsImages ? 'image' : (wantsVideos ? 'video' : '');

        // Add timeout
        const controller2 = new AbortController();
        const timeoutId = setTimeout(() => controller2.abort(), 15000);

        let response;
        try {
          response = await fetch(`${PYTHON_AGENT_URL}/agent/media-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: prompt, brand_id: brandId, media_type: mediaType, limit: 20 }),
            signal: controller2.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
          const results = data.results || data.media || [];
          if (results.length > 0) {
            // Send structured response with media items for rich display
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'media_search_results',
              data: {
                results: results,
                total_count: data.total_count,
                query: prompt,
              }
            }) + '\n'));

            // Also send text summary
            let formattedResult = `## Media Search Results\n\nFound ${results.length} item(s)${prompt ? ` matching "${prompt}"` : ''}:\n\n`;
            formattedResult += results.slice(0, 10).map((r: any) => {
              const title = r.title || r.name || 'Untitled';
              const type = r.type || 'media';
              const url = r.url || r.thumbnailUrl || '#';
              const thumbnailUrl = r.thumbnailUrl || r.url || '#';
              const tags = r.tags?.length > 0 ? ` [${r.tags.slice(0, 3).join(', ')}]` : '';

              // For videos, use video URL so frontend can render as playable video
              // For images, use thumbnail URL for preview
              if (type === 'video') {
                return `- **${title}** (🎬 video)${tags}\n  ![${title}](${url})`;
              } else {
                return `- **${title}** (🖼️ image)${tags}\n  ![${title}](${thumbnailUrl})`;
              }
            }).join('\n\n');

            if (results.length > 10) {
              formattedResult += `\n\n*...and ${results.length - 10} more items*`;
            }

            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final_response',
              content: formattedResult
            }) + '\n'));
          } else {
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final_response',
              content: `🖼️ No media found${prompt ? ` matching "${prompt}"` : ''}. Try a different search term or check the Media Library directly.`
            }) + '\n'));
          }
        } else {
          controller.enqueue(encoder.encode(`🖼️ ${data.error || 'No media found'}`));
        }

        controller.close();
      } catch (error) {
        console.error('Error in Media Search:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Handle Media Index (rebuild search index)
async function handleMediaIndex(brandId?: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!brandId) {
          controller.enqueue(encoder.encode('Error: Brand ID is required for media indexing'));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode('🔄 Starting media index rebuild...\n\n'));

        // Add timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2 minute timeout

        let response;
        try {
          response = await fetch(`${PYTHON_AGENT_URL}/agent/media-index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand_id: brandId, index_all: true }),
            signal: abortController.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Python service error: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
          controller.enqueue(encoder.encode(`✅ **Media Index Complete**\n\n`));
          controller.enqueue(encoder.encode(`- Indexed: ${data.indexed_count || 0} items\n`));
          controller.enqueue(encoder.encode(`- ${data.message}\n\n`));
          controller.enqueue(encoder.encode(`Your media library is now searchable with semantic search. Try searching for concepts like "sunset", "product photos", or "team meeting".`));
        } else {
          controller.enqueue(encoder.encode(`⚠️ **Indexing Issue**\n\n${data.message || data.error || 'Unknown error'}`));
          if (data.errors && data.errors.length > 0) {
            controller.enqueue(encoder.encode(`\n\n**Details:**\n`));
            data.errors.slice(0, 10).forEach((e: string) => {
              controller.enqueue(encoder.encode(`- ${e}\n`));
            });
          }
          if (data.help_url) {
            controller.enqueue(encoder.encode(`\n\n**Quick Fix:** [Enable API](${data.help_url})`));
          }
        }

        controller.close();
      } catch (error) {
        console.error('Error in Media Index:', error);
        controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

// Handle Event Creator (for frontend preview only - agent uses generate-campaign-content directly)
async function handleEventCreator(
  prompt: string,
  brandId?: string,
  userId?: string,
  media?: Array<{ type: string; data?: string; url?: string }>
) {
  if (!brandId || !userId) {
    return NextResponse.json({
      error: 'Team ID and user authentication required for event creation'
    }, { status: 400 });
  }

  try {
    // Verify team access
    await requireBrandAccess(userId, brandId);

    // Parse the natural language event request to get preview info
    const eventRequest = await parseCampaignRequest(prompt, media);

    // Make event name unique by adding start date
    const startDate = new Date(eventRequest.startDate);
    const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const uniqueEventName = `${eventRequest.campaignName} - ${dateStr}`;

    // Calculate total posts
    const postSchedule = calculatePostSchedule(
      eventRequest.duration,
      eventRequest.postsPerDay,
      eventRequest.postDistribution
    );
    const totalPosts = postSchedule.reduce((a, b) => a + b, 0);

    // Extract image URLs from media
    const imageUrls = media?.filter(m => m.type === 'image').map(m => m.url || m.data) || [];

    // Return event generation instructions for frontend users
    // Match the friendly tone of the AI Agent
    // Return as NDJSON to match Agent response format and ensure frontend parses structured data
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send data event first to populate structuredData
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'data',
          data: {
            action: 'generate-campaign',
            prompt,
            campaignName: uniqueEventName,
            campaignRequest: eventRequest,
            totalPosts,
            brandId,
            imageUrls,
          }
        }) + '\n'));

        // Then send final_response
        const hasImages = imageUrls.length > 0 ? ` with ${imageUrls.length} image(s)` : '';
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'final_response',
          content: `I've prepared an event plan${hasImages} for you. Click the "Generate Event with AI" button to create it.`,
          data: {
            action: 'generate-campaign',
            prompt,
            campaignName: uniqueEventName,
            campaignRequest: eventRequest,
            totalPosts,
            brandId,
            imageUrls,
          },
          agent: 'event_creator'
        }) + '\n'));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({
      error: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, mode, media, brandId, teamContext, selectedContext } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Verify user is authenticated
    const user = await getAuthenticatedUser();

    console.log('[API] Chat request received:', {
      mode,
      messageCount: messages?.length,
      mediaCount: media?.length,
      mediaTypes: media?.map((m: any) => m.type),
      mediaUrls: media?.map((m: any) => m.url ? (m.url.startsWith('data:') ? 'data:...' : m.url) : 'no-url'),
      brandId
    });

    // Performance: Removed blocking file I/O - use structured logging above instead



    // Validate API key for AI models
    const aiModelModes = ['gemini-text', 'gemini-vision', 'imagen', 'veo'];
    if (aiModelModes.includes(mode) && !GOOGLE_API_KEY) {
      return NextResponse.json({ 
        error: 'Google AI API key not configured. Please set GOOGLE_API_KEY environment variable.' 
      }, { status: 500 });
    }

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content;

    // Fetch AI model settings if brandId is available
    let aiSettings: AIModelSettings | undefined;
    if (brandId) {
      aiSettings = await getAIModelSettingsAction(brandId);
    }

    // Route to appropriate handler based on mode
    switch (mode) {
      // ADK Agent (Default Agentic Mode)
      case 'agent':
      case undefined:
      case null:
        return handleAgentChat(messages, media || [], teamContext, brandId, user.uid, aiSettings, selectedContext);
      
      // AI Models (Direct Access - bypasses agent)
      case 'gemini-text':
        return handleGeminiText(messages, media || [], brandId, user?.uid, aiSettings, selectedContext);
      
      case 'gemini-vision':
        return handleGeminiVision(messages, media || [], aiSettings);
      
      case 'imagen':
        return handleImagen(prompt, brandId, aiSettings);
      
      case 'veo':
        console.log('Calling handleVeo');
        return handleVeo(prompt, brandId, aiSettings);
      
      // Team Tools (Legacy - kept for backward compatibility)
      case 'team-chat':
        return handleTeamChat(messages, teamContext, brandId, aiSettings);

      case 'domain-suggestions':
        return handleDomainSuggestions(prompt, teamContext, aiSettings);

      case 'website-planning':
        return handleWebsitePlanning(prompt, teamContext, aiSettings);

      case 'team-strategy':
        return handleTeamStrategy(prompt, teamContext, aiSettings);

      case 'logo-concepts':
        return handleLogoConcepts(prompt, teamContext, aiSettings);
      
      case 'event-creator':
        // Event Creator requires authentication and brand access
        return handleEventCreator(prompt, brandId, user.uid, media);
      
      case 'youtube-analysis':
        return handleYoutubeAnalysis(prompt, brandId, user?.uid, aiSettings);

      case 'youtube-search':
        return handleYouTubeSearch(prompt, brandId);

      case 'search':
        return handleSearch(prompt, brandId, user?.uid, aiSettings);

      case 'nano-banana':
        return handleNanoBanana(prompt, media, brandId);

      case 'crawl-website':
        return handleCrawlWebsite(prompt);

      case 'memory':
        return handleMemory(prompt, brandId, user?.uid);

      case 'rag-search':
        return handleRagSearch(prompt, brandId);

      case 'media-search':
        return handleMediaSearch(prompt, brandId);

      case 'media-index':
        return handleMediaIndex(brandId);

      default:
        // Default to agent for unknown modes
        return handleAgentChat(messages, media || [], teamContext, brandId, user.uid, undefined, selectedContext);
    }
  } catch (error) {
    console.error('Error in unified chat API:', error);
    
    // Check if this is a brand access error
    if (error instanceof Error && error.message.includes('does not have access to brand')) {
      return NextResponse.json(
        { error: 'You do not have access to this brand' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
