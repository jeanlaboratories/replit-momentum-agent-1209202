'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Users, User, Loader2, Check, Lock, Globe, Share2 } from 'lucide-react';
import NextImage from 'next/image';
import { LoveInteraction } from './brand-profile-social/LoveInteraction';
import { shareContentToProfileAction } from '@/app/actions/share-actions';
import { getBrandMembershipAction } from '@/app/actions';
import { toggleAssetLoveAction, getBrandEngagementAction } from '@/app/actions/engagement-actions';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SharePreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  brandName?: string;
  brandId?: string;
  contentBlockId?: string;
  campaignId?: string;
  campaignDate?: string;
}

type ShareTarget = 'team' | 'personal';
type Visibility = 'private' | 'public';

export function SharePreviewDialog({
  isOpen,
  onOpenChange,
  text,
  mediaUrl,
  mediaType,
  brandName,
  brandId,
  contentBlockId,
  campaignId,
  campaignDate,
}: SharePreviewDialogProps) {
  const { user, brandId: userBrandId } = useAuth();
  const { toast } = useToast();
  const [isManager, setIsManager] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<{ target: ShareTarget; visibility: Visibility } | null>(null);

  // Single selection states - unified UX
  const [selectedTarget, setSelectedTarget] = useState<ShareTarget>('personal');
  const [selectedVisibility, setSelectedVisibility] = useState<Visibility>('private');

  // Engagement state
  const [loveCount, setLoveCount] = useState(0);
  const [isLoved, setIsLoved] = useState(false);
  const [isLoadingEngagement, setIsLoadingEngagement] = useState(false);

  const effectiveBrandId = brandId || userBrandId;

  // Check if user is a manager
  useEffect(() => {
    async function checkRole() {
      if (!user?.uid || !effectiveBrandId) {
        setIsLoadingRole(false);
        return;
      }

      try {
        const membership = await getBrandMembershipAction(user.uid, effectiveBrandId);
        setIsManager(membership?.role === 'MANAGER');
      } catch (error) {
        console.error('Failed to check user role:', error);
      } finally {
        setIsLoadingRole(false);
      }
    }

    if (isOpen) {
      checkRole();
    }
  }, [isOpen, user?.uid, effectiveBrandId]);

  // Fetch engagement state when dialog opens
  useEffect(() => {
    async function fetchEngagement() {
      if (!effectiveBrandId || !contentBlockId || !isOpen) return;

      setIsLoadingEngagement(true);
      try {
        const result = await getBrandEngagementAction(effectiveBrandId);
        if (result.success && result.data) {
          setLoveCount(result.data.stats[contentBlockId] || 0);
          setIsLoved(result.data.userLoves[contentBlockId] || false);
        }
      } catch (error) {
        console.error('Failed to fetch engagement:', error);
      } finally {
        setIsLoadingEngagement(false);
      }
    }

    if (isOpen) {
      fetchEngagement();
    }
  }, [isOpen, effectiveBrandId, contentBlockId]);

  // Handle love toggle
  const handleLoveToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveBrandId || !contentBlockId) return;

    const prevLoved = isLoved;
    const prevCount = loveCount;
    setIsLoved(!prevLoved);
    setLoveCount(prevLoved ? prevCount - 1 : prevCount + 1);

    try {
      const result = await toggleAssetLoveAction(effectiveBrandId, contentBlockId);
      if (result.success && result.newState) {
        setIsLoved(result.newState.isLoved);
        setLoveCount(result.newState.loveCount);
      } else {
        setIsLoved(prevLoved);
        setLoveCount(prevCount);
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update love.' });
      }
    } catch (error) {
      setIsLoved(prevLoved);
      setLoveCount(prevCount);
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred.' });
    }
  }, [effectiveBrandId, contentBlockId, isLoved, loveCount, toast]);

  // Reset states when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShareSuccess(null);
      setSelectedTarget('personal');
      setSelectedVisibility('private');
    }
  }, [isOpen]);

  const handleShare = async () => {
    if (!effectiveBrandId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Brand ID is required for sharing.' });
      return;
    }

    if (selectedTarget === 'team' && !isManager) {
      toast({ variant: 'destructive', title: 'Error', description: 'Only team managers can share to the Team Profile.' });
      return;
    }

    setIsSharing(true);
    try {
      const result = await shareContentToProfileAction({
        brandId: effectiveBrandId,
        targetType: selectedTarget,
        text,
        mediaUrl,
        mediaType,
        sourceContentBlockId: contentBlockId,
        isPublished: selectedVisibility === 'public',
        campaignId,
        campaignDate,
      });

      if (result.success) {
        setShareSuccess({ target: selectedTarget, visibility: selectedVisibility });
        const targetLabel = selectedTarget === 'team' ? 'Team Profile' : 'Personal Profile';
        const visibilityLabel = selectedVisibility === 'public' ? 'publicly' : 'privately';
        toast({ title: 'Shared!', description: `Content shared ${visibilityLabel} to ${targetLabel}` });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to share content.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while sharing.' });
    } finally {
      setIsSharing(false);
    }
  };

  const isShareDisabled = isSharing || isLoadingRole || (selectedTarget === 'team' && !isManager);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Content
          </DialogTitle>
          <DialogDescription>
            Preview your content and share it to your Profile
          </DialogDescription>
        </DialogHeader>

        {/* Content Preview */}
        <div className="px-6 pb-4 overflow-y-auto flex-1">
          <div className="mx-auto max-w-xl rounded-lg border bg-background p-4">
            <div className="flex items-start gap-4">
              <Avatar className="shrink-0">
                <AvatarImage src={user?.photoURL || undefined} alt="Your Avatar" />
                <AvatarFallback>{user?.displayName?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{brandName || 'Your Brand'}</span>
                  <span className="text-sm text-muted-foreground">@{brandName?.toLowerCase().replace(/\s+/g, '') || 'yourbrand'} · now</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm break-words">{text}</p>
                <div className="mt-3 overflow-hidden rounded-xl border">
                  {mediaType === 'image' ? (
                    <div className="relative w-full aspect-video">
                      <NextImage src={mediaUrl} alt="Post media" fill className="object-contain" sizes="(max-width: 768px) 100vw, 600px" />
                    </div>
                  ) : (
                    <video src={mediaUrl} controls className="w-full bg-black" />
                  )}
                </div>
                {/* Love interaction */}
                {effectiveBrandId && contentBlockId && (
                  <div className="mt-3 flex gap-6 text-muted-foreground">
                    <LoveInteraction
                      assetId={contentBlockId}
                      brandId={effectiveBrandId}
                      initialCount={loveCount}
                      initialIsLoved={isLoved}
                      onToggle={handleLoveToggle}
                      iconClassName="h-4 w-4"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Share Options - Unified Card-Based UX */}
        <div className="px-6 pb-6 pt-4 border-t bg-muted/30">
          {shareSuccess ? (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-center font-medium">
                Shared to {shareSuccess.target === 'team' ? 'Team' : 'Personal'} Profile
              </p>
              <p className="text-sm text-muted-foreground">
                {shareSuccess.visibility === 'public' ? 'Visible to all team members' : 'Only visible to you'}
              </p>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Target Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Share to</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTarget('personal')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      selectedTarget === 'personal'
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <User className={cn("h-5 w-5", selectedTarget === 'personal' ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", selectedTarget === 'personal' ? "text-primary" : "")}>
                      Personal
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => isManager && setSelectedTarget('team')}
                    disabled={!isManager && !isLoadingRole}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      selectedTarget === 'team'
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30",
                      !isManager && !isLoadingRole && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isLoadingRole ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <Users className={cn("h-5 w-5", selectedTarget === 'team' ? "text-primary" : "text-muted-foreground")} />
                    )}
                    <span className={cn("text-sm font-medium", selectedTarget === 'team' ? "text-primary" : "")}>
                      Team
                    </span>
                    {!isManager && !isLoadingRole && (
                      <span className="text-[10px] text-muted-foreground">Managers only</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Visibility Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Visibility</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVisibility('private')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      selectedVisibility === 'private'
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <Lock className={cn("h-5 w-5", selectedVisibility === 'private' ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", selectedVisibility === 'private' ? "text-primary" : "")}>
                      Private
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center">Only you</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVisibility('public')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      selectedVisibility === 'public'
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <Globe className={cn("h-5 w-5", selectedVisibility === 'public' ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-medium", selectedVisibility === 'public' ? "text-primary" : "")}>
                      Public
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center">Team members</span>
                  </button>
                </div>
              </div>

              {/* Share Button */}
              <Button
                onClick={handleShare}
                disabled={isShareDisabled}
                className="w-full"
                size="lg"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share {selectedVisibility === 'public' ? 'Publicly' : 'Privately'} to {selectedTarget === 'team' ? 'Team' : 'Personal'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
