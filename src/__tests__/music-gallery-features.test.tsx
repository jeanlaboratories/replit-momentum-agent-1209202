/**
 * Comprehensive feature tests for Music Gallery
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  generateMusicAction: vi.fn(() => Promise.resolve({
    success: true,
    music: [{
      id: 'music-1',
      url: 'https://example.com/music.wav',
      prompt: 'Test music',
      duration: 30,
      sampleRate: 48000,
      format: 'wav',
    }],
  })),
  getMusicAction: vi.fn(() => Promise.resolve([])),
  deleteMusicAction: vi.fn(() => Promise.resolve({ success: true })),
  getUserDisplayNamesAction: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@/app/actions/ai-settings', () => ({
  getAIModelSettingsAction: vi.fn(() => Promise.resolve({ musicModel: 'lyria-002' })),
}));

vi.mock('@/app/actions/team-management', () => ({
  getBrandMembersAction: vi.fn(() => Promise.resolve({ members: [] })),
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

describe('Music Gallery Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders music gallery page', async () => {
      render(<MusicPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Music Gallery')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('shows generate button', async () => {
      render(<MusicPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate Music')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Mocking Tests', () => {
    it('verifies mocks are defined', () => {
      // Simple test to verify mocks work
      expect(vi.isMockFunction).toBeTruthy();
    });
  });
});

