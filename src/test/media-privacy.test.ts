import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMediaPageAction } from '../lib/actions/media-library-actions';
import { getAdminInstances } from '../lib/firebase/admin';
import { getAuthenticatedUser } from '../lib/secure-auth';
import { requireBrandAccess } from '../lib/brand-membership';

// Mock dependencies
vi.mock('../lib/firebase/admin', () => ({
  getAdminInstances: vi.fn(),
}));
vi.mock('../lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn(),
}));
vi.mock('../lib/brand-membership', () => ({
  requireBrandAccess: vi.fn(),
}));

describe('Media Privacy', () => {
  const mockBrandId = 'test-brand';
  const mockUserId = 'test-user';
  const mockAdminDb = {
    collection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getAdminInstances as any).mockReturnValue({ adminDb: mockAdminDb });
    (getAuthenticatedUser as any).mockResolvedValue({ uid: mockUserId });
    (requireBrandAccess as any).mockResolvedValue(true);
  });

  it('should filter by published status when specified', async () => {
    const mockDocs = [
      { id: '1', data: () => ({ id: '1', isPublished: true, createdAt: new Date().toISOString() }) },
      { id: '2', data: () => ({ id: '2', isPublished: true, createdAt: new Date().toISOString() }) },
    ];
    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    };
    mockAdminDb.collection.mockReturnValue(mockQuery);

    const result = await getMediaPageAction(mockBrandId, undefined, 50, { isPublished: true });

    expect(mockQuery.where).toHaveBeenCalledWith('isPublished', '==', true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('1');
  });

  it('should filter by private status when specified', async () => {
    const mockDocs = [
      { id: '3', data: () => ({ id: '3', isPublished: false, createdAt: new Date().toISOString() }) },
    ];
    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs }),
    };
    mockAdminDb.collection.mockReturnValue(mockQuery);

    const result = await getMediaPageAction(mockBrandId, undefined, 50, { isPublished: false });

    expect(mockQuery.where).toHaveBeenCalledWith('isPublished', '==', false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('3');
  });

  it('should show published media and own private media when no filter is specified', async () => {
    const mockDocs = [
      { id: '1', data: () => ({ id: '1', isPublished: true, createdBy: 'other-user', createdAt: new Date().toISOString() }) },
      { id: '2', data: () => ({ id: '2', isPublished: false, createdBy: mockUserId, createdAt: new Date().toISOString() }) },
      { id: '3', data: () => ({ id: '3', isPublished: false, createdBy: 'other-user', createdAt: new Date().toISOString() }) },
    ];
    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: mockDocs, empty: false, size: 3 }),
    };
    mockAdminDb.collection.mockReturnValue(mockQuery);
    mockQuery.get.mockResolvedValueOnce({ docs: mockDocs, empty: false, size: 3 }); // First batch
    mockQuery.get.mockResolvedValueOnce({ docs: [], empty: true, size: 0 }); // Second batch empty

    // Force Smart Scan by not providing isPublished filter
    const result = await getMediaPageAction(mockBrandId, undefined, 50, {});

    // Should contain 1 (published) and 2 (own private), but not 3 (other's private)
    expect(result.items).toHaveLength(2);
    expect(result.items.map(i => i.id)).toContain('1');
    expect(result.items.map(i => i.id)).toContain('2');
    expect(result.items.map(i => i.id)).not.toContain('3');
  });
});
