import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { getAdminInstances } from '@/lib/firebase/admin';

const PYTHON_BACKEND_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

/**
 * POST /api/music/generate
 * Generates music using Google's Lyria 2 model via Vertex AI
 * 
 * Body params:
 * - prompt: string (required) - Description of the music to generate
 * - negative_prompt?: string - What to exclude from the generated audio
 * - sample_count?: number - Number of audio samples to generate (default: 1)
 * - seed?: number - Seed for deterministic generation (cannot be used with sample_count)
 * - brandId: string (required) - Brand ID for saving the generated music
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await request.json();
    const { prompt, negative_prompt, sample_count, seed, brandId, model } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId is required' },
        { status: 400 }
      );
    }

    // Validate brand access
    await requireBrandAccess(user.uid, brandId);

    // Get project ID from environment
    const projectId = process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID not configured' },
        { status: 500 }
      );
    }

    // Call Python backend for music generation
    const response = await fetch(`${PYTHON_BACKEND_URL}/agent/music/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        negative_prompt: negative_prompt?.trim() || '',
        sample_count: sample_count || 1,
        seed: seed,
        project_id: projectId,
        brand_id: brandId,
        user_id: user.uid,
        model: model || 'lyria-002',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { error: errorData.error || errorData.detail || 'Failed to generate music' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /music/generate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

