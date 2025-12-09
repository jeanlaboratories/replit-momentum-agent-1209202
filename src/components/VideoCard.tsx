/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {Video} from '@/lib/types';
import {PlayIcon} from './icons';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { isYouTubeUrl, getYouTubeThumbnailUrl } from '@/lib/youtube';

interface VideoCardProps {
  video: Video;
  onPlay: (video: Video) => void;
  onDelete: (video: Video) => void;
  userDisplayNames: { [userId: string]: string };
}

/**
 * A component that renders a video card with a thumbnail, title, and play button.
 */
export const VideoCard: React.FC<VideoCardProps> = ({video, onPlay, onDelete, userDisplayNames}) => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const getAuditInfo = () => {
    if (video.generatedBy && video.generatedAt) {
      return {
        user: video.generatedBy,
        timestamp: video.generatedAt,
        action: 'Generated'
      };
    } else if (video.uploadedBy && video.uploadedAt) {
      return {
        user: video.uploadedBy,
        timestamp: video.uploadedAt,
        action: 'Uploaded'
      };
    }
    return null;
  };
  
  const auditInfo = getAuditInfo();
  
  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 border-transparent hover:border-muted-foreground/20 transition-all"
      onClick={() => onPlay(video)}
    >
      {/* Thumbnail */}
      <div className="relative h-full w-full bg-muted">
        {isYouTubeUrl(video.videoUrl) ? (
          <img
            className="w-full h-full object-cover"
            src={getYouTubeThumbnailUrl(video.videoUrl) || ''}
            alt={video.title}
          />
        ) : (
            <video
              className="w-full h-full object-cover"
              src={`${video.videoUrl}#t=0.001`}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
        )}

        {/* Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <PlayIcon className="w-6 h-6 text-white fill-white" />
          </div>
        </div>

        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(video);
            }}
            className="h-8 w-8 p-0 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-lg"
            title="Play"
          >
            <PlayIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(video);
            }}
            className="h-8 w-8 p-0 rounded-full shadow-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <p className="text-xs text-white font-medium truncate">{video.title}</p>
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
