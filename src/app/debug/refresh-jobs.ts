'use server';

import { generationJobQueue } from '@/lib/generation/tracking';
import { getAuthenticatedUser } from '@/lib/secure-auth';

export async function refreshJobsAction(brandId: string) {
  try {
    const user = await getAuthenticatedUser();
    
    // Get fresh job data
    const recentJobs = await generationJobQueue.getRecentJobsForUser(
      brandId,
      user.uid,
      10,
      30 // Last 30 minutes
    );
    
    console.log(`[RefreshJobsAction] Found ${recentJobs.length} recent jobs for debugging:`);
    recentJobs.forEach(job => {
      console.log(`[RefreshJobsAction] Job ${job.id}: status=${job.status}, progress=${job.progress}%`);
    });
    
    return {
      success: true,
      jobs: recentJobs
    };
  } catch (error) {
    console.error('[RefreshJobsAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}