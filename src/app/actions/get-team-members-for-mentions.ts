'use server';

import { getBrandMembers } from '@/lib/brand-membership';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

export interface MentionUser {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
}

export async function getTeamMembersForMentions(brandId: string): Promise<MentionUser[]> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return [];
    }

    await requireBrandAccess(user.uid, brandId);

    const members = await getBrandMembers(brandId);
    
    return members.map(member => ({
      id: member.userId,
      name: member.userDisplayName || member.userEmail || 'Unknown User',
      email: member.userEmail || '',
      photoURL: member.userPhotoURL
    }));
  } catch (error) {
    console.error('Error fetching team members for mentions:', error);
    return [];
  }
}
