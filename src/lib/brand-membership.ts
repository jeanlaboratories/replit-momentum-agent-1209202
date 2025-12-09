import { getAdminInstances } from './firebase/admin';
import { BrandMember, BrandInvitation, BrandRole, UserBrandPermissions } from './types';

// Collection names
export const COLLECTIONS = {
  BRAND_MEMBERS: 'brandMembers',
  BRAND_INVITATIONS: 'brandInvitations',
  USERS: 'users',
  BRANDS: 'brands'
} as const;

// Helper functions
export function createBrandMemberId(brandId: string, userId: string): string {
  return `${brandId}_${userId}`;
}

export function createBrandInvitationId(brandId: string, email: string): string {
  return `${brandId}_${email.toLowerCase()}`;
}

export function generateInvitationToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// Brand Members CRUD operations
export async function createBrandMember(memberData: Omit<BrandMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<BrandMember> {
  const { adminDb } = getAdminInstances();
  const id = createBrandMemberId(memberData.brandId, memberData.userId);
  const now = new Date().toISOString();
  
  const member: BrandMember = {
    ...memberData,
    id,
    joinedAt: memberData.joinedAt || now, // Auto-set joinedAt if not provided
    createdAt: now,
    updatedAt: now
  };

  await adminDb.collection(COLLECTIONS.BRAND_MEMBERS).doc(id).set(member);
  return member;
}

export async function getBrandMember(brandId: string, userId: string): Promise<BrandMember | null> {
  const { adminDb } = getAdminInstances();
  const id = createBrandMemberId(brandId, userId);
  const docRef = adminDb.collection(COLLECTIONS.BRAND_MEMBERS).doc(id);
  const docSnap = await docRef.get();
  
  if (docSnap.exists) {
    const data = docSnap.data();
    if (!data) return null;
    
    // Convert Firestore Timestamps to ISO strings for Next.js serialization
    return {
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : data.joinedAt,
    } as unknown as BrandMember;
  }
  return null;
}

export async function getBrandMembers(brandId: string): Promise<BrandMember[]> {
  const { adminDb } = getAdminInstances();
  
  // Simplified query to avoid requiring composite index
  // First filter by brandId only, then filter and sort in memory
  const querySnapshot = await adminDb.collection(COLLECTIONS.BRAND_MEMBERS)
    .where('brandId', '==', brandId)
    .get();
  
  // Filter for active status and sort by createdAt in memory
  const members = querySnapshot.docs
    .map((doc: any) => {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings for Next.js serialization
      return {
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : data.joinedAt,
      } as unknown as BrandMember;
    })
    .filter((member: BrandMember) => member.status === 'ACTIVE')
    .sort((a: BrandMember, b: BrandMember) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Enrich with user information from users collection
  const enrichedMembers = await Promise.all(
    members.map(async (member: BrandMember) => {
      try {
        const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(member.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return {
            ...member,
            userEmail: userData?.email || '',
            userDisplayName: userData?.displayName || userData?.email || 'Unknown User',
            userPhotoURL: userData?.photoURL || undefined
          };
        }
        // If user not found, use fallback values
        return {
          ...member,
          userEmail: '',
          userDisplayName: 'Unknown User',
          userPhotoURL: undefined
        };
      } catch (error) {
        console.error(`Error fetching user data for ${member.userId}:`, error);
        return {
          ...member,
          userEmail: '',
          userDisplayName: 'Unknown User',
          userPhotoURL: undefined
        };
      }
    })
  );
  
  return enrichedMembers;
}

export async function getUserBrandMemberships(userId: string): Promise<BrandMember[]> {
  const { adminDb } = getAdminInstances();
  
  // Simplified query to avoid requiring composite index
  const querySnapshot = await adminDb.collection(COLLECTIONS.BRAND_MEMBERS)
    .where('userId', '==', userId)
    .get();
  
  // Filter for active status and sort by createdAt in memory
  const memberships = querySnapshot.docs
    .map((doc: any) => {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings for Next.js serialization
      return {
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate().toISOString() : data.joinedAt,
      } as unknown as BrandMember;
    })
    .filter((member: BrandMember) => member.status === 'ACTIVE')
    .sort((a: BrandMember, b: BrandMember) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return memberships;
}

export async function updateBrandMemberRole(brandId: string, userId: string, role: BrandRole, updatedBy: string): Promise<void> {
  const { adminDb } = getAdminInstances();
  const id = createBrandMemberId(brandId, userId);
  const docRef = adminDb.collection(COLLECTIONS.BRAND_MEMBERS).doc(id);
  
  await docRef.update({
    role,
    updatedAt: new Date().toISOString()
  });
}

export async function removeBrandMember(brandId: string, userId: string): Promise<void> {
  const { adminDb } = getAdminInstances();
  const id = createBrandMemberId(brandId, userId);
  const docRef = adminDb.collection(COLLECTIONS.BRAND_MEMBERS).doc(id);
  
  await docRef.update({
    status: 'INACTIVE',
    updatedAt: new Date().toISOString()
  });
}

// Brand Invitations CRUD operations
export async function createBrandInvitation(invitationData: Omit<BrandInvitation, 'id' | 'token' | 'createdAt' | 'status' | 'expiresAt'>): Promise<BrandInvitation> {
  const { adminDb } = getAdminInstances();
  const id = createBrandInvitationId(invitationData.brandId, invitationData.email);
  const token = generateInvitationToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
  
  const invitation: BrandInvitation = {
    ...invitationData,
    id,
    token,
    status: 'PENDING',
    expiresAt,
    createdAt: now
  };

  await adminDb.collection(COLLECTIONS.BRAND_INVITATIONS).doc(id).set(invitation);
  return invitation;
}

export async function getBrandInvitation(brandId: string, email: string): Promise<BrandInvitation | null> {
  const { adminDb } = getAdminInstances();
  const id = createBrandInvitationId(brandId, email);
  const docRef = adminDb.collection(COLLECTIONS.BRAND_INVITATIONS).doc(id);
  const docSnap = await docRef.get();
  
  if (docSnap.exists) {
    return docSnap.data() as BrandInvitation;
  }
  return null;
}

// Find pending invitation by user email (across all brands)
export async function getPendingInvitationByEmail(email: string): Promise<BrandInvitation | null> {
  const { adminDb } = getAdminInstances();
  
  const querySnapshot = await adminDb.collection(COLLECTIONS.BRAND_INVITATIONS)
    .where('email', '==', email)
    .where('status', '==', 'PENDING')
    .limit(1)
    .get();
  
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { ...doc.data(), id: doc.id } as BrandInvitation;
  }
  
  return null;
}

// Auto-consume pending invitation on first login
export async function consumePendingInvitation(userId: string, userEmail: string): Promise<BrandMember | null> {
  const pendingInvitation = await getPendingInvitationByEmail(userEmail);
  
  if (!pendingInvitation) {
    return null; // No pending invitation to consume
  }
  
  // Check if invitation is still valid
  if (new Date(pendingInvitation.expiresAt) < new Date()) {
    return null; // Invitation has expired
  }
  
  // Create brand member
  const member = await createBrandMember({
    brandId: pendingInvitation.brandId,
    userId,
    userEmail: userEmail,
    userDisplayName: '',
    role: pendingInvitation.role,
    status: 'ACTIVE',
    invitedBy: pendingInvitation.invitedBy
  });
  
  // Mark invitation as accepted
  const { adminDb } = getAdminInstances();
  const invitationRef = adminDb.collection(COLLECTIONS.BRAND_INVITATIONS).doc(pendingInvitation.id);
  await invitationRef.update({
    status: 'ACCEPTED',
    acceptedAt: new Date().toISOString(),
    acceptedBy: userId
  });
  
  return member;
}

export async function getBrandInvitationByToken(token: string): Promise<BrandInvitation | null> {
  const { adminDb } = getAdminInstances();
  const querySnapshot = await adminDb.collection(COLLECTIONS.BRAND_INVITATIONS)
    .where('token', '==', token)
    .where('status', '==', 'PENDING')
    .get();
  
  if (querySnapshot.docs.length > 0) {
    return querySnapshot.docs[0].data() as BrandInvitation;
  }
  return null;
}

export async function getBrandInvitations(brandId: string): Promise<BrandInvitation[]> {
  const { adminDb } = getAdminInstances();
  
  // Simplified query to avoid requiring composite index
  // First filter by brandId only, then filter and sort in memory
  const querySnapshot = await adminDb.collection(COLLECTIONS.BRAND_INVITATIONS)
    .where('brandId', '==', brandId)
    .get();
  
  // Filter for pending status and sort by createdAt in memory
  const invitations = querySnapshot.docs
    .map((doc: any) => doc.data() as BrandInvitation)
    .filter((invitation: BrandInvitation) => invitation.status === 'PENDING')
    .sort((a: BrandInvitation, b: BrandInvitation) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return invitations;
}

export async function acceptBrandInvitation(token: string, userId: string): Promise<BrandMember | null> {
  const invitation = await getBrandInvitationByToken(token);
  if (!invitation || new Date(invitation.expiresAt) < new Date()) {
    return null;
  }

  // Create brand member
  const member = await createBrandMember({
    brandId: invitation.brandId,
    userId,
    userEmail: invitation.email,
    userDisplayName: '',
    role: invitation.role,
    status: 'ACTIVE',
    invitedBy: invitation.invitedBy
  });

  // Update invitation status
  const { adminDb } = getAdminInstances();
  const invitationRef = adminDb.collection(COLLECTIONS.BRAND_INVITATIONS).doc(invitation.id);
  await invitationRef.update({
    status: 'ACCEPTED',
    acceptedAt: new Date().toISOString()
  });

  return member;
}

export async function declineBrandInvitation(token: string): Promise<void> {
  const invitation = await getBrandInvitationByToken(token);
  if (!invitation) return;

  const { adminDb } = getAdminInstances();
  const invitationRef = adminDb.collection(COLLECTIONS.BRAND_INVITATIONS).doc(invitation.id);
  await invitationRef.update({
    status: 'DECLINED'
  });
}

export async function cancelBrandInvitation(brandId: string, email: string): Promise<void> {
  const { adminDb } = getAdminInstances();
  const id = createBrandInvitationId(brandId, email);
  const docRef = adminDb.collection(COLLECTIONS.BRAND_INVITATIONS).doc(id);
  await docRef.delete();
}

// Permission checking utilities
export function getUserPermissions(role: BrandRole): UserBrandPermissions['canInviteUsers'] extends true ? Omit<UserBrandPermissions, 'userId' | 'brandId' | 'role'> : never;
export function getUserPermissions(role: BrandRole): {
  canInviteUsers: boolean;
  canManageTeam: boolean;
  canDeleteContent: boolean;
  canEditBrandProfile: boolean;
} {
  const isManager = role === 'MANAGER';
  
  return {
    canInviteUsers: isManager,
    canManageTeam: isManager,
    canDeleteContent: isManager,
    canEditBrandProfile: isManager // Only managers can edit brand profile
  };
}

export async function checkUserPermission(
  userId: string, 
  brandId: string, 
  permission: keyof UserBrandPermissions
): Promise<boolean> {
  const member = await getBrandMember(brandId, userId);
  if (!member || member.status !== 'ACTIVE') {
    return false;
  }

  const permissions = getUserPermissions(member.role);
  return permissions[permission] || false;
}

export async function requireBrandRole(
  userId: string,
  brandId: string,
  requiredRole: BrandRole
): Promise<BrandMember> {
  const member = await getBrandMember(brandId, userId);
  
  if (!member || member.status !== 'ACTIVE') {
    throw new Error('User is not a member of this brand');
  }

  if (requiredRole === 'MANAGER' && member.role !== 'MANAGER') {
    throw new Error('Manager role required for this action');
  }

  return member;
}

// SECURITY: Validate user has access to brand (any role)
export async function requireBrandAccess(
  userId: string,
  brandId: string
): Promise<BrandMember> {
  const member = await getBrandMember(brandId, userId);
  
  if (!member || member.status !== 'ACTIVE') {
    throw new Error('Access denied: You are not a member of this brand');
  }

  return member;
}

// Seed default admin function
export async function seedDefaultAdmin(adminUserId: string, brandId: string): Promise<void> {
  const existingMember = await getBrandMember(brandId, adminUserId);
  if (existingMember) {
    return; // Already exists
  }

  await createBrandMember({
    brandId,
    userId: adminUserId,
    userEmail: 'admin@advantage.app',
    userDisplayName: 'Admin User',
    role: 'MANAGER',
    status: 'ACTIVE'
  });
}