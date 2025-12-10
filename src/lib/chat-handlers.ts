'use client';

import { MediaAttachment, StructuredData, CampaignData, UnifiedMode, ModeCategory, TeamContext, ContextStats } from '@/types/chat';
import { Message } from '@/contexts/global-chatbot-context';
import { validateFileUpload, formatFileSize, deduplicateMedia } from '@/lib/chat-utils';
import { uploadMultipleChatMedia } from '@/lib/chat-media-storage';
import { isYouTubeUrl } from '@/lib/youtube';
import { saveChatbotImageAction, saveChatbotVideoAction } from '@/app/actions';

const DEFAULT_CONVERSATION_ID = 'default';

export const createFileSelectHandler = (
  setAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>,
  toast: any
) => {
  return async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: MediaAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const validation = validateFileUpload(file);
      if (!validation.valid) {
        toast({
          title: "Upload Error",
          description: validation.error,
          variant: "destructive",
        });
        continue;
      }

      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newAttachments.push({
              type: validation.type!,
              url: e.target.result as string,
              file,
              fileName: file.name,
              mimeType: file.type,
            });

            if (newAttachments.length === files.length) {
              setAttachments(prev => [...prev, ...newAttachments]);
            }
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error reading file:', error);
        toast({
          title: "Error",
          description: `Failed to read file: ${file.name}`,
          variant: "destructive",
        });
      }
    }

    e.target.value = '';
  };
};

export const createRemoveAttachmentHandler = (
  setAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>
) => {
  return (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
};

export const createEditMessageHandler = (
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>,
  setEditContent: React.Dispatch<React.SetStateAction<string>>
) => {
  return (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content || '');
  };
};

export const createCancelEditHandler = (
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>,
  setEditContent: React.Dispatch<React.SetStateAction<string>>
) => {
  return () => {
    setEditingMessageId(null);
    setEditContent('');
  };
};

export const createInjectMediaHandler = (
  setAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>
) => {
  return (mediaUrl: string, mediaType: 'image' | 'video') => {
    console.log(`[GeminiChatbot] 🔗 INJECTING ${mediaType}: ${mediaUrl}`);
    
    setAttachments(prev => {
      const existingIndex = prev.findIndex(a => a.url === mediaUrl);
      
      if (existingIndex >= 0) {
        console.log(`[GeminiChatbot] ♻️ UPDATING existing ${mediaType} (marked as reinjected): ${mediaUrl}`);
        const updated = [...prev];
        updated[existingIndex] = { 
          ...updated[existingIndex], 
          isReinjected: true 
        };
        return updated;
      } else {
        console.log(`[GeminiChatbot] ➕ ADDING new ${mediaType} (marked as reinjected): ${mediaUrl}`);
        const newAttachment: MediaAttachment = {
          type: mediaType,
          url: mediaUrl,
          fileName: mediaType === 'video' ? 'YouTube Video' : 'Injected Image',
          mimeType: mediaType === 'video' ? 'video/youtube' : 'image/jpeg',
          isReinjected: true,
        };
        return [...prev, newAttachment];
      }
    });
  };
};

export const createSubmitHandler = (
  e: React.FormEvent,
  input: string,
  attachments: MediaAttachment[],
  isLoading: boolean,
  messages: Message[],
  selectedMode: string,
  selectedCategory: string,
  teamContext: any,
  detectedImageUrls: string[],
  brandId: string | undefined,
  user: any,
  handleSendMessage: (content: string, media?: MediaAttachment[]) => Promise<void>,
  setInput: React.Dispatch<React.SetStateAction<string>>,
  setAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>,
  setDetectedImageUrls: React.Dispatch<React.SetStateAction<string[]>>,
  toast: any
) => {
  return async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    
    let finalInput = input.trim();
    let finalAttachments = [...attachments];
    
    if (selectedCategory === 'team-tools' && selectedMode !== 'team-chat') {
      if (teamContext && Object.keys(teamContext).length > 0) {
        const contextString = Object.entries(teamContext)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        finalInput = `${finalInput}\n\nContext: ${contextString}`;
      }
    }
    
    if (detectedImageUrls.length > 0) {
      const detectedAttachments: MediaAttachment[] = detectedImageUrls.map(url => ({
        type: 'image',
        url,
        fileName: 'Detected Image',
        mimeType: 'image/jpeg',
      }));
      finalAttachments = [...finalAttachments, ...detectedAttachments];
    }
    
    if (finalAttachments.length > 0 && brandId && user?.uid) {
      try {
        const uploadedMedia = await uploadMultipleChatMedia(finalAttachments, brandId, user.uid);
        finalAttachments = uploadedMedia.map(uploaded => ({
          ...uploaded,
          file: undefined,
        }));
      } catch (error) {
        console.error('Media upload error:', error);
        toast({
          title: "Upload Failed",
          description: "Failed to upload media. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setInput('');
    setAttachments([]);
    setDetectedImageUrls([]);
    
    await handleSendMessage(finalInput, finalAttachments);
  };
};

export const createExampleClickHandler = (
  setInput: React.Dispatch<React.SetStateAction<string>>
) => {
  return (example: string) => {
    setInput(example);
  };
};

export const isCampaignData = (data: any): data is StructuredData & CampaignData => {
  return data?.data?.campaignDays && Array.isArray(data.data.campaignDays);
};

export const extractMarker = (content: string, marker: string, nextMarkers: string[]) => {
  const startIndex = content.indexOf(marker);
  if (startIndex === -1) return { before: content, extracted: null, after: '' };
  
  let endIndex = content.length;
  for (const nextMarker of nextMarkers) {
    const nextIndex = content.indexOf(nextMarker, startIndex + marker.length);
    if (nextIndex !== -1 && nextIndex < endIndex) {
      endIndex = nextIndex;
    }
  }
  
  const before = content.substring(0, startIndex);
  const extracted = content.substring(startIndex + marker.length, endIndex);
  const after = content.substring(endIndex);
  
  return { before, extracted, after };
};

export const createHandleSaveEdit = (
  brandId: string | undefined,
  messages: Message[],
  editContent: string,
  selectedMode: UnifiedMode,
  selectedCategory: ModeCategory,
  teamContext: TeamContext,
  currentConversationId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>,
  setEditContent: React.Dispatch<React.SetStateAction<string>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setContextStats: React.Dispatch<React.SetStateAction<ContextStats | null>>,
  setSharedThinkingProcess: React.Dispatch<React.SetStateAction<string[]>>,
  refreshConversations: () => void,
  toast: any
) => {
  return async (messageId: string) => {
    if (!brandId || !messageId || !editContent.trim()) return;

    try {
      const response = await fetch('/api/chat/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          messageId,
          content: editContent.trim(),
          role: 'user',
          timestamp: messages.find(m => m.id === messageId)?.timestamp,
          deleteNextOnly: true,
          cascade: false,
        }),
      });

      if (response.ok) {
        const messageIndex = messages.findIndex((m) => m.id === messageId);

        if (messageIndex === -1) {
          toast({
            title: "Error",
            description: "Message not found",
            variant: "destructive",
          });
          return;
        }

        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: editContent.trim(),
        };

        const nextMessageIndex = messageIndex + 1;
        if (nextMessageIndex < updatedMessages.length && updatedMessages[nextMessageIndex].role === 'assistant') {
          updatedMessages.splice(nextMessageIndex, 1);
        }

        setMessages(updatedMessages);

        setEditingMessageId(null);
        setEditContent('');

        toast({
          title: "Message updated",
          description: "Regenerating response...",
        });

        setIsLoading(true);

        try {
          const isLastUserMessage = messageIndex === updatedMessages.length - 1;
          const isFirstMessage = messageIndex === 0;

          if (isFirstMessage) {
            try {
              console.log('Editing first message, clearing session...');
              toast({
                title: "Resetting Session",
                description: "Starting a fresh conversation from this edit...",
              });
              await fetch('/api/chat/delete-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandId }),
              });
              setContextStats(null);
            } catch (err) {
              console.error('Failed to clear session:', err);
            }
          } else if (isLastUserMessage) {
            try {
              console.log('Editing last message, syncing with backend to undo last turn...');

              await fetch('/api/chat/undo-last-turn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandId }),
              });
            } catch (err) {
              console.error('Failed to undo last turn:', err);
            }
          }

          const messagesForAPI = updatedMessages.slice(0, messageIndex + 1);

          const assistantMessageIndex = messageIndex + 1;
          const messagesWithPlaceholder = [
            ...updatedMessages.slice(0, assistantMessageIndex),
            { role: 'assistant' as const, content: '', mode: selectedMode },
            ...updatedMessages.slice(assistantMessageIndex),
          ];
          setMessages(messagesWithPlaceholder);

          const apiMessages = messagesForAPI.map(m => ({
            role: m.role,
            content: m.content,
            media: m.media,
          }));

          const editedMessage = updatedMessages[messageIndex];
          const mediaToResend = editedMessage.media 
            ? editedMessage.media
                .filter(m => {
                  if (m.type === 'video' && m.url && isYouTubeUrl(m.url)) {
                    console.log('[GeminiChatbot] Filtering out YouTube URL from mediaToResend:', m.url);
                    return false;
                  }
                  return true;
                })
                .map(m => ({
                  type: m.type,
                  url: m.url,
                  fileName: m.fileName,
                  mimeType: m.mimeType
                }))
            : [];

          const aiResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: apiMessages,
              mode: selectedMode,
              media: mediaToResend,
              brandId: brandId,
              teamContext: selectedCategory === 'team-tools' ? teamContext : undefined,
            }),
          });

          if (!aiResponse.ok) {
            throw new Error('Failed to get response');
          }

          const contentType = aiResponse.headers.get('content-type');

          if (contentType?.includes('application/json')) {
            const data = await aiResponse.json();

            const originalContent = data.content || '';
            let generatedMedia: MediaAttachment[] = [];
            let explainabilityData: { summary: string; confidence: number; appliedControls: string[]; brandElements: string[]; avoidedElements: string[]; } | undefined = undefined;

            const markers: Array<{ type: 'image' | 'video' | 'image_url' | 'video_url' | 'explainability'; position: number }> = [];

            let searchPos = 0;
            while (searchPos < originalContent.length) {
              const imagePos = originalContent.indexOf('__IMAGE_DATA__', searchPos);
              const videoPos = originalContent.indexOf('__VIDEO_DATA__', searchPos);
              const imageUrlPos = originalContent.indexOf('__IMAGE_URL__', searchPos);
              const videoUrlPos = originalContent.indexOf('__VIDEO_URL__', searchPos);
              const explainPos = originalContent.indexOf('__EXPLAINABILITY__', searchPos);

              const nextPos = Math.min(
                imagePos >= 0 ? imagePos : Infinity,
                videoPos >= 0 ? videoPos : Infinity,
                imageUrlPos >= 0 ? imageUrlPos : Infinity,
                videoUrlPos >= 0 ? videoUrlPos : Infinity,
                explainPos >= 0 ? explainPos : Infinity
              );

              if (nextPos === Infinity) break;

              if (nextPos === imagePos) {
                markers.push({ type: 'image', position: imagePos });
                searchPos = imagePos + '__IMAGE_DATA__'.length;
              } else if (nextPos === videoPos) {
                markers.push({ type: 'video', position: videoPos });
                searchPos = videoPos + '__VIDEO_DATA__'.length;
              } else if (nextPos === imageUrlPos) {
                markers.push({ type: 'image_url', position: imageUrlPos });
                searchPos = imageUrlPos + '__IMAGE_URL__'.length;
              } else if (nextPos === videoUrlPos) {
                markers.push({ type: 'video_url', position: videoUrlPos });
                searchPos = videoUrlPos + '__VIDEO_URL__'.length;
              } else if (nextPos === explainPos) {
                markers.push({ type: 'explainability', position: explainPos });
                searchPos = explainPos + '__EXPLAINABILITY__'.length;
              }
            }

            for (let i = 0; i < markers.length; i++) {
              const marker = markers[i];
              let markerLength = 0;
              if (marker.type === 'image') markerLength = '__IMAGE_DATA__'.length;
              else if (marker.type === 'video') markerLength = '__VIDEO_DATA__'.length;
              else if (marker.type === 'image_url') markerLength = '__IMAGE_URL__'.length;
              else if (marker.type === 'video_url') markerLength = '__VIDEO_URL__'.length;
              else markerLength = '__EXPLAINABILITY__'.length;

              const startPos = marker.position + markerLength;
              const nextMarkerPos = markers[i + 1]?.position ?? originalContent.length;

              let payload = originalContent.substring(startPos, nextMarkerPos).trim();

              if (marker.type === 'image') {
                const base64Match = payload.match(/[A-Za-z0-9+/=]{20,}/);
                const cleanBase64 = base64Match ? base64Match[0] : '';
                if (cleanBase64 && cleanBase64.length > 100) {
                  generatedMedia.push({
                    type: 'image',
                    url: 'data:image/png;base64,' + cleanBase64,
                  });
                }
              } else if (marker.type === 'video') {
                const base64Match = payload.match(/[A-Za-z0-9+/=]{20,}/);
                const cleanBase64 = base64Match ? base64Match[0] : '';
                if (cleanBase64 && cleanBase64.length > 100) {
                  generatedMedia.push({
                    type: 'video',
                    url: 'data:video/mp4;base64,' + cleanBase64,
                  });
                }
              } else if (marker.type === 'image_url') {
                const urlMatch = payload.match(/https?:\/\/[^\s]+/);
                const url = urlMatch ? urlMatch[0] : payload;
                if (url) {
                  generatedMedia.push({
                    type: 'image',
                    url: url,
                  });
                }
              } else if (marker.type === 'video_url') {
                const urlMatch = payload.match(/https?:\/\/[^\s]+/);
                const url = urlMatch ? urlMatch[0] : payload;
                if (url) {
                  generatedMedia.push({
                    type: 'video',
                    url: url,
                  });
                }
              } else if (marker.type === 'explainability') {
                const explainJson = payload.split('\n')[0]?.trim();
                if (explainJson) {
                  try {
                    explainabilityData = JSON.parse(explainJson);
                  } catch (e) {
                    console.error('Failed to parse explainability:', e);
                  }
                }
              }
            }

            const firstMarkerPos = markers.length > 0 ? markers[0].position : originalContent.length;
            const finalContent = originalContent.substring(0, firstMarkerPos).trim();

            setMessages((prev) => {
              const updated = [...prev];
              updated[assistantMessageIndex] = {
                role: 'assistant',
                content: finalContent,
                mode: selectedMode,
                structuredData: data.data,
                media: generatedMedia.length > 0 ? deduplicateMedia(generatedMedia) : undefined,
                explainability: explainabilityData,
              };
              return updated;
            });
          } else {
            const isNdjsonHeader = contentType?.includes('application/x-ndjson');

            if (isNdjsonHeader || contentType?.includes('text/plain') || contentType?.includes('application/json')) {
              const reader = aiResponse.body?.getReader();
              const decoder = new TextDecoder();
              let assistantContent = '';
              let thinkingProcess: string[] = [];
              let generatedMedia: MediaAttachment[] = [];
              let structuredData: any = null;
              let currentExplainability: any = null;
              let isNdjson = isNdjsonHeader;

              if (reader) {
                let buffer = '';
                let firstChunkChecked = false;

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });

                  if (!firstChunkChecked && !isNdjson) {
                    const trimmedChunk = chunk.trim();
                    if (trimmedChunk.startsWith('{"type":') || trimmedChunk.startsWith('{"type" :')) {
                      console.log('Auto-detected NDJSON stream from content (regeneration)');
                      isNdjson = true;
                    }
                    firstChunkChecked = true;
                  }

                  if (isNdjson) {
                    buffer += chunk;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                      if (!line.trim()) continue;

                      try {
                        const event = JSON.parse(line);

                        if (event.type === 'log') {
                          thinkingProcess.push(event.content);
                          setSharedThinkingProcess([...thinkingProcess]);
                          setMessages((prev) => {
                            const updated = [...prev];
                            if (updated[assistantMessageIndex] && updated[assistantMessageIndex].role === 'assistant') {
                              updated[assistantMessageIndex] = {
                                ...updated[assistantMessageIndex],
                                content: assistantContent || 'Thinking...',
                                thoughts: [...thinkingProcess],
                              };
                            }
                            return updated;
                          });
                        } else if (event.type === 'context_update') {
                          setContextStats({
                            tokenUsage: event.token_usage,
                            maxTokens: event.max_tokens,
                            activeMedia: event.active_media
                          });
                        } else if (event.type === 'image') {
                          const imgData = event.data;
                          let url = '';
                          if (imgData.format === 'url') {
                            url = imgData.url;
                          } else if (imgData.format === 'base64') {
                            url = `data:image/png;base64,${imgData.data}`;
                          }

                          if (url) {
                            generatedMedia.push({
                              type: 'image',
                              url: url,
                              fileName: imgData.prompt
                            });

                            const agentExplainability = imgData.explainability || {
                              summary: `Image generated by AI Agent using Imagen 4.0 with prompt: "${imgData.prompt || 'Generated Image'}"`,
                              confidence: 0.85,
                              appliedControls: ['AI Agent Generation', 'Imagen 4.0'],
                              brandElements: [],
                              avoidedElements: []
                            };

                            currentExplainability = agentExplainability;

                            setMessages((prev) => {
                              const updated = [...prev];
                              updated[assistantMessageIndex] = {
                                ...updated[assistantMessageIndex],
                                media: [...generatedMedia],
                                explainability: agentExplainability
                              };
                              return updated;
                            });

                            if (brandId) {
                              const imageId = `chatbot-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                              saveChatbotImageAction(
                                brandId,
                                imageId,
                                imgData.prompt || 'Generated Image',
                                url
                              ).catch(err => console.error('Failed to save generated image to library:', err));
                            }
                          }
                        } else if (event.type === 'video') {
                          const vidData = event.data;
                          let url = '';
                          if (vidData.format === 'url') {
                            url = vidData.url;
                          } else if (vidData.format === 'base64') {
                            url = `data:video/mp4;base64,${vidData.data}`;
                          }

                          if (url) {
                            generatedMedia.push({
                              type: 'video',
                              url: url,
                              fileName: vidData.prompt
                            });

                            const videoExplainability = vidData.explainability || {
                              summary: `Video generated by AI Agent using Veo 2 with prompt: "${vidData.prompt || 'Generated Video'}"`,
                              confidence: 0.85,
                              appliedControls: ['AI Agent Generation', 'Veo 2'],
                              brandElements: [],
                              avoidedElements: []
                            };

                            currentExplainability = videoExplainability;

                            setMessages((prev) => {
                              const updated = [...prev];
                              updated[assistantMessageIndex] = {
                                ...updated[assistantMessageIndex],
                                media: [...generatedMedia],
                                explainability: videoExplainability
                              };
                              return updated;
                            });

                            if (brandId) {
                              const videoId = `chatbot-vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                              saveChatbotVideoAction(
                                brandId,
                                videoId,
                                vidData.prompt || 'Generated Video',
                                url,
                                vidData.input_image_url,
                                vidData.character_reference_url,
                                vidData.start_frame_url,
                                vidData.end_frame_url
                              ).catch(err => console.error('Failed to save generated video to library:', err));
                            }
                          }
                        } else if (event.type === 'text') {
                          assistantContent += event.content;
                          setMessages((prev) => {
                            const updated = [...prev];
                            if (updated[assistantMessageIndex] && updated[assistantMessageIndex].role === 'assistant') {
                              updated[assistantMessageIndex] = {
                                ...updated[assistantMessageIndex],
                                content: assistantContent,
                                thoughts: thinkingProcess.length > 0 ? thinkingProcess : undefined,
                              };
                            }
                            return updated;
                          });
                        } else if (event.type === 'data') {
                          structuredData = event.data;
                        } else if (event.type === 'final_response') {
                          assistantContent = event.content;

                          const imageUrlMatches = assistantContent.matchAll(/__IMAGE_URL__(.+?)__IMAGE_URL__/g);
                          for (const match of imageUrlMatches) {
                            if (match[1]) {
                              generatedMedia.push({
                                type: 'image',
                                url: match[1].trim(),
                              });
                            }
                          }
                          const videoUrlMatches = assistantContent.matchAll(/__VIDEO_URL__(.+?)__VIDEO_URL__/g);
                          for (const match of videoUrlMatches) {
                            if (match[1]) {
                              generatedMedia.push({
                                type: 'video',
                                url: match[1].trim(),
                              });
                            }
                          }

                          const cleanedContent = assistantContent
                            .replace(/__IMAGE_URL__.+?__IMAGE_URL__/g, '')
                            .replace(/__VIDEO_URL__.+?__VIDEO_URL__/g, '')
                            .trim();
                          assistantContent = cleanedContent;

                          setMessages((prev) => {
                            const updated = [...prev];
                            updated[assistantMessageIndex] = {
                              role: 'assistant',
                              content: assistantContent,
                              mode: selectedMode,
                              media: generatedMedia.length > 0 ? deduplicateMedia(generatedMedia) : undefined,
                              structuredData: structuredData,
                              thoughts: thinkingProcess.length > 0 ? thinkingProcess : undefined,
                              explainability: currentExplainability || undefined,
                            };
                            return updated;
                          });

                          if (brandId) {
                            fetch('/api/chat/history', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                brandId,
                                role: 'assistant',
                                content: assistantContent,
                                media: generatedMedia.length > 0 ? deduplicateMedia(generatedMedia) : undefined,
                                thoughts: thinkingProcess.length > 0 ? thinkingProcess : undefined,
                                structuredData: structuredData,
                                explainability: currentExplainability || undefined,
                                conversationId: currentConversationId !== DEFAULT_CONVERSATION_ID ? currentConversationId : undefined,
                              }),
                            }).then(() => refreshConversations()).catch(err => console.error('Failed to save assistant message:', err));
                          }
                        } else if (event.type === 'error') {
                          console.error('Stream error:', event.content);
                          toast({
                            title: "Error during processing",
                            description: event.content,
                            variant: "destructive"
                          });
                        }
                      } catch (e) {
                        console.error('Error parsing NDJSON line:', e, line);
                      }
                    }
                  } else {
                    assistantContent += chunk;
                    setMessages((prev) => {
                      const updated = [...prev];
                      if (updated[assistantMessageIndex] && updated[assistantMessageIndex].role === 'assistant') {
                        updated[assistantMessageIndex] = {
                          role: 'assistant',
                          content: assistantContent,
                          mode: selectedMode,
                        };
                      }
                      return updated;
                    });
                  }
                }
              }
            }
          }

          setIsLoading(false);
        } catch (error) {
          console.error('Error regenerating response:', error);
          toast({
            title: "Error",
            description: "Failed to regenerate response",
            variant: "destructive",
          });
          setMessages((prev) => prev.slice(0, -1));
          setIsLoading(false);
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to update message",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    }
  };
};

export const createHandleDeleteMessage = (
  brandId: string | undefined,
  messages: any[],
  contextStats: any,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setContextStats: React.Dispatch<React.SetStateAction<any>>,
  setDeletingMessageId: React.Dispatch<React.SetStateAction<string | null>>,
  toast: any
) => {
  return async (messageId: string) => {
    if (!brandId || !messageId) return;

    try {
      // Always delete only the selected message, preserving all subsequent messages
      const response = await fetch(
        `/api/chat/delete?brandId=${brandId}&messageId=${messageId}&cascade=false`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        // Remove only this message from local state (preserve all subsequent messages)
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        // Optimistically update context stats
        // Estimate tokens: ~4 chars per token + 258 per image
        const messageToDelete = messages.find(m => m.id === messageId);
        if (messageToDelete && contextStats) {
          let estimatedTokens = Math.ceil((messageToDelete.content?.length || 0) / 4);

          // Add media tokens if present
          if (messageToDelete.media && messageToDelete.media.length > 0) {
            // Standard Gemini image cost is ~258 tokens
            estimatedTokens += messageToDelete.media.length * 258;
          }

          setContextStats(prev => prev ? {
            ...prev,
            tokenUsage: Math.max(0, prev.tokenUsage - estimatedTokens)
          } : null);
        }

        toast({
          title: "Message deleted",
          description: "Message removed and context usage updated.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to delete message",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingMessageId(null);
    }
  };
};