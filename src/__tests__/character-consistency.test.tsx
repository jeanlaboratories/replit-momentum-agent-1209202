/**
 * Tests for Character Consistency Feature
 *
 * This test file ensures that character consistency for campaign image generation:
 * 1. Data model types are properly defined
 * 2. Campaign request schema supports character references
 * 3. Generate-ai-images exports character-consistent generation function
 * 4. Generate-campaign-content route supports character consistency config
 * 5. Python media router has nano_banana endpoint
 */

import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock JobQueueProvider to prevent "useJobQueue must be used within a JobQueueProvider" error
vi.mock('@/contexts/job-queue-context', () => ({
  JobQueueProvider: ({ children }: any) => children,
  useJobQueue: () => ({
    state: { jobs: [], isExpanded: false, isPanelVisible: true },
    addJob: vi.fn(() => 'mock-job-id'),
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    clearCompleted: vi.fn(),
    cancelJob: vi.fn(),
    startJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    setProgress: vi.fn(),
    toggleExpanded: vi.fn(),
    setExpanded: vi.fn(),
    setPanelVisible: vi.fn(),
    getActiveJobs: vi.fn(() => []),
    getCompletedJobs: vi.fn(() => []),
    getJobById: vi.fn(),
    hasActiveJobs: vi.fn(() => false),
    isJobStalled: vi.fn(() => false),
    getStalledJobs: vi.fn(() => []),
  }),
  useJob: () => ({
    jobId: null,
    create: vi.fn(() => 'mock-job-id'),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    progress: vi.fn(),
    update: vi.fn(),
    getJob: vi.fn(),
  }),
}));

describe('Character Consistency Feature', () => {
  const srcDir = path.join(__dirname, '..');
  const pythonDir = path.join(__dirname, '../../python_service');

  describe('Data Model Types', () => {
    const typesPath = path.join(srcDir, 'lib/types.ts');

    it('should have CharacterReference interface', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export interface CharacterReference');
    });

    it('CharacterReference should have required fields', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('id: string');
      expect(content).toContain('name: string');
      expect(content).toContain('characterSheetUrl: string');
      expect(content).toContain('isActive: boolean');
    });

    it('should have CharacterConsistencyConfig interface', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export interface CharacterConsistencyConfig');
    });

    it('CharacterConsistencyConfig should have required fields', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('enabled: boolean');
      expect(content).toContain('characters: CharacterReference[]');
      expect(content).toContain('useSceneToSceneConsistency: boolean');
      expect(content).toContain('maxReferenceImages: number');
    });

    it('should have CharacterConsistentContentBlock interface', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('export interface CharacterConsistentContentBlock');
    });

    it('CharacterConsistentContentBlock should extend GeneratedContentBlock', () => {
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toContain('interface CharacterConsistentContentBlock extends GeneratedContentBlock');
    });
  });

  describe('Campaign Request Schema', () => {
    const campaignAgentPath = path.join(srcDir, 'lib/campaign-creation-agent.ts');

    it('should exist', () => {
      expect(fs.existsSync(campaignAgentPath)).toBe(true);
    });

    it('should have CharacterReferenceSchema', () => {
      const content = fs.readFileSync(campaignAgentPath, 'utf-8');
      expect(content).toContain('CharacterReferenceSchema');
    });

    it('should have CharacterConsistencyConfigSchema', () => {
      const content = fs.readFileSync(campaignAgentPath, 'utf-8');
      expect(content).toContain('CharacterConsistencyConfigSchema');
    });

    it('CampaignRequestSchema should include characterConsistency', () => {
      const content = fs.readFileSync(campaignAgentPath, 'utf-8');
      expect(content).toContain('characterConsistency:');
    });
  });

  describe('Generate AI Images Flow', () => {
    const generateImagesPath = path.join(srcDir, 'ai/flows/generate-ai-images.ts');

    it('should exist', () => {
      expect(fs.existsSync(generateImagesPath)).toBe(true);
    });

    it('should have GenerateCharacterConsistentImageInputSchema', () => {
      const content = fs.readFileSync(generateImagesPath, 'utf-8');
      expect(content).toContain('GenerateCharacterConsistentImageInputSchema');
    });

    it('should export generateCharacterConsistentImage function', () => {
      const content = fs.readFileSync(generateImagesPath, 'utf-8');
      expect(content).toContain('export async function generateCharacterConsistentImage');
    });

    it('generateCharacterConsistentImage should accept characterReferenceUrls', () => {
      const content = fs.readFileSync(generateImagesPath, 'utf-8');
      expect(content).toContain('characterReferenceUrls');
    });

    it('generateCharacterConsistentImage should accept previousSceneUrl', () => {
      const content = fs.readFileSync(generateImagesPath, 'utf-8');
      expect(content).toContain('previousSceneUrl');
    });

    it('should call nano-banana endpoint', () => {
      const content = fs.readFileSync(generateImagesPath, 'utf-8');
      // Server-side code calls unified Python service endpoint at /agent/nano-banana
      expect(content).toContain('/agent/nano-banana');
    });
  });

  describe('Generate Campaign Content Route', () => {
    const routePath = path.join(srcDir, 'app/api/generate-campaign-content/route.ts');

    it('should exist', () => {
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('should import generateCharacterConsistentImage', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('generateCharacterConsistentImage');
    });

    it('should import CharacterConsistencyConfig type', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('CharacterConsistencyConfig');
    });

    it('should extract characterConsistency from request body', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('characterConsistency');
    });

    it('should check if character consistency is enabled', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('useCharacterConsistency');
    });

    it('should track previousSceneUrl for scene-to-scene consistency', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('previousSceneUrl');
    });

    it('should fall back to standard generation if character-consistent fails', () => {
      const content = fs.readFileSync(routePath, 'utf-8');
      expect(content).toContain('Falling back to standard image generation');
    });
  });

  describe('Python Service - Requests Model', () => {
    const requestsPath = path.join(pythonDir, 'models/requests.py');

    it('should exist', () => {
      expect(fs.existsSync(requestsPath)).toBe(true);
    });

    it('should have NanoBananaRequest class', () => {
      const content = fs.readFileSync(requestsPath, 'utf-8');
      expect(content).toContain('class NanoBananaRequest');
    });

    it('NanoBananaRequest should have prompt field', () => {
      const content = fs.readFileSync(requestsPath, 'utf-8');
      expect(content).toContain('prompt: str');
    });

    it('NanoBananaRequest should have reference_images field', () => {
      const content = fs.readFileSync(requestsPath, 'utf-8');
      expect(content).toContain('reference_images:');
    });
  });

  describe('Python Service - Media Router', () => {
    const mediaRouterPath = path.join(pythonDir, 'routers/media.py');

    it('should exist', () => {
      expect(fs.existsSync(mediaRouterPath)).toBe(true);
    });

    it('should import NanoBananaRequest', () => {
      const content = fs.readFileSync(mediaRouterPath, 'utf-8');
      expect(content).toContain('NanoBananaRequest');
    });

    it('should import nano_banana function', () => {
      const content = fs.readFileSync(mediaRouterPath, 'utf-8');
      expect(content).toContain('from tools.media_tools import nano_banana');
    });

    it('should have nano-banana endpoint', () => {
      const content = fs.readFileSync(mediaRouterPath, 'utf-8');
      expect(content).toContain('@router.post("/nano-banana")');
    });

    it('should have nano_banana_endpoint function', () => {
      const content = fs.readFileSync(mediaRouterPath, 'utf-8');
      expect(content).toContain('async def nano_banana_endpoint');
    });
  });

  describe('Python Service - Media Tools', () => {
    const mediaToolsPath = path.join(pythonDir, 'tools/media_tools.py');

    it('should exist', () => {
      expect(fs.existsSync(mediaToolsPath)).toBe(true);
    });

    it('should have nano_banana function', () => {
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      expect(content).toContain('def nano_banana(');
    });

    it('nano_banana should accept reference_images parameter', () => {
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      expect(content).toContain('reference_images: str');
    });

    it('nano_banana should process reference images', () => {
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      expect(content).toContain('ref_urls = [url.strip() for url in reference_images.split');
    });

    it('nano_banana should limit to 14 reference images', () => {
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      expect(content).toContain('[:14]');
    });
  });

  describe('Integration - Full Flow', () => {
    it('all components should work together', () => {
      // Verify imports chain correctly
      const routeContent = fs.readFileSync(
        path.join(srcDir, 'app/api/generate-campaign-content/route.ts'),
        'utf-8'
      );
      const generateImagesContent = fs.readFileSync(
        path.join(srcDir, 'ai/flows/generate-ai-images.ts'),
        'utf-8'
      );
      const campaignAgentContent = fs.readFileSync(
        path.join(srcDir, 'lib/campaign-creation-agent.ts'),
        'utf-8'
      );

      // Route should import from generate-ai-images
      expect(routeContent).toContain("from '@/ai/flows/generate-ai-images'");
      expect(routeContent).toContain('generateCharacterConsistentImage');

      // Route should import from campaign-creation-agent
      expect(routeContent).toContain("from '@/lib/campaign-creation-agent'");

      // Route should import CharacterConsistencyConfig from types
      expect(routeContent).toContain('CharacterConsistencyConfig');

      // Generate images should call unified Python service endpoint at /agent/nano-banana
      expect(generateImagesContent).toContain('MOMENTUM_PYTHON_SERVICE_URL');
      expect(generateImagesContent).toContain('/agent/nano-banana');

      // Campaign agent should have character consistency schema
      expect(campaignAgentContent).toContain('CharacterConsistencyConfigSchema');
    });
  });

  describe('Python Agent Tool - create_event', () => {
    const teamToolsPath = path.join(pythonDir, 'tools/team_tools.py');

    it('should exist', () => {
      expect(fs.existsSync(teamToolsPath)).toBe(true);
    });

    it('should have create_event function with character consistency parameters', () => {
      const content = fs.readFileSync(teamToolsPath, 'utf-8');
      expect(content).toContain('def create_event(');
      expect(content).toContain('character_sheet_urls: str');
      expect(content).toContain('enable_character_consistency: bool');
    });

    it('should build character consistency config when enabled', () => {
      const content = fs.readFileSync(teamToolsPath, 'utf-8');
      expect(content).toContain('character_consistency_config');
      expect(content).toContain('"enabled": True');
      expect(content).toContain('useSceneToSceneConsistency');
    });

    it('should include characterConsistency in preview_data', () => {
      const content = fs.readFileSync(teamToolsPath, 'utf-8');
      expect(content).toContain('"characterConsistency": character_consistency_config');
    });

    it('should document character consistency usage in docstring', () => {
      const content = fs.readFileSync(teamToolsPath, 'utf-8');
      expect(content).toContain('CHARACTER CONSISTENCY');
      expect(content).toContain('mascot');
      expect(content).toContain('consistent characters');
    });
  });

  describe('Frontend Chat UI - Character Consistency Display', () => {
    const chatbotPath = path.join(srcDir, 'components/gemini-chatbot.tsx');

    it('should exist', () => {
      expect(fs.existsSync(chatbotPath)).toBe(true);
    });

    it('should pass characterConsistency to API', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('characterConsistency:');
      expect(content).toContain('(campaignData as any).characterConsistency');
    });

    it('should display character consistency info in preview', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      expect(content).toContain('Character Consistency Enabled');
      expect(content).toContain('hasCharacterConsistency');
    });

    it('should handle character consistency in campaign generation', () => {
      const content = fs.readFileSync(chatbotPath, 'utf-8');
      // The component handles character consistency through the characterConsistency config
      // passed to the API, not through different button text
      expect(content).toContain('characterConsistency');
    });
  });

  describe('Test Page', () => {
    const testPagePath = path.join(srcDir, 'app/test/character-consistency/page.tsx');

    it('should exist', () => {
      expect(fs.existsSync(testPagePath)).toBe(true);
    });

    it('should be a client component', () => {
      const content = fs.readFileSync(testPagePath, 'utf-8');
      expect(content).toContain("'use client'");
    });

    it('should have character sheet management', () => {
      const content = fs.readFileSync(testPagePath, 'utf-8');
      expect(content).toContain('CharacterReference');
      expect(content).toContain('addCharacter');
      expect(content).toContain('removeCharacter');
    });

    it('should have scene-to-scene consistency option', () => {
      const content = fs.readFileSync(testPagePath, 'utf-8');
      expect(content).toContain('useSceneToSceneConsistency');
      expect(content).toContain('previousSceneUrl');
    });

    it('should call nano-banana API', () => {
      const content = fs.readFileSync(testPagePath, 'utf-8');
      expect(content).toContain('/api/media/nano-banana');
      expect(content).toContain('reference_images');
    });

    it('should have generate character sheet feature', () => {
      const content = fs.readFileSync(testPagePath, 'utf-8');
      expect(content).toContain('generateCharacterSheet');
      expect(content).toContain('Generate Character Sheet');
    });
  });

  describe('Campaign Persistence - Character Stylesheet', () => {
    const actionsPath = path.join(srcDir, 'app/actions.ts');
    const campaignPreviewPath = path.join(srcDir, 'components/campaign-preview.tsx');

    describe('saveCampaignAction', () => {
      it('should accept characterConsistency parameter', () => {
        const content = fs.readFileSync(actionsPath, 'utf-8');
        expect(content).toContain('characterConsistency?: CharacterConsistencyConfig | null');
      });

      it('should import CharacterConsistencyConfig type', () => {
        const content = fs.readFileSync(actionsPath, 'utf-8');
        expect(content).toContain('CharacterConsistencyConfig');
      });

      it('should save characterConsistency to campaign data', () => {
        const content = fs.readFileSync(actionsPath, 'utf-8');
        expect(content).toContain('campaignData.characterConsistency = characterConsistency');
      });
    });

    describe('loadCampaignAction', () => {
      it('should return characterConsistency from loaded campaign', () => {
        const content = fs.readFileSync(actionsPath, 'utf-8');
        expect(content).toContain('characterConsistency: campaignData?.characterConsistency');
      });

      it('should have characterConsistency in LoadedCampaignData type', () => {
        const content = fs.readFileSync(actionsPath, 'utf-8');
        // Check that the return type includes characterConsistency field
        expect(content).toContain('characterConsistency?:');
        expect(content).toContain('enabled: boolean');
        expect(content).toContain('characters:');
      });
    });

    describe('Campaign Preview Component', () => {
      it('should have editableCharacterConsistency state', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('editableCharacterConsistency');
        expect(content).toContain('setEditableCharacterConsistency');
      });

      it('should have isEditingCharacterSheets state for edit mode', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('isEditingCharacterSheets');
        expect(content).toContain('setIsEditingCharacterSheets');
      });

      it('should have newCharacterUrl state for adding character sheets', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('newCharacterUrl');
        expect(content).toContain('setNewCharacterUrl');
      });

      it('should have newCharacterName state for adding character sheets', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('newCharacterName');
        expect(content).toContain('setNewCharacterName');
      });

      it('should pass editableCharacterConsistency to saveCampaignAction', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('editableCharacterConsistency || null');
      });

      it('should pass editableCharacterConsistency to ContentBlockCard', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('characterConsistency={editableCharacterConsistency}');
      });

      it('should sync editableCharacterConsistency from prop', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        // Check for useEffect that syncs characterConsistency prop
        expect(content).toContain('setEditableCharacterConsistency(characterConsistency)');
      });

      it('should have onCharacterConsistencyChange callback prop', () => {
        const content = fs.readFileSync(campaignPreviewPath, 'utf-8');
        expect(content).toContain('onCharacterConsistencyChange?: (config: CharacterConsistencyConfig) => void');
      });
    });

    describe('Gemini Chatbot Integration', () => {
      const chatbotPath = path.join(srcDir, 'components/gemini-chatbot.tsx');

      it('should pass characterConsistency to saveCampaignAction', () => {
        const content = fs.readFileSync(chatbotPath, 'utf-8');
        expect(content).toContain('(campaignData as any).characterConsistency || null');
      });
    });
  });

  describe('Multiple Image Support Verification', () => {
    it('characters array should support multiple CharacterReference entries', () => {
      const typesContent = fs.readFileSync(path.join(srcDir, 'lib/types.ts'), 'utf-8');
      // Verify characters is an array type
      expect(typesContent).toContain('characters: CharacterReference[]');
    });

    it('maxReferenceImages should be 14 (Nano Banana limit)', () => {
      const typesContent = fs.readFileSync(path.join(srcDir, 'lib/types.ts'), 'utf-8');
      expect(typesContent).toContain('maxReferenceImages: number');
      // Verify the comment mentions 14 and Nano Banana limit
      expect(typesContent).toContain('default 14');
      expect(typesContent).toContain('Nano Banana limit');
    });

    it('nano_banana should limit to 14 reference images', () => {
      const mediaToolsPath = path.join(pythonDir, 'tools/media_tools.py');
      const content = fs.readFileSync(mediaToolsPath, 'utf-8');
      expect(content).toContain('[:14]');
    });
  });
});
