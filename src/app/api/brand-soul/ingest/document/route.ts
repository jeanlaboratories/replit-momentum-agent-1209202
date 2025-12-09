// Brand Soul - Document Upload & Ingestion API (Production)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { 
  BrandArtifact, 
  IngestResponse,
  ContentReference,
} from '@/lib/types/brand-soul';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const brandId = formData.get('brandId') as string;
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const tagsStr = formData.get('tags') as string;
    
    // Validation
    if (!brandId || !file) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: brandId, file' 
        },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/msword', // DOC
      'text/plain',
      'text/markdown',
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unsupported file type. Allowed: PDF, DOCX, DOC, TXT, MD' 
        },
        { status: 400 }
      );
    }
    
    // Validate file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'File too large. Maximum size: 10MB' 
        },
        { status: 400 }
      );
    }
    
    console.log('[Brand Soul Document] Processing document:', { 
      brandId, 
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });
    
    // Get authenticated user and verify brand access
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);
    const userId = authenticatedUser.uid;
    
    // Generate artifact ID
    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = Buffer.from(fileBuffer);
    
    // Store original document in Firebase Storage
    const documentRef = await brandSoulStorage.storeDocument(
      brandId,
      artifactId,
      fileBytes,
      file.name,
      file.type
    );
    
    // For text files, extract immediately. For binary files, extraction happens in background worker
    let contentRef: ContentReference | undefined;
    
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      // Text files - extract and store immediately
      const textContent = new TextDecoder().decode(fileBytes);
      
      contentRef = await brandSoulStorage.storeContent(
        brandId,
        artifactId,
        textContent,
        'source'
      );
      
      console.log(`[Brand Soul Document] Stored text file (${textContent.length} characters)`);
    } else {
      // Binary files (PDF, DOCX, DOC) - extraction will happen in background worker
      // Worker will use documentRef to extract via Firecrawl
      console.log(`[Brand Soul Document] Binary file stored, extraction queued for background worker`);
    }
    
    // Parse tags
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    // Create artifact metadata in Firestore
    // Note: Only include contentRef if it's defined (text files)
    // Binary files (PDF, DOCX) will have content extracted in background worker
    // New artifacts default to 'private' visibility - user must explicitly share to team
    const artifact: any = {
      id: artifactId,
      brandId,
      type: 'document',
      source: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
      status: 'pending',
      visibility: 'private',  // Default to private, user can share to team later
      metadata: {
        title: title || file.name,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        language: 'en', // TODO: Auto-detect
        tags,
      },
      documentRef,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      retryCount: 0,
      priority: 5,
    };
    
    // Only add contentRef if it's defined (Firestore doesn't allow undefined values)
    if (contentRef) {
      artifact.contentRef = contentRef;
    }
    
    const { adminDb } = getAdminInstances();
    await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .set(artifact);
    
    // Create processing job for AI extraction
    const jobId = await jobQueue.createJob(brandId, artifactId, 'extract-insights');
    
    const response: IngestResponse = {
      success: true,
      artifactId,
      jobId,
      message: `Document uploaded successfully. AI extraction queued.`,
    };
    
    console.log('[Brand Soul Document] Success:', { artifactId, jobId });
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('[Brand Soul Document] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
