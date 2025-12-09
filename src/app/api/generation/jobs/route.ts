/**
 * Generation Jobs API
 *
 * GET /api/generation/jobs - Get active generation jobs for the user
 * Returns both in-progress jobs and recently completed jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { generationJobQueue } from '@/lib/generation/tracking';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getAuthenticatedUser();

    // Get brandId from query params
    const brandId = request.nextUrl.searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        {
          success: false,
          message: 'brandId is required',
        },
        { status: 400 }
      );
    }

    // Verify user has access to this brand
    await requireBrandAccess(user.uid, brandId);

    // Get active jobs (pending/processing)
    const activeJobs = await generationJobQueue.getActiveJobsForUser(
      brandId,
      user.uid,
      20
    );

    // Get recently completed jobs (within last 5 minutes for fresh notifications)
    const recentJobs = await generationJobQueue.getRecentJobsForUser(
      brandId,
      user.uid,
      10,
      5 // Only last 5 minutes
    );

    return NextResponse.json({
      success: true,
      activeJobs,
      recentJobs,
    });
  } catch (error) {
    console.error('[Generation Jobs API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
