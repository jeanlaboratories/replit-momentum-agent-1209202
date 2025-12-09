'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateAiImageAction } from '@/app/actions';
import { notification } from '@/hooks/use-notification';

interface ImageGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brandId: string;
}

export function ImageGenerationDialog({
  isOpen,
  onClose,
  onSuccess,
  brandId,
}: ImageGenerationDialogProps) {
  const [title, setTitle] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerate = async () => {
    if (!title.trim() || !prompt.trim()) {
      notification.error({
        title: 'Missing Information',
        description: 'Please enter both a title and prompt',
      });
      return;
    }

    setIsGenerating(true);
    const genNotification = notification.loading({
      title: 'Generating Image...',
      description: `Creating "${title.trim()}" with AI`,
    });

    try {
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const result = await generateAiImageAction(
        brandId,
        imageId,
        prompt.trim(),
        title.trim()
      );

      if (result.error) {
        genNotification.update({
          type: 'error',
          title: 'Image Generation Failed',
          description: result.error.join(', ') || 'Failed to generate image',
          duration: 5000,
        });
      } else {
        genNotification.update({
          type: 'success',
          title: 'Image Generated',
          description: `"${title.trim()}" created successfully`,
          duration: 4000,
        });
        setTitle('');
        setPrompt('');
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

  const handleClose = () => {
    if (!isGenerating) {
      setTitle('');
      setPrompt('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate AI Image
          </DialogTitle>
          <DialogDescription>
            Create beautiful images using AI. Describe what you want to see.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="image-title">Image Title</Label>
            <Input
              id="image-title"
              placeholder="e.g., Product Hero Image"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-prompt">Description</Label>
            <Textarea
              id="image-prompt"
              placeholder="Describe the image you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about style, mood, colors, and composition for best results
            </p>
          </div>
        </div>

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
            disabled={isGenerating || !title.trim() || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
