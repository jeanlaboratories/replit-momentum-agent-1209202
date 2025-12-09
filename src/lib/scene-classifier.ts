/**
 * Scene Type Classifier
 * 
 * Analyzes image prompts and content to determine scene type and subtype.
 * Part of Phase 1: Enhanced Content Generation (Matchpoint Integration)
 */

import { 
  SceneType, 
  SceneSubtype, 
  SceneClassification,
  HumanSceneSubtype,
  ProductSceneSubtype,
  IngredientSceneSubtype
} from './types';

/**
 * Classifies an image prompt into scene type and subtype using keyword analysis
 * 
 * @param imagePrompt - The image prompt text to classify
 * @param contentContext - Additional context (ad copy, key message) for better classification
 * @returns SceneClassification with type, subtype, and confidence
 */
export function classifySceneType(
  imagePrompt: string,
  contentContext?: { adCopy?: string; keyMessage?: string }
): SceneClassification {
  const prompt = imagePrompt.toLowerCase();
  const context = contentContext ? 
    `${contentContext.adCopy || ''} ${contentContext.keyMessage || ''}`.toLowerCase() : '';
  const fullText = `${prompt} ${context}`;

  // Classify main scene type
  const sceneType = determineSceneType(fullText);
  
  // Classify subtype based on scene type
  let sceneSubtype: SceneSubtype;
  let confidence: number;
  let reasoning: string;

  switch (sceneType) {
    case 'human':
      const humanResult = classifyHumanSubtype(fullText);
      sceneSubtype = humanResult.subtype;
      confidence = humanResult.confidence;
      reasoning = humanResult.reasoning;
      break;
    
    case 'product':
      const productResult = classifyProductSubtype(fullText);
      sceneSubtype = productResult.subtype;
      confidence = productResult.confidence;
      reasoning = productResult.reasoning;
      break;
    
    case 'ingredient':
      const ingredientResult = classifyIngredientSubtype(fullText);
      sceneSubtype = ingredientResult.subtype;
      confidence = ingredientResult.confidence;
      reasoning = ingredientResult.reasoning;
      break;
    
    case 'detail':
      // Detail scenes default to 'texture' subtype
      sceneSubtype = 'texture';
      confidence = 0.7;
      reasoning = 'Classified as detail/texture scene based on close-up or abstract language';
      break;
  }

  return {
    sceneType,
    sceneSubtype,
    confidence,
    reasoning
  };
}

/**
 * Determines the main scene type from text
 */
function determineSceneType(text: string): SceneType {
  // Keywords for each scene type
  const humanKeywords = [
    'person', 'people', 'woman', 'man', 'customer', 'user', 'team',
    'model', 'face', 'hands', 'holding', 'wearing', 'using', 'smiling',
    'group', 'family', 'friends', 'athlete', 'professional'
  ];

  const productKeywords = [
    'product', 'bottle', 'package', 'container', 'box', 'jar',
    'device', 'packaging', 'label', 'logo', 'branding', 'display',
    'shelf', 'stand', 'showcase', 'shot'
  ];

  const ingredientKeywords = [
    'ingredient', 'raw', 'natural', 'organic', 'extract', 'powder',
    'leaf', 'herb', 'grain', 'seed', 'oil', 'vitamin', 'mineral',
    'botanical', 'plant', 'fruit', 'vegetable', 'component'
  ];

  const detailKeywords = [
    'texture', 'pattern', 'surface', 'detail', 'close-up', 'macro',
    'fabric', 'material', 'grain', 'weave', 'abstract'
  ];

  // Count matches for each category
  const scores = {
    human: countKeywords(text, humanKeywords),
    product: countKeywords(text, productKeywords),
    ingredient: countKeywords(text, ingredientKeywords),
    detail: countKeywords(text, detailKeywords)
  };

  // Return the type with highest score
  const maxScore = Math.max(...Object.values(scores));
  
  if (maxScore === 0) {
    // Default to product if no clear indicators
    return 'product';
  }

  // Special case: if "product" is explicitly mentioned, prioritize product over detail
  // (even if detail keywords like "macro", "texture" are also present)
  if (text.includes('product') && scores.product > 0) {
    // Check if detail has higher score
    if (scores.detail > scores.product) {
      // Override: product explicitly mentioned takes priority
      return 'product';
    }
  }

  return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as SceneType || 'product';
}

/**
 * Classifies human scene subtype
 */
function classifyHumanSubtype(text: string): {
  subtype: HumanSceneSubtype;
  confidence: number;
  reasoning: string;
} {
  // Solo: single person
  const soloKeywords = ['person', 'woman', 'man', 'individual', 'solo', 'portrait'];
  const soloScore = countKeywords(text, soloKeywords);

  // Group: multiple people
  const groupKeywords = ['group', 'team', 'people', 'friends', 'family', 'crowd', 'together'];
  const groupScore = countKeywords(text, groupKeywords);

  // UGC: user-generated content style
  const ugcKeywords = ['selfie', 'authentic', 'real', 'unfiltered', 'candid', 'personal', 'phone'];
  const ugcScore = countKeywords(text, ugcKeywords);

  // Action: dynamic movement
  const actionKeywords = ['running', 'jumping', 'dancing', 'exercising', 'active', 'motion', 'movement', 'sports'];
  const actionScore = countKeywords(text, actionKeywords);

  // Lifestyle: person in context using product
  const lifestyleKeywords = ['lifestyle', 'everyday', 'routine', 'using', 'home', 'morning', 'enjoying'];
  const lifestyleScore = countKeywords(text, lifestyleKeywords);

  const scores = { solo: soloScore, group: groupScore, ugc: ugcScore, action: actionScore, lifestyle: lifestyleScore };
  const maxScore = Math.max(...Object.values(scores));

  if (maxScore === 0) {
    return {
      subtype: 'lifestyle',
      confidence: 0.5,
      reasoning: 'Default to lifestyle when no specific human scene indicators found'
    };
  }

  const subtype = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as HumanSceneSubtype || 'lifestyle';
  const confidence = Math.min(0.95, 0.6 + (maxScore * 0.1));

  return {
    subtype,
    confidence,
    reasoning: `Detected ${maxScore} keyword(s) indicating ${subtype} scene`
  };
}

/**
 * Classifies product scene subtype
 */
function classifyProductSubtype(text: string): {
  subtype: ProductSceneSubtype;
  confidence: number;
  reasoning: string;
} {
  // Hero: main product shot
  const heroKeywords = ['hero', 'product', 'centered', 'showcase', 'featured', 'main', 'primary'];
  const heroScore = countKeywords(text, heroKeywords);

  // Lifestyle: product in use/context
  const lifestyleKeywords = ['lifestyle', 'context', 'environment', 'scene', 'setting', 'natural'];
  const lifestyleScore = countKeywords(text, lifestyleKeywords);

  // Macro: close-up detail
  const macroKeywords = ['macro', 'close-up', 'detail', 'texture', 'zoom', 'extreme'];
  const macroScore = countKeywords(text, macroKeywords);

  // Pack: packaging/multiple products
  const packKeywords = ['packaging', 'box', 'pack', 'bundle', 'collection', 'set', 'kit'];
  const packScore = countKeywords(text, packKeywords);

  // In-use: product being used
  const inuseKeywords = ['using', 'application', 'applying', 'hands', 'holding', 'demonstration'];
  const inuseScore = countKeywords(text, inuseKeywords);

  const scores = { hero: heroScore, lifestyle: lifestyleScore, macro: macroScore, pack: packScore, inuse: inuseScore };
  const maxScore = Math.max(...Object.values(scores));

  if (maxScore === 0) {
    return {
      subtype: 'hero',
      confidence: 0.5,
      reasoning: 'Default to hero product shot when no specific product scene indicators found'
    };
  }

  const subtype = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as ProductSceneSubtype || 'hero';
  const confidence = Math.min(0.95, 0.6 + (maxScore * 0.1));

  return {
    subtype,
    confidence,
    reasoning: `Detected ${maxScore} keyword(s) indicating ${subtype} product scene`
  };
}

/**
 * Classifies ingredient scene subtype
 */
function classifyIngredientSubtype(text: string): {
  subtype: IngredientSceneSubtype;
  confidence: number;
  reasoning: string;
} {
  // Flatlay: top-down arrangement
  const flatlayKeywords = ['flatlay', 'flat-lay', 'top-down', 'overhead', 'arrangement', 'layout'];
  const flatlayScore = countKeywords(text, flatlayKeywords);

  // Macro: close-up detail of ingredient
  const macroKeywords = ['macro', 'close-up', 'detail', 'zoom', 'texture', 'extreme'];
  const macroScore = countKeywords(text, macroKeywords);

  // Collage: multiple ingredients together
  const collageKeywords = ['collage', 'collection', 'multiple', 'variety', 'assortment', 'mix'];
  const collageScore = countKeywords(text, collageKeywords);

  // Texture: focusing on ingredient texture
  const textureKeywords = ['texture', 'surface', 'pattern', 'grain', 'fiber', 'weave'];
  const textureScore = countKeywords(text, textureKeywords);

  const scores = { flatlay: flatlayScore, macro: macroScore, collage: collageScore, texture: textureScore };
  const maxScore = Math.max(...Object.values(scores));

  if (maxScore === 0) {
    return {
      subtype: 'flatlay',
      confidence: 0.5,
      reasoning: 'Default to flatlay when no specific ingredient scene indicators found'
    };
  }

  const subtype = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as IngredientSceneSubtype || 'flatlay';
  const confidence = Math.min(0.95, 0.6 + (maxScore * 0.1));

  return {
    subtype,
    confidence,
    reasoning: `Detected ${maxScore} keyword(s) indicating ${subtype} ingredient scene`
  };
}

/**
 * Helper: Count how many keywords appear in text
 */
function countKeywords(text: string, keywords: string[]): number {
  return keywords.filter(keyword => text.includes(keyword)).length;
}

/**
 * Determines appropriate photographic controls based on scene classification
 * 
 * @param classification - Scene classification result
 * @returns Recommended photographic settings
 */
export function recommendPhotographicControls(classification: SceneClassification) {
  const { sceneType, sceneSubtype } = classification;

  // Default recommendations based on scene type and subtype
  const recommendations: {
    lighting?: string[];
    mood?: string[];
    composition?: string[];
    lens?: string[];
    framing?: string[];
    depthOfField?: string[];
  } = {};

  // Human scenes
  if (sceneType === 'human') {
    recommendations.lighting = ['natural', 'soft', 'golden-hour'];
    recommendations.mood = ['energetic', 'professional', 'playful'];
    
    if (sceneSubtype === 'solo') {
      recommendations.lens = ['50mm', '85mm'];
      recommendations.framing = ['medium', 'close-up'];
      recommendations.depthOfField = ['shallow'];
    } else if (sceneSubtype === 'group') {
      recommendations.lens = ['35mm', '50mm'];
      recommendations.framing = ['wide', 'medium'];
      recommendations.depthOfField = ['medium', 'deep'];
    } else if (sceneSubtype === 'ugc') {
      recommendations.lens = ['35mm', 'wide-angle'];
      recommendations.framing = ['close-up', 'medium'];
      recommendations.composition = ['dynamic', 'centered'];
    } else if (sceneSubtype === 'action') {
      recommendations.lens = ['35mm', '50mm'];
      recommendations.framing = ['wide', 'medium'];
      recommendations.composition = ['dynamic'];
    }
  }

  // Product scenes
  if (sceneType === 'product') {
    recommendations.lighting = ['studio', 'soft', 'natural'];
    recommendations.mood = ['professional', 'luxurious', 'minimal'];
    
    if (sceneSubtype === 'hero') {
      recommendations.lens = ['50mm', '85mm'];
      recommendations.framing = ['medium', 'close-up'];
      recommendations.composition = ['centered', 'rule-of-thirds'];
      recommendations.depthOfField = ['shallow', 'medium'];
    } else if (sceneSubtype === 'macro') {
      recommendations.lens = ['macro'];
      recommendations.framing = ['extreme-close', 'close-up'];
      recommendations.depthOfField = ['shallow'];
    } else if (sceneSubtype === 'pack') {
      recommendations.lens = ['50mm', '35mm'];
      recommendations.framing = ['medium', 'wide'];
      recommendations.composition = ['symmetrical', 'layered'];
    }
  }

  // Ingredient scenes
  if (sceneType === 'ingredient') {
    recommendations.lighting = ['natural', 'soft', 'backlit'];
    recommendations.mood = ['calm', 'minimal', 'vibrant'];
    
    if (sceneSubtype === 'flatlay') {
      recommendations.lens = ['35mm', '50mm'];
      recommendations.framing = ['top-down'];
      recommendations.composition = ['symmetrical', 'minimalist'];
      recommendations.depthOfField = ['deep', 'medium'];
    } else if (sceneSubtype === 'macro') {
      recommendations.lens = ['macro'];
      recommendations.framing = ['extreme-close', 'close-up'];
      recommendations.depthOfField = ['shallow'];
    } else if (sceneSubtype === 'texture') {
      recommendations.lens = ['macro', '85mm'];
      recommendations.framing = ['close-up', 'extreme-close'];
      recommendations.depthOfField = ['shallow', 'medium'];
    }
  }

  return recommendations;
}
