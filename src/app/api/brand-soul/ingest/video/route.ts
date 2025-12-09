// Brand Soul - Video Upload & Ingestion API (Production)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { brandSoulStorage } from '@/lib/brand-soul/storage';
import { jobQueue } from '@/lib/brand-soul/queue';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { 
  BrandArtifact, 
  IngestResponse,
  ArtifactType,
} from '@/lib/types/brand-soul';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const brandId = formData.get('brandId') as string;
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
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
      'video/mp4',
      'video/quicktime', // MOV
      'video/x-quicktime', // Alternative MOV MIME
      'video/webm',
      'video/x-msvideo', // AVI
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unsupported file type. Allowed: MP4, MOV, WEBM, AVI' 
        },
        { status: 400 }
      );
    }
    
    // Validate file size (max 100MB for videos)
    const maxSizeBytes = 100 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Video too large. Maximum size: 100MB' 
        },
        { status: 400 }
      );
    }
    
    console.log('[Brand Soul Video] Processing video:', { 
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
    
    // Determine artifact type
    const artifactType: ArtifactType = 
      file.type === 'video/mp4' ? 'video-mp4' :
      file.type === 'video/quicktime' || file.type === 'video/x-quicktime' ? 'video-mov' :
      file.type === 'video/webm' ? 'video-webm' :
      'video';
    
    // Store video in Firebase Storage
    const documentRef = await brandSoulStorage.storeDocument(
      brandId,
      artifactId,
      fileBytes,
      file.name,
      file.type
    );
    
    // Parse tags
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    // Create artifact metadata in Firestore
    // New artifacts default to 'private' visibility - user must explicitly share to team
    const artifact: any = {
      id: artifactId,
      brandId,
      type: artifactType,
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
        description: description || 'Brand video for analysis',
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        language: 'visual', // Videos will have language extracted if applicable
        tags,
      },
      documentRef, // Video file reference for AI analysis
      createdAt: new Date().toISOString(),
      createdBy: userId,
      retryCount: 0,
      priority: 5,
    };
    
    const { adminDb } = getAdminInstances();
    await adminDb
      .collection('brandArtifacts')
      .doc(brandId)
      .collection('sources')
      .doc(artifactId)
      .set(artifact);
    
    console.log('[Brand Soul Video] Artifact created:', artifactId);
    
    // Queue for AI extraction (Gemini will extract metadata and analyze video)
    const jobId = await jobQueue.createJob(brandId, artifactId, 'extract-insights');
    
    console.log('[Brand Soul Video] Queued for AI extraction');
    
    const response: IngestResponse = {
      success: true,
      artifactId,
      message: 'Video uploaded and queued for AI analysis',
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[Brand Soul Video] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || 'Failed to process video' 
      },
      { status: 500 }
    );
  }
}
