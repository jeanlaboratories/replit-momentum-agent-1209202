import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignPreview from '../campaign-preview';
import type { GeneratedCampaignContent, BrandProfile, GeneratedDayContent } from '@/lib/types';
import { saveCampaignAction } from '@/app/actions';

// Mock dependencies using vitest hoisting-safe pattern
vi.mock('@/hooks/use-notification', () => ({
  notification: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => ({ update: vi.fn() })),
  },
}));

vi.mock('@/app/actions', () => ({
  saveCampaignAction: vi.fn(),
  getBrandNameAction: vi.fn().mockResolvedValue({ brandName: 'Test Brand' }),
}));

vi.mock('@/hooks/use-brand-data', () => ({
  useBrandData: () => ({
    images: [],
    videos: [],
    loading: false,
  }),
}));

vi.mock('@/contexts/job-queue-context', () => ({
  useJobQueue: () => ({
    addJob: vi.fn(() => 'job-1'),
    startJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    setProgress: vi.fn(),
  }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock fetch for SSE streaming
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Use fake timers to control auto-save debounce
vi.useFakeTimers({ shouldAdvanceTime: true });

describe('CampaignPreview - Incremental Campaign Editing', () => {
  const mockBrandProfile: BrandProfile = {
    summary: 'A test brand summary',
    images: [],
    videos: [],
    documents: [],
  };

  const createMockContent = (numDays: number): GeneratedCampaignContent => {
    return Array.from({ length: numDays }, (_, i) => ({
      day: i + 1,
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][i % 5],
      contentBlocks: [
        {
          contentType: 'Social Media Post' as const,
          adCopy: i === 0 ? '' : `Content for day ${i + 1}`,
          imagePrompt: '',
        },
      ],
    }));
  };

  const defaultProps = {
    brandId: 'test-brand',
    brandProfile: mockBrandProfile,
    onBack: vi.fn(),
    onCampaignSaved: vi.fn(),
    setGeneratedContent: vi.fn(),
    loadedCampaignId: 'campaign-123',
    campaignUpdatedAt: '2024-01-01T00:00:00Z',
    campaignName: 'Test Campaign',
    campaignPrompt: 'Create engaging content',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Save before generation', () => {
    it('should always save campaign before generating text content', async () => {
      const mockContent = createMockContent(2);

      // Mock successful save
      vi.mocked(saveCampaignAction).mockResolvedValueOnce({
        campaignId: 'campaign-123',
        updatedAt: '2024-01-01T12:00:00Z',
        message: 'Saved',
      });

      // Mock SSE response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"progress","progress":50}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","updatedContent":[]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={mockContent}
        />
      );

      // Click "Generate All Text" button
      const generateButton = screen.getByRole('button', { name: /generate all text/i });
      await userEvent.click(generateButton);

      // Verify save was called before generation
      await waitFor(() => {
        expect(saveCampaignAction).toHaveBeenCalledTimes(1);
      });

      // Verify save was called with correct parameters
      expect(saveCampaignAction).toHaveBeenCalledWith(
        'test-brand',
        mockContent,
        'campaign-123',
        'Test Campaign',
        '2024-01-01T00:00:00Z',
        'Create engaging content',
        null // characterConsistency
      );
    });

    it('should save new content blocks added to existing days before generation', async () => {
      // Initial content with 1 day and 1 block
      const initialContent: GeneratedCampaignContent = [
        {
          day: 1,
          date: '2024-01-01',
          dayOfWeek: 'Monday',
          contentBlocks: [
            {
              contentType: 'Social Media Post' as const,
              adCopy: 'Original content',
              imagePrompt: '',
            },
          ],
        },
      ];

      // Content after adding a new block (simulating what the parent would pass)
      const contentWithNewBlock: GeneratedCampaignContent = [
        {
          day: 1,
          date: '2024-01-01',
          dayOfWeek: 'Monday',
          contentBlocks: [
            {
              contentType: 'Social Media Post' as const,
              adCopy: 'Original content',
              imagePrompt: '',
            },
            {
              contentType: 'Social Media Post' as const,
              adCopy: '', // New empty block
              imagePrompt: '',
            },
          ],
        },
      ];

      // Mock successful save
      vi.mocked(saveCampaignAction).mockResolvedValueOnce({
        campaignId: 'campaign-123',
        updatedAt: '2024-01-01T12:00:00Z',
        message: 'Saved',
      });

      // Mock SSE response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","updatedContent":[]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={contentWithNewBlock}
        />
      );

      // Click "Generate All Text" button
      const generateButton = screen.getByRole('button', { name: /generate all text/i });
      await userEvent.click(generateButton);

      // Verify save includes the new block
      await waitFor(() => {
        expect(saveCampaignAction).toHaveBeenCalledWith(
          'test-brand',
          contentWithNewBlock,
          'campaign-123',
          'Test Campaign',
          '2024-01-01T00:00:00Z',
          'Create engaging content',
          null
        );
      });
    });

    it('should save new days added to campaign before generation', async () => {
      // Content with a newly added day (day 2 is new)
      const contentWithNewDay: GeneratedCampaignContent = [
        {
          day: 1,
          date: '2024-01-01',
          dayOfWeek: 'Monday',
          contentBlocks: [
            {
              contentType: 'Social Media Post' as const,
              adCopy: 'Day 1 content',
              imagePrompt: '',
            },
          ],
        },
        {
          day: 2,
          date: '2024-01-02',
          dayOfWeek: 'Tuesday',
          contentBlocks: [
            {
              contentType: 'Social Media Post' as const,
              adCopy: '', // New day with empty block
              imagePrompt: '',
            },
          ],
        },
      ];

      // Mock successful save
      vi.mocked(saveCampaignAction).mockResolvedValueOnce({
        campaignId: 'campaign-123',
        updatedAt: '2024-01-01T12:00:00Z',
        message: 'Saved',
      });

      // Mock SSE response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","updatedContent":[]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={contentWithNewDay}
        />
      );

      // Click "Generate All Text" button
      const generateButton = screen.getByRole('button', { name: /generate all text/i });
      await userEvent.click(generateButton);

      // Verify save includes all days (including the new one)
      await waitFor(() => {
        expect(saveCampaignAction).toHaveBeenCalledWith(
          'test-brand',
          contentWithNewDay,
          'campaign-123',
          'Test Campaign',
          '2024-01-01T00:00:00Z',
          'Create engaging content',
          null
        );
      });

      // Verify the new day's content blocks are included
      const savedContent = vi.mocked(saveCampaignAction).mock.calls[0][1] as GeneratedCampaignContent;
      expect(savedContent).toHaveLength(2);
      expect(savedContent[1].day).toBe(2);
      expect(savedContent[1].contentBlocks).toHaveLength(1);
    });

    it('should not proceed with generation if save fails', async () => {
      const mockContent = createMockContent(1);

      // Mock failed save - always return error
      vi.mocked(saveCampaignAction).mockResolvedValue({
        error: true,
        message: 'Failed to save',
      });

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={mockContent}
        />
      );

      // Click "Generate All Text" button
      const generateButton = screen.getByRole('button', { name: /generate all text/i });
      await userEvent.click(generateButton);

      // Verify save was attempted at least once
      await waitFor(() => {
        expect(saveCampaignAction).toHaveBeenCalled();
      });

      // Verify fetch was NOT called (generation should not proceed)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call onCampaignSaved after successful save before generation', async () => {
      const mockContent = createMockContent(1);
      const onCampaignSaved = vi.fn();

      // Mock successful save
      vi.mocked(saveCampaignAction).mockResolvedValueOnce({
        campaignId: 'campaign-123',
        updatedAt: '2024-01-01T12:00:00Z',
        message: 'Saved',
      });

      // Mock SSE response
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","updatedContent":[]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={mockContent}
          onCampaignSaved={onCampaignSaved}
        />
      );

      // Click "Generate All Text" button
      const generateButton = screen.getByRole('button', { name: /generate all text/i });
      await userEvent.click(generateButton);

      // Verify onCampaignSaved was called with the new updatedAt timestamp
      await waitFor(() => {
        expect(onCampaignSaved).toHaveBeenCalledWith('campaign-123', '2024-01-01T12:00:00Z');
      });
    });
  });

  describe('Content block operations', () => {
    it('should render all content blocks from all days', () => {
      const mockContent = createMockContent(3);

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={mockContent}
        />
      );

      // Check all days are rendered in accordion
      expect(screen.getByText(/Day 1/)).toBeInTheDocument();
      expect(screen.getByText(/Day 2/)).toBeInTheDocument();
      expect(screen.getByText(/Day 3/)).toBeInTheDocument();
    });
  });

  describe('Campaign not saved state', () => {
    it('should show error when trying to generate without campaign being saved first', async () => {
      // Import the mocked notification to access its methods
      const { notification } = await import('@/hooks/use-notification');
      const mockContent = createMockContent(1);

      // Make sure to mock saveCampaignAction with a default return to prevent errors
      vi.mocked(saveCampaignAction).mockResolvedValue({
        campaignId: 'test-id',
        updatedAt: '2024-01-01',
      });

      render(
        <CampaignPreview
          {...defaultProps}
          initialContent={mockContent}
          loadedCampaignId={null} // Campaign not saved yet
        />
      );

      // Click "Generate All Text" button
      const generateButton = screen.getByRole('button', { name: /generate all text/i });
      await userEvent.click(generateButton);

      // Verify error notification was shown
      await waitFor(() => {
        expect(notification.error).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Campaign Not Saved',
            description: 'Please save the campaign first before generating content.',
          })
        );
      });

      // Verify fetch was NOT called (generation should not proceed)
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
