import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoveInteraction } from '../LoveInteraction';
import { getAssetLovesAction } from '@/app/actions/engagement-actions';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the server action
vi.mock('@/app/actions/engagement-actions', () => ({
  getAssetLovesAction: vi.fn(),
}));

describe('LoveInteraction', () => {
  const mockOnToggle = vi.fn();
  const defaultProps = {
    assetId: 'asset-123',
    brandId: 'brand-123',
    initialCount: 5,
    initialIsLoved: false,
    onToggle: mockOnToggle,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial count and heart icon', () => {
    render(<LoveInteraction {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    // Heart icon is rendered (lucide-react icons usually render as SVGs)
    const heartIcon = document.querySelector('.lucide-heart');
    expect(heartIcon).toBeInTheDocument();
  });

  it('calls onToggle when heart is clicked', () => {
    render(<LoveInteraction {...defaultProps} />);
    const heartIcon = document.querySelector('.lucide-heart');
    if (heartIcon) {
      fireEvent.click(heartIcon);
      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    } else {
      throw new Error('Heart icon not found');
    }
  });

  it('fetches and displays lovers on count click', async () => {
    const mockUsers = [
      { uid: 'user1', displayName: 'Alice', photoURL: 'http://example.com/alice.jpg' },
      { uid: 'user2', displayName: 'Bob', photoURL: 'http://example.com/bob.jpg' },
    ];

    (getAssetLovesAction as any).mockResolvedValue({
      success: true,
      users: mockUsers,
    });

    render(<LoveInteraction {...defaultProps} />);

    // Click the count to open dialog
    const countElement = screen.getByText('5');
    fireEvent.click(countElement);

    // Expect server action to be called
    expect(getAssetLovesAction).toHaveBeenCalledWith('brand-123', 'asset-123');

    // Wait for dialog content (users) to appear
    await waitFor(() => {
      expect(screen.getByText('Loved by')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows tooltip on hover', async () => {
    const mockUsers = [
      { uid: 'user1', displayName: 'Alice' },
    ];
    (getAssetLovesAction as any).mockResolvedValue({
      success: true,
      users: mockUsers,
    });

    render(<LoveInteraction {...defaultProps} />);

    const container = document.querySelector('.flex.items-center.gap-1');
    if (container) {
      fireEvent.mouseEnter(container);
    }

    // Expect server action to be called for tooltip prefetch
    expect(getAssetLovesAction).toHaveBeenCalledWith('brand-123', 'asset-123');
  });
});
