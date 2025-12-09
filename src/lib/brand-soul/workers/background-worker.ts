// Brand Soul - Background Worker Polling System
// Processes pending jobs from the queue

import { jobQueue } from '@/lib/brand-soul/queue';
import { extractionWorker } from './extraction-worker';
import { synthesisWorker } from './synthesis-worker';

/**
 * Background worker for processing Brand Soul jobs
 * Polls the job queue and processes pending extraction jobs
 */
export class BackgroundWorker {
  private isRunning = false;
  private pollInterval = 5000; // 5 seconds
  private maxConcurrent = 3; // Max 3 jobs at once
  
  /**
   * Start the background worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[BackgroundWorker] Already running');
      return;
    }
    
    this.isRunning = true;
    console.log('[BackgroundWorker] Started');
    
    // Start polling loop
    this.poll();
  }
  
  /**
   * Stop the background worker
   */
  stop(): void {
    this.isRunning = false;
    console.log('[BackgroundWorker] Stopped');
  }
  
  /**
   * Poll for pending jobs and process them
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('[BackgroundWorker] Error in poll loop:', error);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }
  
  /**
   * Process pending jobs from the queue
   */
  private async processJobs(): Promise<void> {
    // Get pending jobs
    const pendingJobs = await jobQueue.getPendingJobs(undefined, this.maxConcurrent);
    
    if (pendingJobs.length === 0) {
      return; // No jobs to process
    }
    
    console.log(`[BackgroundWorker] Processing ${pendingJobs.length} pending job(s)...`);
    
    // Process jobs in parallel (up to maxConcurrent)
    const promises = pendingJobs.map(job => this.processJob(job.id, job.brandId, job.artifactId, job.type, job.data));
    await Promise.allSettled(promises);
  }
  
  /**
   * Process a single job
   */
  private async processJob(
    jobId: string,
    brandId: string,
    artifactId: string,
    type: 'extract-insights' | 'synthesize' | 'embed',
    data?: Record<string, any>
  ): Promise<void> {
    try {
      console.log(`[BackgroundWorker] Processing job ${jobId} (${type})...`);
      
      // Update job status to processing
      await jobQueue.updateJob(jobId, {
        status: 'processing',
        progress: 0,
      });
      
      // Execute job based on type
      let success = false;
      
      if (type === 'extract-insights') {
        // Run AI extraction
        await jobQueue.updateJob(jobId, {
          progress: 25,
          currentStep: 'Loading artifact content',
        });
        
        success = await extractionWorker.processArtifact(artifactId, brandId);
        
        await jobQueue.updateJob(jobId, {
          progress: 100,
          currentStep: 'Extraction complete',
        });
        
      } else if (type === 'synthesize') {
        await jobQueue.updateJob(jobId, {
          progress: 25,
          currentStep: 'Loading extracted insights',
        });
        
        const forceRebuild = data?.forceRebuild === true;
        const versionId = await synthesisWorker.synthesizeBrandSoul(brandId, forceRebuild);
        success = !!versionId;
        
        await jobQueue.updateJob(jobId, {
          progress: 100,
          currentStep: 'Synthesis complete',
        });
        
      } else if (type === 'embed') {
        // TODO: Run embedding (future phase)
        console.log('[BackgroundWorker] Embedding not yet implemented');
        success = false;
      }
      
      // Update job status based on result
      if (success) {
        await jobQueue.updateJob(jobId, {
          status: 'approved', // Mark as completed
        });
        console.log(`[BackgroundWorker] Job ${jobId} completed successfully`);
      } else {
        // Use failJob to handle retries
        await jobQueue.failJob(jobId, 'Processing failed');
        console.error(`[BackgroundWorker] Job ${jobId} failed`);
      }
      
    } catch (error) {
      console.error(`[BackgroundWorker] Error processing job ${jobId}:`, error);
      
      // Mark job as failed with retry
      await jobQueue.failJob(
        jobId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
  
  /**
   * Process a specific job by ID (for manual triggering)
   */
  async processJobById(jobId: string): Promise<boolean> {
    const job = await jobQueue.getJob(jobId);
    if (!job) {
      console.error(`[BackgroundWorker] Job ${jobId} not found`);
      return false;
    }
    
    if (job.status !== 'pending') {
      console.error(`[BackgroundWorker] Job ${jobId} is not pending (status: ${job.status})`);
      return false;
    }
    
    await this.processJob(job.id, job.brandId, job.artifactId, job.type, job.data);
    return true;
  }
}

// Export singleton instance
export const backgroundWorker = new BackgroundWorker();
