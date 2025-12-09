import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from '../update/route';
import { updateChatMessage, deleteMessagesAfter, deleteNextAssistantMessage } from '@/lib/chat-history';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandAccess } from '@/lib/brand-membership';

// Mock dependencies
vi.mock('@/lib/chat-history');
vi.mock('@/lib/secure-auth');
vi.mock('@/lib/brand-membership');

describe('PUT /api/chat/update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a message successfully and delete only next assistant message by default', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(updateChatMessage).mockResolvedValue(undefined);
    vi.mocked(deleteNextAssistantMessage).mockResolvedValue('deleted-msg-id');

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
      content: 'Updated content',
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateChatMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123', {
      content: 'Updated content',
    });
    expect(deleteNextAssistantMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123');
    expect(deleteMessagesAfter).not.toHaveBeenCalled();
  });

  it('should cascade delete all messages when cascade=true', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(updateChatMessage).mockResolvedValue(undefined);
    vi.mocked(deleteMessagesAfter).mockResolvedValue(undefined);

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
      content: 'Updated content',
      cascade: true,
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateChatMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123', {
      content: 'Updated content',
    });
    expect(deleteMessagesAfter).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123');
  });

  it('should not delete anything when deleteNextOnly=false and cascade=false', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(updateChatMessage).mockResolvedValue(undefined);

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
      content: 'Updated content',
      deleteNextOnly: false,
      cascade: false,
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateChatMessage).toHaveBeenCalled();
    expect(deleteNextAssistantMessage).not.toHaveBeenCalled();
    expect(deleteMessagesAfter).not.toHaveBeenCalled();
  });

  it('should update message media', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(updateChatMessage).mockResolvedValue(undefined);

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
      media: [{ type: 'image', url: 'https://example.com/image.jpg' }],
      cascade: false,
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(updateChatMessage).toHaveBeenCalledWith('brand-123', 'user-123', 'msg-123', {
      media: [{ type: 'image', url: 'https://example.com/image.jpg' }],
    });
  });

  it('should return 401 if user is not authenticated', async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
      content: 'Updated content',
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if brandId is missing', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);

    const body = {
      messageId: 'msg-123',
      content: 'Updated content',
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Brand ID and Message ID required');
  });

  it('should return 400 if neither content nor media is provided', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Content, media, or role must be provided');
  });

  it('should return 500 on error', async () => {
    const mockUser = { uid: 'user-123' };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser as any);
    vi.mocked(requireBrandAccess).mockResolvedValue(undefined);
    vi.mocked(updateChatMessage).mockRejectedValue(new Error('Update failed'));

    const body = {
      brandId: 'brand-123',
      messageId: 'msg-123',
      content: 'Updated content',
    };

    const request = new NextRequest('http://localhost/api/chat/update', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Update failed');
  });
});

