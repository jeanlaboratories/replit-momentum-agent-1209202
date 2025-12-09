// Media Library - Collections API
// Manage folders/albums for organizing media

import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';
import type { MediaCollection } from '@/lib/types/media-library';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json(
        { success: false, message: 'Missing brandId' },
        { status: 400 }
      );
    }

    // Authentication & Authorization
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const snapshot = await adminDb
      .collection('mediaCollections')
      .where('brandId', '==', brandId)
      .orderBy('name', 'asc')
      .get();

    const collections = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as MediaCollection));

    return NextResponse.json({
      success: true,
      collections,
    });

  } catch (error) {
    console.error('[Media Collections] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId, name, description, coverImageUrl, parentId } = body;

    if (!brandId || !name) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: brandId, name' },
        { status: 400 }
      );
    }

    // Authentication & Authorization
    const authenticatedUser = await getAuthenticatedUser();
    await requireBrandAccess(authenticatedUser.uid, brandId);

    const { adminDb } = getAdminInstances();
    
    const collectionRef = adminDb.collection('mediaCollections').doc();
    const collectionData: MediaCollection = {
      id: collectionRef.id,
      brandId,
      name,
      description,
      coverImageUrl,
      parentId,
      createdAt: new Date().toISOString(),
      createdBy: authenticatedUser.uid,
      mediaCount: 0,
    };

    await collectionRef.set(collectionData);

    return NextResponse.json({
      success: true,
      collectionId: collectionRef.id,
      message: 'Collection created',
    });

  } catch (error) {
    console.error('[Media Collections Create] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
