'use client';

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getAssetLovesAction, UserPublicProfile } from '@/app/actions/engagement-actions';
import { Loader2 } from 'lucide-react';

interface LoveInteractionProps {
  assetId: string;
  brandId: string;
  initialCount: number;
  initialIsLoved: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
  iconClassName?: string;
}

export function LoveInteraction({
  assetId,
  brandId,
  initialCount,
  initialIsLoved,
  onToggle,
  className = '',
  iconClassName = 'w-5 h-5',
}: LoveInteractionProps) {
  const [lovers, setLovers] = useState<UserPublicProfile[]>([]);
  const [isLoadingLovers, setIsLoadingLovers] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchLovers = async () => {
    if (hasFetched) return;
    setIsLoadingLovers(true);
    try {
      const { success, users } = await getAssetLovesAction(brandId, assetId);
      if (success && users) {
        setLovers(users);
      }
    } catch (error) {
      console.error('Failed to fetch lovers:', error);
    } finally {
      setIsLoadingLovers(false);
      setHasFetched(true);
    }
  };

  const handleMouseEnter = () => {
    // Prefetch on hover if not already fetched
    if (!hasFetched && initialCount > 0) {
      fetchLovers();
    }
  };

  const handleCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (initialCount > 0) {
      setIsOpen(true);
      fetchLovers(); // Ensure fetched if clicked directly without hover
    }
  };

  const tooltipText = isLoadingLovers
    ? 'Loading...'
    : lovers.length > 0
    ? `${lovers.slice(0, 3).map((u) => u.displayName).join(', ')}${
        lovers.length > 3 ? ` and ${lovers.length - 3} others` : ''
      }`
    : 'Be the first to love this!';

  return (
    <div className={`flex items-center gap-1 ${className}`} onMouseEnter={handleMouseEnter}>
      <Heart
        className={`cursor-pointer transition-colors ${iconClassName} ${
          initialIsLoved ? 'fill-red-500 text-red-500' : 'hover:text-red-500'
        }`}
        onClick={onToggle}
      />
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="font-bold cursor-pointer hover:underline"
              onClick={handleCountClick}
            >
              {initialCount}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loved by</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[300px] pr-4">
            {isLoadingLovers ? (
              <div className="flex justify-center items-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {lovers.map((user) => (
                  <div key={user.uid} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback>
                        {user.displayName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm font-medium">{user.displayName}</div>
                  </div>
                ))}
                {lovers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No one has loved this yet.
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
