// Media Library - Create Media API
// Add new media to unified library

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { CreateMediaRequest } from '@/lib/types/media-library';

export async function POST(request: NextRequest) {
  try {
    const body: CreateMediaRequest = await request.json();
    const { brandId, type, url, title, ...metadata } = body;

    if (!brandId || !type || !url || !title) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: brandId, type, url, title' },
        { status: 400 }
      );
    }

    // Authentication & Authorization
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    // Create unified media document
    const mediaRef = adminDb.collection('unifiedMedia').doc();
    
    // Extract source before spreading metadata to avoid duplication
    const { source, tags, collections, ...otherMetadata } = metadata;
    
    const mediaData = {
      id: mediaRef.id,
      brandId,
      type,
      url,
      title,
      tags: tags || [],
      collections: collections || [],
      source,
      createdAt: new Date().toISOString(),
      createdBy: authenticatedUser.uid,
      ...otherMetadata,
    };

    await mediaRef.set(mediaData);

    // Update collection counts
    if (metadata.collections && metadata.collections.length > 0) {
      const batch = adminDb.batch();

      for (const collectionId of metadata.collections) {
        const collectionRef = adminDb.collection('mediaCollections').doc(collectionId);
        batch.update(collectionRef, {
          mediaCount: require('firebase-admin').firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();
    }

    // Index to Vertex AI Search (async, non-blocking)
    const pythonServiceUrl = process.env.MOMENTUM_PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
    fetch(`${pythonServiceUrl}/agent/media-index-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brandId,
        media_item: mediaData,
      }),
    }).catch(err => console.warn('[Media Create] Failed to index to Vertex AI (non-fatal):', err.message));

    return NextResponse.json({
      success: true,
      mediaId: mediaRef.id,
      message: 'Media added to library',
    });

  } catch (error) {
    console.error('[Media Create] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
