import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ProfileDocumentCard } from '../ProfileDocumentCard';

// Mock fetch
global.fetch = vi.fn();

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

describe('ProfileDocumentCard', () => {
  const defaultProps = {
    documentId: 'doc-123',
    documentName: 'test-document.pdf',
    documentUrl: 'https://storage.example.com/test-document.pdf',
    brandId: 'brand-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: {
          answer: 'This is a test summary of the document.',
          sourcesCount: 0,
        },
      }),
    });
  });

  it('renders loading state initially', () => {
    render(<ProfileDocumentCard {...defaultProps} />);
    // Component shows skeleton while loading
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders document title after loading', async () => {
    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('test-document')).toBeInTheDocument();
    });
  });

  it('shows "Not Indexed" badge when document is not indexed', async () => {
    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Not Indexed')).toBeInTheDocument();
    });
  });

  it('shows "Indexed" badge when document is indexed', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: {
          answer: 'This is an indexed document summary.',
          sourcesCount: 3,
        },
      }),
    });

    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Indexed')).toBeInTheDocument();
    });
  });

  it('detects PDF document type', async () => {
    render(<ProfileDocumentCard {...defaultProps} documentName="guide.pdf" />);

    await waitFor(() => {
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });
  });

  it('detects Word document type', async () => {
    render(<ProfileDocumentCard {...defaultProps} documentName="report.docx" />);

    await waitFor(() => {
      // The type shows as "Word" in the UI, but the badge shows "DOCX"
      expect(screen.getByText('DOCX')).toBeInTheDocument();
    });
  });

  it('shows delete button when canDelete is true', async () => {
    const onDelete = vi.fn();
    render(
      <ProfileDocumentCard
        {...defaultProps}
        canDelete={true}
        onDelete={onDelete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test-document')).toBeInTheDocument();
    });

    // After loading completes, check for delete button
    await waitFor(() => {
      expect(screen.getByTitle('Delete document')).toBeInTheDocument();
    });
  });

  it('hides delete button when canDelete is false', async () => {
    render(<ProfileDocumentCard {...defaultProps} canDelete={false} />);

    await waitFor(() => {
      expect(screen.getByText('test-document')).toBeInTheDocument();
    });

    expect(screen.queryByTitle('Delete document')).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(
      <ProfileDocumentCard
        {...defaultProps}
        canDelete={true}
        onDelete={onDelete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test-document')).toBeInTheDocument();
    });

    await waitFor(() => {
      const deleteButton = screen.getByTitle('Delete document');
      fireEvent.click(deleteButton);
    });

    expect(onDelete).toHaveBeenCalled();
  });

  it('opens document in new tab when open button is clicked', async () => {
    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      const openButton = screen.getByTitle('Open document');
      fireEvent.click(openButton);
    });

    expect(mockWindowOpen).toHaveBeenCalledWith(defaultProps.documentUrl, '_blank');
  });

  it('expands to show AI summary when expand button is clicked', async () => {
    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTitle('Expand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Expand'));

    await waitFor(() => {
      expect(screen.getByText('AI Summary')).toBeInTheDocument();
    });
  });

  it('shows index button when document is not indexed and expanded', async () => {
    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Expand'));
    });

    await waitFor(() => {
      expect(screen.getByText('Index for AI Search')).toBeInTheDocument();
    });
  });

  it('shows refresh button when document is indexed and expanded', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        result: {
          answer: 'Indexed document summary.',
          sourcesCount: 2,
        },
      }),
    });

    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Expand'));
    });

    await waitFor(() => {
      expect(screen.getByText('Refresh Summary')).toBeInTheDocument();
    });
  });

  it('calls API to index document when index button is clicked', async () => {
    render(<ProfileDocumentCard {...defaultProps} />);

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Expand'));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Index for AI Search'));
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/rag-test',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('index'),
        })
      );
    });
  });

  it('extracts key topics from document name', async () => {
    render(
      <ProfileDocumentCard
        {...defaultProps}
        documentName="brand-guidelines-2024.pdf"
      />
    );

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Expand'));
    });

    await waitFor(() => {
      expect(screen.getByText('Key Topics')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

    render(<ProfileDocumentCard {...defaultProps} />);

    // Component should still render with fallback content
    await waitFor(() => {
      expect(screen.getByText('test-document')).toBeInTheDocument();
    });
  });

  it('shows correct file extension badge', async () => {
    render(<ProfileDocumentCard {...defaultProps} documentName="report.docx" />);

    await waitFor(() => {
      expect(screen.getByText('DOCX')).toBeInTheDocument();
    });
  });

  it('calls onIndexComplete callback after successful indexing', async () => {
    const onIndexComplete = vi.fn();

    // First call returns not indexed, second call (after indexing) returns indexed
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          result: { answer: 'Not indexed yet', sourcesCount: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Indexed successfully',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          result: { answer: 'Now indexed', sourcesCount: 1 },
        }),
      });

    render(
      <ProfileDocumentCard
        {...defaultProps}
        onIndexComplete={onIndexComplete}
      />
    );

    await waitFor(() => {
      fireEvent.click(screen.getByTitle('Expand'));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Index for AI Search'));
    });

    await waitFor(() => {
      expect(onIndexComplete).toHaveBeenCalled();
    });
  });
});
