// Media Library - Save YouTube Video API
// Save YouTube videos from search results to the unified media library

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

/**
 * Extract YouTube video ID from various URL formats
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
    const { brandId, videoUrl, title, description, thumbnailUrl, channelTitle, videoId: providedVideoId } = body;
    
    // Validation
    if (!brandId || !videoUrl) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: brandId, videoUrl' 
        },
        { status: 400 }
      );
    }
    
    // Extract or use provided video ID
    const videoId = providedVideoId || extractYouTubeId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link' 
        },
        { status: 400 }
      );
    }
    
    // Get authenticated user and verify brand access
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);
    
    const { adminDb } = getAdminInstances();
    const now = new Date().toISOString();
    
    // Check if video already exists in media library
    const existingMedia = await adminDb
      .collection('unifiedMedia')
      .where('brandId', '==', brandId)
      .where('url', '==', videoUrl)
      .limit(1)
      .get();
    
    if (!existingMedia.empty) {
      const existing = existingMedia.docs[0].data();
      return NextResponse.json({
        success: true,
        mediaId: existing.id,
        message: 'YouTube video already exists in media library',
        alreadyExists: true,
      });
    }
    
    // Generate media ID
    const mediaId = adminDb.collection('unifiedMedia').doc().id;
    
    // Use provided thumbnail or generate default
    const finalThumbnailUrl = thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    // Create unified media document
    const unifiedMediaData: any = {
      id: mediaId,
      brandId,
      type: 'video',
      url: videoUrl,
      thumbnailUrl: finalThumbnailUrl,
      title: title || `YouTube Video: ${videoId}`,
      description: description || '',
      tags: ['youtube', 'external'],
      collections: [],
      source: 'youtube',
      createdAt: now,
      createdBy: authenticatedUser.uid,
      isPublished: false,
      metadata: {
        videoId,
        channelTitle: channelTitle || '',
        platform: 'youtube',
      },
    };
    
    // Also save to videos collection for consistency
    const videoData: any = {
      id: mediaId,
      brandId,
      videoUrl: videoUrl,
      title: title || `YouTube Video: ${videoId}`,
      description: description || '',
      uploadedBy: authenticatedUser.uid,
      uploadedAt: now,
      source: 'youtube',
      metadata: {
        videoId,
        channelTitle: channelTitle || '',
        thumbnailUrl: finalThumbnailUrl,
      },
    };
    
    // Save to both collections
    await adminDb.collection('unifiedMedia').doc(mediaId).set(unifiedMediaData);
    await adminDb.collection('videos').doc(mediaId).set(videoData);
    
    // Index to Vertex AI Search (async, non-blocking)
    const pythonServiceUrl = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
    fetch(`${pythonServiceUrl}/agent/media-index-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        media_item: unifiedMediaData,
      }),
    }).catch(err => console.warn('[Save YouTube] Failed to index to Vertex AI (non-fatal):', err.message));
    
    return NextResponse.json({
      success: true,
      mediaId,
      message: 'YouTube video saved to media library',
    });
    
  } catch (error: any) {
    console.error('[Save YouTube] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to save YouTube video' 
      },
      { status: 500 }
    );
  }
}

