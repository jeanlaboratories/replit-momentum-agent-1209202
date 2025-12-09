'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { RefreshCw, Sparkles, Loader2, MessageSquare, Lightbulb, Palette, X, Pencil, AlertTriangle, ChevronDown, ChevronUp, Lock, Clock, Users, Check, XCircle, Brain, Upload, MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useJobQueue } from '@/contexts/job-queue-context';

type ArtifactVisibility = 'private' | 'pending_approval' | 'team';

type VoiceElement = {
  aspect: string;
  value: string;
  confidence?: number;
  evidence?: string;
};

type ExtractedFact = {
  category: string;
  fact: string;
  confidence: number;
  source?: string;
  extractedFrom?: string;
};

type KeyMessage = {
  theme: string;
  message: string;
  frequency?: number;
  importance?: number;
};

type VisualElement = {
  type: string;
  value: string;
  context?: string;
};

type InsightDisplay = {
  artifactId: string;
  artifactTitle: string;
  confidence: number;
  voiceElements?: VoiceElement[];
  facts?: ExtractedFact[];
  messages?: KeyMessage[];
  visualElements?: VisualElement[];
  visibility: ArtifactVisibility;
  createdBy: string;
  isOwner: boolean;
};

type ElementType = 'voiceElements' | 'facts' | 'messages' | 'visualElements';

export default function InsightsTab() {
  const { brandId } = useAuth();
  const { toast } = useToast();
  const { addJob, startJob, completeJob, failJob, setProgress } = useJobQueue();
  const [insights, setInsights] = useState<InsightDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsResynthesis, setNeedsResynthesis] = useState(false);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Set<string>>(new Set());
  const [isManager, setIsManager] = useState(false);
  const [visibilityActionLoading, setVisibilityActionLoading] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'team' | 'personal'>('all');

  // Memory bank status
  const [hasTeamMemoryBank, setHasTeamMemoryBank] = useState(false);
  const [hasPersonalMemoryBank, setHasPersonalMemoryBank] = useState(false);
  const [commitLoading, setCommitLoading] = useState<'personal' | 'team' | 'artifact-personal' | 'artifact-team' | null>(null);
  const [commitArtifactId, setCommitArtifactId] = useState<string | null>(null);
  // Track which memory bank each artifact is saved to (null = not saved, 'personal' or 'team')
  const [artifactSavedTo, setArtifactSavedTo] = useState<Record<string, 'personal' | 'team' | null>>({});

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<{
    artifactId: string;
    elementType: ElementType;
    elementIndex: number;
    element: any;
  } | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingElement, setDeletingElement] = useState<{
    artifactId: string;
    artifactTitle: string;
    elementType: ElementType;
    elementIndex: number;
    elementDescription: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadInsights = useCallback(async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/brand-soul/insights?brandId=${brandId}&visibility=${visibilityFilter}`);
      const data = await response.json();
      let loadedInsights: InsightDisplay[] = [];
      if (data.success) {
        loadedInsights = data.insights || [];
        setInsights(loadedInsights);
        setIsManager(data.isManager || false);
      }

      const soulResponse = await fetch(`/api/brand-soul/get?brandId=${brandId}`);
      const soulData = await soulResponse.json();
      if (soulData.success && soulData.brandSoul?.needsResynthesis) {
        setNeedsResynthesis(true);
      } else {
        setNeedsResynthesis(false);
      }

      const memoryStatusResponse = await fetch(`/api/brand-soul/insights/commit-to-memory?brandId=${brandId}`);
      const memoryStatusData = await memoryStatusResponse.json();
      if (memoryStatusData.success) {
        setHasTeamMemoryBank(memoryStatusData.hasTeamMemoryBank);
        setHasPersonalMemoryBank(memoryStatusData.hasPersonalMemoryBank);

        // Check which artifacts are saved to which memory banks
        if (loadedInsights.length > 0 && (memoryStatusData.hasTeamMemoryBank || memoryStatusData.hasPersonalMemoryBank)) {
          const artifactIds = loadedInsights.map(i => i.artifactId);
          const savedStatus: Record<string, 'personal' | 'team' | null> = {};

          // Initialize all as not saved
          artifactIds.forEach(id => { savedStatus[id] = null; });

          // Check personal memory bank
          if (memoryStatusData.hasPersonalMemoryBank) {
            try {
              const personalCheckResponse = await fetch('/api/agent-engine/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'check_artifacts',
                  type: 'personal',
                  artifact_ids: artifactIds,
                }),
              });
              const personalCheckData = await personalCheckResponse.json();
              if (personalCheckData.status === 'success' && personalCheckData.artifact_status) {
                Object.entries(personalCheckData.artifact_status).forEach(([artifactId, isSaved]) => {
                  if (isSaved) savedStatus[artifactId] = 'personal';
                });
              }
            } catch (e) {
              console.error('Failed to check personal memory status:', e);
            }
          }

          // Check team memory bank (only for artifacts not already marked as personal)
          if (memoryStatusData.hasTeamMemoryBank) {
            try {
              const teamCheckResponse = await fetch('/api/agent-engine/memories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'check_artifacts',
                  type: 'team',
                  brandId,
                  artifact_ids: artifactIds,
                }),
              });
              const teamCheckData = await teamCheckResponse.json();
              if (teamCheckData.status === 'success' && teamCheckData.artifact_status) {
                Object.entries(teamCheckData.artifact_status).forEach(([artifactId, isSaved]) => {
                  // Team takes precedence if saved to both (shouldn't happen with new logic)
                  if (isSaved) savedStatus[artifactId] = 'team';
                });
              }
            } catch (e) {
              console.error('Failed to check team memory status:', e);
            }
          }

          setArtifactSavedTo(savedStatus);
        }
      }
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  }, [brandId, visibilityFilter]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    const handleBrandSoulChanged = () => {
      loadInsights();
    };
    window.addEventListener('brand-soul-changed', handleBrandSoulChanged);
    return () => window.removeEventListener('brand-soul-changed', handleBrandSoulChanged);
  }, [loadInsights]);

  const toggleArtifactExpanded = (artifactId: string) => {
    setExpandedArtifacts(prev => {
      const next = new Set(prev);
      if (next.has(artifactId)) {
        next.delete(artifactId);
      } else {
        next.add(artifactId);
      }
      return next;
    });
  };

  const openEditDialog = (
    artifactId: string,
    elementType: ElementType,
    elementIndex: number,
    element: any
  ) => {
    setEditingElement({ artifactId, elementType, elementIndex, element });
    setEditFormData({ ...element });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingElement || !brandId) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/brand-soul/insights/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          artifactId: editingElement.artifactId,
          elementType: editingElement.elementType,
          elementIndex: editingElement.elementIndex,
          action: 'update',
          updatedElement: editFormData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Element Updated',
          description: 'The insight element has been updated. Team Intelligence needs to be resynthesized.',
        });
        setEditDialogOpen(false);
        setEditingElement(null);
        setNeedsResynthesis(true);
        await loadInsights();
        window.dispatchEvent(new CustomEvent('brand-soul-changed'));
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: data.message || 'Failed to update element',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update element',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (
    artifactId: string,
    artifactTitle: string,
    elementType: ElementType,
    elementIndex: number,
    elementDescription: string
  ) => {
    setDeletingElement({ artifactId, artifactTitle, elementType, elementIndex, elementDescription });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingElement || !brandId) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/brand-soul/insights/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          artifactId: deletingElement.artifactId,
          elementType: deletingElement.elementType,
          elementIndex: deletingElement.elementIndex,
          action: 'delete',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Element Deleted',
          description: 'The insight element has been removed. Team Intelligence needs to be resynthesized.',
        });
        setDeleteDialogOpen(false);
        setDeletingElement(null);
        setNeedsResynthesis(true);
        await loadInsights();
        window.dispatchEvent(new CustomEvent('brand-soul-changed'));
      } else {
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: data.message || 'Failed to delete element',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete element',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getElementTypeLabel = (type: ElementType): string => {
    switch (type) {
      case 'voiceElements': return 'Team Voice Element';
      case 'facts': return 'Key Fact';
      case 'messages': return 'Core Message';
      case 'visualElements': return 'Visual Element';
    }
  };

  const getVisibilityIcon = (visibility: ArtifactVisibility) => {
    switch (visibility) {
      case 'private':
        return <Lock className="w-3.5 h-3.5" />;
      case 'pending_approval':
        return <Clock className="w-3.5 h-3.5" />;
      case 'team':
        return <Users className="w-3.5 h-3.5" />;
    }
  };

  const getVisibilityColor = (visibility: ArtifactVisibility) => {
    switch (visibility) {
      case 'private':
        return 'text-gray-500 bg-gray-100';
      case 'pending_approval':
        return 'text-amber-600 bg-amber-50';
      case 'team':
        return 'text-blue-600 bg-blue-50';
    }
  };

  const handleVisibilityAction = async (
    artifactId: string,
    action: 'propose_for_team' | 'approve' | 'reject' | 'make_private',
    rejectionReason?: string
  ) => {
    if (!brandId) return;

    setVisibilityActionLoading(artifactId);
    try {
      const response = await fetch('/api/brand-soul/artifacts/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          artifactId,
          action,
          rejectionReason,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const actionMessages = {
          propose_for_team: 'Submitted for team approval',
          approve: 'Approved for team visibility',
          reject: 'Rejected - returned to private',
          make_private: 'Made private',
        };
        toast({
          title: 'Visibility Updated',
          description: actionMessages[action],
        });
        await loadInsights();
        window.dispatchEvent(new CustomEvent('brand-soul-changed'));
      } else {
        toast({
          variant: 'destructive',
          title: 'Action Failed',
          description: data.message || 'Failed to update visibility',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update visibility',
      });
    } finally {
      setVisibilityActionLoading(null);
    }
  };

  const handleCommitToMemory = async (
    targetType: 'personal' | 'team',
    artifactId?: string
  ) => {
    if (!brandId) return;

    const loadingState = artifactId
      ? (targetType === 'personal' ? 'artifact-personal' : 'artifact-team')
      : targetType;

    setCommitLoading(loadingState);
    if (artifactId) setCommitArtifactId(artifactId);

    // Create job for tracking
    const jobType = targetType === 'personal' ? 'memory-commit-personal' : 'memory-commit-team';
    const artifactTitle = artifactId
      ? insights.find(i => i.artifactId === artifactId)?.artifactTitle
      : null;
    const jobTitle = artifactId
      ? `Saving "${artifactTitle?.substring(0, 25)}${(artifactTitle?.length || 0) > 25 ? '...' : ''}" to ${targetType === 'team' ? 'Team' : 'Personal'}`
      : `Saving all insights to ${targetType === 'team' ? 'Team' : 'Personal'}`;
    const jobId = addJob({
      type: jobType,
      title: jobTitle,
      description: `Committing insights to ${targetType === 'team' ? 'Team' : 'Personal'} Memory Bank`,
      resultUrl: '/settings/memory',
    });

    startJob(jobId);
    setProgress(jobId, 20);

    try {
      setProgress(jobId, 40);
      const response = await fetch('/api/brand-soul/insights/commit-to-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          artifactId,
          targetMemoryType: targetType,
        }),
      });

      setProgress(jobId, 80);
      const data = await response.json();

      if (data.success) {
        completeJob(jobId, { resultUrl: '/settings/memory' });
        toast({
          title: 'Insights Committed',
          description: data.message || `Successfully committed ${data.memoriesCommitted} insights to ${targetType === 'team' ? 'Team' : 'Personal'} Memory Bank`,
        });
        // Update saved status
        if (artifactId) {
          setArtifactSavedTo(prev => ({ ...prev, [artifactId]: targetType }));
        }
      } else {
        const errorMsg = data.message || 'Failed to commit insights';
        failJob(jobId, errorMsg);
        if (data.code === 'NO_TEAM_MEMORY_BANK' || data.code === 'NO_PERSONAL_MEMORY_BANK') {
          toast({
            variant: 'destructive',
            title: 'Memory Bank Not Found',
            description: data.message,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Commit Failed',
            description: errorMsg,
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to commit insights to memory bank';
      failJob(jobId, errorMsg);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setCommitLoading(null);
      setCommitArtifactId(null);
    }
  };

  const handleRemoveFromMemory = async (
    artifactId: string,
    savedTo: 'personal' | 'team'
  ) => {
    if (!brandId) return;

    const loadingState = savedTo === 'personal' ? 'artifact-personal' : 'artifact-team';
    setCommitLoading(loadingState);
    setCommitArtifactId(artifactId);

    const artifactTitle = insights.find(i => i.artifactId === artifactId)?.artifactTitle;
    const jobId = addJob({
      type: savedTo === 'personal' ? 'memory-remove-personal' : 'memory-remove-team',
      title: `Removing "${artifactTitle?.substring(0, 25)}${(artifactTitle?.length || 0) > 25 ? '...' : ''}" from ${savedTo === 'team' ? 'Team' : 'Personal'}`,
      description: `Removing insights from ${savedTo === 'team' ? 'Team' : 'Personal'} Memory Bank`,
      resultUrl: '/settings/memory',
    });

    startJob(jobId);
    setProgress(jobId, 20);

    try {
      setProgress(jobId, 40);
      const response = await fetch('/api/agent-engine/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_by_artifact',
          type: savedTo,
          brandId: savedTo === 'team' ? brandId : undefined,
          source_artifact_id: artifactId,
        }),
      });

      setProgress(jobId, 80);
      const data = await response.json();

      if (data.status === 'success') {
        completeJob(jobId, { resultUrl: '/settings/memory' });
        toast({
          title: 'Insights Removed',
          description: `Successfully removed ${data.deleted || 0} memories from ${savedTo === 'team' ? 'Team' : 'Personal'} Memory Bank`,
        });
        // Update saved status
        setArtifactSavedTo(prev => ({ ...prev, [artifactId]: null }));
      } else {
        const errorMsg = data.error || data.message || 'Failed to remove insights';
        failJob(jobId, errorMsg);
        toast({
          variant: 'destructive',
          title: 'Remove Failed',
          description: errorMsg,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to remove insights from memory bank';
      failJob(jobId, errorMsg);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setCommitLoading(null);
      setCommitArtifactId(null);
    }
  };

  const renderEditForm = () => {
    if (!editingElement) return null;

    switch (editingElement.elementType) {
      case 'voiceElements':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aspect">Aspect</Label>
              <Input
                id="aspect"
                value={editFormData.aspect || ''}
                onChange={(e) => setEditFormData({ ...editFormData, aspect: e.target.value })}
                placeholder="e.g., tone, style, personality"
              />
            </div>
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={editFormData.value || ''}
                onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
                placeholder="e.g., professional, friendly"
              />
            </div>
          </div>
        );
      case 'facts':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={editFormData.category || ''}
                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                placeholder="e.g., company, product, history"
              />
            </div>
            <div>
              <Label htmlFor="fact">Fact</Label>
              <Input
                id="fact"
                value={editFormData.fact || ''}
                onChange={(e) => setEditFormData({ ...editFormData, fact: e.target.value })}
                placeholder="Enter the fact"
              />
            </div>
            <div>
              <Label htmlFor="confidence">Confidence (%)</Label>
              <Input
                id="confidence"
                type="number"
                min="0"
                max="100"
                value={editFormData.confidence || 0}
                onChange={(e) => setEditFormData({ ...editFormData, confidence: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
        );
      case 'messages':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Input
                id="theme"
                value={editFormData.theme || ''}
                onChange={(e) => setEditFormData({ ...editFormData, theme: e.target.value })}
                placeholder="e.g., innovation, trust"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Input
                id="message"
                value={editFormData.message || ''}
                onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
                placeholder="Enter the core message"
              />
            </div>
            <div>
              <Label htmlFor="importance">Importance (1-10)</Label>
              <Input
                id="importance"
                type="number"
                min="1"
                max="10"
                value={editFormData.importance || 5}
                onChange={(e) => setEditFormData({ ...editFormData, importance: parseInt(e.target.value) || 5 })}
              />
            </div>
          </div>
        );
      case 'visualElements':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                value={editFormData.type || ''}
                onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                placeholder="e.g., color, style, imagery, avoid"
              />
            </div>
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={editFormData.value || ''}
                onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
                placeholder="Enter the value"
              />
            </div>
            <div>
              <Label htmlFor="context">Context (optional)</Label>
              <Input
                id="context"
                value={editFormData.context || ''}
                onChange={(e) => setEditFormData({ ...editFormData, context: e.target.value })}
                placeholder="Additional context"
              />
            </div>
          </div>
        );
    }
  };

  // Count total elements
  const totalElements = insights.reduce((acc, insight) => {
    return acc + (insight.voiceElements?.length || 0) + (insight.facts?.length || 0) +
           (insight.messages?.length || 0) + (insight.visualElements?.length || 0);
  }, 0);

  if (!brandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-600">Please log in to view insights.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Compact Alert Banner */}
        {needsResynthesis && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-amber-800">Insights modified - regenerate Team Intelligence to apply changes</span>
          </div>
        )}

        {/* Main Card with Streamlined Header */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Extracted Insights</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {insights.length} sources · {totalElements} elements extracted
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Compact Segmented Filter */}
                <div className="flex items-center bg-gray-100/80 rounded-lg p-0.5">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'team', label: 'Team', icon: Users },
                    { key: 'personal', label: 'Mine', icon: Lock },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setVisibilityFilter(key as 'all' | 'team' | 'personal')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                        visibilityFilter === key
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      {label}
                    </button>
                  ))}
                </div>

                {/* Memory Actions Dropdown */}
                {insights.length > 0 && (hasPersonalMemoryBank || (isManager && hasTeamMemoryBank)) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        <Brain className="w-3.5 h-3.5" />
                        <span className="text-xs">Save to Memory</span>
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {hasPersonalMemoryBank && (
                        <DropdownMenuItem
                          onClick={() => handleCommitToMemory('personal')}
                          disabled={commitLoading !== null}
                          className="gap-2"
                        >
                          {commitLoading === 'personal' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Brain className="w-4 h-4" />
                          )}
                          <span>Save to Personal</span>
                        </DropdownMenuItem>
                      )}
                      {isManager && hasTeamMemoryBank && (
                        <DropdownMenuItem
                          onClick={() => handleCommitToMemory('team')}
                          disabled={commitLoading !== null}
                          className="gap-2"
                        >
                          {commitLoading === 'team' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>Save to Team</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Refresh Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={loadInsights} disabled={loading} className="h-8 w-8 p-0">
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : insights.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm">No insights yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload and process sources to extract insights</p>
              </div>
            ) : (
              <div className="space-y-2">
                {insights.map((insight) => {
                  const isExpanded = expandedArtifacts.has(insight.artifactId);
                  const elementCount = (insight.voiceElements?.length || 0) + (insight.facts?.length || 0) +
                                       (insight.messages?.length || 0) + (insight.visualElements?.length || 0);

                  return (
                    <div
                      key={insight.artifactId}
                      className={`border rounded-lg transition-all ${isExpanded ? 'border-teal-200 bg-teal-50/30' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      {/* Compact Header Row */}
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                        onClick={() => toggleArtifactExpanded(insight.artifactId)}
                      >
                        {/* Expand/Collapse Icon */}
                        <div className="text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>

                        {/* Title and Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{insight.artifactTitle}</span>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={`p-1 rounded ${getVisibilityColor(insight.visibility)}`}>
                                  {getVisibilityIcon(insight.visibility)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {insight.visibility === 'private' && `Private${insight.isOwner ? ' (yours)' : ''}`}
                                {insight.visibility === 'pending_approval' && 'Pending approval'}
                                {insight.visibility === 'team' && 'Shared with team'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        {/* Stats Pills */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded">{elementCount}</span>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">{Math.round(insight.confidence)}%</span>
                          {artifactSavedTo[insight.artifactId] && (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  artifactSavedTo[insight.artifactId] === 'team'
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}>
                                  <Brain className="w-3 h-3" />
                                  {artifactSavedTo[insight.artifactId] === 'team' ? 'T' : 'P'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                Saved to {artifactSavedTo[insight.artifactId] === 'team' ? 'Team' : 'Personal'} Memory Bank
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {/* Action Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              {visibilityActionLoading === insight.artifactId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {/* Visibility Actions */}
                            {insight.isOwner && insight.visibility === 'private' && (
                              <DropdownMenuItem onClick={() => handleVisibilityAction(insight.artifactId, 'propose_for_team')} className="gap-2">
                                <Users className="w-4 h-4" />
                                Share with team
                              </DropdownMenuItem>
                            )}
                            {isManager && insight.visibility === 'pending_approval' && (
                              <>
                                <DropdownMenuItem onClick={() => handleVisibilityAction(insight.artifactId, 'approve')} className="gap-2 text-green-600">
                                  <Check className="w-4 h-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleVisibilityAction(insight.artifactId, 'reject', 'Not approved')} className="gap-2 text-red-600">
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {(insight.isOwner || isManager) && insight.visibility !== 'private' && (
                              <DropdownMenuItem onClick={() => handleVisibilityAction(insight.artifactId, 'make_private')} className="gap-2">
                                <Lock className="w-4 h-4" />
                                Make private
                              </DropdownMenuItem>
                            )}

                            {/* Memory Actions */}
                            {(hasPersonalMemoryBank || (isManager && hasTeamMemoryBank)) && (
                              <>
                                <DropdownMenuSeparator />
                                {/* If already saved to a memory bank, show remove option */}
                                {artifactSavedTo[insight.artifactId] ? (
                                  <DropdownMenuItem
                                    onClick={() => handleRemoveFromMemory(insight.artifactId, artifactSavedTo[insight.artifactId]!)}
                                    disabled={commitLoading !== null}
                                    className="gap-2 text-red-600"
                                  >
                                    {commitLoading !== null && commitArtifactId === insight.artifactId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                    Remove from {artifactSavedTo[insight.artifactId] === 'team' ? 'Team' : 'Personal'}
                                  </DropdownMenuItem>
                                ) : (
                                  <>
                                    {/* Not saved yet - show save options */}
                                    {hasPersonalMemoryBank && (
                                      <DropdownMenuItem
                                        onClick={() => handleCommitToMemory('personal', insight.artifactId)}
                                        disabled={commitLoading !== null}
                                        className="gap-2"
                                      >
                                        {commitLoading === 'artifact-personal' && commitArtifactId === insight.artifactId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Brain className="w-4 h-4" />
                                        )}
                                        Save to Personal
                                      </DropdownMenuItem>
                                    )}
                                    {isManager && hasTeamMemoryBank && (
                                      <DropdownMenuItem
                                        onClick={() => handleCommitToMemory('team', insight.artifactId)}
                                        disabled={commitLoading !== null}
                                        className="gap-2"
                                      >
                                        {commitLoading === 'artifact-team' && commitArtifactId === insight.artifactId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Upload className="w-4 h-4" />
                                        )}
                                        Save to Team
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
                          {/* Voice Elements */}
                          {insight.voiceElements && insight.voiceElements.length > 0 && (
                            <div className="pt-3">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 mb-2">
                                <MessageSquare className="w-3.5 h-3.5" />
                                Voice ({insight.voiceElements.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {insight.voiceElements.map((elem, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="bg-blue-50 text-blue-800 border-0 text-xs font-normal py-0.5 group cursor-pointer hover:bg-blue-100"
                                  >
                                    <span className="font-medium">{elem.aspect}:</span>
                                    <span className="ml-1">{elem.value}</span>
                                    <span className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openEditDialog(insight.artifactId, 'voiceElements', i, elem); }}
                                        className="p-0.5 hover:bg-blue-200 rounded"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(insight.artifactId, insight.artifactTitle, 'voiceElements', i, `${elem.aspect}: ${elem.value}`); }}
                                        className="p-0.5 hover:bg-red-200 rounded text-red-600"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Facts */}
                          {insight.facts && insight.facts.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-2">
                                <Lightbulb className="w-3.5 h-3.5" />
                                Facts ({insight.facts.length})
                              </div>
                              <div className="space-y-1.5">
                                {insight.facts.map((fact, i) => (
                                  <div key={i} className="group flex items-start gap-2 text-xs bg-amber-50/50 rounded px-2 py-1.5 hover:bg-amber-50">
                                    <span className="flex-1 text-gray-700">{fact.fact}</span>
                                    <span className="text-amber-600 font-medium shrink-0">{Math.round(fact.confidence)}%</span>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0">
                                      <button
                                        onClick={() => openEditDialog(insight.artifactId, 'facts', i, fact)}
                                        className="p-0.5 hover:bg-amber-200 rounded"
                                      >
                                        <Pencil className="w-2.5 h-2.5 text-gray-500" />
                                      </button>
                                      <button
                                        onClick={() => openDeleteDialog(insight.artifactId, insight.artifactTitle, 'facts', i, fact.fact)}
                                        className="p-0.5 hover:bg-red-200 rounded"
                                      >
                                        <X className="w-2.5 h-2.5 text-red-500" />
                                      </button>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Messages */}
                          {insight.messages && insight.messages.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-2">
                                <MessageSquare className="w-3.5 h-3.5" />
                                Messages ({insight.messages.length})
                              </div>
                              <div className="space-y-1.5">
                                {insight.messages.map((msg, i) => (
                                  <div key={i} className="group flex items-start gap-2 text-xs bg-green-50/50 rounded px-2 py-1.5 hover:bg-green-50">
                                    <div className="flex-1">
                                      <span className="text-gray-700">{msg.message}</span>
                                      {msg.theme && <span className="ml-1.5 text-green-600">#{msg.theme}</span>}
                                    </div>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0">
                                      <button
                                        onClick={() => openEditDialog(insight.artifactId, 'messages', i, msg)}
                                        className="p-0.5 hover:bg-green-200 rounded"
                                      >
                                        <Pencil className="w-2.5 h-2.5 text-gray-500" />
                                      </button>
                                      <button
                                        onClick={() => openDeleteDialog(insight.artifactId, insight.artifactTitle, 'messages', i, msg.message)}
                                        className="p-0.5 hover:bg-red-200 rounded"
                                      >
                                        <X className="w-2.5 h-2.5 text-red-500" />
                                      </button>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Visual Elements */}
                          {insight.visualElements && insight.visualElements.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-pink-700 mb-2">
                                <Palette className="w-3.5 h-3.5" />
                                Visual ({insight.visualElements.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {insight.visualElements.map((elem, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="bg-pink-50 text-pink-800 border-0 text-xs font-normal py-0.5 group cursor-pointer hover:bg-pink-100"
                                  >
                                    <span className="font-medium">{elem.type}:</span>
                                    <span className="ml-1">{elem.value}</span>
                                    <span className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openEditDialog(insight.artifactId, 'visualElements', i, elem); }}
                                        className="p-0.5 hover:bg-pink-200 rounded"
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(insight.artifactId, insight.artifactTitle, 'visualElements', i, `${elem.type}: ${elem.value}`); }}
                                        className="p-0.5 hover:bg-red-200 rounded text-red-600"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit {editingElement ? getElementTypeLabel(editingElement.elementType) : ''}
              </DialogTitle>
              <DialogDescription>
                Make changes to this insight element. After saving, you&apos;ll need to regenerate Team Intelligence.
              </DialogDescription>
            </DialogHeader>
            {renderEditForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deletingElement ? getElementTypeLabel(deletingElement.elementType) : ''}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-sm text-muted-foreground">
                  <span className="block mb-2">
                    This will permanently remove this element from &quot;{deletingElement?.artifactTitle}&quot;:
                  </span>
                  <span className="block font-medium text-gray-700 bg-gray-100 p-2 rounded">
                    {deletingElement?.elementDescription}
                  </span>
                  <span className="block mt-2 text-amber-600">
                    After deleting, you&apos;ll need to regenerate Team Intelligence.
                  </span>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
