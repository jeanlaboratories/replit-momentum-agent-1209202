import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAiImage } from './generate-ai-images';
import { ai } from '@/ai/index';
import { getBrandSoulContext } from '@/lib/brand-soul/context';
import { classifySceneType, recommendPhotographicControls } from '@/lib/scene-classifier';
import { explainBrandSoulInfluence } from '@/lib/brand-soul/explainability';

// Mock dependencies
vi.mock('@/ai/index', () => ({
  ai: {
    generate: vi.fn(),
    defineFlow: (config: any, fn: any) => fn, // Mock defineFlow to just return the function
  },
}));

vi.mock('@/lib/brand-soul/context', () => ({
  getBrandSoulContext: vi.fn(),
}));

vi.mock('@/lib/scene-classifier', () => ({
  classifySceneType: vi.fn(),
  recommendPhotographicControls: vi.fn(),
}));

vi.mock('@/lib/brand-soul/explainability', () => ({
  explainBrandSoulInfluence: vi.fn(),
  logBrandSoulInfluence: vi.fn(),
}));

describe('generateAiImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (classifySceneType as any).mockReturnValue({
      sceneType: 'product',
      sceneSubtype: 'studio',
    });
    
    (recommendPhotographicControls as any).mockReturnValue({
      lighting: ['Soft lighting'],
      composition: ['Centered'],
      lens: ['50mm'],
      framing: ['Medium shot'],
    });
    
    (getBrandSoulContext as any).mockResolvedValue({
      exists: false,
    });
  });

  it('should generate an image with enhanced prompt', async () => {
    // Setup mocks
    (ai.generate as any).mockResolvedValue({
      media: { url: 'generated-image-url' },
    });

    // Call function
    const result = await generateAiImage({
      prompt: 'A cool car',
    });

    // Verify result
    expect(result.imageUrl).toBe('generated-image-url');

    // Verify AI call
    const callArgs = (ai.generate as any).mock.calls[0][0];
    expect(callArgs.model).toBe('googleai/imagen-4.0-generate-001'); // Uses default
    expect(callArgs.prompt).toContain('A cool car');
    expect(callArgs.prompt).toContain('PHOTOGRAPHIC SPECIFICATIONS');
    expect(callArgs.prompt).toContain('Soft lighting');
  });

  it('should use custom model when provided', async () => {
    // Setup mocks
    (ai.generate as any).mockResolvedValue({
      media: { url: 'generated-image-url' },
    });

    // Call function with custom model
    const result = await generateAiImage({
      prompt: 'A cool car',
      model: 'imagen-3.0-generate-001',
    });

    // Verify result
    expect(result.imageUrl).toBe('generated-image-url');

    // Verify AI call uses custom model
    const callArgs = (ai.generate as any).mock.calls[0][0];
    expect(callArgs.model).toBe('googleai/imagen-3.0-generate-001');
  });

  it('should inject Brand Soul guidelines when brandId is provided', async () => {
    // Setup mocks
    (ai.generate as any).mockResolvedValue({
      media: { url: 'generated-image-url' },
    });
    
    (getBrandSoulContext as any).mockResolvedValue({
        exists: true,
        visualGuidelines: 'Use neon colors only.',
        brandColors: ['#FF00FF', '#00FFFF'],
    });
    
    (explainBrandSoulInfluence as any).mockReturnValue({
        summary: 'Brand Soul applied',
        confidence: 0.9,
        visualPreview: {
            appliedControls: ['Neon colors'],
            brandElements: ['Logo'],
            avoidedElements: ['Blurry'],
        }
    });

    // Call function
    const result = await generateAiImage({
      prompt: 'A cool car',
      brandId: 'test-brand',
    });

    // Verify AI call
    const callArgs = (ai.generate as any).mock.calls[0][0];
    expect(callArgs.prompt).toContain('BRAND VISUAL GUIDELINES');
    expect(callArgs.prompt).toContain('Use neon colors only');
    expect(callArgs.prompt).toContain('Brand Colors: #FF00FF, #00FFFF');

    // Verify explainability
    expect(result.explainability).toBeDefined();
    expect(result.explainability?.summary).toBe('Brand Soul applied');
  });
});
