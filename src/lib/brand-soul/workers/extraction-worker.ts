// Brand Soul - AI Extraction Worker
// Extracts brand insights from artifacts using Gemini via Genkit

import { ai } from '@/ai/genkit';
import { gemini15Flash, gemini20Flash } from '@genkit-ai/googleai';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { jobQueue } from '@/lib/brand-soul/queue';
import type {
  ExtractedInsights,
  VoiceElement,
  ExtractedFact,
  KeyMessage,
  VisualElement,
  BrandArtifact
} from '@/lib/types/brand-soul';
import { DEFAULT_SETTINGS } from '@/lib/ai-model-defaults';

/**
 * AI Extraction Worker - Processes artifacts and extracts brand intelligence
 */
export class ExtractionWorker {
  
  /**
   * Process a single artifact and extract insights
   */
  async processArtifact(artifactId: string, brandId: string): Promise<boolean> {
    console.log(`[ExtractionWorker] Processing artifact ${artifactId}...`);
    
    try {
      // Get artifact metadata
      const { adminDb } = getAdminInstances();
      const artifactDoc = await adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .doc(artifactId)
        .get();
      
      if (!artifactDoc.exists) {
        console.error(`[ExtractionWorker] Artifact ${artifactId} not found`);
        return false;
      }
      
      const artifact = artifactDoc.data() as BrandArtifact;
      
      // Load or extract content
      let content: string | null = null;
      let imageUrl: string | null = null;

      // Check if artifact is an image or video that needs visual analysis
      const isImage = artifact.type.startsWith('image');
      const isVideo = artifact.type.startsWith('video') || artifact.type === 'youtube-video';
      const isMultimodal = isImage || isVideo; // Both are multimodal now
      
      if (artifact.contentRef) {
        // Content already extracted, load it
        content = await brandSoulStorage.getContent(artifact.contentRef.path);
      } else if (isMultimodal && artifact.documentRef) {
        // Image or Video artifact - Prepare for Visual/Multimodal Analysis
        console.log(`[ExtractionWorker] Preparing ${isImage ? 'image' : 'video'} for analysis...`);

        // Generate signed URL for the media to pass to Gemini
        if (artifact.type === 'youtube-video') {
          // Fallback to thumbnail for now, direct URL might be failing in Genkit
          imageUrl = artifact.metadata.customFields?.thumbnailUrl || null;
        } else {
          imageUrl = await brandSoulStorage.getSignedUrl(artifact.documentRef.path, 3600);
        }

        if (!imageUrl) {
          console.error(`[ExtractionWorker] Failed to generate signed URL for media ${artifactId}`);
          return false;
        }

        // For media, we don't extract text via Firecrawl. 
        // We'll pass the media directly to Gemini.
        if (artifact.type === 'youtube-video' && content) {
          // Content already contains transcript (loaded from contentRef earlier if available, 
          // but for youtube-video, contentRef points to JSON with transcript)
          try {
            const youtubeData = JSON.parse(content);
            content = youtubeData.transcript || "Transcript not available.";
            if (youtubeData.transcriptAvailable === false) {
              content = "NOTE: Transcript not available for this video. Analyze metadata and thumbnail only.";
            }
          } catch (e) {
            content = "Video content";
          }
        } else {
          content = isImage ? "Image content" : "Video content"; // Placeholder to pass checks
        }

      } else if (artifact.documentRef) {
        // Binary document (PDF, etc.) needs extraction via Firecrawl
        console.log(`[ExtractionWorker] Extracting content from binary document...`);
        
        try {
          const apiKey = process.env.MOMENTUM_FIRECRAWL_API_KEY;
          if (!apiKey) {
            throw new Error('MOMENTUM_FIRECRAWL_API_KEY not configured');
          }
          
          // Generate signed URL for the document
          const signedUrl = await brandSoulStorage.getSignedUrl(artifact.documentRef.path, 3600);
          if (!signedUrl) {
            throw new Error('Failed to generate signed URL for document');
          }
          
          // Extract text using Firecrawl API directly
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              url: signedUrl,
              formats: ['markdown'],
            }),
          });
          
          if (!scrapeResponse.ok) {
            const errorText = await scrapeResponse.text();
            throw new Error(`Firecrawl API error: ${scrapeResponse.status} - ${errorText}`);
          }
          
          const scrapeResult = await scrapeResponse.json();
          content = scrapeResult.data?.markdown || scrapeResult.markdown;
          
          if (!content || content.length < 50) {
            throw new Error('Firecrawl returned insufficient content');
          }
          
          // Store extracted content for future use
          const contentRef = await brandSoulStorage.storeContent(
            brandId,
            artifactId,
            content,
            'source'
          );
          
          // Update artifact with contentRef
          await adminDb
            .collection('brandArtifacts')
            .doc(brandId)
            .collection('sources')
            .doc(artifactId)
            .update({ contentRef });
          
          console.log(`[ExtractionWorker] Extracted ${content.length} characters from document`);
          
        } catch (extractError) {
          console.error(`[ExtractionWorker] Document extraction failed:`, extractError);
          
          // Mark artifact as failed
          await adminDb
            .collection('brandArtifacts')
            .doc(brandId)
            .collection('sources')
            .doc(artifactId)
            .update({
              status: 'failed',
              lastError: `Document extraction failed: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`,
            });
          
          return false;
        }
      } else {
        console.error(`[ExtractionWorker] Artifact ${artifactId} has no content or document reference`);
        return false;
      }
      
      if (!content) {
        console.error(`[ExtractionWorker] Failed to load content for ${artifactId}`);
        return false;
      }
      
      // Update artifact status to 'extracting'
      await adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .doc(artifactId)
        .update({ status: 'extracting' });
      
      // Extract insights using AI
      console.log(`[ExtractionWorker] Running AI extraction on ${isMultimodal ? (isImage ? 'IMAGE' : 'VIDEO') : content.length + ' characters'}...`);
      const insights = await this.extractInsights(content, artifact, imageUrl, isVideo);
      
      // Store insights in Firebase Storage
      const insightsRef = await brandSoulStorage.storeInsights(brandId, artifactId, insights);
      
      // Extract colors from screenshot if available
      type ExtractedColor = {
        hex: string;
        rgb: number[];
        proportion: number;
      };
      let extractedColors: ExtractedColor[] | null = null;
      if (artifact.metadata?.screenshots && artifact.metadata.screenshots.length > 0) {
        try {
          console.log(`[ExtractionWorker] Extracting colors from screenshot...`);
          const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
          const colorResponse = await fetch(`${pythonServiceUrl}/extract-colors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              screenshot_url: artifact.metadata.screenshots[0],
              num_colors: 5
            }),
          });
          
          if (colorResponse.ok) {
            const colorData = await colorResponse.json();
            // Python service returns array of {hex, rgb, proportion} objects
            extractedColors = (colorData.colors || []) as ExtractedColor[];
            console.log(`[ExtractionWorker] Extracted ${extractedColors.length} colors from screenshot`);
          }
        } catch (colorError) {
          console.warn(`[ExtractionWorker] Color extraction failed (non-fatal):`, colorError);
          // Continue - color extraction failure shouldn't block the extraction
        }
      }
      
      // Update artifact with insights reference and status
      const updateData: any = {
        status: 'extracted',
        insightsRef,
        processedAt: new Date().toISOString(),
      };
      
      // Add extracted colors to metadata if available
      if (extractedColors && extractedColors.length > 0) {
        updateData['metadata.extractedColors'] = extractedColors;
        updateData['metadata.colorCount'] = extractedColors.length;
      }
      
      await adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .doc(artifactId)
        .update(updateData);
      
      console.log(`[ExtractionWorker] Successfully processed artifact ${artifactId} (confidence: ${insights.confidence}%)`);
      
      // Sync artifact to brand profile (adds to image/video/document galleries)
      try {
        const { syncArtifactToProfile } = await import('../sync-to-profile');
        const updatedArtifact = { ...artifact, status: 'extracted' as const, insightsRef, processedAt: new Date().toISOString() };
        await syncArtifactToProfile(updatedArtifact);
      } catch (syncError) {
        console.error(`[ExtractionWorker] Failed to sync artifact to profile (non-fatal):`, syncError);
        // Continue - sync failure shouldn't fail the whole extraction
      }
      
      return true;
      
    } catch (error) {
      console.error(`[ExtractionWorker] Error processing artifact ${artifactId}:`, error);
      
      // Update artifact status to failed
      const { adminDb } = getAdminInstances();
      await adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .doc(artifactId)
        .update({
          status: 'failed',
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
      
      return false;
    }
  }
  
  /**
   * Extract brand insights from content using Gemini AI
   */
  private async extractInsights(
    content: string,
    artifact: BrandArtifact,
    mediaUrl: string | null = null,
    isVideo: boolean = false
  ): Promise<ExtractedInsights> {
    
    let promptParts: any[] = [];

    const basePrompt = `You are a team intelligence analyst. Analyze the following content and extract key insights about the team's voice, facts, messaging, and visual identity.

CONTENT TYPE: ${artifact.type}
TITLE: ${artifact.metadata.title || 'N/A'}
DESCRIPTION: ${artifact.metadata.description || 'N/A'}
TAGS: ${(artifact.metadata.tags || []).join(', ')}

Extract as much information as possible. Be verbose and detailed. We want a comprehensive profile of the team.

Extract the following information in JSON format:

1. VOICE ELEMENTS (tone, style, personality, formality)
   - For each element, provide: aspect, value, evidence (text snippets or visual cues), confidence (0-100)
   
2. FACTS (key factual information about the team)
   - For each fact, provide: category (e.g., "product", "history", "mission"), fact, source, confidence
   
3. KEY MESSAGES (main themes and messaging)
   - For each message, provide: theme, message, emphasis, examples, confidence
   
4. VISUAL ELEMENTS (colors, design, imagery mentioned or seen)
   - For each element, provide: type (color/logo/imagery/typography), description, context, confidence
   - IF ANALYZING AN IMAGE: Describe the visual style, colors, objects, and overall aesthetic in detail.
   - IF ANALYZING A VIDEO: Analyze both the visual style and audio content (dialogue, music tone). Describe the narrative flow, visual style, and key messages conveyed.
   - IF ANALYZING YOUTUBE: Analyze the provided thumbnail image for visual style and the transcript for content. If the transcript is marked as not available, rely on the thumbnail, title, and description, and mention that the transcript was unavailable in the voice or facts section if relevant.

Return ONLY valid JSON with this exact structure:
{
  "voiceElements": [{"aspect": "tone|style|personality|formality", "value": "...", "evidence": ["..."], "confidence": 85}],
  "facts": [{"category": "...", "fact": "...", "source": "...", "confidence": 90}],
  "messages": [{"theme": "...", "message": "...", "emphasis": "high|medium|low", "examples": ["..."], "confidence": 88}],
  "visualElements": [{"type": "color|logo|imagery|typography", "description": "...", "context": "...", "confidence": 80}]
}`;

    if (mediaUrl) {
    // Multimodal prompt with image or video
      promptParts.push({ text: basePrompt });

      // Determine MIME type for media
      let mimeType = artifact.source.fileType || 'image/jpeg';
      if (isVideo && !mimeType.startsWith('video/')) {
        mimeType = 'video/mp4'; // Fallback
      } else if (!isVideo && !mimeType.startsWith('image/')) {
        mimeType = 'image/jpeg'; // Fallback
      }

      if (artifact.type === 'youtube-video') {
        // If we have a thumbnail, use it. Direct YouTube URL might not be supported by Genkit yet.
        if (mediaUrl) {
          promptParts.push({
            media: {
              url: mediaUrl,
              contentType: 'image/jpeg' // Thumbnail is an image
            }
          });
        }
      } else {
        promptParts.push({
          media: {
            url: mediaUrl,
            contentType: mimeType
          }
        });
      }
    } else {
      // Text-only prompt
      promptParts.push({ text: basePrompt + `\n\nCONTENT:\n${content.substring(0, 50000)} ${content.length > 50000 ? '... (truncated)' : ''}` });
    }

    try {
      console.log(`[ExtractionWorker] Sending prompt to Gemini. Parts: ${promptParts.length}`);

      let responseText = '';

      if (artifact.type === 'youtube-video' && artifact.source.url) {
        // Use direct REST API for YouTube to ensure compatibility with fileData
        console.log(`[ExtractionWorker] Using direct REST API for YouTube video`);
        const apiKey = process.env.MOMENTUM_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('API key missing');

        // Use the default text model from centralized settings
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_SETTINGS.textModel}:generateContent?key=${apiKey}`;

        const contents = [{
          parts: [
            { text: basePrompt },
            { file_data: { file_uri: artifact.source.url, mime_type: 'video/mp4' } }
          ]
        }];

        // Add transcript if available as text part
        if (content && !content.startsWith('NOTE:')) {
          contents[0].parts.push({ text: `Transcript: ${content}` });
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ExtractionWorker] REST API failed: ${response.status}`, errorText);
          throw new Error(`REST API failed: ${response.status}`);
        }

        const data = await response.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      } else {
        // Use Genkit for other types
        const response = await ai.generate({
          model: gemini20Flash,
          prompt: promptParts,
          config: {
            temperature: 0.1, // Low temperature for factual extraction
            maxOutputTokens: 4096,
          },
        });
        responseText = response.text || '';
      }
      
      console.log(`[ExtractionWorker] Received response from Gemini. Length: ${responseText.length}`);
      
      // Parse JSON response
      let parsed: any;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                         responseText.match(/```\n?([\s\S]*?)\n?```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        parsed = JSON.parse(jsonText);
        console.log(`[ExtractionWorker] Successfully parsed JSON response`);
      } catch (parseError) {
        console.error('[ExtractionWorker] Failed to parse AI response as JSON:', responseText.substring(0, 200));
        console.log('[ExtractionWorker] Raw response:', responseText);
        throw new Error('AI returned invalid JSON format');
      }
      
      // Validate and structure insights
      const insights: ExtractedInsights = {
        voiceElements: this.validateVoiceElements(parsed.voiceElements || []),
        facts: this.validateFacts(parsed.facts || []),
        messages: this.validateMessages(parsed.messages || []),
        visualElements: this.validateVisualElements(parsed.visualElements || []),
        raw: responseText,
        extractedAt: new Date().toISOString(),
        model: DEFAULT_SETTINGS.textModel,
        confidence: this.calculateOverallConfidence(parsed),
      };
      
      return insights;
      
    } catch (error) {
      console.error('[ExtractionWorker] AI extraction failed:', error);
      
      // Return minimal insights on error
      return {
        voiceElements: [],
        facts: [],
        messages: [],
        visualElements: [],
        raw: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        extractedAt: new Date().toISOString(),
        model: DEFAULT_SETTINGS.textModel,
        confidence: 0,
      };
    }
  }
  
  /**
   * Validate and clean voice elements
   */
  private validateVoiceElements(elements: any[]): VoiceElement[] {
    return elements
      .filter(e => e.aspect && e.value)
      .map(e => ({
        aspect: e.aspect as 'tone' | 'style' | 'personality' | 'formality',
        value: String(e.value),
        evidence: Array.isArray(e.evidence) ? e.evidence.map(String) : [],
        confidence: Math.min(100, Math.max(0, Number(e.confidence) || 50)),
      }))
      .slice(0, 20); // Max 20 elements
  }
  
  /**
   * Validate and clean extracted facts
   */
  private validateFacts(facts: any[]): ExtractedFact[] {
    return facts
      .filter(f => f.category && f.fact)
      .map(f => ({
        category: String(f.category),
        fact: String(f.fact),
        source: String(f.source || 'artifact'),
        confidence: Math.min(100, Math.max(0, Number(f.confidence) || 50)),
        extractedFrom: Array.isArray(f.evidence) && f.evidence.length > 0 
          ? String(f.evidence[0]) 
          : String(f.fact).substring(0, 200),
      }))
      .slice(0, 50); // Max 50 facts
  }
  
  /**
   * Validate and clean key messages
   */
  private validateMessages(messages: any[]): KeyMessage[] {
    return messages
      .filter(m => m.theme && m.message)
      .map((m, idx) => ({
        theme: String(m.theme),
        message: String(m.message),
        frequency: Number(m.frequency) || 1,
        importance: m.emphasis === 'high' ? 8 
          : m.emphasis === 'low' ? 4 
          : Number(m.importance) || 6,
      }))
      .slice(0, 30); // Max 30 messages
  }
  
  /**
   * Validate and clean visual elements
   */
  private validateVisualElements(elements: any[]): VisualElement[] {
    return elements
      .filter(e => e.type && (e.value || e.description))
      .map(e => ({
        type: (e.type === 'color' || e.type === 'font' || e.type === 'style' || e.type === 'imagery') 
          ? e.type 
          : 'style',
        value: String(e.value || e.description),
        context: String(e.context || ''),
      }))
      .slice(0, 20); // Max 20 elements
  }
  
  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(parsed: any): number {
    const allConfidences: number[] = [];
    
    // Collect all confidence scores
    if (Array.isArray(parsed.voiceElements)) {
      allConfidences.push(...parsed.voiceElements.map((e: any) => Number(e.confidence) || 50));
    }
    if (Array.isArray(parsed.facts)) {
      allConfidences.push(...parsed.facts.map((f: any) => Number(f.confidence) || 50));
    }
    if (Array.isArray(parsed.messages)) {
      allConfidences.push(...parsed.messages.map((m: any) => Number(m.confidence) || 50));
    }
    if (Array.isArray(parsed.visualElements)) {
      allConfidences.push(...parsed.visualElements.map((v: any) => Number(v.confidence) || 50));
    }
    
    // Return average or default to 50
    if (allConfidences.length === 0) {
      return 50;
    }
    
    const avg = allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length;
    return Math.round(Math.min(100, Math.max(0, avg)));
  }
}

export const extractionWorker = new ExtractionWorker();
