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
    console.log('[GenerationJobsAPI] Incoming request:', request.nextUrl.searchParams.toString());
    
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
    let activeJobs = await generationJobQueue.getActiveJobsForUser(
      brandId,
      user.uid,
      20
    );

    // Auto-fail jobs that have been processing for too long (2 minutes for music)
    const now = Date.now();
    const maxProcessingTime = 2 * 60 * 1000; // 2 minutes (music usually takes ~30 seconds)
    const jobsToFail: string[] = [];
    
    for (const job of activeJobs) {
      const startedAt = typeof job.startedAt === 'string' 
        ? new Date(job.startedAt).getTime()
        : job.startedAt?.toMillis?.() || new Date(job.createdAt).getTime();
      
      const processingTime = now - startedAt;
      
      if (processingTime > maxProcessingTime) {
        jobsToFail.push(job.id);
        const timeoutMinutes = Math.round(processingTime / 60000);
        console.log(`[GenerationJobsAPI] Auto-failing stale job ${job.id} after ${timeoutMinutes} minutes`);
        // Mark as failed
        await generationJobQueue.failJob(
          job.id,
          `Job timed out after ${timeoutMinutes} minutes`
        );
      }
    }
    
    // Re-fetch active jobs after auto-failing stale ones
    if (jobsToFail.length > 0) {
      activeJobs = await generationJobQueue.getActiveJobsForUser(
        brandId,
        user.uid,
        20
      );
    }

    // Get recently completed jobs (within last 5 minutes for fresh notifications)
    const recentJobs = await generationJobQueue.getRecentJobsForUser(
      brandId,
      user.uid,
      10,
      5 // Only last 5 minutes
    );

    console.log(`[GenerationJobsAPI] Returning jobs for ${brandId}:`, {
      activeJobs: activeJobs.map(j => ({ id: j.id, status: j.status, progress: j.progress, type: j.type })),
      recentJobs: recentJobs.map(j => ({ id: j.id, status: j.status, progress: j.progress, type: j.type }))
    });

    // Add debugging for job sync issue
    if (recentJobs.length > 0) {
      console.log(`[GenerationJobsAPI] DEBUG: Recent job details for frontend sync:`, recentJobs[0]);
    }

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
