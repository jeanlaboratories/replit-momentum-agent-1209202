'use client';

import { useState, useEffect, useId } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  MessageSquare, 
  MoreHorizontal, 
  Edit3, 
  Trash2, 
  Flag,
  Reply,
  ThumbsUp,
  Check,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Comment, FlagReason } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { 
  validateCommentBody, 
  validateFlagNotes,
  validateFlagReason,
  validateEditWindow,
  getValidationErrorMessage,
  isValidationError,
  COMMENT_CONSTRAINTS 
} from '@/lib/validation/commentValidation';
import { getUserInitials } from '@/lib/utils/comment-utils';

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  onReply?: (commentId: string) => void;
  onEdit?: (commentId: string, newBody: string) => Promise<{ success: boolean; message: string }>;
  onDelete?: (commentId: string) => Promise<{ success: boolean; message: string }>;
  onFlag?: (commentId: string, reason: FlagReason, notes?: string) => Promise<{ success: boolean; message: string }>;
  showActions?: boolean;
  className?: string;
}

export function CommentItem({
  comment,
  isReply = false,
  onReply,
  onEdit,
  onDelete,
  onFlag,
  showActions = true,
  className = ''
}: CommentItemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Generate unique IDs for this comment instance
  const editCharCountId = useId();
  const flagReasonSelectId = useId();
  const flagNotesTextareaId = useId();
  const flagNotesCharCountId = useId();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState<FlagReason>('inappropriate');
  const [flagNotes, setFlagNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if user can edit/delete (simplified - will enhance with role checking later)
  const canEdit = user?.uid === comment.createdBy;
  const canDelete = canEdit;
  const canFlag = user?.uid !== comment.createdBy;

  // Check if comment is within edit window
  const createdAt = new Date(comment.createdAt);
  const now = new Date();
  const editWindowMs = COMMENT_CONSTRAINTS.EDIT_WINDOW_MINUTES * 60 * 1000;
  const editWindowAgo = new Date(now.getTime() - editWindowMs);
  const isWithinEditWindow = createdAt > editWindowAgo;
  const canActuallyEdit = canEdit && isWithinEditWindow;

  const handleEdit = async () => {
    if (!onEdit) return;

    // Validate edit window
    const editWindowResult = validateEditWindow(comment.createdAt);
    if (isValidationError(editWindowResult)) {
      toast({
        title: "Edit Window Expired",
        description: getValidationErrorMessage(editWindowResult.error),
        variant: "destructive"
      });
      return;
    }

    // Validate comment body
    const validationResult = validateCommentBody(editBody);
    if (isValidationError(validationResult)) {
      toast({
        title: "Invalid Comment",
        description: getValidationErrorMessage(validationResult.error),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await onEdit(comment.id, validationResult.data);
      if (result.success) {
        setIsEditing(false);
      toast({
        title: "Success",
        description: "Comment updated successfully."
      });
      } else {
      toast({
        title: "Failed to edit comment",
        description: result.message,
        variant: "destructive"
      });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while editing the comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsLoading(true);
    try {
      const result = await onDelete(comment.id);
      if (result.success) {
      toast({
        title: "Success",
        description: "Comment deleted successfully."
      });
      } else {
      toast({
        title: "Failed to delete comment",
        description: result.message,
        variant: "destructive"
      });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while deleting the comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlag = async () => {
    if (!onFlag) return;

    // Validate flag reason
    const reasonResult = validateFlagReason(flagReason);
    if (isValidationError(reasonResult)) {
      toast({
        title: "Invalid Flag Reason",
        description: getValidationErrorMessage(reasonResult.error),
        variant: "destructive"
      });
      return;
    }

    // Validate flag notes
    const notesResult = validateFlagNotes(flagNotes);
    if (isValidationError(notesResult)) {
      toast({
        title: "Invalid Flag Notes",
        description: getValidationErrorMessage(notesResult.error),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await onFlag(comment.id, reasonResult.data, notesResult.data);
      if (result.success) {
        setShowFlagDialog(false);
        setFlagNotes('');
      toast({
        title: "Success",
        description: "Comment flagged successfully. A moderator will review it."
      });
      } else {
      toast({
        title: "Failed to flag comment",
        description: result.message,
        variant: "destructive"
      });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong while flagging the comment. Please try again.",
        variant: "destructive"
      });
    } finally{
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditBody(comment.body);
  };

  const getStatusBadge = () => {
    switch (comment.status) {
      case 'edited':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-600 border-blue-500/20">Edited</Badge>;
      case 'flagged':
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-600 border-orange-500/20">Flagged</Badge>;
      case 'resolved':
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/20">Resolved</Badge>;
      case 'hidden':
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-600 border-red-500/20">Hidden</Badge>;
      default:
        return null;
    }
  };

  const getTimeDisplay = () => {
    const createdDate = new Date(comment.createdAt);
    const isRecent = (now.getTime() - createdDate.getTime()) < 24 * 60 * 60 * 1000;
    
    if (isRecent) {
      return formatDistanceToNow(createdDate, { addSuffix: true });
    } else {
      return format(createdDate, 'MMM d, yyyy');
    }
  };

  if (comment.status === 'deleted' && comment.createdBy !== user?.uid) {
    return null;
  }

  return (
    <>
      <div className={`group animate-comment-slide-in ${className}`}>
        <div className="comment-card-glass rounded-xl transition-all duration-300">
          <div className="p-4">
            <div className="flex items-start space-x-3">
              {/* Premium Avatar with Ring Effect */}
              <div className="comment-avatar-ring flex-shrink-0">
                <Avatar className="h-8 w-8 ring-2 ring-primary/10 ring-offset-1 ring-offset-background transition-all duration-300 group-hover:ring-primary/30">
                  <AvatarImage src={comment.createdByPhoto} alt={comment.createdByName} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20 text-foreground font-medium">
                    {getUserInitials(comment.createdByName)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 min-w-0">
                {/* Header with Premium Styling */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {comment.createdByName}
                    </span>
                    <span className="text-xs text-muted-foreground/70 flex-shrink-0">
                      {getTimeDisplay()}
                    </span>
                    {comment.editedAt && (
                      <span className="text-xs text-muted-foreground/50 flex-shrink-0 italic">
                        (edited)
                      </span>
                    )}
                    {getStatusBadge()}
                  </div>

                  {/* Premium Actions Menu */}
                  {showActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="comment-action-btn h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-2 flex-shrink-0 rounded-full hover:bg-primary/10"
                          aria-label="Comment actions menu"
                          aria-haspopup="menu"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 backdrop-blur-xl bg-card/95 border-border/50 shadow-xl">
                        {onReply && !isReply && (
                          <DropdownMenuItem onClick={() => onReply(comment.id)} className="cursor-pointer">
                            <Reply className="mr-2 h-4 w-4 text-primary" />
                            <span>Reply</span>
                          </DropdownMenuItem>
                        )}
                        {canActuallyEdit && (
                          <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                            <Edit3 className="mr-2 h-4 w-4 text-blue-500" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            onClick={handleDelete}
                            className="text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        )}
                        {canFlag && (
                          <DropdownMenuItem
                            onClick={() => setShowFlagDialog(true)}
                            className="text-orange-500 focus:text-orange-500 cursor-pointer"
                          >
                            <Flag className="mr-2 h-4 w-4" />
                            <span>Flag</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Content with Premium Typography */}
                <div className="mt-2">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="comment-input-premium rounded-lg overflow-hidden">
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          placeholder="Edit your comment..."
                          className="min-h-[80px] resize-none text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          maxLength={COMMENT_CONSTRAINTS.MAX_LENGTH}
                          aria-label="Edit comment text"
                          aria-describedby={editCharCountId}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span id={editCharCountId} className="text-xs text-muted-foreground/60" aria-live="polite">
                          {editBody.length}/{COMMENT_CONSTRAINTS.MAX_LENGTH}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={isLoading}
                            className="h-8 px-3 text-xs rounded-full hover:bg-muted/50"
                            aria-label="Cancel editing comment"
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleEdit}
                            disabled={isLoading || !editBody.trim()}
                            className="h-8 px-3 text-xs rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20"
                            aria-label={isLoading ? "Saving comment..." : !editBody.trim() ? "Enter text to save changes" : "Save comment changes"}
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-foreground/90 leading-relaxed">
                      {comment.status === 'deleted' ? (
                        <span className="italic text-muted-foreground/60">[This comment has been deleted]</span>
                      ) : (
                        <p className="whitespace-pre-wrap">{comment.body}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Premium Quick Actions */}
                {!isEditing && showActions && comment.status !== 'deleted' && (
                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/30">
                    {onReply && !isReply && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReply(comment.id)}
                        className="comment-action-btn h-7 px-2 text-xs text-muted-foreground hover:text-primary rounded-full hover:bg-primary/10 transition-all duration-200"
                      >
                        <Reply className="h-3.5 w-3.5 mr-1.5" />
                        Reply
                      </Button>
                    )}

                    {comment.flagCount > 0 && (
                      <div className="flex items-center text-xs text-orange-500/80 bg-orange-500/10 px-2 py-1 rounded-full">
                        <Flag className="h-3 w-3 mr-1" />
                        <span className="font-medium">{comment.flagCount}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Flag Dialog */}
      <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
        <DialogContent className="sm:max-w-md backdrop-blur-xl bg-card/95 border-border/50 shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20">
                <Flag className="h-5 w-5 text-orange-500" />
              </div>
              <DialogTitle className="text-lg font-semibold">Report Comment</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground/80">
              Help maintain a positive community. Your report will be reviewed by our team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label htmlFor={flagReasonSelectId} className="text-sm font-medium text-foreground/90">What&apos;s the issue?</label>
              <Select value={flagReason} onValueChange={(value) => setFlagReason(value as FlagReason)}>
                <SelectTrigger id={flagReasonSelectId} className="h-11 bg-muted/30 border-border/50 focus:ring-orange-500/20" aria-label="Select reason for flagging this comment">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-card/95 border-border/50">
                  <SelectItem value="inappropriate" className="cursor-pointer">Inappropriate content</SelectItem>
                  <SelectItem value="spam" className="cursor-pointer">Spam or advertising</SelectItem>
                  <SelectItem value="off_topic" className="cursor-pointer">Off topic</SelectItem>
                  <SelectItem value="harassment" className="cursor-pointer">Harassment or bullying</SelectItem>
                  <SelectItem value="other" className="cursor-pointer">Something else</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor={flagNotesTextareaId} className="text-sm font-medium text-foreground/90">Tell us more <span className="text-muted-foreground/60 font-normal">(optional)</span></label>
              <div className="comment-input-premium rounded-lg overflow-hidden">
                <Textarea
                  id={flagNotesTextareaId}
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  placeholder="Any additional context that might help our review..."
                  className="min-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  maxLength={500}
                  aria-describedby={flagNotesCharCountId}
                />
              </div>
              <div id={flagNotesCharCountId} className="text-xs text-muted-foreground/50 text-right" aria-live="polite">
                {flagNotes.length}/500
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowFlagDialog(false)}
              disabled={isLoading}
              className="rounded-full hover:bg-muted/50"
              aria-label="Cancel flagging comment"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFlag}
              disabled={isLoading}
              className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg shadow-orange-500/20 text-white border-0"
              aria-label={isLoading ? "Submitting flag..." : "Submit flag for this comment"}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
