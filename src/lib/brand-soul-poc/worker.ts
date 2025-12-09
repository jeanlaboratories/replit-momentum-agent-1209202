// Brand Soul POC - Background Job Worker
// In production, this would run as a Cloud Run service triggered by Cloud Tasks

import { jobQueue } from './queue';
import { brandSoulStorage } from './storage';
import { aiExtractor } from './ai-extractor';
import { getAdminInstances } from '@/lib/firebase/admin';
import type { ProcessingJobPOC } from '@/lib/types/brand-soul-poc';

/**
 * Simple worker that processes jobs
 * For POC - runs synchronously in API route
 * For Production - would be triggered by Cloud Tasks
 */
class Worker {
  async processJob(job: ProcessingJobPOC): Promise<void> {
    try {
      // Update job to processing
      await jobQueue.updateJob(job.id, {
        status: 'processing',
        progress: 10,
        currentStep: 'Loading content',
      });
      
      // Get artifact to find content path
      const { adminDb } = getAdminInstances();
      const artifactDoc = await adminDb.collection('brand_artifacts_poc').doc(job.artifactId).get();
      
      if (!artifactDoc.exists) {
        throw new Error('Artifact not found');
      }
      
      const artifact = artifactDoc.data();
      if (!artifact || !artifact.contentRef) {
        throw new Error('Artifact data or contentRef missing');
      }
      
      // Load content from storage
      await jobQueue.updateJob(job.id, {
        progress: 30,
        currentStep: 'Loading content from storage',
      });
      
      const content = await brandSoulStorage.getContent(artifact.contentRef.path);
      
      if (!content) {
        throw new Error('Content not found in storage');
      }
      
      // Extract insights using AI
      await jobQueue.updateJob(job.id, {
        progress: 50,
        currentStep: 'Extracting insights with AI',
      });
      
      const insights = await aiExtractor.extractInsights(content, 'manual-text');
      
      // Store insights in storage
      await jobQueue.updateJob(job.id, {
        progress: 80,
        currentStep: 'Storing insights',
      });
      
      const insightsRef = await brandSoulStorage.storeContent(
        job.brandId,
        job.artifactId,
        JSON.stringify(insights, null, 2),
        'insights'
      );
      
      // Update artifact with insights reference
      await adminDb.collection('brand_artifacts_poc').doc(job.artifactId).update({
        status: 'completed',
        insightsRef,
        completedAt: new Date().toISOString(),
      });
      
      // Mark job as completed
      await jobQueue.updateJob(job.id, {
        status: 'completed',
        progress: 100,
        currentStep: 'Completed',
      });
      
      console.log(`[Worker] Job ${job.id} completed successfully`);
      
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error);
      
      // Mark job as failed
      await jobQueue.updateJob(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const worker = new Worker();
