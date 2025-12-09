// Brand Soul - Manual Worker Trigger API
// Allows manual triggering of job processing (for development and testing)

import { NextRequest, NextResponse } from 'next/server';
import { backgroundWorker } from '@/lib/brand-soul/workers/background-worker';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;
    
    // Verify user is authenticated
    const user = await getAuthenticatedUser();
    
    if (jobId) {
      // Get job details to verify brand access
      const job = await jobQueue.getJob(jobId);
      
      if (!job) {
        return NextResponse.json({
          success: false,
          message: 'Job not found',
        }, { status: 404 });
      }
      
      // Verify user has access to the brand this job belongs to
      await requireBrandAccess(user.uid, job.brandId);
      
      // Process specific job
      console.log(`[Worker API] Processing job ${jobId} for brand ${job.brandId}...`);
      const success = await backgroundWorker.processJobById(jobId);
      
      return NextResponse.json({
        success,
        message: success ? 'Job processed successfully' : 'Failed to process job',
      });
    } else {
      // Process all pending jobs - DISABLED for security
      // This would allow processing jobs across all brands without authorization
      return NextResponse.json({
        success: false,
        message: 'jobId is required. Bulk processing is disabled for security.',
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Worker API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Simple health check
  return NextResponse.json({
    status: 'ok',
    message: 'Brand Soul worker API is running',
  });
}
