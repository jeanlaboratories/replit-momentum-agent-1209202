import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({
        success: false,
        error: 'Brand ID is required'
      }, { status: 400 });
    }

    const { adminDb } = getAdminInstances();
    const brandRef = adminDb.collection('brands').doc(brandId);
    const brandDoc = await brandRef.get();

    if (!brandDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Brand not found'
      }, { status: 404 });
    }

    const brandData = brandDoc.data();
    const documents = brandData?.profile?.documents || [];

    // Transform documents to include GCS URIs for RAG processing
    const documentsWithGcsUri = documents.map((doc: any) => {
      const bucketName = process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const gcsUri = bucketName ? `gs://${bucketName}/brand_assets/${brandId}/documents/${doc.name}` : null;
      
      return {
        id: doc.id,
        name: doc.name,
        url: doc.url,
        type: doc.type,
        gcsUri
      };
    });

    return NextResponse.json({
      success: true,
      documents: documentsWithGcsUri
    });

  } catch (error) {
    console.error('Error fetching brand documents:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch documents'
    }, { status: 500 });
  }
}