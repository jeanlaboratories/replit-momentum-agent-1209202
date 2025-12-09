// Brand Soul - Delete Artifact API
// Deletes an artifact and all associated data (insights, storage files, jobs)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandRole } from '@/lib/brand-membership';
import type { BrandArtifact } from '@/lib/types/brand-soul';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    const artifactId = searchParams.get('artifactId');

    if (!brandId || !artifactId) {
      return NextResponse.json(
        { success: false, message: 'Brand ID and Artifact ID are required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated and has MANAGER role (only managers can delete)
    const user = await getAuthenticatedUser();
    await requireBrandRole(user.uid, brandId, 'MANAGER');

    console.log(`[Delete Artifact API] Deleting artifact ${artifactId} from brand ${brandId} by manager ${user.uid}...`);

    const { adminDb } = getAdminInstances();

    // Get artifact data first
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

    // Delete insights from storage if they exist
    if (artifact.insightsRef) {
      try {
        await brandSoulStorage.deleteContent(artifact.insightsRef.path);
        console.log(`[Delete Artifact API] Deleted insights from storage`);
      } catch (error) {
        console.error('[Delete Artifact API] Failed to delete insights from storage:', error);
      }
    }

    // Delete content from storage if it exists
    if (artifact.contentRef) {
      try {
        await brandSoulStorage.deleteContent(artifact.contentRef.path);
        console.log(`[Delete Artifact API] Deleted content from storage`);
      } catch (error) {
        console.error('[Delete Artifact API] Failed to delete content from storage:', error);
      }
    }

    // Delete any pending jobs related to this artifact
    try {
      const jobsSnapshot = await adminDb
        .collection('brandSoulJobs')
        .where('artifactId', '==', artifactId)
        .where('status', '==', 'pending')
        .get();

      const deletePromises = jobsSnapshot.docs.map((doc: any) => doc.ref.delete());
      await Promise.all(deletePromises);
      
      if (jobsSnapshot.size > 0) {
        console.log(`[Delete Artifact API] Deleted ${jobsSnapshot.size} pending job(s)`);
      }
    } catch (error) {
      console.error('[Delete Artifact API] Failed to delete jobs:', error);
    }

    // Delete the artifact from Firestore
    await artifactDoc.ref.delete();
    console.log(`[Delete Artifact API] Artifact deleted successfully`);

    // Remove artifact from brand profile galleries
    try {
      const { removeArtifactFromProfile } = await import('@/lib/brand-soul/sync-to-profile');
      await removeArtifactFromProfile(brandId, artifactId);
      console.log(`[Delete Artifact API] Removed artifact from brand profile`);
    } catch (syncError) {
      console.error('[Delete Artifact API] Failed to remove from brand profile (non-fatal):', syncError);
      // Continue - sync failure shouldn't fail the whole deletion
    }

    // Check if this was the last artifact - if so, delete the Brand Soul
    const remainingArtifactsSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .limit(1)
      .get();

    if (remainingArtifactsSnapshot.empty) {
      console.log(`[Delete Artifact API] No remaining artifacts - deleting Brand Soul`);
      
      // Delete the Brand Soul document
      const brandSoulDoc = await adminDb.collection('brandSoul').doc(brandId).get();
      if (brandSoulDoc.exists) {
        await brandSoulDoc.ref.delete();
        console.log(`[Delete Artifact API] Brand Soul deleted`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Artifact deleted successfully',
    });

  } catch (error) {
    console.error('[Delete Artifact API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
