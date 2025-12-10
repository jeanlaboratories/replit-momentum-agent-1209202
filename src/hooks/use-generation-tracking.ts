'use client';

/**
 * Generation Tracking Hook
 *
 * Client-side hook for tracking long-running generation operations.
 * Restores notification state after page refresh or navigation.
 *
 * Features:
 * - Polls for active generation jobs on mount
 * - Restores loading notifications for in-progress jobs
 * - Shows completion/failure notifications for recently finished jobs
 * - Stores tracked job IDs in localStorage to avoid duplicate notifications
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { notification, type NotificationAPI } from '@/hooks/use-notification';
import { useJobQueue } from '@/contexts/job-queue-context';

interface GenerationJob {
  id: string;
  brandId: string;
  userId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  title: string;
  description?: string;
  progress?: number;
  errorMessage?: string;
  resultId?: string;
  resultUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'momentum_generation_tracked_jobs';
const COMPLETED_JOBS_KEY = 'momentum_completed_generation_jobs';
const POLL_INTERVAL = 2000; // 2 seconds for more responsive progress tracking

/**
 * Get tracked job IDs from localStorage
 */
function getTrackedJobIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Clean up old entries (older than 30 minutes)
      const cutoff = Date.now() - 30 * 60 * 1000;
      const valid = Object.entries(data).filter(
        ([, timestamp]) => (timestamp as number) > cutoff
      );
      return new Set(valid.map(([id]) => id));
    }
  } catch (e) {
    console.error('Error reading tracked jobs from localStorage:', e);
  }
  return new Set();
}

/**
 * Add a job ID to tracked jobs in localStorage
 */
function trackJob(jobId: string) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[jobId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error writing tracked job to localStorage:', e);
  }
}

/**
 * Remove a job ID from tracked jobs
 */
function untrackJob(jobId: string) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      delete data[jobId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error('Error removing tracked job from localStorage:', e);
  }
}

/**
 * Get completed job IDs from localStorage
 */
function getCompletedJobIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(COMPLETED_JOBS_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Clean up old entries (older than 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const valid = Object.entries(data).filter(
        ([, timestamp]) => (timestamp as number) > cutoff
      );
      return new Set(valid.map(([id]) => id));
    }
  } catch (e) {
    console.error('Error reading completed jobs from localStorage:', e);
  }
  return new Set();
}

/**
 * Mark a job as completed in localStorage
 */
function markJobCompleted(jobId: string) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(COMPLETED_JOBS_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[jobId] = Date.now();
    localStorage.setItem(COMPLETED_JOBS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error marking job as completed in localStorage:', e);
  }
}

/**
 * Get human-readable job type label
 */
function getJobTypeLabel(type: string): string {
  switch (type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'music':
      return 'Music';
    case 'bulk-text':
      return 'Text Content';
    case 'bulk-image':
      return 'Images';
    case 'synthesis':
      return 'Team Intelligence';
    case 'media-reindex':
      return 'Media Reindexing';
    default:
      return 'Content';
  }
}

/**
 * Hook for tracking generation jobs and restoring notifications
 */
export function useGenerationTracking() {
  const { brandId, user } = useAuth();
  const { addJob, updateJob, removeJob, state: queueState } = useJobQueue();
  const activeNotifications = useRef<Map<string, NotificationAPI>>(new Map());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedCompletedJobs = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);
  const syncedJobs = useRef<Set<string>>(new Set()); // Track which jobs we've synced to job queue

  /**
   * Convert GenerationJob to Job for the queue panel
   */
  const convertToQueueJob = useCallback((genJob: GenerationJob) => {
    let jobType: any = 'media-reindex'; // Default fallback

    // Map generation job types to queue job types
    switch (genJob.type) {
      case 'image':
        jobType = 'image-generation';
        break;
      case 'video':
        jobType = 'video-generation';
        break;
      case 'music':
        jobType = 'music-generation';
        break;
      case 'media-reindex':
        jobType = 'media-reindex';
        break;
      case 'bulk-text':
        jobType = 'bulk-content';
        break;
      case 'bulk-image':
        jobType = 'bulk-content';
        break;
      case 'synthesis':
        jobType = 'brand-soul-synthesis';
        break;
      default:
        jobType = 'artifact-processing';
    }

    // Map generation job status to queue status
    let queueStatus: any = 'running';
    switch (genJob.status) {
      case 'pending':
        queueStatus = 'queued';
        break;
      case 'processing':
        queueStatus = 'running';
        break;
      case 'completed':
        queueStatus = 'completed';
        break;
      case 'failed':
        queueStatus = 'failed';
        break;
    }

    return {
      id: genJob.id,
      type: jobType,
      title: genJob.title,
      description: genJob.description,
      status: queueStatus,
      progress: genJob.progress || 0,
      createdAt: new Date(genJob.createdAt).getTime(),
      startedAt: genJob.startedAt ? new Date(genJob.startedAt).getTime() : undefined,
      completedAt: genJob.completedAt ? new Date(genJob.completedAt).getTime() : undefined,
      error: genJob.errorMessage,
      resultUrl: genJob.resultUrl,
      resultId: genJob.resultId,
      metadata: genJob.metadata,
    };
  }, []);

  /**
   * Sync generation jobs to job queue panel
   */
  const syncJobsToQueue = useCallback((jobs: GenerationJob[]) => {
    const completedJobIds = getCompletedJobIds();
    
    jobs.forEach((genJob) => {
      const queueJob = convertToQueueJob(genJob);
      
      // Check if job already exists in the queue (prevents duplicates on refresh)
      const existsInQueue = queueState.jobs.some(job => job.id === genJob.id);
      
      if (existsInQueue) {
        // FORCE completion update for completed jobs - this ensures Job Queue UI shows 100%
        if (genJob.status === 'completed') {
          updateJob(genJob.id, {
            status: 'completed',
            progress: 100,
            completedAt: queueJob.completedAt,
            resultUrl: queueJob.resultUrl,
            title: queueJob.title,
            description: queueJob.description,
          });
          markJobCompleted(genJob.id);
        } else {
          // Regular update for non-completed jobs
          updateJob(genJob.id, {
            status: queueJob.status,
            progress: queueJob.progress,
            completedAt: queueJob.completedAt,
            error: queueJob.error,
            resultUrl: queueJob.resultUrl,
            title: queueJob.title,
            description: queueJob.description,
          });
          
          if (genJob.status === 'failed') {
            markJobCompleted(genJob.id);
          }
        }
        
        syncedJobs.current.add(genJob.id);
      } else if (!syncedJobs.current.has(genJob.id)) {
        // Skip jobs we've already processed as completed (only for NEW jobs)
        if (completedJobIds.has(genJob.id) && genJob.status === 'completed') {
          return;
        }
        
        // Add new jobs that are still active (not completed/failed)
        if (genJob.status === 'pending' || genJob.status === 'processing') {
          addJob(queueJob);
          syncedJobs.current.add(genJob.id);
        } else {
          markJobCompleted(genJob.id);
          syncedJobs.current.add(genJob.id);
        }
      }
    });
  }, [convertToQueueJob, addJob, updateJob]);

  /**
   * Fetch active jobs from the server
   */
  const fetchJobs = useCallback(async () => {
    if (!brandId || !user) return { activeJobs: [], recentJobs: [] };

    try {
      const response = await fetch(
        `/api/generation/jobs?brandId=${brandId}`
      );
      
      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        console.warn(`[GenerationTracking] Jobs API returned ${response.status}: ${response.statusText}`);
        return { activeJobs: [], recentJobs: [] };
      }
      
      // Check if response has JSON content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('[GenerationTracking] Jobs API did not return JSON');
        return { activeJobs: [], recentJobs: [] };
      }
      
      const data = await response.json();

      if (data.success) {
        return {
          activeJobs: data.activeJobs as GenerationJob[],
          recentJobs: data.recentJobs as GenerationJob[],
        };
      }
    } catch (error) {
      // Only log errors that aren't network errors (which are expected if the service is down)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // Network error - service might be down, silently fail
        console.debug('[GenerationTracking] Jobs API unavailable (network error)');
      } else {
        console.error('[GenerationTracking] Error fetching generation jobs:', error);
      }
    }

    return { activeJobs: [], recentJobs: [] };
  }, [brandId, user]);

  /**
   * Process active jobs - show loading notifications for in-progress jobs
   */
  const processActiveJobs = useCallback((jobs: GenerationJob[]) => {
    const currentJobIds = new Set(jobs.map((j) => j.id));
    const trackedJobs = getTrackedJobIds();

    // Remove notifications for jobs that are no longer active
    activeNotifications.current.forEach((api, jobId) => {
      if (!currentJobIds.has(jobId)) {
        api.dismiss();
        activeNotifications.current.delete(jobId);
      }
    });

    // Create notifications for new active jobs
    // Only create if we don't already have a notification AND we haven't tracked this job before
    // OR if the job was tracked but we don't have an active notification (page refresh scenario)
    jobs.forEach((job) => {
      const hasActiveNotification = activeNotifications.current.has(job.id);
      const wasTracked = trackedJobs.has(job.id);
      
      // Only create notification if:
      // 1. We don't have an active notification for this job
      // 2. AND either:
      //    a. The job was never tracked before (new job), OR
      //    b. The job was tracked but we're on initial mount (page refresh - restore notification)
      if (!hasActiveNotification && (!wasTracked || isInitialMount.current)) {
        const typeLabel = getJobTypeLabel(job.type);
        // Use job.description if available, otherwise fall back to job.title
        // But filter out falsy values to avoid displaying "0" or "undefined"
        const description = job.description || job.title || undefined;
        const api = notification.loading({
          title: `Generating ${typeLabel}...`,
          description: description ? String(description) : undefined,
        });
        activeNotifications.current.set(job.id, api);
        trackJob(job.id);
      }
    });
  }, []);

  /**
   * Process recently completed jobs - show success/error notifications
   * Only for jobs we haven't already notified about
   */
  const processRecentJobs = useCallback(
    (jobs: GenerationJob[], isInitial: boolean) => {
      const trackedJobs = getTrackedJobIds();
      
      // Deduplicate jobs by ID to prevent processing the same job multiple times
      const seenJobIds = new Set<string>();
      const uniqueJobs = jobs.filter((job) => {
        if (seenJobIds.has(job.id)) {
          return false; // Skip duplicate
        }
        seenJobIds.add(job.id);
        return true;
      });

      uniqueJobs.forEach((job) => {
        // Skip if we've already notified about this job
        if (notifiedCompletedJobs.current.has(job.id)) {
          return;
        }

        // Check completed jobs RIGHT NOW (not cached at start) to catch jobs marked in this loop
        const completedJobIds = getCompletedJobIds();
        if (completedJobIds.has(job.id)) {
          // Still mark as notified to prevent future processing
          notifiedCompletedJobs.current.add(job.id);
          return;
        }

        // Check if this job was being tracked (we had a notification for it)
        const wasTracked = trackedJobs.has(job.id);

        // Only show completion notifications for jobs that were tracked
        // or during initial mount (to catch jobs completed/failed during refresh)
        // For failed jobs, also check if they have a completedAt timestamp
        const shouldNotify = wasTracked || (isInitial && (job.completedAt || job.status === 'failed'));
        
        if (shouldNotify) {
          const typeLabel = getJobTypeLabel(job.type);

          // Check if we have an active notification for this job to update
          const existingApi = activeNotifications.current.get(job.id);

          if (job.status === 'completed') {
            // Mark as completed in localStorage FIRST to prevent duplicate notifications
            markJobCompleted(job.id);
            
            // IMMEDIATELY update Job Queue to 100% when showing success notification
            const queueJob = convertToQueueJob(job);
            updateJob(job.id, {
              status: 'completed',
              progress: 100,
              completedAt: queueJob.completedAt,
              resultUrl: queueJob.resultUrl,
              resultId: queueJob.resultId,
              title: queueJob.title,
              description: queueJob.description,
            });
            
            // Mark as notified BEFORE showing notification to prevent duplicates
            notifiedCompletedJobs.current.add(job.id);
            
            if (existingApi) {
              existingApi.update({
                type: 'success',
                title: `${typeLabel} Generated`,
                description: `"${job.title}" is ready`,
                duration: 5000,
              });
              activeNotifications.current.delete(job.id);
            } else if (wasTracked || isInitial) {
              // Show a new success notification (only if tracked or on initial mount)
              notification.success({
                title: `${typeLabel} Generated`,
                description: `"${job.title}" is ready`,
                duration: 5000,
              });
            }
            
            // Clean up tracking
            untrackJob(job.id);
            return; // Early return to prevent duplicate processing
          } else if (job.status === 'failed') {
            // Mark as completed in localStorage FIRST to prevent duplicate notifications
            markJobCompleted(job.id);
            
            // Update Job Queue to show failed status
            const queueJob = convertToQueueJob(job);
            updateJob(job.id, {
              status: 'failed',
              progress: 0,
              error: queueJob.error,
              title: queueJob.title,
              description: queueJob.description,
            });
            
            // Mark as notified BEFORE showing notification to prevent duplicates
            notifiedCompletedJobs.current.add(job.id);
            
            if (existingApi) {
              existingApi.update({
                type: 'error',
                title: `${typeLabel} Failed`,
                description: job.errorMessage || `Failed to generate "${job.title}"`,
                duration: 7000,
              });
              activeNotifications.current.delete(job.id);
            } else if (wasTracked || isInitial) {
              // Show a new error notification (only if tracked or on initial mount)
              notification.error({
                title: `${typeLabel} Failed`,
                description: job.errorMessage || `Failed to generate "${job.title}"`,
                duration: 7000,
              });
            }
            
            // Clean up tracking
            untrackJob(job.id);
            return; // Early return to prevent duplicate processing
          }

          // Mark as notified and clean up (for completed jobs)
          notifiedCompletedJobs.current.add(job.id);
          activeNotifications.current.delete(job.id);
          untrackJob(job.id);
        }
      });
    },
    [convertToQueueJob, updateJob]
  );

  /**
   * Poll for job updates
   */
  const pollJobs = useCallback(async () => {
    const { activeJobs, recentJobs } = await fetchJobs();

    // Filter out jobs that are in recentJobs from activeJobs to prevent duplicate processing
    const recentJobIds = new Set(recentJobs.map(j => j.id));
    const filteredActiveJobs = activeJobs.filter(job => !recentJobIds.has(job.id));

    // Sync all jobs to job queue panel
    syncJobsToQueue([...filteredActiveJobs, ...recentJobs]);

    // Process recent jobs first (completed/failed) to dismiss loading notifications
    processRecentJobs(recentJobs, isInitialMount.current);
    
    // Then process active jobs (to show loading notifications)
    // Only process jobs that aren't in recentJobs to avoid duplicates
    processActiveJobs(filteredActiveJobs);

    isInitialMount.current = false;
  }, [fetchJobs, processActiveJobs, processRecentJobs, syncJobsToQueue]);

  /**
   * Start polling for job updates
   */
  useEffect(() => {
    if (!brandId || !user) return;

    // Initial fetch
    pollJobs();

    // Set up polling
    pollIntervalRef.current = setInterval(pollJobs, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [brandId, user, pollJobs]);

  /**
   * Clean up notifications on unmount
   */
  useEffect(() => {
    return () => {
      // Don't dismiss notifications on unmount - they should persist
      // Just clear our reference
      activeNotifications.current.clear();
    };
  }, []);

  /**
   * Manually trigger a refresh of job status
   */
  const refreshJobs = useCallback(() => {
    pollJobs();
  }, [pollJobs]);

  return {
    refreshJobs,
  };
}

/**
 * Track a new generation job started from this client
 * Call this when starting a generation to ensure it's tracked for restoration
 */
export function trackGenerationJob(jobId: string) {
  trackJob(jobId);
}
