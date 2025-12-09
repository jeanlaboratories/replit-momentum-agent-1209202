'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CommentPanel } from '@/components/comments/CommentPanel';
import { CommentContextType } from '@/lib/types';
import { getBrandEngagementAction } from '@/app/actions/engagement-actions';

interface CommentInteractionProps {
  assetId: string;
  brandId: string;
  initialCount: number;
  contextType: CommentContextType;
  className?: string;
  iconClassName?: string;
  assetName?: string;
  onCommentCountChange?: (count: number) => void;
}

export function CommentInteraction({
  assetId,
  brandId,
  initialCount,
  contextType,
  className = '',
  iconClassName = 'w-5 h-5',
  assetName = 'Asset',
  onCommentCountChange,
}: CommentInteractionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(initialCount);

  // Update count when initialCount prop changes
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // Refresh count when dialog closes (user may have added comments)
  const handleOpenChange = useCallback(async (open: boolean) => {
    setIsOpen(open);

    // When dialog closes, refresh the count
    if (!open) {
      try {
        const result = await getBrandEngagementAction(brandId);
        if (result.success && result.data) {
          const newCount = result.data.commentCounts[assetId] || 0;
          setCount(newCount);
          onCommentCountChange?.(newCount);
        }
      } catch (error) {
        console.error('Failed to refresh comment count:', error);
      }
    }
  }, [brandId, assetId, onCommentCountChange]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div
          className={`comment-action-btn flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-primary transition-all duration-200 rounded-full px-2 py-1 hover:bg-primary/5 ${className}`}
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering parent click events (e.g., opening preview)
            setIsOpen(true);
          }}
        >
          <MessageCircle className={`${iconClassName} transition-transform duration-200 group-hover:scale-110`} />
          <span className="text-sm font-medium">{count}</span>
        </div>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 gap-0 backdrop-blur-xl bg-card/98 border-border/50 shadow-2xl rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside dialog
      >
        <DialogHeader className="comment-panel-header p-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">Comments</DialogTitle>
              <p className="text-sm text-muted-foreground/70 mt-0.5">{assetName}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-5 pt-2 comment-scroll-container">
          <CommentPanel
            brandId={brandId}
            contextType={contextType}
            contextId={assetId}
            showInline={true}
            variant="default"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
