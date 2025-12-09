'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getBrandMembershipAction } from '@/app/actions';
import {
  Users, User, ChevronDown, ChevronUp, Brain, Trash2, RefreshCw,
  Plus, AlertTriangle, Check, Clock, MoreHorizontal, Sparkles, FileText
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Memory {
  id: string;
  content: string;
  createdAt: string;
  scope?: 'team' | 'personal';
  fullName?: string;  // Full Vertex AI resource name for deletion
  sourceArtifactId?: string;
  sourceArtifactTitle?: string;
  sourceBrandId?: string;
  insightElementType?: string;
}

type MemoryBankType = 'team' | 'personal';

export function AgentEngineManager() {
  const { user, brandId, refreshUserProfile } = useAuth();

  // Personal memory state
  const [isLoadingPersonal, setIsLoadingPersonal] = useState(false);
  const [errorPersonal, setErrorPersonal] = useState<string | null>(null);
  const [personalMemories, setPersonalMemories] = useState<Memory[]>([]);
  const [isFetchingPersonalMemories, setIsFetchingPersonalMemories] = useState(false);
  const [personalMemoriesExpanded, setPersonalMemoriesExpanded] = useState(true);

  // Team memory state
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [errorTeam, setErrorTeam] = useState<string | null>(null);
  const [teamMemories, setTeamMemories] = useState<Memory[]>([]);
  const [isFetchingTeamMemories, setIsFetchingTeamMemories] = useState(false);
  const [teamMemoriesExpanded, setTeamMemoriesExpanded] = useState(true);
  const [teamAgentEngineId, setTeamAgentEngineId] = useState<string | null>(null);
  
  // Personal memory engine ID - track locally for immediate UI updates (like Team)
  const [personalAgentEngineId, setPersonalAgentEngineId] = useState<string | null>(null);

  // Initialize personal agent engine ID from user profile (for immediate UI updates)
  // Use a ref to track if we've manually set the value (to prevent useEffect from overwriting it)
  const personalEngineManuallySet = useRef(false);

  // Shared state
  const [isManager, setIsManager] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'clear' | 'deleteEngine'; bank: MemoryBankType } | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<{ memory: Memory; type: MemoryBankType } | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);
  const [artifactToDelete, setArtifactToDelete] = useState<{ artifactId: string; artifactTitle: string; type: MemoryBankType; count: number } | null>(null);

  // Use local state for immediate UI updates (falls back to auth context if local state not set)
  // FIXED: Prioritize local state when manually set to avoid race conditions during deletion
  const hasPersonalMemoryEngine = personalEngineManuallySet.current 
    ? !!personalAgentEngineId 
    : !!user?.agentEngineId;
  const hasTeamMemoryEngine = !!teamAgentEngineId;
  
  useEffect(() => {
    // Only update from user profile if we haven't manually set it
    if (!personalEngineManuallySet.current) {
      console.log('[PersonalMemory] useEffect updating from user profile:', {
        fromUser: user?.agentEngineId,
        currentLocal: personalAgentEngineId,
      });
      if (user?.agentEngineId) {
        setPersonalAgentEngineId(user.agentEngineId);
      } else {
        setPersonalAgentEngineId(null);
      }
    } else {
      console.log('[PersonalMemory] useEffect skipped - manually set');
    }
    // Reset the manual flag after user profile updates
    personalEngineManuallySet.current = false;
  }, [user?.agentEngineId]);

  // Check user's role in the brand
  useEffect(() => {
    async function checkRole() {
      if (!user?.uid || !brandId) {
        setIsLoadingRole(false);
        return;
      }
      try {
        const membership = await getBrandMembershipAction(user.uid, brandId);
        setIsManager(membership?.role === 'MANAGER');
      } catch (error) {
        console.error('Failed to check user role:', error);
      } finally {
        setIsLoadingRole(false);
      }
    }
    checkRole();
  }, [user?.uid, brandId]);

  // Fetch team memory engine status
  useEffect(() => {
    async function fetchTeamMemoryEngine() {
      if (!brandId) return;
      try {
        const response = await fetch(`/api/agent-engine/team?brandId=${brandId}`);
        if (response.ok) {
          const data = await response.json();
          setTeamAgentEngineId(data.teamAgentEngineId || null);
        }
      } catch (error) {
        console.error('Failed to fetch team memory engine:', error);
      }
    }
    fetchTeamMemoryEngine();
  }, [brandId]);

  // Fetch memories
  const fetchMemories = async (type: MemoryBankType) => {
    if (!user?.uid) return;

    if (type === 'personal') {
      setIsFetchingPersonalMemories(true);
      try {
        const response = await fetch('/api/agent-engine/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', type: 'personal' }),
        });
        if (response.ok) {
          const data = await response.json();
          setPersonalMemories((data.memories || []).map((m: any) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt,
            fullName: m.fullName,  // Include full Vertex AI resource name
            scope: 'personal' as const,
            sourceArtifactId: m.sourceArtifactId,
            sourceArtifactTitle: m.sourceArtifactTitle,
            sourceBrandId: m.sourceBrandId,
            insightElementType: m.insightElementType,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch personal memories:', err);
      } finally {
        setIsFetchingPersonalMemories(false);
      }
    } else {
      if (!brandId) return;
      setIsFetchingTeamMemories(true);
      try {
        const response = await fetch('/api/agent-engine/memories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', type: 'team', brandId }),
        });
        if (response.ok) {
          const data = await response.json();
          setTeamMemories((data.memories || []).map((m: any) => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt,
            fullName: m.fullName,  // Include full Vertex AI resource name
            scope: 'team' as const,
            sourceArtifactId: m.sourceArtifactId,
            sourceArtifactTitle: m.sourceArtifactTitle,
            sourceBrandId: m.sourceBrandId,
            insightElementType: m.insightElementType,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch team memories:', err);
      } finally {
        setIsFetchingTeamMemories(false);
      }
    }
  };

  // Fetch memories on mount if engines exist
  useEffect(() => {
    if (hasPersonalMemoryEngine) fetchMemories('personal');
  }, [hasPersonalMemoryEngine]);

  useEffect(() => {
    if (hasTeamMemoryEngine) fetchMemories('team');
  }, [hasTeamMemoryEngine]);

  const confirmDeleteMemory = async () => {
    if (!memoryToDelete || !user?.uid) return;
    const { memory, type } = memoryToDelete;

    setDeletingMemoryId(memory.id);
    setMemoryToDelete(null);

    // Optimistically remove from UI immediately
    if (type === 'personal') {
      setPersonalMemories(prev => prev.filter(m => m.id !== memory.id));
    } else {
      setTeamMemories(prev => prev.filter(m => m.id !== memory.id));
    }

    try {
      // Single delete call - backend handles both Vertex AI and Firestore deletion
      const deletePayload = {
        action: 'delete',
        memory_id: memory.id,
        full_name: memory.fullName,
        type,
        brandId: type === 'team' ? brandId : undefined
      };

      const response = await fetch('/api/agent-engine/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletePayload),
      });
      const data = await response.json();
      console.log('[Memory Delete] Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete memory');
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
      // Restore memory on error
      if (type === 'personal') {
        setPersonalMemories(prev => [...prev, memory]);
      } else {
        setTeamMemories(prev => [...prev, memory]);
      }
    } finally {
      setDeletingMemoryId(null);
    }
  };

  const handleClearAllMemories = async (type: MemoryBankType) => {
    if (!user?.uid) return;
    setIsClearingAll(true);
    try {
      const response = await fetch('/api/agent-engine/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear_all',
          type,
          brandId: type === 'team' ? brandId : undefined
        }),
      });
      if (response.ok) {
        if (type === 'personal') {
          setPersonalMemories([]);
        } else {
          setTeamMemories([]);
        }
        setConfirmAction(null);
      }
    } catch (err) {
      console.error('Failed to clear memories:', err);
    } finally {
      setIsClearingAll(false);
    }
  };

  const confirmDeleteByArtifact = async () => {
    if (!artifactToDelete || !user?.uid) return;
    const { artifactId, type } = artifactToDelete;

    setDeletingArtifactId(artifactId);
    setArtifactToDelete(null);

    // Optimistically remove from UI immediately
    if (type === 'personal') {
      setPersonalMemories(prev => prev.filter(m => m.sourceArtifactId !== artifactId));
    } else {
      setTeamMemories(prev => prev.filter(m => m.sourceArtifactId !== artifactId));
    }

    try {
      const response = await fetch('/api/agent-engine/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_by_artifact',
          source_artifact_id: artifactId,
          type,
          brandId: type === 'team' ? brandId : undefined
        }),
      });
      const data = await response.json();
      console.log('[Delete By Artifact] Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete memories');
      }
    } catch (err) {
      console.error('Failed to delete memories by artifact:', err);
      // Refresh memories to restore state
      fetchMemories(type);
    } finally {
      setDeletingArtifactId(null);
    }
  };

  const toggleMemoryExpansion = (id: string) => {
    setExpandedMemories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateEngine = async (type: MemoryBankType) => {
    if (type === 'personal') {
      setIsLoadingPersonal(true);
      setErrorPersonal(null);
      try {
        const response = await fetch('/api/agent-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'personal' }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create personal memory engine.');
        }
        const data = await response.json();
        // CRITICAL: Update local state immediately for instant UI update (like Team)
        personalEngineManuallySet.current = true;  // Mark as manually set
        setPersonalAgentEngineId(data.agentEngineId);
        // Also refresh user profile for consistency
        await refreshUserProfile();
      } catch (err: any) {
        setErrorPersonal(err.message);
      } finally {
        setIsLoadingPersonal(false);
      }
    } else {
      if (!brandId) {
        setErrorTeam('Brand ID is required.');
        return;
      }
      setIsLoadingTeam(true);
      setErrorTeam(null);
      try {
        const response = await fetch('/api/agent-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'team', brandId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create team memory engine.');
        }
        const data = await response.json();
        // Update local state immediately for instant UI update
        setTeamAgentEngineId(data.teamAgentEngineId);
      } catch (err: any) {
        setErrorTeam(err.message);
      } finally {
        setIsLoadingTeam(false);
      }
    }
  };

  const confirmDeleteEngine = async (type: MemoryBankType) => {
    if (type === 'personal') {
      setIsLoadingPersonal(true);
      setErrorPersonal(null);
      try {
        const response = await fetch('/api/agent-engine', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'personal' }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete.');
        }
        setPersonalMemories([]);
        // CRITICAL: Update local state immediately for instant UI update (like Team)
        console.log('[PersonalMemory] Deletion successful - updating state');
        personalEngineManuallySet.current = true;  // Mark as manually set
        setPersonalAgentEngineId(null);
        console.log('[PersonalMemory] Local state set to null, hasEngine should be false');
        // Also refresh user profile for consistency
        await refreshUserProfile();
        console.log('[PersonalMemory] User profile refreshed');
      } catch (err: any) {
        setErrorPersonal(err.message);
      } finally {
        setIsLoadingPersonal(false);
        setConfirmAction(null);
      }
    } else {
      if (!brandId) return;
      setIsLoadingTeam(true);
      setErrorTeam(null);
      try {
        const response = await fetch('/api/agent-engine', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'team', brandId }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete.');
        }
        setTeamMemories([]);
        // Update local state immediately for instant UI update
        setTeamAgentEngineId(null);
      } catch (err: any) {
        setErrorTeam(err.message);
      } finally {
        setIsLoadingTeam(false);
        setConfirmAction(null);
      }
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Memory Bank Card Component
  const MemoryBankCard = ({
    type,
    icon: Icon,
    iconColor,
    title,
    description,
    hasEngine,
    engineId,
    memories,
    isLoading,
    isFetching,
    isExpanded,
    setIsExpanded,
    error,
    canManage
  }: {
    type: MemoryBankType;
    icon: typeof Users;
    iconColor: string;
    title: string;
    description: string;
    hasEngine: boolean;
    engineId: string | null | undefined;
    memories: Memory[];
    isLoading: boolean;
    isFetching: boolean;
    isExpanded: boolean;
    setIsExpanded: (v: boolean) => void;
    error: string | null;
    canManage: boolean;
  }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Compact Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                {hasEngine ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Active
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                    Not created
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 max-w-md">{description}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasEngine && (
              <>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                  {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => fetchMemories(type)}
                      disabled={isFetching}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh memories</TooltipContent>
                </Tooltip>
                {canManage && memories.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-amber-50 hover:text-amber-600"
                        onClick={() => setConfirmAction({ type: 'clear', bank: type })}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear all memories</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {hasEngine ? (
                    <DropdownMenuItem
                      onClick={() => setConfirmAction({ type: 'deleteEngine', bank: type })}
                      className="text-red-600"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                      Delete memory bank
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleCreateEngine(type)} disabled={isLoading}>
                      <Plus className="w-3.5 h-3.5 mr-2" />
                      {isLoading ? 'Creating...' : 'Create memory bank'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Confirmation Dialog for Clear All / Delete Engine - Now in header area */}
        {confirmAction && confirmAction.bank === type && (
          <div className="px-4 py-3 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-800 font-medium mb-2">
              {confirmAction.type === 'clear'
                ? `Clear all ${type} memories? This cannot be undone.`
                : `Delete ${type} memory bank? All memories will be lost.`}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => confirmAction.type === 'clear'
                  ? handleClearAllMemories(type)
                  : confirmDeleteEngine(type)}
                disabled={isClearingAll || isLoading}
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
              >
                {isClearingAll || isLoading ? 'Processing...' : 'Confirm'}
              </Button>
              <Button
                onClick={() => setConfirmAction(null)}
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Individual Memory Deletion - Now in header area */}
        {memoryToDelete && memoryToDelete.type === type && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
            <p className="text-xs text-amber-800 font-medium mb-1">Delete this memory?</p>
            <p className="text-xs text-amber-700 mb-2 line-clamp-2">
              "{memoryToDelete.memory.content.substring(0, 100)}{memoryToDelete.memory.content.length > 100 ? '...' : ''}"
            </p>
            <div className="flex gap-2">
              <Button
                onClick={confirmDeleteMemory}
                disabled={!!deletingMemoryId}
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
              >
                {deletingMemoryId ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                onClick={() => setMemoryToDelete(null)}
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {hasEngine ? (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-2 bg-gray-50/50 hover:bg-gray-50 transition-colors border-b border-gray-100">
              <span className="text-xs font-medium text-gray-600">Stored Memories</span>
              <div className="flex items-center gap-2">
                {isFetching && <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />}
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {/* Artifact Delete Confirmation Dialog */}
            {artifactToDelete && artifactToDelete.type === type && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs text-amber-800 font-medium mb-1">
                  Remove all memories from "{artifactToDelete.artifactTitle}"?
                </p>
                <p className="text-xs text-amber-700 mb-2">
                  This will delete {artifactToDelete.count} {artifactToDelete.count === 1 ? 'memory' : 'memories'}.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={confirmDeleteByArtifact}
                    disabled={!!deletingArtifactId}
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                  >
                    {deletingArtifactId ? 'Deleting...' : 'Remove All'}
                  </Button>
                  <Button
                    onClick={() => setArtifactToDelete(null)}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-white"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3 max-h-96 overflow-y-auto">
              {memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">No memories yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {type === 'personal'
                      ? 'Chat with the agent to build memories'
                      : 'Team memories will appear here'}
                  </p>
                </div>
              ) : (() => {
                // Group memories by source artifact
                const memoriesBySource = memories.reduce((acc, memory) => {
                  const key = memory.sourceArtifactId || '_ungrouped';
                  if (!acc[key]) {
                    acc[key] = {
                      artifactId: memory.sourceArtifactId,
                      artifactTitle: memory.sourceArtifactTitle || 'Conversation memories',
                      memories: []
                    };
                  }
                  acc[key].memories.push(memory);
                  return acc;
                }, {} as Record<string, { artifactId?: string; artifactTitle: string; memories: Memory[] }>);

                const sortedGroups = Object.values(memoriesBySource).sort((a, b) => {
                  // Put ungrouped (conversation) memories first
                  if (!a.artifactId) return -1;
                  if (!b.artifactId) return 1;
                  return a.artifactTitle.localeCompare(b.artifactTitle);
                });

                return (
                  <div className="space-y-4">
                    {sortedGroups.map((group) => (
                      <div key={group.artifactId || '_ungrouped'} className="space-y-2">
                        {/* Source header with delete option */}
                        <div className="flex items-center justify-between gap-2 pb-1 border-b border-gray-100">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="text-[10px] font-medium text-gray-500 truncate">
                              {group.artifactTitle}
                            </span>
                            <span className="text-[10px] text-gray-400 shrink-0">
                              ({group.memories.length})
                            </span>
                          </div>
                          {canManage && group.artifactId && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setArtifactToDelete({
                                    artifactId: group.artifactId!,
                                    artifactTitle: group.artifactTitle,
                                    type,
                                    count: group.memories.length
                                  })}
                                  disabled={deletingArtifactId === group.artifactId}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">Remove all from this source</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {/* Memories in this group */}
                        {group.memories.map((memory) => {
                          const isMemoryExpanded = expandedMemories.has(memory.id);
                          const needsExpansion = memory.content.length > 120;
                          const displayContent = isMemoryExpanded || !needsExpansion
                            ? memory.content
                            : `${memory.content.substring(0, 120)}...`;
                          const isDeleting = deletingMemoryId === memory.id;

                          return (
                            <div
                              key={memory.id}
                              className={`group relative bg-gray-50 rounded-lg p-3 hover:bg-gray-100/80 transition-colors ${isDeleting ? 'opacity-50' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {displayContent}
                                  </p>
                                  {needsExpansion && (
                                    <button
                                      onClick={() => toggleMemoryExpansion(memory.id)}
                                      className="text-[10px] text-teal-600 hover:text-teal-700 font-medium mt-1"
                                    >
                                      {isMemoryExpanded ? 'Show less' : 'Show more'}
                                    </button>
                                  )}
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <Clock className="w-2.5 h-2.5 text-gray-400" />
                                    <span className="text-[10px] text-gray-400">
                                      {formatRelativeTime(memory.createdAt)}
                                    </span>
                                  </div>
                                </div>

                                {canManage && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => setMemoryToDelete({ memory, type })}
                                        disabled={isDeleting}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      <p className="text-xs">Delete memory</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="p-4">
          {canManage ? (
            <button
              onClick={() => handleCreateEngine(type)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Create Memory Bank</span>
                </>
              )}
            </button>
          ) : (
            <p className="text-xs text-gray-500 text-center py-4">
              Ask a manager to create the {type} memory bank
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Memory Banks</h2>
            <p className="text-xs text-gray-500">AI-powered memory for personalized assistance</p>
          </div>
        </div>

        {/* Memory Bank Cards */}
        <MemoryBankCard
          type="team"
          icon={Users}
          iconColor="bg-blue-100 text-blue-600"
          title="Team Memory"
          description="Shared across all team members"
          hasEngine={hasTeamMemoryEngine}
          engineId={teamAgentEngineId}
          memories={teamMemories}
          isLoading={isLoadingTeam}
          isFetching={isFetchingTeamMemories}
          isExpanded={teamMemoriesExpanded}
          setIsExpanded={setTeamMemoriesExpanded}
          error={errorTeam}
          canManage={isManager}
        />

        <MemoryBankCard
          type="personal"
          icon={User}
          iconColor="bg-violet-100 text-violet-600"
          title="Personal Memory"
          description="Private memories only you can access"
          hasEngine={hasPersonalMemoryEngine}
          engineId={personalAgentEngineId}
          memories={personalMemories}
          isLoading={isLoadingPersonal}
          isFetching={isFetchingPersonalMemories}
          isExpanded={personalMemoriesExpanded}
          setIsExpanded={setPersonalMemoriesExpanded}
          error={errorPersonal}
          canManage={true}
        />
      </div>
    </TooltipProvider>
  );
}
