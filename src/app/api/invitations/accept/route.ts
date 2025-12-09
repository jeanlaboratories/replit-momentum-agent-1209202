import { NextRequest, NextResponse } from 'next/server';
import { getBrandInvitationByToken } from '@/lib/brand-membership';
import { getAdminInstances } from '@/lib/firebase/admin';
import { sendEmail } from '@/utils/firebase-email';

export async function POST(request: NextRequest) {
  console.log(`[AcceptInvitation] ========== API ENDPOINT CALLED ==========`);
  try {
    const { token } = await request.json();
    
    console.log(`[AcceptInvitation] Received token: ${token?.substring(0, 10)}...`);
    
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation by token
    const invitation = await getBrandInvitationByToken(token);
    console.log(`[AcceptInvitation] Retrieved invitation:`, invitation ? `email=${invitation.email}, status=${invitation.status}` : 'null');
    
    if (!invitation) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    // Check if invitation has expired (7 days)
    const expiryDate = new Date(invitation.createdAt);
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    if (new Date() > expiryDate) {
      return NextResponse.json(
        { success: false, message: 'This invitation has expired' },
        { status: 410 }
      );
    }

    // Get or create user by email
    const { adminAuth, adminDb } = getAdminInstances();
    let userId: string;
    let isNewUser = false;
    
    try {
      // Try to get existing user
      const userRecord = await adminAuth.getUserByEmail(invitation.email);
      userId = userRecord.uid;
      console.log(`[AcceptInvitation] Found existing user ${userId} for ${invitation.email}`);
      console.log(`[AcceptInvitation] isNewUser: false - user already has Firebase account`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create new Firebase Auth user (Firestore doc created AFTER email succeeds)
        console.log(`[AcceptInvitation] User not found, creating new account for ${invitation.email}`);
        const newUserRecord = await adminAuth.createUser({
          email: invitation.email,
          displayName: invitation.displayName,
          emailVerified: true // Invitation link serves as email verification
        });
        userId = newUserRecord.uid;
        isNewUser = true;
        
        console.log(`[AcceptInvitation] Created new Auth user ${userId} for ${invitation.email}`);
        console.log(`[AcceptInvitation] isNewUser: true - will send password reset email`);
      } else {
        console.error(`[AcceptInvitation] Unexpected error checking user:`, error);
        throw error;
      }
    }

    // Check if user is already a member
    const memberRef = adminDb.collection('brandMembers').doc(`${invitation.brandId}_${userId}`);
    const memberDoc = await memberRef.get();
    
    if (memberDoc.exists && memberDoc.data()?.status === 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'You are already a member of this team' },
        { status: 400 }
      );
    }

    // For new users, send password reset email FIRST before marking invitation as accepted
    if (isNewUser) {
      try {
        const passwordResetLink = await adminAuth.generatePasswordResetLink(invitation.email);
        
        // Send password reset email using Replit Mail
        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⚡ Welcome to MOMENTUM</h1>
                </div>
                <div class="content">
                  <h2>Hi ${invitation.displayName}!</h2>
                  <p>Your invitation to join MOMENTUM has been accepted! To complete your account setup, please set your password by clicking the button below:</p>
                  <p style="text-align: center;">
                    <a href="${passwordResetLink}" class="button">Set Your Password</a>
                  </p>
                  <p>Or copy and paste this link into your browser:</p>
                  <p style="background: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; font-family: monospace;">
                    ${passwordResetLink}
                  </p>
                  <p><strong>Note:</strong> This link will expire in 1 hour for security reasons.</p>
                  <p>Once you've set your password, you'll be able to login at <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://jeanlabs.ai'}/login">${process.env.NEXT_PUBLIC_SITE_URL || 'https://jeanlabs.ai'}/login</a></p>
                  <p>Welcome to the team! 🚀</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} MOMENTUM. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const emailText = `
Hi ${invitation.displayName}!

Your invitation to join MOMENTUM has been accepted! To complete your account setup, please set your password by visiting this link:

${passwordResetLink}

Note: This link will expire in 1 hour for security reasons.

Once you've set your password, you'll be able to login at ${process.env.NEXT_PUBLIC_SITE_URL || 'https://jeanlabs.ai'}/login

Welcome to the team! 🚀

© ${new Date().getFullYear()} MOMENTUM. All rights reserved.
        `.trim();

        await sendEmail({
          to: invitation.email,
          subject: 'Welcome to MOMENTUM - Set Your Password',
          html: emailHtml,
          text: emailText
        });
        
        console.log(`[AcceptInvitation] Password reset email sent to ${invitation.email}`);
      } catch (error) {
        console.error('Error sending password reset email:', error);
        
        // If email fails, delete the Auth user (no Firestore doc to clean up yet)
        try {
          await adminAuth.deleteUser(userId);
          console.log(`[AcceptInvitation] Cleaned up Auth user ${userId} after email failure`);
        } catch (cleanupError) {
          console.error('CRITICAL: Failed to cleanup Auth user after email failure:', cleanupError);
          // Log critical error but still return user-friendly message
        }
        
        return NextResponse.json({
          success: false,
          message: 'Failed to send password reset email. Please try again or contact support.'
        }, { status: 500 });
      }
    }

    // Email sent successfully (or existing user), now create Firestore user doc if new user
    if (isNewUser) {
      const userRef = adminDb.collection('users').doc(userId);
      const now = new Date().toISOString();
      await userRef.set({
        id: userId,
        email: invitation.email,
        displayName: invitation.displayName,
        brandId: invitation.brandId,
        createdAt: now,
        updatedAt: now
      });
      console.log(`[AcceptInvitation] Created Firestore user document for ${userId}`);
    }

    // Email sent successfully (or existing user), now mark invitation as accepted
    const now = new Date().toISOString();
    
    // Create or update brand member with displayName from invitation
    const memberData = {
      id: `${invitation.brandId}_${userId}`,
      brandId: invitation.brandId,
      userId: userId,
      userEmail: invitation.email,
      userDisplayName: invitation.displayName,
      role: invitation.role,
      status: 'ACTIVE',
      invitedBy: invitation.invitedBy,
      joinedAt: now,
      createdAt: memberDoc.exists ? memberDoc.data()?.createdAt : now,
      updatedAt: now
    };

    await memberRef.set(memberData, { merge: true });

    // Update user's brandId and displayName (only if not a new user, as it's already set)
    if (!isNewUser) {
      const userRef = adminDb.collection('users').doc(userId);
      await userRef.update({
        brandId: invitation.brandId,
        displayName: invitation.displayName,
        updatedAt: now
      });
    }

    // Mark invitation as accepted
    const invitationRef = adminDb.collection('brandInvitations').doc(invitation.id);
    await invitationRef.update({
      status: 'ACCEPTED',
      acceptedAt: now,
      acceptedBy: userId
    });

    console.log(`[AcceptInvitation] User ${userId} accepted invitation for brand ${invitation.brandId}`);

    // Return success response
    if (isNewUser) {
      console.log(`[AcceptInvitation] Returning success with isNewUser=true`);
      return NextResponse.json({
        success: true,
        isNewUser: true,
        message: 'Invitation accepted! Check your email to set your password.',
        email: invitation.email,
        displayName: invitation.displayName
      });
    } else {
      console.log(`[AcceptInvitation] Returning success with isNewUser=false`);
      return NextResponse.json({
        success: true,
        isNewUser: false,
        message: 'Invitation accepted! You can now login with your existing credentials.',
        email: invitation.email,
        displayName: invitation.displayName
      });
    }
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
