import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { getAdminInstances } from '@/lib/firebase/admin';
import { requireBrandAccess } from '@/lib/brand-membership';

/**
 * GET /api/agent-engine/team?brandId=xxx
 * Gets the team memory engine status for a brand.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ success: false, error: 'brandId is required.' }, { status: 400 });
    }

    // Verify user has access to the brand
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(brandId).get();

    if (!brandDoc.exists) {
      return NextResponse.json({ success: false, error: 'Brand not found.' }, { status: 404 });
    }

    const brandData = brandDoc.data();
    return NextResponse.json({
      success: true,
      teamAgentEngineId: brandData?.teamAgentEngineId || null,
      teamAgentEngineCreatedAt: brandData?.teamAgentEngineCreatedAt || null,
      teamAgentEngineCreatedBy: brandData?.teamAgentEngineCreatedBy || null,
    });
  } catch (error: any) {
    console.error('[API /agent-engine/team GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
