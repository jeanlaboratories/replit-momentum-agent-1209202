'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RefreshCw, FileText, Globe, Upload, Loader2, Play, Trash2, Pencil, MoreHorizontal, Image, Video, Youtube } from 'lucide-react';
import { useJobQueue } from '@/contexts/job-queue-context';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { BrandArtifact } from '@/lib/types/brand-soul';
import { getUserDisplayNamesAction } from '@/app/actions';

export default function ArtifactsTab() {
  const { brandId } = useAuth();
  const { toast } = useToast();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();
  const [artifacts, setArtifacts] = useState<BrandArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [artifactToDelete, setArtifactToDelete] = useState<BrandArtifact | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [artifactToEdit, setArtifactToEdit] = useState<BrandArtifact | null>(null);
  const [editedText, setEditedText] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [userDisplayNames, setUserDisplayNames] = useState<{ [userId: string]: string }>({});

  const setProgressRef = useRef(setProgress);
  useEffect(() => {
    setProgressRef.current = setProgress;
  }, [setProgress]);

  const loadArtifacts = async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/brand-soul/artifacts?brandId=${brandId}`);
      const data = await response.json();
      if (data.success) {
        setArtifacts(data.artifacts || []);

        const userIds = new Set<string>();
        (data.artifacts || []).forEach((artifact: BrandArtifact) => {
          if (artifact.createdBy && artifact.createdBy !== 'system') {
            userIds.add(artifact.createdBy);
          }
        });

        if (userIds.size > 0) {
          const displayNames = await getUserDisplayNamesAction(Array.from(userIds));
          setUserDisplayNames(displayNames);
        }
      }
    } catch (error) {
      console.error('Failed to load artifacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerWorker = async () => {
    if (!brandId) return;

    setWorkerRunning(true);
    try {
      const jobsResponse = await fetch(`/api/brand-soul/jobs/pending?brandId=${brandId}`);
      const jobsData = await jobsResponse.json();

      if (!jobsData.success) {
        toast({
          title: 'Error',
          description: jobsData.message || 'Failed to fetch pending jobs',
          variant: 'destructive',
        });
        return;
      }

      if (!jobsData.jobs || jobsData.jobs.length === 0) {
        toast({
          title: 'No pending jobs',
          description: 'All jobs have been processed.',
        });
        return;
      }

      const totalJobs = jobsData.jobs.length;

      const queueJobId = addJob({
        type: 'artifact-processing',
        title: `Processing ${totalJobs} artifact${totalJobs > 1 ? 's' : ''}`,
        description: 'Extracting insights from team artifacts',
        resultUrl: '/brand-soul?tab=artifacts',
      });

      startJob(queueJobId);
      setProgressRef.current(queueJobId, 5);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < jobsData.jobs.length; i++) {
        const job = jobsData.jobs[i];
        const progressPercent = Math.round(10 + ((i / totalJobs) * 80));
        setProgressRef.current(queueJobId, progressPercent);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);

          const response = await fetch('/api/brand-soul/worker/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const data = await response.json();

          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to process job ${job.id}:`, error);
          failCount++;
        }
      }

      if (failCount === 0) {
        completeJob(queueJobId, { resultUrl: '/brand-soul?tab=artifacts' });
      } else if (successCount === 0) {
        failJob(queueJobId, `All ${totalJobs} jobs failed`);
      } else {
        completeJob(queueJobId, { resultUrl: '/brand-soul?tab=artifacts' });
      }

      toast({
        title: 'Processing complete',
        description: `Processed ${successCount} job(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
      });

      setTimeout(loadArtifacts, 2000);

    } catch (error) {
      console.error('Failed to trigger worker:', error);
      toast({
        title: 'Error',
        description: 'Failed to process jobs',
        variant: 'destructive',
      });
    } finally {
      setWorkerRunning(false);
    }
  };

  const handleDeleteClick = (artifact: BrandArtifact) => {
    setArtifactToDelete(artifact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!artifactToDelete || !brandId) return;

    setDeletingId(artifactToDelete.id);
    setDeleteDialogOpen(false);

    try {
      const response = await fetch(
        `/api/brand-soul/artifacts/delete?brandId=${brandId}&artifactId=${artifactToDelete.id}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Deleted',
          description: 'Artifact and associated data removed.',
        });
        loadArtifacts();
        window.dispatchEvent(new CustomEvent('brand-soul-changed'));
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to delete',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to delete artifact:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete artifact',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
      setArtifactToDelete(null);
    }
  };

  const handleEditClick = async (artifact: BrandArtifact) => {
    setArtifactToEdit(artifact);
    setEditDialogOpen(true);
    setLoadingText(true);

    try {
      const response = await fetch(
        `/api/brand-soul/artifacts/get-text?brandId=${brandId}&artifactId=${artifact.id}`
      );
      const data = await response.json();

      if (data.success) {
        setEditedText(data.text);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load text',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load text:', error);
      toast({
        title: 'Error',
        description: 'Failed to load text',
        variant: 'destructive',
      });
    } finally {
      setLoadingText(false);
    }
  };

  const handleEditSave = async () => {
    if (!artifactToEdit || !brandId) return;

    setSavingEdit(true);

    try {
      const response = await fetch('/api/brand-soul/artifacts/update-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          artifactId: artifactToEdit.id,
          text: editedText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Updated',
          description: 'Artifact will be re-processed.',
        });
        setEditDialogOpen(false);
        setArtifactToEdit(null);
        setEditedText('');
        loadArtifacts();
        window.dispatchEvent(new CustomEvent('brand-soul-changed'));
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to update',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to update artifact:', error);
      toast({
        title: 'Error',
        description: 'Failed to update',
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    loadArtifacts();
  }, [brandId]);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'manual-text': return <FileText className="w-3.5 h-3.5" />;
      case 'website': return <Globe className="w-3.5 h-3.5" />;
      case 'document': return <Upload className="w-3.5 h-3.5" />;
      case 'image': return <Image className="w-3.5 h-3.5" />;
      case 'video': return <Video className="w-3.5 h-3.5" />;
      case 'youtube': return <Youtube className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
      extracting: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Extracting' },
      extracted: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Extracted' },
      failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Failed' },
    };
    return configs[status] || configs.pending;
  };

  const pendingCount = artifacts.filter(a => a.status === 'pending').length;
  const extractedCount = artifacts.filter(a => a.status === 'extracted').length;

  if (!brandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500 text-sm">Please log in to view artifacts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-900">Team Artifacts</h3>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                {artifacts.length} total
              </span>
              {extractedCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded">
                  {extractedCount} extracted
                </span>
              )}
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded">
                  {pendingCount} pending
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={triggerWorker}
                disabled={workerRunning}
                className="h-7 px-2.5 text-xs"
              >
                {workerRunning ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 mr-1" />
                )}
                Process
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadArtifacts}
                  disabled={loading}
                  className="h-7 w-7 p-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : artifacts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No artifacts yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload sources to get started</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {artifacts.map((artifact) => {
              const statusConfig = getStatusConfig(artifact.status);

              return (
                <div
                  key={artifact.id}
                  className="group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                    {getSourceIcon(artifact.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {artifact.metadata.title}
                      </h4>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {artifact.source?.url && artifact.type !== 'manual-text' && (
                        <span className="text-xs text-gray-400 truncate max-w-[200px]">
                          {artifact.source.url}
                        </span>
                      )}
                      {artifact.createdBy && artifact.createdBy !== 'system' && (
                        <span className="text-xs text-gray-400">
                          by{' '}
                          <Link
                            href={`/brand-profile/personal?userId=${artifact.createdBy}`}
                            className="text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            {userDisplayNames[artifact.createdBy] || '...'}
                          </Link>
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(
                          typeof artifact.createdAt === 'string'
                            ? artifact.createdAt
                            : artifact.createdAt.toDate()
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    {Array.isArray(artifact.metadata?.tags) && artifact.metadata.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {artifact.metadata.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200">
                            {tag}
                          </Badge>
                        ))}
                        {artifact.metadata.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{artifact.metadata.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {deletingId === artifact.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      {artifact.type === 'manual-text' && (
                        <>
                          <DropdownMenuItem onClick={() => handleEditClick(artifact)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit text
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(artifact)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Artifact?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{artifactToDelete?.metadata.title}&quot; and all associated insights.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-8 text-sm">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="h-8 text-sm bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Text Artifact</DialogTitle>
              <DialogDescription className="text-sm">
                Update the content. It will be re-processed for insights.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-3">
              <div className="space-y-1.5">
                <Label htmlFor="artifact-text" className="text-xs text-gray-600">Content</Label>
                {loadingText ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Textarea
                    id="artifact-text"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    placeholder="Enter your text..."
                    className="min-h-[300px] font-mono text-sm resize-none"
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditDialogOpen(false);
                  setArtifactToEdit(null);
                  setEditedText('');
                }}
                disabled={savingEdit}
                className="h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEditSave}
                disabled={savingEdit || loadingText}
                className="h-8"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Re-process'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
