// Centralized AI Model Configuration
// These constants define the available models and default settings for the AI Model Configuration UI
// This file is separate from ai-settings.ts because "use server" files can only export async functions

export interface AIModelSettings {
  textModel: string;
  agentModel: string;
  teamChatModel: string;
  eventCreatorModel: string;
  domainSuggestionsModel: string;
  websitePlanningModel: string;
  teamStrategyModel: string;
  logoConceptsModel: string;
  searchModel: string;
  youtubeAnalysisModel: string;
  imageModel: string;
  imageEditModel: string;
  videoModel: string;
  musicModel: string;
}

// Available model choices for the AI Model Configuration UI
// These are the models users can select from in Settings
export const AVAILABLE_MODELS = {
  text: [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite' },
    { id: 'gemini-2.0-flash-thinking-001', name: 'Gemini 2.0 Flash Thinking' },
  ],
  image: [
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4.0 Standard' },
    { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4.0 Ultra' },
    { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4.0 Fast' },
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0 Generate 002' },
    { id: 'imagen-3.0-generate-001', name: 'Imagen 3.0 Generate 001' },
    { id: 'imagen-3.0-capability-001', name: 'Imagen 3.0 Fast' },
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (Nano Banana Pro)' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  ],
  imageEdit: [
    { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image (Nano Banana Pro)' },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  ],
  video: [
    { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Preview' },
    { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast Preview' },
    { id: 'veo-3.0-fast-generate-001', name: 'Veo 3.0 Fast' },
    { id: 'veo-2.0-generate-001', name: 'Veo 2.0' },
  ],
  music: [
    { id: 'lyria-002', name: 'Lyria 2 (Standard)' },
  ],
} as const;

// Default model settings - these are the defaults used when no user preference is set
// All code using hardcoded models should import and use these defaults
export const DEFAULT_SETTINGS: AIModelSettings = {
  textModel: 'gemini-2.0-flash',
  agentModel: 'gemini-2.0-flash',
  teamChatModel: 'gemini-2.0-flash',
  eventCreatorModel: 'gemini-2.0-flash',
  domainSuggestionsModel: 'gemini-2.0-flash',
  websitePlanningModel: 'gemini-2.0-flash',
  teamStrategyModel: 'gemini-2.0-flash',
  logoConceptsModel: 'gemini-2.0-flash',
  searchModel: 'gemini-2.0-flash',
  youtubeAnalysisModel: 'gemini-2.0-flash',
  imageModel: 'imagen-4.0-generate-001',
  imageEditModel: 'gemini-3-pro-image-preview',
  videoModel: 'veo-3.1-generate-preview',
  musicModel: 'lyria-002',
};
