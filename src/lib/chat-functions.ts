'use client';

import { MediaAttachment, ContextStats } from '@/types/chat';
import { Message } from '@/contexts/global-chatbot-context';
import { parseISODateAsLocal } from '@/lib/utils';
import { cleanMessageContent, extractMediaFromContent } from '@/lib/chat-utils';
import { isYouTubeUrl } from '@/lib/youtube';

// Factory function to create loadChatHistory
export function createLoadChatHistory(
  brandId: string | undefined,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setSharedThinkingProcess: any,
  chatHistoryLoadedRef: React.MutableRefObject<string | null>,
  messages: Message[],
  isLoading: boolean,
  toast: any
) {
  return async (conversationIdToLoad?: string) => {
    if (!brandId) return;
    
    if (isLoading) {
      chatHistoryLoadedRef.current = brandId;
      return;
    }
    
    if (messages.length > 0) {
      chatHistoryLoadedRef.current = brandId;
      return;
    }
    
    if (chatHistoryLoadedRef.current === brandId) return;

    setIsLoading(true);
    chatHistoryLoadedRef.current = brandId;

    try {
      const response = await fetch(`/api/chat/history?brandId=${brandId}${conversationIdToLoad ? `&conversationId=${conversationIdToLoad}` : ''}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const messagesWithUrls = data.messages.map((msg: any) => {
            let processedMedia: MediaAttachment[] | undefined = undefined;
            const originalContent = msg.content || '';

            if (msg.media && msg.media.length > 0) {
              processedMedia = msg.media.map((m: any) => ({
                ...m,
                url: m.url || (m.data ? `data:${m.mimeType};base64,${m.data}` : ''),
              }));
            }
            
            // Extract YouTube URLs from content
            const youtubeUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;
            const allMatches: RegExpMatchArray[] = Array.from(originalContent.matchAll(youtubeUrlRegex));
            
            if (allMatches.length > 0) {
              const youtubeMedia: MediaAttachment[] = [];
              const seenVideoIds = new Set<string>();
              
              for (const match of allMatches) {
                const videoId = match[1];
                if (seenVideoIds.has(videoId)) continue;
                seenVideoIds.add(videoId);
                
                const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const alreadyInMedia = processedMedia?.some(m => {
                  if (!m.url) return false;
                  const existingVideoId = m.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
                  return existingVideoId === videoId;
                });
                
                if (!alreadyInMedia) {
                  youtubeMedia.push({
                    type: 'video',
                    url: youtubeUrl,
                    fileName: 'YouTube Video',
                    mimeType: 'video/youtube',
                  });
                }
              }
              
              if (youtubeMedia.length > 0) {
                processedMedia = [...(processedMedia || []), ...youtubeMedia];
              }
            }

            return {
              ...msg,
              id: msg.id,
              media: processedMedia,
              content: cleanMessageContent(msg.content, processedMedia),
            };
          });

          setMessages(messagesWithUrls);

          const lastAssistantMessage = messagesWithUrls
            .slice()
            .reverse()
            .find((msg: any) => msg.role === 'assistant' && msg.thoughts && msg.thoughts.length > 0);
          
          if (lastAssistantMessage && lastAssistantMessage.thoughts) {
            setSharedThinkingProcess(lastAssistantMessage.thoughts);
          } else {
            setSharedThinkingProcess([]);
          }

          toast({
            title: "✨ Chat History Loaded",
            description: `${messagesWithUrls.length} previous message${messagesWithUrls.length > 1 ? 's' : ''} restored`,
          });
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };
}

// Factory function to create fetchSessionStats
export function createFetchSessionStats(
  brandId: string | undefined,
  setSessionStats: any
) {
  return async () => {
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
  };
}

// Factory function to create handleClearHistory
export function createHandleClearHistory(
  brandId: string | undefined,
  setIsClearing: React.Dispatch<React.SetStateAction<boolean>>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setSessionStats: any,
  setContextStats: React.Dispatch<React.SetStateAction<ContextStats | null>>,
  setShowClearDialog: React.Dispatch<React.SetStateAction<boolean>>
) {
  return async () => {
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
  };
}