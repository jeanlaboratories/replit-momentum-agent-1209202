'use client';

import { useState, useId, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { 
  validateCommentBody, 
  getValidationErrorMessage,
  isValidationError,
  COMMENT_CONSTRAINTS 
} from '@/lib/validation/commentValidation';
import { getUserInitials } from '@/lib/utils/comment-utils';
import { MentionTextarea } from './MentionTextarea';
import { getTeamMembersForMentions, MentionUser } from '@/app/actions/get-team-members-for-mentions';

interface CommentFormProps {
  brandId: string;
  onSubmit: (body: string) => Promise<{ success: boolean; message: string }>;
  onCancel?: () => void;
  placeholder?: string;
  buttonText?: string;
  isReply?: boolean;
  parentCommentId?: string;
  className?: string;
  autoFocus?: boolean;
}

export function CommentForm({
  brandId,
  onSubmit,
  onCancel,
  placeholder = "Write a comment...",
  buttonText = "Comment",
  isReply = false,
  parentCommentId,
  className = '',
  autoFocus = false
}: CommentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<MentionUser[]>([]);
  
  // Generate unique IDs for this form instance
  const charCountId = useId();
  const tipsId = useId();

  // Fetch team members for mentions
  useEffect(() => {
    async function loadTeamMembers() {
      const members = await getTeamMembersForMentions(brandId);
      setTeamMembers(members);
    }
    loadTeamMembers();
  }, [brandId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate comment body using the new validation system
    const validationResult = validateCommentBody(body);
    
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
      // Use the validated body
      const result = await onSubmit(validationResult.data);
      
      if (result.success) {
        setBody('');
        if (onCancel) {
          onCancel(); // Close reply form after successful submission
        }
      toast({
        title: "Success",
        description: isReply ? "Reply posted successfully." : "Comment posted successfully."
      });
      } else {
      toast({
        title: "Failed to post comment",
        description: result.message,
        variant: "destructive"
      });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Something went wrong while posting your comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setBody('');
    if (onCancel) {
      onCancel();
    }
  };


  if (!user) {
    return (
      <div className={`comment-card-glass rounded-xl ${isReply ? 'ml-6 comment-thread-line pl-4' : ''} ${className}`}>
        <div className="p-4">
          <div className="text-center text-muted-foreground/70 py-4">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
              <Send className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm">Sign in to join the conversation</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`comment-card-glass rounded-xl animate-comment-fade-in ${isReply ? 'ml-6 comment-thread-line pl-4' : ''} ${className}`}>
      <div className="p-4">
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex items-start space-x-3 w-full">
            {/* Premium Avatar */}
            <div className="comment-avatar-ring flex-shrink-0">
              <Avatar className="h-9 w-9 ring-2 ring-primary/10 ring-offset-1 ring-offset-background transition-all duration-300">
                <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20 text-foreground font-medium">
                  {getUserInitials(user.displayName || user.email)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              {/* Premium Mention Textarea */}
              <div className="comment-input-premium rounded-xl overflow-hidden">
                <MentionTextarea
                  value={body}
                  onChange={setBody}
                  placeholder={placeholder}
                  className="min-h-[90px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                  maxLength={COMMENT_CONSTRAINTS.MAX_LENGTH}
                  autoFocus={autoFocus}
                  disabled={isLoading}
                  teamMembers={teamMembers}
                  aria-label={isReply ? `Reply to ${placeholder.replace('Reply to ', '').replace('...', '')}` : "Write a comment"}
                  aria-describedby={`${charCountId} ${!isReply && body.length === 0 ? tipsId : ''}`}
                />
              </div>

              {/* Character Count and Actions */}
              <div className="flex items-center justify-between">
                {/* Character Count with Progress Indicator */}
                <div className="flex items-center gap-2">
                  <div id={charCountId} className="text-xs text-muted-foreground/50" aria-live="polite">
                    {body.length}/{COMMENT_CONSTRAINTS.MAX_LENGTH}
                  </div>
                  {body.length > COMMENT_CONSTRAINTS.MAX_LENGTH * 0.8 && (
                    <div className="h-1.5 w-16 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          body.length > COMMENT_CONSTRAINTS.MAX_LENGTH * 0.95
                            ? 'bg-gradient-to-r from-orange-500 to-red-500'
                            : 'bg-gradient-to-r from-primary to-accent'
                        }`}
                        style={{ width: `${Math.min((body.length / COMMENT_CONSTRAINTS.MAX_LENGTH) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Premium Submit Button */}
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !body.trim()}
                  className="h-9 px-4 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20 transition-all duration-300 disabled:opacity-50 disabled:shadow-none"
                  aria-label={isLoading ? "Posting comment..." : `${buttonText} - ${body.trim() ? 'Ready to submit' : 'Enter text to submit'}`}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />
                      <span>Posting...</span>
                    </div>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      <span>{buttonText}</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Premium Tips for first-time users */}
              {!isReply && body.length === 0 && (
                <div id={tipsId} className="flex items-center gap-2 text-xs text-muted-foreground/50 pt-1" role="note">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/5">
                    <span className="text-primary">@</span>
                    <span>mention teammates</span>
                  </div>
                  <span className="text-muted-foreground/30">•</span>
                  <span>Be constructive in your feedback</span>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
