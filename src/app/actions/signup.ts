'use server';

import { getAdminInstances } from '@/lib/firebase/admin';
import { sendEmail } from '@/utils/firebase-email';
import { checkForOrphanedUser, repairOrphanedUser, verifyUserDocuments, deleteAuthUser } from '@/lib/user-creation-utils';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  brandName: z.string().min(2, 'Team name must be at least 2 characters'),
});

export async function signupAction(data: {
  email: string;
  password: string;
  displayName: string;
  brandName: string;
}) {
  const startTime = Date.now();
  let createdAuthUserId: string | undefined;
  let createdBrandId: string | undefined;
  
  try {
    // Step 1: Validate input
    console.log('[signupAction] Starting signup process for:', data.email);
    const validated = signupSchema.parse(data);
    
    const { adminAuth, adminDb } = getAdminInstances();
    
    // Step 2: Check for existing user and repair orphaned accounts
    try {
      const existingUser = await adminAuth.getUserByEmail(validated.email);
      console.log('[signupAction] User already exists in Auth:', validated.email);
      
      // Check if this is an orphaned user (Auth exists but Firestore docs missing)
      const orphanCheck = await checkForOrphanedUser(validated.email);
      
      if (orphanCheck.isOrphaned && orphanCheck.userId) {
        console.warn('[signupAction] ORPHANED USER DETECTED:', {
          userId: orphanCheck.userId,
          email: validated.email,
          missing: orphanCheck.missing,
        });
        
        // Generate a new brand for this orphaned user
        const repairBrandId = `brand_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const repairResult = await repairOrphanedUser(
          orphanCheck.userId,
          validated.email,
          validated.displayName,
          repairBrandId,
          'MANAGER'
        );
        
        if (repairResult.success) {
          console.log('[signupAction] Orphaned user repaired successfully:', repairResult.repaired);
          
          // Create brand for repaired user
          const now = new Date().toISOString();
          await adminDb.collection('brands').doc(repairBrandId).set({
            id: repairBrandId,
            name: validated.brandName,
            profile: {
              summary: '',
              brandText: {
                coreText: '',
                marketingCopy: '',
                contentMarketing: '',
                technicalSupport: '',
                publicRelations: '',
              },
              images: [],
              videos: [],
              documents: [],
              tagline: '',
              websiteUrl: '',
              contactEmail: validated.email,
              location: '',
              bannerImageUrl: '',
              logoUrl: '',
              engagementMetrics: {
                followers: 0,
                following: 0,
                posts: 0,
              },
              pinnedPost: null,
              feedSections: [
                { title: 'Recent Updates', posts: [] },
                { title: 'Popular Content', posts: [] },
              ],
            },
            createdAt: now,
            updatedAt: now,
          });
          
          return {
            success: true,
            message: 'Your account has been recovered! Please check your email to verify your account.',
            requiresVerification: true,
          };
        } else {
          console.error('[signupAction] Failed to repair orphaned user:', repairResult.message);
          return {
            success: false,
            message: 'Account recovery failed. Please contact support.',
          };
        }
      }
      
      // User exists and is not orphaned
      return { 
        success: false, 
        message: 'An account with this email already exists. Please login instead.' 
      };
    } catch (error: any) {
      // User doesn't exist, continue with signup
      if (error.code !== 'auth/user-not-found') {
        console.error('[signupAction] Error checking existing user:', error);
        throw error;
      }
    }

    // Step 3: Generate IDs and timestamp
    const brandId = `brand_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    createdBrandId = brandId;
    const now = new Date().toISOString();
    console.log('[signupAction] Generated brand ID:', brandId);

    // Step 4: Create Firebase Auth user
    console.log('[signupAction] Creating Firebase Auth user...');
    const userRecord = await adminAuth.createUser({
      email: validated.email,
      password: validated.password,
      displayName: validated.displayName,
      emailVerified: false,
    });
    createdAuthUserId = userRecord.uid;
    console.log('[signupAction] Auth user created successfully:', userRecord.uid);

    // Step 5: Generate email verification link (before Firestore operations)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
    const verificationLink = await adminAuth.generateEmailVerificationLink(
      validated.email,
      {
        url: `${siteUrl}/login`,
      }
    );
    console.log('[signupAction] Email verification link generated');

    // Step 6: Create Firestore documents atomically using batch
    try {
      console.log('[signupAction] Starting Firestore batch operations...');
      const batch = adminDb.batch();

      // Create brand
      const brandRef = adminDb.collection('brands').doc(brandId);
      batch.set(brandRef, {
        id: brandId,
        name: validated.brandName,
        profile: {
          summary: '',
          brandText: {
            coreText: '',
            marketingCopy: '',
            contentMarketing: '',
            technicalSupport: '',
            publicRelations: '',
          },
          images: [],
          videos: [],
          documents: [],
          tagline: '',
          websiteUrl: '',
          contactEmail: validated.email,
          location: '',
          bannerImageUrl: '',
          logoUrl: '',
          engagementMetrics: {
            followers: 0,
            following: 0,
            posts: 0,
          },
          pinnedPost: null,
          feedSections: [
            { title: 'Recent Updates', posts: [] },
            { title: 'Popular Content', posts: [] },
          ],
        },
        createdAt: now,
        updatedAt: now,
      });

      // Create user profile
      const userRef = adminDb.collection('users').doc(userRecord.uid);
      batch.set(userRef, {
        uid: userRecord.uid,
        email: validated.email,
        displayName: validated.displayName,
        brandId: brandId,
        photoURL: null,
      });

      // Create brand membership (include in same batch for atomicity)
      const brandMemberId = `${brandId}_${userRecord.uid}`;
      const brandMemberRef = adminDb.collection('brandMembers').doc(brandMemberId);
      batch.set(brandMemberRef, {
        id: brandMemberId,
        brandId: brandId,
        userId: userRecord.uid,
        userEmail: validated.email,
        userDisplayName: validated.displayName,
        userPhotoURL: null,
        role: 'MANAGER',
        status: 'ACTIVE',
        joinedAt: now, // Add joinedAt timestamp to match seed data structure
        createdAt: now,
        updatedAt: now,
      });
      console.log('[signupAction] Brand member document added to batch');

      // Commit the batch atomically
      await batch.commit();
      console.log('[signupAction] Firestore batch committed successfully');

      // Step 7: CRITICAL - Verify all documents were created
      console.log('[signupAction] Verifying document creation...');
      const verification = await verifyUserDocuments(userRecord.uid, brandId, { requireBrandMember: true });
      
      if (!verification.success) {
        console.error('[signupAction] CRITICAL: Document verification failed!', {
          userId: userRecord.uid,
          brandId,
          missing: verification.missing,
        });
        
        // Rollback: Delete Auth user
        await deleteAuthUser(userRecord.uid, 'signupAction');
        
        return {
          success: false,
          message: `Account creation failed: ${verification.missing.join(', ')} not created. Please try again.`,
        };
      }
      
      // Also verify brand was created
      const brandDoc = await adminDb.collection('brands').doc(brandId).get();
      if (!brandDoc.exists) {
        console.error('[signupAction] CRITICAL: Brand document missing after batch commit!');
        await deleteAuthUser(userRecord.uid, 'signupAction');
        return {
          success: false,
          message: 'Team creation failed. Please try again.',
        };
      }
      
      console.log('[signupAction] All documents verified successfully');

    } catch (firestoreError: any) {
      console.error('[signupAction] Firestore batch operation failed:', {
        error: firestoreError.message,
        code: firestoreError.code,
        userId: userRecord.uid,
        brandId,
      });
      
      // Rollback: Delete the Firebase Auth user
      try {
        await deleteAuthUser(userRecord.uid, 'signupAction');
        console.log('[signupAction] Rollback completed successfully');
      } catch (rollbackError: any) {
        console.error('[signupAction] CRITICAL: Rollback failed!', {
          userId: userRecord.uid,
          rollbackError: rollbackError.message,
        });
        
        return {
          success: false,
          message: 'Account creation failed and rollback unsuccessful. Please contact support with error code: ROLLBACK_FAILED_' + userRecord.uid,
        };
      }
      
      throw firestoreError;
    }

    // Step 8: Send verification email (after all critical operations succeed)
    try {
      console.log('[signupAction] Sending verification email...');
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - MOMENTUM</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Welcome to MOMENTUM!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your AI Team Intelligence & Execution Platform</p>
          </div>
          
          <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            <p>Hi ${validated.displayName}! Thanks for signing up for MOMENTUM. We're excited to have you on board!</p>
            
            <p>To get started with your team initiatives, please verify your email address by clicking the button below:</p>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${verificationLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Verify Email Address
              </a>
            </div>

            <p style="color: #6c757d; font-size: 14px; margin-top: 40px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
            </p>

            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h3 style="margin-top: 0; color: #667eea;">Your Account Details:</h3>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${validated.email}</p>
              <p style="margin: 5px 0;"><strong>Team Name:</strong> ${validated.brandName}</p>
              <p style="margin: 5px 0;"><strong>Role:</strong> Team Lead</p>
            </div>

            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e9ecef;">
              <p style="color: #adb5bd; font-size: 12px; margin: 0;">
                This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: validated.email,
        subject: 'Welcome to MOMENTUM - Verify Your Email',
        html: emailHtml,
        text: `Welcome to MOMENTUM!\n\nPlease verify your email address by clicking this link: ${verificationLink}\n\nYour Account Details:\nEmail: ${validated.email}\nTeam Name: ${validated.brandName}\nRole: Team Lead\n\nThis link will expire in 24 hours.`,
      });
      
      console.log('[signupAction] Verification email sent successfully');
    } catch (emailError: any) {
      // Don't fail the signup if email fails, but log it
      console.error('[signupAction] Failed to send verification email:', emailError.message);
      // User is created successfully, they just didn't get the email
    }

    const totalTime = Date.now() - startTime;
    console.log(`[signupAction] Signup completed successfully in ${totalTime}ms`, {
      userId: userRecord.uid,
      brandId,
      email: validated.email,
    });

    return {
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      requiresVerification: true,
    };
    
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[signupAction] Signup failed after ${totalTime}ms:`, {
      error: error.message,
      code: error.code,
      email: data.email,
      createdAuthUserId,
      createdBrandId,
    });
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.errors[0].message,
      };
    }
    
    if (error.code === 'auth/email-already-exists') {
      return {
        success: false,
        message: 'An account with this email already exists. Please login instead.',
      };
    }
    
    if (error.code === 'auth/invalid-password') {
      return {
        success: false,
        message: 'Password must be at least 6 characters long.',
      };
    }
    
    return {
      success: false,
      message: error.message || 'Failed to create account. Please try again.',
    };
  }
}

// Schema for Google Sign-In users (no password needed, user already created in Firebase Auth)
const googleSignupSchema = z.object({
  uid: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(1, 'Display name is required'),
  photoURL: z.string().optional(),
});

export async function googleSignupAction(data: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}) {
  const startTime = Date.now();

  try {
    console.log('[googleSignupAction] Starting Google signup for:', data.email);
    const validated = googleSignupSchema.parse(data);

    const { adminDb } = getAdminInstances();

    // Check if user profile already exists
    const existingUser = await adminDb.collection('users').doc(validated.uid).get();
    if (existingUser.exists) {
      console.log('[googleSignupAction] User profile already exists:', validated.uid);
      return {
        success: true,
        message: 'Account already exists.',
      };
    }

    // Generate brand ID and timestamp
    const brandId = `brand_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();
    // Use display name as brand name for Google users
    const brandName = `${validated.displayName}'s Team`;

    console.log('[googleSignupAction] Creating profile for Google user:', {
      uid: validated.uid,
      brandId,
    });

    // Create Firestore documents atomically using batch
    const batch = adminDb.batch();

    // Create brand
    const brandRef = adminDb.collection('brands').doc(brandId);
    batch.set(brandRef, {
      id: brandId,
      name: brandName,
      profile: {
        summary: '',
        brandText: {
          coreText: '',
          marketingCopy: '',
          contentMarketing: '',
          technicalSupport: '',
          publicRelations: '',
        },
        images: [],
        videos: [],
        documents: [],
        tagline: '',
        websiteUrl: '',
        contactEmail: validated.email,
        location: '',
        bannerImageUrl: '',
        logoUrl: validated.photoURL || '',
        engagementMetrics: {
          followers: 0,
          following: 0,
          posts: 0,
        },
        pinnedPost: null,
        feedSections: [
          { title: 'Recent Updates', posts: [] },
          { title: 'Popular Content', posts: [] },
        ],
      },
      createdAt: now,
      updatedAt: now,
    });

    // Create user profile
    const userRef = adminDb.collection('users').doc(validated.uid);
    batch.set(userRef, {
      uid: validated.uid,
      email: validated.email,
      displayName: validated.displayName,
      brandId: brandId,
      photoURL: validated.photoURL || null,
    });

    // Create brand membership
    const brandMemberId = `${brandId}_${validated.uid}`;
    const brandMemberRef = adminDb.collection('brandMembers').doc(brandMemberId);
    batch.set(brandMemberRef, {
      id: brandMemberId,
      brandId: brandId,
      userId: validated.uid,
      userEmail: validated.email,
      userDisplayName: validated.displayName,
      userPhotoURL: validated.photoURL || null,
      role: 'MANAGER',
      status: 'ACTIVE',
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Commit the batch
    await batch.commit();
    console.log('[googleSignupAction] Firestore documents created successfully');

    // Verify documents were created
    const verification = await verifyUserDocuments(validated.uid, brandId, { requireBrandMember: true });
    if (!verification.success) {
      console.error('[googleSignupAction] Document verification failed:', verification.missing);
      return {
        success: false,
        message: 'Account creation failed. Please try again.',
      };
    }

    const totalTime = Date.now() - startTime;
    console.log(`[googleSignupAction] Google signup completed in ${totalTime}ms`, {
      uid: validated.uid,
      brandId,
    });

    return {
      success: true,
      message: 'Account created successfully!',
    };

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[googleSignupAction] Failed after ${totalTime}ms:`, {
      error: error.message,
      uid: data.uid,
    });

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: error.errors[0].message,
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to create account. Please try again.',
    };
  }
}

export async function resendVerificationEmailAction(email: string) {
  try {
    console.log('[resendVerificationEmailAction] Request for:', email);
    const { adminAuth } = getAdminInstances();
    
    // Get user to check if exists and verification status
    const userRecord = await adminAuth.getUserByEmail(email);
    
    if (userRecord.emailVerified) {
      console.log('[resendVerificationEmailAction] Email already verified:', email);
      return {
        success: false,
        message: 'Email is already verified. Please login.',
      };
    }

    // Generate new verification link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
    const verificationLink = await adminAuth.generateEmailVerificationLink(
      email,
      {
        url: `${siteUrl}/login`,
      }
    );

    // Send verification email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - MOMENTUM</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Verify Your Email</h1>
        </div>
        
        <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <p>Click the button below to verify your email address:</p>

          <div style="text-align: center; margin: 40px 0;">
            <a href="${verificationLink}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
          </div>

          <p style="color: #6c757d; font-size: 14px; margin-top: 40px;">
            Or copy and paste this link into your browser:<br>
            <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
          </p>

          <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid #e9ecef;">
            <p style="color: #adb5bd; font-size: 12px; margin: 0;">
              This link will expire in 24 hours.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: 'Verify Your Email - MOMENTUM',
      html: emailHtml,
      text: `Please verify your email address by clicking this link: ${verificationLink}\n\nThis link will expire in 24 hours.`,
    });

    console.log('[resendVerificationEmailAction] Email sent successfully to:', email);
    return {
      success: true,
      message: 'Verification email sent! Please check your inbox.',
    };
  } catch (error: any) {
    console.error('[resendVerificationEmailAction] Error:', error);
    
    if (error.code === 'auth/user-not-found') {
      return {
        success: false,
        message: 'No account found with this email.',
      };
    }
    
    return {
      success: false,
      message: 'Failed to send verification email. Please try again.',
    };
  }
}
