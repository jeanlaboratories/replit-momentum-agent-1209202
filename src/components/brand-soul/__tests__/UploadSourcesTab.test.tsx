import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadSourcesTab from '../UploadSourcesTab';

// Mock hooks
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    brandId: 'test-brand-id',
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

// Mock UI components to simplify testing (the component uses these)
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div style={{ display: 'none' }}>{children}</div>,
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => <div>{children}</div>,
  SelectTrigger: ({ children, id, className }: any) => <button id={id} className={className}>{children}</button>,
  SelectValue: () => <span>Single Page</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

// Helper to click on a source type button
const selectSourceType = async (user: ReturnType<typeof userEvent.setup>, type: string) => {
  const buttons = screen.getAllByRole('button');
  const targetButton = buttons.find(btn => btn.textContent?.toLowerCase().includes(type.toLowerCase()));
  if (targetButton) {
    await user.click(targetButton);
  }
};

describe('UploadSourcesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should submit manual text successfully', async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      json: async () => ({ success: true }),
    });

    render(<UploadSourcesTab />);

    // Manual Text is the default view, find form elements by label
    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Manual Title' } });

    const contentInput = screen.getByLabelText(/Content/i);
    fireEvent.change(contentInput, { target: { value: 'This is some test content for manual extraction.' } });

    const tagsInput = screen.getByLabelText(/Tags/i);
    fireEvent.change(tagsInput, { target: { value: 'test, manual' } });

    // Submit - button text is "Add Text" for manual
    const submitButton = screen.getByRole('button', { name: /Add Text/i });
    fireEvent.click(submitButton);

    // Verify loading/success state
    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    // Verify API call
    expect(global.fetch).toHaveBeenCalledWith('/api/brand-soul/ingest/manual', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: 'test-brand-id',
        userId: 'test-brand-id',
        content: 'This is some test content for manual extraction.',
        sourceUrl: 'manual://user-input',
        title: 'Test Manual Title',
        tags: 'test, manual',
      }),
    }));
  });

  it('should handle API errors during manual text submission', async () => {
    // Mock error API response
    (global.fetch as any).mockResolvedValue({
      json: async () => ({ success: false, message: 'API Error' }),
    });

    render(<UploadSourcesTab />);

    const contentInput = screen.getByLabelText(/Content/i);
    fireEvent.change(contentInput, { target: { value: 'Test content' } });

    const submitButton = screen.getByRole('button', { name: /Add Text/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('should upload document successfully', async () => {
    const user = userEvent.setup();
    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      json: async () => ({ success: true }),
    });

    render(<UploadSourcesTab />);

    // Switch to Document view
    await selectSourceType(user, 'Document');

    // Create a dummy file
    const file = new File(['dummy content'], 'test-doc.pdf', { type: 'application/pdf' });

    // Upload file - find the file input
    const fileInputs = screen.getAllByLabelText(/File/i);
    const fileInput = fileInputs.find(input => (input as HTMLInputElement).type === 'file');
    if (fileInput) {
      await user.upload(fileInput, file);
    }

    // Fill optional fields
    const titleInputs = screen.getAllByLabelText(/Title/i);
    const titleInput = titleInputs.find(input => (input as HTMLInputElement).type !== 'file');
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'Test Document Title' } });
    }

    // Submit
    const submitButton = screen.getByRole('button', { name: /Upload/i });

    // Wait for button to be enabled (state update)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    // Submit form directly to ensure handler is called
    fireEvent.submit(submitButton.closest('form')!);

    // Verify fetch was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/brand-soul/ingest/document', expect.any(Object));
    });

    // Verify loading/success state
    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    // Verify API call
    expect(global.fetch).toHaveBeenCalledWith('/api/brand-soul/ingest/document', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }));
  });

  describe('Job Queue Integration', () => {
    it('should add job to queue when submitting manual text', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      render(<UploadSourcesTab />);

      const contentInput = screen.getByLabelText(/Content/i);
      fireEvent.change(contentInput, { target: { value: 'Test content for job queue' } });

      const submitButton = screen.getByRole('button', { name: /Add Text/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'source-ingest-text',
          title: expect.stringContaining('Ingesting:'),
          description: 'Processing manual text for AI extraction',
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');
      expect(mockSetProgress).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalledWith('test-job-id', {
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });
    });

    it('should fail job when manual text submission fails', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: false, message: 'API Error' }),
      });

      render(<UploadSourcesTab />);

      const contentInput = screen.getByLabelText(/Content/i);
      fireEvent.change(contentInput, { target: { value: 'Test content' } });

      const submitButton = screen.getByRole('button', { name: /Add Text/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFailJob).toHaveBeenCalledWith('test-job-id', 'API Error');
      });
    });

    it('should add job to queue when uploading document', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      render(<UploadSourcesTab />);
      await selectSourceType(user, 'Document');

      const file = new File(['dummy content'], 'test-doc.pdf', { type: 'application/pdf' });
      const fileInputs = screen.getAllByLabelText(/File/i);
      const fileInput = fileInputs.find(input => (input as HTMLInputElement).type === 'file');
      if (fileInput) {
        await user.upload(fileInput, file);
      }

      const submitButton = screen.getByRole('button', { name: /Upload/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'source-ingest-document',
          title: expect.stringContaining('Uploading:'),
          description: 'Processing document for AI extraction',
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');

      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalledWith('test-job-id', {
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });
    });

    it('should add job to queue when uploading image', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      render(<UploadSourcesTab />);
      await selectSourceType(user, 'Image');

      const file = new File(['image data'], 'test-image.jpg', { type: 'image/jpeg' });
      const fileInputs = screen.getAllByLabelText(/Image/i);
      const fileInput = fileInputs.find(input => (input as HTMLInputElement).type === 'file');
      if (fileInput) {
        await user.upload(fileInput, file);
      }

      const submitButton = screen.getByRole('button', { name: /Upload/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'source-ingest-image',
          title: expect.stringContaining('Uploading:'),
          description: 'Processing image for AI visual analysis',
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');
    });

    it('should add job to queue when uploading video', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      render(<UploadSourcesTab />);
      await selectSourceType(user, 'Video');

      const file = new File(['video data'], 'test-video.mp4', { type: 'video/mp4' });
      const fileInputs = screen.getAllByLabelText(/Video/i);
      const fileInput = fileInputs.find(input => (input as HTMLInputElement).type === 'file');
      if (fileInput) {
        await user.upload(fileInput, file);
      }

      const submitButton = screen.getByRole('button', { name: /Upload/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'source-ingest-video',
          title: expect.stringContaining('Uploading:'),
          description: 'Processing video for AI analysis',
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');
    });

    it('should add job to queue when submitting YouTube URL', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      render(<UploadSourcesTab />);
      await selectSourceType(user, 'YouTube');

      const urlInput = screen.getByLabelText(/YouTube URL/i);
      fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });

      const submitButton = screen.getByRole('button', { name: /Add Video/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'source-ingest-youtube',
          title: expect.stringContaining('YouTube:'),
          description: 'Extracting transcript and analyzing video',
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');

      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalledWith('test-job-id', {
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });
    });

    it('should add job to queue when crawling website', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ success: true }),
      });

      render(<UploadSourcesTab />);
      await selectSourceType(user, 'Website');

      const urlInput = screen.getByLabelText(/URL/i);
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });

      const submitButton = screen.getByRole('button', { name: /Crawl Site/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddJob).toHaveBeenCalledWith({
          type: 'source-ingest-website',
          title: expect.stringContaining('Crawling:'),
          description: expect.stringContaining('Crawling'),
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });

      expect(mockStartJob).toHaveBeenCalledWith('test-job-id');

      await waitFor(() => {
        expect(mockCompleteJob).toHaveBeenCalledWith('test-job-id', {
          resultUrl: '/brand-soul?tab=artifacts',
        });
      });
    });
  });
});
