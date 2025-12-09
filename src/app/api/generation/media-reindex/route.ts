/**
 * Media Reindex Job API
 *
 * POST /api/generation/media-reindex - Start a media reindexing job
 * Creates a job entry for tracking and triggers the Python backend reindex
 */

import { NextRequest, NextResponse } from 'next/server';
import { generationJobQueue } from '@/lib/generation/tracking';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

interface ReindexRequest {
  brandId: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getAuthenticatedUser();

    const body: ReindexRequest = await request.json();
    const { brandId, force = false } = body;

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

    // Check if there's already an active reindex job for this brand
    const activeJobs = await generationJobQueue.getActiveJobsForUser(brandId, user.uid, 50);
    const existingReindexJob = activeJobs.find(job => job.type === 'media-reindex');

    if (existingReindexJob) {
      return NextResponse.json(
        {
          success: false,
          message: 'A media reindexing operation is already in progress for this brand',
          jobId: existingReindexJob.id
        },
        { status: 409 }
      );
    }

    // Create a new job entry
    const jobId = await generationJobQueue.createJob(
      brandId,
      user.uid,
      'media-reindex',
      force ? 'Force Reindexing Media' : 'Reindexing Media',
      'Updating search index for all media items',
      {
        force,
        startedByUser: user.uid,
        userEmail: user.email || 'unknown@user.com'
      }
    );

    // Start the reindex process in the background
    // We don't await this to return immediately to the user
    triggerReindexProcess(brandId, jobId, force).catch(error => {
      console.error(`[Media Reindex] Background reindex failed for job ${jobId}:`, error);
      // Update job status to failed
      generationJobQueue.failJob(jobId, error.message).catch(console.error);
    });

    return NextResponse.json({
      success: true,
      message: 'Media reindexing started',
      jobId: jobId,
    });

  } catch (error) {
    console.error('[Media Reindex API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Trigger the actual reindex process with the Python backend
 */
async function triggerReindexProcess(brandId: string, jobId: string, force: boolean) {
  try {
    // Call the Python backend with job ID for progress tracking
    const API_BASE = process.env.NEXT_PUBLIC_PYTHON_API_BASE || 'http://127.0.0.1:8000';
    const response = await fetch(`${API_BASE}/search-settings/${brandId}/reindex?force=${force}&job_id=${jobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend reindex failed: ${errorText}`);
    }

    const result = await response.json();
    
    // Job completion is now handled by the Python backend
    // No need to update job status here

  } catch (error) {
    console.error(`[Media Reindex] Process failed for job ${jobId}:`, error);
    
    // Only mark job as failed if the backend didn't already handle it
    // (in case the error occurred before the backend could update the job)
    try {
      await generationJobQueue.failJob(
        jobId, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch (updateError) {
      // If job update fails, it might already be updated by the backend
      console.warn(`[Media Reindex] Could not update job status for ${jobId}:`, updateError);
    }
    
    throw error;
  }
}