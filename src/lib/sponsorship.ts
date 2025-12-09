import { getAdminInstances } from './firebase/admin';
import { Sponsorship, SponsorshipInvitation, SponsorshipStatus, UserSponsorshipPermissions, BrandMember, BrandRole } from './types';
import { getBrandMember, requireBrandAccess, getUserPermissions } from './brand-membership';

// Collection names
export const SPONSORSHIP_COLLECTIONS = {
  SPONSORSHIPS: 'sponsorships',
  SPONSORSHIP_INVITATIONS: 'sponsorshipInvitations',
} as const;

// Helper functions
export function createSponsorshipId(sponsorBrandId: string, sponsoredBrandId: string): string {
  return `${sponsorBrandId}_${sponsoredBrandId}`;
}

export function createSponsorshipInvitationId(sponsorBrandId: string, managerEmail: string): string {
  return `${sponsorBrandId}_${managerEmail.toLowerCase()}`;
}

export function generateSponsorshipToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// Sponsorship CRUD operations
export async function createSponsorship(
  sponsorshipData: Omit<Sponsorship, 'id' | 'createdAt' | 'status'>,
  status: SponsorshipStatus = 'PENDING'
): Promise<Sponsorship> {
  const { adminDb } = getAdminInstances();
  const id = createSponsorshipId(sponsorshipData.sponsorBrandId, sponsorshipData.sponsoredBrandId);
  const now = new Date().toISOString();
  
  const sponsorship: Sponsorship = {
    ...sponsorshipData,
    id,
    status,
    createdAt: now,
    metadata: {
      permissions: {
        canViewBrandProfile: true,
        canViewUploads: true,
      },
      ...sponsorshipData.metadata
    }
  };

  await adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIPS).doc(id).set(sponsorship);
  return sponsorship;
}

export async function getSponsorship(sponsorBrandId: string, sponsoredBrandId: string): Promise<Sponsorship | null> {
  const { adminDb } = getAdminInstances();
  const id = createSponsorshipId(sponsorBrandId, sponsoredBrandId);
  const docRef = adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIPS).doc(id);
  const docSnap = await docRef.get();
  
  if (docSnap.exists) {
    return docSnap.data() as Sponsorship;
  }
  return null;
}

export async function getSponsorshipsForBrand(brandId: string): Promise<{ 
  outgoing: Sponsorship[], 
  incoming: Sponsorship[] 
}> {
  const { adminDb } = getAdminInstances();
  
  // Get outgoing sponsorships (where this brand is the sponsor)
  const outgoingSnapshot = await adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIPS)
    .where('sponsorBrandId', '==', brandId)
    .get();
  
  // Get incoming sponsorships (where this brand is being sponsored)
  const incomingSnapshot = await adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIPS)
    .where('sponsoredBrandId', '==', brandId)
    .get();
  
  const outgoing = outgoingSnapshot.docs
    .map((doc: any) => doc.data() as Sponsorship)
    .sort((a: Sponsorship, b: Sponsorship) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const incoming = incomingSnapshot.docs
    .map((doc: any) => doc.data() as Sponsorship)
    .sort((a: Sponsorship, b: Sponsorship) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return { outgoing, incoming };
}

export async function updateSponsorshipStatus(
  sponsorBrandId: string, 
  sponsoredBrandId: string, 
  status: SponsorshipStatus,
  updatedBy: string
): Promise<void> {
  const { adminDb } = getAdminInstances();
  const id = createSponsorshipId(sponsorBrandId, sponsoredBrandId);
  const docRef = adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIPS).doc(id);
  
  const updateData: Partial<Sponsorship> = { status };
  
  if (status === 'ACTIVE') {
    updateData.approvedAt = new Date().toISOString();
    updateData.approvedBy = updatedBy;
  } else if (status === 'REVOKED') {
    updateData.revokedAt = new Date().toISOString();
    updateData.revokedBy = updatedBy;
  }
  
  await docRef.update(updateData);
}

// Sponsorship Invitation CRUD operations
export async function createSponsorshipInvitation(
  invitationData: Omit<SponsorshipInvitation, 'id' | 'token' | 'createdAt' | 'status' | 'expiresAt'>
): Promise<SponsorshipInvitation> {
  const { adminDb } = getAdminInstances();
  const id = createSponsorshipInvitationId(invitationData.sponsorBrandId, invitationData.managerEmail);
  const token = generateSponsorshipToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
  
  const invitation: SponsorshipInvitation = {
    ...invitationData,
    id,
    token,
    status: 'PENDING',
    expiresAt,
    createdAt: now
  };

  await adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIP_INVITATIONS).doc(id).set(invitation);
  return invitation;
}

export async function getSponsorshipInvitation(sponsorBrandId: string, managerEmail: string): Promise<SponsorshipInvitation | null> {
  const { adminDb } = getAdminInstances();
  const id = createSponsorshipInvitationId(sponsorBrandId, managerEmail);
  const docRef = adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIP_INVITATIONS).doc(id);
  const docSnap = await docRef.get();
  
  if (docSnap.exists) {
    return docSnap.data() as SponsorshipInvitation;
  }
  return null;
}

export async function getSponsorshipInvitationByToken(token: string): Promise<SponsorshipInvitation | null> {
  const { adminDb } = getAdminInstances();
  const querySnapshot = await adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIP_INVITATIONS)
    .where('token', '==', token)
    .where('status', '==', 'PENDING')
    .get();
  
  if (querySnapshot.docs.length > 0) {
    return querySnapshot.docs[0].data() as SponsorshipInvitation;
  }
  return null;
}

export async function getPendingSponsorshipInvitationsByEmail(email: string): Promise<SponsorshipInvitation[]> {
  const { adminDb } = getAdminInstances();
  const querySnapshot = await adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIP_INVITATIONS)
    .where('managerEmail', '==', email)
    .where('status', '==', 'PENDING')
    .get();
  
  return querySnapshot.docs
    .map((doc: any) => doc.data() as SponsorshipInvitation)
    .sort((a: SponsorshipInvitation, b: SponsorshipInvitation) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateSponsorshipInvitationStatus(
  sponsorBrandId: string,
  managerEmail: string,
  status: 'ACCEPTED' | 'DECLINED' | 'EXPIRED',
  respondedBy?: string
): Promise<void> {
  const { adminDb } = getAdminInstances();
  const id = createSponsorshipInvitationId(sponsorBrandId, managerEmail);
  const docRef = adminDb.collection(SPONSORSHIP_COLLECTIONS.SPONSORSHIP_INVITATIONS).doc(id);
  
  const updateData: Partial<SponsorshipInvitation> = {
    status,
    respondedAt: new Date().toISOString()
  };
  
  if (respondedBy) {
    updateData.respondedBy = respondedBy;
  }
  
  await docRef.update(updateData);
}

// Access control utilities
export async function getUserAccessibleBrandIds(userId: string): Promise<string[]> {
  // Get user's direct brand memberships
  const { adminDb } = getAdminInstances();
  const membershipSnapshot = await adminDb.collection('brandMembers')
    .where('userId', '==', userId)
    .where('status', '==', 'ACTIVE')
    .get();
  
  const directBrandIds = membershipSnapshot.docs.map((doc: any) => {
    const member = doc.data() as BrandMember;
    return member.brandId;
  });
  
  // Get sponsored brand access
  const sponsoredBrandIds: string[] = [];
  for (const brandId of directBrandIds) {
    const { incoming } = await getSponsorshipsForBrand(brandId);
    const activeSponsorships = incoming.filter(s => s.status === 'ACTIVE');
    sponsoredBrandIds.push(...activeSponsorships.map(s => s.sponsorBrandId));
  }
  
  return [...new Set([...directBrandIds, ...sponsoredBrandIds])];
}

export async function checkSponsorshipAccess(
  userId: string, 
  targetBrandId: string
): Promise<{ hasAccess: boolean; isDirectMember: boolean; sponsorshipDetails?: Sponsorship }> {
  // First check if user has direct access to the brand
  try {
    await requireBrandAccess(userId, targetBrandId);
    return { hasAccess: true, isDirectMember: true };
  } catch {
    // User doesn't have direct access, check for sponsorship access
  }
  
  // Get user's brand memberships
  const { adminDb } = getAdminInstances();
  const membershipSnapshot = await adminDb.collection('brandMembers')
    .where('userId', '==', userId)
    .where('status', '==', 'ACTIVE')
    .get();
  
  const userBrandIds = membershipSnapshot.docs.map((doc: any) => {
    const member = doc.data() as BrandMember;
    return member.brandId;
  });
  
  // Check if any of user's brands have active sponsorship to the target brand
  for (const brandId of userBrandIds) {
    const sponsorship = await getSponsorship(targetBrandId, brandId);
    if (sponsorship && sponsorship.status === 'ACTIVE') {
      return { 
        hasAccess: true, 
        isDirectMember: false, 
        sponsorshipDetails: sponsorship 
      };
    }
  }
  
  return { hasAccess: false, isDirectMember: false };
}

export async function requireSponsorshipAccess(
  userId: string,
  targetBrandId: string
): Promise<{ isDirectMember: boolean; sponsorshipDetails?: Sponsorship }> {
  const access = await checkSponsorshipAccess(userId, targetBrandId);
  
  if (!access.hasAccess) {
    throw new Error('Access denied: You do not have permission to view this brand');
  }
  
  return {
    isDirectMember: access.isDirectMember,
    sponsorshipDetails: access.sponsorshipDetails
  };
}

export async function getUserSponsorshipPermissions(
  userId: string, 
  brandId: string
): Promise<UserSponsorshipPermissions> {
  const access = await checkSponsorshipAccess(userId, brandId);
  
  if (!access.hasAccess) {
    throw new Error('Access denied: You do not have permission to view this brand');
  }
  
  // If user is a direct member, get their regular permissions
  if (access.isDirectMember) {
    const member = await getBrandMember(brandId, userId);
    if (!member) {
      throw new Error('User membership not found');
    }
    
    const isManager = member.role === 'MANAGER';
    const accessibleBrandIds = await getUserAccessibleBrandIds(userId);
    const sponsorBrandIds = accessibleBrandIds.filter(id => id !== brandId);
    
    return {
      canEditBrandProfile: true, // Both roles can edit brand profile
      canInviteUsers: isManager,
      canManageTeam: isManager,
      canDeleteContent: isManager,
      isSponsoredUser: false,
      sponsorBrandIds,
      canInitiateSponsorships: isManager,
      canApproveSponsorships: isManager
    };
  }
  
  // User has sponsorship access - read-only permissions
  const accessibleBrandIds = await getUserAccessibleBrandIds(userId);
  const sponsorBrandIds = accessibleBrandIds.filter(id => id !== brandId);
  
  return {
    canEditBrandProfile: false,
    canInviteUsers: false,
    canManageTeam: false,
    canDeleteContent: false,
    isSponsoredUser: true,
    sponsorBrandIds,
    canInitiateSponsorships: false,
    canApproveSponsorships: false
  };
}

// Utility function to check if user can manage sponsorships for a brand
export async function canUserManageSponsorships(userId: string, brandId: string): Promise<boolean> {
  try {
    const member = await getBrandMember(brandId, userId);
    return member?.role === 'MANAGER' && member.status === 'ACTIVE';
  } catch {
    return false;
  }
}

// Utility function to get sponsor brand name by ID
export async function getBrandName(brandId: string): Promise<string> {
  const { adminDb } = getAdminInstances();
  const brandDoc = await adminDb.collection('brands').doc(brandId).get();
  
  if (brandDoc.exists) {
    const brandData = brandDoc.data();
    return brandData?.name || 'Unknown Brand';
  }
  
  return 'Unknown Brand';
}