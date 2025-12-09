// Brand Soul - Synthesis Worker
// Combines insights from multiple artifacts into unified Brand Soul

import { ai } from '@/ai/genkit';
import { gemini20Flash } from '@genkit-ai/googleai';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import type { 
  BrandArtifact,
  ExtractedInsights,
  BrandSoul,
  VoiceProfile,
  FactLibrary,
  BrandFact,
  MessagingFramework,
  VisualIdentity,
  BrandSoulStats,
} from '@/lib/types/brand-soul';

/**
 * Synthesis Worker - Combines multiple artifact insights into unified Brand Soul
 */
export class SynthesisWorker {
  
  /**
   * Synthesize brand soul from all approved artifacts
   */
  async synthesizeBrandSoul(brandId: string, forceRebuild: boolean = false): Promise<string> {
    console.log(`[SynthesisWorker] Synthesizing Brand Soul for ${brandId}...`);
    
    try {
      const { adminDb } = getAdminInstances();
      
      // Check if brand soul already exists and is recent
      const existingSoulDoc = await adminDb.collection('brandSoul').doc(brandId).get();
      
      if (existingSoulDoc.exists && !forceRebuild) {
        const existingSoul = existingSoulDoc.data() as BrandSoul;
        const lastUpdated = new Date(existingSoul.lastUpdatedAt as string);
        const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
        
        // If updated within last 24 hours, skip rebuild
        if (hoursSinceUpdate < 24) {
          console.log('[SynthesisWorker] Brand Soul is recent, skipping rebuild');
          return existingSoul.latestVersionId;
        }
      }
      
      // Get all extracted (approved) artifacts for this brand
      const artifactsSnapshot = await adminDb
        .collection('brandArtifacts')
        .doc(brandId)
        .collection('sources')
        .where('status', '==', 'extracted')
        .get();
      
      if (artifactsSnapshot.empty) {
        console.log('[SynthesisWorker] No extracted artifacts found - deleting existing Brand Soul if present');
        
        // Delete existing Brand Soul document since there are no artifacts
        const existingSoulDoc = await adminDb.collection('brandSoul').doc(brandId).get();
        if (existingSoulDoc.exists) {
          await adminDb.collection('brandSoul').doc(brandId).delete();
          console.log('[SynthesisWorker] Deleted existing Brand Soul document');
        }
        
        throw new Error('No extracted artifacts found for synthesis');
      }
      
      const artifacts = artifactsSnapshot.docs.map((doc: any) => doc.data() as BrandArtifact);
      console.log(`[SynthesisWorker] Found ${artifacts.length} extracted artifacts`);
      
      // Load all insights from storage
      const allInsights: Array<{ artifact: BrandArtifact; insights: ExtractedInsights }> = [];
      
      for (const artifact of artifacts) {
        if (artifact.insightsRef) {
          const insights = await brandSoulStorage.getInsights(artifact.insightsRef.path);
          if (insights) {
            allInsights.push({ artifact, insights });
          }
        }
      }
      
      if (allInsights.length === 0) {
        throw new Error('No insights found to synthesize');
      }
      
      console.log(`[SynthesisWorker] Loaded ${allInsights.length} insight sets`);
      
      // Check if this is an update or new creation
      const isUpdate = existingSoulDoc.exists;
      const existingCreatedBy = isUpdate ? (existingSoulDoc.data() as BrandSoul).createdBy : undefined;
      const existingCreatedAt = isUpdate ? (existingSoulDoc.data() as BrandSoul).createdAt : undefined;
      
      // Aggregate insights using simple merging strategy
      // For Phase 1, we'll use a basic approach; Phase 2 will use AI synthesis
      const brandSoul = await this.aggregateInsights(brandId, allInsights, existingCreatedBy, existingCreatedAt);
      
      // Generate version ID
      const versionId = `v_${Date.now()}`;
      
      // Store brand soul
      await adminDb.collection('brandSoul').doc(brandId).set(brandSoul);
      
      // Store version
      await adminDb
        .collection('brandSoulVersions')
        .doc(brandId)
        .collection('versions')
        .doc(versionId)
        .set({
          ...brandSoul,
          versionId,
        });
      
      console.log(`[SynthesisWorker] Brand Soul synthesized successfully (version: ${versionId})`);
      return versionId;
      
    } catch (error) {
      console.error('[SynthesisWorker] Error synthesizing Brand Soul:', error);
      throw error;
    }
  }
  
  /**
   * Aggregate insights from multiple sources (basic merging for Phase 1)
   */
  private async aggregateInsights(
    brandId: string,
    allInsights: Array<{ artifact: BrandArtifact; insights: ExtractedInsights }>,
    existingCreatedBy?: string,
    existingCreatedAt?: any
  ): Promise<BrandSoul> {
    
    // Aggregate voice elements by aspect
    const voiceMap = new Map<string, string[]>();
    allInsights.forEach(({ insights }) => {
      insights.voiceElements.forEach(ve => {
        if (!voiceMap.has(ve.aspect)) {
          voiceMap.set(ve.aspect, []);
        }
        voiceMap.get(ve.aspect)!.push(ve.value);
      });
    });
    
    // Aggregate facts by category
    const factsByCategory = new Map<string, string[]>();
    allInsights.forEach(({ insights }) => {
      insights.facts.forEach(fact => {
        if (!factsByCategory.has(fact.category)) {
          factsByCategory.set(fact.category, []);
        }
        factsByCategory.get(fact.category)!.push(fact.fact);
      });
    });
    
    // Aggregate messages by theme
    const messagesByTheme = new Map<string, string[]>();
    allInsights.forEach(({ insights }) => {
      insights.messages.forEach(msg => {
        if (!messagesByTheme.has(msg.theme)) {
          messagesByTheme.set(msg.theme, []);
        }
        messagesByTheme.get(msg.theme)!.push(msg.message);
      });
    });
    
    // Aggregate visual elements
    const colorValues: string[] = [];
    const styleValues: string[] = [];
    const avoidValues: string[] = [];
    
    // Phase 1: Aggregate photographic and scene preferences
    const lightingPreferred: string[] = [];
    const lightingAvoid: string[] = [];
    const moodPreferred: string[] = [];
    const moodAvoid: string[] = [];
    const compositionPreferred: string[] = [];
    const lensPreferred: string[] = [];
    const framingPreferred: string[] = [];
    const depthOfFieldPreferred: string[] = [];
    const sceneData: Array<{ sceneType: string; sceneSubtype: string; frequency: number; context: string }> = [];
    
    allInsights.forEach(({ insights }) => {
      // Extract colors
      insights.visualElements
        .filter(ve => ve.type === 'color')
        .forEach(ve => colorValues.push(ve.value));
      
      // Extract style tags
      insights.visualElements
        .filter(ve => ve.type === 'style')
        .forEach(ve => styleValues.push(ve.value));
      
      // Extract avoid elements
      insights.visualElements
        .filter(ve => ve.type === 'avoid')
        .forEach(ve => avoidValues.push(ve.value));
      
      // Phase 1: Extract photographic preferences from insights
      insights.visualElements.forEach(ve => {
        if (ve.type === 'photographicPreference') {
          const pref = ve.value;
          
          // Lighting preferences
          if (pref.startsWith('lighting:preferred:')) {
            lightingPreferred.push(pref.replace('lighting:preferred:', ''));
          } else if (pref.startsWith('lighting:avoid:')) {
            lightingAvoid.push(pref.replace('lighting:avoid:', ''));
          }
          
          // Mood preferences
          else if (pref.startsWith('mood:preferred:')) {
            moodPreferred.push(pref.replace('mood:preferred:', ''));
          } else if (pref.startsWith('mood:avoid:')) {
            moodAvoid.push(pref.replace('mood:avoid:', ''));
          }
          
          // Composition preferences
          else if (pref.startsWith('composition:preferred:')) {
            compositionPreferred.push(pref.replace('composition:preferred:', ''));
          }
          
          // Shot preferences
          else if (pref.startsWith('lens:')) {
            lensPreferred.push(pref.replace('lens:', ''));
          } else if (pref.startsWith('framing:')) {
            framingPreferred.push(pref.replace('framing:', ''));
          } else if (pref.startsWith('depthOfField:')) {
            depthOfFieldPreferred.push(pref.replace('depthOfField:', ''));
          }
        }
        
        // Phase 1: Extract scene preferences
        if (ve.type === 'scenePreference') {
          try {
            const sceneInfo = JSON.parse(ve.value);
            sceneData.push(sceneInfo);
          } catch (e) {
            console.warn('[Synthesis] Failed to parse scene preference:', ve.value);
          }
        }
      });
    });
    
    // Build Voice Profile
    const voiceProfile: VoiceProfile = {
      tone: {
        primary: voiceMap.get('tone')?.[0] || 'professional',
        secondary: voiceMap.get('tone')?.slice(1) || [],
        avoid: [],
        examples: [],
        confidence: 75,
      },
      personality: {
        traits: (voiceMap.get('personality') || []).map(name => ({
          name,
          strength: 7,
          evidence: [],
        })),
      },
      writingStyle: {
        sentenceLength: 'varied',
        paragraphStructure: 'standard',
        punctuationStyle: 'standard',
        preferredPhrases: [],
        avoidedPhrases: [],
      },
      vocabulary: {
        preferredTerms: {},
        industryJargon: [],
        bannedWords: [],
        brandSpecificTerms: [],
      },
      formality: 5,
      enthusiasm: 5,
      expertise: 5,
    };
    
    // Build Fact Library
    const allFacts: BrandFact[] = [];
    Array.from(factsByCategory.entries()).forEach(([category, facts]) => {
      facts.forEach(fact => {
        allFacts.push({
          id: `fact_${Math.random().toString(36).substring(2, 11)}`,
          category,
          fact,
          sources: [],
          confidence: 80,
          importance: 5,
          lastVerified: new Date().toISOString(),
          tags: [],
          relatedFacts: [],
        });
      });
    });
    
    const factLibrary: FactLibrary = {
      facts: allFacts,
      categories: Array.from(factsByCategory.keys()),
      totalFacts: allFacts.length,
      lastUpdated: new Date().toISOString(),
    };
    
    // Build Messaging Framework
    const messagingFramework: MessagingFramework = {
      values: [],
      taglines: [],
      keyMessages: Array.from(messagesByTheme.entries()).map(([theme, messages]) => ({
        theme,
        messages,
        importance: 7,
        frequency: messages.length,
      })),
    };
    
    // Build Visual Identity with Phase 1 enhancements
    const visualIdentity: VisualIdentity | undefined = colorValues.length > 0 || styleValues.length > 0 ? {
      colors: {
        primary: colorValues.slice(0, 2),
        secondary: colorValues.slice(2, 4),
        accent: colorValues.slice(4),
        context: 'Extracted from brand materials',
      },
      typography: {
        fonts: [],
        style: 'standard',
      },
      imageStyle: {
        style: styleValues[0] || 'professional',  // Use extracted style or default
        subjects: [],
        examples: [],
        // Phase 1: Add photographic preferences if extracted
        ...(lightingPreferred.length > 0 || moodPreferred.length > 0 || compositionPreferred.length > 0 ? {
          photographicPreferences: {
            ...(lightingPreferred.length > 0 ? {
              lighting: {
                preferred: [...new Set(lightingPreferred)],  // Deduplicate
                avoid: [...new Set(lightingAvoid)],
                context: `Extracted from ${allInsights.length} source(s)`,
              }
            } : {}),
            ...(moodPreferred.length > 0 ? {
              mood: {
                preferred: [...new Set(moodPreferred)],
                avoid: [...new Set(moodAvoid)],
                context: `Extracted from ${allInsights.length} source(s)`,
              }
            } : {}),
            ...(compositionPreferred.length > 0 ? {
              composition: {
                preferred: [...new Set(compositionPreferred)],
                context: `Extracted from ${allInsights.length} source(s)`,
              }
            } : {}),
            ...(lensPreferred.length > 0 || framingPreferred.length > 0 || depthOfFieldPreferred.length > 0 ? {
              shotPreferences: {
                ...(lensPreferred.length > 0 ? { lens: [...new Set(lensPreferred)] } : {}),
                ...(framingPreferred.length > 0 ? { framing: [...new Set(framingPreferred)] } : {}),
                ...(depthOfFieldPreferred.length > 0 ? { depthOfField: [...new Set(depthOfFieldPreferred)] } : {}),
                context: `Extracted from ${allInsights.length} source(s)`,
              }
            } : {}),
          }
        } : {}),
        // Phase 1: Add scene preferences if extracted
        ...(sceneData.length > 0 ? {
          scenePreferences: {
            commonScenes: sceneData.slice(0, 5).map(scene => ({
              sceneType: scene.sceneType,
              sceneSubtype: scene.sceneSubtype,
              frequency: scene.frequency,
              examples: [],  // Examples will be populated from actual image analysis
              confidence: 75,  // Default confidence score
            })),
            context: `Analyzed ${sceneData.length} scene(s) from brand materials`,
          }
        } : {}),
        // Phase 1: Add avoid elements
        ...(avoidValues.length > 0 ? {
          avoid: [...new Set(avoidValues)],  // Deduplicate avoid elements
        } : {}),
      },
    } : undefined;
    
    // Build stats
    const stats: BrandSoulStats = {
      totalSources: allInsights.length,
      approvedSources: allInsights.length,
      pendingSources: 0,
      totalFacts: allFacts.length,
      confidenceScore: Math.round(
        allInsights.reduce((sum, { insights }) => sum + insights.confidence, 0) / allInsights.length
      ),
      lastSynthesisDate: new Date().toISOString(),
      healthScore: 85,
    };
    
    // Build brand soul
    const versionId = `v_${Date.now()}`;
    const now = new Date().toISOString();
    
    const brandSoul: any = {
      brandId,
      latestVersionId: versionId,
      status: 'published',
      voiceProfile,
      factLibrary,
      messagingFramework,
      // Preserve original createdBy/createdAt if this is an update, otherwise use 'system'
      createdAt: existingCreatedAt || now,
      createdBy: existingCreatedBy || 'system',
      lastUpdatedAt: now,
      lastPublishedAt: now,
      lastUpdatedBy: 'system',
      stats,
      config: {
        autoApprove: false,
        confidenceThreshold: 50,
        enableRAG: false,
        synthesisFrequency: 'manual',
        notifications: {
          onNewSource: false,
          onInsightsReady: false,
          onSynthesisComplete: false,
        },
      },
      // Clear resynthesis flag after successful synthesis
      needsResynthesis: false,
      resynthesisReason: null,
      lastInsightModification: null,
    };
    
    // Only add visualIdentity if it exists (Firestore doesn't allow undefined)
    if (visualIdentity) {
      brandSoul.visualIdentity = visualIdentity;
    }
    
    return brandSoul as BrandSoul;
  }
}

export const synthesisWorker = new SynthesisWorker();
