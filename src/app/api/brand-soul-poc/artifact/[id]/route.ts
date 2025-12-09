// Brand Soul POC - Get Artifact API
// SECURITY: Added authentication and brand access check

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul-poc/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { GetArtifactResponse, BrandArtifactPOC, ExtractedInsightsPOC } from '@/lib/types/brand-soul-poc';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artifactId } = await params;
    
    // Verify user is authenticated
    const user = await getAuthenticatedUser();
    
    // Get artifact metadata from Firestore
    const { adminDb } = getAdminInstances();
    const artifactDoc = await adminDb.collection('brand_artifacts_poc').doc(artifactId).get();
    
    if (!artifactDoc.exists) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }
    
    const artifact = artifactDoc.data() as BrandArtifactPOC;
    
    // Verify user has access to the brand this artifact belongs to
    await requireBrandAccess(user.uid, artifact.brandId);
    
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
      const insightsJson = await brandSoulStorage.getContent(artifact.insightsRef.path);
      if (insightsJson) {
        response.insights = JSON.parse(insightsJson) as ExtractedInsightsPOC;
      }
    }
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('[Artifact API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
