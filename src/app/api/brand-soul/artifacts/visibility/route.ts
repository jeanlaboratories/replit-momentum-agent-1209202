// Brand Soul - Artifact Visibility Management API
// Handles visibility changes: private -> pending_approval -> team
// Also handles manager approval/rejection workflow

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess, requireBrandRole } from '@/lib/brand-membership';
import type { ArtifactVisibility } from '@/lib/types/brand-soul';

interface VisibilityUpdateRequest {
  brandId: string;
  artifactId: string;
  action: 'propose_for_team' | 'approve' | 'reject' | 'make_private';
  rejectionReason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VisibilityUpdateRequest = await request.json();
    const { brandId, artifactId, action, rejectionReason } = body;

    // Validation
    if (!brandId || !artifactId || !action) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: brandId, artifactId, action' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    const member = await requireBrandAccess(user.uid, brandId);
    const isManager = member.role === 'MANAGER';

    const { adminDb } = getAdminInstances();
    const artifactRef = adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId);

    const artifactDoc = await artifactRef.get();
    if (!artifactDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Artifact not found' },
        { status: 404 }
      );
    }

    const artifact = artifactDoc.data()!;
    const isOwner = artifact.createdBy === user.uid;
    const now = new Date().toISOString();

    let updateData: Record<string, any> = {};
    let newVisibility: ArtifactVisibility;

    switch (action) {
      case 'propose_for_team':
        // Anyone can propose their own artifact for team visibility
        if (!isOwner) {
          return NextResponse.json(
            { success: false, message: 'Only the artifact owner can propose for team visibility' },
            { status: 403 }
          );
        }

        // Can only propose if currently private
        if (artifact.visibility !== 'private') {
          return NextResponse.json(
            { success: false, message: 'Artifact must be private to propose for team approval' },
            { status: 400 }
          );
        }

        newVisibility = 'pending_approval';
        updateData = {
          visibility: newVisibility,
          proposedForTeamAt: now,
          proposedForTeamBy: user.uid,
          // Clear any previous rejection
          visibilityRejectedAt: null,
          visibilityRejectionReason: null,
        };
        break;

      case 'approve':
        // Only managers can approve
        if (!isManager) {
          return NextResponse.json(
            { success: false, message: 'Only managers can approve team visibility' },
            { status: 403 }
          );
        }

        // Can only approve if pending
        if (artifact.visibility !== 'pending_approval') {
          return NextResponse.json(
            { success: false, message: 'Artifact must be pending approval to approve' },
            { status: 400 }
          );
        }

        newVisibility = 'team';
        updateData = {
          visibility: newVisibility,
          visibilityApprovedAt: now,
          visibilityApprovedBy: user.uid,
        };
        break;

      case 'reject':
        // Only managers can reject
        if (!isManager) {
          return NextResponse.json(
            { success: false, message: 'Only managers can reject team visibility requests' },
            { status: 403 }
          );
        }

        // Can only reject if pending
        if (artifact.visibility !== 'pending_approval') {
          return NextResponse.json(
            { success: false, message: 'Artifact must be pending approval to reject' },
            { status: 400 }
          );
        }

        newVisibility = 'private';
        updateData = {
          visibility: newVisibility,
          visibilityRejectedAt: now,
          visibilityRejectionReason: rejectionReason || 'No reason provided',
          // Clear approval timestamps
          proposedForTeamAt: null,
          proposedForTeamBy: null,
        };
        break;

      case 'make_private':
        // Owner can make their own artifact private
        // Manager can make any team artifact private
        if (!isOwner && !isManager) {
          return NextResponse.json(
            { success: false, message: 'Only the owner or a manager can make this artifact private' },
            { status: 403 }
          );
        }

        // Can make private from team or pending_approval
        if (artifact.visibility === 'private') {
          return NextResponse.json(
            { success: false, message: 'Artifact is already private' },
            { status: 400 }
          );
        }

        newVisibility = 'private';
        updateData = {
          visibility: newVisibility,
          // Clear all visibility workflow fields
          proposedForTeamAt: null,
          proposedForTeamBy: null,
          visibilityApprovedAt: null,
          visibilityApprovedBy: null,
          visibilityRejectedAt: null,
          visibilityRejectionReason: null,
        };
        break;

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action. Must be: propose_for_team, approve, reject, or make_private' },
          { status: 400 }
        );
    }

    // Perform the update
    await artifactRef.update(updateData);

    console.log(`[Visibility API] Updated artifact ${artifactId} visibility: ${action} -> ${newVisibility}`);

    return NextResponse.json({
      success: true,
      message: `Artifact visibility updated: ${newVisibility}`,
      visibility: newVisibility,
      action,
    });

  } catch (error) {
    console.error('[Visibility API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to list artifacts pending approval (for managers)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Brand ID is required' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    const member = await requireBrandAccess(user.uid, brandId);
    const isManager = member.role === 'MANAGER';

    if (!isManager) {
      return NextResponse.json(
        { success: false, message: 'Only managers can view pending approvals' },
        { status: 403 }
      );
    }

    const { adminDb } = getAdminInstances();

    // Query all pending_approval artifacts
    const pendingSnapshot = await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .where('visibility', '==', 'pending_approval')
      .limit(50)
      .get();

    const pendingArtifacts = pendingSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: data.id,
        title: data.metadata?.title || 'Untitled',
        type: data.type,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        proposedForTeamAt: data.proposedForTeamAt,
        proposedForTeamBy: data.proposedForTeamBy,
      };
    });

    return NextResponse.json({
      success: true,
      pendingArtifacts,
      count: pendingArtifacts.length,
    });

  } catch (error) {
    console.error('[Visibility API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
