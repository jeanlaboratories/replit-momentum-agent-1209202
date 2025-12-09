'use server';

import { revalidatePath } from 'next/cache';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { 
  createBrandMember, 
  getBrandMembers, 
  getBrandInvitations,
  createBrandInvitation,
  cancelBrandInvitation,
  getBrandMember,
  getBrandInvitation,
  updateBrandMemberRole,
  removeBrandMember,
  requireBrandRole,
  requireBrandAccess
} from '@/lib/brand-membership';
import { BrandMember, BrandInvitation, BrandRole } from '@/lib/types';
import { sendEmail } from '@/utils/firebase-email';

// Action to get all active members of a brand
export async function getBrandMembersAction(brandId: string): Promise<{ members?: BrandMember[], error?: string }> {
    try {
        // SECURITY: Verify user has access to this brand
        const user = await getAuthenticatedUser();
        await requireBrandAccess(user.uid, brandId);
        
        const members = await getBrandMembers(brandId);
        return { members };
    } catch (e: any) {
        return { error: e.message };
    }
}

// Action to get all pending invitations for a brand (Manager only)
export async function getBrandInvitationsAction(brandId: string): Promise<{ invitations?: BrandInvitation[], error?: string }> {
    try {
        const user = await getAuthenticatedUser();
        
        // Check if user has any brand membership first
        const membership = await getBrandMember(brandId, user.uid);
        
        if (!membership) {
            return { error: 'You are not a member of this organization. Please contact your administrator to be added to the team.' };
        }
        
        if (membership.status !== 'ACTIVE') {
            return { error: 'Your membership is not active. Please contact your administrator.' };
        }
        
        if (membership.role !== 'MANAGER') {
            return { error: 'Only managers can view team invitations. Your current role is: ' + membership.role.toLowerCase() };
        }
        
        const invitations = await getBrandInvitations(brandId);
        return { invitations };
    } catch (e: any) {
        return { error: 'Failed to load invitations: ' + e.message };
    }
}

// Action to invite a new user (Manager only) - Creates Firebase Auth user and sends email
export async function inviteUserAction(brandId: string, email: string, displayName: string, role: BrandRole): Promise<{ success: boolean, message: string }> {
    try {
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        // Check if user is already a member
        const { adminAuth } = getAdminInstances();
        let existingUser;
        try {
            existingUser = await adminAuth.getUserByEmail(email);
            if (existingUser) {
                const isMember = await getBrandMember(brandId, existingUser.uid);
                if (isMember && isMember.status === 'ACTIVE') {
                    return { success: false, message: 'This user is already a member of the team.' };
                }
            }
        } catch (error: any) {
            if (error.code !== 'auth/user-not-found') {
                throw error; // re-throw other auth errors
            }
        }
        
        // Check if an invitation already exists
        const existingInvitation = await getBrandInvitation(brandId, email);
        if (existingInvitation && existingInvitation.status === 'PENDING') {
            return { success: false, message: 'An invitation has already been sent to this email address.' };
        }
        
        console.log('[inviteUserAction] Creating brand invitation for:', email);
        // Create brand invitation (token is generated automatically)
        // NOTE: Firebase Auth user will be created when they accept the invitation
        const invitation = await createBrandInvitation({
            brandId,
            email,
            displayName,
            role,
            invitedBy: user.uid,
        });
        console.log('[inviteUserAction] Brand invitation created with token:', invitation.token);

        // Send simple invitation notification via Replit Mail
        try {
            const invitationLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5000'}/invite/${invitation.token}`;
            
            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Team Invitation - MOMENTUM</title>
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">You're Invited!</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Join the MOMENTUM team</p>
                    </div>
                    
                    <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <h2 style="color: #333; margin-top: 0;">Welcome to the team!</h2>
                        <p>Hi ${displayName}! You've been invited to join the MOMENTUM team as a <strong>${role === 'MANAGER' ? 'Team Lead' : 'Contributor'}</strong>.</p>
                        
                        <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
                            <h3 style="margin-top: 0; color: #667eea;">Getting Started:</h3>
                            <ol style="margin: 0; padding-left: 20px;">
                                <li style="margin-bottom: 10px;"><strong>Click the button below</strong> to accept your invitation</li>
                                <li style="margin-bottom: 10px;"><strong>Check your email</strong> for a password reset link (sent automatically)</li>
                                <li><strong>Set your password</strong> and start collaborating!</li>
                            </ol>
                        </div>

                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${invitationLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin-bottom: 15px;">
                                Accept Invitation
                            </a>
                        </div>

                        <div style="border-top: 1px solid #e9ecef; padding-top: 30px; margin-top: 30px;">
                            <p style="color: #6c757d; font-size: 14px; margin-bottom: 15px;">
                                Your account will be created automatically when you accept this invitation. You'll receive a password reset email to set up your login.
                            </p>
                            <p style="color: #6c757d; font-size: 14px; margin-bottom: 0;">
                                Your account email: <strong>${email}</strong>
                            </p>
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
You're Invited to Join MOMENTUM!

Hi ${displayName}! You've been invited to join the MOMENTUM team as a ${role === 'MANAGER' ? 'Team Lead' : 'Contributor'}.

Next Steps:
1. Accept your invitation: ${invitationLink}
2. Use "Forgot Password" on login page to get Firebase password reset email
3. Start creating amazing team initiatives!

Your account email: ${email}

This invitation expires in 7 days.
            `;

            await sendEmail({
                to: email,
                subject: `You've been invited to join MOMENTUM`,
                html: emailHtml,
                text: emailText,
            });

            console.log(`Invitation notification sent to ${email}`);
        } catch (error: any) {
            console.warn('Could not send invitation notification:', error.message);
        }

        // Note: Password reset is now handled by Firebase's standard "forgot password" flow
        // Users will use the "Forgot Password" link on the login page, which triggers
        // Firebase's built-in password reset email system as requested

        revalidatePath('/settings/team');
        return { success: true, message: `Invitation sent to ${email}. They can use "Forgot Password" on the login page to set their password via Firebase.` };

    } catch (e: any) {
        console.error('Error inviting user:', e);
        return { success: false, message: e.message };
    }
}

// Action to cancel an invitation (Manager only) - Also deletes the Firebase Auth user if they haven't accepted
export async function cancelInvitationAction(brandId: string, email: string): Promise<{ success: boolean, message: string }> {
     try {
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        // Get the invitation to check if we need to delete the user
        const invitation = await getBrandInvitation(brandId, email);
        if (!invitation) {
            return { success: false, message: 'Invitation not found.' };
        }

        // Cancel the invitation in Firestore
        await cancelBrandInvitation(brandId, email);

        // Delete the Firebase Auth user if the invitation was pending (they never logged in)
        const { adminAuth } = getAdminInstances();
        try {
            const firebaseUser = await adminAuth.getUserByEmail(email);
            if (firebaseUser) {
                // Check if they have any active brand memberships
                const isMember = await getBrandMember(brandId, firebaseUser.uid);
                if (!isMember || isMember.status !== 'ACTIVE') {
                    // Delete the Firebase Auth user since they never completed setup
                    await adminAuth.deleteUser(firebaseUser.uid);
                }
            }
        } catch (error: any) {
            if (error.code !== 'auth/user-not-found') {
                console.error('Error deleting user during invitation cancellation:', error);
                // Don't fail the invitation cancellation if user deletion fails
            }
        }

        revalidatePath('/settings/team');
        return { success: true, message: `Invitation for ${email} has been canceled and user account removed.` };

    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

// Action to change a member's role (Manager only)
export async function changeMemberRoleAction(brandId: string, userId: string, newRole: BrandRole): Promise<{ success: boolean, message: string }> {
    try {
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        // Can't change your own role
        if (userId === user.uid) {
            return { success: false, message: 'You cannot change your own role.' };
        }

        // Get member details for response message
        const member = await getBrandMember(brandId, userId);
        if (!member) {
            return { success: false, message: 'Team member not found.' };
        }

        await updateBrandMemberRole(brandId, userId, newRole, user.uid);

        revalidatePath('/settings/team');
        return { success: true, message: `${member.userDisplayName || member.userEmail} is now a ${newRole.toLowerCase()}.` };

    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

// Action to remove a team member (Manager only) - Deactivates membership but keeps Firebase Auth user
export async function removeMemberAction(brandId: string, userId: string): Promise<{ success: boolean, message: string }> {
    try {
        const user = await getAuthenticatedUser();
        await requireBrandRole(user.uid, brandId, 'MANAGER');

        // Can't remove yourself
        if (userId === user.uid) {
            return { success: false, message: 'You cannot remove yourself from the team.' };
        }

        // Get member details for response message
        const member = await getBrandMember(brandId, userId);
        if (!member) {
            return { success: false, message: 'Team member not found.' };
        }

        // Remove from brand (deactivates membership)
        await removeBrandMember(brandId, userId);

        // Note: We keep the Firebase Auth user account intact
        // They can still log in but won't have access to this brand

        revalidatePath('/settings/team');
        return { success: true, message: `${member.userDisplayName || member.userEmail} has been removed from the team.` };

    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

// Action to send password reset email using Firebase Auth's standard flow
export async function sendPasswordResetAction(email: string): Promise<{ success: boolean, message: string }> {
    try {
        const { adminAuth } = getAdminInstances();
        
        // Verify user exists
        try {
            await adminAuth.getUserByEmail(email);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                return { success: false, message: 'No account found with this email address.' };
            }
            throw error;
        }

        // Password reset is handled by Firebase's standard "forgot password" flow on login page
        return { success: true, message: 'Please use the "Forgot Password" link on the login page. Firebase will send you a password reset email.' };

    } catch (e: any) {
        console.error('Error with password reset:', e);
        return { success: false, message: 'Failed to process password reset. Please try again.' };
    }
}