/**
 * Brand Soul Seed Data for Phase 1 Testing
 * 
 * Creates realistic Brand Soul data with:
 * - Photographic preferences (lighting, mood, composition)
 * - Scene preferences
 * - Negative prompts from multiple sources
 * - Brand colors and style tags
 * 
 * This seed data can be used to test:
 * 1. Scene classification
 * 2. Photographic control extraction
 * 3. Explainability generation
 * 4. Negative prompt aggregation
 */

import type { BrandSoul } from '../src/lib/types/brand-soul';

// Mock data - using 'any' for flexibility in testing
export const mockBrandSoulPhase1: any = {
  brandId: 'test-brand-001',
  status: 'published',
  
  // Voice Profile with tone avoidance
  voiceProfile: {
    tone: {
      primary: 'professional',
      secondary: ['approachable', 'confident'],
      avoid: ['aggressive', 'casual', 'unprofessional']
    },
    personality: {
      traits: [
        { name: 'innovative', strength: 8 },
        { name: 'trustworthy', strength: 9 },
        { name: 'sophisticated', strength: 7 }
      ]
    },
    writingStyle: {
      preferredPhrases: [
        'elevate your experience',
        'designed for excellence',
        'crafted with care'
      ]
    },
    formality: 7
  },
  
  // Visual Identity with Phase 1 enhancements
  visualIdentity: {
    colors: {
      primary: ['#2C3E50', '#34495E'],
      secondary: ['#ECF0F1', '#BDC3C7'],
      accent: ['#E74C3C', '#C0392B']
    },
    imageStyle: {
      style: 'minimal',
      avoid: ['cluttered', 'busy', 'chaotic', 'dark'],
      
      // Phase 1: Photographic Preferences
      photographicPreferences: {
        lighting: {
          preferred: ['natural', 'soft', 'golden-hour'],
          avoid: ['harsh', 'fluorescent', 'flat']
        },
        mood: {
          preferred: ['professional', 'calm', 'serene', 'uplifting'],
          avoid: ['aggressive', 'gloomy', 'chaotic']
        },
        composition: {
          preferred: ['rule-of-thirds', 'minimalist', 'centered'],
          avoid: ['cluttered', 'busy', 'off-center']
        }
      },
      
      // Phase 1: Scene Preferences
      scenePreferences: {
        commonScenes: [
          {
            sceneType: 'product',
            sceneSubtype: 'hero',
            frequency: 45,
            examples: ['Product bottle on clean background', 'Centered product showcase']
          },
          {
            sceneType: 'human',
            sceneSubtype: 'lifestyle',
            frequency: 30,
            examples: ['Person using product in natural setting', 'Lifestyle product integration']
          },
          {
            sceneType: 'product',
            sceneSubtype: 'macro',
            frequency: 15,
            examples: ['Close-up product texture', 'Detail shot of product features']
          },
          {
            sceneType: 'ingredient',
            sceneSubtype: 'flatlay',
            frequency: 10,
            examples: ['Ingredient arrangement top-down', 'Flatlay natural ingredients']
          }
        ],
        preferredSettings: [
          'studio',
          'natural outdoor',
          'minimal indoor',
          'clean background'
        ]
      }
    },
    typography: {
      fonts: ['Inter', 'Roboto', 'Montserrat']
    }
  },
  
  // Messaging Framework
  messagingFramework: {
    taglines: [
      'Excellence in Every Detail',
      'Crafted for You',
      'Where Quality Meets Innovation'
    ],
    keyMessages: [
      {
        theme: 'Quality',
        messages: [
          'Premium ingredients sourced responsibly',
          'Rigorous testing ensures safety',
          'Certified by industry leaders'
        ]
      },
      {
        theme: 'Innovation',
        messages: [
          'Cutting-edge formulations',
          'Science-backed results',
          'Pioneering new standards'
        ]
      }
    ],
    mission: 'To deliver exceptional products that enhance everyday life through innovation and quality.',
    vision: 'Becoming the trusted choice for discerning consumers worldwide.'
  },
  
  // Fact Library
  factLibrary: {
    'Product Features': [
      {
        fact: 'All products are dermatologist-tested',
        confidence: 95,
        source: 'Product documentation'
      },
      {
        fact: 'Made with 100% natural ingredients',
        confidence: 90,
        source: 'Website about page'
      }
    ],
    'Brand History': [
      {
        fact: 'Founded in 2015 by skincare experts',
        confidence: 98,
        source: 'About Us page'
      },
      {
        fact: 'Winner of 5 industry awards',
        confidence: 92,
        source: 'Press releases'
      }
    ]
  }
};

/**
 * Additional test scenarios
 */
export const testScenarios = [
  {
    name: 'Human Solo Portrait',
    prompt: 'Professional headshot of a confident business executive',
    expectedScene: { type: 'human', subtype: 'solo' },
    expectedControls: ['natural lighting', 'shallow depth of field', '85mm lens']
  },
  {
    name: 'Product Hero Shot',
    prompt: 'Premium skincare bottle centered on marble background',
    expectedScene: { type: 'product', subtype: 'hero' },
    expectedControls: ['studio lighting', 'centered composition', 'medium framing']
  },
  {
    name: 'Ingredient Flatlay',
    prompt: 'Top-down arrangement of botanical ingredients on white surface',
    expectedScene: { type: 'ingredient', subtype: 'flatlay' },
    expectedControls: ['natural lighting', 'top-down framing', 'deep depth of field']
  },
  {
    name: 'Human Group',
    prompt: 'Team of colleagues collaborating in modern office',
    expectedScene: { type: 'human', subtype: 'group' },
    expectedControls: ['natural lighting', 'wide framing', '35mm lens']
  },
  {
    name: 'Product Macro',
    prompt: 'Extreme close-up of product texture showing fine details',
    expectedScene: { type: 'product', subtype: 'macro' },
    expectedControls: ['soft lighting', 'macro lens', 'shallow depth of field']
  }
];

/**
 * Expected negative prompt aggregation
 */
export const expectedNegativePrompts = [
  // From voice profile tone avoidance
  'aggressive',
  'casual',
  'unprofessional',
  
  // From visual identity image style avoidance
  'cluttered',
  'busy',
  'chaotic',
  'dark',
  
  // From photographic preferences
  'harsh',
  'fluorescent',
  'flat',
  'gloomy',
  'off-center'
];

console.log('✅ Brand Soul Phase 1 seed data loaded');
console.log(`   - ${Object.keys(mockBrandSoulPhase1.voiceProfile?.tone?.avoid || []).length} tone avoidance elements`);
console.log(`   - ${mockBrandSoulPhase1.visualIdentity?.imageStyle?.photographicPreferences?.lighting?.preferred?.length} lighting preferences`);
console.log(`   - ${mockBrandSoulPhase1.visualIdentity?.imageStyle?.scenePreferences?.commonScenes?.length} common scene types`);
console.log(`   - ${expectedNegativePrompts.length} total negative prompt elements`);
