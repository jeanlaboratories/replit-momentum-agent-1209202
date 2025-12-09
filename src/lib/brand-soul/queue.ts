// Brand Soul - Production Job Queue using Firestore Admin SDK

import { getAdminInstances } from '@/lib/firebase/admin';
import type { ProcessingJob, ProcessingStatus } from '@/lib/types/brand-soul';

/**
 * Production job queue implementation using Firestore Admin SDK
 * Jobs are processed by background workers (in-process for now, Cloud Functions later)
 */
export class JobQueue {
  private readonly collectionName = 'brandSoulJobs';
  
  /**
   * Create a new processing job
   */
  async createJob(
    brandId: string,
    artifactId: string,
    type: 'extract-insights' | 'synthesize' | 'embed',
    data?: Record<string, any>
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const job: ProcessingJob = {
      id: jobId,
      brandId,
      artifactId,
      type,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      ...(data && { data }), // Only include data if it's defined
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).set(job);
    
    console.log(`[JobQueue] Created ${type} job ${jobId} for artifact ${artifactId}`);
    return jobId;
  }
  
  /**
   * Update job status and progress
   */
  async updateJob(
    jobId: string,
    updates: {
      status?: ProcessingStatus;
      progress?: number;
      currentStep?: string;
      lastError?: string;
      retryCount?: number;
    }
  ): Promise<void> {
    const updateData: any = { ...updates };
    
    // Add timestamps based on status
    if (updates.status === 'processing' && !updateData.startedAt) {
      updateData.startedAt = new Date().toISOString();
    }
    
    if (updates.status === 'approved' || updates.status === 'failed') {
      updateData.completedAt = new Date().toISOString();
    }
    
    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).update(updateData);
  }
  
  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ProcessingJob | null> {
    const { adminDb } = getAdminInstances();
    const jobDoc = await adminDb.collection(this.collectionName).doc(jobId).get();
    
    if (!jobDoc.exists) {
      return null;
    }
    
    return jobDoc.data() as ProcessingJob;
  }
  
  /**
   * Get pending jobs (for worker polling)
   */
  async getPendingJobs(brandId?: string, limit: number = 10): Promise<ProcessingJob[]> {
    const { adminDb } = getAdminInstances();
    
    // Get all pending jobs and sort in memory to avoid composite index requirement
    let query = adminDb
      .collection(this.collectionName)
      .where('status', '==', 'pending')
      .limit(limit * 2); // Get more to allow for filtering/sorting
    
    if (brandId) {
      query = query.where('brandId', '==', brandId) as any;
    }
    
    const snapshot = await query.get();
    const jobs = snapshot.docs.map((doc: any) => doc.data() as ProcessingJob);
    
    // Sort by createdAt in memory (handle both string and Timestamp)
    jobs.sort((a: ProcessingJob, b: ProcessingJob) => {
      const timeA = typeof a.createdAt === 'string' ? a.createdAt : a.createdAt.toDate().toISOString();
      const timeB = typeof b.createdAt === 'string' ? b.createdAt : b.createdAt.toDate().toISOString();
      return timeA.localeCompare(timeB);
    });
    
    return jobs.slice(0, limit);
  }
  
  /**
   * Get all jobs for a brand
   */
  async getJobsByBrand(brandId: string, limit: number = 50): Promise<ProcessingJob[]> {
    const { adminDb } = getAdminInstances();
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('brandId', '==', brandId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map((doc: any) => doc.data() as ProcessingJob);
  }
  
  /**
   * Get job by artifact ID
   */
  async getJobByArtifact(artifactId: string): Promise<ProcessingJob | null> {
    const { adminDb } = getAdminInstances();
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('artifactId', '==', artifactId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as ProcessingJob;
  }
  
  /**
   * Mark job as failed with retry logic
   */
  async failJob(jobId: string, error: string, maxRetries: number = 3): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) {
      return false;
    }
    
    const retryCount = job.retryCount + 1;
    
    if (retryCount < maxRetries) {
      // Retry: reset to pending
      await this.updateJob(jobId, {
        status: 'pending',
        lastError: error,
        retryCount,
        progress: 0,
      });
      
      console.log(`[JobQueue] Job ${jobId} failed, retrying (attempt ${retryCount}/${maxRetries})`);
      return true; // Will retry
    } else {
      // Max retries reached: mark as failed
      await this.updateJob(jobId, {
        status: 'failed',
        lastError: error,
        retryCount,
      });
      
      console.error(`[JobQueue] Job ${jobId} failed permanently after ${retryCount} attempts`);
      return false; // No more retries
    }
  }
  
  /**
   * Delete old completed/failed jobs (cleanup)
   */
  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { adminDb } = getAdminInstances();
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('status', 'in', ['approved', 'failed'])
      .where('completedAt', '<', cutoffDate.toISOString())
      .get();
    
    const batch = adminDb.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`[JobQueue] Cleaned up ${snapshot.size} old jobs`);
    return snapshot.size;
  }
}

export const jobQueue = new JobQueue();
