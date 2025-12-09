'use client';

import { useState, useCallback } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { Comment, CommentThread as CommentThreadType, CommentUIState } from '@/lib/types';

interface CommentThreadProps {
  brandId: string;
  threads: CommentThreadType[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  uiState: CommentUIState;
  onAddComment: (body: string, parentId?: string) => Promise<{ success: boolean; message: string }>;
  onEditComment: (commentId: string, newBody: string) => Promise<{ success: boolean; message: string }>;
  onDeleteComment: (commentId: string) => Promise<{ success: boolean; message: string }>;
  onFlagComment: (commentId: string, reason: string, notes?: string) => Promise<{ success: boolean; message: string }>;
  onLoadMore?: () => void;
  onLoadMoreReplies?: (parentCommentId: string) => void;
  onSetReplyingTo: (commentId?: string) => void;
  onSetEditingComment: (commentId?: string) => void;
  onSetFlaggingComment: (commentId?: string) => void;
  totalComments?: number;
  className?: string;
}

export function CommentThread({
  brandId,
  threads,
  loading = false,
  error = null,
  hasMore = false,
  uiState,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onFlagComment,
  onLoadMore,
  onLoadMoreReplies,
  onSetReplyingTo,
  onSetEditingComment,
  onSetFlaggingComment,
  totalComments = 0,
  className = ''
}: CommentThreadProps) {
  const [showNewCommentForm, setShowNewCommentForm] = useState(false);

  const handleAddComment = useCallback(async (body: string, parentId?: string) => {
    const result = await onAddComment(body, parentId);
    if (result.success) {
      setShowNewCommentForm(false);
      onSetReplyingTo(undefined);
    }
    return result;
  }, [onAddComment, onSetReplyingTo]);

  return (
    <div className={`w-full ${className}`}>
      {/* Premium Header */}
      <div className="comment-card-glass rounded-xl overflow-hidden">
        <div className="comment-panel-header flex items-center justify-between p-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-sm text-foreground">Discussion</span>
              {totalComments > 0 && (
                <Badge className="ml-2 comment-badge-premium text-xs px-2 py-0.5 rounded-full">
                  {totalComments}
                </Badge>
              )}
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setShowNewCommentForm(!showNewCommentForm)}
            className={`h-9 text-xs px-4 rounded-full transition-all duration-300 ${
              showNewCommentForm
                ? 'bg-muted/50 text-foreground hover:bg-muted/70 border border-border/50'
                : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20 text-white'
            }`}
            aria-label={showNewCommentForm ? "Cancel adding new comment" : "Add a new comment"}
            aria-expanded={showNewCommentForm}
          >
            {showNewCommentForm ? 'Cancel' : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                New Comment
              </>
            )}
          </Button>
        </div>

        {/* New Comment Form */}
        {showNewCommentForm && (
          <div className="p-4 pt-0 animate-comment-slide-in">
            <CommentForm
              brandId={brandId}
              onSubmit={(body) => handleAddComment(body)}
              onCancel={() => setShowNewCommentForm(false)}
              placeholder="Start a new conversation..."
              buttonText="Post"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Comments List - Premium Scrollable Container */}
      <div className="mt-4">
        {/* Error State */}
        {error && (
          <div className="comment-card-glass rounded-xl p-4 border-destructive/20 animate-comment-fade-in">
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2 rounded-lg bg-destructive/10">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Failed to load comments</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && threads.length === 0 && (
          <div className="comment-card-glass rounded-xl p-6 animate-comment-fade-in">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary/30 border-t-primary" />
              <span className="text-sm text-muted-foreground">Loading conversation...</span>
            </div>
          </div>
        )}

        {/* Premium Empty State */}
        {!loading && threads.length === 0 && !error && (
          <div className="comment-empty-state rounded-xl p-8 text-center animate-comment-fade-in">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-xl" />
              <div className="relative p-4 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 mb-4">
                <MessageSquare className="h-8 w-8 text-primary/60" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-foreground/80 mb-1">No comments yet</h3>
            <p className="text-xs text-muted-foreground/60 max-w-[200px] mx-auto">
              Be the first to share your thoughts and start the conversation.
            </p>
          </div>
        )}

        {/* Premium Scrollable Comments Container */}
        {threads.length > 0 && (
          <div
            className="space-y-3 max-h-[450px] overflow-y-auto overscroll-contain comment-scroll-container pr-1"
          >
            {threads.map((thread, index) => (
              <div
                key={thread.id}
                className="space-y-3"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Main Comment */}
                <CommentItem
                  comment={thread}
                  onReply={onSetReplyingTo}
                  onEdit={onEditComment}
                  onDelete={onDeleteComment}
                  onFlag={onFlagComment}
                />

                {/* Reply Form */}
                {uiState.replyingTo === thread.id && (
                  <div className="ml-6 comment-thread-line pl-4 animate-comment-slide-in">
                    <CommentForm
                      brandId={brandId}
                      onSubmit={(body) => handleAddComment(body, thread.id)}
                      onCancel={() => onSetReplyingTo(undefined)}
                      placeholder={`Reply to ${thread.createdByName}...`}
                      buttonText="Reply"
                      isReply
                      parentCommentId={thread.id}
                      autoFocus
                    />
                  </div>
                )}

                {/* Replies */}
                {thread.replies && thread.replies.length > 0 && (
                  <div className="ml-6 comment-thread-line pl-4 space-y-3">
                    {thread.replies.map((reply, replyIndex) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        isReply
                        onEdit={onEditComment}
                        onDelete={onDeleteComment}
                        onFlag={onFlagComment}
                        className="animate-comment-slide-in"
                      />
                    ))}

                    {/* Load More Replies */}
                    {thread.hasMoreReplies && onLoadMoreReplies && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onLoadMoreReplies(thread.id)}
                        className="h-8 text-xs text-primary hover:text-primary/80 hover:bg-primary/5 rounded-full px-3 transition-all duration-200"
                        aria-label={`Load ${thread.replyCount - (thread.replies?.length || 0)} more replies to this comment`}
                      >
                        <span className="mr-1.5">+</span>
                        Load {thread.replyCount - (thread.replies?.length || 0)} more replies
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Load More Comments */}
            {hasMore && onLoadMore && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={loading}
                  className="h-9 text-xs px-6 rounded-full border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all duration-200"
                  aria-label={loading ? "Loading more comments..." : "Load more comments"}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary/30 border-t-primary mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More Comments'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
