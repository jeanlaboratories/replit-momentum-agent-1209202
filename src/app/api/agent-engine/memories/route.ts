import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

const PYTHON_BACKEND_URL = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';

/**
 * POST /api/agent-engine/memories
 * Manages memories for both personal and team memory banks.
 *
 * Body params:
 * - action: 'list' | 'delete' | 'clear_all' | 'delete_by_artifact' | 'check_artifacts'
 * - type: 'personal' | 'team' (defaults to 'personal')
 * - brandId: string (required for team type)
 * - memory_id: string (required for delete action)
 * - full_name: string (optional, full Vertex AI resource name for delete)
 * - source_artifact_id: string (required for delete_by_artifact action)
 * - artifact_ids: string[] (required for check_artifacts action)
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    const body = await request.json();
    const { action, memory_id, full_name, type = 'personal', brandId } = body;

    // Validate team access
    if (type === 'team') {
      if (!brandId) {
        return NextResponse.json({ error: 'brandId is required for team memories' }, { status: 400 });
      }
      await requireBrandAccess(user.uid, brandId);
    }

    if (action === 'list') {
      const requestBody = type === 'team'
        ? { brand_id: brandId, type: 'team' }
        : { user_id: user.uid, type: 'personal' };

      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/memories/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      return NextResponse.json(data);
    } else if (action === 'delete') {
      if (!memory_id) {
        return NextResponse.json({ error: 'memory_id is required for delete action' }, { status: 400 });
      }

      const requestBody = type === 'team'
        ? { brand_id: brandId, memory_id, full_name, type: 'team' }
        : { user_id: user.uid, memory_id, full_name, type: 'personal' };

      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/memories/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      return NextResponse.json(data);
    } else if (action === 'clear_all') {
      const requestBody = type === 'team'
        ? { brand_id: brandId, type: 'team' }
        : { user_id: user.uid, type: 'personal' };

      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/clear-memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      return NextResponse.json(data);
    } else if (action === 'delete_by_artifact') {
      const { source_artifact_id } = body;
      if (!source_artifact_id) {
        return NextResponse.json({ error: 'source_artifact_id is required for delete_by_artifact action' }, { status: 400 });
      }

      const requestBody = type === 'team'
        ? { brand_id: brandId, source_artifact_id, type: 'team' }
        : { user_id: user.uid, source_artifact_id, type: 'personal' };

      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/memories/delete-by-artifact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      return NextResponse.json(data);
    } else if (action === 'check_artifacts') {
      const { artifact_ids } = body;
      if (!artifact_ids || !Array.isArray(artifact_ids)) {
        return NextResponse.json({ error: 'artifact_ids is required for check_artifacts action' }, { status: 400 });
      }

      const requestBody = type === 'team'
        ? { brand_id: brandId, artifact_ids, type: 'team' }
        : { user_id: user.uid, artifact_ids, type: 'personal' };

      const response = await fetch(`${PYTHON_BACKEND_URL}/agent/memories/check-artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[API /agent-engine/memories] Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
