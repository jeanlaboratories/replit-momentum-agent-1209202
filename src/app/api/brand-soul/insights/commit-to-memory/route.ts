// Brand Soul - Commit Insights to Memory Bank API
// Commits extracted insights as memories to either Personal or Team memory bank

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess, getBrandMember } from '@/lib/brand-membership';
import type { ExtractedInsights } from '@/lib/types/brand-soul';

const PYTHON_BACKEND_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

interface CommitRequest {
  brandId: string;
  artifactId?: string; // If provided, commit only this artifact's insights
  targetMemoryType: 'personal' | 'team';
  elementTypes?: ('voiceElements' | 'facts' | 'messages' | 'visualElements')[]; // If provided, only commit these types
}

interface MemoryWithMetadata {
  content: string;
  sourceArtifactId: string;
  sourceArtifactTitle: string;
  sourceBrandId: string;
  insightElementType: string;
}

function formatInsightAsMemory(type: string, element: any): string {
  switch (type) {
    case 'voiceElements':
      return `Brand voice: ${element.aspect} is "${element.value}"`;
    case 'facts':
      return `Brand fact: ${element.fact} (Category: ${element.category || 'general'})`;
    case 'messages':
      return `Core message: ${element.message} (Theme: ${element.theme})`;
    case 'visualElements':
      return `Visual guideline: ${element.type} - ${element.value}${element.context ? ` (${element.context})` : ''}`;
    default:
      return JSON.stringify(element);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CommitRequest = await request.json();
    const { brandId, artifactId, targetMemoryType, elementTypes } = body;

    // Validation
    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'brandId is required' },
        { status: 400 }
      );
    }

    if (!targetMemoryType || !['personal', 'team'].includes(targetMemoryType)) {
      return NextResponse.json(
        { success: false, message: 'targetMemoryType must be "personal" or "team"' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Check if target memory bank exists
    let memoryEngineId: string | null = null;

    if (targetMemoryType === 'team') {
      // Check if team has a memory engine
      const brandDoc = await adminDb.collection('brands').doc(brandId).get();
      memoryEngineId = brandDoc.data()?.teamAgentEngineId;

      if (!memoryEngineId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Team Memory Bank not created. Please create it first in Settings > Memory.',
            code: 'NO_TEAM_MEMORY_BANK'
          },
          { status: 400 }
        );
      }
    } else {
      // Check if user has a personal memory engine
      const userDoc = await adminDb.collection('users').doc(user.uid).get();
      memoryEngineId = userDoc.data()?.agentEngineId;

      if (!memoryEngineId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Personal Memory Bank not created. Please create it first in Settings > Memory.',
            code: 'NO_PERSONAL_MEMORY_BANK'
          },
          { status: 400 }
        );
      }
    }

    // Build query for artifacts
    let query = adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .where('status', '==', 'extracted');

    // If specific artifact requested, filter to just that one
    const artifactsSnapshot = artifactId
      ? await adminDb
          .collection('brandArtifacts')
          .doc(brandId)
          .collection('sources')
          .doc(artifactId)
          .get()
      : await query.limit(100).get();

    // Collect all memories to commit with source metadata
    const memoriesToCommit: MemoryWithMetadata[] = [];
    const processedArtifacts: string[] = [];

    // Helper to process an artifact's insights
    const processArtifactInsights = async (
      artifact: FirebaseFirestore.DocumentData,
      docId: string
    ) => {
      if (!artifact.insightsRef) return;

      const insightsContent = await brandSoulStorage.getContent(artifact.insightsRef.path);
      if (!insightsContent) return;

      try {
        const insights: ExtractedInsights = JSON.parse(insightsContent);
        const typesToProcess = elementTypes || ['voiceElements', 'facts', 'messages', 'visualElements'];
        const artifactTitle = artifact.metadata?.title || docId;

        for (const type of typesToProcess) {
          const elements = insights[type as keyof ExtractedInsights];
          if (Array.isArray(elements)) {
            for (const element of elements) {
              memoriesToCommit.push({
                content: formatInsightAsMemory(type, element),
                sourceArtifactId: docId,
                sourceArtifactTitle: artifactTitle,
                sourceBrandId: brandId,
                insightElementType: type,
              });
            }
          }
        }
        processedArtifacts.push(artifactTitle);
      } catch (e) {
        console.error(`Failed to parse insights for ${docId}:`, e);
      }
    };

    if (artifactId) {
      // Single artifact
      const doc = artifactsSnapshot as FirebaseFirestore.DocumentSnapshot;
      if (doc.exists) {
        await processArtifactInsights(doc.data()!, artifactId);
      }
    } else {
      // Multiple artifacts
      const snapshot = artifactsSnapshot as FirebaseFirestore.QuerySnapshot;
      for (const doc of snapshot.docs) {
        const artifact = doc.data();

        // Apply visibility rules - only commit artifacts the user can see
        const visibility = artifact.visibility || 'team';
        const isOwner = artifact.createdBy === user.uid;
        const membership = await getBrandMember(brandId, user.uid);
        const isManager = membership?.role === 'MANAGER';

        let canAccess = false;
        if (visibility === 'team') canAccess = true;
        else if (visibility === 'pending_approval') canAccess = isOwner || isManager;
        else if (visibility === 'private') canAccess = isOwner;

        if (!canAccess) continue;

        await processArtifactInsights(artifact, doc.id);
      }
    }

    if (memoriesToCommit.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No insights to commit',
        memoriesCommitted: 0,
      });
    }

    // Commit memories to the memory bank via Python backend
    const commitPayload = targetMemoryType === 'team'
      ? { brand_id: brandId, type: 'team', memories: memoriesToCommit }
      : { user_id: user.uid, type: 'personal', memories: memoriesToCommit };

    const response = await fetch(`${PYTHON_BACKEND_URL}/agent/memories/bulk-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commitPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Commit Insights] Backend error:', errorData);
      return NextResponse.json(
        { success: false, message: errorData.detail || 'Failed to commit memories to bank' },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log(`[Commit Insights] Committed ${memoriesToCommit.length} memories to ${targetMemoryType} bank`);

    return NextResponse.json({
      success: true,
      message: `Successfully committed ${memoriesToCommit.length} insights to ${targetMemoryType === 'team' ? 'Team' : 'Personal'} Memory Bank`,
      memoriesCommitted: memoriesToCommit.length,
      artifactsProcessed: processedArtifacts,
    });

  } catch (error) {
    console.error('[Commit Insights API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check memory bank status for insights page
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'brandId is required' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);

    const { adminDb } = getAdminInstances();

    // Check team memory bank
    const brandDoc = await adminDb.collection('brands').doc(brandId).get();
    const teamAgentEngineId = brandDoc.data()?.teamAgentEngineId;

    // Check personal memory bank
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const personalAgentEngineId = userDoc.data()?.agentEngineId;

    // Get user's role
    const membership = await getBrandMember(brandId, user.uid);
    const isManager = membership?.role === 'MANAGER';

    return NextResponse.json({
      success: true,
      hasTeamMemoryBank: !!teamAgentEngineId,
      hasPersonalMemoryBank: !!personalAgentEngineId,
      isManager,
    });

  } catch (error) {
    console.error('[Commit Insights API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
