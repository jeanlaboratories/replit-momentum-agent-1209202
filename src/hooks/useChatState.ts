import { useState, useRef } from 'react';
import { MediaAttachment, ModeCategory, UnifiedMode, TeamContext, ContextStats } from '@/types/chat';

export interface UseChatStateReturn {
  // Mode and category state
  selectedCategory: ModeCategory;
  setSelectedCategory: (category: ModeCategory) => void;
  selectedMode: UnifiedMode;
  setSelectedMode: (mode: UnifiedMode) => void;

  // Detection and context
  detectedImageUrls: string[];
  setDetectedImageUrls: (urls: string[]) => void;
  teamContext: TeamContext;
  setTeamContext: (context: TeamContext) => void;

  // UI state
  showContextForm: boolean;
  setShowContextForm: (show: boolean) => void;
  isSavingCampaign: boolean;
  setIsSavingCampaign: (saving: boolean) => void;
  showClearDialog: boolean;
  setShowClearDialog: (show: boolean) => void;
  isClearing: boolean;
  setIsClearing: (clearing: boolean) => void;

  // Media and message state
  mediaErrors: Record<string, boolean>;
  setMediaErrors: (errors: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  editContent: string;
  setEditContent: (content: string) => void;
  deletingMessageId: string | null;
  setDeletingMessageId: (id: string | null) => void;

  // Session and context stats
  sessionStats: { message_count?: number; created_at?: string; last_used?: string } | null;
  setSessionStats: (stats: any) => void;
  contextStats: ContextStats | null;
  setContextStats: (stats: ContextStats | null) => void;

  // Message selection
  selectedMessageIds: string[];
  setSelectedMessageIds: (ids: string[]) => void;

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement>;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  chatHistoryLoadedRef: React.MutableRefObject<string | null>;

  // Utility functions
  scrollToBottom: () => void;
  toggleMessageSelection: (messageId: string) => void;
}

export const useChatState = (): UseChatStateReturn => {
  // Mode and category state
  const [selectedCategory, setSelectedCategory] = useState<ModeCategory>('agent');
  const [selectedMode, setSelectedMode] = useState<UnifiedMode>('agent');

  // Detection and context
  const [detectedImageUrls, setDetectedImageUrls] = useState<string[]>([]);
  const [teamContext, setTeamContext] = useState<TeamContext>({});

  // UI state
  const [showContextForm, setShowContextForm] = useState(false);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Media and message state
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  // Session and context stats
  const [sessionStats, setSessionStats] = useState<{ message_count?: number; created_at?: string; last_used?: string } | null>(null);
  const [contextStats, setContextStats] = useState<ContextStats | null>(null);

  // Message selection
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatHistoryLoadedRef = useRef<string | null>(null);

  // Utility functions
  const scrollToBottom = () => {
    // Use scrollTop on container instead of scrollIntoView to prevent page scroll
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds(prev => 
      prev.includes(messageId) 
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  };

  return {
    // Mode and category state
    selectedCategory,
    setSelectedCategory,
    selectedMode,
    setSelectedMode,

    // Detection and context
    detectedImageUrls,
    setDetectedImageUrls,
    teamContext,
    setTeamContext,

    // UI state
    showContextForm,
    setShowContextForm,
    isSavingCampaign,
    setIsSavingCampaign,
    showClearDialog,
    setShowClearDialog,
    isClearing,
    setIsClearing,

    // Media and message state
    mediaErrors,
    setMediaErrors,
    editingMessageId,
    setEditingMessageId,
    editContent,
    setEditContent,
    deletingMessageId,
    setDeletingMessageId,

    // Session and context stats
    sessionStats,
    setSessionStats,
    contextStats,
    setContextStats,

    // Message selection
    selectedMessageIds,
    setSelectedMessageIds,

    // Refs
    messagesEndRef,
    messagesContainerRef,
    fileInputRef,
    chatHistoryLoadedRef,

    // Utility functions
    scrollToBottom,
    toggleMessageSelection,
  };
};