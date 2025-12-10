'use client';

import { CampaignData, StructuredData } from '@/types/chat';
import { Calendar, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseISODateAsLocal } from '@/lib/utils';

export const createHandleOpenCampaign = (
  brandId: string | undefined,
  setIsSavingCampaign: React.Dispatch<React.SetStateAction<boolean>>,
  closeChatbot: () => void,
  router: any
) => {
  return async (campaignData: CampaignData) => {
    if (!brandId || !campaignData) return;

    setIsSavingCampaign(true);

    try {
      // Import the save campaign action dynamically
      const {
        saveCampaignAction,
        saveChatbotImageAction,
        saveChatbotVideoAction
      } = await import('@/app/actions');

      // Transform campaignDays to GeneratedCampaignContent format
      const generatedContent = campaignData.campaignDays.map((day) => ({
        day: day.day,
        date: day.date,
        contentBlocks: day.contentBlocks.map((block) => ({
          id: block.id,
          contentType: block.contentType,
          adCopy: block.keyMessage,
          imagePrompt: `Generate an image for: ${block.keyMessage}`,
          keyMessage: block.keyMessage,
          toneOfVoice: block.toneOfVoice,
          scheduledTime: block.scheduledTime,
        })),
      }));

      // Save the campaign
      const result = await saveCampaignAction(
        brandId,
        generatedContent,
        null,
        campaignData.campaignName,
        null,
        campaignData.prompt || null,
        (campaignData as any).characterConsistency || null
      );

      if (result.error) {
        throw new Error(result.message);
      }

      // Store the campaign ID to auto-load it
      if (result.campaignId) {
        sessionStorage.setItem('autoLoadCampaignId', result.campaignId);
      }

      // Close the AI Assistant panel
      closeChatbot();

      // Navigate to the home page where the campaign editor is
      router.push('/');
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert(`Failed to create campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingCampaign(false);
    }
  };
};

export const createHandleCreateEvent = (
  brandId: string | undefined,
  setIsSavingCampaign: React.Dispatch<React.SetStateAction<boolean>>,
  closeChatbot: () => void,
  toast: any
) => {
  return async (campaignData: CampaignData) => {
    if (!brandId || !campaignData) return;

    setIsSavingCampaign(true);

    try {
      // Call the new create-campaign API (no AI generation)
      const response = await fetch('/api/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: campaignData.prompt,
          brandId,
          characterConsistency: (campaignData as any).characterConsistency,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create campaign');
      }

      const createdCampaign: CampaignData & { contentGenerated: boolean } = await response.json();

      console.log('[Frontend] Campaign created (without AI content):', {
        campaignId: createdCampaign.campaignId,
        campaignName: createdCampaign.campaignName,
        totalDays: createdCampaign.campaignDays?.length || 0,
        contentGenerated: createdCampaign.contentGenerated,
      });

      if (!createdCampaign.campaignId) {
        throw new Error('Campaign was not saved properly');
      }

      // Close the AI Assistant panel
      closeChatbot();

      // Store campaign ID in sessionStorage for auto-load and trigger page refresh
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('autoLoadCampaignId', createdCampaign.campaignId);
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);

      toast({
        variant: 'destructive',
        title: 'Event Creation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSavingCampaign(false);
    }
  };
};

export const createHandleGenerateCampaign = (
  brandId: string | undefined,
  setIsSavingCampaign: React.Dispatch<React.SetStateAction<boolean>>,
  closeChatbot: () => void,
  addJob: any,
  setProgress: any,
  completeJob: any,
  failJob: any,
  toast: any
) => {
  return async (campaignData: CampaignData) => {
    if (!brandId || !campaignData) return;

    setIsSavingCampaign(true);

    // Add job to the queue
    const duration = campaignData.campaignRequest?.duration || 1;
    const jobId = addJob({
      type: 'campaign-generation',
      title: campaignData.campaignName || 'Campaign',
      description: `${duration} day${duration !== 1 ? 's' : ''} • Generating content with AI`,
      status: 'running',
      metadata: {
        startDate: campaignData.campaignRequest?.startDate,
        duration,
      },
    });

    // Store loading state immediately for calendar to show spinners
    // Use localStorage for persistence across page refreshes during long generation
    if (typeof window !== 'undefined') {
      localStorage.setItem('pendingCampaign', JSON.stringify({
        startDate: campaignData.campaignRequest?.startDate,
        duration: campaignData.campaignRequest?.duration || 1,
        timestamp: Date.now(),
        jobId, // Link to job queue
      }));
    }

    // Close chatbot immediately to show calendar loading state
    closeChatbot();

    try {
      // Update progress as we go
      setProgress(jobId, 10);

      // Call the generation API endpoint
      const response = await fetch('/api/generate-campaign-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: campaignData.prompt,
          brandId,
          // Pass character consistency config if provided
          characterConsistency: (campaignData as any).characterConsistency,
        }),
      });

      setProgress(jobId, 50);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate campaign');
      }

      const generatedCampaign: CampaignData = await response.json();

      setProgress(jobId, 80);

      console.log('[Frontend] Generated campaign received:', {
        campaignName: generatedCampaign.campaignName,
        totalDays: generatedCampaign.campaignDays?.length || 0,
        totalBlocks: generatedCampaign.campaignDays?.reduce((sum, day) => sum + (day.contentBlocks?.length || 0), 0) || 0,
        firstDay: generatedCampaign.campaignDays?.[0],
      });

      // Campaign is auto-saved by the API, use the returned campaignId
      console.log('[Frontend] Using auto-saved campaign:', {
        campaignId: generatedCampaign.campaignId,
        campaignName: generatedCampaign.campaignName,
        totalDays: generatedCampaign.campaignDays?.length || 0,
        totalBlocks: generatedCampaign.campaignDays?.reduce((sum, day) => sum + (day.contentBlocks?.length || 0), 0) || 0,
      });

      if (!generatedCampaign.campaignId) {
        throw new Error('Campaign was generated but not saved properly');
      }

      // Mark job as completed
      completeJob(jobId, { resultUrl: '/' });

      // Close the AI Assistant panel
      closeChatbot();

      // Store campaign ID in sessionStorage for auto-load and trigger page refresh
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('autoLoadCampaignId', generatedCampaign.campaignId);
        localStorage.removeItem('pendingCampaign');
        sessionStorage.removeItem('pendingCampaign');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to generate campaign:', error);

      // Mark job as failed
      failJob(jobId, error instanceof Error ? error.message : 'Unknown error occurred');

      // Clear pending campaign state on error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pendingCampaign');
        sessionStorage.removeItem('pendingCampaign');
      }

      toast({
        variant: 'destructive',
        title: 'Event Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSavingCampaign(false);
    }
  };
};

export const isCampaignData = (data: any): data is StructuredData & CampaignData => {
  if (!data) return false;
  // For preview data (generate-campaign action), we want to be lenient to ensure the button shows
  return (data.action === 'generate-campaign' || data.action === 'navigate-to-campaign' || 'campaignName' in data);
};

export const createRenderStructuredData = (
  isSavingCampaign: boolean,
  handleCreateEvent: (campaignData: CampaignData) => void,
  handleOpenCampaign: (campaignData: CampaignData) => void
) => {
  return (data: StructuredData) => {
    if (!data) return null;

    // Special handling for AI campaign generation
    if (data.action === 'generate-campaign') {
      const characterConsistency = (data as any).characterConsistency;
      const hasCharacterConsistency = characterConsistency?.enabled && characterConsistency?.characters?.length > 0;

      return (
        <div className="mt-3 space-y-3">
          <div className="bg-background/50 rounded-lg p-3 border">
            <h4 className="font-semibold mb-2">Event Creator</h4>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Name:</span> {(data as any).campaignName}</p>
              <p><span className="text-muted-foreground">Duration:</span> {(data as any).campaignRequest?.duration || 1} days</p>
              <p><span className="text-muted-foreground">Start:</span> {(data as any).campaignRequest?.startDate ? parseISODateAsLocal((data as any).campaignRequest.startDate).toLocaleDateString() : 'Today'}</p>
              <p><span className="text-muted-foreground">Total Posts:</span> {(data as any).totalPosts || ((data as any).campaignDays ? (data as any).campaignDays.reduce((sum: number, day: any) => sum + day.contentBlocks.length, 0) : 'TBD')}</p>
              {hasCharacterConsistency && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs font-medium text-primary flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Character Consistency Enabled
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {characterConsistency.characters.length} character sheet(s) • Same characters across all images
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                📅 Creates event on calendar. Generate content later from the editor.
              </p>
            </div>
          </div>
          {/* Primary: Create Event (no AI generation) */}
          <Button
            onClick={() => handleCreateEvent(data as any)}
            disabled={isSavingCampaign}
            className="w-full"
          >
            {isSavingCampaign ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Event...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Create Event
              </>
            )}
          </Button>
        </div>
      );
    }

    // Legacy handling for old campaigns (kept for backward compatibility)
    if (data.action === 'navigate-to-campaign') {
      return (
        <div className="mt-3 space-y-3">
          <div className="bg-background/50 rounded-lg p-3 border">
            <h4 className="font-semibold mb-2">Event Summary</h4>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Name:</span> {(data as any).campaignName}</p>
              <p><span className="text-muted-foreground">Duration:</span> {(data as any).campaignRequest?.duration || 1} days</p>
              <p><span className="text-muted-foreground">Start:</span> {(data as any).campaignRequest?.startDate ? parseISODateAsLocal((data as any).campaignRequest.startDate).toLocaleDateString() : 'Today'}</p>
              <p><span className="text-muted-foreground">Posts per day:</span> {(data as any).campaignRequest?.postsPerDay || 'Varies'}</p>
            </div>
          </div>
          <Button
            onClick={() => handleOpenCampaign(data as any)}
            disabled={isSavingCampaign}
            className="w-full"
          >
            {isSavingCampaign ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Event...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Open Event Editor
              </>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-2 bg-background/50 rounded-lg p-3 border">
        {Object.entries(data).map(([key, value]) => {
          if (Array.isArray(value)) {
            return (
              <div key={key}>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">{key}</p>
                <ul className="list-disc list-inside space-y-1">
                  {value.map((item, i) => (
                    <li key={i} className="text-sm">{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
                  ))}
                </ul>
              </div>
            );
          } else if (typeof value === 'object' && value !== null) {
            return (
              <div key={key}>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">{key}</p>
                <div className="ml-3 space-y-1">
                  {Object.entries(value).map(([k, v]) => (
                    <p key={k} className="text-sm"><span className="font-medium">{k}:</span> {String(v)}</p>
                  ))}
                </div>
              </div>
            );
          } else {
            return (
              <div key={key}>
                <p className="text-sm"><span className="font-medium text-muted-foreground">{key}:</span> {String(value)}</p>
              </div>
            );
          }
        })}
      </div>
    );
  };
};