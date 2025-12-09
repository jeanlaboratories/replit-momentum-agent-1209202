import { describe, it, expect, vi } from 'vitest';
import { getUserPermissions } from '../lib/rbac-rules';

// Mock getAdminInstances to avoid Firebase connection issues in other parts of the code
vi.mock('../lib/firebase/admin', () => ({
  getAdminInstances: () => ({
    adminDb: {
      collection: () => ({
        doc: () => ({
          get: vi.fn(),
          update: vi.fn(),
          set: vi.fn()
        }),
        where: () => ({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
        })
      })
    }
  })
}));

describe('RBAC - Simple Permissions Test', () => {
  it('should return correct permissions for MANAGER', () => {
    const permissions = getUserPermissions('MANAGER') as any;
    expect(permissions.canInviteUsers).toBe(true);
    expect(permissions.canManageTeam).toBe(true);
    expect(permissions.canDeleteContent).toBe(true);
    expect(permissions.canEditBrandProfile).toBe(true);
  });

  it('should return correct permissions for MEMBER', () => {
    const permissions = getUserPermissions('MEMBER' as any) as any;
    expect(permissions.canInviteUsers).toBe(false);
    expect(permissions.canManageTeam).toBe(false);
    expect(permissions.canDeleteContent).toBe(false);
    // This is the change we just made - it should now be false for members
    expect(permissions.canEditBrandProfile).toBe(false);
  });
});
