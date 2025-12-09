// Brand Soul - Update Insights API
// Allows editing/deleting individual insight elements for an artifact

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandRole } from '@/lib/brand-membership';
import type { BrandArtifact, ExtractedInsights, VoiceElement, ExtractedFact, KeyMessage, VisualElement } from '@/lib/types/brand-soul';

type ElementType = 'voiceElements' | 'facts' | 'messages' | 'visualElements';
type ActionType = 'update' | 'delete';

interface UpdateInsightRequest {
  brandId: string;
  artifactId: string;
  elementType: ElementType;
  elementIndex: number;
  action: ActionType;
  updatedElement?: VoiceElement | ExtractedFact | KeyMessage | VisualElement;
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateInsightRequest = await request.json();
    const { brandId, artifactId, elementType, elementIndex, action, updatedElement } = body;

    // Validate required fields
    if (!brandId || !artifactId || !elementType || elementIndex === undefined || !action) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: brandId, artifactId, elementType, elementIndex, action' },
        { status: 400 }
      );
    }

    // Validate element type
    const validTypes: ElementType[] = ['voiceElements', 'facts', 'messages', 'visualElements'];
    if (!validTypes.includes(elementType)) {
      return NextResponse.json(
        { success: false, message: `Invalid elementType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate action
    if (action !== 'update' && action !== 'delete') {
      return NextResponse.json(
        { success: false, message: 'Invalid action. Must be "update" or "delete"' },
        { status: 400 }
      );
    }

    // For update action, require the updated element
    if (action === 'update' && !updatedElement) {
      return NextResponse.json(
        { success: false, message: 'updatedElement is required for update action' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and has MANAGER role
    const user = await getAuthenticatedUser();
    await requireBrandRole(user.uid, brandId, 'MANAGER');

    const { adminDb } = getAdminInstances();

    // Get the artifact to find the insights path
    const artifactDoc = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .get();

    if (!artifactDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Artifact not found' },
        { status: 404 }
      );
    }

    const artifact = artifactDoc.data() as BrandArtifact;

    if (!artifact.insightsRef?.path) {
      return NextResponse.json(
        { success: false, message: 'Artifact has no extracted insights' },
        { status: 400 }
      );
    }

    // Load current insights
    const insights = await brandSoulStorage.getInsights(artifact.insightsRef.path);
    if (!insights) {
      return NextResponse.json(
        { success: false, message: 'Failed to load insights' },
        { status: 500 }
      );
    }

    // Validate element index
    const elementsArray = insights[elementType];
    if (elementIndex < 0 || elementIndex >= elementsArray.length) {
      return NextResponse.json(
        { success: false, message: `Invalid elementIndex. Array has ${elementsArray.length} elements` },
        { status: 400 }
      );
    }

    // Perform the action
    if (action === 'delete') {
      // Remove the element at the specified index
      elementsArray.splice(elementIndex, 1);
    } else if (action === 'update') {
      // Replace the element at the specified index
      elementsArray[elementIndex] = updatedElement as any;
    }

    // Mark insights as modified
    const modifiedInsights: ExtractedInsights = {
      ...insights,
      [elementType]: elementsArray,
      // Add modification tracking
      modifiedAt: new Date().toISOString(),
      modifiedBy: user.uid,
    };

    // Save updated insights back to storage
    const newInsightsRef = await brandSoulStorage.storeInsights(brandId, artifactId, modifiedInsights);

    // Update artifact's insightsRef
    await artifactDoc.ref.update({
      insightsRef: newInsightsRef,
      'metadata.lastModifiedAt': new Date().toISOString(),
      'metadata.lastModifiedBy': user.uid,
      'metadata.insightsModified': true,
    });

    // Mark Brand Soul as needing resynthesis by setting a flag
    const brandSoulRef = adminDb.collection('brandSoul').doc(brandId);
    const brandSoulDoc = await brandSoulRef.get();

    if (brandSoulDoc.exists) {
      await brandSoulRef.update({
        needsResynthesis: true,
        resynthesisReason: `Insights modified for artifact: ${artifact.metadata.title || artifactId}`,
        lastInsightModification: new Date().toISOString(),
      });
    }

    console.log(`[Insights Update API] ${action}d ${elementType}[${elementIndex}] for artifact ${artifactId}`);

    return NextResponse.json({
      success: true,
      message: `Successfully ${action}d ${elementType} element`,
      action,
      elementType,
      elementIndex,
      needsResynthesis: true,
    });

  } catch (error) {
    console.error('[Insights Update API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
