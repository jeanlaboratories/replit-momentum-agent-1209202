import { BrandRole, UserBrandPermissions } from './types';

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
