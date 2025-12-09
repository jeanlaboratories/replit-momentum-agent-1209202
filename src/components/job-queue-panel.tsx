'use client';

/**
 * Job Queue Panel
 *
 * A Meta/Instagram-style sticky panel that shows all running and recent jobs.
 * Always visible in the bottom-right corner, expandable to show full details.
 *
 * Features:
 * - Collapsed state shows job count badge
 * - Expanded state shows full job list with progress
 * - Real-time progress animations
 * - Click to navigate to results
 * - Persist state across navigation
 */

import React, { useState, useEffect } from 'react';
import { useJobQueue, getJobTypeInfo, JOB_STALL_THRESHOLD, type Job } from '@/contexts/job-queue-context';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  Minimize2,
  Maximize2,
  AlertTriangle,
  StopCircle,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(startedAt?: number, completedAt?: number): string {
  if (!startedAt) return '';
  const end = completedAt || Date.now();
  const seconds = Math.floor((end - startedAt) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface JobItemProps {
  job: Job;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
  isStalled: boolean;
}

function JobItem({ job, onRemove, onCancel, isStalled }: JobItemProps) {
  const router = useRouter();
  const typeInfo = getJobTypeInfo(job.type);
  const [duration, setDuration] = useState('');

  // Update duration for running jobs
  useEffect(() => {
    if (job.status === 'running' && job.startedAt) {
      const interval = setInterval(() => {
        setDuration(formatDuration(job.startedAt, job.completedAt));
      }, 1000);
      return () => clearInterval(interval);
    } else if (job.startedAt) {
      setDuration(formatDuration(job.startedAt, job.completedAt));
    }
  }, [job.status, job.startedAt, job.completedAt]);

  const handleClick = () => {
    if (job.resultUrl) {
      router.push(job.resultUrl);
    }
  };

  const statusIcon: Record<string, React.ReactNode> = {
    queued: <Clock className="h-4 w-4 text-gray-400" />,
    running: isStalled
      ? <AlertTriangle className="h-4 w-4 text-orange-500" />
      : <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    cancelled: <Ban className="h-4 w-4 text-gray-500" />,
  };

  const statusBg: Record<string, string> = {
    queued: 'bg-gray-50 dark:bg-gray-900/50',
    running: isStalled
      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300'
      : 'bg-blue-50 dark:bg-blue-900/20',
    completed: 'bg-green-50 dark:bg-green-900/20',
    failed: 'bg-red-50 dark:bg-red-900/20',
    cancelled: 'bg-gray-100 dark:bg-gray-800/50',
  };

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border transition-all duration-200',
        'hover:shadow-md',
        statusBg[job.status],
        job.resultUrl && 'cursor-pointer'
      )}
      onClick={handleClick}
    >
      {/* Action buttons */}
      {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(job.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Cancel button for running/queued jobs */}
      {(job.status === 'running' || job.status === 'queued') && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute top-1 right-1 h-6 w-6 transition-opacity",
            isStalled ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onCancel(job.id);
          }}
          title="Cancel job"
        >
          <StopCircle className="h-3 w-3 text-red-500" />
        </Button>
      )}

      <div className="flex items-start gap-3">
        {/* Type emoji and status icon */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg">{typeInfo.emoji}</span>
          {statusIcon[job.status]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium uppercase tracking-wide', typeInfo.color)}>
              {typeInfo.label}
            </span>
            {duration && (
              <span className="text-xs text-muted-foreground">
                {duration}
              </span>
            )}
          </div>

          <p className="font-medium text-sm mt-0.5">
            {job.title}
          </p>

          {job.description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {job.description}
            </p>
          )}

          {/* Progress bar for running jobs */}
          {job.status === 'running' && job.progress !== undefined && (
            <div className="mt-2">
              <Progress value={job.progress} className={cn("h-1.5", isStalled && "bg-orange-200")} />
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(job.progress)}% complete
              </p>
            </div>
          )}

          {/* Stall warning */}
          {isStalled && job.status === 'running' && (
            <div className="flex items-center gap-1 mt-1 text-xs text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-3 w-3" />
              <span>Job appears stalled - no progress for 2+ min</span>
            </div>
          )}

          {/* Error message for failed jobs */}
          {job.status === 'failed' && job.error && (
            <p className="text-xs text-red-500 mt-1">
              {job.error}
            </p>
          )}

          {/* Cancelled message */}
          {job.status === 'cancelled' && (
            <p className="text-xs text-gray-500 mt-1">
              {job.error || 'Job was cancelled'}
            </p>
          )}

          {/* Result link */}
          {job.status === 'completed' && job.resultUrl && (
            <div className="flex items-center gap-1 mt-1 text-xs text-primary">
              <ExternalLink className="h-3 w-3" />
              <span>View result</span>
            </div>
          )}
        </div>
      </div>

      {/* Time ago */}
      <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
        {formatTimeAgo(job.createdAt)}
      </div>
    </div>
  );
}

export function JobQueuePanel() {
  const {
    state,
    removeJob,
    cancelJob,
    clearCompleted,
    toggleExpanded,
    setExpanded,
    setPanelVisible,
    getActiveJobs,
    getCompletedJobs,
    hasActiveJobs,
    isJobStalled,
  } = useJobQueue();

  const activeJobs = getActiveJobs();
  const completedJobs = getCompletedJobs();
  const totalJobs = state.jobs.length;
  const hasJobs = totalJobs > 0;
  const hasActive = hasActiveJobs();

  // Don't render if user explicitly hid the panel and there are no active jobs
  // Note: We always show when panel is visible so users can see the job queue is ready
  if (!state.isPanelVisible && !hasActive) {
    return null;
  }

  // Determine the collapsed button text
  const getCollapsedText = () => {
    if (hasActive) {
      return `${activeJobs.length} job${activeJobs.length !== 1 ? 's' : ''} running`;
    }
    if (completedJobs.length > 0) {
      return `${completedJobs.length} completed`;
    }
    return 'Job Queue';
  };

  return (
    <div
      className={cn(
        'fixed bottom-24 right-4 z-40',
        'transition-all duration-300 ease-out',
        state.isExpanded ? 'w-80' : 'w-auto'
      )}
    >
      {/* Collapsed badge view */}
      {!state.isExpanded && (
        <button
          onClick={toggleExpanded}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-full',
            'bg-background/95 backdrop-blur-md',
            'border shadow-lg hover:shadow-xl',
            'transition-all duration-200',
            hasActive && 'border-blue-500/50 shadow-blue-500/20'
          )}
        >
          {hasActive ? (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          ) : completedJobs.length > 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">
            {getCollapsedText()}
          </span>
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Expanded panel view */}
      {state.isExpanded && (
        <div
          className={cn(
            'bg-background/95 backdrop-blur-md rounded-xl border shadow-2xl',
            'overflow-hidden',
            hasActive && 'border-blue-500/30'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              {hasActive && (
                <div className="relative">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full animate-pulse" />
                </div>
              )}
              <h3 className="font-semibold text-sm">
                Job Queue
              </h3>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {totalJobs}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {completedJobs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearCompleted}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(false)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Job list */}
          <ScrollArea className="max-h-80">
            <div className="p-3 space-y-2">
              {/* Active jobs section */}
              {activeJobs.length > 0 && (
                <div className="space-y-2">
                  {activeJobs.map((job) => (
                    <JobItem
                      key={job.id}
                      job={job}
                      onRemove={removeJob}
                      onCancel={cancelJob}
                      isStalled={isJobStalled(job)}
                    />
                  ))}
                </div>
              )}

              {/* Divider if both sections have items */}
              {activeJobs.length > 0 && completedJobs.length > 0 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 border-t" />
                  <span className="text-xs text-muted-foreground">Completed</span>
                  <div className="flex-1 border-t" />
                </div>
              )}

              {/* Completed jobs section */}
              {completedJobs.length > 0 && (
                <div className="space-y-2">
                  {completedJobs.map((job) => (
                    <JobItem
                      key={job.id}
                      job={job}
                      onRemove={removeJob}
                      onCancel={cancelJob}
                      isStalled={false}
                    />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {totalJobs === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No jobs in queue</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer with hide option */}
          <div className="px-4 py-2 border-t bg-muted/30 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">
              Jobs persist across page refreshes
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => {
                setPanelVisible(false);
                setExpanded(false);
              }}
            >
              <Minimize2 className="h-3 w-3 mr-1" />
              Hide
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mini indicator for the header (optional)
export function JobQueueIndicator() {
  const { state, toggleExpanded, hasActiveJobs, getActiveJobs } = useJobQueue();
  const activeJobs = getActiveJobs();
  const hasActive = hasActiveJobs();

  if (!hasActive && state.jobs.length === 0) {
    return null;
  }

  return (
    <button
      onClick={toggleExpanded}
      className={cn(
        'relative flex items-center gap-1.5 px-2 py-1 rounded-full',
        'text-xs font-medium transition-all',
        hasActive
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      )}
    >
      {hasActive ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{activeJobs.length}</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3 w-3" />
          <span>{state.jobs.length}</span>
        </>
      )}
    </button>
  );
}
