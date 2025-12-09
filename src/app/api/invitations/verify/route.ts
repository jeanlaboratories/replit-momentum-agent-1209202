import { NextRequest, NextResponse } from 'next/server';
import { getBrandInvitationByToken } from '@/lib/brand-membership';
import { getAdminInstances } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    
    console.log(`[VerifyInvitation] Request received for token: ${token?.substring(0, 10)}...`);
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation by token
    const invitation = await getBrandInvitationByToken(token);
    console.log(`[VerifyInvitation] Invitation found:`, invitation ? `email=${invitation.email}, status=${invitation.status}` : 'null');
    
    if (!invitation) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired invitation. This invitation may have already been used or cancelled.' },
        { status: 404 }
      );
    }

    // Check if invitation has expired (7 days)
    const expiryDate = new Date(invitation.createdAt);
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    if (new Date() > expiryDate) {
      return NextResponse.json(
        { success: false, message: 'This invitation has expired. Please contact your team administrator for a new invitation.' },
        { status: 410 }
      );
    }

    // Get brand name
    const { adminDb } = getAdminInstances();
    const brandDoc = await adminDb.collection('brands').doc(invitation.brandId).get();
    const brandName = brandDoc.exists ? brandDoc.data()?.name || 'Unknown Team' : 'Unknown Team';

    // Get inviter name
    const inviterDoc = await adminDb.collection('users').doc(invitation.invitedBy).get();
    const inviterName = inviterDoc.exists 
      ? inviterDoc.data()?.displayName || inviterDoc.data()?.email || 'Team Administrator'
      : 'Team Administrator';

    return NextResponse.json({
      success: true,
      invitation: {
        brandName,
        role: invitation.role,
        inviterName,
        email: invitation.email,
      }
    });
  } catch (error: any) {
    console.error('Error verifying invitation:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to verify invitation' },
      { status: 500 }
    );
  }
}
