/**
 * Generation Job Tracking Service
 *
 * Tracks long-running generation operations (images, videos) so users
 * don't lose visibility into status after page refresh or navigation.
 *
 * Architecture:
 * - Jobs are stored in Firestore `generationJobs` collection
 * - Client stores active job IDs in localStorage for quick restoration
 * - Polling mechanism checks job status and updates notifications
 */

import { getAdminInstances } from '@/lib/firebase/admin';

export type GenerationJobType = 'image' | 'video' | 'bulk-text' | 'bulk-image' | 'synthesis' | 'media-reindex';

export type GenerationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  brandId: string;
  userId: string;
  type: GenerationJobType;
  status: GenerationJobStatus;
  title: string;
  description?: string;
  progress?: number;
  errorMessage?: string;
  // For completed jobs
  resultId?: string;
  resultUrl?: string;
  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Server-side Generation Job Queue
 * Uses Firestore Admin SDK for persistence
 */
export class GenerationJobQueue {
  private readonly collectionName = 'generationJobs';

  /**
   * Create a new generation job
   */
  async createJob(
    brandId: string,
    userId: string,
    type: GenerationJobType,
    title: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const jobId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Build job object with only defined values
    const job: any = {
      id: jobId,
      brandId,
      userId,
      type,
      status: 'processing',
      title,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };
    
    if (description !== undefined) {
      job.description = description;
    }
    
    if (metadata !== undefined) {
      job.metadata = metadata;
    }

    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).set(job);

    console.log(`[GenerationQueue] Created ${type} job ${jobId}: "${title}"`);
    return jobId;
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: number): Promise<void> {
    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).update({
      progress,
    });
  }

  /**
   * Complete a job successfully
   */
  async completeJob(
    jobId: string,
    resultId?: string,
    resultUrl?: string
  ): Promise<void> {
    const { adminDb } = getAdminInstances();
    
    // Build update object with only defined values
    const updateData: any = {
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
    };
    
    if (resultId !== undefined) {
      updateData.resultId = resultId;
    }
    
    if (resultUrl !== undefined) {
      updateData.resultUrl = resultUrl;
    }
    
    await adminDb.collection(this.collectionName).doc(jobId).update(updateData);

    console.log(`[GenerationQueue] Completed job ${jobId}`);
  }

  /**
   * Fail a job with an error
   */
  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const { adminDb } = getAdminInstances();
    await adminDb.collection(this.collectionName).doc(jobId).update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage,
    });

    console.error(`[GenerationQueue] Failed job ${jobId}: ${errorMessage}`);
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<GenerationJob | null> {
    const { adminDb } = getAdminInstances();
    const jobDoc = await adminDb.collection(this.collectionName).doc(jobId).get();

    if (!jobDoc.exists) {
      return null;
    }

    return jobDoc.data() as GenerationJob;
  }

  /**
   * Get active jobs for a user (pending or processing)
   */
  async getActiveJobsForUser(
    brandId: string,
    userId: string,
    limit: number = 20
  ): Promise<GenerationJob[]> {
    const { adminDb } = getAdminInstances();

    // Remove orderBy to avoid index requirement, sort in memory instead
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('brandId', '==', brandId)
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'processing'])
      .limit(limit * 2) // Get more to allow for sorting
      .get();

    // Sort by createdAt in memory (handle both string and Timestamp)
    const jobs = snapshot.docs
      .map((doc: any) => doc.data() as GenerationJob)
      .sort((a: any, b: any) => {
        const timeA = typeof a.createdAt === 'string' 
          ? new Date(a.createdAt).getTime() 
          : a.createdAt?.toMillis?.() || 0;
        const timeB = typeof b.createdAt === 'string' 
          ? new Date(b.createdAt).getTime() 
          : b.createdAt?.toMillis?.() || 0;
        return timeB - timeA; // Descending order
      })
      .slice(0, limit);

    return jobs;
  }

  /**
   * Get recently completed jobs for a user
   * Useful for showing results after page refresh
   */
  async getRecentJobsForUser(
    brandId: string,
    userId: string,
    limit: number = 10,
    maxAgeMinutes: number = 30
  ): Promise<GenerationJob[]> {
    const { adminDb } = getAdminInstances();
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

    // Remove orderBy to avoid index requirement, sort in memory instead
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('brandId', '==', brandId)
      .where('userId', '==', userId)
      .where('completedAt', '>=', cutoffTime)
      .limit(limit * 2) // Get more to allow for sorting
      .get();

    // Sort by completedAt in memory (handle both string and Timestamp)
    const jobs = snapshot.docs
      .map((doc: any) => doc.data() as GenerationJob)
      .sort((a: any, b: any) => {
        const timeA = typeof a.completedAt === 'string' 
          ? new Date(a.completedAt).getTime() 
          : a.completedAt?.toMillis?.() || 0;
        const timeB = typeof b.completedAt === 'string' 
          ? new Date(b.completedAt).getTime() 
          : b.completedAt?.toMillis?.() || 0;
        return timeB - timeA; // Descending order
      })
      .slice(0, limit);

    return jobs;
  }

  /**
   * Delete old jobs (cleanup)
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { adminDb } = getAdminInstances();
    const snapshot = await adminDb
      .collection(this.collectionName)
      .where('createdAt', '<', cutoffDate.toISOString())
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    if (snapshot.size > 0) {
      console.log(`[GenerationQueue] Cleaned up ${snapshot.size} old jobs`);
    }
    return snapshot.size;
  }
}

export const generationJobQueue = new GenerationJobQueue();
