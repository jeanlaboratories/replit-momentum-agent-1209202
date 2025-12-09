
import React, { useState } from 'react';
import NextImage from 'next/image';
import { EditedImage } from '@/lib/types';
import { X, Pencil, MessageSquare, Download, Share, Edit3, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageComments } from '../comments/CommentPanel';
import { useAuth } from '@/hooks/use-auth';
import { BrandSoulExplainability } from '@/components/brand-soul-explainability';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getBrandMembersAction, } from '@/app/actions/team-management';
import { updateImageAction } from '@/app/actions';
import { BrandMember } from '@/lib/types';
import Link from 'next/link';
import { EditableTitle } from '@/components/ui/editable-title';
import { useToast } from '@/hooks/use-toast';

interface ImageViewerProps {
  image: EditedImage;
  onClose: () => void;
  onEdit: (image: EditedImage) => void;
  onEditWithImageEditor?: (image: EditedImage) => void;
  onTitleUpdate?: (imageId: string, newTitle: string) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  image,
  onClose,
  onEdit,
  onEditWithImageEditor,
  onTitleUpdate,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [selectedImageView, setSelectedImageView] = useState<'source' | 'generated' | 'comparison'>('comparison');
  const { brandId } = useAuth();
  const { toast } = useToast();
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [currentTitle, setCurrentTitle] = useState(image.title);

  React.useEffect(() => {
    if (brandId) {
      getBrandMembersAction(brandId).then(data => {
        if (data.members) setBrandMembers(data.members);
      });
    }
  }, [brandId]);
  
  const hasGeneratedImage = image.generatedImageUrl && image.sourceImageUrl;
  const isAiGenerated = image.generatedImageUrl && !image.sourceImageUrl;
  
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
        {/* Left: Immersive Image View */}
        <div className="flex-1 bg-black/95 flex flex-col relative overflow-hidden group">
          {/* View Mode Selector - Floating on top */}
          {hasGeneratedImage && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full p-1 border border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImageView('comparison')}
                  className={`rounded-full px-4 h-8 text-xs ${selectedImageView === 'comparison' ? 'bg-white text-black hover:bg-white/90' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                >
                  Compare
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImageView('source')}
                  className={`rounded-full px-4 h-8 text-xs ${selectedImageView === 'source' ? 'bg-white text-black hover:bg-white/90' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                >
                  Source
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImageView('generated')}
                  className={`rounded-full px-4 h-8 text-xs ${selectedImageView === 'generated' ? 'bg-white text-black hover:bg-white/90' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                >
                  Generated
                </Button>
              </div>
            </div>
          )}

          {/* Main Image Area */}
          <div className="flex-1 relative w-full h-full p-4 flex items-center justify-center">
            {hasGeneratedImage && selectedImageView === 'comparison' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full h-full">
                <div className="relative w-full h-full flex flex-col">
                  <span className="absolute top-2 left-2 z-10 bg-black/50 text-white text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded backdrop-blur-sm">Source</span>
                  <div className="relative flex-1 w-full h-full">
                    <NextImage
                      key={`${image.id}-source`}
                      className="object-contain"
                      src={image.sourceImageUrl!}
                      alt="Source Image"
                      fill
                      sizes="50vw"
                      priority
                    />
                  </div>
                </div>
                <div className="relative w-full h-full flex flex-col">
                  <span className="absolute top-2 left-2 z-10 bg-primary/80 text-white text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded backdrop-blur-sm">Generated</span>
                  <div className="relative flex-1 w-full h-full">
                    <NextImage
                      key={`${image.id}-generated`}
                      className="object-contain"
                      src={image.generatedImageUrl!}
                      alt={image.title}
                      fill
                      sizes="50vw"
                      priority
                    />
                  </div>
                </div>
              </div>
            ) : (
                <div className="relative w-full h-full">
                  <NextImage
                    className="object-contain"
                    src={
                      selectedImageView === 'source' ? image.sourceImageUrl! :
                        selectedImageView === 'generated' ? image.generatedImageUrl! :
                          image.generatedImageUrl || image.sourceImageUrl!
                    }
                    alt={selectedImageView === 'source' ? 'Source Image' : image.title}
                    fill
                    sizes="100vw"
                    priority
                  />
                </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-full md:w-[400px] flex flex-col bg-background border-l h-full overflow-hidden">
          <div className="p-6 border-b space-y-6 overflow-y-auto max-h-[40vh] flex-shrink-0">
            <div>
              <div className="flex items-start justify-between gap-4">
                <EditableTitle
                  value={currentTitle}
                  onSave={async (newTitle) => {
                    const result = await updateImageAction(image.id, { title: newTitle });
                    if (result.success) {
                      setCurrentTitle(newTitle);
                      onTitleUpdate?.(image.id, newTitle);
                      toast({ title: 'Title updated', description: 'Image title has been saved.' });
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
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(image)}
                className="flex-1 bg-muted/30"
              >
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit Details
              </Button>
              {isAiGenerated && onEditWithImageEditor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditWithImageEditor(image)}
                  className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                >
                  <Edit3 className="mr-2 h-3.5 w-3.5" />
                  Editor
                </Button>
              )}
            </div>

            {/* Prompt */}
            {image.prompt && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prompt</h3>
                <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm text-foreground/90 leading-relaxed">
                  {image.prompt}
                </div>
              </div>
            )}

            {/* Audit Info */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
              <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm space-y-2">
                {image.generatedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Generated</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{new Date(image.generatedAt).toLocaleString()}</span>
                      {image.generatedBy && (
                        <Link href={`/brand-profile/personal?userId=${image.generatedBy}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          {(() => {
                            const member = brandMembers.find(m => m.userId === image.generatedBy);
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
                {image.uploadedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Uploaded</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{new Date(image.uploadedAt).toLocaleString()}</span>
                      {image.uploadedBy && (
                        <Link href={`/brand-profile/personal?userId=${image.uploadedBy}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                          {(() => {
                            const member = brandMembers.find(m => m.userId === image.uploadedBy);
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

            {/* Explainability */}
            {image.explainability && (
              <div className="space-y-2">
                <BrandSoulExplainability explainability={image.explainability} />
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-muted/5">
            {brandId && (
              <ImageComments
                brandId={brandId}
                contextId={image.id}
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
              <a
                href={
                  selectedImageView === 'source' ? image.sourceImageUrl :
                    selectedImageView === 'generated' ? image.generatedImageUrl :
                      image.generatedImageUrl || image.sourceImageUrl
                }
                download
                target="_blank"
                rel="noopener noreferrer"
              >
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
    