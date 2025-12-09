// Brand Soul - Get Pending Jobs API
// Returns pending jobs for a specific brand with proper authorization

import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getAuthenticatedUser();
    
    // Get brandId from query params
    const brandId = request.nextUrl.searchParams.get('brandId');
    
    if (!brandId) {
      return NextResponse.json({
        success: false,
        message: 'brandId is required',
      }, { status: 400 });
    }
    
    // Verify user has access to this brand
    await requireBrandAccess(user.uid, brandId);
    
    // Get pending jobs for this brand
    const pendingJobs = await jobQueue.getPendingJobs(brandId, 50);
    
    return NextResponse.json({
      success: true,
      jobs: pendingJobs,
    });
    
  } catch (error) {
    console.error('[Pending Jobs API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
