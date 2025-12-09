/**
 * Individual Identity Context Module
 * 
 * Provides context blending for personal profile AI generation:
 * 1. Loads Individual Identity (personal data about the team member)
 * 2. Filters Team Intelligence for mentions of the individual
 * 3. Merges with team voice guidelines for on-brand consistency
 */

import { getAdminInstances } from '@/lib/firebase/admin';
import type { IndividualIdentity, IndividualContext } from '@/lib/types';
import { getBrandSoul } from '@/lib/brand-soul/context';
import { BrandSoulStorage } from '@/lib/brand-soul/storage';
import type { BrandArtifact } from '@/lib/types/brand-soul';
import type { BrandSoul } from '@/lib/types/brand-soul';
import { getOrSetCache } from '../cache-manager';

/**
 * Fetch Individual Identity for a team member
 */
export async function getIndividualIdentity(
  brandId: string,
  userId: string
): Promise<IndividualIdentity | null> {
  try {
    const { adminDb } = getAdminInstances();
    const identityId = `${brandId}_${userId}`;
    const identityDoc = await adminDb
      .collection('individualIdentities')
      .doc(identityId)
      .get();

    if (!identityDoc.exists) {
      return null;
    }

    return identityDoc.data() as IndividualIdentity;
  } catch (error) {
    console.error(`[IndividualIdentity] Error fetching for ${userId}:`, error);
    return null;
  }
}

/**
 * Search comprehensive Team Intelligence (extracted artifacts) for mentions of an individual
 * Returns insights and extracted content that reference this team member
 * This searches the FULL extracted content from approved artifacts, not just the fact library
 */
async function searchComprehensiveTeamIntelligenceForIndividual(
  brandId: string,
  userDisplayName: string,
  maxTokens: number = 800
): Promise<string> {
  try {
    const { adminDb } = getAdminInstances();
    const storage = new BrandSoulStorage();
    const userName = userDisplayName.toLowerCase();
    
    console.log(`[IndividualIdentity] Searching comprehensive Team Intelligence for mentions of: ${userDisplayName}`);
    
    // Get extracted and approved artifacts
    const [extractedSnapshot, approvedSnapshot] = await Promise.all([
      adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'extracted')
        .limit(30)
        .get()
        .catch(() => ({ docs: [] as any[] })),
      adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'approved')
        .limit(30)
        .get()
        .catch(() => ({ docs: [] as any[] }))
    ]);
    
    // Combine and deduplicate
    const allArtifacts = new Map();
    [...extractedSnapshot.docs, ...approvedSnapshot.docs].forEach((doc: any) => {
      if (!allArtifacts.has(doc.id)) {
        allArtifacts.set(doc.id, doc);
      }
    });
    
    if (allArtifacts.size === 0) {
      console.log('[IndividualIdentity] No artifacts found');
      return '';
    }
    
    // Search artifacts for mentions of the individual
    const relevantMentions: string[] = [];
    let currentTokens = 0;
    
    for (const doc of allArtifacts.values()) {
      if (currentTokens >= maxTokens) break;
      
      const artifact = doc.data() as BrandArtifact;
      
      // Load extracted text content
      let extractedText = '';
      if (artifact.contentRef?.path) {
        try {
          const content = await storage.getContent(artifact.contentRef.path);
          extractedText = content || '';
        } catch {
          // Skip if content not available
          continue;
        }
      }
      
      // Check if this artifact mentions the individual
      const textLower = extractedText.toLowerCase();
      if (!textLower.includes(userName)) {
        continue; // Skip artifacts that don't mention this person
      }
      
      // Extract relevant snippets (sentences mentioning the individual)
      const sentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const relevantSentences = sentences.filter(sentence => 
        sentence.toLowerCase().includes(userName)
      );
      
      if (relevantSentences.length > 0) {
        const sourceTitle = artifact.metadata?.title || artifact.source.url || 'Unknown Source';
        const sourceType = artifact.type.toUpperCase();
        
        const snippet = `[${sourceType}: ${sourceTitle}]\n${relevantSentences.slice(0, 3).join('. ')}.`;
        const snippetTokens = Math.ceil(snippet.length / 4);
        
        if (currentTokens + snippetTokens <= maxTokens) {
          relevantMentions.push(snippet);
          currentTokens += snippetTokens;
        }
      }
    }
    
    if (relevantMentions.length === 0) {
      console.log(`[IndividualIdentity] No mentions of ${userDisplayName} found in Team Intelligence`);
      return '';
    }
    
    console.log(`[IndividualIdentity] Found ${relevantMentions.length} artifact(s) with mentions of ${userDisplayName}`);
    return `Extracted Team Intelligence mentions of ${userDisplayName}:\n\n${relevantMentions.join('\n\n')}`;
  } catch (error) {
    console.error('[IndividualIdentity] Error searching comprehensive Team Intelligence:', error);
    return '';
  }
}

/**
 * Search Team Intelligence (Brand Soul fact library) for mentions of an individual
 * Returns curated facts that reference this team member
 * NOTE: This only searches the curated fact library. Use searchComprehensiveTeamIntelligenceForIndividual
 * for full extracted content from artifacts.
 *
 * OPTIMIZATION: Accepts pre-fetched brandSoul to avoid duplicate Firestore queries
 */
function searchTeamIntelligenceForIndividualWithSoul(
  brandSoul: BrandSoul | null,
  userDisplayName: string
): string {
  try {
    if (!brandSoul || !brandSoul.factLibrary?.facts) {
      return '';
    }

    // Filter facts that mention the individual by name
    const relevantFacts = brandSoul.factLibrary.facts.filter((fact) => {
      const factText = fact.fact?.toLowerCase() || '';
      const userName = userDisplayName.toLowerCase();

      // Check if fact mentions the user
      return factText.includes(userName);
    });

    if (relevantFacts.length === 0) {
      return '';
    }

    // Format facts into readable context
    const factsText = relevantFacts
      .map((fact) => {
        const sourceCount = fact.sources?.length || 0;
        return `- ${fact.fact}${sourceCount > 0 ? ` (${sourceCount} source${sourceCount > 1 ? 's' : ''})` : ''}`;
      })
      .join('\n');

    return `Team Intelligence fact library mentions of ${userDisplayName}:\n${factsText}`;
  } catch (error) {
    console.error(
      `[IndividualIdentity] Error searching Team Intelligence:`,
      error
    );
    return '';
  }
}

/**
 * Get team voice guidelines for maintaining brand consistency
 * OPTIMIZATION: Accepts pre-fetched brandSoul to avoid duplicate Firestore queries
 */
function getTeamVoiceGuidelinesFromSoul(brandSoul: BrandSoul | null): string {
  try {
    if (!brandSoul || !brandSoul.voiceProfile) {
      return '';
    }

    const parts: string[] = [];

    // Voice tone
    if (brandSoul.voiceProfile.tone) {
      const secondaryTones = brandSoul.voiceProfile.tone.secondary || [];
      const toneDesc = [
        brandSoul.voiceProfile.tone.primary,
        ...secondaryTones,
      ].join(', ');
      parts.push(`Team Voice Tone: ${toneDesc}`);
    }

    // Personality traits
    if (
      brandSoul.voiceProfile.personality?.traits &&
      brandSoul.voiceProfile.personality.traits.length > 0
    ) {
      const traitNames = brandSoul.voiceProfile.personality.traits.map(
        (t: { name: string }) => t.name
      );
      parts.push(`Team Personality: ${traitNames.join(', ')}`);
    }

    // Formality level
    if (brandSoul.voiceProfile.formality) {
      parts.push(`Formality Level: ${brandSoul.voiceProfile.formality}/10`);
    }

    return parts.join('\n');
  } catch (error) {
    console.error(`[IndividualIdentity] Error processing voice guidelines:`, error);
    return '';
  }
}

/**
 * Get formatted Individual Context for AI generation prompts
 * Blends: Individual Identity (70%) + Team Intelligence mentions (20%) + Team Voice (10%)
 *
 * PERFORMANCE OPTIMIZATION: Uses caching and fetches Brand Soul only once
 */
export async function getIndividualContext(
  brandId: string,
  userId: string,
  userDisplayName: string
): Promise<IndividualContext> {
  // Cache key for this specific user context
  const cacheKey = `individual-context:${brandId}:${userId}:${userDisplayName}`;

  return await getOrSetCache(
    cacheKey,
    async () => {
      // Fetch Individual Identity, Brand Soul, and comprehensive intelligence in parallel
      // OPTIMIZATION: Fetch Brand Soul once instead of twice (was called in both searchTeamIntelligence and getTeamVoiceGuidelines)
      const [identity, brandSoul, comprehensiveIntelligence] = await Promise.all([
        getIndividualIdentity(brandId, userId),
        getBrandSoul(brandId),
        searchComprehensiveTeamIntelligenceForIndividual(brandId, userDisplayName, 800),
      ]);

      // Use pre-fetched Brand Soul for fact library search and voice guidelines (synchronous - no extra Firestore calls)
      const factLibraryMentions = searchTeamIntelligenceForIndividualWithSoul(brandSoul, userDisplayName);
      const teamVoiceGuidelines = getTeamVoiceGuidelinesFromSoul(brandSoul);

      // Build the context
      return buildIndividualContext(identity, comprehensiveIntelligence, factLibraryMentions, teamVoiceGuidelines, userDisplayName);
    },
    5 * 60 * 1000 // 5 minutes TTL (shorter than Brand Soul since individual data may change more frequently)
  );
}

/**
 * Build Individual Context from fetched data
 * Extracted to support caching
 */
function buildIndividualContext(
  identity: IndividualIdentity | null,
  comprehensiveIntelligence: string,
  factLibraryMentions: string,
  teamVoiceGuidelines: string,
  userDisplayName: string
): IndividualContext {
  // Combine both Team Intelligence sources for complete context
  const individualMentions = [comprehensiveIntelligence, factLibraryMentions]
    .filter(m => m.trim().length > 0)
    .join('\n\n---\n\n');

  // Format Individual Identity into readable context (if it exists)
  let identityContext = `INDIVIDUAL IDENTITY: ${userDisplayName}\n`;

  if (identity) {
    if (identity.roleTitle) {
      identityContext += `\nRole: ${identity.roleTitle}`;
    }

    if (identity.narrativeSummary) {
      identityContext += `\n\nBackground:\n${identity.narrativeSummary}`;
    }

    if (identity.personalMission) {
      identityContext += `\n\nPersonal Mission:\n${identity.personalMission}`;
    }

    if (identity.personalTagline) {
      identityContext += `\n\nTagline: "${identity.personalTagline}"`;
    }

    if (identity.personalValues && identity.personalValues.length > 0) {
      identityContext += `\n\nValues: ${identity.personalValues.join(', ')}`;
    }

    if (identity.skills && identity.skills.length > 0) {
      identityContext += `\n\nSkills & Expertise: ${identity.skills.join(', ')}`;
    }

    if (identity.achievements && identity.achievements.length > 0) {
      identityContext += `\n\nKey Achievements:\n${identity.achievements
        .map((a) => `- ${a}`)
        .join('\n')}`;
    }

    if (identity.workingStyle) {
      identityContext += `\n\nWorking Style:\n${identity.workingStyle}`;
    }

    if (identity.testimonials && identity.testimonials.length > 0) {
      identityContext += `\n\nTestimonials:\n${identity.testimonials
        .map((t) => `"${t.text}" - ${t.author}${t.role ? `, ${t.role}` : ''}`)
        .join('\n')}`;
    }
  } else {
    // No Individual Identity exists yet - rely on Team Intelligence
    identityContext += `\n(No individual profile created yet - using Team Intelligence mentions)`;
  }

  // Build full blended context
  let fullContext = identityContext;

  if (teamVoiceGuidelines) {
    fullContext += `\n\n---\nTEAM VOICE GUIDELINES (for consistency):\n${teamVoiceGuidelines}`;
  }

  if (individualMentions) {
    fullContext += `\n\n---\n${individualMentions}`;
  }

  // Return context with exists=true if we have ANY useful information
  // (either Individual Identity OR Team Intelligence mentions)
  const hasUsefulContext = identity !== null || individualMentions.length > 0 || teamVoiceGuidelines.length > 0;

  return {
    exists: hasUsefulContext,
    identity: identity || undefined,
    teamVoiceGuidelines,
    individualMentions,
    fullContext,
  };
}

/**
 * Get Individual Context instruction for AI prompts
 * Returns a formatted instruction emphasizing individual focus
 */
export function getIndividualContextInstruction(
  context: IndividualContext
): string {
  if (!context.exists) {
    return `
Generate content that focuses on this individual team member as a person.
Highlight their unique contributions, skills, and personality.
    `.trim();
  }

  return `
IMPORTANT: Generate content ABOUT THIS INDIVIDUAL TEAM MEMBER, not about the team.

**Context Weighting:**
- PRIMARY (70%): Focus on their Individual Identity - personal background, achievements, skills, mission
- SECONDARY (20%): Include relevant Team Intelligence mentions of this person
- TERTIARY (10%): Maintain team voice/tone for brand consistency

${context.fullContext}

**Content Requirements:**
- Write about THIS PERSON specifically
- Showcase their unique strengths, expertise, and contributions
- Use their personal mission, values, and achievements
- Keep the team's voice/tone but make it personal
- Avoid generic team-level statements
- Make it feel like a personal bio/portfolio, not a corporate profile
  `.trim();
}
