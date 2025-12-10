'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2, Send, Sparkles, User, Image as ImageIcon, Video, X, Upload, MoreVertical, Trash2, Info, History, Edit2, Check, XCircle, ExternalLink, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConversationSidebar } from '@/components/conversation-sidebar';
import { BrandSoulExplainability } from '@/components/brand-soul-explainability';
import { Message } from '@/contexts/global-chatbot-context';
import { isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/youtube';
import { allModesInfo, examplePrompts } from '@/lib/chat-config';
import { renderStructuredData } from '@/lib/chat-renderers';
import { 
  MediaAttachment, 
  ModeCategory,
  UnifiedMode,
  TeamContext,
  ContextStats
} from '@/types/chat';

interface ChatInterfaceProps {
  brandId?: string;
  isFullScreen?: boolean;
  
  // State props
  selectedCategory: ModeCategory;
  setSelectedCategory: (category: ModeCategory) => void;
  selectedMode: UnifiedMode;
  setSelectedMode: (mode: UnifiedMode) => void;
  teamContext: TeamContext;
  setTeamContext: (context: TeamContext) => void;
  showContextForm: boolean;
  setShowContextForm: (show: boolean) => void;
  showClearDialog: boolean;
  setShowClearDialog: (show: boolean) => void;
  isClearing: boolean;
  contextStats: ContextStats | null;
  
  // Message props
  messages: Message[];
  isLoading: boolean;
  input: string;
  setInput: (input: string) => void;
  attachments: MediaAttachment[];
  mediaErrors: Record<string, boolean>;
  setMediaErrors: (errors: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  editingMessageId: string | null;
  editContent: string;
  setEditContent: (content: string) => void;
  deletingMessageId: string | null;
  selectedMessageIds: string[];
  
  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement>;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  
  // Handler functions
  handleSelectConversation: (conversationId: string) => void;
  handleNewConversation: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (index: number) => void;
  loadChatHistory: () => Promise<void>;
  handleClearHistory: () => Promise<void>;
  handleEditMessage: (message: Message) => void;
  handleSaveEdit: (messageId: string) => Promise<void>;
  handleCancelEdit: () => void;
  handleDeleteMessage: (messageId: string) => Promise<void>;
  handleInjectMedia: (mediaUrl: string, mediaType: 'image' | 'video') => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleExampleClick: (example: string) => void;
  toggleMessageSelection: (messageId: string) => void;
  
  // Utility functions
  openConversationSidebar: () => void;
}

export function ChatInterface({
  brandId,
  isFullScreen = false,
  selectedCategory,
  setSelectedCategory,
  selectedMode,
  setSelectedMode,
  teamContext,
  setTeamContext,
  showContextForm,
  setShowContextForm,
  showClearDialog,
  setShowClearDialog,
  isClearing,
  contextStats,
  messages,
  isLoading,
  input,
  setInput,
  attachments,
  mediaErrors,
  setMediaErrors,
  editingMessageId,
  editContent,
  setEditContent,
  deletingMessageId,
  selectedMessageIds,
  messagesEndRef,
  messagesContainerRef,
  fileInputRef,
  handleSelectConversation,
  handleNewConversation,
  handleFileSelect,
  removeAttachment,
  loadChatHistory,
  handleClearHistory,
  handleEditMessage,
  handleSaveEdit,
  handleCancelEdit,
  handleDeleteMessage,
  handleInjectMedia,
  handleSubmit,
  handleExampleClick,
  toggleMessageSelection,
  openConversationSidebar,
}: ChatInterfaceProps) {
  // This will contain the massive JSX rendering code
  // For now, return a simple placeholder to ensure compilation
  return (
    <div className="flex h-full bg-background">
      <div className="flex-1">
        <p>Chat interface placeholder - JSX will be moved here</p>
        {/* The massive UI rendering will be extracted here */}
      </div>
    </div>
  );
}