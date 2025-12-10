'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MediaAttachment } from '@/lib/types';
import type { ConversationListItem } from '@/lib/types/conversation';
import { DEFAULT_CONVERSATION_ID } from '@/lib/types/conversation';

// Message type for shared state
export interface Message {
  id?: string; // Firestore document ID
  role: 'user' | 'assistant';
  content: string;
  media?: MediaAttachment[];
  mode?: string;
  structuredData?: any;
  explainability?: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  };
  thoughts?: string[];
  timestamp?: string;
}

interface GlobalChatbotContextType {
  isOpen: boolean;
  openChatbot: (options?: { attachments?: MediaAttachment[], initialMessage?: string }) => void;
  closeChatbot: () => void;
  toggleChatbot: () => void;
  pendingAttachments: MediaAttachment[];
  pendingMessage: string | null;
  clearPendingAttachments: () => void;
  clearPendingMessage: () => void;
  // Conversation management
  currentConversationId: string;
  setCurrentConversationId: (id: string) => void;
  conversations: ConversationListItem[];
  setConversations: (conversations: ConversationListItem[]) => void;
  isConversationSidebarOpen: boolean;
  toggleConversationSidebar: () => void;
  openConversationSidebar: () => void;
  closeConversationSidebar: () => void;
  refreshConversations: () => void;
  conversationRefreshKey: number;
  // Shared chat state (persists across drawer/fullscreen switches)
  sharedMessages: Message[];
  setSharedMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sharedIsLoading: boolean;
  setSharedIsLoading: (loading: boolean) => void;
  sharedInput: string;
  setSharedInput: (input: string) => void;
  sharedAttachments: MediaAttachment[];
  setSharedAttachments: React.Dispatch<React.SetStateAction<MediaAttachment[]>>;
  // Thinking process state (for visual indicator in closed bubble)
  sharedThinkingProcess: string[];
  setSharedThinkingProcess: React.Dispatch<React.SetStateAction<string[]>>;
  // Abort controller for canceling generation
  sharedAbortController: AbortController | null;
  setSharedAbortController: (controller: AbortController | null) => void;
}

const GlobalChatbotContext = createContext<GlobalChatbotContextType | undefined>(undefined);

export function GlobalChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MediaAttachment[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Conversation state
  const [currentConversationId, setCurrentConversationId] = useState<string>(DEFAULT_CONVERSATION_ID);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isConversationSidebarOpen, setIsConversationSidebarOpen] = useState(false);
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);

  // Shared chat state (persists across drawer/fullscreen switches)
  const [sharedMessages, setSharedMessages] = useState<Message[]>([]);
  const [sharedIsLoading, setSharedIsLoading] = useState(false);
  const [sharedInput, setSharedInput] = useState('');
  const [sharedAttachments, setSharedAttachments] = useState<MediaAttachment[]>([]);
  // Thinking process state (for visual indicator in closed bubble)
  const [sharedThinkingProcess, setSharedThinkingProcess] = useState<string[]>([]);
  // Abort controller for canceling generation
  const [sharedAbortController, setSharedAbortController] = useState<AbortController | null>(null);

  const openChatbot = (options?: { attachments?: MediaAttachment[], initialMessage?: string }) => {
    if (options?.attachments) {
      setPendingAttachments(options.attachments);
    }
    if (options?.initialMessage) {
      setPendingMessage(options.initialMessage);
    }
    setIsOpen(true);
  };

  const closeChatbot = () => setIsOpen(false);
  const toggleChatbot = () => setIsOpen(prev => !prev);
  const clearPendingAttachments = () => setPendingAttachments([]);
  const clearPendingMessage = () => setPendingMessage(null);

  // Conversation sidebar controls
  const toggleConversationSidebar = useCallback(() => {
    setIsConversationSidebarOpen(prev => !prev);
  }, []);

  const openConversationSidebar = useCallback(() => {
    setIsConversationSidebarOpen(true);
  }, []);

  const closeConversationSidebar = useCallback(() => {
    setIsConversationSidebarOpen(false);
  }, []);

  // Trigger conversation list refresh
  const refreshConversations = useCallback(() => {
    setConversationRefreshKey(prev => prev + 1);
  }, []);

  return (
    <GlobalChatbotContext.Provider value={{
      isOpen,
      openChatbot,
      closeChatbot,
      toggleChatbot,
      pendingAttachments,
      pendingMessage,
      clearPendingAttachments,
      clearPendingMessage,
      // Conversation management
      currentConversationId,
      setCurrentConversationId,
      conversations,
      setConversations,
      isConversationSidebarOpen,
      toggleConversationSidebar,
      openConversationSidebar,
      closeConversationSidebar,
      refreshConversations,
      conversationRefreshKey,
      // Shared chat state
      sharedMessages,
      setSharedMessages,
      sharedIsLoading,
      setSharedIsLoading,
      sharedInput,
      setSharedInput,
      sharedAttachments,
      setSharedAttachments,
      // Thinking process state
      sharedThinkingProcess,
      setSharedThinkingProcess,
      // Abort controller
      sharedAbortController,
      setSharedAbortController,
    }}>
      {children}
    </GlobalChatbotContext.Provider>
  );
}

export function useGlobalChatbot() {
  const context = useContext(GlobalChatbotContext);
  if (context === undefined) {
    throw new Error('useGlobalChatbot must be used within a GlobalChatbotProvider');
  }
  return context;
}

// Re-export for convenience
export { DEFAULT_CONVERSATION_ID };
