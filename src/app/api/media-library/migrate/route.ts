import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import { migrateAllToUnifiedMedia } from '@/lib/media-library/migration';

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    const { brandId } = await request.json();

    if (!brandId) {
      return NextResponse.json(
        { success: false, error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    await requireBrandAccess(authenticatedUser.uid, brandId);

    const result = await migrateAllToUnifiedMedia(brandId);

    return NextResponse.json({
      success: true,
      migrated: result,
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}
