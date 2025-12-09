'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommentThread } from './CommentThread';
import { useComments } from '@/hooks/use-comments';
import { CommentContextType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

// Static utility functions moved outside component for performance
const getContextTitle = (contextType: CommentContextType, customTitle?: string): string => {
  if (customTitle) return customTitle;
  
  switch (contextType) {
    case 'campaign':
      return 'Initiative Discussion';
    case 'contentBlock':
      return 'Content Block Feedback';
    case 'image':
      return 'Image Comments';
    case 'video':
      return 'Video Feedback';
    case 'brandProfile':
      return 'Team Profile Discussion';
    default:
      return 'Comments';
  }
};

const getContextDescription = (contextType: CommentContextType, customDescription?: string): string => {
  if (customDescription) return customDescription;
  
  switch (contextType) {
    case 'campaign':
      return 'Discuss strategy, content ideas, and initiative improvements';
    case 'contentBlock':
      return 'Provide feedback on content, copy, and creative direction';
    case 'image':
      return 'Share thoughts on image composition, branding, and messaging';
    case 'video':
      return 'Comment on video content, pacing, and visual appeal';
    case 'brandProfile':
      return 'Discuss team identity, messaging, and positioning';
    default:
      return 'Share your thoughts and collaborate with your team';
  }
};

interface CommentPanelProps {
  brandId: string;
  contextType: CommentContextType;
  contextId: string;
  title?: string;
  description?: string;
  className?: string;
  initiallyExpanded?: boolean;
  showInline?: boolean; // Whether to show inline or as a collapsible panel
  variant?: 'default' | 'clean' | 'sidebar';
}

export function CommentPanel({
  brandId,
  contextType,
  contextId,
  title,
  description,
  className = '',
  initiallyExpanded = false,
  showInline = false,
  variant = 'default'
}: CommentPanelProps) {
  const { user } = useAuth();
  const {
    comments,
    context,
    loading,
    error,
    hasMore,
    uiState,
    addComment,
    editComment,
    removeComment,
    flagComment,
    loadMoreComments,
    loadMoreReplies,
    toggleComments,
    setFilter,
    setReplyingTo,
    setEditingComment,
    setFlaggingComment,
    refresh
  } = useComments(brandId, contextType, contextId, {
    enabled: !!user
  });

  // Set initial state based on prop
  const hasHandledInitialExpansion = useRef(false);

  // Set initial state based on prop
  useEffect(() => {
    if (initiallyExpanded && !hasHandledInitialExpansion.current) {
      if (!uiState.showComments) {
        toggleComments();
      }
      hasHandledInitialExpansion.current = true;
    }
  }, [initiallyExpanded, uiState.showComments, toggleComments]);

  // Memoize computed values
  const contextTitle = useMemo(() => getContextTitle(contextType, title), [contextType, title]);
  const contextDescription = useMemo(() => getContextDescription(contextType, description), [contextType, description]);

  // If user is not authenticated, show a premium minimal state
  if (!user) {
    return (
      <div className={`comment-card-glass rounded-xl ${className}`}>
        <div className="p-6">
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-xl" />
              <div className="relative p-4 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10">
                <MessageSquare className="h-8 w-8 text-primary/60" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70">Sign in to view and add comments</p>
          </div>
        </div>
      </div>
    );
  }

  // Inline or Sidebar version (always expanded, minimal UI)
  if (showInline || variant === 'sidebar') {
    const isSidebar = variant === 'sidebar';

    return (
      <div className={`${isSidebar ? 'h-full flex flex-col' : 'space-y-4'} ${className}`}>
        {/* Error state only when needed */}
        {error && (
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-full mb-2"
            aria-label="Retry loading comments due to error"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Retry
          </Button>
        )}

        {/* Comments content */}
        <div className={`${isSidebar ? 'flex-1' : ''}`}>
          <CommentThread
            brandId={brandId}
            threads={comments}
            loading={loading}
            error={error}
            hasMore={hasMore}
            uiState={{ ...uiState, showComments: true }}
            onAddComment={addComment}
            onEditComment={editComment}
            onDeleteComment={removeComment}
            onFlagComment={flagComment}
            onLoadMore={loadMoreComments}
            onLoadMoreReplies={loadMoreReplies}
            onSetReplyingTo={setReplyingTo}
            onSetEditingComment={setEditingComment}
            onSetFlaggingComment={setFlaggingComment}
            totalComments={context?.activeComments || 0}
          />
        </div>
      </div>
    );
  }

  // Panel version (collapsible) - Premium Design
  return (
    <div className={`comment-card-glass rounded-xl overflow-hidden ${className}`}>
      <div className="comment-panel-header p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/10 flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {contextTitle}
                </h3>
                {context && (context.activeComments > 0 || context.flaggedComments > 0) && (
                  <div className="flex items-center gap-1.5">
                    {context.activeComments > 0 && (
                      <Badge className="comment-badge-premium text-xs px-2 py-0.5 rounded-full">
                        {context.activeComments}
                      </Badge>
                    )}
                    {context.flaggedComments > 0 && (
                      <Badge className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
                        {context.flaggedComments} flagged
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {contextDescription}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {error && (
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                className="h-9 w-9 p-0 rounded-full text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                aria-label="Retry loading comments"
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={toggleComments}
              className="h-9 px-4 rounded-full border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all duration-200"
              aria-label={uiState.showComments ? 'Collapse comments section' : 'Expand comments section'}
              aria-expanded={uiState.showComments}
            >
              {uiState.showComments ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </div>

      {uiState.showComments && (
        <div className="p-4 pt-0 animate-comment-slide-in">
          <CommentThread
            brandId={brandId}
            threads={comments}
            loading={loading}
            error={error}
            hasMore={hasMore}
            uiState={uiState}
            onAddComment={addComment}
            onEditComment={editComment}
            onDeleteComment={removeComment}
            onFlagComment={flagComment}
            onLoadMore={loadMoreComments}
            onLoadMoreReplies={loadMoreReplies}
            onSetReplyingTo={setReplyingTo}
            onSetEditingComment={setEditingComment}
            onSetFlaggingComment={setFlaggingComment}
            totalComments={context?.totalComments || 0}
          />
        </div>
      )}
    </div>
  );
}

// Convenience components for specific contexts
export function CampaignComments(props: Omit<CommentPanelProps, 'contextType'>) {
  return <CommentPanel {...props} contextType="campaign" />;
}

export function ContentBlockComments(props: Omit<CommentPanelProps, 'contextType'>) {
  return <CommentPanel {...props} contextType="contentBlock" />;
}

export function ImageComments(props: Omit<CommentPanelProps, 'contextType'>) {
  return <CommentPanel {...props} contextType="image" />;
}

export function VideoComments(props: Omit<CommentPanelProps, 'contextType'>) {
  return <CommentPanel {...props} contextType="video" />;
}

export function BrandProfileComments(props: Omit<CommentPanelProps, 'contextType'>) {
  return <CommentPanel {...props} contextType="brandProfile" />;
}