// Brand Soul - Get Text Content API
// Fetches the text content of a manual-text artifact from storage

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import type { BrandArtifact } from '@/lib/types/brand-soul';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const artifactId = searchParams.get('artifactId');

    if (!brandId || !artifactId) {
      return NextResponse.json(
        { success: false, message: 'Brand ID and Artifact ID are required' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.brandId !== brandId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: No access to this brand' },
        { status: 403 }
      );
    }

    const artifactDoc = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .get();

    if (!artifactDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Artifact not found' },
        { status: 404 }
      );
    }

    const artifact = artifactDoc.data() as BrandArtifact;

    if (artifact.type !== 'manual-text') {
      return NextResponse.json(
        { success: false, message: 'Artifact is not a manual-text type' },
        { status: 400 }
      );
    }

    if (!artifact.contentRef) {
      return NextResponse.json(
        { success: false, message: 'No content reference found' },
        { status: 404 }
      );
    }

    const content = await brandSoulStorage.getContent(artifact.contentRef.path);
    
    return NextResponse.json({
      success: true,
      text: content,
    });

  } catch (error) {
    console.error('[Get Text API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
