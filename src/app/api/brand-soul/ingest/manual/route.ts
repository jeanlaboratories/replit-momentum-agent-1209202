// Brand Soul - Manual Text Ingestion API (Production)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { 
  BrandArtifact, 
  IngestManualTextRequest, 
  IngestResponse 
} from '@/lib/types/brand-soul';

export async function POST(request: NextRequest) {
  try {
    const body: IngestManualTextRequest = await request.json();
    
    const { brandId, title, content, tags } = body;
    
    // Validation
    if (!brandId || !title || !content) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: brandId, title, content' 
        },
        { status: 400 }
      );
    }
    
    if (content.length < 100) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Content too short (minimum 100 characters)' 
        },
        { status: 400 }
      );
    }
    
    console.log('[Brand Soul Ingest] Processing manual text:', { 
      brandId, 
      title, 
      contentLength: content.length 
    });
    
    // Get authenticated user and verify brand access
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);
    const userId = authenticatedUser.uid;
    
    // Generate artifact ID
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Store content in Firebase Storage
    const contentRef = await brandSoulStorage.storeContent(
      brandId,
      artifactId,
      content,
      'source'
    );
    
    // Create artifact metadata in Firestore
    // New artifacts default to 'private' visibility - user must explicitly share to team
    const artifact: BrandArtifact = {
      id: artifactId,
      brandId,
      type: 'manual-text',
      source: {},
      status: 'pending',
      visibility: 'private',  // Default to private, user can share to team later
      metadata: {
        title,
        wordCount: content.split(/\s+/).length,
        language: 'en', // TODO: Auto-detect
        tags: tags || [],
      },
      contentRef,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      retryCount: 0,
      priority: 5, // Default priority
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .set(artifact);
    
    // Create processing job for AI extraction
    const jobId = await jobQueue.createJob(brandId, artifactId, 'extract-insights');
    
    // TODO: Trigger background worker
    // For Phase 0, jobs will be processed by polling worker
    
    const response: IngestResponse = {
      success: true,
      artifactId,
      jobId,
      message: 'Manual text ingested successfully. AI extraction queued.',
    };
    
    console.log('[Brand Soul Ingest] Success:', { artifactId, jobId });
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('[Brand Soul Ingest] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
