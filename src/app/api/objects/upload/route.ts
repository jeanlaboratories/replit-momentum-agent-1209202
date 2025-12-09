import { NextRequest, NextResponse } from 'next/server';
import { ObjectStorageService } from '../../../../../server/objectStorage';

export async function POST(request: NextRequest) {
  try {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    return NextResponse.json({ uploadURL });
  } catch (error) {
    console.error('Error getting upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to get upload URL' },
      { status: 500 }
    );
  }
}