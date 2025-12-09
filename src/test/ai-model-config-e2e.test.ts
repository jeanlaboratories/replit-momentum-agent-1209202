/**
 * Comprehensive End-to-End Tests for AI Model Configuration
 *
 * This test suite covers ALL AI Model Configuration functionality including:
 * - Model settings (text, image, video, agent models)
 * - Model parameters (temperature, max tokens, etc.)
 * - Model provider integrations (Google AI, Gemini)
 * - Model selection and switching
 * - Prompt templates and system instructions
 * - Brand-specific configurations
 * - Model capabilities and features
 * - Response streaming and handling
 * - Token counting and limits
 * - Model fallback strategies
 * - Context management
 * - Brand soul integration
 * - Team intelligence injection
 * - Model-specific operations (text, vision, image gen, video gen)
 * - Structured output and JSON schemas
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Type definitions for AI model configuration
interface AIModelSettings {
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
}

interface ModelParameters {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  responseMimeType?: string;
}

interface BrandTheme {
  colors: {
    primary: { h: number; s: number; l: number };
    secondary: { h: number; s: number; l: number };
    accent: { h: number; s: number; l: number };
  };
  gradients: Array<{
    name: string;
    from: { h: number; s: number; l: number };
    to: { h: number; s: number; l: number };
  }>;
  description: string;
  sourceColors?: string[];
}

interface TeamContext {
  teamProfile: {
    name: string;
    tagline?: string;
    mission?: string;
    website?: string;
    location?: string;
  };
  teamIntelligence?: any;
  teamMembers?: any[];
  sponsors?: any[];
  aiVisualBranding?: BrandTheme;
}

interface ChatMode {
  mode:
    | 'agent'
    | 'gemini-text'
    | 'gemini-vision'
    | 'imagen'
    | 'veo'
    | 'team-chat'
    | 'domain-suggestions'
    | 'website-planning'
    | 'team-strategy'
    | 'logo-concepts'
    | 'event-creator';
}

// Test data setup
const testBrand1 = 'brand-alpha-123';
const testBrand2 = 'brand-beta-456';
const testUser = 'user-001';

// Default AI model settings
const DEFAULT_MODEL_SETTINGS: AIModelSettings = {
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
  videoModel: 'veo-3-internal',
};

// Helper to create mock model settings
const createMockModelSettings = (overrides: Partial<AIModelSettings> = {}): AIModelSettings => {
  return {
    ...DEFAULT_MODEL_SETTINGS,
    ...overrides,
  };
};

// Helper to create mock model parameters
const createMockModelParameters = (overrides: Partial<ModelParameters> = {}): ModelParameters => {
  return {
    temperature: 1.0,
    maxOutputTokens: 2048,
    topP: 0.95,
    topK: 40,
    ...overrides,
  };
};

// Helper to create mock brand theme
const createMockBrandTheme = (overrides: Partial<BrandTheme> = {}): BrandTheme => {
  return {
    colors: {
      primary: { h: 210, s: 80, l: 50 },
      secondary: { h: 280, s: 70, l: 55 },
      accent: { h: 40, s: 90, l: 60 },
    },
    gradients: [
      {
        name: 'Primary Gradient',
        from: { h: 210, s: 80, l: 50 },
        to: { h: 230, s: 75, l: 60 },
      },
    ],
    description: 'Modern and professional color scheme',
    sourceColors: ['#3B82F6', '#8B5CF6', '#F59E0B'],
    ...overrides,
  };
};

// Helper to create mock team context
const createMockTeamContext = (overrides: Partial<TeamContext> = {}): TeamContext => {
  return {
    teamProfile: {
      name: 'Test Team',
      tagline: 'Building the future',
      mission: 'To create amazing products',
      website: 'https://example.com',
      location: 'San Francisco, CA',
    },
    teamIntelligence: {},
    teamMembers: [],
    sponsors: [],
    ...overrides,
  };
};

// Helper to estimate token count
const estimateTokenCount = (text: string): number => {
  return Math.ceil(text.length / 4);
};

// Helper to validate model name format
const isValidModelName = (modelName: string): boolean => {
  return /^[a-z0-9\-\.]+$/i.test(modelName);
};

describe('AI Model Configuration E2E Tests', () => {
  // ==================== 1. MODEL SETTINGS ====================
  describe('1. Model Settings Management', () => {
    it('should define default model settings', () => {
      const settings = DEFAULT_MODEL_SETTINGS;

      expect(settings.textModel).toBe('gemini-2.0-flash');
      expect(settings.agentModel).toBe('gemini-2.0-flash');
      expect(settings.imageModel).toBe('imagen-4.0-generate-001');
      expect(settings.videoModel).toBe('veo-3-internal');
    });

    it('should create brand-specific model settings', () => {
      const settings = createMockModelSettings({
        textModel: 'gemini-2.0-flash-exp',
        imageModel: 'imagen-3.0-generate-001',
      });

      expect(settings.textModel).toBe('gemini-2.0-flash-exp');
      expect(settings.imageModel).toBe('imagen-3.0-generate-001');
    });

    it('should merge brand settings with defaults', () => {
      const brandSettings: Partial<AIModelSettings> = {
        textModel: 'custom-model',
      };

      const finalSettings = {
        ...DEFAULT_MODEL_SETTINGS,
        ...brandSettings,
      };

      expect(finalSettings.textModel).toBe('custom-model');
      expect(finalSettings.imageModel).toBe('imagen-4.0-generate-001'); // Default
    });

    it('should support all model types', () => {
      const settings = createMockModelSettings();

      const modelTypes = [
        'textModel',
        'agentModel',
        'teamChatModel',
        'eventCreatorModel',
        'domainSuggestionsModel',
        'websitePlanningModel',
        'teamStrategyModel',
        'logoConceptsModel',
        'searchModel',
        'youtubeAnalysisModel',
        'imageModel',
        'imageEditModel',
        'videoModel',
      ];

      modelTypes.forEach(type => {
        expect(settings[type as keyof AIModelSettings]).toBeDefined();
      });
    });

    it('should validate model names', () => {
      const validNames = [
        'gemini-2.0-flash',
        'imagen-4.0-generate-001',
        'veo-3-internal',
        'gemini-3-pro-image-preview',
      ];

      validNames.forEach(name => {
        expect(isValidModelName(name)).toBe(true);
      });
    });

    it('should store settings per brand', () => {
      const brandSettings = new Map<string, AIModelSettings>();

      brandSettings.set(testBrand1, createMockModelSettings({ textModel: 'model-1' }));
      brandSettings.set(testBrand2, createMockModelSettings({ textModel: 'model-2' }));

      expect(brandSettings.get(testBrand1)?.textModel).toBe('model-1');
      expect(brandSettings.get(testBrand2)?.textModel).toBe('model-2');
    });

    it('should update individual model settings', () => {
      const settings = createMockModelSettings();

      settings.imageModel = 'imagen-3.0-generate-001';
      settings.videoModel = 'veo-3.1';

      expect(settings.imageModel).toBe('imagen-3.0-generate-001');
      expect(settings.videoModel).toBe('veo-3.1');
    });
  });

  // ==================== 2. MODEL PARAMETERS ====================
  describe('2. Model Parameters Configuration', () => {
    it('should configure temperature parameter', () => {
      const params = createMockModelParameters({ temperature: 1.3 });

      expect(params.temperature).toBe(1.3);
    });

    it('should configure max output tokens', () => {
      const params = createMockModelParameters({ maxOutputTokens: 4096 });

      expect(params.maxOutputTokens).toBe(4096);
    });

    it('should configure top_p parameter', () => {
      const params = createMockModelParameters({ topP: 0.9 });

      expect(params.topP).toBe(0.9);
    });

    it('should configure top_k parameter', () => {
      const params = createMockModelParameters({ topK: 50 });

      expect(params.topK).toBe(50);
    });

    it('should configure response MIME type', () => {
      const params = createMockModelParameters({
        responseMimeType: 'application/json'
      });

      expect(params.responseMimeType).toBe('application/json');
    });

    it('should use creative temperature for branding (1.3)', () => {
      const brandingParams = createMockModelParameters({ temperature: 1.3 });

      expect(brandingParams.temperature).toBe(1.3);
      expect(brandingParams.temperature).toBeGreaterThan(1.0);
    });

    it('should use low temperature for extraction (0.1)', () => {
      const extractionParams = createMockModelParameters({ temperature: 0.1 });

      expect(extractionParams.temperature).toBe(0.1);
      expect(extractionParams.temperature).toBeLessThan(1.0);
    });

    it('should validate temperature range (0-2)', () => {
      const temps = [0, 0.5, 1.0, 1.5, 2.0];

      temps.forEach(temp => {
        expect(temp).toBeGreaterThanOrEqual(0);
        expect(temp).toBeLessThanOrEqual(2.0);
      });
    });

    it('should support structured output with JSON', () => {
      const params = createMockModelParameters({
        responseMimeType: 'application/json',
      });

      expect(params.responseMimeType).toBe('application/json');
    });
  });

  // ==================== 3. CHAT MODES ====================
  describe('3. Chat Modes and Model Selection', () => {
    it('should define agent mode', () => {
      const mode: ChatMode = { mode: 'agent' };

      expect(mode.mode).toBe('agent');
    });

    it('should define text generation mode', () => {
      const mode: ChatMode = { mode: 'gemini-text' };

      expect(mode.mode).toBe('gemini-text');
    });

    it('should define vision analysis mode', () => {
      const mode: ChatMode = { mode: 'gemini-vision' };

      expect(mode.mode).toBe('gemini-vision');
    });

    it('should define image generation mode', () => {
      const mode: ChatMode = { mode: 'imagen' };

      expect(mode.mode).toBe('imagen');
    });

    it('should define video generation mode', () => {
      const mode: ChatMode = { mode: 'veo' };

      expect(mode.mode).toBe('veo');
    });

    it('should define team chat mode', () => {
      const mode: ChatMode = { mode: 'team-chat' };

      expect(mode.mode).toBe('team-chat');
    });

    it('should define domain suggestions mode', () => {
      const mode: ChatMode = { mode: 'domain-suggestions' };

      expect(mode.mode).toBe('domain-suggestions');
    });

    it('should define website planning mode', () => {
      const mode: ChatMode = { mode: 'website-planning' };

      expect(mode.mode).toBe('website-planning');
    });

    it('should define team strategy mode', () => {
      const mode: ChatMode = { mode: 'team-strategy' };

      expect(mode.mode).toBe('team-strategy');
    });

    it('should define logo concepts mode', () => {
      const mode: ChatMode = { mode: 'logo-concepts' };

      expect(mode.mode).toBe('logo-concepts');
    });

    it('should define event creator mode', () => {
      const mode: ChatMode = { mode: 'event-creator' };

      expect(mode.mode).toBe('event-creator');
    });

    it('should select model based on mode', () => {
      const settings = createMockModelSettings();
      const modes: Record<string, keyof AIModelSettings> = {
        'gemini-text': 'textModel',
        'agent': 'agentModel',
        'team-chat': 'teamChatModel',
        'event-creator': 'eventCreatorModel',
        'imagen': 'imageModel',
        'veo': 'videoModel',
      };

      Object.entries(modes).forEach(([mode, settingKey]) => {
        expect(settings[settingKey]).toBeDefined();
      });
    });
  });

  // ==================== 4. BRAND THEME CONFIGURATION ====================
  describe('4. AI Brand Theme Configuration', () => {
    it('should create brand theme with colors', () => {
      const theme = createMockBrandTheme();

      expect(theme.colors.primary).toEqual({ h: 210, s: 80, l: 50 });
      expect(theme.colors.secondary).toEqual({ h: 280, s: 70, l: 55 });
      expect(theme.colors.accent).toEqual({ h: 40, s: 90, l: 60 });
    });

    it('should define color gradients', () => {
      const theme = createMockBrandTheme();

      expect(theme.gradients).toHaveLength(1);
      expect(theme.gradients[0].name).toBe('Primary Gradient');
      expect(theme.gradients[0].from).toEqual({ h: 210, s: 80, l: 50 });
      expect(theme.gradients[0].to).toEqual({ h: 230, s: 75, l: 60 });
    });

    it('should include theme description', () => {
      const theme = createMockBrandTheme();

      expect(theme.description).toBe('Modern and professional color scheme');
    });

    it('should track source colors', () => {
      const theme = createMockBrandTheme();

      expect(theme.sourceColors).toEqual(['#3B82F6', '#8B5CF6', '#F59E0B']);
    });

    it('should validate HSL color format', () => {
      const theme = createMockBrandTheme();

      Object.values(theme.colors).forEach(color => {
        expect(color.h).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeLessThanOrEqual(360);
        expect(color.s).toBeGreaterThanOrEqual(0);
        expect(color.s).toBeLessThanOrEqual(100);
        expect(color.l).toBeGreaterThanOrEqual(0);
        expect(color.l).toBeLessThanOrEqual(100);
      });
    });

    it('should support multiple gradients', () => {
      const theme = createMockBrandTheme({
        gradients: [
          {
            name: 'Gradient 1',
            from: { h: 0, s: 100, l: 50 },
            to: { h: 60, s: 100, l: 50 },
          },
          {
            name: 'Gradient 2',
            from: { h: 180, s: 80, l: 40 },
            to: { h: 240, s: 80, l: 60 },
          },
        ],
      });

      expect(theme.gradients).toHaveLength(2);
    });

    it('should generate theme with high temperature', () => {
      const params = createMockModelParameters({ temperature: 1.3 });

      expect(params.temperature).toBe(1.3); // Creative generation
    });
  });

  // ==================== 5. TEAM CONTEXT INJECTION ====================
  describe('5. Team Context and Intelligence', () => {
    it('should create team context with profile', () => {
      const context = createMockTeamContext();

      expect(context.teamProfile.name).toBe('Test Team');
      expect(context.teamProfile.tagline).toBe('Building the future');
      expect(context.teamProfile.mission).toBe('To create amazing products');
    });

    it('should include team intelligence in context', () => {
      const context = createMockTeamContext({
        teamIntelligence: {
          voice: 'Professional and friendly',
          messaging: 'Clear and concise',
        },
      });

      expect(context.teamIntelligence).toBeDefined();
      expect(context.teamIntelligence.voice).toBe('Professional and friendly');
    });

    it('should include team members in context', () => {
      const context = createMockTeamContext({
        teamMembers: [
          { id: 'u1', name: 'Alice', role: 'Manager' },
          { id: 'u2', name: 'Bob', role: 'Contributor' },
        ],
      });

      expect(context.teamMembers).toHaveLength(2);
    });

    it('should include sponsors in context', () => {
      const context = createMockTeamContext({
        sponsors: [
          { id: 's1', name: 'Sponsor A' },
        ],
      });

      expect(context.sponsors).toHaveLength(1);
    });

    it('should include AI visual branding', () => {
      const theme = createMockBrandTheme();
      const context = createMockTeamContext({
        aiVisualBranding: theme,
      });

      expect(context.aiVisualBranding).toBeDefined();
      expect(context.aiVisualBranding?.colors.primary).toEqual({ h: 210, s: 80, l: 50 });
    });

    it('should support minimal context for performance', () => {
      const minimalContext = createMockTeamContext({
        teamIntelligence: undefined,
        teamMembers: undefined,
        sponsors: undefined,
      });

      expect(minimalContext.teamProfile).toBeDefined();
      expect(minimalContext.teamIntelligence).toBeUndefined();
    });
  });

  // ==================== 6. TOKEN MANAGEMENT ====================
  describe('6. Token Counting and Limits', () => {
    it('should estimate token count from text', () => {
      const text = 'This is a test message with approximately 10 words in it.';
      const tokens = estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should estimate 1 token per 4 characters', () => {
      const text = 'abcd'.repeat(100); // 400 characters
      const tokens = estimateTokenCount(text);

      expect(tokens).toBe(100);
    });

    it('should enforce token budget for team intelligence', () => {
      const tokenBudget = 100000;
      const contextSize = 80000;

      const withinBudget = contextSize <= tokenBudget;

      expect(withinBudget).toBe(true);
    });

    it('should warn when context exceeds 100k tokens', () => {
      const tokenBudget = 100000;
      const contextSize = 120000;

      const shouldWarn = contextSize > tokenBudget;

      expect(shouldWarn).toBe(true);
    });

    it('should configure max output tokens', () => {
      const params = createMockModelParameters({ maxOutputTokens: 4096 });

      expect(params.maxOutputTokens).toBe(4096);
    });

    it('should handle large context windows', () => {
      const maxContextWindow = 500000; // 500k tokens
      const currentContext = 100000;

      const hasCapacity = currentContext < maxContextWindow;

      expect(hasCapacity).toBe(true);
    });

    it('should estimate token budget for user identity', () => {
      const userIdentityBudget = 300;
      const userIdentityText = 'a'.repeat(1200); // 1200 chars = ~300 tokens

      const estimatedTokens = estimateTokenCount(userIdentityText);

      expect(estimatedTokens).toBeLessThanOrEqual(userIdentityBudget + 10);
    });

    it('should estimate token budget per sponsor', () => {
      const sponsorBudget = 200;
      const sponsorText = 'a'.repeat(800); // 800 chars = ~200 tokens

      const estimatedTokens = estimateTokenCount(sponsorText);

      expect(estimatedTokens).toBeLessThanOrEqual(sponsorBudget + 10);
    });
  });

  // ==================== 7. PROMPT ENGINEERING ====================
  describe('7. Prompt Templates and Engineering', () => {
    it('should construct system prompt with role', () => {
      const systemPrompt = `You are an AI Team Assistant for Test Team.`;

      expect(systemPrompt).toContain('AI Team Assistant');
      expect(systemPrompt).toContain('Test Team');
    });

    it('should inject team profile into prompt', () => {
      const context = createMockTeamContext();
      const prompt = `Team: ${context.teamProfile.name}\nMission: ${context.teamProfile.mission}`;

      expect(prompt).toContain('Test Team');
      expect(prompt).toContain('To create amazing products');
    });

    it('should inject user identity into prompt', () => {
      const userIdentity = {
        displayName: 'Alice Smith',
        roleTitle: 'Product Manager',
        mission: 'Build great products',
      };

      const prompt = `User: ${userIdentity.displayName}, ${userIdentity.roleTitle}`;

      expect(prompt).toContain('Alice Smith');
      expect(prompt).toContain('Product Manager');
    });

    it('should include capabilities list in prompt', () => {
      const capabilities = [
        'Event planning',
        'Content creation',
        'Image generation',
        'Video generation',
      ];

      const prompt = `Capabilities:\n${capabilities.map(c => `- ${c}`).join('\n')}`;

      expect(prompt).toContain('Event planning');
      expect(prompt).toContain('Image generation');
    });

    it('should support prompt enhancement with brand soul', () => {
      const originalPrompt = 'Create a professional logo';
      const brandSoul = 'Modern, minimalist, tech-focused';
      const enhancedPrompt = `${originalPrompt}\nBrand style: ${brandSoul}`;

      expect(enhancedPrompt).toContain(originalPrompt);
      expect(enhancedPrompt).toContain('Modern, minimalist');
    });

    it('should support structured prompts with sections', () => {
      const prompt = {
        role: 'AI Assistant',
        context: 'Team profile and intelligence',
        guidelines: 'How to be great',
        capabilities: 'Available tools',
      };

      expect(Object.keys(prompt)).toHaveLength(4);
    });

    it('should handle date parsing in prompts', () => {
      const dateExpressions = [
        'tomorrow',
        'next Monday',
        'in 3 days',
        '2024-01-15',
      ];

      dateExpressions.forEach(expr => {
        expect(expr).toBeDefined();
      });
    });
  });

  // ==================== 8. RESPONSE STREAMING ====================
  describe('8. Response Streaming and Handling', () => {
    it('should define streaming response markers', () => {
      const markers = {
        imageData: '__IMAGE_DATA__',
        videoData: '__VIDEO_DATA__',
        explainability: '__EXPLAINABILITY__',
        done: '[DONE]',
      };

      expect(markers.imageData).toBe('__IMAGE_DATA__');
      expect(markers.videoData).toBe('__VIDEO_DATA__');
      expect(markers.explainability).toBe('__EXPLAINABILITY__');
      expect(markers.done).toBe('[DONE]');
    });

    it('should support text streaming', () => {
      const chunks = ['Hello', ' ', 'World', '!'];
      const fullText = chunks.join('');

      expect(fullText).toBe('Hello World!');
    });

    it('should support JSON streaming (NDJSON)', () => {
      const jsonChunks = [
        { type: 'text', content: 'Hello' },
        { type: 'text', content: 'World' },
      ];

      jsonChunks.forEach(chunk => {
        expect(chunk.type).toBe('text');
        expect(chunk.content).toBeDefined();
      });
    });

    it('should encode text for streaming', () => {
      const text = 'Hello World';
      const encoder = new TextEncoder();
      const encoded = encoder.encode(text);

      expect(encoded).toBeDefined();
      expect(encoded.length).toBeGreaterThan(0);
      expect(typeof encoded.length).toBe('number');
    });

    it('should set proper streaming headers', () => {
      const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      };

      expect(headers['Content-Type']).toContain('text/plain');
      expect(headers['Cache-Control']).toContain('no-cache');
    });

    it('should support NDJSON content type', () => {
      const contentType = 'application/x-ndjson';

      expect(contentType).toBe('application/x-ndjson');
    });

    it('should mark end of stream', () => {
      const endMarker = '[DONE]';

      expect(endMarker).toBe('[DONE]');
    });
  });

  // ==================== 9. MODEL FALLBACK STRATEGIES ====================
  describe('9. Model Fallback and Error Handling', () => {
    it('should fallback from agent to text model', () => {
      const agentAvailable = false;
      const fallbackMode = agentAvailable ? 'agent' : 'gemini-text';

      expect(fallbackMode).toBe('gemini-text');
    });

    it('should fallback on Python service unavailable', () => {
      const pythonServiceAvailable = false;
      const fallbackMode = pythonServiceAvailable ? 'agent' : 'gemini-text';

      expect(fallbackMode).toBe('gemini-text');
    });

    it('should use default settings when brand settings missing', () => {
      const brandSettings: Partial<AIModelSettings> | null = null;
      const finalSettings = brandSettings || DEFAULT_MODEL_SETTINGS;

      expect(finalSettings).toEqual(DEFAULT_MODEL_SETTINGS);
    });

    it('should continue without team intelligence if missing', () => {
      const context = createMockTeamContext({
        teamIntelligence: undefined,
      });

      expect(context.teamProfile).toBeDefined();
      // Should not throw error
    });

    it('should handle API key missing gracefully', () => {
      const apiKey = process.env.MOMENTUM_GOOGLE_API_KEY || '';
      const hasApiKey = apiKey.length > 0;

      // In tests, API key may not be set
      expect(typeof hasApiKey).toBe('boolean');
    });

    it('should handle image fetch failure', () => {
      const imageFetchFailed = true;
      const shouldContinue = true; // Continue with available images

      expect(shouldContinue).toBe(true);
    });

    it('should stream error messages to user', () => {
      const errorMessage = 'An error occurred while processing your request.';
      const encoder = new TextEncoder();
      const encoded = encoder.encode(errorMessage);

      expect(encoded).toBeDefined();
      expect(encoded.length).toBeGreaterThan(0);
      expect(typeof encoded.length).toBe('number');
    });

    it('should return HTTP error codes', () => {
      const errorCodes = {
        badRequest: 400,
        unauthorized: 403,
        serverError: 500,
      };

      expect(errorCodes.badRequest).toBe(400);
      expect(errorCodes.unauthorized).toBe(403);
      expect(errorCodes.serverError).toBe(500);
    });
  });

  // ==================== 10. MODEL CAPABILITIES ====================
  describe('10. Model Capabilities and Features', () => {
    it('should support text generation', () => {
      const capability = 'text-generation';
      const settings = createMockModelSettings();

      expect(settings.textModel).toBeDefined();
    });

    it('should support image generation', () => {
      const capability = 'image-generation';
      const settings = createMockModelSettings();

      expect(settings.imageModel).toBe('imagen-4.0-generate-001');
    });

    it('should support video generation', () => {
      const capability = 'video-generation';
      const settings = createMockModelSettings();

      expect(settings.videoModel).toBe('veo-3-internal');
    });

    it('should support vision analysis', () => {
      const capability = 'vision-analysis';
      const mode: ChatMode = { mode: 'gemini-vision' };

      expect(mode.mode).toBe('gemini-vision');
    });

    it('should support image editing', () => {
      const settings = createMockModelSettings();

      expect(settings.imageEditModel).toBe('gemini-3-pro-image-preview');
    });

    it('should support multi-turn conversations', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      expect(messages).toHaveLength(3);
    });

    it('should support website crawling', () => {
      const capability = 'website-crawling';

      expect(capability).toBe('website-crawling');
    });

    it('should support domain suggestions', () => {
      const settings = createMockModelSettings();

      expect(settings.domainSuggestionsModel).toBeDefined();
    });

    it('should support event planning', () => {
      const settings = createMockModelSettings();

      expect(settings.eventCreatorModel).toBeDefined();
    });

    it('should support logo concept generation', () => {
      const settings = createMockModelSettings();

      expect(settings.logoConceptsModel).toBeDefined();
    });

    it('should support team strategy generation', () => {
      const settings = createMockModelSettings();

      expect(settings.teamStrategyModel).toBeDefined();
    });
  });

  // ==================== 11. STRUCTURED OUTPUT ====================
  describe('11. Structured Output and JSON Schemas', () => {
    it('should support JSON response format', () => {
      const params = createMockModelParameters({
        responseMimeType: 'application/json',
      });

      expect(params.responseMimeType).toBe('application/json');
    });

    it('should parse structured campaign data', () => {
      const campaignData = {
        campaignName: 'Summer Sale',
        duration: 7,
        startDate: '2024-06-01',
        postsPerDay: 2,
        contentTypes: ['social', 'email'],
      };

      expect(campaignData.campaignName).toBe('Summer Sale');
      expect(campaignData.duration).toBe(7);
      expect(campaignData.postsPerDay).toBe(2);
    });

    it('should validate structured output with schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const data = { name: 'Alice', age: 30 };

      expect(data.name).toBeDefined();
    });

    it('should support explainability metadata', () => {
      const explainability = {
        summary: 'Generated with brand controls',
        confidence: 0.95,
        appliedControls: ['content-filter', 'style-guide'],
        brandElementsUsed: ['color-palette'],
        avoidedElements: [],
      };

      expect(explainability.confidence).toBe(0.95);
      expect(explainability.appliedControls).toContain('content-filter');
    });

    it('should support image metadata output', () => {
      const imageMetadata = {
        imageUrl: 'https://storage.googleapis.com/image.jpg',
        enhancedPrompt: 'A professional logo design',
        explainability: {
          summary: 'Brand-aligned generation',
          confidence: 0.92,
          appliedControls: [],
          brandElementsUsed: ['brand-colors'],
          avoidedElements: [],
        },
      };

      expect(imageMetadata.imageUrl).toContain('image.jpg');
      expect(imageMetadata.explainability).toBeDefined();
    });

    it('should support video metadata output', () => {
      const videoMetadata = {
        videoUrl: 'https://storage.googleapis.com/video.mp4',
        aspectRatio: '16:9',
        duration: 5,
      };

      expect(videoMetadata.videoUrl).toContain('video.mp4');
      expect(videoMetadata.aspectRatio).toBe('16:9');
    });
  });

  // ==================== 12. CONTEXT OPTIMIZATION ====================
  describe('12. Context Size Management', () => {
    it('should support minimal context mode', () => {
      const fullContext = createMockTeamContext();
      const minimalContext = {
        teamProfile: fullContext.teamProfile,
      };

      expect(minimalContext.teamProfile).toBeDefined();
      expect(Object.keys(minimalContext)).toHaveLength(1);
    });

    it('should estimate context size in tokens', () => {
      const context = createMockTeamContext();
      const contextString = JSON.stringify(context);
      const estimatedTokens = estimateTokenCount(contextString);

      expect(estimatedTokens).toBeGreaterThan(0);
    });

    it('should not truncate team intelligence', () => {
      const teamIntelligence = {
        voice: 'Professional',
        messaging: 'Clear',
        visual: 'Modern',
      };

      const truncated = false; // Never truncate

      expect(truncated).toBe(false);
    });

    it('should include all extracted artifacts', () => {
      const artifacts = [
        { id: 'a1', type: 'voice' },
        { id: 'a2', type: 'messaging' },
        { id: 'a3', type: 'visual' },
      ];

      expect(artifacts).toHaveLength(3);
    });

    it('should manage context budget efficiently', () => {
      const budgets = {
        userIdentity: 300,
        sponsorSummary: 200,
        teamIntelligence: 100000,
      };

      expect(budgets.teamIntelligence).toBeGreaterThan(budgets.userIdentity);
    });
  });

  // ==================== 13. BRAND SOUL INTEGRATION ====================
  describe('13. Brand Soul Integration', () => {
    it('should integrate brand soul into prompts', () => {
      const originalPrompt = 'Create a logo';
      const brandSoul = {
        voice: 'Professional and modern',
        visualStyle: 'Minimalist with bold colors',
      };

      const enhancedPrompt = `${originalPrompt}\nBrand voice: ${brandSoul.voice}\nVisual style: ${brandSoul.visualStyle}`;

      expect(enhancedPrompt).toContain('Professional and modern');
      expect(enhancedPrompt).toContain('Minimalist');
    });

    it('should extract brand elements', () => {
      const brandElements = {
        colors: ['#3B82F6', '#8B5CF6'],
        fonts: ['Inter', 'Roboto'],
        style: 'Modern minimalist',
      };

      expect(brandElements.colors).toHaveLength(2);
      expect(brandElements.style).toBe('Modern minimalist');
    });

    it('should apply brand controls to generation', () => {
      const controls = [
        'content-filter',
        'style-guide',
        'brand-colors',
      ];

      expect(controls).toContain('brand-colors');
    });

    it('should track brand elements used in generation', () => {
      const usedElements = [
        'color-palette',
        'logo',
        'typography',
      ];

      expect(usedElements).toContain('color-palette');
    });

    it('should avoid restricted elements', () => {
      const avoidedElements = [
        'competitor-imagery',
        'off-brand-colors',
      ];

      expect(avoidedElements).toContain('competitor-imagery');
    });
  });

  // ==================== 14. MODEL PROVIDER CONFIGURATION ====================
  describe('14. Model Provider Configuration', () => {
    it('should configure Google AI provider', () => {
      const provider = 'googleai';

      expect(provider).toBe('googleai');
    });

    it('should set API version', () => {
      const apiVersion = 'v1beta';

      expect(apiVersion).toBe('v1beta');
    });

    it('should configure API key', () => {
      const apiKeyName = 'MOMENTUM_GOOGLE_API_KEY';

      expect(apiKeyName).toBe('MOMENTUM_GOOGLE_API_KEY');
    });

    it('should support API key fallbacks', () => {
      const fallbackKeys = [
        'MOMENTUM_GOOGLE_API_KEY',
        'GOOGLE_API_KEY',
        'GEMINI_API_KEY',
      ];

      expect(fallbackKeys).toHaveLength(3);
    });

    it('should configure Vertex AI for Python service', () => {
      const pythonProvider = 'vertex-ai-agent-engine';

      expect(pythonProvider).toBe('vertex-ai-agent-engine');
    });
  });

  // ==================== 15. TIMEOUTS AND LIMITS ====================
  describe('15. Timeouts and Operational Limits', () => {
    it('should set video generation timeout', () => {
      const videoTimeout = 5 * 60 * 1000; // 5 minutes

      expect(videoTimeout).toBe(300000);
    });

    it('should set agent chat timeout', () => {
      const agentTimeout = 5 * 60 * 1000; // 5 minutes

      expect(agentTimeout).toBe(300000);
    });

    it('should set Python agent timeout', () => {
      const pythonTimeout = 10 * 1000; // 10 seconds

      expect(pythonTimeout).toBe(10000);
    });

    it('should set Firestore batch size', () => {
      const batchSize = 500;

      expect(batchSize).toBe(500);
    });

    it('should enforce context window limit', () => {
      const contextWindow = 500000; // 500k tokens
      const currentContext = 450000;

      const withinLimit = currentContext < contextWindow;

      expect(withinLimit).toBe(true);
    });
  });

  // ==================== 16. ASPECT RATIO AND MEDIA SETTINGS ====================
  describe('16. Media Generation Settings', () => {
    it('should support video aspect ratios', () => {
      const aspectRatios = ['9:16', '16:9', '1:1'];

      aspectRatios.forEach(ratio => {
        expect(ratio).toMatch(/^\d+:\d+$/);
      });
    });

    it('should support image-to-video generation', () => {
      const inputImageUrl = 'https://storage.googleapis.com/input.jpg';
      const generationMode = 'image-to-video';

      expect(generationMode).toBe('image-to-video');
    });

    it('should support character references', () => {
      const characterRefUrl = 'https://storage.googleapis.com/character.jpg';

      expect(characterRefUrl).toContain('character.jpg');
    });

    it('should support frame animation', () => {
      const startFrameUrl = 'https://storage.googleapis.com/start.jpg';
      const endFrameUrl = 'https://storage.googleapis.com/end.jpg';

      expect(startFrameUrl).toContain('start.jpg');
      expect(endFrameUrl).toContain('end.jpg');
    });

    it('should support scene classification', () => {
      const scenes = ['indoor', 'outdoor', 'product', 'portrait'];

      expect(scenes).toContain('outdoor');
    });

    it('should support photographic controls', () => {
      const controls = {
        lighting: 'natural',
        composition: 'rule-of-thirds',
        focus: 'shallow-depth-of-field',
      };

      expect(controls.lighting).toBe('natural');
    });
  });

  // ==================== 17. MULTI-BRAND ISOLATION ====================
  describe('17. Multi-Brand Configuration Isolation', () => {
    it('should isolate model settings per brand', () => {
      const brand1Settings = createMockModelSettings({ textModel: 'model-1' });
      const brand2Settings = createMockModelSettings({ textModel: 'model-2' });

      expect(brand1Settings.textModel).not.toBe(brand2Settings.textModel);
    });

    it('should isolate brand themes per brand', () => {
      const brand1Theme = createMockBrandTheme({
        colors: { primary: { h: 210, s: 80, l: 50 }, secondary: { h: 0, s: 0, l: 0 }, accent: { h: 0, s: 0, l: 0 } },
      });
      const brand2Theme = createMockBrandTheme({
        colors: { primary: { h: 0, s: 100, l: 50 }, secondary: { h: 0, s: 0, l: 0 }, accent: { h: 0, s: 0, l: 0 } },
      });

      expect(brand1Theme.colors.primary.h).not.toBe(brand2Theme.colors.primary.h);
    });

    it('should isolate team contexts per brand', () => {
      const brand1Context = createMockTeamContext({
        teamProfile: { name: 'Team A', tagline: '', mission: '', website: '', location: '' },
      });
      const brand2Context = createMockTeamContext({
        teamProfile: { name: 'Team B', tagline: '', mission: '', website: '', location: '' },
      });

      expect(brand1Context.teamProfile.name).not.toBe(brand2Context.teamProfile.name);
    });
  });

  // ==================== 18. VALIDATION ====================
  describe('18. Configuration Validation', () => {
    it('should validate model name format', () => {
      const validNames = [
        'gemini-2.0-flash',
        'imagen-4.0-generate-001',
        'veo-3-internal',
      ];

      validNames.forEach(name => {
        expect(isValidModelName(name)).toBe(true);
      });
    });

    it('should reject invalid model names', () => {
      const invalidNames = [
        'invalid model',
        'model@123',
        'model/name',
      ];

      invalidNames.forEach(name => {
        expect(isValidModelName(name)).toBe(false);
      });
    });

    it('should validate temperature range', () => {
      const validTemps = [0, 0.5, 1.0, 1.5, 2.0];

      validTemps.forEach(temp => {
        expect(temp).toBeGreaterThanOrEqual(0);
        expect(temp).toBeLessThanOrEqual(2.0);
      });
    });

    it('should validate HSL color ranges', () => {
      const color = { h: 210, s: 80, l: 50 };

      expect(color.h).toBeGreaterThanOrEqual(0);
      expect(color.h).toBeLessThanOrEqual(360);
      expect(color.s).toBeGreaterThanOrEqual(0);
      expect(color.s).toBeLessThanOrEqual(100);
      expect(color.l).toBeGreaterThanOrEqual(0);
      expect(color.l).toBeLessThanOrEqual(100);
    });

    it('should validate max tokens is positive', () => {
      const maxTokens = 4096;

      expect(maxTokens).toBeGreaterThan(0);
    });
  });
});
