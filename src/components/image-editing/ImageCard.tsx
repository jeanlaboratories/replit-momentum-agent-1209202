
import React, { useState, useEffect } from 'react';
import NextImage from 'next/image';
import Link from 'next/link';
import { EditedImage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, Eye, ArrowRight, Sparkles } from 'lucide-react';

import { shouldOptimizeImage } from '@/lib/image-utils';

interface ImageCardProps {
  image: EditedImage;
  onView: (image: EditedImage) => void;
  onDelete: (image: EditedImage) => void;
  userDisplayNames: { [userId: string]: string };
}

export const ImageCard: React.FC<ImageCardProps> = ({ image, onView, onDelete, userDisplayNames }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const hasGeneratedImage = image.generatedImageUrl && image.sourceImageUrl;
  const isAiGenerated = image.generatedImageUrl && !image.sourceImageUrl;
  const displayUrl = image.generatedImageUrl || image.sourceImageUrl;
  
  const getAuditInfo = () => {
    if (image.generatedBy && image.generatedAt) {
      return {
        user: image.generatedBy,
        timestamp: image.generatedAt,
        action: 'Generated'
      };
    } else if (image.uploadedBy && image.uploadedAt) {
      return {
        user: image.uploadedBy,
        timestamp: image.uploadedAt,
        action: 'Uploaded'
      };
    }
    return null;
  };
  
  const auditInfo = getAuditInfo();
  
  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 border-transparent hover:border-muted-foreground/20 transition-all"
      onClick={() => onView(image)}
    >
      {/* Thumbnail */}
      <div className="relative h-full w-full bg-muted">
        {/* Main Image */}
        <NextImage
          className="w-full h-full object-cover"
          src={displayUrl}
          alt={image.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
          loading="lazy"
          unoptimized={!shouldOptimizeImage(displayUrl)}
        />

        {/* Source badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {isAiGenerated && (
            <div className="flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </div>
          )}
          {hasGeneratedImage && (
            <div className="flex items-center gap-1 bg-purple-600/80 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              <ArrowRight className="w-3 h-3" />
              <span>Edited</span>
            </div>
          )}
        </div>

        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onView(image);
            }}
            className="h-8 w-8 p-0 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-lg"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(image);
            }}
            className="h-8 w-8 p-0 rounded-full shadow-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-xs text-white font-medium truncate">{image.title}</p>
          {auditInfo && isMounted && (
            <div className="text-[10px] text-gray-300 truncate mt-0.5 flex items-center gap-1">
              <span>{auditInfo.action} by</span>
              <span
                className="hover:text-white hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/brand-profile/personal?userId=${auditInfo.user}`;
                }}
              >
                {userDisplayNames[auditInfo.user] || 'User'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
    