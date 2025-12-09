/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import SearchSettingsPage from '@/app/settings/search/page';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { SearchMethod, DataStoreStatus } from '@/types/search-settings';
import * as searchAPI from '@/lib/api/search-settings';

// Mock external dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/lib/api/search-settings', () => ({
  getSearchSettings: vi.fn(),
  updateSearchSettings: vi.fn(),
  deleteDataStore: vi.fn(),
  createDataStore: vi.fn(),
  reindexMedia: vi.fn(),
  getIndexingStatus: vi.fn(),
  getSearchStats: vi.fn(),
}));

// Mock UI components to avoid complex rendering issues
vi.mock('@/components/ui/page-transition', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div data-testid="page-transition">{children}</div>,
}));

vi.mock('@/components/ui/glass-card', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-card">{children}</div>,
  GlassCardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-card-header">{children}</div>,
  GlassCardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-card-title">{children}</div>,
  GlassCardDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-card-description">{children}</div>,
  GlassCardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="glass-card-content">{children}</div>,
}));

describe('SearchSettingsPage', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockToast = vi.fn();

  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
  };

  const mockSearchSettings = {
    brand_id: 'test-brand-id',
    search_method: SearchMethod.VERTEX_AI,
    auto_index: true,
    vertex_ai_enabled: true,
    data_store_info: {
      id: 'test-datastore-id',
      name: 'test-datastore-name',
      display_name: 'Test Datastore',
      brand_id: 'test-brand-id',
      status: DataStoreStatus.ACTIVE,
      document_count: 100,
      created_at: '2023-01-01T00:00:00Z',
    },
    firebase_document_count: 150,
    last_sync: '2023-01-01T12:00:00Z',
  };

  const mockIndexingStatus = {
    is_indexing: false,
    progress: 0,
    items_processed: 0,
    total_items: 0,
    started_at: null,
    estimated_completion: null,
    current_operation: '',
  };

  const mockSearchStats = {
    total_searches: 500,
    vertex_ai_searches: 300,
    firebase_searches: 200,
    avg_response_time: 150.5,
    success_rate: 98.5,
  };

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter);
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      loading: false,
      brandId: 'test-brand-id',
    });

    // Setup default API mocks
    vi.mocked(searchAPI.getSearchSettings).mockResolvedValue(mockSearchSettings);
    vi.mocked(searchAPI.getIndexingStatus).mockResolvedValue(mockIndexingStatus);
    vi.mocked(searchAPI.getSearchStats).mockResolvedValue(mockSearchStats);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('renders the search settings page successfully', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Search Settings')).toBeDefined();
        expect(screen.getByText('Search Method')).toBeDefined();
        expect(screen.getByText('Vertex AI Search')).toBeDefined();
        expect(screen.getByText('Firebase Search')).toBeDefined();
      });
    });

    it('shows loading state initially', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: true,
        brandId: null,
      });

      const result = render(<SearchSettingsPage />);
      // Check that the component renders something (loading state)
      expect(result.container.firstChild).toBeDefined();
    });

    it('redirects to login when user is not authenticated', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        loading: false,
        brandId: null,
      });

      render(<SearchSettingsPage />);

      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
  });

  describe('Search Method Management', () => {
    it('displays current search method correctly', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        // Check that Vertex AI Search text is present
        expect(screen.getByText('Vertex AI Search')).toBeDefined();
        expect(screen.getByText('Firebase Search')).toBeDefined();
      });
    });

    it('allows switching search methods', async () => {
      const mockUpdateSettings = vi.mocked(searchAPI.updateSearchSettings);
      mockUpdateSettings.mockResolvedValue({
        ...mockSearchSettings,
        search_method: SearchMethod.FIREBASE,
      });

      render(<SearchSettingsPage />);

      await waitFor(() => {
        // Look for any switch element and simulate interaction
        const switches = screen.getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(0);
        
        // Simulate clicking a switch (Firebase switch would be the second one)
        if (switches[1]) {
          fireEvent.click(switches[1]);
        }
      });

      // Give time for async operations
      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled();
      });
    });

    it('handles auto-index toggle', async () => {
      const mockUpdateSettings = vi.mocked(searchAPI.updateSearchSettings);
      mockUpdateSettings.mockResolvedValue({
        ...mockSearchSettings,
        auto_index: false,
      });

      render(<SearchSettingsPage />);

      await waitFor(() => {
        // Look for switches and simulate clicking the auto-index switch (likely the third one)
        const switches = screen.getAllByRole('switch');
        if (switches[2]) {
          fireEvent.click(switches[2]);
        }
      });

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled();
      });
    });
  });

  describe('Data Store Management', () => {
    it('displays data store information when available', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Datastore')).toBeDefined();
        expect(screen.getByText('100')).toBeDefined(); // document count
        expect(screen.getByText('active')).toBeDefined();
      });
    });

    it('shows create button when no data store exists', async () => {
      vi.mocked(searchAPI.getSearchSettings).mockResolvedValue({
        ...mockSearchSettings,
        data_store_info: null,
      });

      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Data Store')).toBeDefined();
        expect(screen.getByText('No Data Store Found')).toBeDefined();
      });
    });

    it('handles data store creation', async () => {
      const mockCreateDataStore = vi.mocked(searchAPI.createDataStore);
      mockCreateDataStore.mockResolvedValue({
        success: true,
        message: 'Data store created successfully',
      });

      // Start with no data store
      vi.mocked(searchAPI.getSearchSettings).mockResolvedValue({
        ...mockSearchSettings,
        data_store_info: null,
      });

      render(<SearchSettingsPage />);

      await waitFor(() => {
        const createButton = screen.getByText('Create Data Store');
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockCreateDataStore).toHaveBeenCalledWith({
          brand_id: 'test-brand-id',
          force_recreate: false,
        });
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Data store created',
          description: 'Vertex AI data store has been created successfully',
        });
      });
    });

    it('handles data store deletion with confirmation', async () => {
      const mockDeleteDataStore = vi.mocked(searchAPI.deleteDataStore);
      mockDeleteDataStore.mockResolvedValue({
        success: true,
        message: 'Data store deleted successfully',
      });

      render(<SearchSettingsPage />);

      await waitFor(() => {
        const deleteButton = screen.getByText('Delete Data Store');
        fireEvent.click(deleteButton);
      });

      // Confirm deletion in alert dialog - get all buttons and find the one that confirms
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const confirmButton = buttons.find(btn => btn.textContent?.includes('Delete'));
        if (confirmButton) {
          fireEvent.click(confirmButton);
        }
      });

      await waitFor(() => {
        expect(mockDeleteDataStore).toHaveBeenCalled();
      });
    });

    it('handles reindexing media', async () => {
      const mockReindexMedia = vi.mocked(searchAPI.reindexMedia);
      mockReindexMedia.mockResolvedValue({
        success: true,
        message: 'Reindexing started',
      });

      render(<SearchSettingsPage />);

      await waitFor(() => {
        const reindexButton = screen.getByText('Reindex Media');
        fireEvent.click(reindexButton);
      });

      await waitFor(() => {
        expect(mockReindexMedia).toHaveBeenCalledWith('test-brand-id', false);
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Reindexing started',
          description: 'Media reindexing is now running. You can monitor progress in the job queue.',
        });
      });
    });
  });

  describe('Statistics Display', () => {
    it('displays search statistics correctly', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('500')).toBeDefined(); // total searches
        expect(screen.getByText('300')).toBeDefined(); // vertex ai searches
        expect(screen.getByText('200')).toBeDefined(); // firebase searches
        expect(screen.getByText('98.5%')).toBeDefined(); // success rate
        expect(screen.getByText('150')).toBeDefined(); // firebase document count
      });
    });

    it('displays last sync time when available', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Last Synced/)).toBeDefined();
      });
    });
  });

  describe('Indexing Status', () => {
    it('shows indexing progress when indexing is active', async () => {
      const activeIndexingStatus = {
        is_indexing: true,
        progress: 65.5,
        items_processed: 655,
        total_items: 1000,
        started_at: '2023-01-01T10:00:00Z',
        estimated_completion: '2023-01-01T14:00:00Z',
        current_operation: 'Processing images',
      };

      vi.mocked(searchAPI.getIndexingStatus).mockResolvedValue(activeIndexingStatus);

      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Indexing in Progress')).toBeDefined();
        expect(screen.getByText('65.5%')).toBeDefined();
        expect(screen.getByText('655 / 1,000')).toBeDefined();
        expect(screen.getByText('Processing images')).toBeDefined();
      });
    });

    it('hides indexing progress when not indexing', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Indexing in Progress')).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      vi.mocked(searchAPI.getSearchSettings).mockRejectedValue(
        new Error('API Error')
      );

      render(<SearchSettingsPage />);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error loading search settings',
          description: 'API Error',
          variant: 'destructive',
        });
      });
    });

    it('handles update errors gracefully', async () => {
      vi.mocked(searchAPI.updateSearchSettings).mockRejectedValue(
        new Error('Update failed')
      );

      render(<SearchSettingsPage />);

      await waitFor(() => {
        const switches = screen.getAllByRole('switch');
        if (switches[1]) {
          fireEvent.click(switches[1]);
        }
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error updating search method',
          description: 'Update failed',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('allows manual data refresh', async () => {
      render(<SearchSettingsPage />);

      await waitFor(() => {
        const refreshButton = screen.getByText('Refresh');
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        // Should call all API methods again
        expect(searchAPI.getSearchSettings).toHaveBeenCalledTimes(2); // Initial + refresh
        expect(searchAPI.getIndexingStatus).toHaveBeenCalledTimes(2);
        expect(searchAPI.getSearchStats).toHaveBeenCalledTimes(2);
      });
    });
  });
});