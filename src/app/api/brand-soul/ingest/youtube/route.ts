// Brand Soul - YouTube Link Ingestion API (Production)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { 
  BrandArtifact, 
  IngestResponse,
} from '@/lib/types/brand-soul';
import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { brandId, url, title, description, tags } = body;
    
    // Validation
    if (!brandId || !url) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: brandId, url' 
        },
        { status: 400 }
      );
    }
    
    // Validate YouTube URL
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link' 
        },
        { status: 400 }
      );
    }
    
    console.log('[Brand Soul YouTube] Processing YouTube video:', { 
      brandId, 
      url,
      videoId
    });
    
    // Get authenticated user and verify brand access
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);
    const userId = authenticatedUser.uid;
    
    // Generate artifact ID
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Fetch transcript
    let transcriptText = '';
    let transcriptAvailable = false;
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      transcriptText = transcript.map(t => t.text).join(' ');
      transcriptAvailable = true;
      console.log(`[Brand Soul YouTube] Fetched transcript: ${transcriptText.length} characters`);
    } catch (error) {
      console.warn(`[Brand Soul YouTube] Failed to fetch transcript:`, error);
      transcriptText = 'Transcript not available for this video.';
      transcriptAvailable = false;
    }

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // Store YouTube URL as text content in Firebase Storage
    const youtubeMetadata = {
      url,
      videoId,
      platform: 'youtube',
      submittedAt: new Date().toISOString(),
      transcript: transcriptText,
      transcriptAvailable,
      thumbnailUrl,
    };
    
    const contentRef = await brandSoulStorage.storeContent(
      brandId,
      artifactId,
      JSON.stringify(youtubeMetadata, null, 2),
      'source'
    );
    
    // Parse tags
    const parsedTags = Array.isArray(tags) ? tags : 
                       typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : 
                       [];
    
    // Create artifact metadata in Firestore
    // New artifacts default to 'private' visibility - user must explicitly share to team
    const artifact: BrandArtifact = {
      id: artifactId,
      brandId,
      type: 'youtube-video',
      source: {
        url,
        uploadedAt: new Date().toISOString(),
      },
      status: 'pending',
      visibility: 'private',  // Default to private, user can share to team later
      metadata: {
        title: title || `YouTube Video: ${videoId}`,
        description: description || 'YouTube video for brand voice analysis',
        url,
        language: 'en', // Will be detected during extraction
        tags: parsedTags,
        customFields: {
          videoId,
          platform: 'youtube',
          thumbnailUrl,
        },
      },
      contentRef,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      retryCount: 0,
      priority: 5,
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .set(artifact);
    
    console.log('[Brand Soul YouTube] Artifact created:', artifactId);
    
    // Queue for AI extraction (will fetch transcript and analyze)
    const jobId = await jobQueue.createJob(brandId, artifactId, 'extract-insights');
    
    console.log('[Brand Soul YouTube] Queued for AI extraction');
    
    const response: IngestResponse = {
      success: true,
      artifactId,
      message: 'YouTube video queued for transcript extraction and analysis',
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[Brand Soul YouTube] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to process YouTube video' 
      },
      { status: 500 }
    );
  }
}
