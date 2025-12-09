// Brand Soul - Context Utility for AI Generation
// Provides Brand Soul context to all content generation flows

import { getAdminInstances } from '@/lib/firebase/admin';
import type { BrandSoul } from '@/lib/types/brand-soul';
import type { BrandProfile } from '@/lib/types';
import { BrandSoulStorage } from './storage';
import type { BrandArtifact, ExtractedInsights } from '@/lib/types/brand-soul';
import { getOrSetCache } from '../cache-manager';

/**
 * Formatted Brand Soul context for AI prompts
 */
export interface BrandSoulContext {
  exists: boolean;
  voiceGuidelines?: string;
  messagingGuidelines?: string;
  visualGuidelines?: string;
  factsSummary?: string;
  brandIdentity?: string;
  fullContext?: string;
  // Phase 1: Enhanced Image Generation
  brandColors?: string[]; // Array of hex color codes
  brandStyleTags?: string[]; // Style descriptors (e.g., 'minimal', 'modern')
  photographicPreferences?: any; // Extracted photographic preferences
  scenePreferences?: any; // Extracted scene preferences
  // Comprehensive Team Intelligence insights from extracted artifacts
  comprehensiveInsights?: string;
}

/**
 * Fetch Brand Soul for a given brand
 */
export async function getBrandSoul(brandId: string): Promise<BrandSoul | null> {
  try {
    const { adminDb } = getAdminInstances();
    const brandSoulDoc = await adminDb.collection('brandSoul').doc(brandId).get();
    
    if (!brandSoulDoc.exists) {
      return null;
    }
    
    return brandSoulDoc.data() as BrandSoul;
  } catch (error) {
    console.error(`[BrandSoul] Error fetching Brand Soul for ${brandId}:`, error);
    return null;
  }
}

/**
 * Fetch Brand Profile (for Brand Identity information)
 */
async function getBrandProfile(brandId: string): Promise<BrandProfile | null> {
  try {
    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(brandId).get();
    
    if (!brandDoc.exists) {
      return null;
    }
    
    const data = brandDoc.data();
    return data?.profile || null;
  } catch (error) {
    console.error(`[BrandSoul] Error fetching Brand Profile for ${brandId}:`, error);
    return null;
  }
}

/**
 * Simple token estimator (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token budget
 */
function truncateToTokenBudget(text: string, maxTokens: number): string {
  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) {
    return text;
  }
  const maxChars = maxTokens * 4;
  return text.substring(0, maxChars) + '...';
}

/**
 * Extract comprehensive Team Intelligence insights from extracted & approved Brand Soul artifacts
 * Returns insights organized BY ARTIFACT with all insight types and extracted text content
 * Queries both 'extracted' and 'approved' artifacts for complete coverage
 */
async function getComprehensiveTeamIntelligence(brandId: string, maxTokens: number = 1500): Promise<string | null> {
  try {
    const { adminDb } = getAdminInstances();
    const storage = new BrandSoulStorage();
    
    console.log(`[BrandSoul] Querying comprehensive Team Intelligence for brandId: ${brandId}`);
    
    // Get artifacts with 'extracted' OR 'approved' status
    const [extractedSnapshot, approvedSnapshot] = await Promise.all([
      adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'extracted')
        .limit(50)
        .get()
        .catch((error: any) => {
          console.error('[BrandSoul] Error querying extracted artifacts:', error.message);
          throw error;
        }),
      adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'approved')
        .limit(50)
        .get()
        .catch((error: any) => {
          console.error('[BrandSoul] Error querying approved artifacts:', error.message);
          throw error;
        })
    ]);
    
    // Combine and deduplicate artifacts
    const allArtifacts = new Map();
    [...extractedSnapshot.docs, ...approvedSnapshot.docs].forEach((doc: any) => {
      if (!allArtifacts.has(doc.id)) {
        allArtifacts.set(doc.id, doc);
      }
    });
    
    if (allArtifacts.size === 0) {
      console.log('[BrandSoul] No artifacts found (extracted or approved)');
      return null;
    }
    
    console.log(`[BrandSoul] Found ${allArtifacts.size} artifacts (extracted + approved, deduplicated)`);
    
    // Sort by most recent and take top 30
    const sortedDocs = Array.from(allArtifacts.values())
      .sort((a, b) => {
        const aTime = a.data().processedAt || 0;
        const bTime = b.data().processedAt || 0;
        return bTime - aTime;
      })
      .slice(0, 30);
    
    // Load insights AND extracted content for each artifact in parallel
    const artifactDataPromises = sortedDocs.map(async (doc) => {
      const artifact = doc.data() as BrandArtifact;
      if (!artifact.insightsRef?.path) {
        return null;
      }
      
      try {
        const [insights, extractedText] = await Promise.all([
          storage.getInsights(artifact.insightsRef.path),
          artifact.contentRef?.path ? storage.getContent(artifact.contentRef.path) : Promise.resolve(null)
        ]);
        
        return { insights, extractedText, artifact };
      } catch (error) {
        console.error(`[BrandSoul] Error loading data for ${artifact.id}:`, error);
        return null;
      }
    });
    
    const allArtifactData = await Promise.all(artifactDataPromises);
    const validInsights = allArtifactData.filter((data): data is { 
      insights: ExtractedInsights; 
      extractedText: string | null;
      artifact: BrandArtifact 
    } => 
      data !== null && data.insights !== null
    );
    
    if (validInsights.length === 0) {
      console.log('[BrandSoul] No valid insights data found');
      return null;
    }
    
    console.log(`[BrandSoul] Loaded insights for ${validInsights.length} artifacts`);
    
    // Build comprehensive insights organized BY ARTIFACT
    const insightsParts: string[] = [];
    let currentTokens = 0;
    
    // Process each artifact and include insights + extracted text
    for (const { insights, extractedText, artifact } of validInsights) {
      const sourceTitle = artifact.metadata?.title || artifact.source.url || 'Unknown Source';
      const sourceType = artifact.type.toUpperCase();
      
      // Start artifact section
      const headerText = `\n━━━ ${sourceTitle} (${sourceType}) ━━━\n`;
      const headerTokens = estimateTokens(headerText);
      
      // Check if we have room for this artifact
      if (currentTokens + headerTokens > maxTokens * 0.95) break;
      
      insightsParts.push(headerText);
      currentTokens += headerTokens;
      
      // Add Facts if present
      if (insights.facts && insights.facts.length > 0) {
        insights.facts.forEach((f: any) => {
          const factText = `• [${f.category}] ${f.fact}`;
          const factTokens = estimateTokens(factText);
          
          if (currentTokens + factTokens <= maxTokens) {
            insightsParts.push(factText);
            currentTokens += factTokens;
          }
        });
      }
      
      // Add Messages if present
      if (insights.messages && insights.messages.length > 0) {
        insights.messages.forEach((m: any) => {
          const msgText = `• ${m.theme}: ${m.message}`;
          const msgTokens = estimateTokens(msgText);
          
          if (currentTokens + msgTokens <= maxTokens) {
            insightsParts.push(msgText);
            currentTokens += msgTokens;
          }
        });
      }
      
      // Add extracted text content if present
      if (extractedText && extractedText.trim().length > 0) {
        const remainingTokens = maxTokens - currentTokens;
        
        if (remainingTokens > 50) {
          const textTokens = estimateTokens(extractedText);
          const truncatedContent = truncateToTokenBudget(extractedText, Math.min(textTokens, remainingTokens - 20));
          insightsParts.push(truncatedContent);
          insightsParts.push('');
          currentTokens += estimateTokens(truncatedContent);
        }
      }
      
      // Check if we're approaching token limit
      if (currentTokens >= maxTokens * 0.95) {
        insightsParts.push('... (additional insights truncated due to token budget)');
        break;
      }
    }
    
    const finalInsights = insightsParts.length > 0 ? insightsParts.join('\n') : null;
    if (finalInsights) {
      const tokenCount = estimateTokens(finalInsights);
      console.log(`[BrandSoul] Comprehensive insights built: ${tokenCount} tokens`);
    }
    return finalInsights;
  } catch (error) {
    console.error(`[BrandSoul] Error fetching comprehensive Team Intelligence:`, error);
    return null;
  }
}

/**
 * Get formatted Brand Soul context for AI generation prompts
 * @param brandId - The brand ID to fetch context for
 * @param includeComprehensiveInsights - If true, includes comprehensive Team Intelligence insights from extracted artifacts (default: false)
 * @param comprehensiveInsightsTokenBudget - Token budget for comprehensive insights (default: 1500)
 * PERFORMANCE OPTIMIZATION: Results are cached for 10 minutes
 */
export async function getBrandSoulContext(
  brandId: string,
  includeComprehensiveInsights: boolean = false,
  comprehensiveInsightsTokenBudget: number = 1500
): Promise<BrandSoulContext> {
  // PERFORMANCE OPTIMIZATION: Cache Brand Soul context for 10 minutes
  // Cache key includes insight parameters to handle different configurations
  const cacheKey = `brand-soul-context:${brandId}:${includeComprehensiveInsights}:${comprehensiveInsightsTokenBudget}`;

  return await getOrSetCache(
    cacheKey,
    async () => {
      // Fetch Brand Soul, Brand Profile, and optionally comprehensive insights in parallel
      const [brandSoul, brandProfile, comprehensiveInsights] = await Promise.all([
        getBrandSoul(brandId),
        getBrandProfile(brandId),
        includeComprehensiveInsights ? getComprehensiveTeamIntelligence(brandId, comprehensiveInsightsTokenBudget) : Promise.resolve(null)
      ]);

      return buildBrandSoulContext(brandSoul, brandProfile, comprehensiveInsights);
    },
    10 * 60 * 1000 // 10 minutes TTL
  );
}

/**
 * Build Brand Soul Context from fetched data
 * Extracted to support caching
 */
function buildBrandSoulContext(
  brandSoul: BrandSoul | null,
  brandProfile: BrandProfile | null,
  comprehensiveInsights: string | null
): BrandSoulContext {
  
  // Format Brand Identity information
  let brandIdentity = '';
  if (brandProfile) {
    const parts: string[] = [];
    
    if (brandProfile.tagline) {
      parts.push(`Tagline: ${brandProfile.tagline}`);
    }
    
    if (brandProfile.summary) {
      parts.push(`Summary: ${brandProfile.summary}`);
    }
    
    if (brandProfile.websiteUrl) {
      parts.push(`Website: ${brandProfile.websiteUrl}`);
    }
    
    if (brandProfile.contactEmail) {
      parts.push(`Contact: ${brandProfile.contactEmail}`);
    }
    
    if (brandProfile.location) {
      parts.push(`Location: ${brandProfile.location}`);
    }
    
    brandIdentity = parts.join('\n');
  }
  
  // If no Brand Soul exists, return just Brand Identity
  if (!brandSoul) {
    if (brandIdentity) {
      return {
        exists: true,
        brandIdentity,
        fullContext: `BRAND IDENTITY:\n${brandIdentity}`,
      };
    }
    return { exists: false };
  }
  
  // Format voice guidelines
  let voiceGuidelines = '';
  if (brandSoul.voiceProfile) {
    const parts: string[] = [];
    
    if (brandSoul.voiceProfile.tone) {
      const secondaryTones = brandSoul.voiceProfile.tone.secondary || [];
      const toneDesc = [brandSoul.voiceProfile.tone.primary, ...secondaryTones].join(', ');
      parts.push(`Tone: ${toneDesc}`);
      if (brandSoul.voiceProfile.tone.avoid?.length > 0) {
        parts.push(`Avoid: ${brandSoul.voiceProfile.tone.avoid.join(', ')}`);
      }
    }
    
    if (brandSoul.voiceProfile.writingStyle?.preferredPhrases && brandSoul.voiceProfile.writingStyle.preferredPhrases.length > 0) {
      parts.push(`Preferred Phrases: ${brandSoul.voiceProfile.writingStyle.preferredPhrases.slice(0, 5).join(', ')}`);
    }
    
    if (brandSoul.voiceProfile.personality?.traits && brandSoul.voiceProfile.personality.traits.length > 0) {
      const traitNames = brandSoul.voiceProfile.personality.traits.map((t: {name: string}) => t.name);
      parts.push(`Personality Traits: ${traitNames.join(', ')}`);
    }
    
    if (brandSoul.voiceProfile.formality) {
      parts.push(`Formality Level: ${brandSoul.voiceProfile.formality}/10`);
    }
    
    voiceGuidelines = parts.join('\n');
  }
  
  // Format messaging guidelines
  let messagingGuidelines = '';
  if (brandSoul.messagingFramework) {
    const parts: string[] = [];
    
    if (brandSoul.messagingFramework.taglines && brandSoul.messagingFramework.taglines.length > 0) {
      parts.push(`Taglines: ${brandSoul.messagingFramework.taglines.map((t: string) => `"${t}"`).join(', ')}`);
    }
    
    if (brandSoul.messagingFramework.keyMessages && brandSoul.messagingFramework.keyMessages.length > 0) {
      const themeMessages = brandSoul.messagingFramework.keyMessages
        .map((theme: {theme: string, messages: string[]}) => 
          `${theme.theme}:\n${theme.messages.map((m: string) => `  - ${m}`).join('\n')}`
        )
        .join('\n\n');
      parts.push(`Key Messages:\n${themeMessages}`);
    }
    
    if (brandSoul.messagingFramework.mission) {
      parts.push(`Mission: ${brandSoul.messagingFramework.mission}`);
    }
    
    messagingGuidelines = parts.join('\n\n');
  }
  
  // Format visual guidelines and extract enhanced image generation data
  let visualGuidelines = '';
  let brandColors: string[] = [];
  let brandStyleTags: string[] = [];
  let photographicPreferences: any = undefined;
  let scenePreferences: any = undefined;
  
  if (brandSoul.visualIdentity) {
    const parts: string[] = [];
    
    if (brandSoul.visualIdentity.colors) {
      const colors: string[] = [];
      // Collect all brand colors for enhanced image generation
      if (brandSoul.visualIdentity.colors.primary?.length > 0) {
        colors.push(`Primary: ${brandSoul.visualIdentity.colors.primary.join(', ')}`);
        brandColors.push(...brandSoul.visualIdentity.colors.primary);
      }
      if (brandSoul.visualIdentity.colors.secondary?.length > 0) {
        colors.push(`Secondary: ${brandSoul.visualIdentity.colors.secondary.join(', ')}`);
        brandColors.push(...brandSoul.visualIdentity.colors.secondary);
      }
      if (brandSoul.visualIdentity.colors.accent?.length > 0) {
        colors.push(`Accent: ${brandSoul.visualIdentity.colors.accent.join(', ')}`);
        brandColors.push(...brandSoul.visualIdentity.colors.accent);
      }
      if (colors.length > 0) {
        parts.push(`Brand Colors:\n${colors.join('\n')}`);
      }
    }
    
    if (brandSoul.visualIdentity.imageStyle?.style) {
      parts.push(`Image Style: ${brandSoul.visualIdentity.imageStyle.style}`);
      brandStyleTags.push(brandSoul.visualIdentity.imageStyle.style);
    }
    
    // Phase 1: Extract photographic preferences from Brand Soul
    if (brandSoul.visualIdentity.imageStyle?.photographicPreferences) {
      photographicPreferences = brandSoul.visualIdentity.imageStyle.photographicPreferences;
      
      // Add to visual guidelines
      const photoPrefs: string[] = [];
      if (photographicPreferences.lighting?.preferred?.length > 0) {
        photoPrefs.push(`Preferred Lighting: ${photographicPreferences.lighting.preferred.join(', ')}`);
      }
      if (photographicPreferences.mood?.preferred?.length > 0) {
        photoPrefs.push(`Preferred Mood: ${photographicPreferences.mood.preferred.join(', ')}`);
      }
      if (photographicPreferences.composition?.preferred?.length > 0) {
        photoPrefs.push(`Preferred Composition: ${photographicPreferences.composition.preferred.join(', ')}`);
      }
      if (photoPrefs.length > 0) {
        parts.push(`Photographic Preferences:\n${photoPrefs.join('\n')}`);
      }
    }
    
    // Phase 1: Extract scene preferences from Brand Soul
    if (brandSoul.visualIdentity.imageStyle?.scenePreferences) {
      scenePreferences = brandSoul.visualIdentity.imageStyle.scenePreferences;
      
      if (scenePreferences.commonScenes?.length > 0) {
        const topScenes = scenePreferences.commonScenes
          .slice(0, 3)
          .map((s: any) => `${s.sceneType}/${s.sceneSubtype}`)
          .join(', ');
        parts.push(`Common Scene Types: ${topScenes}`);
      }
    }
    
    if (brandSoul.visualIdentity.typography?.fonts && brandSoul.visualIdentity.typography.fonts.length > 0) {
      parts.push(`Typography: ${brandSoul.visualIdentity.typography.fonts.join(', ')}`);
    }
    
    visualGuidelines = parts.join('\n\n');
  }
  
  // Format key facts summary
  let factsSummary = '';
  if (brandSoul.factLibrary && Object.keys(brandSoul.factLibrary).length > 0) {
    const factCategories = Object.entries(brandSoul.factLibrary)
      .map(([category, facts]) => {
        if (!facts || !Array.isArray(facts) || facts.length === 0) return '';
        return `${category}:\n${facts.slice(0, 3).map((f: string) => `  - ${f}`).join('\n')}`;
      })
      .filter(s => s.length > 0);
    
    factsSummary = factCategories.join('\n\n');
  }
  
  // Create full context for detailed prompts
  const confidenceScore = brandSoul.stats?.confidenceScore ?? 'N/A';
  const fullContext = `
BRAND SOUL GUIDELINES
Version: ${brandSoul.latestVersionId || 'initial'}
Confidence: ${confidenceScore}%

${brandIdentity ? `BRAND IDENTITY:\n${brandIdentity}\n` : ''}
${voiceGuidelines ? `BRAND VOICE:\n${voiceGuidelines}\n` : ''}
${messagingGuidelines ? `BRAND MESSAGING:\n${messagingGuidelines}\n` : ''}
${visualGuidelines ? `VISUAL IDENTITY:\n${visualGuidelines}\n` : ''}
${factsSummary ? `KEY BRAND FACTS:\n${factsSummary}\n` : ''}
${comprehensiveInsights ? `COMPREHENSIVE TEAM INTELLIGENCE:\n${comprehensiveInsights}` : ''}
  `.trim();
  
  return {
    exists: true,
    brandIdentity: brandIdentity || undefined,
    voiceGuidelines: voiceGuidelines || undefined,
    messagingGuidelines: messagingGuidelines || undefined,
    visualGuidelines: visualGuidelines || undefined,
    factsSummary: factsSummary || undefined,
    fullContext,
    // Phase 1: Enhanced Image Generation Fields
    brandColors: brandColors.length > 0 ? brandColors : undefined,
    brandStyleTags: brandStyleTags.length > 0 ? brandStyleTags : undefined,
    photographicPreferences: photographicPreferences || undefined,
    scenePreferences: scenePreferences || undefined,
    // Comprehensive Team Intelligence
    comprehensiveInsights: comprehensiveInsights || undefined,
  };
}

/**
 * Get Brand Soul context instruction for AI prompts
 * Returns a formatted instruction to include in system prompts
 */
export function getBrandSoulInstruction(context: BrandSoulContext): string {
  if (!context.exists) {
    return '';
  }
  
  return `
IMPORTANT: You must strictly adhere to the following Brand Soul guidelines in all generated content:

${context.fullContext}

All content you generate MUST:
- Match the brand's tone, style, and personality
- Align with the brand's messaging framework and value proposition
- Follow visual identity guidelines (colors, style, themes)
- Be consistent with the brand's established facts and positioning

Never deviate from these brand guidelines.
  `.trim();
}
