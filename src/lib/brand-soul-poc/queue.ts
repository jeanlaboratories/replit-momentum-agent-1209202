// Brand Soul POC - Simple Job Queue using Firestore Admin SDK

import { getAdminInstances } from '@/lib/firebase/admin';
import type { ProcessingJobPOC, ProcessingStatus } from '@/lib/types/brand-soul-poc';

/**
 * Simple job queue implementation using Firestore Admin SDK
 * For POC - validates queue concept without external services
 */
export class JobQueue {
  private readonly collectionName = 'brand_soul_jobs_poc';
  
  /**
   * Create a new processing job
   */
  async createJob(
    brandId: string,
    artifactId: string,
    type: 'extract-insights'
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const job: ProcessingJobPOC = {
      id: jobId,
      brandId,
      artifactId,
      type,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).set(job);
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
      error?: string;
    }
  ): Promise<void> {
    const updateData: any = { ...updates };
    
    if (updates.status === 'processing' && updates.progress === undefined) {
      updateData.startedAt = new Date().toISOString();
    }
    
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completedAt = new Date().toISOString();
    }
    
    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).update(updateData);
  }
  
  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ProcessingJobPOC | null> {
    const { adminDb } = getAdminInstances();
    const jobDoc = await adminDb.collection(this.collectionName).doc(jobId).get();
    
    if (!jobDoc.exists) {
      return null;
    }
    
    return jobDoc.data() as ProcessingJobPOC;
  }
  
  /**
   * Get pending jobs (for worker polling)
   */
  async getPendingJobs(limit: number = 10): Promise<ProcessingJobPOC[]> {
    const { adminDb } = getAdminInstances();
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('status', '==', 'pending')
      .limit(limit)
      .get();
    
    return snapshot.docs.map((doc: any) => doc.data() as ProcessingJobPOC);
  }
}

export const jobQueue = new JobQueue();
