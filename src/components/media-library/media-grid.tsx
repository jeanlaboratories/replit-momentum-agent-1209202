'use client';

import * as React from 'react';
import Image from 'next/image';
import { Play, Sparkles, Tag as TagIcon, Check, Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnifiedMedia } from '@/lib/types/media-library';
import type { BrandMember } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getSafeImageUrl, isSignedGcsUrl } from '@/lib/utils/image-proxy';
import { isYouTubeUrl, getYouTubeThumbnailUrl } from '@/lib/youtube';

interface MediaGridProps {
  media: UnifiedMedia[];
  selectedIds: Set<string>;
  onSelectMedia: (id: string) => void;
  onMediaClick: (media: UnifiedMedia) => void;
  isLoading?: boolean;
  brandMembers?: BrandMember[];
}

interface MediaItemProps {
  item: UnifiedMedia;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  brandMembers?: BrandMember[];
}

export const MediaItem = React.memo(({ item, isSelected, onSelect, onClick, brandMembers }: MediaItemProps) => {
  const [imageError, setImageError] = React.useState(false);
  const imageUrl = imageError 
    ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=='
    : getSafeImageUrl(item.url);
  
  // Signed GCS URLs should bypass Next.js optimization to avoid issues with query parameters
  const shouldUnoptimize = imageError || 
                          imageUrl.startsWith('data:') || 
                          isSignedGcsUrl(item.url);

  return (
    <div
      className={cn(
        'group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all',
        isSelected
          ? 'border-primary ring-2 ring-primary ring-offset-2'
          : 'border-transparent hover:border-muted-foreground/20'
      )}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          onSelect();
        } else {
          onClick();
        }
      }}
    >
      {/* Thumbnail */}
      <div className="relative h-full w-full bg-muted">
        {item.type === 'video' ? (
          isYouTubeUrl(item.url) ? (
            <img
              className="w-full h-full object-cover"
              src={getYouTubeThumbnailUrl(item.url) || ''}
              alt={item.title}
            />
          ) : (
              // Video: show video element with first frame (same as VideoCard)
              <video
                className="w-full h-full object-cover"
                src={`${item.url}#t=0.001`}
                poster={item.thumbnailUrl && item.thumbnailUrl !== item.url ? item.thumbnailUrl : undefined}
                controls
                playsInline
                preload="metadata"
              />
            )
        ) : (
          // Image - use proxy for external URLs with error handling
          <Image
            src={imageUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            loading="lazy"
            onError={() => setImageError(true)}
            unoptimized={shouldUnoptimize}
          />
        )}
        
        {/* Video indicator */}
        {/* Video indicator (only if no controls) - actually we want controls now, so removing this overlay or making it click-through if we want custom controls later. For now, let's remove the overlay to allow native controls interaction. */}
        
        {/* Selection checkbox */}
        <div
          className={cn(
            'absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded border-2 bg-white transition-opacity',
            isSelected
              ? 'opacity-100 border-primary'
              : 'opacity-0 group-hover:opacity-100 border-gray-400'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>
        
        {/* Source badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.visionDescription && (
            <Badge variant="outline" className="text-xs bg-purple-50/90 border-purple-200 text-purple-700" title={`AI Analysis: ${item.visionDescription.substring(0, 100)}...`}>
              <Sparkles className="h-3 w-3 mr-1" />
              AI Vision
            </Badge>
          )}
          {item.source === 'ai-generated' && (
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          )}
          {item.source === 'brand-soul' && (
            <Badge variant="secondary" className="text-xs">
              <TagIcon className="h-3 w-3 mr-1" />
              Brand Soul
            </Badge>
          )}
          {item.isPublished !== undefined && (
            <Badge variant={item.isPublished ? 'default' : 'secondary'} className="text-xs">
              {item.isPublished ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              {item.isPublished ? 'Published' : 'Private'}
            </Badge>
          )}
        </div>
        
        {/* Color palette preview */}
        {item.colors && item.colors.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.colors.slice(0, 5).map((color, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border border-white/50"
                style={{ backgroundColor: color.hex }}
                title={color.hex}
              />
            ))}
          </div>
        )}

        {/* User Attribution */}
        {brandMembers && (item.createdBy || item.uploadedBy) && (
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {(() => {
              const userId = item.createdBy || item.uploadedBy;
              const member = brandMembers.find(m => m.userId === userId);
              return (
                <Avatar className="h-6 w-6 border border-white/50 shadow-sm">
                  {member?.userPhotoURL ? (
                    <AvatarImage src={member.userPhotoURL} alt={member.userDisplayName || 'User'} />
                  ) : (
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                      {member?.userDisplayName?.substring(0, 2).toUpperCase() || <UserIcon className="h-3 w-3" />}
                    </AvatarFallback>
                  )}
                </Avatar>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* Title overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs text-white truncate">{item.title}</p>
      </div>
    </div>
  );
});

MediaItem.displayName = 'MediaItem';

export function MediaGrid({
  media,
  selectedIds,
  onSelectMedia,
  onMediaClick,
  isLoading,
  brandMembers,
}: MediaGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-muted animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-full bg-gradient-to-br from-primary/10 to-accent/10 p-6 mb-4">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Build Your Visual Momentum</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Every great journey starts with a single frame. Upload media or sync from Team Intelligence to get your creative force moving.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {media.map((item) => (
        <MediaItem
          key={item.id}
          item={item}
          isSelected={selectedIds.has(item.id)}
          onSelect={() => onSelectMedia(item.id)}
          onClick={() => onMediaClick(item)}
          brandMembers={brandMembers}
        />
      ))}
    </div>
  );
}
