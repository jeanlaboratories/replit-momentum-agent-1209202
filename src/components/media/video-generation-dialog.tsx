'use client';

import * as React from 'react';
import { Loader2, Video, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateVideoAction } from '@/app/actions';
import { notification } from '@/hooks/use-notification';

interface VideoGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brandId: string;
}

export function VideoGenerationDialog({
  isOpen,
  onClose,
  onSuccess,
  brandId,
}: VideoGenerationDialogProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('text');

  // File states
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [selectedCharRef, setSelectedCharRef] = React.useState<string | null>(null);
  const [selectedStartFrame, setSelectedStartFrame] = React.useState<string | null>(null);
  const [selectedEndFrame, setSelectedEndFrame] = React.useState<string | null>(null);

  // File input refs
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const charRefInputRef = React.useRef<HTMLInputElement>(null);
  const startFrameInputRef = React.useRef<HTMLInputElement>(null);
  const endFrameInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, setFile: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!title.trim() || !description.trim()) {
      notification.error({
        title: 'Missing Information',
        description: 'Please enter both a title and description',
      });
      return;
    }

    // Validation based on mode
    if (activeTab === 'image' && !selectedImage) {
      notification.error({ title: 'Image Required', description: 'Please upload an image to animate' });
      return;
    }
    if (activeTab === 'ingredients' && !selectedCharRef) {
      notification.error({ title: 'Reference Required', description: 'Please upload a character reference' });
      return;
    }
    if (activeTab === 'frames' && (!selectedStartFrame || !selectedEndFrame)) {
      notification.error({ title: 'Frames Required', description: 'Please upload both start and end frames' });
      return;
    }

    setIsGenerating(true);
    const genNotification = notification.loading({
      title: 'Generating Video...',
      description: `Creating "${title.trim()}" - this takes 3-5 minutes`,
    });

    try {
      const videoId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Prepare arguments based on active tab
      let imageUrl, characterReferenceUrl, startFrameUrl, endFrameUrl;

      if (activeTab === 'image') imageUrl = selectedImage || undefined;
      if (activeTab === 'ingredients') characterReferenceUrl = selectedCharRef || undefined;
      if (activeTab === 'frames') {
        startFrameUrl = selectedStartFrame || undefined;
        endFrameUrl = selectedEndFrame || undefined;
      }

      const result = await generateVideoAction(
        brandId,
        videoId,
        description.trim(),
        title.trim(),
        imageUrl,
        characterReferenceUrl,
        startFrameUrl,
        endFrameUrl
      );

      if (result.error) {
        genNotification.update({
          type: 'error',
          title: 'Video Generation Failed',
          description: result.error.join(', ') || 'Failed to generate video',
          duration: 5000,
        });
      } else {
        genNotification.update({
          type: 'success',
          title: 'Video Generated',
          description: `"${title.trim()}" is ready to view`,
          duration: 5000,
        });
        resetForm();
        onSuccess();
      }
    } catch (error) {
      genNotification.update({
        type: 'error',
        title: 'Generation Error',
        description: 'An unexpected error occurred',
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedImage(null);
    setSelectedCharRef(null);
    setSelectedStartFrame(null);
    setSelectedEndFrame(null);
    setActiveTab('text');
  };

  const handleClose = () => {
    if (!isGenerating) {
      resetForm();
      onClose();
    }
  };

  const renderImageUpload = (
    label: string,
    image: string | null,
    setImage: (val: string | null) => void,
    inputRef: React.RefObject<HTMLInputElement>
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        {image ? (
          <div className="relative w-24 h-24 rounded-md overflow-hidden border">
            <img src={image} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setImage(null)}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="w-24 h-24 rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">Upload</span>
          </div>
        )}
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => handleFileSelect(e, setImage)}
        />
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-500" />
            Generate AI Video (Veo 3.1)
          </DialogTitle>
          <DialogDescription>
            Create engaging videos using Veo 3.1. Choose a mode below.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="ingredients">Character</TabsTrigger>
            <TabsTrigger value="frames">Frames</TabsTrigger>
          </TabsList>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-title">Video Title</Label>
              <Input
                id="video-title"
                placeholder="e.g., Product Demo Video"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGenerating}
              />
            </div>

            <TabsContent value="text" className="mt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Generate a video purely from a text description.
              </p>
            </TabsContent>

            <TabsContent value="image" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Animate a static image with text instructions.
              </p>
              {renderImageUpload("Source Image", selectedImage, setSelectedImage, imageInputRef)}
            </TabsContent>

            <TabsContent value="ingredients" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate a video featuring a specific character or object.
              </p>
              {renderImageUpload("Character/Object Reference", selectedCharRef, setSelectedCharRef, charRefInputRef)}
            </TabsContent>

            <TabsContent value="frames" className="mt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate a smooth transition video between two images.
              </p>
              <div className="flex gap-8">
                {renderImageUpload("Start Frame", selectedStartFrame, setSelectedStartFrame, startFrameInputRef)}
                {renderImageUpload("End Frame", selectedEndFrame, setSelectedEndFrame, endFrameInputRef)}
              </div>
            </TabsContent>

            <div className="space-y-2">
              <Label htmlFor="video-description">
                {activeTab === 'frames' ? 'Transition Description' : 'Scene Description'}
              </Label>
              <Textarea
                id="video-description"
                placeholder={
                  activeTab === 'frames'
                    ? "Describe the transition (e.g., 'morph smoothly', 'pan across')"
                    : "Describe the video scene, camera movements, and actions..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isGenerating}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">⏱️ Video generation takes 3-5 minutes</p>
              <p className="text-xs opacity-80">You'll receive a notification when your video is ready</p>
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating || !title.trim() || !description.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-2" />
                Generate Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
