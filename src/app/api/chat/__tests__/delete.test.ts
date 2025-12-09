import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from '../delete/route';
import { deleteChatMessage, deleteMessagesAfter, getChatHistory } from '@/lib/chat-history';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

// Mock dependencies
vi.mock('@/lib/chat-history');
vi.mock('@/lib/secure-auth');
vi.mock('@/lib/brand-membership');

describe('DELETE /api/chat/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a message successfully without cascade by default', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(deleteChatMessage).mockResolvedValue(undefined);
    vi.mocked(getChatHistory).mockResolvedValue([]);

    // Default behavior: no cascade parameter means cascade=false
    const url = new URL('http://localhost/api/chat/delete?brandId=brand-123&messageId=msg-123');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteChatMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123');
    expect(deleteMessagesAfter).not.toHaveBeenCalled();
  });

  it('should delete a message successfully with cascade=false explicitly', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(deleteChatMessage).mockResolvedValue(undefined);
    vi.mocked(getChatHistory).mockResolvedValue([]);

    const url = new URL('http://localhost/api/chat/delete?brandId=brand-123&messageId=msg-123&cascade=false');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteChatMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123');
    expect(deleteMessagesAfter).not.toHaveBeenCalled();
  });

  it('should cascade delete messages when cascade=true (explicit opt-in)', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(deleteChatMessage).mockResolvedValue(undefined);
    vi.mocked(deleteMessagesAfter).mockResolvedValue(undefined);
    vi.mocked(getChatHistory).mockResolvedValue([]);

    // Cascade delete is only available as an explicit opt-in, not the default
    const url = new URL('http://localhost/api/chat/delete?brandId=brand-123&messageId=msg-123&cascade=true');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteChatMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123');
    expect(deleteMessagesAfter).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123');
  });

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

    const url = new URL('http://localhost/api/chat/delete?brandId=brand-123&messageId=msg-123');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(deleteChatMessage).not.toHaveBeenCalled();
  });

  it('should return 400 if brandId is missing', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);

    const url = new URL('http://localhost/api/chat/delete?messageId=msg-123');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Brand ID and Message ID required');
  });

  it('should return 400 if messageId is missing', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);

    const url = new URL('http://localhost/api/chat/delete?brandId=brand-123');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Brand ID and Message ID required');
  });

  it('should return 500 on error', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(deleteChatMessage).mockRejectedValue(new Error('Delete failed'));
    vi.mocked(getChatHistory).mockResolvedValue([]);

    const url = new URL('http://localhost/api/chat/delete?brandId=brand-123&messageId=msg-123');
    const request = new NextRequest(url);

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete message');
  });
});

