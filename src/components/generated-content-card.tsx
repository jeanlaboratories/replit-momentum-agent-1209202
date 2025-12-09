'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { notification } from '@/hooks/use-notification';
import { generateImageAction, generateCharacterConsistentImageAction, regenerateAdCopyAction, regenerateImagePromptAction } from '@/app/actions';
import { generateEditedImage } from '@/ai/flows/generate-edited-image';
import NextImage from 'next/image';
import { Image as ImageIcon, Loader2, Library, Film, Check, X, Wand2, Share2, Clock, Trash2, Pencil, ExternalLink, Upload, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GeneratedContentBlock, EditedImage, Video, BrandProfile } from '@/lib/types';
import { useState, useCallback, memo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { SharePreviewDialog } from './share-preview-dialog';
import { BrandSoulExplainability } from './brand-soul-explainability';
import { EditImagePage } from './image-editing/EditImagePage';
import { useJobQueue } from '@/contexts/job-queue-context';
import { uploadDataUrlToStorage, uploadDataUrlsToStorage } from '@/lib/chat-media-storage';


interface CharacterConsistencyConfig {
  enabled: boolean;
  characters: {
    id: string;
    name: string;
    characterSheetUrl: string;
    isActive: boolean;
  }[];
  useSceneToSceneConsistency: boolean;
  maxReferenceImages: number;
}

interface GeneratedContentCardProps {
  block: GeneratedContentBlock;
  brandProfile: BrandProfile;
  brandId: string;
  brandName?: string;
  availableMedia: {
    images: EditedImage[];
    videos: Video[];
  };
  mediaLoading: boolean;
  onContentChange: (newAdCopy: string) => void;
  onImagePromptChange: (newImagePrompt: string) => void;
  onImageUpdate: (imageUrl: string, isGenerating?: boolean) => void;
  onDelete?: () => void;
  characterConsistency?: CharacterConsistencyConfig;
  campaignId?: string; // Campaign ID for linking back to the campaign when sharing
  campaignDate?: string; // Campaign day date (ISO string) for opening the correct day in calendar view
  onAutoSave?: () => void; // Called after successful image generation to trigger auto-save
  onScheduledTimeChange?: (scheduledTime: string | undefined) => void; // For editing scheduled time (Social Media Posts only)
  onToneOfVoiceChange?: (toneOfVoice: string) => void; // For editing tone of voice
  onImageMetadataUpdate?: (metadata: {
    sourceImageUrl?: string;
    fusionSourceUrls?: string[];
    maskUrl?: string;
    editPrompt?: string;
  }) => void; // For persisting Nano Banana AI Image Studio metadata
}

const GeneratedContentCard = memo(function GeneratedContentCard({
  block,
  brandProfile,
  brandId,
  brandName,
  availableMedia,
  mediaLoading,
  onContentChange,
  onImagePromptChange,
  onImageUpdate,
  onDelete,
  characterConsistency,
  campaignId,
  campaignDate,
  onAutoSave,
  onScheduledTimeChange,
  onToneOfVoiceChange,
  onImageMetadataUpdate,
}: GeneratedContentCardProps) {
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [isSharePreviewOpen, setIsSharePreviewOpen] = useState(false);
  const [isRegeneratingAdCopy, setIsRegeneratingAdCopy] = useState(false);
  const [isRegeneratingImagePrompt, setIsRegeneratingImagePrompt] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [explainability, setExplainability] = useState<{
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  } | null>(null);

  // AI Image Studio (EditImagePage) state
  const [isEditImageDialogOpen, setIsEditImageDialogOpen] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);

  // Job Queue for tracking image editing jobs
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();

  // Check if the block has content (non-empty)
  const hasContent = Boolean(
    block.adCopy?.trim() ||
    block.imagePrompt?.trim() ||
    block.imageUrl ||
    block.keyMessage?.trim()
  );

  const handleDeleteClick = useCallback(() => {
    if (hasContent) {
      // Show confirmation dialog for non-empty blocks
      setIsDeleteDialogOpen(true);
    } else {
      // Delete immediately for empty blocks
      onDelete?.();
    }
  }, [hasContent, onDelete]);

  const handleConfirmDelete = useCallback(() => {
    setIsDeleteDialogOpen(false);
    onDelete?.();
  }, [onDelete]);

  // AI Image Studio - Handle save from EditImagePage component
  const handleEditImageSave = useCallback(async (
    updatedImage: EditedImage,
    options?: { maskUrl?: string }
  ) => {
    if (!updatedImage.prompt?.trim()) {
      notification.error({
        title: 'Edit Prompt Required',
        description: 'Please describe how you want to edit the image.',
      });
      return;
    }

    // Determine mode based on the presence of additional images or mask
    const hasAdditionalImages = updatedImage.additionalImageUrls && updatedImage.additionalImageUrls.length > 0;
    const hasMask = !!options?.maskUrl;
    const editMode = hasMask ? 'mask' : hasAdditionalImages ? 'compose' : 'edit';

    // Create mode-specific titles and descriptions
    const modeLabels = {
      edit: { title: 'Editing Image', desc: 'Applying AI transformations', successTitle: 'Image Edited', successDesc: 'Your image has been transformed with AI.' },
      compose: { title: 'Composing Images', desc: 'Fusing images with AI', successTitle: 'Images Composed', successDesc: 'Images fused successfully with AI.' },
      mask: { title: 'Applying Mask Edit', desc: 'Editing masked regions with AI', successTitle: 'Mask Edit Complete', successDesc: 'Masked regions have been edited with AI.' },
    };

    // Create a job in the Job Queue
    const jobTitle = `${modeLabels[editMode].title}: ${block.contentType || 'Content Block'}`;
    const jobDescription = updatedImage.prompt.length > 50
      ? `${updatedImage.prompt.substring(0, 50)}...`
      : updatedImage.prompt;

    const jobId = addJob({
      type: 'image-editing',
      title: jobTitle,
      description: jobDescription,
      metadata: {
        contentType: block.contentType,
        editMode,
        prompt: updatedImage.prompt,
      },
    });

    setIsEditingImage(true);
    setIsEditImageDialogOpen(false); // Close dialog immediately so user can see Job Queue

    // Start the job
    startJob(jobId);
    setProgress(jobId, 10); // Initial progress

    try {
      // Set progress to 30% after starting API call
      setProgress(jobId, 30);

      const result = await generateEditedImage({
        prompt: updatedImage.prompt,
        imageUrl: updatedImage.sourceImageUrl || block.imageUrl || '',
        additionalImageUrls: hasAdditionalImages ? updatedImage.additionalImageUrls : undefined,
        brandId: brandId,
        mode: editMode === 'mask' ? 'edit' : editMode, // API uses 'edit' mode for mask-based editing
        aspectRatio: '1:1', // Default aspect ratio
        maskUrl: options?.maskUrl,
      });

      // Set progress to 80% after receiving response
      setProgress(jobId, 80);

      if (result.imageUrl) {
        onImageUpdate(result.imageUrl, false);

        // Upload base64 data URLs to Firebase Storage before persisting metadata
        // This prevents Firestore size limit errors
        // Use the generated image URL as the new source image for subsequent edits
        try {
          const [uploadedFusionUrls, uploadedMaskUrl] = await Promise.all([
            hasAdditionalImages && updatedImage.additionalImageUrls?.length
              ? uploadDataUrlsToStorage(updatedImage.additionalImageUrls, brandId, 'fusion')
              : Promise.resolve(undefined),
            options?.maskUrl ? uploadDataUrlToStorage(options.maskUrl, brandId, 'mask') : Promise.resolve(undefined),
          ]);

          // Use the generated image as the new source for subsequent edits
          // This allows iterative editing where each generation becomes the new source
          onImageMetadataUpdate?.({
            sourceImageUrl: result.imageUrl, // The generated image becomes the new source
            fusionSourceUrls: uploadedFusionUrls,
            maskUrl: uploadedMaskUrl,
            editPrompt: updatedImage.prompt, // Persist the edit prompt
          });
        } catch (uploadError) {
          console.warn('Failed to upload image metadata to storage, skipping persistence:', uploadError);
          // Continue with success since the main image was generated successfully
        }

        // Complete the job
        setProgress(jobId, 100);
        completeJob(jobId);

        notification.success({
          title: modeLabels[editMode].successTitle,
          description: modeLabels[editMode].successDesc,
          duration: 4000,
        });

        // Trigger auto-save after successful edit
        onAutoSave?.();
      } else {
        // No image URL in result - mark as failed
        failJob(jobId, 'No image URL returned from the editing API');
        notification.error({
          title: 'Image Editing Failed',
          description: 'No image was generated. Please try again.',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Image editing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while editing the image.';

      // Mark job as failed
      failJob(jobId, errorMessage);

      notification.error({
        title: 'Image Editing Failed',
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsEditingImage(false);
    }
  }, [block.imageUrl, block.contentType, brandId, onImageUpdate, onAutoSave, onImageMetadataUpdate, addJob, startJob, setProgress, completeJob, failJob]);

  const handleGenerateImage = useCallback(async () => {
    if (!block.imagePrompt || block.imagePrompt.trim() === '') {
      notification.error({
        title: 'Image Prompt Required',
        description: 'Please write a description of the image you want to generate.',
      });
      return;
    }

    onImageUpdate('', true); // Signal start of generation
    setExplainability(null); // Clear previous explainability

    const genNotification = notification.loading({
      title: 'Generating Image...',
      description: 'Creating visual content with AI',
    });

    // Check if character consistency is enabled with active characters
    const useCharacterConsistency = characterConsistency?.enabled &&
      characterConsistency.characters &&
      characterConsistency.characters.length > 0 &&
      characterConsistency.characters.some(c => c.isActive);

    if (useCharacterConsistency) {
      // Use character-consistent generation (Nano Banana)
      const characterReferenceUrls = characterConsistency!.characters
        .filter(c => c.isActive)
        .map(c => c.characterSheetUrl);

      const result = await generateCharacterConsistentImageAction(
        block.imagePrompt,
        brandId,
        characterReferenceUrls
      );

      if (result.error || !result.imageUrl) {
        genNotification.update({
          type: 'error',
          title: 'Image Generation Failed',
          description: result.message,
          duration: 5000,
        });
        onImageUpdate('', false);
      } else {
        onImageUpdate(result.imageUrl, false);
        genNotification.update({
          type: 'success',
          title: 'Image Generated',
          description: 'Created with character consistency',
          duration: 4000,
        });
        // Trigger auto-save after successful generation
        onAutoSave?.();
      }
    } else {
      // Use standard image generation (Imagen)
      const result = await generateImageAction(block.imagePrompt);

      if (result.error || !result.imageUrl) {
        genNotification.update({
          type: 'error',
          title: 'Image Generation Failed',
          description: result.message,
          duration: 5000,
        });
        onImageUpdate('', false);
      } else {
        onImageUpdate(result.imageUrl, false);
        if (result.explainability) {
          setExplainability(result.explainability);
        }
        // Trigger auto-save after successful generation
        onAutoSave?.();
        genNotification.update({
          type: 'success',
          title: 'Image Generated',
          description: 'Visual content created successfully',
          duration: 4000,
        });
      }
    }
  }, [block.imagePrompt, brandId, characterConsistency, onImageUpdate, onAutoSave]);
  
  const handleSelectMedia = useCallback((url: string) => {
    onImageUpdate(url);
    setIsMediaSelectorOpen(false);
  }, [onImageUpdate]);
  
  const handleResetMedia = () => {
    onImageUpdate('');
    setExplainability(null); // Clear explainability when resetting media
  };
  
  const handleRegenerateAdCopy = async () => {
    setIsRegeneratingAdCopy(true);
    const regenNotification = notification.loading({
      title: 'Regenerating Ad Text...',
      description: 'Creating a fresh version',
    });

    const result = await regenerateAdCopyAction(
        brandProfile.summary || '',
        block.contentType,
        block.keyMessage || '',
        block.toneOfVoice || '',
        block.adCopy,
        block.imageUrl
    );
    setIsRegeneratingAdCopy(false);

    if (result.error || !result.newAdCopy) {
      regenNotification.update({
        type: 'error',
        title: 'Regeneration Failed',
        description: result.error,
        duration: 5000,
      });
    } else {
      onContentChange(result.newAdCopy);
      regenNotification.update({
        type: 'success',
        title: 'Ad Text Regenerated',
        description: 'A new version has been created',
        duration: 3000,
      });
    }
  };

  const handleRegenerateImagePrompt = async () => {
    setIsRegeneratingImagePrompt(true);
    const regenNotification = notification.loading({
      title: 'Regenerating Prompt...',
      description: 'Creating a new image description',
    });

    const result = await regenerateImagePromptAction(
        brandProfile.summary || '',
        block.contentType,
        block.keyMessage || '',
        block.toneOfVoice || '',
        block.imagePrompt,
        block.imageUrl
    );
    setIsRegeneratingImagePrompt(false);

    if (result.error || !result.newImagePrompt) {
      regenNotification.update({
        type: 'error',
        title: 'Prompt Regeneration Failed',
        description: result.error,
        duration: 5000,
      });
    } else {
      onImagePromptChange(result.newImagePrompt);
      regenNotification.update({
        type: 'success',
        title: 'Prompt Regenerated',
        description: 'A new image prompt has been created',
        duration: 3000,
      });
    }
  };


  const isVideo = block.imageUrl && (block.imageUrl.includes('video') || block.imageUrl.startsWith('data:video'));
  const isSocialMediaPost = block.contentType === 'Social Media Post';

  return (
    <>
    <Card className="flex flex-col group relative">
      {/* Delete button - visible on hover */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
          onClick={handleDeleteClick}
          title="Delete content block"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete content block</span>
        </Button>
      )}
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center pr-8">
            <CardTitle className="text-lg font-semibold">
              {block.contentType}
            </CardTitle>
          </div>
          {/* Time and Tone Controls Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Scheduled Time - Only for Social Media Posts */}
            {isSocialMediaPost && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap">Post at</span>
                <Input
                  type="time"
                  value={block.scheduledTime || ''}
                  onChange={(e) => onScheduledTimeChange?.(e.target.value || undefined)}
                  className="h-8 w-[130px] text-sm bg-background border-blue-300 dark:border-blue-700 focus:border-blue-500 focus:ring-blue-500 px-3"
                  placeholder="--:--"
                />
              </div>
            )}
            {/* Tone of Voice - For all content types */}
            <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium whitespace-nowrap">Tone</span>
              <Select
                value={block.toneOfVoice || 'Professional'}
                onValueChange={(value) => onToneOfVoiceChange?.(value)}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs bg-background border-purple-300 dark:border-purple-700 focus:border-purple-500 focus:ring-purple-500">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Playful">Playful</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {/* Image Display */}
        <div className="relative rounded-lg overflow-hidden bg-muted">
          {block.imageIsGenerating && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 text-primary-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-2 text-sm">Generating Image...</p>
            </div>
          )}
          {block.imageUrl ? (
            <div className="flex flex-col">
              <div className="relative aspect-video">
                {isVideo ? (
                  <video src={block.imageUrl} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <NextImage
                    src={block.imageUrl}
                    alt={block.imagePrompt}
                    fill
                    className="object-contain"
                    data-ai-hint="advertisement graphic"
                  />
                )}
                <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                  {/* Edit Image Button (Nano Banana) - only for images, not videos */}
                  {!isVideo && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className='h-8 w-8 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-md'
                      onClick={() => setIsEditImageDialogOpen(true)}
                      title="Edit image with AI"
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className='h-8 w-8 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-md'
                    onClick={handleResetMedia}
                    title="Remove image"
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              </div>
              <div className="p-2 flex justify-end items-center border-t bg-muted/20">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
                  <a
                    href={block.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`${isVideo ? 'video' : 'image'}-${Date.now()}.${isVideo ? 'mp4' : 'png'}`}
                    title={`Open ${isVideo ? 'video' : 'image'} in new tab (right-click to save as)`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open {isVideo ? 'Video' : 'Image'}
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            !block.imageIsGenerating && (
              <div className="aspect-video flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <ImageIcon className="mx-auto h-12 w-12" />
                  <p className="mt-2 text-sm">Image will appear here</p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Brand Soul Explainability */}
        {explainability && (
          <BrandSoulExplainability explainability={explainability} />
        )}

        {/* Ad Text Preview */}
        {block.adCopy && (
          <div className="bg-secondary/30 rounded-lg p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{block.adCopy}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col items-start gap-4">
        {/* Editing Controls */}
        <div className="w-full space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Edit Ad Text</h3>
              <Button variant="ghost" size="icon" className='h-8 w-8' onClick={handleRegenerateAdCopy} disabled={isRegeneratingAdCopy}>
                  {isRegeneratingAdCopy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  <span className="sr-only">Regenerate Ad Text</span>
              </Button>
            </div>
            <Textarea
              value={block.adCopy}
              onChange={(e) => onContentChange(e.target.value)}
              rows={4}
              className="bg-secondary/50"
              disabled={isRegeneratingAdCopy}
            />
          </div>
          {!block.imageUrl && !block.imageIsGenerating && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Edit Image Prompt</h3>
                   <Button variant="ghost" size="icon" className='h-8 w-8' onClick={handleRegenerateImagePrompt} disabled={isRegeneratingImagePrompt}>
                      {isRegeneratingImagePrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      <span className="sr-only">Regenerate Image Prompt</span>
                  </Button>
              </div>
              <Textarea
                value={block.imagePrompt}
                onChange={(e) => onImagePromptChange(e.target.value)}
                rows={3}
                className="bg-secondary/50"
                disabled={isRegeneratingImagePrompt}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 w-full">
            <Button
                onClick={handleGenerateImage}
                disabled={block.imageIsGenerating || !!block.imageUrl || !block.imagePrompt?.trim()}
            >
                {block.imageIsGenerating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                : block.imageUrl
                ? 'Image Generated'
                : !block.imagePrompt?.trim()
                ? 'Add Image Description'
                : 'Generate Image'}
            </Button>
            <Dialog open={isMediaSelectorOpen} onOpenChange={setIsMediaSelectorOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" disabled={block.imageIsGenerating}>
                       <Library className="mr-2 h-4 w-4" /> Select from Gallery
                    </Button>
                </DialogTrigger>
                <DialogContent className='max-w-3xl'>
                    <DialogHeader>
                    <DialogTitle>Select Media from Galleries</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="images">
                    <TabsList className='grid w-full grid-cols-2'>
                        <TabsTrigger value="images"><ImageIcon className='mr-2 h-4 w-4'/>Images</TabsTrigger>
                        <TabsTrigger value="videos"><Film className='mr-2 h-4 w-4'/>Videos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="images">
                        <ScrollArea className='h-96'>
                        {mediaLoading ? <Loader2 className="mx-auto my-12 h-8 w-8 animate-spin" /> :
                        <div className='grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-1'>
                            {availableMedia.images.map(image => (
                            <div key={image.id} className='relative group aspect-square cursor-pointer' onClick={() => handleSelectMedia(image.generatedImageUrl || image.sourceImageUrl)}>
                                <NextImage src={image.generatedImageUrl || image.sourceImageUrl} alt={image.title} fill sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw" className='object-cover rounded-md' />
                                <div className={cn('absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity',
                                    block.imageUrl === image.generatedImageUrl || block.imageUrl === image.sourceImageUrl ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                )}>
                                <Check className='h-8 w-8 text-white' />
                                </div>
                            </div>
                            ))}
                        </div>}
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="videos">
                        <ScrollArea className='h-96'>
                           {mediaLoading ? <Loader2 className="mx-auto my-12 h-8 w-8 animate-spin" /> :
                            <div className='grid grid-cols-2 md:grid-cols-3 gap-2 p-1'>
                                {availableMedia.videos.map(video => (
                                    <div key={video.id} className='relative group aspect-video cursor-pointer' onClick={() => handleSelectMedia(video.videoUrl)}>
                                        <video src={video.videoUrl} className='w-full h-full object-cover rounded-md bg-black' />
                                        <div className={cn('absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity',
                                            block.imageUrl === video.videoUrl ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        )}>
                                        <Check className='h-8 w-8 text-white' />
                                        </div>
                                    </div>
                                ))}
                            </div>}
                        </ScrollArea>
                    </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => setIsSharePreviewOpen(true)} disabled={!block.imageUrl}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
        </Button>
        {block.imageUrl && (
            <SharePreviewDialog
                isOpen={isSharePreviewOpen}
                onOpenChange={setIsSharePreviewOpen}
                text={block.adCopy}
                mediaUrl={block.imageUrl}
                mediaType={isVideo ? 'video' : 'image'}
                brandName={brandName}
                brandId={brandId}
                contentBlockId={block.id}
                campaignId={campaignId}
                campaignDate={campaignDate}
            />
        )}
      </CardFooter>
    </Card>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Content Block?</AlertDialogTitle>
          <AlertDialogDescription>
            This content block has content that will be permanently deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* AI Image Studio - Using the same EditImagePage component as Image Gallery */}
    {isEditImageDialogOpen && (
      <EditImagePage
        image={{
          id: block.id || 'content-block-edit',
          brandId: brandId,
          title: block.contentType || 'Content Block Image',
          // Use editPrompt if available (from previous AI edit), otherwise fall back to imagePrompt (original generation prompt)
          prompt: block.editPrompt || block.imagePrompt || '',
          sourceImageUrl: block.sourceImageUrl || block.imageUrl || '',
          generatedImageUrl: block.imageUrl || '',
          additionalImageUrls: block.fusionSourceUrls || [],
        }}
        initialMaskUrl={block.maskUrl}
        onSave={handleEditImageSave}
        onCancel={() => setIsEditImageDialogOpen(false)}
      />
    )}
    </>
  );
});

export default GeneratedContentCard;
