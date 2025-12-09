// Brand Soul - Get Extracted Images API
// Returns artifacts with extracted images for multimodal display

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { BrandArtifact } from '@/lib/types/brand-soul';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Missing brandId parameter' },
        { status: 400 }
      );
    }

    // Authentication & Authorization
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Get all artifacts (no index required)
    const artifactsSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .get();

    const artifactsWithImages = artifactsSnapshot.docs
      .map((doc: any) => doc.data() as BrandArtifact)
      .filter((artifact: BrandArtifact) => {
        // Only include extracted artifacts with images
        return artifact.status === 'extracted' &&
               artifact.metadata?.extractedImages && 
               Array.isArray(artifact.metadata.extractedImages) && 
               artifact.metadata.extractedImages.length > 0;
      })
      .sort((a: BrandArtifact, b: BrandArtifact) => {
        // Sort by createdAt descending (newest first)
        const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : (a.createdAt as any).toMillis?.() || 0;
        const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt as any).toMillis?.() || 0;
        return bTime - aTime;
      })
      .map((artifact: BrandArtifact) => ({
        id: artifact.id,
        type: artifact.type,
        title: artifact.metadata?.title || 'Untitled',
        sourceUrl: artifact.source?.url,
        extractedImages: artifact.metadata?.extractedImages || [],
        extractedColors: artifact.metadata?.extractedColors || [],
        createdAt: artifact.createdAt,
      }));

    return NextResponse.json({
      success: true,
      artifacts: artifactsWithImages,
    });

  } catch (error) {
    console.error('[Brand Soul Extracted Images] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
