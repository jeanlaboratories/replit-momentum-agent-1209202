import { NextRequest, NextResponse } from 'next/server';
import { consumePendingInvitation } from '@/lib/brand-membership';

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json();
    
    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      );
    }

    // Attempt to consume any pending invitation
    await consumePendingInvitation(userId, userEmail);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error consuming invitation:', error);
    // Return success even on error to not block login
    return NextResponse.json({ success: true });
  }
}