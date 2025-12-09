import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SharePreviewDialog } from '../share-preview-dialog';

// Mock the modules
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
      photoURL: null,
    },
    brandId: 'test-brand-id',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/app/actions', () => ({
  getBrandMembershipAction: vi.fn(),
}));

vi.mock('@/app/actions/share-actions', () => ({
  shareContentToProfileAction: vi.fn(),
}));

vi.mock('@/app/actions/engagement-actions', () => ({
  toggleAssetLoveAction: vi.fn().mockResolvedValue({ success: true, newState: { loveCount: 1, isLoved: true } }),
  getBrandEngagementAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      stats: { 'test-content-block-id': 5 },
      userLoves: { 'test-content-block-id': false },
    },
  }),
}));

// Mock LoveInteraction (CommentInteraction removed from Initiative Content Editor)
vi.mock('../brand-profile-social/LoveInteraction', () => ({
  LoveInteraction: ({ initialCount, initialIsLoved }: any) => (
    <div data-testid="love-interaction">
      Love: {initialCount} {initialIsLoved ? '(loved)' : ''}
    </div>
  ),
}));

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

describe('SharePreviewDialog', () => {
  const defaultProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    text: 'Test post content',
    mediaUrl: 'https://example.com/image.jpg',
    mediaType: 'image' as const,
    brandName: 'Test Brand',
    brandId: 'test-brand-id',
    contentBlockId: 'test-content-block-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the dialog when open', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    expect(screen.getByText('Share Content')).toBeInTheDocument();
    expect(screen.getByText('Test post content')).toBeInTheDocument();
    expect(screen.getByText('Test Brand')).toBeInTheDocument();
  });

  it('should show the post preview with media', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    const img = screen.getByAltText('Post media');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should show video player for video media type', () => {
    render(
      <SharePreviewDialog
        {...defaultProps}
        mediaType="video"
        mediaUrl="https://example.com/video.mp4"
      />
    );

    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
  });

  it('should show Love interaction when brandId and contentBlockId are provided', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    expect(screen.getByTestId('love-interaction')).toBeInTheDocument();
  });

  it('should not show Love interaction when contentBlockId is missing', () => {
    render(<SharePreviewDialog {...defaultProps} contentBlockId={undefined} />);

    expect(screen.queryByTestId('love-interaction')).not.toBeInTheDocument();
  });

  it('should show Personal option for all users', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    (getBrandMembershipAction as any).mockResolvedValue({ role: 'CONTRIBUTOR' });

    render(<SharePreviewDialog {...defaultProps} />);

    // New UI has "Personal" as a card option
    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });

  it('should show Team option only enabled for managers', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    (getBrandMembershipAction as any).mockResolvedValue({ role: 'MANAGER' });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });

  it('should show "Managers only" text for non-managers on Team option', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    (getBrandMembershipAction as any).mockResolvedValue({ role: 'CONTRIBUTOR' });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Managers only')).toBeInTheDocument();
    });
  });

  it('should call shareContentToProfileAction when sharing to personal profile (defaults to private)', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    const { shareContentToProfileAction } = await import('@/app/actions/share-actions');

    (getBrandMembershipAction as any).mockResolvedValue({ role: 'CONTRIBUTOR' });
    (shareContentToProfileAction as any).mockResolvedValue({ success: true });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    // Click the Share button (contains text about what will happen)
    const shareButton = screen.getByRole('button', { name: /Share Privately to Personal/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(shareContentToProfileAction).toHaveBeenCalledWith({
        brandId: 'test-brand-id',
        targetType: 'personal',
        text: 'Test post content',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
        sourceContentBlockId: 'test-content-block-id',
        isPublished: false, // Default is now PRIVATE
        campaignId: undefined,
        campaignDate: undefined,
      });
    });
  });

  it('should call shareContentToProfileAction when sharing to team profile as manager', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    const { shareContentToProfileAction } = await import('@/app/actions/share-actions');

    (getBrandMembershipAction as any).mockResolvedValue({ role: 'MANAGER' });
    (shareContentToProfileAction as any).mockResolvedValue({ success: true });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
    });

    // Select Team target
    fireEvent.click(screen.getByText('Team'));

    // Click the Share button
    const shareButton = screen.getByRole('button', { name: /Share Privately to Team/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(shareContentToProfileAction).toHaveBeenCalledWith({
        brandId: 'test-brand-id',
        targetType: 'team',
        text: 'Test post content',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
        sourceContentBlockId: 'test-content-block-id',
        isPublished: false, // Default is PRIVATE
        campaignId: undefined,
        campaignDate: undefined,
      });
    });
  });

  it('should show success state after sharing', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    const { shareContentToProfileAction } = await import('@/app/actions/share-actions');

    (getBrandMembershipAction as any).mockResolvedValue({ role: 'CONTRIBUTOR' });
    (shareContentToProfileAction as any).mockResolvedValue({ success: true });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    // Click Share button
    const shareButton = screen.getByRole('button', { name: /Share Privately to Personal/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText('Shared to Personal Profile')).toBeInTheDocument();
    });
  });

  it('should display user avatar from auth context', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    // Check for avatar fallback with user initials
    expect(screen.getByText('TE')).toBeInTheDocument(); // "TE" from "Test User"
  });

  it('should not show social media sharing buttons', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    expect(screen.queryByText('Twitter')).not.toBeInTheDocument();
    expect(screen.queryByText('Facebook')).not.toBeInTheDocument();
    expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument();
  });

  it('should display share section labels', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    expect(screen.getByText('Share to')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
  });

  it('should show Private visibility option selected by default', () => {
    render(<SharePreviewDialog {...defaultProps} />);

    // Private card should exist with "Only you" text
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Only you')).toBeInTheDocument();
  });

  it('should allow selecting Public visibility', async () => {
    render(<SharePreviewDialog {...defaultProps} />);

    // Click Public card to select it
    fireEvent.click(screen.getByText('Public'));

    // Share button should now say "Share Publicly"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share Publicly/i })).toBeInTheDocument();
    });
  });

  it('should pass isPublished=false when sharing as private (default)', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    const { shareContentToProfileAction } = await import('@/app/actions/share-actions');

    (getBrandMembershipAction as any).mockResolvedValue({ role: 'CONTRIBUTOR' });
    (shareContentToProfileAction as any).mockResolvedValue({ success: true });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    // Keep as private (default) and share
    const shareButton = screen.getByRole('button', { name: /Share Privately to Personal/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(shareContentToProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: false,
        })
      );
    });
  });

  it('should pass isPublished=true when sharing as public', async () => {
    const { getBrandMembershipAction } = await import('@/app/actions');
    const { shareContentToProfileAction } = await import('@/app/actions/share-actions');

    (getBrandMembershipAction as any).mockResolvedValue({ role: 'CONTRIBUTOR' });
    (shareContentToProfileAction as any).mockResolvedValue({ success: true });

    render(<SharePreviewDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    // Select Public visibility
    fireEvent.click(screen.getByText('Public'));

    // Share
    const shareButton = screen.getByRole('button', { name: /Share Publicly to Personal/i });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(shareContentToProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({
          isPublished: true,
        })
      );
    });
  });
});
