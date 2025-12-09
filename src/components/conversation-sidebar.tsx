'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Archive, ArchiveRestore, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useGlobalChatbot, DEFAULT_CONVERSATION_ID } from '@/contexts/global-chatbot-context';
import type { ConversationListItem } from '@/lib/types/conversation';

interface ConversationSidebarProps {
  brandId: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  brandId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const {
    currentConversationId,
    setCurrentConversationId,
    conversations,
    setConversations,
    isConversationSidebarOpen,
    closeConversationSidebar,
    conversationRefreshKey,
  } = useGlobalChatbot();

  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!brandId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/chat/conversations?brandId=${brandId}&includeArchived=${showArchived}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.conversations) {
          setConversations(data.conversations);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [brandId, showArchived, setConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, conversationRefreshKey]);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.conversation) {
          // Add to local list and select it
          setConversations([
            {
              id: data.conversation.id,
              title: data.conversation.title,
              preview: '',
              messageCount: 0,
              updatedAt: data.conversation.updatedAt,
              isArchived: false,
            },
            ...conversations,
          ]);
          setCurrentConversationId(data.conversation.id);
          onNewConversation();
          closeConversationSidebar();
        }
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Select conversation
  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    onSelectConversation(conversationId);
    closeConversationSidebar();
  };

  // Start editing title
  const handleStartEdit = (conv: ConversationListItem) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  // Save edited title
  const handleSaveEdit = async (conversationId: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          conversationId,
          title: editTitle.trim(),
        }),
      });

      if (response.ok) {
        setConversations(
          conversations.map((c) =>
            c.id === conversationId ? { ...c, title: editTitle.trim() } : c
          )
        );
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    } finally {
      setEditingId(null);
    }
  };

  // Archive/unarchive conversation
  const handleToggleArchive = async (conversationId: string, archive: boolean) => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          conversationId,
          isArchived: archive,
        }),
      });

      if (response.ok) {
        if (!showArchived && archive) {
          // Remove from list if archiving and not showing archived
          setConversations(conversations.filter((c) => c.id !== conversationId));
          // If this was the current conversation, switch to default
          if (currentConversationId === conversationId) {
            setCurrentConversationId(DEFAULT_CONVERSATION_ID);
            onSelectConversation(DEFAULT_CONVERSATION_ID);
          }
        } else {
          // Update in place
          setConversations(
            conversations.map((c) =>
              c.id === conversationId ? { ...c, isArchived: archive } : c
            )
          );
        }
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  // Delete conversation
  const handleDelete = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/chat/conversations?brandId=${brandId}&conversationId=${conversationId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setConversations(conversations.filter((c) => c.id !== conversationId));
        // If this was the current conversation, switch to default
        if (currentConversationId === conversationId) {
          setCurrentConversationId(DEFAULT_CONVERSATION_ID);
          onSelectConversation(DEFAULT_CONVERSATION_ID);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
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

  if (!isConversationSidebarOpen) {
    return null;
  }

  return (
    <div className="w-72 bg-background border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">Conversations</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeConversationSidebar}
          className="h-7 w-7"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b">
        <Button
          onClick={handleNewConversation}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
      </div>

      {/* Current Chat Option */}
      <div className="px-3 py-2">
        <button
          onClick={() => handleSelectConversation(DEFAULT_CONVERSATION_ID)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
            currentConversationId === DEFAULT_CONVERSATION_ID
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-accent'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="truncate">Current Session</span>
        </button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No saved conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'group flex flex-col rounded-md transition-colors overflow-hidden min-w-0',
                  currentConversationId === conv.id
                    ? 'bg-primary/10'
                    : 'hover:bg-accent'
                )}
              >
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1 p-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleSaveEdit(conv.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleSelectConversation(conv.id)}
                      className="flex flex-col items-start px-3 py-2 text-left w-full overflow-hidden"
                    >
                      <span className="text-sm font-medium truncate w-full">
                        {conv.title}
                      </span>
                      {conv.preview && (
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {conv.preview}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(conv.updatedAt)}
                        {conv.messageCount > 0 && ` • ${conv.messageCount} msgs`}
                      </span>
                    </button>

                    {/* Actions - visible on hover */}
                    <div className="hidden group-hover:flex items-center gap-1 px-2 pb-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(conv);
                        }}
                        title="Rename"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleArchive(conv.id, !conv.isArchived);
                        }}
                        title={conv.isArchived ? 'Unarchive' : 'Archive'}
                      >
                        {conv.isArchived ? (
                          <ArchiveRestore className="h-3 w-3" />
                        ) : (
                          <Archive className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(conv.id);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer - Show archived toggle */}
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Button>
      </div>
    </div>
  );
}
