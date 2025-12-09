import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../app/api/chat/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/secure-auth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({ uid: 'test-user' }),
}));

vi.mock('@/lib/brand-membership', () => ({
  requireBrandAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/campaign-creation-agent', () => ({
  parseCampaignRequest: vi.fn().mockResolvedValue({
    campaignName: 'Test Event',
    duration: 2,
    startDate: '2025-11-22',
    postsPerDay: 2,
    postDistribution: 'even',
    contentTypes: ['Social Media Post'],
    tones: ['Professional'],
  }),
  calculatePostSchedule: vi.fn().mockReturnValue([2, 2]),
  assignImagesToContentBlocks: vi.fn().mockReturnValue(new Map()),
}));

describe('Event Creator API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return NDJSON with correct events for event-creator mode', async () => {
    const req = new NextRequest('http://localhost:5000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'add a two day event' }],
        mode: 'event-creator',
        brandId: 'test-brand',
        teamContext: {}
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let content = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value);
      }
    }

    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);

    const dataEvent = JSON.parse(lines[0]);
    expect(dataEvent.type).toBe('data');
    expect(dataEvent.data.action).toBe('generate-campaign');
    expect(dataEvent.data.campaignName).toContain('Test Event');

    const finalResponseEvent = JSON.parse(lines[1]);
    expect(finalResponseEvent.type).toBe('final_response');
    expect(finalResponseEvent.content).toContain('I\'ve prepared an event plan');
    expect(finalResponseEvent.data.action).toBe('generate-campaign');
  });

  it('should handle event creation with images', async () => {
    const req = new NextRequest('http://localhost:5000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'create a 3-day campaign with these images' }],
        mode: 'event-creator',
        brandId: 'test-brand',
        teamContext: {},
        media: [
          { type: 'image', url: 'https://example.com/image1.jpg' },
          { type: 'image', url: 'https://example.com/image2.jpg' },
        ]
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/x-ndjson');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let content = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value);
      }
    }

    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);

    const dataEvent = JSON.parse(lines[0]);
    expect(dataEvent.type).toBe('data');
    expect(dataEvent.data.action).toBe('generate-campaign');
    expect(dataEvent.data.imageUrls).toBeDefined();
    expect(dataEvent.data.imageUrls.length).toBe(2);

    const finalResponseEvent = JSON.parse(lines[1]);
    expect(finalResponseEvent.type).toBe('final_response');
    expect(finalResponseEvent.content).toContain('with 2 image(s)');
    expect(finalResponseEvent.data.imageUrls).toBeDefined();
  });
});
