import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { getAdminInstances } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { fileTypeFromBuffer } from 'file-type';

async function uploadProfileImage(userId: string, file: File): Promise<string> {
  const { adminStorage } = getAdminInstances();
  const bucket = adminStorage.bucket();

  // Read file as buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Create unique filename
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop() || 'jpg';
  const fileName = `profile_${timestamp}.${fileExtension}`;
  const filePath = `user_profiles/${userId}/${fileName}`;

  // Upload to Firebase Storage
  const fileRef = bucket.file(filePath);
  await fileRef.save(buffer, {
    metadata: {
      contentType: file.type,
    },
  });

  // Generate signed URL
  const [signedUrl] = await fileRef.getSignedUrl({
    action: 'read',
    expires: '01-01-2500', // Far future date
  });

  return signedUrl;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authenticatedUser = await getAuthenticatedUser();
    
    // Parse form data
    const formData = await request.formData();
    const displayName = formData.get('displayName') as string;
    const profileImage = formData.get('profileImage') as File | null;

    if (!displayName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Display name is required' },
        { status: 400 }
      );
    }

    // Get Firebase Admin instances
    const { adminAuth, adminDb } = getAdminInstances();

    // Prepare update data
    const updateData: any = {
      displayName: displayName.trim(),
    };

    // Get current user data to preserve existing photo if no new one is uploaded
    const currentUser = await adminAuth.getUser(authenticatedUser.uid);
    const currentPhotoURL = currentUser.photoURL;

    // Handle profile image upload if provided
    if (profileImage && profileImage.size > 0) {
      // Server-side validation for security
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      // Validate file size
      if (profileImage.size > maxSize) {
        return NextResponse.json(
          { success: false, error: 'Image size must be less than 5MB' },
          { status: 400 }
        );
      }
      
      // Read file buffer for content inspection
      const bytes = await profileImage.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Inspect actual file content to determine true file type
      const fileType = await fileTypeFromBuffer(buffer);
      
      // Validate that it's actually an image based on file content, not headers
      if (!fileType || !allowedMimeTypes.includes(fileType.mime)) {
        return NextResponse.json(
          { success: false, error: 'Only image files (JPEG, PNG, GIF, WebP) are allowed' },
          { status: 400 }
        );
      }
      
      try {
        const photoURL = await uploadProfileImage(authenticatedUser.uid, profileImage);
        updateData.photoURL = photoURL;
      } catch (error) {
        console.error('Profile image upload error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to upload profile image' },
          { status: 500 }
        );
      }
    }
    // If no new image uploaded, preserve existing photo (don't change photoURL)

    // Update Firebase Auth user
    await adminAuth.updateUser(authenticatedUser.uid, updateData);

    // Update Firestore user document
    const userDocRef = adminDb.collection('users').doc(authenticatedUser.uid);
    const firestoreUpdate: any = {
      displayName: updateData.displayName,
      updatedAt: new Date().toISOString(),
    };
    
    // Only update photoURL if a new one was uploaded
    if (updateData.photoURL !== undefined) {
      firestoreUpdate.photoURL = updateData.photoURL;
    }
    
    await userDocRef.update(firestoreUpdate);

    // Update denormalized user data across all collections using chunked batches
    // Firestore batches have a 500 operation limit, so we need to chunk large updates
    
    // Get all documents that need updating
    const [brandMembersQuery, commentsQuery] = await Promise.all([
      adminDb.collection('brandMembers').where('userId', '==', authenticatedUser.uid).get(),
      adminDb.collection('comments').where('createdBy', '==', authenticatedUser.uid).get()
    ]);

    // Prepare update operations
    const updateOps: Array<{ ref: any; data: any }> = [];

    // Determine the photo URL to use for denormalized data
    // Use new photo if uploaded, otherwise keep current photo
    const photoURLForDenormalization = updateData.photoURL !== undefined ? updateData.photoURL : currentPhotoURL;

    // Add BrandMember updates
    brandMembersQuery.docs.forEach((doc: any) => {
      const updateFields: any = {
        userDisplayName: updateData.displayName,
        updatedAt: new Date().toISOString(),
      };
      
      // Only update userPhotoURL if photo was changed
      if (updateData.photoURL !== undefined) {
        updateFields.userPhotoURL = updateData.photoURL;
      }
      
      updateOps.push({ ref: doc.ref, data: updateFields });
    });

    // Add Comment updates
    commentsQuery.docs.forEach((doc: any) => {
      const updateFields: any = {
        createdByName: updateData.displayName,
      };
      
      // Only update createdByPhoto if photo was changed
      if (updateData.photoURL !== undefined) {
        updateFields.createdByPhoto = updateData.photoURL;
      }
      
      updateOps.push({ ref: doc.ref, data: updateFields });
    });

    // Execute updates in chunks of 500 operations (Firestore batch limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < updateOps.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = updateOps.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(op => {
        batch.update(op.ref, op.data);
      });
      
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        displayName: updateData.displayName,
        ...(updateData.photoURL && { photoURL: updateData.photoURL }),
      },
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}