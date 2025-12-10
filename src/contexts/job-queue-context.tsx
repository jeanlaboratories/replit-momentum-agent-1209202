'use client';

/**
 * Job Queue Context
 *
 * A Meta/Instagram-style persistent job queue system that tracks all generation
 * operations across the platform. Jobs persist in localStorage to survive page
 * refreshes and provide a consistent experience.
 *
 * Features:
 * - Global job state accessible from anywhere
 * - localStorage persistence for cross-refresh tracking
 * - Real-time progress updates
 * - Job history with completion/failure status
 * - Expandable/collapsible job panel
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';

// Job types supported by the platform
export type JobType =
  | 'campaign-generation'
  | 'campaign-content'
  | 'image-generation'
  | 'image-editing'
  | 'video-generation'
  | 'music-generation'
  | 'brand-soul-synthesis'
  | 'bulk-content'
  | 'artifact-processing'
  | 'source-ingest-text'
  | 'source-ingest-website'
  | 'source-ingest-document'
  | 'source-ingest-image'
  | 'source-ingest-video'
  | 'source-ingest-youtube'
  | 'brand-text-generation'
  | 'event-deletion'
  | 'memory-commit-personal'
  | 'memory-commit-team'
  | 'memory-remove-personal'
  | 'memory-remove-team'
  | 'media-indexing'
  | 'media-reindex';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

// Stall detection threshold (2 minutes without progress update)
export const JOB_STALL_THRESHOLD = 2 * 60 * 1000;

export interface Job {
  id: string;
  type: JobType;
  title: string;
  description?: string;
  status: JobStatus;
  progress?: number; // 0-100
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastProgressUpdate?: number; // Track when progress was last updated
  error?: string;
  metadata?: Record<string, unknown>;
  // For linking to results
  resultUrl?: string;
  resultId?: string;
  // For retry functionality
  canRetry?: boolean;
  retryCount?: number;
}

interface JobQueueState {
  jobs: Job[];
  isExpanded: boolean;
  isPanelVisible: boolean;
}

type JobQueueAction =
  | { type: 'ADD_JOB'; job: Job }
  | { type: 'UPDATE_JOB'; id: string; updates: Partial<Job> }
  | { type: 'REMOVE_JOB'; id: string }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'CANCEL_JOB'; id: string }
  | { type: 'TOGGLE_EXPANDED' }
  | { type: 'SET_EXPANDED'; expanded: boolean }
  | { type: 'SET_PANEL_VISIBLE'; visible: boolean }
  | { type: 'HYDRATE'; state: Partial<JobQueueState> };

const STORAGE_KEY = 'momentum_job_queue';
const MAX_COMPLETED_JOBS = 10;
const COMPLETED_JOB_TTL = 30 * 60 * 1000; // 30 minutes

const initialState: JobQueueState = {
  jobs: [],
  isExpanded: false,
  isPanelVisible: true,
};

function jobQueueReducer(state: JobQueueState, action: JobQueueAction): JobQueueState {
  switch (action.type) {
    case 'ADD_JOB': {
      // Add new job at the beginning (most recent first)
      const newJobs = [action.job, ...state.jobs];
      return {
        ...state,
        jobs: newJobs,
        isExpanded: true, // Auto-expand when new job is added
      };
    }

    case 'UPDATE_JOB': {
      const updatedJobs = state.jobs.map((job) =>
        job.id === action.id ? { ...job, ...action.updates } : job
      );
      
      // Force immediate localStorage update for completion
      const updatedJob = updatedJobs.find(j => j.id === action.id);
      if (updatedJob && (action.updates.progress === 100 || action.updates.status === 'completed')) {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                jobs: updatedJobs,
                isExpanded: state.isExpanded,
                isPanelVisible: state.isPanelVisible,
              }));
            } catch (e) {
              // Silent error handling for localStorage issues
            }
          }
        }, 0);
      }
      
      return {
        ...state,
        jobs: updatedJobs,
      };
    }

    case 'REMOVE_JOB': {
      return {
        ...state,
        jobs: state.jobs.filter((job) => job.id !== action.id),
      };
    }

    case 'CLEAR_COMPLETED': {
      return {
        ...state,
        jobs: state.jobs.filter((job) => job.status === 'queued' || job.status === 'running'),
      };
    }

    case 'CANCEL_JOB': {
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === action.id
            ? { ...job, status: 'cancelled' as JobStatus, completedAt: Date.now(), error: 'Job cancelled by user' }
            : job
        ),
      };
    }

    case 'TOGGLE_EXPANDED': {
      return {
        ...state,
        isExpanded: !state.isExpanded,
      };
    }

    case 'SET_EXPANDED': {
      return {
        ...state,
        isExpanded: action.expanded,
      };
    }

    case 'SET_PANEL_VISIBLE': {
      return {
        ...state,
        isPanelVisible: action.visible,
      };
    }

    case 'HYDRATE': {
      return {
        ...state,
        ...action.state,
      };
    }

    default:
      return state;
  }
}

// Helper to get job type display info
export function getJobTypeInfo(type: JobType): { label: string; emoji: string; color: string } {
  switch (type) {
    case 'campaign-generation':
      return { label: 'Campaign', emoji: '📅', color: 'text-blue-500' };
    case 'campaign-content':
      return { label: 'Content', emoji: '✨', color: 'text-purple-500' };
    case 'image-generation':
      return { label: 'Image', emoji: '🖼️', color: 'text-green-500' };
    case 'image-editing':
      return { label: 'Image Edit', emoji: '✏️', color: 'text-orange-500' };
    case 'video-generation':
      return { label: 'Video', emoji: '🎬', color: 'text-pink-500' };
    case 'brand-soul-synthesis':
      return { label: 'Intelligence', emoji: '🧠', color: 'text-indigo-500' };
    case 'bulk-content':
      return { label: 'Bulk Content', emoji: '📦', color: 'text-teal-500' };
    case 'artifact-processing':
      return { label: 'Artifact', emoji: '📄', color: 'text-purple-500' };
    case 'source-ingest-text':
      return { label: 'Text Ingest', emoji: '📝', color: 'text-blue-500' };
    case 'source-ingest-website':
      return { label: 'Website Crawl', emoji: '🌐', color: 'text-cyan-500' };
    case 'source-ingest-document':
      return { label: 'Document', emoji: '📑', color: 'text-amber-500' };
    case 'source-ingest-image':
      return { label: 'Image Upload', emoji: '🖼️', color: 'text-green-500' };
    case 'source-ingest-video':
      return { label: 'Video Upload', emoji: '🎥', color: 'text-pink-500' };
    case 'source-ingest-youtube':
      return { label: 'YouTube', emoji: '▶️', color: 'text-red-500' };
    case 'brand-text-generation':
      return { label: 'Brand Text', emoji: '✍️', color: 'text-violet-500' };
    case 'event-deletion':
      return { label: 'Event Delete', emoji: '🗑️', color: 'text-red-500' };
    case 'memory-commit-personal':
      return { label: 'Save to Personal', emoji: '🧠', color: 'text-violet-500' };
    case 'memory-commit-team':
      return { label: 'Save to Team', emoji: '👥', color: 'text-blue-500' };
    case 'media-indexing':
      return { label: 'Index Search', emoji: '🔍', color: 'text-cyan-500' };
    case 'media-reindex':
      return { label: 'Reindex Media', emoji: '🔄', color: 'text-orange-500' };
    default:
      return { label: 'Job', emoji: '⚡', color: 'text-gray-500' };
  }
}

interface JobQueueContextValue {
  state: JobQueueState;
  // Job management
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'status'> & { status?: JobStatus }) => string;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  cancelJob: (id: string) => void;
  // Convenience methods
  startJob: (id: string) => void;
  completeJob: (id: string, result?: { resultUrl?: string; resultId?: string }) => void;
  failJob: (id: string, error: string) => void;
  setProgress: (id: string, progress: number) => void;
  // UI controls
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  setPanelVisible: (visible: boolean) => void;
  // Getters
  getActiveJobs: () => Job[];
  getCompletedJobs: () => Job[];
  getJobById: (id: string) => Job | undefined;
  hasActiveJobs: () => boolean;
  // Stall detection
  isJobStalled: (job: Job) => boolean;
  getStalledJobs: () => Job[];
}

const JobQueueContext = createContext<JobQueueContextValue | null>(null);

export function JobQueueProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(jobQueueReducer, initialState);
  const isHydrated = useRef(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined' || isHydrated.current) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Filter out old completed jobs
        const now = Date.now();
        const filteredJobs = (parsed.jobs || []).filter((job: Job) => {
          if (job.status === 'completed' || job.status === 'failed') {
            return job.completedAt && (now - job.completedAt) < COMPLETED_JOB_TTL;
          }
          return true;
        });

        // Keep only recent completed jobs
        const activeJobs = filteredJobs.filter((j: Job) => j.status === 'queued' || j.status === 'running');
        const completedJobs = filteredJobs
          .filter((j: Job) => j.status === 'completed' || j.status === 'failed')
          .slice(0, MAX_COMPLETED_JOBS);

        dispatch({
          type: 'HYDRATE',
          state: {
            jobs: [...activeJobs, ...completedJobs],
            isExpanded: parsed.isExpanded ?? false,
            isPanelVisible: parsed.isPanelVisible ?? true,
          },
        });
      }
    } catch (e) {
      console.error('Error hydrating job queue from localStorage:', e);
    }

    isHydrated.current = true;
  }, []);

  // Persist to localStorage on state changes
  useEffect(() => {
    if (typeof window === 'undefined' || !isHydrated.current) return;

    try {
      // Clean up old completed jobs before saving (more aggressive cleanup)
      const now = Date.now();
      const cleanedJobs = state.jobs.filter((job) => {
        // Keep active jobs (queued/running)
        if (job.status === 'queued' || job.status === 'running') {
          return true;
        }
        
        // For completed/failed jobs, only keep very recent ones (5 minutes)
        if ((job.status === 'completed' || job.status === 'failed') && job.completedAt) {
          const timeSinceCompletion = now - job.completedAt;
          return timeSinceCompletion < (5 * 60 * 1000); // 5 minutes
        }
        
        // Remove jobs without completion time
        return false;
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        jobs: cleanedJobs,
        isExpanded: state.isExpanded,
        isPanelVisible: state.isPanelVisible,
      }));
    } catch (e) {
      console.error('Error persisting job queue to localStorage:', e);
    }
  }, [state]);

  // Generate unique job ID
  const generateJobId = useCallback(() => {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Add a new job
  const addJob = useCallback((jobData: Omit<Job, 'id' | 'createdAt' | 'status'> & { status?: JobStatus }): string => {
    const id = generateJobId();
    const job: Job = {
      ...jobData,
      id,
      status: jobData.status || 'queued',
      createdAt: Date.now(),
    };
    dispatch({ type: 'ADD_JOB', job });
    return id;
  }, [generateJobId]);

  // Update an existing job
  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    dispatch({ type: 'UPDATE_JOB', id, updates });
  }, []);

  // Remove a job
  const removeJob = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_JOB', id });
  }, []);

  // Clear all completed jobs
  const clearCompleted = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED' });
  }, []);

  // Mark job as started
  const startJob = useCallback((id: string) => {
    dispatch({
      type: 'UPDATE_JOB',
      id,
      updates: { status: 'running', startedAt: Date.now() },
    });
  }, []);

  // Mark job as completed
  const completeJob = useCallback((id: string, result?: { resultUrl?: string; resultId?: string }) => {
    dispatch({
      type: 'UPDATE_JOB',
      id,
      updates: {
        status: 'completed',
        completedAt: Date.now(),
        progress: 100,
        ...result,
      },
    });
  }, []);

  // Mark job as failed
  const failJob = useCallback((id: string, error: string) => {
    dispatch({
      type: 'UPDATE_JOB',
      id,
      updates: {
        status: 'failed',
        completedAt: Date.now(),
        error,
      },
    });
  }, []);

  // Update progress (also tracks lastProgressUpdate for stall detection)
  const setProgress = useCallback((id: string, progress: number) => {
    dispatch({
      type: 'UPDATE_JOB',
      id,
      updates: {
        progress: Math.min(100, Math.max(0, progress)),
        lastProgressUpdate: Date.now(),
      },
    });
  }, []);

  // Cancel a running job
  const cancelJob = useCallback((id: string) => {
    dispatch({ type: 'CANCEL_JOB', id });
  }, []);

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    dispatch({ type: 'TOGGLE_EXPANDED' });
  }, []);

  // Set expanded state
  const setExpanded = useCallback((expanded: boolean) => {
    dispatch({ type: 'SET_EXPANDED', expanded });
  }, []);

  // Set panel visibility
  const setPanelVisible = useCallback((visible: boolean) => {
    dispatch({ type: 'SET_PANEL_VISIBLE', visible });
  }, []);

  // Get active jobs (queued or running)
  const getActiveJobs = useCallback(() => {
    return state.jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  }, [state.jobs]);

  // Get completed jobs (completed or failed)
  const getCompletedJobs = useCallback(() => {
    return state.jobs.filter((j) => j.status === 'completed' || j.status === 'failed');
  }, [state.jobs]);

  // Get job by ID
  const getJobById = useCallback((id: string) => {
    return state.jobs.find((j) => j.id === id);
  }, [state.jobs]);

  // Check if there are active jobs
  const hasActiveJobs = useCallback(() => {
    return state.jobs.some((j) => j.status === 'queued' || j.status === 'running');
  }, [state.jobs]);

  // Check if a job is stalled (no progress update for > JOB_STALL_THRESHOLD)
  const isJobStalled = useCallback((job: Job): boolean => {
    if (job.status !== 'running') return false;
    const lastUpdate = job.lastProgressUpdate || job.startedAt || job.createdAt;
    return Date.now() - lastUpdate > JOB_STALL_THRESHOLD;
  }, []);

  // Get stalled jobs
  const getStalledJobs = useCallback(() => {
    return state.jobs.filter((j) => j.status === 'running' && isJobStalled(j));
  }, [state.jobs, isJobStalled]);

  // Auto-complete music jobs that have been running too long
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const activeJobs = getActiveJobs();
      
      activeJobs.forEach(job => {
        // Auto-complete music jobs that have been running for more than 30 seconds
        if (job.type === 'music-generation' && 
            job.status === 'running' && 
            (now - job.startedAt > 30000)) {
          completeJob(job.id, { progress: 100 });
        }
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [getActiveJobs, completeJob]);

  const value: JobQueueContextValue = {
    state,
    addJob,
    updateJob,
    removeJob,
    clearCompleted,
    cancelJob,
    startJob,
    completeJob,
    failJob,
    setProgress,
    toggleExpanded,
    setExpanded,
    setPanelVisible,
    getActiveJobs,
    getCompletedJobs,
    getJobById,
    hasActiveJobs,
    isJobStalled,
    getStalledJobs,
  };

  return (
    <JobQueueContext.Provider value={value}>
      {children}
    </JobQueueContext.Provider>
  );
}

export function useJobQueue(): JobQueueContextValue {
  const context = useContext(JobQueueContext);
  if (!context) {
    throw new Error('useJobQueue must be used within a JobQueueProvider');
  }
  return context;
}

// Hook for creating and tracking a job
export function useJob(type: JobType) {
  const { addJob, updateJob, startJob, completeJob, failJob, setProgress, getJobById } = useJobQueue();
  const jobIdRef = useRef<string | null>(null);

  const create = useCallback((title: string, description?: string, metadata?: Record<string, unknown>) => {
    const id = addJob({ type, title, description, metadata });
    jobIdRef.current = id;
    return id;
  }, [addJob, type]);

  const start = useCallback(() => {
    if (jobIdRef.current) {
      startJob(jobIdRef.current);
    }
  }, [startJob]);

  const complete = useCallback((result?: { resultUrl?: string; resultId?: string }) => {
    if (jobIdRef.current) {
      completeJob(jobIdRef.current, result);
    }
  }, [completeJob]);

  const fail = useCallback((error: string) => {
    if (jobIdRef.current) {
      failJob(jobIdRef.current, error);
    }
  }, [failJob]);

  const progress = useCallback((value: number) => {
    if (jobIdRef.current) {
      setProgress(jobIdRef.current, value);
    }
  }, [setProgress]);

  const update = useCallback((updates: Partial<Job>) => {
    if (jobIdRef.current) {
      updateJob(jobIdRef.current, updates);
    }
  }, [updateJob]);

  const getJob = useCallback(() => {
    return jobIdRef.current ? getJobById(jobIdRef.current) : undefined;
  }, [getJobById]);

  return {
    jobId: jobIdRef.current,
    create,
    start,
    complete,
    fail,
    progress,
    update,
    getJob,
  };
}
