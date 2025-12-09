
import React, { useState } from 'react';
import NextImage from 'next/image';
import {Video} from '@/lib/types';
import {PencilSquareIcon, XMarkIcon} from './icons';
import { Button } from '@/components/ui/button';
import { Pencil, MessageSquare, Download } from 'lucide-react';
import { VideoComments } from './comments/CommentPanel';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getBrandMembersAction } from '@/app/actions/team-management';
import { updateVideoAction } from '@/app/actions';
import { BrandMember } from '@/lib/types';
import Link from 'next/link';
import { User as UserIcon } from 'lucide-react';
import { EditableTitle } from '@/components/ui/editable-title';
import { useToast } from '@/hooks/use-toast';
import { VisionAnalysisPanel } from '@/components/media-library/VisionAnalysisPanel';
import type { UnifiedMedia } from '@/lib/types/media-library';

interface VideoPlayerProps {
  video: Video;
  onClose: () => void;
  onEdit: (video: Video) => void;
  onTitleUpdate?: (videoId: string, newTitle: string) => void;
}

/**
 * A component that renders a video player with controls, description, and edit button.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  onClose,
  onEdit,
  onTitleUpdate,
}) => {
  const [showComments, setShowComments] = useState(false);
  const { brandId } = useAuth();
  const { toast } = useToast();
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [currentTitle, setCurrentTitle] = useState(video.title);

  React.useEffect(() => {
    if (brandId) {
      getBrandMembersAction(brandId).then(data => {
        if (data.members) setBrandMembers(data.members);
      });
    }
  }, [brandId]);
  return (
    <div
      className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center animate-fade-in backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-background/90 rounded-2xl shadow-2xl w-full max-w-7xl relative overflow-hidden flex flex-col md:flex-row h-[90vh] border border-border/50 backdrop-blur-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Immersive Video View */}
        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden group">
          <video
            key={video.id}
            className="max-w-full max-h-full w-full h-full"
            src={video.videoUrl}
            controls
            autoPlay
            loop
            aria-label={video.title}
          />
        </div>

        {/* Right: Sidebar */}
        <div className="w-full md:w-[400px] flex flex-col bg-background border-l h-full overflow-hidden">
          <div className="p-6 border-b space-y-6 overflow-y-auto max-h-[40vh] flex-shrink-0">
            <div>
              <div className="flex items-start justify-between gap-4">
                <EditableTitle
                  value={currentTitle}
                  onSave={async (newTitle) => {
                    const result = await updateVideoAction(video.id, { title: newTitle });
                    if (result.success) {
                      setCurrentTitle(newTitle);
                      onTitleUpdate?.(video.id, newTitle);
                      toast({ title: 'Title updated', description: 'Video title has been saved.' });
                    } else {
                      toast({ title: 'Error', description: result.message || 'Failed to update title', variant: 'destructive' });
                      throw new Error(result.message);
                    }
                  }}
                  size="lg"
                  placeholder="Untitled"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <XMarkIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(video)}
                className="flex-1 bg-muted/30"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit Details
              </Button>
            </div>

            {/* Description/Prompt */}
            {video.description && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt</h3>
                <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm text-foreground/90 leading-relaxed">
                  {video.description}
                </div>
              </div>
            )}

            {/* Vision Analysis Panel */}
            <VisionAnalysisPanel 
              media={{
                id: video.id,
                brandId: video.brandId,
                type: 'video',
                url: video.videoUrl,
                title: video.title,
                description: video.description,
                visionDescription: video.visionDescription,
                visionKeywords: video.visionKeywords,
                visionCategories: video.visionCategories,
              } as UnifiedMedia}
            />

            {/* Audit Info */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
              <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm space-y-2">
                {video.generatedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Generated</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{new Date(video.generatedAt).toLocaleString()}</span>
                      {video.generatedBy && (
                        <Link href={`/brand-profile/personal?userId=${video.generatedBy}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          {(() => {
                            const member = brandMembers.find(m => m.userId === video.generatedBy);
                            return (
                              <>
                                <Avatar className="h-4 w-4">
                                  {member?.userPhotoURL ? (
                                    <AvatarImage src={member.userPhotoURL} />
                                  ) : (
                                    <AvatarFallback className="text-[8px]">{member?.userDisplayName?.substring(0, 2).toUpperCase() || <UserIcon className="h-2 w-2" />}</AvatarFallback>
                                  )}
                                </Avatar>
                                <span className="text-xs">{member?.userDisplayName || 'User'}</span>
                              </>
                            );
                          })()}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                {video.uploadedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Uploaded</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{new Date(video.uploadedAt).toLocaleString()}</span>
                      {video.uploadedBy && (
                        <Link href={`/brand-profile/personal?userId=${video.uploadedBy}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          {(() => {
                            const member = brandMembers.find(m => m.userId === video.uploadedBy);
                            return (
                              <>
                                <Avatar className="h-4 w-4">
                                  {member?.userPhotoURL ? (
                                    <AvatarImage src={member.userPhotoURL} />
                                  ) : (
                                    <AvatarFallback className="text-[8px]">{member?.userDisplayName?.substring(0, 2).toUpperCase() || <UserIcon className="h-2 w-2" />}</AvatarFallback>
                                  )}
                                </Avatar>
                                <span className="text-xs">{member?.userDisplayName || 'User'}</span>
                              </>
                            );
                          })()}
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-muted/5">
            {brandId && (
              <VideoComments
                brandId={brandId}
                contextId={video.id}
                title="Comments"
                variant="sidebar"
                className="h-full"
              />
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-background flex items-center justify-between gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            <Button asChild className="flex-1">
              <a href={video.videoUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
