/**
 * Phase 1: Enhanced Brand Soul Extraction Prompts
 * 
 * These prompts guide AI to extract photographic preferences and scene styles
 * from brand materials (websites, images, documents, etc.)
 */

/**
 * Enhanced Visual Identity Extraction Prompt
 * 
 * This prompt is used during Brand Soul synthesis to extract:
 * - Photographic preferences (lighting, mood, composition)
 * - Scene preferences (common scene types)
 * - Visual elements to avoid (negative prompts)
 */
export const ENHANCED_VISUAL_EXTRACTION_PROMPT = `
You are analyzing brand materials to extract enhanced visual identity preferences that will guide AI image generation.

Analyze the provided brand content (images, website design, marketing materials) and extract the following:

## 1. PHOTOGRAPHIC PREFERENCES

### Lighting Preferences
- Identify preferred lighting styles from these options: natural, studio, dramatic, soft, golden-hour, backlit, diffused
- Also note any lighting styles to AVOID
- Provide context: where did you observe this preference?

Example output:
{
  "lighting": {
    "preferred": ["natural", "soft"],
    "avoid": ["harsh", "fluorescent"],
    "context": "Website images consistently use soft natural lighting in product shots"
  }
}

### Mood Preferences
- Identify preferred mood styles: energetic, calm, professional, playful, luxurious, minimal, vibrant
- Note moods to avoid
- Provide context

Example output:
{
  "mood": {
    "preferred": ["professional", "calm"],
    "avoid": ["chaotic", "overly-playful"],
    "context": "Brand imagery conveys calm professionalism across all channels"
  }
}

### Composition Preferences
- Identify composition styles: rule-of-thirds, centered, symmetrical, dynamic, minimalist, layered
- Provide context

Example output:
{
  "composition": {
    "preferred": ["minimalist", "rule-of-thirds"],
    "context": "Clean, minimalist compositions with strategic negative space"
  }
}

### Shot Preferences
- Lens types: 35mm, 50mm, 85mm, macro, wide-angle, telephoto
- Framing: wide, medium, close-up, extreme-close, top-down
- Depth of field: shallow, deep, medium
- Provide context

Example output:
{
  "shotPreferences": {
    "lens": ["50mm", "85mm"],
    "framing": ["close-up", "medium"],
    "depthOfField": ["shallow"],
    "context": "Portrait-style shots with shallow depth of field for product focus"
  }
}

## 2. SCENE PREFERENCES

Analyze which scene types are most common in the brand's visual content:

Scene Types:
- **human**: Images featuring people
  - Subtypes: solo, group, ugc, action, lifestyle
- **product**: Product-focused shots
  - Subtypes: hero, lifestyle, macro, pack, inuse
- **ingredient**: Raw materials/components
  - Subtypes: flatlay, macro, collage, texture
- **detail**: Close-up details/textures
  - Subtypes: texture, pattern, surface

For each common scene type, provide:
- frequency (0-1): how often this appears
- examples: URLs to representative images
- confidence (0-100): how confident you are in this pattern

Example output:
{
  "commonScenes": [
    {
      "sceneType": "human",
      "sceneSubtype": "lifestyle",
      "frequency": 0.6,
      "examples": ["https://example.com/img1.jpg"],
      "confidence": 85
    },
    {
      "sceneType": "product",
      "sceneSubtype": "hero",
      "frequency": 0.4,
      "examples": ["https://example.com/img2.jpg"],
      "confidence": 90
    }
  ],
  "avoidScenes": ["ugc"],
  "context": "Brand prefers polished lifestyle and hero product shots over UGC-style content"
}

## 3. VISUAL ELEMENTS TO AVOID

Identify specific visual elements that are inconsistent with the brand:
- Visual styles to avoid (e.g., "cluttered", "dark", "overly-saturated")
- Specific subjects or themes to exclude
- Color treatments to avoid

Example output:
{
  "avoid": ["cluttered backgrounds", "harsh shadows", "overly-saturated colors", "busy patterns"]
}

## OUTPUT FORMAT

Return your analysis in this JSON structure:

{
  "photographicPreferences": {
    "lighting": {...},
    "mood": {...},
    "composition": {...},
    "shotPreferences": {...}
  },
  "scenePreferences": {
    "commonScenes": [...],
    "avoidScenes": [...],
    "context": "..."
  },
  "avoid": [...]
}

## IMPORTANT GUIDELINES

1. **Be specific**: Don't just say "professional lighting" - specify "soft studio lighting" or "natural daylight"
2. **Provide evidence**: Always include context explaining where you observed this pattern
3. **Be honest about confidence**: If you're uncertain, reflect that in lower confidence scores
4. **Look for patterns**: A single image isn't a preference - look for consistent patterns across multiple sources
5. **Distinguish preferences from variety**: Brands can use multiple styles - focus on the MOST COMMON patterns

Now analyze the provided brand materials and extract these enhanced visual preferences.
`;

/**
 * Example usage in Brand Soul synthesis
 */
export function generateVisualExtractionPrompt(
  brandContent: {
    websiteScreenshots?: string[];
    imageUrls?: string[];
    textContent?: string;
  }
): string {
  return `
${ENHANCED_VISUAL_EXTRACTION_PROMPT}

## BRAND MATERIALS TO ANALYZE

${brandContent.websiteScreenshots?.length ? `
### Website Screenshots
${brandContent.websiteScreenshots.map((url, i) => `${i + 1}. ${url}`).join('\n')}
` : ''}

${brandContent.imageUrls?.length ? `
### Brand Images
${brandContent.imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}
` : ''}

${brandContent.textContent ? `
### Brand Content
${brandContent.textContent}
` : ''}

Analyze these materials and extract the enhanced visual identity preferences in the JSON format specified above.
  `.trim();
}

/**
 * Quick extraction guidelines for developers implementing synthesis
 */
export const EXTRACTION_GUIDELINES = {
  minImagesForConfidence: 5, // Need at least 5 images to detect patterns
  confidenceThresholds: {
    high: 80,     // 80%+ confidence: clear, consistent pattern
    medium: 60,   // 60-79%: noticeable trend but not universal
    low: 40,      // 40-59%: weak signal, needs more data
  },
  sceneMixCalculation: {
    // How to calculate scene frequency from image analysis
    description: "Count scene types across all images, divide by total images",
    example: "20 images: 12 human, 6 product, 2 ingredient → frequencies: 0.6, 0.3, 0.1"
  },
  avoidListSources: [
    "Tone avoid list (from voiceProfile.tone.avoid)",
    "Visual avoid list (from imageStyle.avoid)",
    "Photographic avoid (from lighting.avoid, mood.avoid)",
  ],
  validation: {
    checksum: "Frequency values should sum to ~1.0",
    minConfidence: 40, // Reject extractions below 40% confidence
    requireContext: true, // All preferences must include context explanation
  }
};
