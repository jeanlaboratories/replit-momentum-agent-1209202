// Brand Soul POC - Get Job Status API
// SECURITY: Added authentication and brand access check

import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/brand-soul-poc/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    
    // Verify user is authenticated
    const user = await getAuthenticatedUser();
    
    const job = await jobQueue.getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Verify user has access to the brand this job belongs to
    await requireBrandAccess(user.uid, job.brandId);
    
    return NextResponse.json({ job }, { status: 200 });
    
  } catch (error) {
    console.error('[Job API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
