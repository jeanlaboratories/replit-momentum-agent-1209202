// Brand Soul - Get Artifacts API
// Returns all brand artifacts for a specific brand

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
        { success: false, message: 'Brand ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const artifactsSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const artifacts = artifactsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    })) as BrandArtifact[];

    return NextResponse.json({
      success: true,
      artifacts,
      count: artifacts.length,
    });

  } catch (error) {
    console.error('[Artifacts API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
