// Brand Soul - Get Artifact API (Production)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { GetArtifactResponse, BrandArtifact } from '@/lib/types/brand-soul';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artifactId } = await params;
    
    // Get artifact metadata from Firestore
    // We need to query across all brands (or get brandId from query params)
    const brandId = request.nextUrl.searchParams.get('brandId');
    
    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId query parameter required' },
        { status: 400 }
      );
    }
    
    // Verify user is authenticated and has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);
    
    const { adminDb } = getAdminInstances();
    const artifactDoc = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .get();
    
    if (!artifactDoc.exists) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }
    
    const artifact = artifactDoc.data() as BrandArtifact;
    
    // Optionally load content and insights from storage
    const includeContent = request.nextUrl.searchParams.get('includeContent') === 'true';
    const includeInsights = request.nextUrl.searchParams.get('includeInsights') === 'true';
    
    const response: GetArtifactResponse = {
      artifact,
    };
    
    if (includeContent && artifact.contentRef) {
      const content = await brandSoulStorage.getContent(artifact.contentRef.path);
      if (content) {
        response.content = content;
      }
    }
    
    if (includeInsights && artifact.insightsRef) {
      const insights = await brandSoulStorage.getInsights(artifact.insightsRef.path);
      if (insights) {
        response.insights = insights;
      }
    }
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('[Brand Soul Artifact] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
