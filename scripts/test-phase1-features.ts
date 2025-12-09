/**
 * Manual Phase 1 Feature Verification Script
 *
 * Tests:
 * 1. Scene Classification
 * 2. Photographic Controls
 * 3. Explainability Generation
 * 4. Edge Cases
 *
 * Run with: npx tsx scripts/test-phase1-features.ts
 */

import { classifySceneType, recommendPhotographicControls } from '../src/lib/scene-classifier';
import { explainBrandSoulInfluence, logBrandSoulInfluence } from '../src/lib/brand-soul/explainability';
import type { BrandSoulContext } from '../src/lib/brand-soul/context';
import type { EnhancedImagePrompt } from '../src/lib/types';

// Test counter
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    testsFailed++;
    console.log(`❌ FAIL: ${message}`);
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockBrandSoulContext: BrandSoulContext = {
  exists: true,
  brandColors: ['#F8E5E5', '#D4A5A5', '#8B7355'],
  brandStyleTags: ['minimal', 'modern', 'elegant'],
  voiceGuidelines: 'Tone: calm, professional, approachable',
  visualGuidelines: 'Image Style: minimal, modern',
  photographicPreferences: {
    lighting: {
      preferred: ['natural', 'soft', 'golden-hour'],
      avoid: ['harsh', 'fluorescent']
    },
    mood: {
      preferred: ['calm', 'professional', 'serene'],
      avoid: ['aggressive', 'chaotic']
    },
    composition: {
      preferred: ['minimalist', 'rule-of-thirds', 'centered'],
      avoid: ['cluttered', 'busy']
    }
  }
};

// ============================================================================
// TESTS
// ============================================================================

section('Phase 1: Scene Classification Tests');

// Test 1: Human Solo
const humanSolo = classifySceneType(
  'A professional woman smiling at the camera in a modern office',
  { adCopy: 'Professional headshots for modern businesses' }
);
assert(humanSolo.sceneType === 'human', 'Should classify as human scene');
assert(humanSolo.sceneSubtype === 'solo', 'Should classify as solo subtype');
assert(humanSolo.confidence > 0.6, 'Confidence should be > 0.6');
console.log(`  Scene: ${humanSolo.sceneType}/${humanSolo.sceneSubtype} (${Math.round(humanSolo.confidence * 100)}%)`);

// Test 2: Human Group
const humanGroup = classifySceneType('Team of people collaborating in a bright meeting room');
assert(humanGroup.sceneType === 'human', 'Should classify as human scene');
assert(humanGroup.sceneSubtype === 'group', 'Should classify as group subtype');
console.log(`  Scene: ${humanGroup.sceneType}/${humanGroup.sceneSubtype} (${Math.round(humanGroup.confidence * 100)}%)`);

// Test 3: Product Hero
const productHero = classifySceneType('Product bottle centered on white background with studio lighting');
assert(productHero.sceneType === 'product', 'Should classify as product scene');
assert(productHero.sceneSubtype === 'hero', 'Should classify as hero subtype');
console.log(`  Scene: ${productHero.sceneType}/${productHero.sceneSubtype} (${Math.round(productHero.confidence * 100)}%)`);

// Test 4: Product Macro
const productMacro = classifySceneType('Extreme close-up macro shot of product texture and detail');
assert(productMacro.sceneType === 'product', 'Should classify as product scene');
assert(productMacro.sceneSubtype === 'macro', 'Should classify as macro subtype');
console.log(`  Scene: ${productMacro.sceneType}/${productMacro.sceneSubtype} (${Math.round(productMacro.confidence * 100)}%)`);

// Test 5: Ingredient Flatlay
const ingredientFlatlay = classifySceneType('Top-down flatlay arrangement of natural ingredients on marble surface');
assert(ingredientFlatlay.sceneType === 'ingredient', 'Should classify as ingredient scene');
assert(ingredientFlatlay.sceneSubtype === 'flatlay', 'Should classify as flatlay subtype');
console.log(`  Scene: ${ingredientFlatlay.sceneType}/${ingredientFlatlay.sceneSubtype} (${Math.round(ingredientFlatlay.confidence * 100)}%)`);

// Test 6: Ambiguous Prompt
const ambiguous = classifySceneType('Beautiful image');
assert(ambiguous.sceneType !== undefined, 'Should handle ambiguous prompts');
assert(ambiguous.confidence < 0.7, 'Ambiguous prompts should have lower confidence');
console.log(`  Scene: ${ambiguous.sceneType}/${ambiguous.sceneSubtype} (${Math.round(ambiguous.confidence * 100)}%)`);

section('Phase 1: Photographic Controls Tests');

// Test 7: Human Solo Controls
const humanSoloControls = recommendPhotographicControls(humanSolo);
assert(humanSoloControls.lighting !== undefined, 'Should recommend lighting');
assert(humanSoloControls.lens !== undefined, 'Should recommend lens');
assert(humanSoloControls.framing !== undefined, 'Should recommend framing');
console.log(`  Lighting: ${humanSoloControls.lighting?.join(', ')}`);
console.log(`  Lens: ${humanSoloControls.lens?.join(', ')}`);
console.log(`  Framing: ${humanSoloControls.framing?.join(', ')}`);

// Test 8: Product Hero Controls
const productHeroControls = recommendPhotographicControls(productHero);
assert(productHeroControls.composition !== undefined, 'Should recommend composition');
console.log(`  Composition: ${productHeroControls.composition?.join(', ')}`);

section('Phase 1: Explainability Generation Tests');

// Test 9: Complete Explainability
const enhancedPrompt: EnhancedImagePrompt = {
  basePrompt: 'Woman using skincare product in bathroom',
  sceneType: 'human',
  sceneSubtype: 'lifestyle',
  lighting: 'natural',
  mood: 'calm',
  composition: 'minimalist',
  brandColors: mockBrandSoulContext.brandColors,
  brandStyleTags: mockBrandSoulContext.brandStyleTags,
};

const classification = {
  sceneType: 'human' as const,
  sceneSubtype: 'lifestyle' as const,
  confidence: 0.87,
  reasoning: 'Detected lifestyle scene'
};

const report = explainBrandSoulInfluence(mockBrandSoulContext, classification, enhancedPrompt);

assert(report.summary !== undefined, 'Should generate summary');
assert(report.confidence > 0, 'Confidence should be > 0');
assert(report.confidence <= 1, 'Confidence should be <= 1');
assert(report.visualPreview.appliedControls.length > 0, 'Should have applied controls');
assert(report.visualPreview.brandElements.length > 0, 'Should have brand elements');
assert(report.visualPreview.avoidedElements.length > 0, 'Should have avoided elements');

console.log(`\n  Generated Explainability Report:`);
logBrandSoulInfluence(report);

// Test 10: Minimal Brand Context
const minimalContext: BrandSoulContext = { exists: true };
const minimalPrompt: EnhancedImagePrompt = {
  basePrompt: 'Product shot',
  sceneType: 'product',
  sceneSubtype: 'hero',
};

let minimalTestPassed = true;
try {
  const minimalReport = explainBrandSoulInfluence(
    minimalContext,
    { sceneType: 'product', sceneSubtype: 'hero', confidence: 0.8, reasoning: 'Test' },
    minimalPrompt
  );
  assert(minimalReport.summary !== undefined, 'Should handle minimal context gracefully');
} catch (e) {
  minimalTestPassed = false;
}
assert(minimalTestPassed, 'Should not throw with minimal context');

section('Phase 1: Edge Cases & Error Handling');

// Test 12: Empty Prompt
let emptyPromptTest = true;
try {
  const emptyClassification = classifySceneType('');
  assert(emptyClassification.sceneType !== undefined, 'Should handle empty prompt');
} catch (e) {
  emptyPromptTest = false;
}
assert(emptyPromptTest, 'Should not throw with empty prompt');

// Test 13: Long Prompt
const longPrompt = 'A beautiful professional photograph ' + 'with stunning details '.repeat(50);
let longPromptTest = true;
try {
  const longClassification = classifySceneType(longPrompt);
  assert(longClassification.sceneType !== undefined, 'Should handle long prompts');
} catch (e) {
  longPromptTest = false;
}
assert(longPromptTest, 'Should not throw with long prompts');

// Test 14: Special Characters
let specialCharsTest = true;
try {
  const specialClassification = classifySceneType(
    'Product shot with €100 price tag & special #hashtag @mention'
  );
  assert(specialClassification.sceneType === 'product', 'Should handle special characters');
} catch (e) {
  specialCharsTest = false;
}
assert(specialCharsTest, 'Should handle special characters in prompts');

// Test 14: Undefined Brand Values
const partialContext: BrandSoulContext = {
  exists: true,
  brandColors: undefined,
  brandStyleTags: [],
};

let undefinedTest = true;
try {
  explainBrandSoulInfluence(
    partialContext,
    { sceneType: 'product', sceneSubtype: 'hero', confidence: 0.8, reasoning: 'Test' },
    { basePrompt: 'Product', sceneType: 'product', sceneSubtype: 'hero' }
  );
} catch (e) {
  undefinedTest = false;
}
assert(undefinedTest, 'Should handle undefined brand values');

section('Phase 1: Confidence Scoring Tests');

// Test 16: Confidence with Full Context
const fullReport = explainBrandSoulInfluence(mockBrandSoulContext, classification, enhancedPrompt);
const minimalReport2 = explainBrandSoulInfluence(minimalContext, classification, minimalPrompt);
assert(
  fullReport.confidence > minimalReport2.confidence,
  'Full context should have higher confidence than minimal'
);
console.log(`  Full Context Confidence: ${Math.round(fullReport.confidence * 100)}%`);
console.log(`  Minimal Context Confidence: ${Math.round(minimalReport2.confidence * 100)}%`);

// Test 17: Confidence Capping
assert(fullReport.confidence <= 1.0, 'Confidence should be capped at 1.0');

// ============================================================================
// SUMMARY
// ============================================================================

section('Test Summary');
console.log(`Tests Run: ${testsRun}`);
console.log(`Tests Passed: ${testsPassed} ✅`);
console.log(`Tests Failed: ${testsFailed} ❌`);
console.log(`Success Rate: ${Math.round((testsPassed / testsRun) * 100)}%`);

if (testsFailed === 0) {
  console.log(`\n🎉 ALL TESTS PASSED! Phase 1 features are working correctly.\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️  SOME TESTS FAILED. Please review the failures above.\n`);
  process.exit(1);
}
