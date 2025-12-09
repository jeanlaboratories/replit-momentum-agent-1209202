import { NextRequest, NextResponse } from 'next/server';
import { getAdminInstances } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { checkForOrphanedUser, repairOrphanedUser } from '@/lib/user-creation-utils';

export async function GET(request: NextRequest) {
  try {
    const { adminAuth, adminDb } = getAdminInstances();
    
    // Get the session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify the session cookie
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // Fetch user profile from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      // User authenticated but no Firestore profile - check if orphaned
      console.log('[/api/user/profile] User document not found, checking for orphaned account:', uid);
      
      try {
        // Get Auth user info
        const authUser = await adminAuth.getUser(uid);
        
        // CRITICAL: Only repair if email is verified
        if (!authUser.emailVerified) {
          console.log('[/api/user/profile] Orphaned user has unverified email - not repairing');
          return NextResponse.json(
            { error: 'Email verification required' },
            { status: 403 }
          );
        }
        
        // Check if orphaned
        const orphanCheck = await checkForOrphanedUser(authUser.email!);
        
        if (orphanCheck.isOrphaned) {
          console.log('[/api/user/profile] Orphaned user detected, attempting repair:', orphanCheck);
          
          // Generate brand for orphaned user
          const brandId = `brand_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const brandName = `${authUser.displayName || 'User'}'s Brand`;
          
          // Repair orphaned user
          const repairResult = await repairOrphanedUser(
            uid,
            authUser.email!,
            authUser.displayName || 'User',
            brandId,
            'MANAGER'
          );
          
          if (repairResult.success) {
            console.log('[/api/user/profile] Orphaned user repaired:', repairResult.repaired);
            
            // Create brand document
            const now = new Date().toISOString();
            await adminDb.collection('brands').doc(brandId).set({
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
                contactEmail: authUser.email!,
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
            
            // Fetch the repaired user profile
            const repairedUserDoc = await adminDb.collection('users').doc(uid).get();
            if (repairedUserDoc.exists) {
              const userProfile = repairedUserDoc.data();
              console.log('[/api/user/profile] Returning repaired user profile');
              return NextResponse.json({ 
                success: true, 
                user: userProfile,
                repaired: true
              });
            }
          }
        }
      } catch (repairError) {
        console.error('[/api/user/profile] Orphan repair failed:', repairError);
      }
      
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const userProfile = userDoc.data();
    
    return NextResponse.json({ 
      success: true, 
      user: userProfile 
    });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
