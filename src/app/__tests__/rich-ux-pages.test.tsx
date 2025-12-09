import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BrandSoulPOCPage from '../brand-soul-poc/page';
import SeedPage from '../admin/seed/page';
import BrandProfileSocialPage from '../brand-profile/personal/page';
import BrandSoulPage from '../(dashboard)/brand-soul/page';
import MarketingAgentPage from '../settings/marketing-agent/page';
import HomePage from '../page';

// Mock JobQueueProvider to prevent "useJobQueue must be used within a JobQueueProvider" error
vi.mock('@/contexts/job-queue-context', () => ({
  JobQueueProvider: ({ children }: any) => children,
  useJobQueue: () => ({
    state: { jobs: [], isExpanded: false, isPanelVisible: true },
    addJob: vi.fn(() => 'mock-job-id'),
    updateJob: vi.fn(),
    removeJob: vi.fn(),
    clearCompleted: vi.fn(),
    cancelJob: vi.fn(),
    startJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    setProgress: vi.fn(),
    toggleExpanded: vi.fn(),
    setExpanded: vi.fn(),
    setPanelVisible: vi.fn(),
    getActiveJobs: vi.fn(() => []),
    getCompletedJobs: vi.fn(() => []),
    getJobById: vi.fn(),
    hasActiveJobs: vi.fn(() => false),
    isJobStalled: vi.fn(() => false),
    getStalledJobs: vi.fn(() => []),
  }),
  useJob: () => ({
    jobId: null,
    create: vi.fn(() => 'mock-job-id'),
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    progress: vi.fn(),
    update: vi.fn(),
    getJob: vi.fn(),
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock UI Components to verify usage
vi.mock('@/contexts/global-chatbot-context', () => ({
  useGlobalChatbot: () => ({
    openChat: vi.fn(),
    closeChat: vi.fn(),
    isOpen: false,
    sendMessage: vi.fn(),
  }),
  GlobalChatbotProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div data-testid="glass-card" className={className}>{children}</div>,
  GlassCardHeader: ({ children, className }: any) => <div data-testid="glass-card-header" className={className}>{children}</div>,
  GlassCardTitle: ({ children, className }: any) => <div data-testid="glass-card-title" className={className}>{children}</div>,
  GlassCardDescription: ({ children, className }: any) => <div data-testid="glass-card-description" className={className}>{children}</div>,
  GlassCardContent: ({ children, className }: any) => <div data-testid="glass-card-content" className={className}>{children}</div>,
  GlassCardFooter: ({ children, className }: any) => <div data-testid="glass-card-footer" className={className}>{children}</div>,
}));

vi.mock('@/components/ui/page-transition', () => ({
  PageTransition: ({ children }: any) => <div data-testid="page-transition">{children}</div>,
}));

vi.mock('@/components/ui/sidebar', () => ({
  Sidebar: ({ children }: any) => <div>{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarHeader: ({ children }: any) => <div>{children}</div>,
  SidebarProvider: ({ children }: any) => <div>{children}</div>,
  SidebarInset: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <button>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/brand-soul/UploadSourcesTab', () => ({ default: () => <div>UploadSourcesTab</div> }));
vi.mock('@/components/brand-soul/ArtifactsTab', () => ({ default: () => <div>ArtifactsTab</div> }));
vi.mock('@/components/brand-soul/InsightsTab', () => ({ default: () => <div>InsightsTab</div> }));
vi.mock('@/components/brand-soul/BrandSoulTab', () => ({ default: () => <div>BrandSoulTab</div> }));

vi.mock('@/components/campaign-timeline-editor', () => ({ default: () => <div>CampaignTimelineEditor</div> }));
vi.mock('@/components/campaign-preview', () => ({ default: () => <div>CampaignPreview</div> }));

// Mock hooks
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { uid: 'test-user' },
    loading: false,
    brandId: 'test-brand'
  }),
}));

vi.mock('@/hooks/use-brand-data', () => ({
  useBrandData: () => ({
    brandProfile: {
      id: 'test-brand',
      name: 'Test Brand',
      images: [],
      videos: [],
      documents: [{ id: 'doc1', name: 'Test Doc', url: 'http://example.com/doc1', type: 'document' }]
    },
    images: [],
    videos: [],
    loading: { profile: false, media: false },
    refetch: { profile: vi.fn() }
  }),
}));

vi.mock('@/hooks/use-unsaved-changes', () => ({
  useUnsavedChanges: vi.fn(),
}));

vi.mock('@/contexts/TimezoneContext', () => ({
  useTimezone: () => ({
    timezone: 'America/Los_Angeles',
    setTimezone: vi.fn(),
  }),
  TimezoneProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock actions
vi.mock('@/app/actions', () => ({
  seedDatabase: vi.fn(),
  clearDatabaseAction: vi.fn(),
  loadCampaignAction: vi.fn(),
  getBrandProfileAction: vi.fn().mockResolvedValue({ id: 'test-brand', summary: 'Test Summary', images: [], videos: [], documents: [{ id: 'doc1', name: 'Test Doc', url: 'http://example.com/doc1', type: 'document' }] }),
  generateBrandTextAction: vi.fn(),
  uploadBrandAssetAction: vi.fn(),
  deleteBrandAssetAction: vi.fn(),
  regenerateBrandTextSectionAction: vi.fn(),
  updateBrandTextAction: vi.fn(),
  updateBrandBannerAction: vi.fn(),
  updateBrandLogoAction: vi.fn(),
  updateUserBrandIdentityAction: vi.fn(),
  getImagesAction: vi.fn().mockResolvedValue([]),
  getUserProfilePreferencesAction: vi.fn().mockResolvedValue({}),
  updateUserProfilePreferenceAction: vi.fn(),
  generateUserBrandTextAction: vi.fn(),
  getBrandMembershipAction: vi.fn().mockResolvedValue({ userDisplayName: 'Test User' }),
  getTeamMemberInfoAction: vi.fn(),
  getTeamMemberPreferencesAction: vi.fn(),
  generateBrandSummaryAction: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Rich UX Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
  });

  describe('BrandSoulPOCPage', () => {
    it('should render BrandSoulPOCPage with PageTransition and GlassCard', () => {
      render(<BrandSoulPOCPage />);
      expect(screen.getByTestId('page-transition')).toBeInTheDocument();
      expect(screen.getAllByTestId('glass-card').length).toBeGreaterThan(0);
    });
  });

  describe('SeedPage', () => {
    it('should render SeedPage with PageTransition and GlassCard', () => {
      render(<SeedPage />);
      expect(screen.getByTestId('page-transition')).toBeInTheDocument();
      expect(screen.getByTestId('glass-card')).toBeInTheDocument();
    });
  });

  describe('BrandProfileSocialPage', () => {
    it('should render BrandProfileSocialPage with PageTransition and GlassCards', async () => {
      render(<BrandProfileSocialPage />);
      // Wait for suspense/loading if any, though we mocked hooks to return data immediately
      // The component might be wrapped in Suspense, so we might need to wait
      await waitFor(() => {
        expect(screen.getByTestId('page-transition')).toBeInTheDocument();
      });
      expect(screen.getAllByTestId('glass-card').length).toBeGreaterThan(0);
    });
  });

  describe('BrandSoulPage', () => {
    it('should render BrandSoulPage with PageTransition', () => {
      render(<BrandSoulPage />);
      expect(screen.getByTestId('page-transition')).toBeInTheDocument();
      // This page might not use GlassCard directly at top level but inside tabs, 
      // checking PageTransition is the main requirement for this page
    });
  });

  describe('MarketingAgentPage', () => {
    it('should render MarketingAgentPage with PageTransition and GlassCards', () => {
      render(<MarketingAgentPage />);
      expect(screen.getByTestId('page-transition')).toBeInTheDocument();
      expect(screen.getAllByTestId('glass-card').length).toBeGreaterThan(0);
    });
  });

  describe('HomePage', () => {
    it('should render HomePage with PageTransition', async () => {
      render(<HomePage />);
      await waitFor(() => {
        expect(screen.getByTestId('page-transition')).toBeInTheDocument();
      });
    });
  });
});
