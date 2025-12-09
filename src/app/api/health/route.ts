import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  console.log('[Health Check] Starting', {
    timestamp: new Date().toISOString()
  });

  const result: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    services: {},
    deployment: {
      isCloudRun: !!process.env.K_SERVICE,
      region: process.env.K_REGION,
      service: process.env.K_SERVICE
    }
  };

  let hasErrors = false;

  try {
    const { adminDb } = getAdminInstances();
    await adminDb.collection('brands').limit(1).get();
    result.services.firestore = { status: 'ok' };
    console.log('[Health Check] Firestore OK');
  } catch (error) {
    hasErrors = true;
    result.services.firestore = { status: 'error' };
    console.error('[Health Check] Firestore failed:', error);
  }

  result.status = hasErrors ? 'unhealthy' : 'healthy';

  console.log('[Health Check] Complete:', {
    status: result.status,
    duration: Date.now() - startTime + 'ms'
  });

  return NextResponse.json(result, {
    status: hasErrors ? 503 : 200
  });
}
