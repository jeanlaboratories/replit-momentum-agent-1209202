import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { getAdminInstances } from '@/lib/firebase/admin';
import { requireBrandAccess, getBrandMember } from '@/lib/brand-membership';
import { FieldValue } from 'firebase-admin/firestore';

const PYTHON_BACKEND_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

/**
 * POST /api/agent-engine
 * Creates a new Vertex AI Agent Engine for the authenticated user (personal) or brand (team).
 *
 * Body params:
 * - type: 'personal' | 'team' (defaults to 'personal' for backward compatibility)
 * - brandId: string (required for team type)
 */
export async function POST(request: Request) {
  console.log('[API /agent-engine POST] Received request.');
  try {
    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    // Parse request body
    let body: { type?: 'personal' | 'team'; brandId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine, defaults to personal
    }

    const memoryType = body.type || 'personal';
    const brandId = body.brandId;

    if (memoryType === 'team') {
      // Team memory engine creation
      if (!brandId) {
        return NextResponse.json({ success: false, error: 'brandId is required for team memory engine.' }, { status: 400 });
      }

      // Verify user has access to the brand and is a manager
      await requireBrandAccess(user.uid, brandId);
      const membership = await getBrandMember(brandId, user.uid);
      if (!membership || membership.role !== 'MANAGER') {
        return NextResponse.json({ success: false, error: 'Only managers can create team memory engines.' }, { status: 403 });
      }

      console.log(`[API /agent-engine POST] Creating team memory engine for brand: ${brandId}`);

      // Call the Python backend to create the engine
      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/create-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, type: 'team' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[API /agent-engine POST] Backend error:', errorData);
        return NextResponse.json({ success: false, error: errorData.error || 'Failed to create Team Memory Engine' }, { status: response.status });
      }

      const result = await response.json();
      const agent_engine_id = result.agent_engine_id;
      
      // Validate that we got an engine ID
      if (!agent_engine_id) {
        console.error('[API /agent-engine POST] Backend response missing agent_engine_id:', result);
        return NextResponse.json({ success: false, error: 'Backend returned success but no engine ID' }, { status: 500 });
      }
      
      console.log(`[API /agent-engine POST] Created Team Memory Engine with ID: ${agent_engine_id}`);

      // Save to brand document using set with merge to handle new/existing docs
      await adminDb.collection('brands').doc(brandId).set({
        teamAgentEngineId: agent_engine_id,
        teamAgentEngineCreatedAt: new Date().toISOString(),
        teamAgentEngineCreatedBy: user.uid,
      }, { merge: true });

      return NextResponse.json({ success: true, teamAgentEngineId: agent_engine_id });
    } else {
      // Personal memory engine creation (existing behavior)
      console.log(`[API /agent-engine POST] Creating personal memory engine for user: ${user.uid}`);

      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/create-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, type: 'personal' }),
      });

      console.log(`[API /agent-engine POST] Backend response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[API /agent-engine POST] Backend error:', errorData);
        return NextResponse.json({ success: false, error: errorData.error || 'Failed to create Agent Engine' }, { status: response.status });
      }

      const result = await response.json();
      const agent_engine_id = result.agent_engine_id;
      
      // Validate that we got an engine ID
      if (!agent_engine_id) {
        console.error('[API /agent-engine POST] Backend response missing agent_engine_id:', result);
        return NextResponse.json({ success: false, error: 'Backend returned success but no engine ID' }, { status: 500 });
      }
      
      console.log(`[API /agent-engine POST] Created Agent Engine with ID: ${agent_engine_id}`);

      // Save to user document using set with merge to handle new/existing docs
      try {
        await adminDb.collection('users').doc(user.uid).set({
          agentEngineId: agent_engine_id,
        }, { merge: true });
        console.log(`[API /agent-engine POST] Saved Agent Engine ID to user profile for user: ${user.uid}`);
      } catch (e) {
        console.warn('[API /agent-engine POST] Failed to save to Firestore from frontend, but backend should have handled it:', e);
      }

      return NextResponse.json({ success: true, agentEngineId: agent_engine_id });
    }
  } catch (error: any) {
    console.error('[API /agent-engine POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * DELETE /api/agent-engine
 * Deletes the authenticated user's Vertex AI Agent Engine (personal) or brand's (team).
 *
 * Body params:
 * - type: 'personal' | 'team' (defaults to 'personal' for backward compatibility)
 * - brandId: string (required for team type)
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const { adminDb } = getAdminInstances();

    // Parse request body
    let body: { type?: 'personal' | 'team'; brandId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine, defaults to personal
    }

    const memoryType = body.type || 'personal';
    const brandId = body.brandId;

    if (memoryType === 'team') {
      // Team memory engine deletion
      if (!brandId) {
        return NextResponse.json({ success: false, error: 'brandId is required for team memory engine deletion.' }, { status: 400 });
      }

      // Verify user has access to the brand and is a manager
      await requireBrandAccess(user.uid, brandId);
      const membership = await getBrandMember(brandId, user.uid);
      if (!membership || membership.role !== 'MANAGER') {
        return NextResponse.json({ success: false, error: 'Only managers can delete team memory engines.' }, { status: 403 });
      }

      // Get the brand's current team agent engine ID
      const brandDoc = await adminDb.collection('brands').doc(brandId).get();
      const teamAgentEngineId = brandDoc.data()?.teamAgentEngineId;

      if (!teamAgentEngineId) {
        return NextResponse.json({ success: false, error: 'No Team Memory Engine found for this brand.' }, { status: 404 });
      }

      // Call the Python backend to delete the engine
      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/delete-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, type: 'team' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json({ success: false, error: errorData.error || 'Failed to delete Team Memory Engine' }, { status: response.status });
      }

      // Remove the engine ID from the brand's profile using FieldValue.delete()
      await adminDb.collection('brands').doc(brandId).update({
        teamAgentEngineId: FieldValue.delete(),
        teamAgentEngineCreatedAt: FieldValue.delete(),
        teamAgentEngineCreatedBy: FieldValue.delete(),
      });

      return NextResponse.json({ success: true, message: 'Team Memory Engine deleted successfully.' });
    } else {
      // Personal memory engine deletion (existing behavior)
      const userDoc = await adminDb.collection('users').doc(user.uid).get();
      const agentEngineId = userDoc.data()?.agentEngineId;

      if (!agentEngineId) {
        return NextResponse.json({ success: false, error: 'No Agent Engine found for this user.' }, { status: 404 });
      }

      // Call the Python backend to delete the engine
      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/delete-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.uid, type: 'personal' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json({ success: false, error: errorData.error || 'Failed to delete Agent Engine' }, { status: response.status });
      }

      // Remove the engine ID from the user's profile using FieldValue.delete()
      await adminDb.collection('users').doc(user.uid).update({
        agentEngineId: FieldValue.delete(),
      });

      return NextResponse.json({ success: true, message: 'Agent Engine deleted successfully.' });
    }
  } catch (error: any) {
    console.error('[API /agent-engine DELETE] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
