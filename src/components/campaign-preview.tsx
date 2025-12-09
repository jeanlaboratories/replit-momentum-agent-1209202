
'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import type { GeneratedCampaignContent, EditedImage, Video, BrandProfile } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import GeneratedContentCard from '@/components/generated-content-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, AlertCircle, Pencil, Plus, Wand2, ImageIcon, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { notification } from '@/hooks/use-notification';
import { saveCampaignAction, getBrandNameAction } from '@/app/actions';
import { useBrandData } from '@/hooks/use-brand-data';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateId } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import { useJobQueue } from '@/contexts/job-queue-context';

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

interface CampaignPreviewProps {
  brandId: string;
  initialContent: GeneratedCampaignContent;
  brandProfile: BrandProfile;
  onBack: () => void;
  onCampaignSaved: (id: string, updatedAt?: string) => void;
  setGeneratedContent: Dispatch<SetStateAction<GeneratedCampaignContent | null>>;
  loadedCampaignId: string | null;
  campaignUpdatedAt: string | null;
  campaignName: string;
  campaignPrompt?: string;
  onPromptChange?: (prompt: string) => void;
  characterConsistency?: CharacterConsistencyConfig;
  onCharacterConsistencyChange?: (config: CharacterConsistencyConfig) => void;
}

export default function CampaignPreview({
  brandId,
  initialContent,
  brandProfile,
  onBack,
  onCampaignSaved,
  setGeneratedContent,
  loadedCampaignId,
  campaignUpdatedAt,
  campaignName,
  campaignPrompt = '',
  onPromptChange,
  characterConsistency,
  onCharacterConsistencyChange,
}: CampaignPreviewProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [brandName, setBrandName] = useState<string>('Your Team');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editableCampaignName, setEditableCampaignName] = useState(campaignName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(campaignUpdatedAt);
  const [editablePrompt, setEditablePrompt] = useState(campaignPrompt);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editableCharacterConsistency, setEditableCharacterConsistency] = useState<CharacterConsistencyConfig | undefined>(characterConsistency);
  const [isEditingCharacterSheets, setIsEditingCharacterSheets] = useState(false);
  const [newCharacterUrl, setNewCharacterUrl] = useState('');
  const [newCharacterName, setNewCharacterName] = useState('');

  // Bulk generation state
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // Use the campaignUpdatedAt prop directly (updated by parent when auto-save occurs)
  useEffect(() => {
    setCurrentUpdatedAt(campaignUpdatedAt);
  }, [campaignUpdatedAt]);

  // Sync characterConsistency from prop
  useEffect(() => {
    setEditableCharacterConsistency(characterConsistency);
  }, [characterConsistency]);

  const defaultActiveItems = initialContent.map((day) => `day-${day.day}`);

  const { images, videos, loading } = useBrandData();
  const { addJob, startJob, completeJob, failJob, setProgress } = useJobQueue();

  // Use ref to avoid stale closure issues in intervals
  const setProgressRef = useRef(setProgress);
  useEffect(() => {
    setProgressRef.current = setProgress;
  }, [setProgress]);

  // Use ref to track the latest content for auto-save (avoids stale closure issues)
  const contentRef = useRef(initialContent);
  useEffect(() => {
    contentRef.current = initialContent;
  }, [initialContent]);

  // Fetch brand name on mount
  useEffect(() => {
    const fetchBrandName = async () => {
      try {
        const result = await getBrandNameAction(brandId);
        if (result.name) {
          setBrandName(result.name);
        }
      } catch (error) {
        console.error('Failed to fetch brand name:', error);
      }
    };
    fetchBrandName();
  }, [brandId]);

  // Memoize availableMedia to prevent prop recreation
  const availableMedia = useMemo(() => ({ images, videos }), [images, videos]);


  const handleContentChange = useCallback((
    dayIndex: number,
    blockIndex: number,
    newAdCopy: string
  ) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
        if (!prevContent) return null;
        const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
        newContent[dayIndex].contentBlocks[blockIndex].adCopy = newAdCopy;
        return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);
  
  const handleImagePromptChange = useCallback((
    dayIndex: number,
    blockIndex: number,
    newImagePrompt: string
  ) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
        if (!prevContent) return null;
        const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
        newContent[dayIndex].contentBlocks[blockIndex].imagePrompt = newImagePrompt;
        return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);

  const handleImageUpdate = useCallback((
    dayIndex: number,
    blockIndex: number,
    imageUrl: string,
    isGenerating = false,
  ) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
        if (!prevContent) return null;
        const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
        const block = newContent[dayIndex].contentBlocks[blockIndex];
        block.imageUrl = imageUrl;
        block.imageIsGenerating = isGenerating;
        // Also update contentRef immediately so auto-save has the latest data
        contentRef.current = newContent;
        return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);

  // Handler for AI Image Studio metadata (fusion sources, mask URL, source image, edit prompt)
  const handleImageMetadataUpdate = useCallback((
    dayIndex: number,
    blockIndex: number,
    metadata: {
      sourceImageUrl?: string;
      fusionSourceUrls?: string[];
      maskUrl?: string;
      editPrompt?: string;
    }
  ) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
      if (!prevContent) return null;
      const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
      const block = newContent[dayIndex].contentBlocks[blockIndex];
      // Only update fields that are provided in metadata
      if (metadata.sourceImageUrl !== undefined) {
        block.sourceImageUrl = metadata.sourceImageUrl;
      }
      if (metadata.fusionSourceUrls !== undefined) {
        block.fusionSourceUrls = metadata.fusionSourceUrls;
      }
      if (metadata.maskUrl !== undefined) {
        block.maskUrl = metadata.maskUrl;
      }
      if (metadata.editPrompt !== undefined) {
        block.editPrompt = metadata.editPrompt;
      }
      // Also update contentRef immediately so auto-save has the latest data
      // (setGeneratedContent updates React state, but contentRef is used for auto-save
      // and won't get the state update until the next render cycle)
      contentRef.current = newContent;
      return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);

  const handleAddContentBlock = useCallback((dayIndex: number) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
      if (!prevContent) return null;
      const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
      const newBlock = {
        id: generateId(),
        contentType: 'Social Media Post' as const,
        adCopy: '',
        imagePrompt: '',
        keyMessage: '',
        toneOfVoice: 'Professional' as const,
      };
      newContent[dayIndex].contentBlocks.push(newBlock);
      return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);

  const handleDeleteContentBlock = useCallback((dayIndex: number, blockIndex: number) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
      if (!prevContent) return null;
      const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
      // Remove the content block at the specified index
      newContent[dayIndex].contentBlocks.splice(blockIndex, 1);
      return newContent;
    });
    setHasUnsavedChanges(true);
    notification.success({
      title: 'Content Block Deleted',
      description: 'The content block has been removed.',
    });
  }, [setGeneratedContent]);

  const handleScheduledTimeChange = useCallback((
    dayIndex: number,
    blockIndex: number,
    scheduledTime: string | undefined
  ) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
      if (!prevContent) return null;
      const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
      newContent[dayIndex].contentBlocks[blockIndex].scheduledTime = scheduledTime;
      return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);

  const handleToneOfVoiceChange = useCallback((
    dayIndex: number,
    blockIndex: number,
    toneOfVoice: string
  ) => {
    setGeneratedContent((prevContent: GeneratedCampaignContent | null): GeneratedCampaignContent | null => {
      if (!prevContent) return null;
      const newContent = JSON.parse(JSON.stringify(prevContent)) as GeneratedCampaignContent;
      newContent[dayIndex].contentBlocks[blockIndex].toneOfVoice = toneOfVoice;
      return newContent;
    });
    setHasUnsavedChanges(true);
  }, [setGeneratedContent]);


  const handleCampaignNameChange = (newName: string) => {
    setEditableCampaignName(newName);
    if (newName !== campaignName) {
      setHasUnsavedChanges(true);
    }
  };

  const handlePromptChange = (newPrompt: string) => {
    setEditablePrompt(newPrompt);
    onPromptChange?.(newPrompt);
    if (newPrompt !== campaignPrompt) {
      setHasUnsavedChanges(true);
    }
  };

  const handleSaveCampaign = async () => {
    if (!editableCampaignName.trim()) {
      notification.error({
        title: 'Invalid Name',
        description: 'Event name cannot be empty.',
      });
      return;
    }

    setIsSaving(true);
    const saveNotification = notification.loading({
      title: 'Saving Event...',
      description: 'Storing your changes',
    });

    const result = await saveCampaignAction(
      brandId,
      initialContent,
      loadedCampaignId,
      editableCampaignName,
      currentUpdatedAt,
      editablePrompt || null,
      editableCharacterConsistency || null
    );
    setIsSaving(false);

    if (result.conflict) {
      saveNotification.update({
        type: 'warning',
        title: 'Save Conflict Detected',
        description: result.message,
        duration: 10000,
      });
      return;
    }

    if (result.error || !result.campaignId) {
      saveNotification.update({
        type: 'error',
        title: 'Save Failed',
        description: result.message,
        duration: 5000,
      });
    } else {
      saveNotification.update({
        type: 'success',
        title: 'Event Saved',
        description: result.message,
        duration: 3000,
      });
      setHasUnsavedChanges(false);
      if (result.updatedAt) {
        setCurrentUpdatedAt(result.updatedAt);
      }
      onCampaignSaved(result.campaignId, result.updatedAt);
    }
  };

  // Helper function to handle SSE-based bulk generation with real progress tracking
  const handleBulkGenerateWithStreaming = async (
    generationType: 'text' | 'images' | 'all',
    jobType: 'campaign-content' | 'image-generation' | 'bulk-content',
    jobTitle: string,
    jobDescription: string,
  ) => {
    if (!loadedCampaignId) {
      notification.error({
        title: 'Campaign Not Saved',
        description: 'Please save the campaign first before generating content.',
      });
      return;
    }

    // Always save before generation to ensure all content (including new days/blocks synced from parent) is persisted
    // This is critical because generation loads content from Firestore, not local state
    const saveNotification = notification.loading({
      title: 'Saving Changes',
      description: 'Saving content before generating...',
    });

    const result = await saveCampaignAction(
      brandId,
      initialContent,
      loadedCampaignId,
      editableCampaignName,
      currentUpdatedAt,
      editablePrompt || null,
      editableCharacterConsistency || null
    );

    if (result.error || !result.campaignId) {
      saveNotification.update({
        type: 'error',
        title: 'Save Failed',
        description: result.message || 'Could not save changes before generating.',
        duration: 5000,
      });
      return;
    }

    saveNotification.update({
      type: 'success',
      title: 'Saved',
      description: 'Starting content generation...',
      duration: 2000,
    });
    setHasUnsavedChanges(false);
    if (result.updatedAt) {
      setCurrentUpdatedAt(result.updatedAt);
    }
    onCampaignSaved(result.campaignId, result.updatedAt);

    // Add to job queue
    const jobId = addJob({
      type: jobType,
      title: jobTitle,
      description: jobDescription,
      status: 'running',
      metadata: { campaignId: loadedCampaignId },
    });

    // Start the job to set startedAt timestamp for stall detection
    startJob(jobId);

    if (generationType === 'text' || generationType === 'all') {
      setIsGeneratingText(true);
    }
    if (generationType === 'images' || generationType === 'all') {
      setIsGeneratingImages(true);
    }

    setProgressRef.current(jobId, 5);

    // Track whether we received a complete event
    let jobCompleted = false;

    try {
      const response = await fetch('/api/bulk-generate-content/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: loadedCampaignId,
          brandId,
          generationType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start content generation');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events from buffer
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete event in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));

              // Update progress from real server events
              if (eventData.progress !== undefined) {
                setProgressRef.current(jobId, eventData.progress);
              }

              // Update job description with current status
              if (eventData.message && eventData.currentBlock && eventData.totalBlocks) {
                // Job description shows real-time status
              }

              // Handle completion
              if (eventData.type === 'complete') {
                jobCompleted = true;
                if (eventData.updatedContent) {
                  setGeneratedContent(eventData.updatedContent);
                }
                setProgressRef.current(jobId, 100);
                completeJob(jobId);

                notification.success({
                  title: generationType === 'text' ? 'Text Generated' :
                         generationType === 'images' ? 'Images Generated' : 'Content Generated',
                  description: eventData.message || 'AI has generated content for all blocks.',
                  duration: 4000,
                });

                // Auto-save after successful bulk generation
                // Using setTimeout to ensure state updates have propagated
                setTimeout(async () => {
                  if (editableCampaignName.trim() && loadedCampaignId) {
                    setIsSaving(true);
                    const autoSaveNotification = notification.loading({
                      title: 'Auto-saving...',
                      description: 'Saving generated content',
                    });

                    const result = await saveCampaignAction(
                      brandId,
                      eventData.updatedContent || initialContent,
                      loadedCampaignId,
                      editableCampaignName,
                      currentUpdatedAt,
                      editablePrompt || null,
                      editableCharacterConsistency || null
                    );
                    setIsSaving(false);

                    if (result.error || !result.campaignId) {
                      autoSaveNotification.update({
                        type: 'error',
                        title: 'Auto-save Failed',
                        description: result.message,
                        duration: 5000,
                      });
                    } else {
                      autoSaveNotification.update({
                        type: 'success',
                        title: 'Auto-saved',
                        description: 'Content saved automatically',
                        duration: 2000,
                      });
                      setHasUnsavedChanges(false);
                      if (result.updatedAt) {
                        setCurrentUpdatedAt(result.updatedAt);
                      }
                      onCampaignSaved(result.campaignId, result.updatedAt);
                    }
                  }
                }, 100);
              }

              // Handle errors
              if (eventData.type === 'error') {
                throw new Error(eventData.error || eventData.message);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete data
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }
      }

      // If stream ended without a complete event, fail the job
      if (!jobCompleted) {
        throw new Error('Generation stream ended unexpectedly');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
      failJob(jobId, errorMessage);

      notification.error({
        title: 'Generation Failed',
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      if (generationType === 'text' || generationType === 'all') {
        setIsGeneratingText(false);
      }
      if (generationType === 'images' || generationType === 'all') {
        setIsGeneratingImages(false);
      }
    }
  };

  // Bulk generation functions - now using real progress tracking via SSE
  const handleBulkGenerateText = async () => {
    const blocksCount = initialContent.reduce(
      (sum, day) => sum + day.contentBlocks.filter(block => !block.adCopy).length,
      0
    );

    await handleBulkGenerateWithStreaming(
      'text',
      'campaign-content',
      `${editableCampaignName || 'Campaign'} Text`,
      `Generating text for ${blocksCount} blocks`,
    );
  };

  const handleBulkGenerateImages = async () => {
    // Check if there are image prompts to generate from
    const blocksToGenerate = initialContent.flatMap(day =>
      day.contentBlocks.filter(block => block.imagePrompt && !block.imageUrl)
    );

    if (blocksToGenerate.length === 0) {
      notification.warning({
        title: 'No Image Prompts',
        description: 'Generate text content first to create image prompts, or add image prompts manually.',
      });
      return;
    }

    await handleBulkGenerateWithStreaming(
      'images',
      'image-generation',
      `${editableCampaignName || 'Campaign'} Images`,
      `Generating ${blocksToGenerate.length} images`,
    );
  };

  const handleBulkGenerateAll = async () => {
    // Count total blocks
    const totalBlocks = initialContent.reduce(
      (sum, day) => sum + day.contentBlocks.length,
      0
    );

    await handleBulkGenerateWithStreaming(
      'all',
      'bulk-content',
      `${editableCampaignName || 'Campaign'} Content`,
      `Generating text & images for ${totalBlocks} blocks`,
    );
  };

  // Check if content needs generation
  const needsTextGeneration = initialContent.some(day =>
    day.contentBlocks.some(block => !block.adCopy)
  );
  const needsImageGeneration = initialContent.some(day =>
    day.contentBlocks.some(block => block.imagePrompt && !block.imageUrl)
  );

  return (
    <div className="w-full">
      <div className="mb-8 flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Editor
        </Button>
        <div className="flex items-center gap-4">
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-md border border-amber-200 dark:border-amber-800 animate-pulse">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Unsaved changes</span>
            </div>
          )}
          <Button
            onClick={handleSaveCampaign}
            disabled={isSaving}
            size="lg"
            variant={hasUnsavedChanges ? "default" : "outline"}
            className={hasUnsavedChanges
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 transition-all duration-300 font-semibold"
              : "transition-all duration-300"
            }
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Save Event
          </Button>
        </div>
      </div>

      {/* Campaign Name Editor */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {isEditingName ? (
                <Input
                  value={editableCampaignName}
                  onChange={(e) => handleCampaignNameChange(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false);
                    }
                  }}
                  className="text-2xl font-headline h-auto py-2"
                  placeholder="Event Name"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{editableCampaignName || 'Untitled Event'}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditingName(true)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <CardDescription>
            Edit your event name and content below
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Campaign Prompt Section - Always visible for all campaigns */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              Generation Prompt
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingPrompt(!isEditingPrompt)}
              className="h-8"
            >
              <Pencil className="h-4 w-4 mr-2" />
              {isEditingPrompt ? 'Done' : 'Edit'}
            </Button>
          </div>
          <CardDescription className="text-sm">
            This prompt guides AI content generation for all text and images in this event
          </CardDescription>
          <div className="pt-3">
            {isEditingPrompt || (!editablePrompt && !campaignPrompt) ? (
              <Textarea
                value={editablePrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Describe what you want this event to achieve, the tone, style, and any specific content requirements..."
                className="min-h-[100px] resize-y"
              />
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                {editablePrompt || campaignPrompt}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Character Sheets Display */}
      {(editableCharacterConsistency?.enabled || isEditingCharacterSheets) && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                Character Sheets
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingCharacterSheets(!isEditingCharacterSheets)}
              >
                {isEditingCharacterSheets ? 'Done' : 'Edit'}
              </Button>
            </div>
            <CardDescription>
              {editableCharacterConsistency?.characters?.filter(c => c.isActive).length || 0} active character sheet(s) for consistent image generation (max 14 images)
              {editableCharacterConsistency?.useSceneToSceneConsistency && ' • Scene-to-scene consistency enabled'}
            </CardDescription>

            {/* Character sheets grid */}
            <div className="flex flex-wrap gap-3 pt-3">
              {editableCharacterConsistency?.characters?.map((character) => (
                <div
                  key={character.id}
                  className={`relative flex items-center gap-3 p-3 rounded-lg border ${
                    character.isActive ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <img
                    src={character.characterSheetUrl}
                    alt={character.name}
                    className="w-16 h-16 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23ddd" width="64" height="64"/><text x="32" y="32" text-anchor="middle" dy=".3em" fill="%23999" font-size="10">Error</text></svg>';
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{character.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {character.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  {isEditingCharacterSheets && (
                    <div className="absolute -top-2 -right-2 flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-full bg-background"
                        onClick={() => {
                          // Toggle active state
                          const updated: CharacterConsistencyConfig = {
                            ...editableCharacterConsistency!,
                            characters: editableCharacterConsistency!.characters.map(c =>
                              c.id === character.id ? { ...c, isActive: !c.isActive } : c
                            ),
                          };
                          setEditableCharacterConsistency(updated);
                          onCharacterConsistencyChange?.(updated);
                          setHasUnsavedChanges(true);
                        }}
                        title={character.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {character.isActive ? '✓' : '○'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6 rounded-full"
                        onClick={() => {
                          // Remove character
                          const updated: CharacterConsistencyConfig = {
                            ...editableCharacterConsistency!,
                            characters: editableCharacterConsistency!.characters.filter(c => c.id !== character.id),
                          };
                          setEditableCharacterConsistency(updated);
                          onCharacterConsistencyChange?.(updated);
                          setHasUnsavedChanges(true);
                        }}
                        title="Remove"
                      >
                        ×
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new character sheet */}
            {isEditingCharacterSheets && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-3">Add Character Sheet</p>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Character name"
                      value={newCharacterName}
                      onChange={(e) => setNewCharacterName(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Image URL (paste URL or upload)"
                      value={newCharacterUrl}
                      onChange={(e) => setNewCharacterUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      disabled={!newCharacterUrl || !newCharacterName}
                      onClick={() => {
                        // Add new character
                        const newCharacter = {
                          id: `char_${Date.now()}`,
                          name: newCharacterName || `Character ${(editableCharacterConsistency?.characters?.length || 0) + 1}`,
                          characterSheetUrl: newCharacterUrl,
                          isActive: true,
                        };
                        const updated: CharacterConsistencyConfig = editableCharacterConsistency ? {
                          ...editableCharacterConsistency,
                          characters: [...editableCharacterConsistency.characters, newCharacter],
                        } : {
                          enabled: true,
                          characters: [newCharacter],
                          useSceneToSceneConsistency: false,
                          maxReferenceImages: 14,
                        };
                        setEditableCharacterConsistency(updated);
                        onCharacterConsistencyChange?.(updated);
                        setNewCharacterUrl('');
                        setNewCharacterName('');
                        setHasUnsavedChanges(true);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {/* Image preview */}
                  {newCharacterUrl && (
                    <div className="flex items-center gap-3 p-2 border rounded bg-background">
                      <img
                        src={newCharacterUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect fill="%23fee" width="48" height="48"/><text x="24" y="24" text-anchor="middle" dy=".3em" fill="%23f66" font-size="8">Invalid</text></svg>';
                        }}
                      />
                      <span className="text-xs text-muted-foreground truncate flex-1">{newCharacterUrl}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
        </Card>
      )}

      {/* Bulk Generation Controls */}
      {(needsTextGeneration || needsImageGeneration) && (
        <Card className="mb-6 border-dashed border-primary/50 bg-primary/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              AI Content Generation
            </CardTitle>
            <CardDescription>
              Generate text and images for your content blocks using AI
            </CardDescription>
            <div className="flex flex-wrap gap-3 pt-3">
              {needsTextGeneration && (
                <Button
                  variant="outline"
                  onClick={handleBulkGenerateText}
                  disabled={isGeneratingText || isGeneratingImages}
                  className="flex-1 min-w-[160px]"
                >
                  {isGeneratingText ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Text...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate All Text
                    </>
                  )}
                </Button>
              )}
              {needsImageGeneration && (
                <Button
                  variant="outline"
                  onClick={handleBulkGenerateImages}
                  disabled={isGeneratingText || isGeneratingImages}
                  className="flex-1 min-w-[160px]"
                >
                  {isGeneratingImages ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Images...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Generate All Images
                    </>
                  )}
                </Button>
              )}
              {needsTextGeneration && needsImageGeneration && (
                <Button
                  onClick={handleBulkGenerateAll}
                  disabled={isGeneratingText || isGeneratingImages}
                  className="flex-1 min-w-[160px]"
                >
                  {(isGeneratingText && isGeneratingImages) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating All...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generate All Content
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      <Accordion
        type="multiple"
        defaultValue={defaultActiveItems}
        className="w-full space-y-4"
      >
        {initialContent.map((day, dayIndex) => (
          <AccordionItem
            value={`day-${day.day}`}
            key={day.day}
            className="border-b-0"
          >
            <Card className="overflow-hidden">
              <AccordionTrigger className="p-6 text-xl font-headline hover:no-underline">
                Day {day.day}
              </AccordionTrigger>
              <AccordionContent className="p-6 pt-0">
                <div className="grid gap-6 md:grid-cols-2">
                  {day.contentBlocks.map((block, blockIndex) => (
                    <GeneratedContentCard
                      key={block.id || blockIndex}
                      block={block}
                      brandProfile={brandProfile}
                      brandId={brandId}
                      brandName={brandName}
                      availableMedia={availableMedia}
                      mediaLoading={loading.media}
                      onContentChange={(newAdCopy) =>
                        handleContentChange(dayIndex, blockIndex, newAdCopy)
                      }
                      onImagePromptChange={(newImagePrompt) =>
                        handleImagePromptChange(dayIndex, blockIndex, newImagePrompt)
                      }
                      onImageUpdate={(imageUrl, isGenerating) =>
                        handleImageUpdate(dayIndex, blockIndex, imageUrl, isGenerating)
                      }
                      onDelete={() => handleDeleteContentBlock(dayIndex, blockIndex)}
                      onScheduledTimeChange={(scheduledTime) =>
                        handleScheduledTimeChange(dayIndex, blockIndex, scheduledTime)
                      }
                      onToneOfVoiceChange={(toneOfVoice) =>
                        handleToneOfVoiceChange(dayIndex, blockIndex, toneOfVoice)
                      }
                      onImageMetadataUpdate={(metadata) =>
                        handleImageMetadataUpdate(dayIndex, blockIndex, metadata)
                      }
                      characterConsistency={editableCharacterConsistency}
                      campaignId={loadedCampaignId || undefined}
                      campaignDate={day.date}
                      onAutoSave={async () => {
                        // Auto-save after individual image generation
                        // Use contentRef.current to get the latest content (avoids stale closure issues)
                        if (editableCampaignName.trim() && loadedCampaignId) {
                          setIsSaving(true);
                          const autoSaveNotification = notification.loading({
                            title: 'Auto-saving...',
                            description: 'Saving your changes',
                          });

                          const result = await saveCampaignAction(
                            brandId,
                            contentRef.current,
                            loadedCampaignId,
                            editableCampaignName,
                            currentUpdatedAt,
                            editablePrompt || null,
                            editableCharacterConsistency || null
                          );
                          setIsSaving(false);

                          if (result.error || !result.campaignId) {
                            autoSaveNotification.update({
                              type: 'error',
                              title: 'Auto-save Failed',
                              description: result.message,
                              duration: 5000,
                            });
                          } else {
                            autoSaveNotification.update({
                              type: 'success',
                              title: 'Auto-saved',
                              description: 'Content saved automatically',
                              duration: 2000,
                            });
                            setHasUnsavedChanges(false);
                            if (result.updatedAt) {
                              setCurrentUpdatedAt(result.updatedAt);
                            }
                            onCampaignSaved(result.campaignId, result.updatedAt);
                          }
                        }
                      }}
                    />
                  ))}
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <Button
                      variant="outline"
                      className="h-full w-full border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all duration-300 flex flex-col gap-2"
                      onClick={() => handleAddContentBlock(dayIndex)}
                    >
                      <Plus className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium">Add Content Block</span>
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
