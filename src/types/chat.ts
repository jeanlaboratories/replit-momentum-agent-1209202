export interface MediaAttachment {
  type: 'image' | 'video' | 'pdf' | 'audio' | 'music';
  url: string;
  file?: File;
  fileName?: string;
  mimeType?: string;
  isReinjected?: boolean; // Marks media that was re-injected from chat history (explicit user selection)
}

export interface ContentBlock {
  id: string;
  contentType: string;
  keyMessage: string;
  adCopy?: string;
  imagePrompt?: string;
  imageUrl?: string;
  toneOfVoice?: string;
  scheduledTime?: string;
}

export interface CampaignDay {
  id?: string;
  day: number;
  date: string;
  contentBlocks: ContentBlock[];
}

export interface CampaignRequest {
  startDate?: string;
  duration?: number;
  postsPerDay?: number;
}

export interface CampaignData {
  campaignId?: string;
  campaignName: string;
  campaignDays: CampaignDay[];
  campaignRequest?: CampaignRequest;
  prompt?: string;
}

export interface StructuredData {
  type?: string;
  data?: CampaignData | Record<string, unknown>;
  [key: string]: unknown;
}

export type ModeCategory = 'agent' | 'ai-models' | 'team-tools';

export type AgentMode = 'agent';
export type AIModel = 'gemini-text' | 'imagen' | 'gemini-vision' | 'veo' | 'nano-banana';
export type TeamTool = 'team-chat' | 'domain-suggestions' | 'website-planning' | 'team-strategy' | 'logo-concepts' | 'event-creator' | 'search' | 'youtube-analysis' | 'youtube-search' | 'crawl-website' | 'memory' | 'rag-search' | 'media-search' | 'media-index';

export type UnifiedMode = AgentMode | AIModel | TeamTool;
export type IconComponent = React.ComponentType<{ className?: string }>;

export interface ModeInfo {
  name: string;
  description: string;
  icon: IconComponent;
  requiresContext?: boolean;
}

export interface TeamContext {
  [key: string]: any;
}

export interface ContextStats {
  tokenUsage: number;
  maxTokens: number;
  activeMedia: Array<{
    type: 'file_api' | 'inline';
    uri?: string;
    mime_type: string;
    size?: number;
  }>;
}