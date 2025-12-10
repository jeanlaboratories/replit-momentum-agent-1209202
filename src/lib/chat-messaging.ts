'use client';

import { MediaAttachment } from '@/types/chat';
import { Message } from '@/contexts/global-chatbot-context';
import { deduplicateMedia, extractMediaFromContent } from '@/lib/chat-utils';
import { getImageFileName, getImageMimeType } from '@/lib/image-url';
import { parseISODateAsLocal } from '@/lib/utils';
import {
  saveChatbotImageAction,
  saveChatbotVideoAction,
  saveChatbotMusicAction,
} from '@/app/actions';

export async function createSendMessageFunction(
  selectedMode: string,
  brandId: string | undefined,
  user: any,
  detectedImageUrls: string[],
  attachments: MediaAttachment[],
  isLoading: boolean,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setSharedThinkingProcess: any,
  setSharedAbortController: any,
  sharedAbortController: AbortController | null,
  setContextStats: any,
  addJob: any,
  startJob: any,
  completeJob: any,
  failJob: any,
  setProgress: any,
  toast: any
) {
  return async (content: string, mediaOverride?: MediaAttachment[]) => {
    // Merge file attachments with detected image URLs
    const imageUrlAttachments: MediaAttachment[] = detectedImageUrls.map(url => ({
      type: 'image' as const,
      url,
      fileName: getImageFileName(url),
      mimeType: getImageMimeType(url),
    }));

    const currentAttachments = mediaOverride || [...attachments, ...imageUrlAttachments];
    if ((!content.trim() && currentAttachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: parseISODateAsLocal(new Date().toISOString()),
      media: deduplicateMedia(currentAttachments),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setSharedThinkingProcess([]);

    // Cancel any existing request
    if (sharedAbortController) {
      sharedAbortController.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    setSharedAbortController(abortController);

    try {
      let jobId: string | null = null;

      // Only create job for agent mode with media generation potential
      if (selectedMode === 'agent' && brandId && user?.uid) {
        jobId = addJob('Processing', 'Analyzing your request...');
        startJob(jobId);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          mode: selectedMode,
          brandId,
          media: currentAttachments,
          timestamp: userMessage.timestamp,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Request failed`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      let assistantMessageContent = '';
      let currentThoughts: string[] = [];
      let hasFinishedThinking = false;
      let currentStreamingThought = '';
      let currentStreamingMessage = '';

      // Track media that appears in the streaming response
      let currentMedia: MediaAttachment[] = [];
      let extractedUrls: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'thinking') {
                if (!hasFinishedThinking) {
                  currentStreamingThought += data.content;
                  setSharedThinkingProcess([...currentThoughts, currentStreamingThought]);
                  
                  if (jobId) {
                    setProgress(jobId, Math.min(20, currentStreamingThought.length / 10));
                  }
                }
              } else if (data.type === 'thinking_complete') {
                if (currentStreamingThought.trim()) {
                  currentThoughts.push(currentStreamingThought);
                  currentStreamingThought = '';
                }
                hasFinishedThinking = true;
                setSharedThinkingProcess(currentThoughts);
                
                if (jobId) {
                  setProgress(jobId, 30);
                }
              } else if (data.type === 'context_stats') {
                setContextStats({
                  tokenUsage: data.tokenUsage || 0,
                  maxTokens: data.maxTokens || 0,
                  activeMedia: data.activeMedia || []
                });
              } else if (data.type === 'content') {
                currentStreamingMessage += data.content;
                
                // Extract media URLs as they appear in the stream
                const mediaExtraction = extractMediaFromContent(currentStreamingMessage);
                if (mediaExtraction.urls.length > extractedUrls.length) {
                  const newUrls = mediaExtraction.urls.slice(extractedUrls.length);
                  extractedUrls = [...extractedUrls];
                  
                  // Add new media attachments for each new URL
                  for (const url of newUrls) {
                    const marker = mediaExtraction.markers.find(m => m.url === url);
                    if (marker) {
                      currentMedia.push({
                        type: marker.type as any,
                        url,
                        fileName: marker.type === 'music' ? 'Generated Music' : 
                                 marker.type === 'video' ? 'Generated Video' : 'Generated Image',
                        mimeType: marker.type === 'music' ? 'audio/mpeg' : 
                                 marker.type === 'video' ? 'video/mp4' : 'image/jpeg',
                      });
                      extractedUrls.push(url);
                    }
                  }
                }
                
                // Clean content for display (without media markers)
                assistantMessageContent = mediaExtraction.cleanContent;
                
                // Update the message in real-time
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage?.role === 'assistant' && !lastMessage.id) {
                    // Update existing assistant message
                    return prev.slice(0, -1).concat([{
                      ...lastMessage,
                      content: assistantMessageContent,
                      media: deduplicateMedia(currentMedia),
                      thoughts: hasFinishedThinking ? currentThoughts : undefined,
                    }]);
                  } else {
                    // Create new assistant message
                    return [...prev, {
                      role: 'assistant',
                      content: assistantMessageContent,
                      timestamp: parseISODateAsLocal(new Date().toISOString()),
                      media: deduplicateMedia(currentMedia),
                      thoughts: hasFinishedThinking ? currentThoughts : undefined,
                    }];
                  }
                });
                
                if (jobId) {
                  setProgress(jobId, 50 + (currentStreamingMessage.length / 20));
                }
              } else if (data.type === 'final_response') {
                // Handle structured data and media saving
                if (data.media?.length > 0 && brandId && user?.uid) {
                  for (const mediaItem of data.media) {
                    try {
                      if (mediaItem.type === 'image' && mediaItem.url) {
                        await saveChatbotImageAction(mediaItem.url, brandId, user.uid);
                      } else if (mediaItem.type === 'video' && mediaItem.url) {
                        await saveChatbotVideoAction(mediaItem.url, brandId, user.uid);
                      } else if (mediaItem.type === 'music' && mediaItem.url) {
                        await saveChatbotMusicAction(mediaItem.url, brandId, user.uid);
                      }
                    } catch (error) {
                      console.error(`Failed to save ${mediaItem.type}:`, error);
                    }
                  }
                }
                
                if (jobId) {
                  setProgress(jobId, 100);
                  completeJob(jobId);
                }
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        return;
      }
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
        timestamp: parseISODateAsLocal(new Date().toISOString()),
        isError: true,
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      if (jobId) {
        failJob(jobId, error.message || 'Request failed');
      }
      
      toast({
        title: "Error",
        description: error.message || 'Failed to send message. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSharedAbortController(null);
    }
  };
}

export async function fetchSessionStats(brandId: string | undefined, setSessionStats: any) {
  if (!brandId) return;
  try {
    const response = await fetch(`/api/chat/session-stats?brandId=${brandId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.stats) {
        setSessionStats(data.stats);
      }
    }
  } catch (error) {
    console.error('Failed to fetch session stats:', error);
  }
}

export async function handleClearHistory(
  brandId: string | undefined,
  setIsClearing: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setSessionStats: any,
  setContextStats: any,
  setShowClearDialog: React.Dispatch<React.SetStateAction<boolean>>
) {
  if (!brandId) return;
  setIsClearing(true);
  try {
    const response = await fetch('/api/chat/delete-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        setMessages([]);
        setSessionStats(null);
        setContextStats(null);
        setShowClearDialog(false);
      } else {
        console.error('Failed to clear chat history:', data);
        alert('Failed to clear chat history. Please try again.');
      }
    } else {
      const errorData = await response.json();
      console.error('Failed to clear chat history:', errorData);
      alert(`Error: ${errorData.error || 'Failed to clear chat history'}`);
    }
  } catch (error) {
    console.error('Error clearing chat history:', error);
    alert('An error occurred while clearing chat history. Please try again.');
  } finally {
    setIsClearing(false);
  }
}