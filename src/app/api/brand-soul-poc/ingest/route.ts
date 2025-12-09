// Brand Soul POC - Manual Text Ingestion API
// SECURITY: Added authentication and brand access check

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul-poc/storage';
import { jobQueue } from '@/lib/brand-soul-poc/queue';
import { worker } from '@/lib/brand-soul-poc/worker';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { BrandArtifactPOC, IngestManualTextRequest, IngestManualTextResponse } from '@/lib/types/brand-soul-poc';

export async function POST(request: NextRequest) {
  try {
    const body: IngestManualTextRequest = await request.json();
    
    const { title, content, brandId } = body;
    
    // Validation
    if (!title || !content || !brandId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: title, content, brandId' },
        { status: 400 }
      );
    }
    
    // Verify user is authenticated and has access to this brand
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);
    
    if (content.length < 100) {
      return NextResponse.json(
        { success: false, message: 'Content too short (minimum 100 characters)' },
        { status: 400 }
      );
    }
    
    console.log('[Ingest API] Processing request:', { title, contentLength: content.length, brandId });
    
    // Generate artifact ID
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Store content in Firebase Storage (large content)
    const contentRef = await brandSoulStorage.storeContent(
      brandId,
      artifactId,
      content,
      'content'
    );
    
    // Create artifact metadata in Firestore (small metadata only)
    const artifact: BrandArtifactPOC = {
      id: artifactId,
      brandId,
      type: 'manual-text',
      status: 'pending',
      metadata: {
        title,
        wordCount: content.split(/\s+/).length,
        createdAt: new Date().toISOString(),
        createdBy: 'poc-user', // In real app, get from auth
      },
      contentRef,
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb.collection('brand_artifacts_poc').doc(artifactId).set(artifact);
    
    // Create processing job
    const jobId = await jobQueue.createJob(brandId, artifactId, 'extract-insights');
    
    // Start processing asynchronously (in background)
    // In production, this would be handled by Cloud Tasks/Run
    const createdJob = await jobQueue.getJob(jobId);
    if (createdJob) {
      worker.processJob(createdJob).catch(err => {
        console.error('[Ingest API] Background processing failed:', err);
      });
    }
    
    const response: IngestManualTextResponse = {
      success: true,
      artifactId,
      jobId,
      message: 'Content ingested successfully. Processing started.',
    };
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('[Ingest API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
