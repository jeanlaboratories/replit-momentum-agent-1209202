'use client';

/**
 * Header Job Status
 *
 * A polished dropdown component for the header that shows job queue status.
 * Features:
 * - Compact trigger button with activity indicator
 * - Dropdown with full job list
 * - Real-time progress updates
 * - Cancel/remove functionality
 * - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { useJobQueue, getJobTypeInfo, JOB_STALL_THRESHOLD, type Job } from '@/contexts/job-queue-context';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  AlertTriangle,
  StopCircle,
  Ban,
  Activity,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  compact?: boolean;
}

function JobItem({ job, onRemove, onCancel, isStalled, compact = false }: JobItemProps) {
  const router = useRouter();
  const typeInfo = getJobTypeInfo(job.type);
  const [duration, setDuration] = useState('');

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
    queued: <Clock className="h-3 w-3 text-gray-400 shrink-0" />,
    running: isStalled
      ? <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
      : <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />,
    completed: <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />,
    failed: <XCircle className="h-3 w-3 text-red-500 shrink-0" />,
    cancelled: <Ban className="h-3 w-3 text-gray-400 shrink-0" />,
  };

  const isActive = job.status === 'running' || job.status === 'queued';

  return (
    <div
      className={cn(
        'rounded border px-2 py-1.5',
        isActive ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-card border-border',
        isStalled && 'bg-orange-50 dark:bg-orange-900/10 border-orange-300',
        job.resultUrl && 'cursor-pointer'
      )}
      onClick={handleClick}
    >
      {/* Row 1: Title + Action */}
      <div className="flex items-center gap-2 mb-0.5">
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          {statusIcon[job.status]}
          <span className="text-[11px] font-medium truncate max-w-[160px]">{job.title}</span>
        </div>
        {isActive && (
          <Button
            variant="destructive"
            size="sm"
            className="h-5 px-2 text-[10px] shrink-0"
            onClick={(e) => { e.stopPropagation(); onCancel(job.id); }}
          >
            Cancel
          </Button>
        )}
        {job.status === 'completed' && job.resultUrl && (
          <Button variant="outline" size="sm" className="h-5 px-2 text-[10px] shrink-0"
            onClick={(e) => { e.stopPropagation(); router.push(job.resultUrl!); }}>
            View
          </Button>
        )}
        {!isActive && (
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
            onClick={(e) => { e.stopPropagation(); onRemove(job.id); }}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Row 2: Progress or Status */}
      {job.status === 'running' && job.progress !== undefined ? (
        <div className="flex items-center gap-1.5">
          <Progress value={job.progress} className={cn("h-1 flex-1 max-w-[120px]", isStalled && "[&>div]:bg-orange-500")} />
          <span className="text-[9px] text-muted-foreground w-6 text-right">{Math.round(job.progress)}%</span>
          {duration && <span className="text-[9px] text-muted-foreground">{duration}</span>}
        </div>
      ) : (
          <div className="text-[9px] text-muted-foreground">
          {job.status === 'queued' && 'Waiting...'}
          {job.status === 'completed' && formatTimeAgo(job.completedAt || job.createdAt)}
            {job.status === 'failed' && <span className="text-red-500 break-words">{job.error || 'Failed'}</span>}
          {job.status === 'cancelled' && 'Cancelled'}
        </div>
      )}
    </div>
  );
}

export function HeaderJobStatus() {
  const {
    state,
    removeJob,
    cancelJob,
    clearCompleted,
    getActiveJobs,
    getCompletedJobs,
    hasActiveJobs,
    isJobStalled,
    getStalledJobs,
  } = useJobQueue();

  const activeJobs = getActiveJobs();
  const completedJobs = getCompletedJobs();
  const stalledJobs = getStalledJobs();
  const totalJobs = state.jobs.length;
  const hasActive = hasActiveJobs();
  const hasStalled = stalledJobs.length > 0;

  // Calculate overall progress for active jobs
  const overallProgress = activeJobs.length > 0
    ? Math.round(activeJobs.reduce((sum, job) => sum + (job.progress || 0), 0) / activeJobs.length)
    : 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="link"
          className={cn(
            "text-muted-foreground hover:text-primary transition-colors relative gap-2",
            hasActive && "text-blue-600 dark:text-blue-400",
            hasStalled && "text-orange-600 dark:text-orange-400"
          )}
        >
          {hasActive ? (
            hasStalled ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )
          ) : (
            <Activity className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {hasActive
              ? `${activeJobs.length} Running`
              : totalJobs > 0
                ? 'Jobs'
                : 'Jobs'
            }
          </span>
          {/* Badge for count */}
          {totalJobs > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-medium rounded-full flex items-center justify-center",
              hasActive
                ? hasStalled
                  ? "bg-orange-500 text-white"
                  : "bg-blue-500 text-white"
                : "bg-muted text-muted-foreground"
            )}>
              {totalJobs}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-xs">Job Queue</h3>
              {hasActive && (
                <span className={cn(
                  "text-[10px] px-1 py-0.5 rounded-full",
                  hasStalled
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                )}>
                  {activeJobs.length} active
                </span>
              )}
            </div>
            {completedJobs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] px-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  clearCompleted();
                }}
              >
                <Trash2 className="h-2.5 w-2.5 mr-0.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Overall progress bar for active jobs */}
          {hasActive && (
            <div className="mt-1.5">
              <Progress
                value={overallProgress}
                className={cn("h-1", hasStalled && "[&>div]:bg-orange-500")}
              />
            </div>
          )}
        </div>

        {/* Job list */}
        <ScrollArea className="max-h-[280px]">
          {totalJobs === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <Activity className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
              <p className="text-xs">No jobs in queue</p>
              <p className="text-[10px] mt-0.5">Jobs appear here when generating</p>
            </div>
          ) : (
            <div className="p-1.5">
              {/* Active jobs */}
              {activeJobs.length > 0 && (
                <div className="space-y-1">
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

              {/* Divider */}
              {activeJobs.length > 0 && completedJobs.length > 0 && (
                <div className="flex items-center gap-1.5 py-1 px-2">
                  <div className="flex-1 border-t" />
                  <span className="text-[10px] text-muted-foreground">Recent</span>
                  <div className="flex-1 border-t" />
                </div>
              )}

              {/* Completed jobs */}
              {completedJobs.length > 0 && (
                <div className="space-y-1">
                  {completedJobs.slice(0, 5).map((job) => (
                    <JobItem
                      key={job.id}
                      job={job}
                      onRemove={removeJob}
                      onCancel={cancelJob}
                      isStalled={false}
                      compact
                    />
                  ))}
                  {completedJobs.length > 5 && (
                    <p className="text-[10px] text-center text-muted-foreground py-1">
                      +{completedJobs.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
