// Brand Soul - Get Extracted Insights API
// Returns extracted insights from artifacts for a specific brand
// Supports visibility filtering: 'team' (only team-visible), 'personal' (only my artifacts), 'all' (both)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess, getBrandMember } from '@/lib/brand-membership';
import type { BrandArtifact, ExtractedInsights, VoiceElement, ExtractedFact, KeyMessage, VisualElement, ArtifactVisibility } from '@/lib/types/brand-soul';

interface InsightItem {
  artifactId: string;
  artifactTitle: string | undefined;
  confidence: number;
  voiceElements: VoiceElement[];
  facts: ExtractedFact[];
  messages: KeyMessage[];
  visualElements: VisualElement[];
  // Visibility metadata
  visibility: ArtifactVisibility;
  createdBy: string;
  isOwner: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    // 'team' = only team-visible, 'personal' = only my artifacts, 'all' = both (default for managers)
    const visibilityFilter = searchParams.get('visibility') || 'all';

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Brand ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and has access to this brand
    const user = await getAuthenticatedUser();
    const member = await requireBrandAccess(user.uid, brandId);
    const isManager = member.role === 'MANAGER';

    const { adminDb } = getAdminInstances();

    // Query all extracted artifacts
    const artifactsSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .where('status', '==', 'extracted')
      .limit(100)
      .get();

    const insights: InsightItem[] = [];

    for (const doc of artifactsSnapshot.docs) {
      const artifact = doc.data() as BrandArtifact;

      // Apply visibility filtering
      const visibility = artifact.visibility || 'team'; // Default to 'team' for backwards compatibility
      const isOwner = artifact.createdBy === user.uid;

      // Visibility rules:
      // - 'team' artifacts: visible to everyone
      // - 'pending_approval' artifacts: visible to owner and managers
      // - 'private' artifacts: visible only to owner
      let shouldInclude = false;

      if (visibilityFilter === 'team') {
        // Only show team-visible artifacts
        shouldInclude = visibility === 'team';
      } else if (visibilityFilter === 'personal') {
        // Only show artifacts owned by current user
        shouldInclude = isOwner;
      } else {
        // 'all' filter - apply normal visibility rules
        if (visibility === 'team') {
          shouldInclude = true;
        } else if (visibility === 'pending_approval') {
          shouldInclude = isOwner || isManager;
        } else if (visibility === 'private') {
          shouldInclude = isOwner;
        }
      }

      if (!shouldInclude) {
        continue;
      }

      if (artifact.insightsRef) {
        const insightsContent = await brandSoulStorage.getContent(artifact.insightsRef.path);
        if (insightsContent) {
          try {
            const parsedInsights: ExtractedInsights = JSON.parse(insightsContent);

            insights.push({
              artifactId: artifact.id,
              artifactTitle: artifact.metadata.title,
              confidence: parsedInsights.confidence,
              voiceElements: parsedInsights.voiceElements,
              facts: parsedInsights.facts,
              messages: parsedInsights.messages,
              visualElements: parsedInsights.visualElements,
              visibility,
              createdBy: artifact.createdBy,
              isOwner,
            });
          } catch (parseError) {
            console.error(`[Insights API] Failed to parse insights for ${artifact.id}:`, parseError);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      insights,
      count: insights.length,
      isManager,
    });

  } catch (error) {
    console.error('[Insights API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
