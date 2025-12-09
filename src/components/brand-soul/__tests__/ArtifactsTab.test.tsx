import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ArtifactsTab from '../ArtifactsTab';

// Mock hooks
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    brandId: 'test-brand-id',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock job queue context
const mockAddJob = vi.fn(() => 'test-job-id');
const mockStartJob = vi.fn();
const mockSetProgress = vi.fn();
const mockCompleteJob = vi.fn();
const mockFailJob = vi.fn();

vi.mock('@/contexts/job-queue-context', () => ({
  useJobQueue: () => ({
    addJob: mockAddJob,
    startJob: mockStartJob,
    setProgress: mockSetProgress,
    completeJob: mockCompleteJob,
    failJob: mockFailJob,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock server action
vi.mock('@/app/actions', () => ({
  getUserDisplayNamesAction: vi.fn(async () => ({})),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h4>{children}</h4>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h4>{children}</h4>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

describe('ArtifactsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock completely before each test
    (global.fetch as any).mockReset();
  });

  describe('Process Button', () => {
    it('should add job to queue when processing pending jobs', async () => {
      // First call returns artifacts with pending status (to show Process button)
      // Second call returns pending jobs, third/fourth calls are for processing
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            artifacts: [
              { id: 'artifact-1', type: 'manual-text', metadata: { title: 'Test' }, status: 'pending', createdAt: new Date().toISOString() },
              { id: 'artifact-2', type: 'manual-text', metadata: { title: 'Test 2' }, status: 'pending', createdAt: new Date().toISOString() },
            ],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            jobs: [
              { id: 'job-1', type: 'extract-insights' },
              { id: 'job-2', type: 'extract-insights' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true }),
        })
        .mockResolvedValue({
          json: async () => ({ success: true, artifacts: [] }),
        });

      render(<ArtifactsTab />);

      // Wait for initial load and Process button to appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Process/i })).toBeInTheDocument();
      });

      // Click Process button
      const processButton = screen.getByRole('button', { name: /Process/i });
      fireEvent.click(processButton);

      // Wait for job queue operations
      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'artifact-processing',
          title: 'Processing 2 artifacts',
          description: 'Extracting insights from team artifacts',
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      // Verify job was started
      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');

      // Verify progress was updated
      expect(mockSetProgress).toHaveBeenCalled();

      // Verify job was completed
      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalledWith('test-job-id', {
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });
    });

    it('should not show Process button when no pending artifacts', async () => {
      // Return artifacts with extracted status (no pending)
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          success: true,
          artifacts: [
            { id: 'artifact-1', type: 'manual-text', metadata: { title: 'Test' }, status: 'extracted', createdAt: new Date().toISOString() },
          ],
        }),
      });

      render(<ArtifactsTab />);

      // Wait for artifacts to load
      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });

      // Process button should not be visible when there are no pending artifacts
      expect(screen.queryByRole('button', { name: /Process/i })).not.toBeInTheDocument();
    });

    it('should handle job failures correctly', async () => {
      // Return artifacts with pending status, then one job that will fail
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            artifacts: [
              { id: 'artifact-1', type: 'manual-text', metadata: { title: 'Test' }, status: 'pending', createdAt: new Date().toISOString() },
            ],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            jobs: [{ id: 'job-1', type: 'extract-insights' }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: false, message: 'Processing failed' }),
        });

      render(<ArtifactsTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Process/i })).toBeInTheDocument();
      });

      const processButton = screen.getByRole('button', { name: /Process/i });
      fireEvent.click(processButton);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalled();
      });

      // Verify job was marked as failed
      await waitFor(() => {
        expect(mockFailJob).toHaveBeenCalledWith('test-job-id', 'All 1 jobs failed');
      });
    });

    it('should update progress during job processing', async () => {
      // Return artifacts with pending status, then multiple jobs
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            artifacts: [
              { id: 'artifact-1', type: 'manual-text', metadata: { title: 'Test 1' }, status: 'pending', createdAt: new Date().toISOString() },
              { id: 'artifact-2', type: 'manual-text', metadata: { title: 'Test 2' }, status: 'pending', createdAt: new Date().toISOString() },
              { id: 'artifact-3', type: 'manual-text', metadata: { title: 'Test 3' }, status: 'pending', createdAt: new Date().toISOString() },
              { id: 'artifact-4', type: 'manual-text', metadata: { title: 'Test 4' }, status: 'pending', createdAt: new Date().toISOString() },
            ],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            jobs: [
              { id: 'job-1' },
              { id: 'job-2' },
              { id: 'job-3' },
              { id: 'job-4' },
            ],
          }),
        })
        .mockResolvedValue({
          json: async () => ({ success: true }),
        });

      render(<ArtifactsTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Process/i })).toBeInTheDocument();
      });

      const processButton = screen.getByRole('button', { name: /Process/i });
      fireEvent.click(processButton);

      await waitFor(() => {
        // Initial progress should be set to 5
        expect(mockSetProgress).toHaveBeenCalledWith('test-job-id', 5);
      });

      // Wait for all jobs to complete
      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalled();
      });

      // Verify progress was updated multiple times
      expect(mockSetProgress.mock.calls.length).toBeGreaterThan(1);
    });

    it('should display correct title for single artifact', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            artifacts: [
              { id: 'artifact-1', type: 'manual-text', metadata: { title: 'Test' }, status: 'pending', createdAt: new Date().toISOString() },
            ],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            jobs: [{ id: 'job-1', type: 'extract-insights' }],
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({ success: true }),
        })
        .mockResolvedValue({
          json: async () => ({ success: true, artifacts: [] }),
        });

      render(<ArtifactsTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Process/i })).toBeInTheDocument();
      });

      const processButton = screen.getByRole('button', { name: /Process/i });
      fireEvent.click(processButton);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Processing 1 artifact',
          })
        );
      });
    });
  });

  describe('Artifacts Display', () => {
    it('should display artifacts when loaded', async () => {
      const mockArtifacts = [
        {
          id: 'artifact-1',
          type: 'manual-text',
          metadata: { title: 'Test Artifact' },
          status: 'extracted',
          createdAt: new Date().toISOString(),
          createdBy: 'user-1',
        },
      ];

      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true, artifacts: mockArtifacts }),
      });

      render(<ArtifactsTab />);

      await waitFor(() => {
        expect(screen.getByText('Test Artifact')).toBeInTheDocument();
      });
    });

    it('should show empty state when no artifacts', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true, artifacts: [] }),
      });

      render(<ArtifactsTab />);

      await waitFor(() => {
        expect(screen.getByText(/No artifacts yet/i)).toBeInTheDocument();
      });
    });
  });
});
