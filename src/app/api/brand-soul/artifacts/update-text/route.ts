// Brand Soul - Update Text Content API
// Updates the text content of a manual-text artifact and triggers re-extraction

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import type { BrandArtifact } from '@/lib/types/brand-soul';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, artifactId, text } = body;

    if (!brandId || !artifactId || !text) {
      return NextResponse.json(
        { success: false, message: 'Brand ID, Artifact ID, and text are required' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.brandId !== brandId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: No access to this brand' },
        { status: 403 }
      );
    }

    console.log(`[Update Text API] Updating artifact ${artifactId} for brand ${brandId}...`);

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

    if (artifact.type !== 'manual-text') {
      return NextResponse.json(
        { success: false, message: 'Only manual-text artifacts can be edited' },
        { status: 400 }
      );
    }

    // Delete old insights from storage if they exist
    if (artifact.insightsRef) {
      try {
        await brandSoulStorage.deleteContent(artifact.insightsRef.path);
        console.log(`[Update Text API] Deleted old insights from storage`);
      } catch (error) {
        console.error('[Update Text API] Failed to delete old insights:', error);
      }
    }

    // Delete old content from storage if it exists (though we'll overwrite it anyway)
    if (artifact.contentRef) {
      try {
        await brandSoulStorage.deleteContent(artifact.contentRef.path);
        console.log(`[Update Text API] Deleted old content from storage`);
      } catch (error) {
        console.error('[Update Text API] Failed to delete old content:', error);
      }
    }

    // Store new text content to Firebase Storage
    const contentRef = await brandSoulStorage.storeContent(
      text,
      `text_${artifactId}.txt`,
      'text/plain'
    );

    console.log(`[Update Text API] Stored new text content:`, contentRef);

    // Update artifact in Firestore - reset to pending status and remove insights
    await artifactDoc.ref.update({
      contentRef,
      status: 'pending',
      insightsRef: null,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[Update Text API] Updated artifact to pending status`);

    // Delete the Brand Soul since insights have changed
    // The synthesis worker will regenerate it after extraction
    const brandSoulDoc = await adminDb.collection('brandSoul').doc(brandId).get();
    if (brandSoulDoc.exists) {
      await brandSoulDoc.ref.delete();
      console.log(`[Update Text API] Deleted Brand Soul for re-synthesis`);
    }

    // Create a new extraction job (match JobQueue format)
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const extractionJob = {
      id: jobId,
      type: 'extract-insights',
      status: 'pending',
      artifactId,
      brandId,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      progress: 0,
    };

    await adminDb.collection('brandSoulJobs').doc(jobId).set(extractionJob);
    console.log(`[Update Text API] Created new extraction job ${jobId}`);

    return NextResponse.json({
      success: true,
      message: 'Text updated successfully, re-extraction queued',
    });

  } catch (error) {
    console.error('[Update Text API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
