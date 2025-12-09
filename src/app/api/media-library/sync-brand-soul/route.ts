// Media Library - Sync Brand Soul API
// Sync Brand Soul extracted images to unified media library

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { syncAllBrandSoulArtifacts, syncBrandSoulArtifactToMediaLibrary } from '@/lib/media-library/brand-soul-sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, artifactId } = body;

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Missing brandId' },
        { status: 400 }
      );
    }

    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    let result;
    
    if (artifactId) {
      result = await syncBrandSoulArtifactToMediaLibrary(
        brandId,
        artifactId,
        authenticatedUser.uid
      );
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `Synced ${result.mediaIds?.length || 0} images from artifact`,
          mediaIds: result.mediaIds,
        });
      } else {
        return NextResponse.json(
          { success: false, message: result.error },
          { status: 500 }
        );
      }
    } else {
      result = await syncAllBrandSoulArtifacts(brandId, authenticatedUser.uid);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: `Synced ${result.totalSynced || 0} total images`,
          totalSynced: result.totalSynced,
        });
      } else {
        return NextResponse.json(
          { success: false, message: result.error },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('[Sync Brand Soul] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
