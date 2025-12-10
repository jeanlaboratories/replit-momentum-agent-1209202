/**
 * Tests for Music Gallery page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import MusicPage from '@/app/music/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-user' },
    brandId: 'test-brand',
    loading: false,
  })),
}));

// Mock actions
vi.mock('@/app/actions', () => ({
  generateMusicAction: vi.fn(),
  getMusicAction: vi.fn(() => Promise.resolve([])),
  deleteMusicAction: vi.fn(),
  getUserDisplayNamesAction: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/app/actions/team-management', () => ({
  getBrandMembersAction: vi.fn(() => Promise.resolve({ members: [] })),
}));

vi.mock('@/app/actions/ai-settings', () => ({
  getAIModelSettingsAction: vi.fn(() => Promise.resolve({ musicModel: 'lyria-002' })),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Mock useJobQueue
vi.mock('@/contexts/job-queue-context', () => {
  const mockAddJob = vi.fn(() => 'job-123');
  const mockStartJob = vi.fn();
  const mockSetProgress = vi.fn();
  const mockCompleteJob = vi.fn();
  const mockFailJob = vi.fn();
  
  return {
    useJobQueue: vi.fn(() => ({
      addJob: mockAddJob,
      startJob: mockStartJob,
      setProgress: mockSetProgress,
      completeJob: mockCompleteJob,
      failJob: mockFailJob,
      updateJob: vi.fn(),
    })),
  };
});

describe('Music Gallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders music gallery page', async () => {
    render(<MusicPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Music Gallery')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows generate music button', async () => {
    render(<MusicPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Generate Music')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});

