// Brand Soul - Trigger Synthesis API
// Creates a synthesis job and triggers the worker to build Brand Soul

import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/brand-soul/queue';
import { backgroundWorker } from '@/lib/brand-soul/workers/background-worker';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandRole } from '@/lib/brand-membership';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const forceRebuild = searchParams.get('forceRebuild') === 'true';

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Brand ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and has MANAGER role (only managers can trigger synthesis)
    const user = await getAuthenticatedUser();
    await requireBrandRole(user.uid, brandId, 'MANAGER');

    console.log(`[Synthesis API] Creating synthesis job for brand ${brandId} by manager ${user.uid} (forceRebuild: ${forceRebuild})...`);

    // Create synthesis job
    const jobId = await jobQueue.createJob(
      brandId,
      'synthesis', // artifactId not needed for synthesis
      'synthesize',
      { forceRebuild } // Pass forceRebuild flag to the job
    );

    // Trigger worker to process the job immediately
    const success = await backgroundWorker.processJobById(jobId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Brand Soul synthesis started',
        jobId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to start synthesis. Check if you have extracted artifacts.',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Synthesis API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
