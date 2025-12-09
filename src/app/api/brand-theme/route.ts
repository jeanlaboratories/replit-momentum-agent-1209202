import { NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 });
    }

    const { adminDb } = getAdminInstances();
    const doc = await adminDb.collection('brandThemes').doc(brandId).get();

    if (!doc.exists) {
      return NextResponse.json({ theme: null });
    }

    return NextResponse.json({ theme: doc.data() });
  } catch (error: any) {
    console.error('[BrandTheme API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
