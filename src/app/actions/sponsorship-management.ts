'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { 
  createSponsorship,
  createSponsorshipInvitation,
  getSponsorshipsForBrand,
  getSponsorshipInvitationByToken,
  getPendingSponsorshipInvitationsByEmail,
  updateSponsorshipStatus,
  updateSponsorshipInvitationStatus,
  canUserManageSponsorships,
  getBrandName,
  getSponsorship
} from '@/lib/sponsorship';
import { requireBrandRole, getBrandMember, requireBrandAccess } from '@/lib/brand-membership';
import { Sponsorship, SponsorshipInvitation } from '@/lib/types';
import { sendEmail } from '@/utils/firebase-email';
import { getAdminInstances } from '@/lib/firebase/admin';

// Action to initiate sponsorship invitation (Manager only)
export async function initiateSponsorshipAction(
  sponsorBrandId: string, 
  managerEmail: string, 
  note?: string
): Promise<{ success: boolean, message: string }> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandRole(user.uid, sponsorBrandId, 'MANAGER');

    // Check if invitation already exists
    const existingInvitation = await getSponsorshipInvitationByToken('');
    const { adminDb } = getAdminInstances();
    const invitationSnapshot = await adminDb.collection('sponsorshipInvitations')
      .where('sponsorBrandId', '==', sponsorBrandId)
      .where('managerEmail', '==', managerEmail)
      .where('status', '==', 'PENDING')
      .get();

    if (!invitationSnapshot.empty) {
      return { success: false, message: 'A sponsorship invitation has already been sent to this email address.' };
    }

    // Get brand names for the invitation
    const sponsorBrandName = await getBrandName(sponsorBrandId);

    // Create sponsorship invitation
    const invitation = await createSponsorshipInvitation({
      sponsorBrandId,
      sponsorBrandName,
      managerEmail,
      initiatedBy: user.uid,
      initiatedByName: user.displayName || user.email,
      note
    });

    // Send invitation email
    try {
      const invitationLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000'}/sponsorship/invite/${invitation.token}`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sponsorship Invitation - MOMENTUM</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Sponsorship Invitation</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Partnership Opportunity</p>
          </div>
          
          <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Sponsorship Partnership Invitation</h2>
            <p>Hello! <strong>${sponsorBrandName}</strong> would like to sponsor your team and provide access to our team profile and resources.</p>
            
            ${note ? `
            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h3 style="margin-top: 0; color: #667eea;">Message from ${sponsorBrandName}:</h3>
              <p style="margin: 0; font-style: italic;">"${note}"</p>
            </div>
            ` : ''}

            <div style="background: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h3 style="margin-top: 0; color: #28a745;">What you'll get:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Read-only access to ${sponsorBrandName}'s team profile</li>
                <li style="margin-bottom: 10px;">View their uploaded content and resources</li>
                <li>Team-wide access for all your team members</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${invitationLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 10px;">
                Review Invitation
              </a>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e9ecef;">
              <p style="color: #adb5bd; font-size: 12px; margin: 0;">
                This invitation expires in 7 days.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailText = `
Sponsorship Partnership Invitation

Hello! ${sponsorBrandName} would like to sponsor your team and provide access to our team profile and resources.

${note ? `Message from ${sponsorBrandName}: "${note}"` : ''}

What you'll get:
- Read-only access to ${sponsorBrandName}'s team profile
- View their uploaded content and resources  
- Team-wide access for all your team members

Review the invitation: ${invitationLink}

This invitation expires in 7 days.
      `;

      await sendEmail({
        to: managerEmail,
        subject: `Sponsorship invitation from ${sponsorBrandName}`,
        html: emailHtml,
        text: emailText,
      });

      console.log(`Sponsorship invitation sent to ${managerEmail}`);
    } catch (error: any) {
      console.warn('Could not send sponsorship invitation notification:', error.message);
    }

    revalidatePath('/settings/team');
    return { success: true, message: `Sponsorship invitation sent to ${managerEmail}.` };

  } catch (e: any) {
    console.error('Error initiating sponsorship:', e);
    return { success: false, message: e.message };
  }
}

// Action to approve sponsorship invitation (Manager only)
export async function approveSponsorshipAction(token: string): Promise<{ success: boolean, message: string }> {
  try {
    const user = await getAuthenticatedUser();
    
    // Get invitation details
    const invitation = await getSponsorshipInvitationByToken(token);
    if (!invitation) {
      return { success: false, message: 'Invitation not found or expired.' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, message: 'This invitation has already been processed.' };
    }

    // Check if invitation is expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return { success: false, message: 'This invitation has expired.' };
    }

    // Verify user is manager of the target brand
    const { adminDb } = getAdminInstances();
    
    // Find the brand ID associated with this manager email
    let targetBrandId = invitation.targetBrandId;
    if (!targetBrandId) {
      // Find brand by looking for this user's manager role
      const membershipSnapshot = await adminDb.collection('brandMembers')
        .where('userId', '==', user.uid)
        .where('userEmail', '==', invitation.managerEmail)
        .where('role', '==', 'MANAGER')
        .where('status', '==', 'ACTIVE')
        .get();

      if (membershipSnapshot.empty) {
        return { success: false, message: 'You are not authorized to approve this invitation.' };
      }

      targetBrandId = membershipSnapshot.docs[0].data().brandId;
    } else {
      // Verify user is manager of the target brand
      await requireBrandRole(user.uid, targetBrandId, 'MANAGER');
    }

    // Ensure targetBrandId is defined
    if (!targetBrandId) {
      return { success: false, message: 'Unable to determine target brand for this invitation.' };
    }

    // Check if sponsorship already exists
    const existingSponsorship = await getSponsorship(invitation.sponsorBrandId, targetBrandId);
    if (existingSponsorship && existingSponsorship.status === 'ACTIVE') {
      return { success: false, message: 'Active sponsorship relationship already exists.' };
    }

    if (existingSponsorship && existingSponsorship.status === 'PENDING') {
      // Update existing PENDING sponsorship to ACTIVE
      console.log('[approveSponsorshipAction] Updating existing sponsorship to ACTIVE');
      await updateSponsorshipStatus(
        invitation.sponsorBrandId,
        targetBrandId, 
        'ACTIVE',
        user.uid
      );
    } else {
      // Create new sponsorship with ACTIVE status (approved immediately)
      console.log('[approveSponsorshipAction] Creating new sponsorship with ACTIVE status');
      await createSponsorship({
        sponsorBrandId: invitation.sponsorBrandId,
        sponsoredBrandId: targetBrandId,
        sponsorBrandName: invitation.sponsorBrandName,
        sponsoredBrandName: await getBrandName(targetBrandId),
        initiatedBy: invitation.initiatedBy,
        approvedBy: user.uid,
        approvedAt: new Date().toISOString(),
        metadata: {
          note: invitation.note,
          permissions: {
            canViewBrandProfile: true,
            canViewUploads: true
          }
        }
      }, 'ACTIVE');
    }

    // Update invitation status
    await updateSponsorshipInvitationStatus(
      invitation.sponsorBrandId,
      invitation.managerEmail,
      'ACCEPTED',
      user.uid
    );

    revalidatePath('/settings/team');
    return { success: true, message: `Sponsorship approved! Your team now has access to ${invitation.sponsorBrandName}'s team profile.` };

  } catch (e: any) {
    console.error('Error approving sponsorship:', e);
    return { success: false, message: e.message };
  }
}

// Action to decline sponsorship invitation (Manager only)
export async function declineSponsorshipAction(token: string): Promise<{ success: boolean, message: string }> {
  try {
    const user = await getAuthenticatedUser();
    
    // Get invitation details
    const invitation = await getSponsorshipInvitationByToken(token);
    if (!invitation) {
      return { success: false, message: 'Invitation not found or expired.' };
    }

    if (invitation.status !== 'PENDING') {
      return { success: false, message: 'This invitation has already been processed.' };
    }

    // Update invitation status
    await updateSponsorshipInvitationStatus(
      invitation.sponsorBrandId,
      invitation.managerEmail,
      'DECLINED',
      user.uid
    );

    revalidatePath('/settings/team');
    return { success: true, message: 'Sponsorship invitation declined.' };

  } catch (e: any) {
    console.error('Error declining sponsorship:', e);
    return { success: false, message: e.message };
  }
}

// Action to revoke existing sponsorship (Manager only, either side)
export async function revokeSponsorshipAction(
  sponsorBrandId: string, 
  sponsoredBrandId: string
): Promise<{ success: boolean, message: string }> {
  try {
    const user = await getAuthenticatedUser();
    
    // Verify user can manage either the sponsor or sponsored brand
    const canManageSponsor = await canUserManageSponsorships(user.uid, sponsorBrandId);
    const canManageSponsored = await canUserManageSponsorships(user.uid, sponsoredBrandId);
    
    if (!canManageSponsor && !canManageSponsored) {
      return { success: false, message: 'You are not authorized to revoke this sponsorship.' };
    }

    // Update sponsorship status
    await updateSponsorshipStatus(sponsorBrandId, sponsoredBrandId, 'REVOKED', user.uid);

    revalidatePath('/settings/team');
    return { success: true, message: 'Sponsorship has been revoked.' };

  } catch (e: any) {
    console.error('Error revoking sponsorship:', e);
    return { success: false, message: e.message };
  }
}

// Action to get sponsorships for a brand
export async function getSponsorshipsAction(brandId: string): Promise<{ 
  sponsorships?: { outgoing: Sponsorship[], incoming: Sponsorship[] }, 
  error?: string 
}> {
  try {
    const user = await getAuthenticatedUser();
    await requireBrandAccess(user.uid, brandId);
    
    const sponsorships = await getSponsorshipsForBrand(brandId);
    return { sponsorships };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Action to get pending sponsorship invitations for a user
export async function getPendingSponsorshipInvitationsAction(): Promise<{ 
  invitations?: SponsorshipInvitation[], 
  error?: string 
}> {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user.email) {
      return { error: 'User email not found.' };
    }
    
    const invitations = await getPendingSponsorshipInvitationsByEmail(user.email);
    return { invitations };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Action to verify sponsorship access for brand profile viewing
export async function verifySponsorshipAccessAction(
  userBrandId: string, 
  targetBrandId: string
): Promise<{ 
  sponsorship?: Sponsorship, 
  error?: string 
}> {
  try {
    const user = await getAuthenticatedUser();
    
    // Verify user has access to their own brand
    await requireBrandAccess(user.uid, userBrandId);
    
    // Check if userBrand sponsors targetBrand (user viewing sponsored brand)
    let sponsorship = await getSponsorship(userBrandId, targetBrandId);
    
    // If not found, check if targetBrand sponsors userBrand (sponsored brand viewing sponsor)
    if (!sponsorship || sponsorship.status !== 'ACTIVE') {
      sponsorship = await getSponsorship(targetBrandId, userBrandId);
    }
    
    if (!sponsorship || sponsorship.status !== 'ACTIVE') {
      return { error: 'No active sponsorship relationship found.' };
    }
    
    return { sponsorship };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Action to get sponsorship invitation by token for the invitation page
export async function getSponsorshipInvitationByTokenAction(token: string): Promise<{ 
  invitation?: SponsorshipInvitation, 
  error?: string 
}> {
  try {
    const invitation = await getSponsorshipInvitationByToken(token);
    
    if (!invitation) {
      return { error: 'Invitation not found or has expired.' };
    }
    
    return { invitation };
  } catch (e: any) {
    return { error: e.message };
  }
}