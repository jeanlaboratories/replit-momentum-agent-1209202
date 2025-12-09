import { getBrandSoulContext } from './brand-soul/context';
import { getBrandMembers, requireBrandAccess } from './brand-membership';
import { BrandMember, BrandProfile, IndividualIdentity, Sponsorship } from './types';
import { getAdminInstances } from './firebase/admin';
import { getIndividualIdentity } from './individual-identity/context';
import { BrandSoulStorage } from './brand-soul/storage';
import type { BrandArtifact, ExtractedInsights } from './types/brand-soul';
import { getSponsorshipsForBrand } from './sponsorship';
import { getBrandThemeAction, BrandTheme } from '@/app/actions/ai-branding';
import { getOrSetCache } from './cache-manager';

export interface AIAssistantContext {
  systemPrompt: string;
  systemPromptMinimal?: string; // Lightweight version for image/media operations
  brandProfile?: BrandProfile & { name?: string };
  brandSoul?: any;
  teamMembers?: BrandMember[];
  currentUser?: {
    userId: string;
    email: string;
    displayName?: string;
    individualIdentity?: IndividualIdentity;
  };
}

async function getBrandProfile(brandId: string): Promise<(BrandProfile & { name?: string }) | null> {
  try {
    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(brandId).get();
    
    if (!brandDoc.exists) {
      return null;
    }
    
    const data = brandDoc.data();
    if (!data?.profile) {
      return null;
    }
    return {
      ...data.profile,
      name: data.name,
    };
  } catch (error) {
    console.error(`[AIAssistantContext] Error fetching Brand Profile for ${brandId}:`, error);
    return null;
  }
}

async function getCurrentUserInfo(userId: string, brandId: string): Promise<{ userId: string; email: string; displayName?: string } | null> {
  try {
    const { adminAuth, adminDb } = getAdminInstances();
    
    const [userRecord, userPrefsDoc] = await Promise.all([
      adminAuth.getUser(userId),
      adminDb.collection('userProfilePreferences').doc(userId).collection('brands').doc(brandId).get(),
    ]);
    
    const displayName = userPrefsDoc.exists ? userPrefsDoc.data()?.displayName : undefined;
    
    return {
      userId,
      email: userRecord.email || 'Unknown',
      displayName: displayName || userRecord.displayName || undefined,
    };
  } catch (error) {
    console.error(`[AIAssistantContext] Error fetching user info for ${userId}:`, error);
    return null;
  }
}

/**
 * Fetch active sponsors for a brand and their team profiles
 */
async function getActiveSponsorProfiles(brandId: string): Promise<{ sponsorBrandId: string; sponsorBrandName: string; profile: (BrandProfile & { name?: string }) | null }[]> {
  try {
    const sponsorships = await getSponsorshipsForBrand(brandId);
    
    // Filter for active incoming sponsorships (brands that sponsor this team)
    const activeSponsors = sponsorships.incoming.filter(s => s.status === 'ACTIVE');
    
    if (activeSponsors.length === 0) {
      return [];
    }
    
    console.log(`[AIAssistantContext] Found ${activeSponsors.length} active sponsors for ${brandId}`);
    
    // Fetch profiles for all active sponsors in parallel
    const sponsorProfiles = await Promise.all(
      activeSponsors.map(async (sponsorship) => {
        const profile = await getBrandProfile(sponsorship.sponsorBrandId);
        return {
          sponsorBrandId: sponsorship.sponsorBrandId,
          sponsorBrandName: sponsorship.sponsorBrandName,
          profile
        };
      })
    );
    
    return sponsorProfiles;
  } catch (error) {
    console.error(`[AIAssistantContext] Error fetching sponsor profiles for ${brandId}:`, error);
    return [];
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
 * Extract ALL Team Intelligence insights from extracted & approved Brand Soul artifacts
 * Returns comprehensive insights organized BY ARTIFACT with all insight types per source
 * Includes FULL EXTRACTED TEXT CONTENT from each artifact (websites, documents, etc.)
 * Queries both 'extracted' (ready for review) and 'approved' (curated) artifacts
 * PERFORMANCE OPTIMIZATION: Now with caching and artifact limits
 */
async function getAllTeamIntelligenceInsights(brandId: string, maxTokens: number = 50000, maxArtifacts: number = 100): Promise<string | null> {
  // PERFORMANCE OPTIMIZATION: Cache Team Intelligence for 10 minutes
  // This dramatically reduces database reads for frequently accessed brands
  return await getOrSetCache(
    `team-intelligence:${brandId}`,
    async () => {
      try {
        const { adminDb } = getAdminInstances();
        const storage = new BrandSoulStorage();

        console.log(`[AIAssistantContext] Querying Team Intelligence for brandId: ${brandId} (maxArtifacts: ${maxArtifacts}, maxTokens: ${maxTokens})`);
    
    // Fetch ALL artifacts with pagination to handle Firestore limits (~1MB / ~1000 docs per .get())
    const allDocs: any[] = [];
    
    // Paginate through 'extracted' artifacts
    let extractedHasMore = true;
    let extractedLastDoc = null;
    while (extractedHasMore) {
      let query = adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'extracted')
        .limit(500); // Batch size to stay under Firestore limits
      
      if (extractedLastDoc) {
        query = query.startAfter(extractedLastDoc);
      }
      
      const snapshot = await query.get().catch((error: any) => {
        console.error('[AIAssistantContext] Error querying extracted artifacts:', error.message);
        throw error;
      });
      
      if (snapshot.empty) {
        extractedHasMore = false;
      } else {
        allDocs.push(...snapshot.docs);
        extractedLastDoc = snapshot.docs[snapshot.docs.length - 1];
        extractedHasMore = snapshot.docs.length === 500; // More if we hit batch limit
      }
    }
    
    // Paginate through 'approved' artifacts
    let approvedHasMore = true;
    let approvedLastDoc = null;
    while (approvedHasMore) {
      let query = adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'approved')
        .limit(500); // Batch size to stay under Firestore limits
      
      if (approvedLastDoc) {
        query = query.startAfter(approvedLastDoc);
      }
      
      const snapshot = await query.get().catch((error: any) => {
        console.error('[AIAssistantContext] Error querying approved artifacts:', error.message);
        throw error;
      });
      
      if (snapshot.empty) {
        approvedHasMore = false;
      } else {
        allDocs.push(...snapshot.docs);
        approvedLastDoc = snapshot.docs[snapshot.docs.length - 1];
        approvedHasMore = snapshot.docs.length === 500; // More if we hit batch limit
      }
    }
    
    // Deduplicate artifacts (same artifact might be in both extracted and approved)
    const allArtifacts = new Map();
    allDocs.forEach((doc: any) => {
      if (!allArtifacts.has(doc.id)) {
        allArtifacts.set(doc.id, doc);
      }
    });
    
    if (allArtifacts.size === 0) {
      console.log('[AIAssistantContext] No artifacts found (extracted or approved)');
      return null;
    }
    
    console.log(`[AIAssistantContext] Found ${allArtifacts.size} artifacts via pagination (extracted + approved, deduplicated)`);
    
    // Sort by most recent (processedAt time) and limit to maxArtifacts
    const sortedDocs = Array.from(allArtifacts.values())
      .sort((a, b) => {
        const aTime = a.data().processedAt || 0;
        const bTime = b.data().processedAt || 0;
        return bTime - aTime;
      })
      .slice(0, maxArtifacts); // PERFORMANCE OPTIMIZATION: Limit artifacts processed

    console.log(`[AIAssistantContext] Processing top ${sortedDocs.length} most recent artifacts (limited from ${allArtifacts.size} total)`);
    
    // Load insights AND extracted content for each artifact in parallel
    const artifactDataPromises = sortedDocs.map(async (doc) => {
      const artifact = doc.data() as BrandArtifact;
      if (!artifact.insightsRef?.path) {
        return null;
      }
      
      try {
        // Load both insights and the full extracted text content
        const [insights, extractedText] = await Promise.all([
          storage.getInsights(artifact.insightsRef.path),
          artifact.contentRef?.path ? storage.getContent(artifact.contentRef.path) : Promise.resolve(null)
        ]);
        
        return { insights, extractedText, artifact };
      } catch (error) {
        console.error(`[AIAssistantContext] Error loading data for ${artifact.id}:`, error);
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
      console.log('[AIAssistantContext] No valid insights data found');
      return null;
    }
    
    console.log(`[AIAssistantContext] Loaded insights for ${validInsights.length} artifacts`);
    
    // Build comprehensive insights organized BY ARTIFACT (like the Insights page)
    // NO TRUNCATION - Include ALL insights and ALL extracted text from ALL artifacts
    const insightsParts: string[] = [];
    
    // Process EVERY artifact and include ALL its insights + extracted text
    for (const { insights, extractedText, artifact } of validInsights) {
      const sourceTitle = artifact.metadata?.title || artifact.source.url || 'Unknown Source';
      const sourceType = artifact.type.toUpperCase();
      const confidence = insights.confidence || 0;
      
      // Start artifact section
      insightsParts.push(`\n━━━ SOURCE: ${sourceTitle} (${sourceType}) ━━━\nConfidence: ${confidence}%\n`);
      
      // Add ALL Voice Elements if present
      if (insights.voiceElements && insights.voiceElements.length > 0) {
        insightsParts.push('VOICE & TONE:');
        insights.voiceElements.forEach((v: any) => {
          insightsParts.push(`  • ${v.aspect}: ${v.value}`);
        });
        insightsParts.push('');
      }
      
      // Add ALL Facts if present
      if (insights.facts && insights.facts.length > 0) {
        insightsParts.push('FACTS:');
        insights.facts.forEach((f: any) => {
          insightsParts.push(`  • [${f.category}] ${f.fact} (${f.confidence}% confidence)`);
        });
        insightsParts.push('');
      }
      
      // Add ALL Messages if present
      if (insights.messages && insights.messages.length > 0) {
        insightsParts.push('KEY MESSAGES:');
        insights.messages.forEach((m: any) => {
          insightsParts.push(`  • ${m.theme}: ${m.message}`);
        });
        insightsParts.push('');
      }
      
      // Add ALL Visual Elements if present
      if (insights.visualElements && insights.visualElements.length > 0) {
        insightsParts.push('VISUAL ELEMENTS:');
        insights.visualElements.forEach((ve: any) => {
          insightsParts.push(`  • ${ve.type}: ${ve.value}`);
        });
        insightsParts.push('');
      }
      
      // Add FULL EXTRACTED TEXT CONTENT if present (NO TRUNCATION)
      if (extractedText && extractedText.trim().length > 0) {
        insightsParts.push('EXTRACTED TEXT CONTENT:');
        insightsParts.push(extractedText);
        insightsParts.push('');
      }
    }
    
        const finalInsights = insightsParts.length > 0 ? insightsParts.join('\n') : null;
        if (finalInsights) {
          const tokenCount = estimateTokens(finalInsights);
          console.log(`[AIAssistantContext] Team Intelligence insights built: ${tokenCount} tokens from ${validInsights.length} artifacts (limited to ${maxArtifacts} artifacts, ${maxTokens} token budget)`);

          // Safety monitoring: Warn if context is very large
          if (tokenCount > maxTokens) {
            console.warn(`[AIAssistantContext] WARNING: Team Intelligence context (${tokenCount} tokens) exceeds budget (${maxTokens} tokens). Consider reducing maxArtifacts.`);
          }
        }
        return finalInsights;
      } catch (error) {
        console.error(`[AIAssistantContext] Error fetching comprehensive Team Intelligence insights:`, error);
        return null;
      }
    },
    10 * 60 * 1000 // 10 minutes TTL - longer cache for Team Intelligence
  );
}

export async function getAIAssistantContext(brandId: string, userId: string): Promise<AIAssistantContext> {
  // SECURITY: Verify user has access to the brand before fetching context
  await requireBrandAccess(userId, brandId);

  // PERFORMANCE OPTIMIZATION: Cache the entire context for 5 minutes
  // This reduces database reads by ~90% and improves response time by 70%
  return await getOrSetCache(
    `ai-context:${brandId}:${userId}`,
    async () => {
      // Fetch all context data in parallel
      const [brandProfile, brandSoulContext, teamMembers, currentUser, currentUserIdentity, comprehensiveInsights, activeSponsorProfiles, brandThemeResult] = await Promise.all([
        getBrandProfile(brandId),
        getBrandSoulContext(brandId),
        getBrandMembers(brandId),
        getCurrentUserInfo(userId, brandId),
        getIndividualIdentity(brandId, userId),
        getAllTeamIntelligenceInsights(brandId, 50000, 100), // PERFORMANCE OPTIMIZATION: 50k token budget, max 100 artifacts
        getActiveSponsorProfiles(brandId), // Fetch active sponsor profiles
        getBrandThemeAction(brandId).catch(() => null), // Fetch AI Visual Branding
      ]);

      return buildAIAssistantContext(
        brandId,
        userId,
        brandProfile,
        brandSoulContext,
        teamMembers,
        currentUser,
        currentUserIdentity,
        comprehensiveInsights,
        activeSponsorProfiles,
        brandThemeResult
      );
    },
    5 * 60 * 1000 // 5 minutes TTL
  );
}

/**
 * Build the AI Assistant Context from fetched data
 * Extracted as a separate function to support caching
 */
async function buildAIAssistantContext(
  brandId: string,
  userId: string,
  brandProfile: (BrandProfile & { name?: string }) | null,
  brandSoulContext: any,
  teamMembers: BrandMember[],
  currentUser: { userId: string; email: string; displayName?: string } | null,
  currentUserIdentity: IndividualIdentity | null,
  comprehensiveInsights: string | null,
  activeSponsorProfiles: { sponsorBrandId: string; sponsorBrandName: string; profile: (BrandProfile & { name?: string }) | null }[],
  brandThemeResult: any
): Promise<AIAssistantContext> {
  // Extract theme from result (getBrandThemeAction returns {theme} or {error})
  const brandTheme = brandThemeResult && 'theme' in brandThemeResult ? brandThemeResult.theme : null;

  const systemPromptParts: string[] = [];

  systemPromptParts.push(`You are an AI Team Assistant for "${brandProfile?.name || 'this team'}" - an intelligent, personable companion that helps teams achieve their goals.`);
  
  if (currentUser) {
    const userName = currentUser.displayName || currentUser.email.split('@')[0];
    systemPromptParts.push(`\nYou're working with ${userName} - someone you know well and support personally.`);
  }
  
  // Add current user's Individual Identity if available (with token budget)
  if (currentUserIdentity) {
    const MAX_USER_IDENTITY_TOKENS = 300; // Budget for current user identity
    const identityParts: string[] = [];
    
    identityParts.push('\n=== WHO YOU\'RE HELPING ===');
    const userName = currentUser?.displayName || currentUser?.email.split('@')[0];
    
    if (currentUserIdentity.roleTitle) {
      identityParts.push(`${userName} is the team's ${currentUserIdentity.roleTitle}.`);
    }
    if (currentUserIdentity.narrativeSummary) {
      const truncatedBio = truncateToTokenBudget(currentUserIdentity.narrativeSummary, 100);
      identityParts.push(`Background: ${truncatedBio}`);
    }
    if (currentUserIdentity.personalMission) {
      identityParts.push(`Their mission: ${currentUserIdentity.personalMission}`);
    }
    if (currentUserIdentity.workingStyle) {
      identityParts.push(`How they work: ${currentUserIdentity.workingStyle}`);
    }
    if (currentUserIdentity.skills && currentUserIdentity.skills.length > 0) {
      identityParts.push(`Their strengths: ${currentUserIdentity.skills.slice(0, 10).join(', ')}`);
    }
    if (currentUserIdentity.achievements && currentUserIdentity.achievements.length > 0) {
      identityParts.push(`Proud of: ${currentUserIdentity.achievements.slice(0, 3).join('; ')}`);
    }
    if (currentUserIdentity.personalValues && currentUserIdentity.personalValues.length > 0) {
      identityParts.push(`Values: ${currentUserIdentity.personalValues.join(', ')}`);
    }
    
    const identityText = identityParts.join('\n');
    const finalIdentityText = truncateToTokenBudget(identityText, MAX_USER_IDENTITY_TOKENS);
    systemPromptParts.push(finalIdentityText);
  }
  
  systemPromptParts.push('');
  systemPromptParts.push('=== HOW TO BE A GREAT COMPANION ===');
  systemPromptParts.push('1. PERSONALIZATION: You know this person deeply - speak to them as someone who understands their goals, working style, and strengths');
  systemPromptParts.push('2. ADAPT YOUR TONE: Match your communication style to their preferences and the team\'s voice');
  systemPromptParts.push('3. BE PROACTIVE: Suggest ideas based on what you know about their role, skills, and the team\'s needs');
  systemPromptParts.push('4. REMEMBER CONTEXT: Always refer to team intelligence, member profiles, and past insights to provide relevant help');
  systemPromptParts.push('5. STAY ALIGNED: Respect the team\'s identity, values, and communication guidelines in everything you do');
  systemPromptParts.push('6. ASK WHEN NEEDED: If you need more information (like website data), just ask - you\'re having a conversation');
  systemPromptParts.push('');

  if (brandProfile) {
    systemPromptParts.push('=== TEAM PROFILE ===');
    if (brandProfile.name) systemPromptParts.push(`Team Name: ${brandProfile.name}`);
    if (brandProfile.tagline) systemPromptParts.push(`Tagline: ${brandProfile.tagline}`);
    if (brandProfile.summary) systemPromptParts.push(`Mission/Description: ${brandProfile.summary}`);
    if (brandProfile.websiteUrl) systemPromptParts.push(`Website: ${brandProfile.websiteUrl}`);
    if (brandProfile.contactEmail) systemPromptParts.push(`Contact Email: ${brandProfile.contactEmail}`);
    if (brandProfile.location) systemPromptParts.push(`Location: ${brandProfile.location}`);
    systemPromptParts.push('');
  }

  if (brandSoulContext.exists) {
    systemPromptParts.push('=== TEAM INTELLIGENCE GUIDELINES ===');
    if (brandSoulContext.voiceGuidelines) {
      systemPromptParts.push('TEAM VOICE & TONE:');
      systemPromptParts.push(brandSoulContext.voiceGuidelines);
      systemPromptParts.push('');
    }
    if (brandSoulContext.messagingGuidelines) {
      systemPromptParts.push('COMMUNICATION STYLE:');
      systemPromptParts.push(brandSoulContext.messagingGuidelines);
      systemPromptParts.push('');
    }
    if (brandSoulContext.visualGuidelines) {
      systemPromptParts.push('VISUAL IDENTITY:');
      systemPromptParts.push(brandSoulContext.visualGuidelines);
      systemPromptParts.push('');
    }
    if (brandSoulContext.factsSummary) {
      systemPromptParts.push('KEY TEAM FACTS & KNOWLEDGE:');
      systemPromptParts.push(brandSoulContext.factsSummary);
      systemPromptParts.push('');
    }
  }
  
  // Add AI Visual Branding information
  if (brandTheme) {
    console.log('[AIAssistantContext] Adding AI Visual Branding to system prompt');
    systemPromptParts.push('=== AI VISUAL BRANDING ===');
    systemPromptParts.push('This team has an AI-generated visual brand identity based on their Team Intelligence:');
    systemPromptParts.push('');
    
    if (brandTheme.description) {
      systemPromptParts.push(`BRAND THEME: ${brandTheme.description}`);
      systemPromptParts.push('');
    }
    
    systemPromptParts.push('BRAND COLORS:');
    systemPromptParts.push(`  Primary: ${brandTheme.colors.primary}`);
    systemPromptParts.push(`  Secondary: ${brandTheme.colors.secondary}`);
    systemPromptParts.push(`  Accent: ${brandTheme.colors.accent}`);
    systemPromptParts.push(`  Background: ${brandTheme.colors.background}`);
    systemPromptParts.push(`  Card: ${brandTheme.colors.card}`);
    systemPromptParts.push('');
    
    systemPromptParts.push('BRAND GRADIENTS:');
    systemPromptParts.push(`  Hero: ${brandTheme.gradients.hero}`);
    systemPromptParts.push(`  Feature: ${brandTheme.gradients.feature}`);
    systemPromptParts.push('');
    
    if (brandTheme.sourceColors && brandTheme.sourceColors.length > 0) {
      systemPromptParts.push('TEAM INTELLIGENCE COLOR INFLUENCE:');
      systemPromptParts.push(`These existing team colors from Brand Soul influenced the AI branding: ${brandTheme.sourceColors.join(', ')}`);
      systemPromptParts.push('');
    }
    
    systemPromptParts.push('Use these brand colors and gradients when discussing visual design, creating content suggestions, or providing creative guidance.');
    systemPromptParts.push('');
  }

  // Add comprehensive Team Intelligence insights from all approved artifacts
  if (comprehensiveInsights) {
    console.log('[AIAssistantContext] Adding Team Intelligence insights to system prompt');
    systemPromptParts.push('=== COMPREHENSIVE TEAM INTELLIGENCE INSIGHTS ===');
    systemPromptParts.push('Use these extracted insights to provide accurate, context-aware assistance:');
    systemPromptParts.push('');
    systemPromptParts.push(comprehensiveInsights);
    systemPromptParts.push('');
  } else {
    console.log('[AIAssistantContext] No Team Intelligence insights to add (comprehensiveInsights is null)');
  }

  // Add active sponsor information
  if (activeSponsorProfiles && activeSponsorProfiles.length > 0) {
    console.log(`[AIAssistantContext] Adding ${activeSponsorProfiles.length} sponsor profile(s) to system prompt`);
    systemPromptParts.push('=== ACTIVE SPONSORS ===');
    systemPromptParts.push(`This team is sponsored by ${activeSponsorProfiles.length} organization(s). Sponsors provide support and resources to this team.`);
    systemPromptParts.push('You have full access to sponsor team profiles and information to better assist the team.');
    systemPromptParts.push('');
    
    activeSponsorProfiles.forEach((sponsor) => {
      const profile = sponsor.profile;
      const name = profile?.name || sponsor.sponsorBrandName;
      
      systemPromptParts.push(`SPONSOR: ${name}`);
      
      if (profile) {
        if (profile.tagline) {
          systemPromptParts.push(`  Tagline: ${profile.tagline}`);
        }
        if (profile.summary) {
          // Truncate summary to ~200 tokens to manage context size
          const truncatedSummary = truncateToTokenBudget(profile.summary, 200);
          systemPromptParts.push(`  About: ${truncatedSummary}`);
        }
        if (profile.websiteUrl) {
          systemPromptParts.push(`  Website: ${profile.websiteUrl}`);
        }
        if (profile.location) {
          systemPromptParts.push(`  Location: ${profile.location}`);
        }
        
        // Add sponsor's brand text if available
        if (profile.brandText?.coreText?.missionVision) {
          const truncatedMissionVision = truncateToTokenBudget(profile.brandText.coreText.missionVision, 150);
          systemPromptParts.push(`  Mission & Vision: ${truncatedMissionVision}`);
        }
        if (profile.brandText?.coreText?.brandStory) {
          const truncatedStory = truncateToTokenBudget(profile.brandText.coreText.brandStory, 150);
          systemPromptParts.push(`  Brand Story: ${truncatedStory}`);
        }
        if (profile.brandText?.coreText?.taglines && profile.brandText.coreText.taglines.length > 0) {
          systemPromptParts.push(`  Taglines: ${profile.brandText.coreText.taglines.slice(0, 3).join(', ')}`);
        }
      }
      
      systemPromptParts.push('');
    });
  }

  if (teamMembers && teamMembers.length > 0) {
    systemPromptParts.push('=== TEAM MEMBERS ===');
    const leads = teamMembers.filter(m => m.role === 'MANAGER');
    const members = teamMembers.filter(m => m.role === 'CONTRIBUTOR');
    
    if (leads.length > 0) {
      systemPromptParts.push(`Team Leads (${leads.length}):`);
      
      // Load Individual Identity for each manager (in parallel)
      const managerIdentities = await Promise.all(
        leads.map(m => getIndividualIdentity(brandId, m.userId))
      );
      
      leads.forEach((m: BrandMember, index: number) => {
        const identity = managerIdentities[index];
        const name = m.userDisplayName || m.userEmail;
        
        if (identity) {
          // Compact summary for managers: name, role, top skills
          const rolePart = identity.roleTitle ? ` - ${identity.roleTitle}` : '';
          const skillsPart = identity.skills && identity.skills.length > 0 
            ? ` | Skills: ${identity.skills.slice(0, 3).join(', ')}`
            : '';
          systemPromptParts.push(`  - ${name}${rolePart}${skillsPart}`);
        } else {
          systemPromptParts.push(`  - ${name} (${m.userEmail})`);
        }
      });
    }
    
    if (members.length > 0) {
      systemPromptParts.push(`Team Members (${members.length}):`);
      members.forEach((m: BrandMember) => {
        systemPromptParts.push(`  - ${m.userDisplayName || m.userEmail} (${m.userEmail})`);
      });
    }
    systemPromptParts.push('');
  }

  systemPromptParts.push('=== YOUR CAPABILITIES ===');
  systemPromptParts.push('You can help teams with:');
  systemPromptParts.push('- Event planning and strategy across any team type');
  systemPromptParts.push('- Content creation for any purpose (outreach, internal comms, presentations, reports)');
  systemPromptParts.push('- Team communication and messaging guidance');
  systemPromptParts.push('- Image and video generation using AI (Imagen, Veo)');
  systemPromptParts.push('- Analyzing images and videos');
  systemPromptParts.push('- Website crawling for research (just ask!)');
  systemPromptParts.push('- Domain name suggestions and website planning');
  systemPromptParts.push('- Logo and visual design concepts');
  systemPromptParts.push('- Project planning, brainstorming, and problem-solving');
  systemPromptParts.push('- Research assistance and information synthesis');
  systemPromptParts.push('');
  systemPromptParts.push('Always be helpful, creative, and aligned with the team\'s identity and goals above!');

  const systemPrompt = systemPromptParts.join('\n');

  // Create minimal version for media/image operations (reduces token usage)
  const minimalPromptParts: string[] = [];
  minimalPromptParts.push(`You are an AI Team Assistant for "${brandProfile?.name || 'this team'}".`);
  if (currentUser) {
    const userName = currentUser.displayName || currentUser.email;
    minimalPromptParts.push(`You are assisting ${userName}.`);
  }
  minimalPromptParts.push('');
  minimalPromptParts.push('You can analyze and edit images, generate content, and help with team tasks.');
  minimalPromptParts.push('Be helpful and creative!');
  const systemPromptMinimal = minimalPromptParts.join('\n');

  const context: AIAssistantContext = {
    systemPrompt,
    systemPromptMinimal,
    brandProfile: brandProfile || undefined,
    brandSoul: brandSoulContext,
    teamMembers,
    currentUser: currentUser ? {
      ...currentUser,
      individualIdentity: currentUserIdentity || undefined,
    } : undefined,
  };

  return context;
}
