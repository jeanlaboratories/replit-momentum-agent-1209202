/**
 * Brand Soul → Dynamic Composer Explainability
 * 
 * This utility provides intuitive explanations showing how Brand Soul data
 * influences the dynamic image generation composer in Phase 1.
 */

import type { BrandSoulContext } from './context';
import type { 
  SceneClassification, 
  EnhancedImagePrompt,
  LightingStyle,
  MoodStyle,
  CompositionStyle 
} from '@/lib/types';

/**
 * Explainability report showing Brand Soul → Dynamic Composer connection
 */
export interface BrandSoulInfluenceReport {
  summary: string;
  influences: BrandSoulInfluence[];
  visualPreview: {
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  };
  confidence: number; // 0-1
}

export interface BrandSoulInfluence {
  category: 'color' | 'style' | 'lighting' | 'mood' | 'composition' | 'negative' | 'scene';
  brandSoulSource: string; // What Brand Soul data was used
  appliedToPrompt: string; // How it was applied to the image prompt
  impact: 'high' | 'medium' | 'low';
  example?: string; // Visual example or description
}

/**
 * Generates an explainability report showing how Brand Soul influenced image generation
 */
export function explainBrandSoulInfluence(
  brandSoulContext: BrandSoulContext,
  sceneClassification: SceneClassification,
  enhancedPrompt: EnhancedImagePrompt
): BrandSoulInfluenceReport {
  const influences: BrandSoulInfluence[] = [];
  let totalImpact = 0;
  
  // 1. Brand Colors Influence
  if (brandSoulContext.brandColors && brandSoulContext.brandColors.length > 0) {
    influences.push({
      category: 'color',
      brandSoulSource: `Brand Colors: ${brandSoulContext.brandColors.slice(0, 3).join(', ')}`,
      appliedToPrompt: 'Brand color palette integrated into image generation to ensure visual consistency',
      impact: 'high',
      example: `Your primary brand colors (${brandSoulContext.brandColors.slice(0, 2).join(', ')}) will be prominently featured in the generated image`
    });
    totalImpact += 3;
  }
  
  // 2. Style Tags Influence
  if (brandSoulContext.brandStyleTags && brandSoulContext.brandStyleTags.length > 0) {
    influences.push({
      category: 'style',
      brandSoulSource: `Visual Style: ${brandSoulContext.brandStyleTags.join(', ')}`,
      appliedToPrompt: 'Brand style aesthetic applied to overall image composition and feel',
      impact: 'high',
      example: `Image will reflect your brand's ${brandSoulContext.brandStyleTags[0]} style`
    });
    totalImpact += 3;
  }
  
  // 3. Scene Type Influence
  influences.push({
    category: 'scene',
    brandSoulSource: `Detected Scene Type: ${sceneClassification.sceneType}/${sceneClassification.sceneSubtype}`,
    appliedToPrompt: `Photographic controls optimized for ${sceneClassification.sceneSubtype} ${sceneClassification.sceneType} scenes`,
    impact: 'medium',
    example: `Scene classifier detected this is a ${sceneClassification.sceneSubtype} scene and applied appropriate photography settings`
  });
  totalImpact += 2;
  
  // 5. Photographic Controls from Scene
  if (enhancedPrompt.lighting) {
    influences.push({
      category: 'lighting',
      brandSoulSource: `Scene-Optimized Lighting for ${sceneClassification.sceneType}`,
      appliedToPrompt: `${enhancedPrompt.lighting} lighting applied`,
      impact: 'medium',
      example: `${capitalize(enhancedPrompt.lighting)} lighting creates the right atmosphere for ${sceneClassification.sceneType} scenes`
    });
    totalImpact += 2;
  }
  
  if (enhancedPrompt.mood) {
    influences.push({
      category: 'mood',
      brandSoulSource: `Scene-Optimized Mood for ${sceneClassification.sceneSubtype}`,
      appliedToPrompt: `${enhancedPrompt.mood} mood applied`,
      impact: 'medium',
      example: `${capitalize(enhancedPrompt.mood)} mood aligns with your brand personality`
    });
    totalImpact += 2;
  }
  
  if (enhancedPrompt.composition) {
    influences.push({
      category: 'composition',
      brandSoulSource: `Composition Style for ${sceneClassification.sceneType}`,
      appliedToPrompt: `${enhancedPrompt.composition} composition applied`,
      impact: 'medium',
      example: `${capitalize(enhancedPrompt.composition)} composition enhances visual impact`
    });
    totalImpact += 2;
  }
  
  // Calculate confidence (0-1)
  const maxPossibleImpact = 15; // 3 highs + 3 mediums
  const confidence = Math.min(totalImpact / maxPossibleImpact, 1);
  
  // Generate summary
  const summary = generateInfluenceSummary(influences, sceneClassification, brandSoulContext);
  
  // Visual preview
  const visualPreview = {
    appliedControls: [
      enhancedPrompt.lighting ? `${enhancedPrompt.lighting} lighting` : '',
      enhancedPrompt.mood ? `${enhancedPrompt.mood} mood` : '',
      enhancedPrompt.composition ? `${enhancedPrompt.composition} composition` : '',
      enhancedPrompt.shotSpecs?.lens ? `${enhancedPrompt.shotSpecs.lens} lens` : '',
      enhancedPrompt.shotSpecs?.framing ? `${enhancedPrompt.shotSpecs.framing} framing` : '',
    ].filter(Boolean),
    brandElements: [
      ...(brandSoulContext.brandColors || []).slice(0, 3),
      ...(brandSoulContext.brandStyleTags || []),
    ],
    avoidedElements: [],
  };
  
  return {
    summary,
    influences,
    visualPreview,
    confidence,
  };
}

/**
 * Generates a human-readable summary of Brand Soul influence
 */
function generateInfluenceSummary(
  influences: BrandSoulInfluence[],
  sceneClassification: SceneClassification,
  brandSoulContext: BrandSoulContext
): string {
  const parts: string[] = [];
  
  // Opening
  parts.push(`Your Brand Soul is actively shaping this ${sceneClassification.sceneSubtype} image:`);
  parts.push('');
  
  // Brand visual identity
  if (brandSoulContext.brandColors || brandSoulContext.brandStyleTags) {
    const colorInfo = brandSoulContext.brandColors?.length 
      ? `brand colors (${brandSoulContext.brandColors.slice(0, 2).join(', ')})`
      : '';
    const styleInfo = brandSoulContext.brandStyleTags?.length
      ? `${brandSoulContext.brandStyleTags[0]} visual style`
      : '';
    
    const combined = [colorInfo, styleInfo].filter(Boolean).join(' and ');
    if (combined) {
      parts.push(`✨ Visual Identity: Applying your ${combined}`);
    }
  }
  
  // Photographic controls
  const photoControls = influences
    .filter(i => ['lighting', 'mood', 'composition'].includes(i.category))
    .map(i => i.category);
  
  if (photoControls.length > 0) {
    parts.push(`📸 Photography: Optimized ${photoControls.join(', ')} for ${sceneClassification.sceneType} scenes`);
  }
  
  // Scene detection
  parts.push(`🎯 Scene Detection: Recognized as ${sceneClassification.sceneType}/${sceneClassification.sceneSubtype} (${Math.round(sceneClassification.confidence * 100)}% confidence)`);
  
  return parts.join('\n');
}

/**
 * Simple markdown explainability for user-facing display
 */
export function generateMarkdownExplanation(report: BrandSoulInfluenceReport): string {
  const lines: string[] = [];
  
  lines.push('## 🎨 How Your Brand Soul Shaped This Image');
  lines.push('');
  lines.push(report.summary);
  lines.push('');
  
  // Applied Controls
  if (report.visualPreview.appliedControls.length > 0) {
    lines.push('### Applied Photographic Controls');
    report.visualPreview.appliedControls.forEach(control => {
      lines.push(`- ${control}`);
    });
    lines.push('');
  }
  
  // Brand Elements
  if (report.visualPreview.brandElements.length > 0) {
    lines.push('### Brand Elements Integrated');
    report.visualPreview.brandElements.forEach(element => {
      lines.push(`- ${element}`);
    });
    lines.push('');
  }
  
  // Avoided Elements
  if (report.visualPreview.avoidedElements.length > 0) {
    lines.push('### Elements Actively Avoided');
    report.visualPreview.avoidedElements.forEach(element => {
      lines.push(`- ${element}`);
    });
    lines.push('');
  }
  
  // Detailed Influences
  lines.push('### Detailed Influence Breakdown');
  lines.push('');
  
  const groupedInfluences = groupInfluencesByCategory(report.influences);
  
  Object.entries(groupedInfluences).forEach(([category, items]) => {
    lines.push(`**${capitalize(category)}** (${items[0].impact} impact):`);
    items.forEach(influence => {
      lines.push(`- ${influence.appliedToPrompt}`);
      if (influence.example) {
        lines.push(`  _${influence.example}_`);
      }
    });
    lines.push('');
  });
  
  lines.push(`---`);
  lines.push(`_Brand Soul Confidence: ${Math.round(report.confidence * 100)}%_`);
  
  return lines.join('\n');
}

/**
 * Simple console-friendly explanation
 */
export function logBrandSoulInfluence(report: BrandSoulInfluenceReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('🎨 BRAND SOUL → DYNAMIC COMPOSER');
  console.log('='.repeat(60));
  console.log(report.summary);
  console.log('');
  
  console.log('Applied Controls:', report.visualPreview.appliedControls.join(', '));
  console.log('Brand Elements:', report.visualPreview.brandElements.join(', '));
  if (report.visualPreview.avoidedElements.length > 0) {
    console.log('Avoided Elements:', report.visualPreview.avoidedElements.join(', '));
  }
  console.log('');
  
  console.log('Confidence:', `${Math.round(report.confidence * 100)}%`);
  console.log('='.repeat(60) + '\n');
}

// Helper functions
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function groupInfluencesByCategory(
  influences: BrandSoulInfluence[]
): Record<string, BrandSoulInfluence[]> {
  const grouped: Record<string, BrandSoulInfluence[]> = {};
  
  influences.forEach(influence => {
    if (!grouped[influence.category]) {
      grouped[influence.category] = [];
    }
    grouped[influence.category].push(influence);
  });
  
  return grouped;
}

/**
 * Generates a compact JSON explainability for API responses
 */
export function getCompactExplanation(report: BrandSoulInfluenceReport) {
  return {
    confidence: report.confidence,
    appliedControls: report.visualPreview.appliedControls,
    brandElements: report.visualPreview.brandElements,
    avoidedElements: report.visualPreview.avoidedElements,
    summary: report.summary,
  };
}
