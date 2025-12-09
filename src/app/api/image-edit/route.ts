/**
 * Unified Image Editing API (Nano Banana)
 *
 * This endpoint provides a single, unified interface for AI image editing
 * used by all flows: Agent, AI Models tab, Team Tools, and Image Gallery.
 *
 * Features:
 * - Multi-image composition/fusion
 * - Mask-based selective editing
 * - Brand Soul visual guidelines integration
 * - Firebase Storage URL handling
 * - Consistent response format
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

export interface ImageEditRequest {
  // Required
  prompt: string;

  // Primary image to edit (URL or base64 data URI)
  imageUrl?: string;

  // Additional images for composition/fusion (array of URLs or base64)
  referenceImages?: string[];

  // Mask image for selective editing (URL or base64)
  maskUrl?: string;

  // Brand ID for Brand Soul visual guidelines
  brandId?: string;

  // Full nano_banana parameter support
  mode?: 'edit' | 'compose';  // Edit mode
  aspectRatio?: string;  // "1:1", "16:9", etc.
  numberOfImages?: number;  // 1-4
  personGeneration?: string;  // "allow_all", "allow_adult"
}

export interface ImageEditResponse {
  success: boolean;
  imageUrl?: string;
  imageData?: string;  // Base64 fallback
  format: 'url' | 'base64';
  prompt: string;
  message: string;
  error?: string;
  metadata?: {
    referenceCount: number;
    hasMask: boolean;
    brandId?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ImageEditResponse>> {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        format: 'url',
        prompt: '',
        message: 'Unauthorized',
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body: ImageEditRequest = await request.json();
    const { prompt, imageUrl, referenceImages, maskUrl, brandId, mode, aspectRatio, numberOfImages, personGeneration } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json({
        success: false,
        format: 'url',
        prompt: '',
        message: 'Prompt is required',
        error: 'Missing prompt'
      }, { status: 400 });
    }

    // Verify brand access if brandId provided
    if (brandId) {
      await requireBrandAccess(user.uid, brandId);
    }

    // Convert referenceImages array to comma-separated string for Python service
    const referenceImagesStr = referenceImages?.filter(Boolean).join(',') || '';

    console.log('[Image Edit API] Processing request:', {
      prompt: prompt.substring(0, 50) + '...',
      hasImage: !!imageUrl,
      referenceCount: referenceImages?.length || 0,
      hasMask: !!maskUrl,
      brandId
    });

    // Call Python service with full nano_banana parameter support
    const response = await fetch(`${PYTHON_SERVICE_URL}/agent/nano-banana`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_url: imageUrl || '',
        reference_images: referenceImagesStr,
        mask_url: maskUrl || '',
        mode: mode || '',
        aspect_ratio: aspectRatio || '1:1',
        number_of_images: numberOfImages || 1,
        person_generation: personGeneration || '',
        brand_id: brandId || '',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Image Edit API] Python service error:', response.status, errorText);
      return NextResponse.json({
        success: false,
        format: 'url',
        prompt,
        message: 'Image editing failed',
        error: `Service error: ${response.status} - ${errorText}`
      }, { status: response.status });
    }

    const data = await response.json();

    if (data.status === 'success') {
      // Handle unified camelCase response format from /agent/nano-banana
      const imageUrl = data.imageUrl || data.image_url;
      const imageData = data.imageData || data.image_data;
      const imageUrls = data.imageUrls || data.image_urls || [];

      return NextResponse.json({
        success: true,
        imageUrl: imageUrl,
        imageUrls: imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []),
        imageData: imageData,
        format: data.format || 'url',
        prompt,
        message: data.message || 'Image edited successfully',
        metadata: {
          referenceCount: referenceImages?.length || 0,
          hasMask: !!maskUrl,
          brandId,
          skippedReferences: data.skippedReferences || data.skipped_references,
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        format: 'url',
        prompt,
        message: 'Image editing failed',
        error: data.error || 'Unknown error'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('[Image Edit API] Error:', error);
    return NextResponse.json({
      success: false,
      format: 'url',
      prompt: '',
      message: 'Image editing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
