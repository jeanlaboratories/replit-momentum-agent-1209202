# Brand Soul Seeding - Component Architecture

## Component Hierarchy

```
RootLayout
└── BrandSoulProvider (Context)
    ├── BrandSoulSetupWizard (Page Component)
    │   ├── WizardProgress
    │   ├── WelcomeStep
    │   ├── WebsiteCrawlStep
    │   │   ├── URLInput
    │   │   ├── CrawlOptions
    │   │   └── ValidationMessage
    │   ├── DocumentUploadStep
    │   │   ├── FileDropzone
    │   │   ├── FilePreviewList
    │   │   └── UploadProgress
    │   ├── YouTubeStep
    │   │   ├── YouTubeURLInput
    │   │   └── VideoPreview
    │   ├── ManualInputStep
    │   │   └── RichTextEditor
    │   ├── ProcessingStep
    │   │   ├── ProgressBar
    │   │   ├── StepTimeline
    │   │   └── ProcessingLogs
    │   └── ReviewStep
    │       ├── InsightsTabs
    │       ├── VoiceProfileCard
    │       ├── FactLibraryCard
    │       ├── MessagingCard
    │       ├── VisualIdentityCard
    │       ├── ConflictResolver
    │       └── ApprovalActions
    │
    ├── BrandSoulDashboard (Page Component)
    │   ├── HealthScorePanel
    │   │   ├── CompletenessScore
    │   │   ├── FreshnessScore
    │   │   └── ConsistencyScore
    │   ├── QuickActions
    │   ├── ActiveSourcesList
    │   │   └── SourceCard
    │   ├── PendingReviewsQueue
    │   │   └── ReviewCard
    │   ├── SuggestedImprovements
    │   │   └── SuggestionCard
    │   └── ActivityFeed
    │
    ├── BrandSoulViewer (Component)
    │   ├── VoiceProfileDisplay
    │   ├── FactLibraryExplorer
    │   │   ├── FactCard
    │   │   ├── CategoryFilter
    │   │   └── SearchBar
    │   ├── MessagingFrameworkDisplay
    │   └── VisualIdentityDisplay
    │
    └── SourceManager (Component)
        ├── SourceList
        │   └── SourceItem
        ├── AddSourceModal
        │   ├── SourceTypeSelector
        │   └── SourceInputForm
        └── SourceDetailModal
            ├── SourceMetadata
            ├── ExtractedContent
            └── Actions
```

---

## Core Components

### 1. BrandSoulProvider (Context)

**Location**: `src/contexts/brand-soul-context.tsx`

**Purpose**: Global state management for brand soul data

**State**:
```typescript
interface BrandSoulContextType {
  // Current brand soul
  brandSoul: BrandSoul | null;
  loading: boolean;
  error: string | null;
  
  // Artifacts & sources
  artifacts: BrandArtifact[];
  pendingReviews: BrandArtifact[];
  
  // Processing jobs
  activeJobs: ProcessingJob[];
  
  // Actions
  refetch: () => Promise<void>;
  addSource: (source: SourceInput) => Promise<string>; // Returns artifactId
  updateArtifact: (artifactId: string, updates: Partial<BrandArtifact>) => Promise<void>;
  approveInsights: (artifactId: string, edits?: any) => Promise<void>;
  rejectInsights: (artifactId: string, reason: string) => Promise<void>;
  triggerSynthesis: () => Promise<void>;
  
  // Configuration
  config: BrandSoulConfig;
  updateConfig: (updates: Partial<BrandSoulConfig>) => Promise<void>;
  
  // Stats
  stats: BrandSoulStats;
}
```

**Implementation Details**:
```typescript
export function BrandSoulProvider({ children }: { children: ReactNode }) {
  const { brandId } = useAuth();
  const [brandSoul, setBrandSoul] = useState<BrandSoul | null>(null);
  const [artifacts, setArtifacts] = useState<BrandArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Firestore real-time listeners
  useEffect(() => {
    if (!brandId) return;
    
    // Listen to brand soul
    const soulUnsub = onSnapshot(
      doc(db, 'brandSoul', brandId),
      (snapshot) => setBrandSoul(snapshot.data() as BrandSoul)
    );
    
    // Listen to artifacts
    const artifactsUnsub = onSnapshot(
      collection(db, `brandArtifacts/${brandId}/sources`),
      (snapshot) => setArtifacts(snapshot.docs.map(d => d.data() as BrandArtifact))
    );
    
    return () => {
      soulUnsub();
      artifactsUnsub();
    };
  }, [brandId]);
  
  // ... action implementations
  
  return (
    <BrandSoulContext.Provider value={/* ... */}>
      {children}
    </BrandSoulContext.Provider>
  );
}
```

---

### 2. BrandSoulSetupWizard

**Location**: `src/components/brand-soul/setup-wizard.tsx`

**Purpose**: Multi-step wizard for initial brand soul setup

**Props**:
```typescript
interface SetupWizardProps {
  onComplete: (brandSoulId: string) => void;
  onCancel: () => void;
  mode: 'quick' | 'advanced';
}
```

**State Management**:
```typescript
const [currentStep, setCurrentStep] = useState(0);
const [wizardData, setWizardData] = useState<WizardData>({
  website: { url: '', options: {} },
  documents: [],
  youtube: [],
  manualInputs: [],
});
const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
```

**Steps** (Quick Mode):
1. Welcome
2. Website URL
3. Document Upload (optional)
4. YouTube (optional)
5. Manual Input (optional)
6. Processing
7. Review & Approve

**Navigation**:
- Previous/Next buttons
- Progress indicator
- Step validation
- Can skip optional steps

---

### 3. ProcessingStep Component

**Location**: `src/components/brand-soul/processing-step.tsx`

**Purpose**: Real-time processing status with live updates

**Props**:
```typescript
interface ProcessingStepProps {
  jobs: ProcessingJob[];
  onComplete: (results: any[]) => void;
  onError: (error: Error) => void;
  allowBackground?: boolean;
}
```

**Real-Time Updates**:
```typescript
// WebSocket or polling for job status
useEffect(() => {
  const interval = setInterval(async () => {
    for (const job of jobs) {
      const status = await fetchJobStatus(job.jobId);
      updateJobStatus(job.jobId, status);
    }
  }, 2000); // Poll every 2 seconds
  
  return () => clearInterval(interval);
}, [jobs]);
```

**Features**:
- Live progress bars
- Step-by-step timeline
- Estimated time remaining
- Error handling with retry
- Background processing option

---

### 4. ReviewStep Component

**Location**: `src/components/brand-soul/review-step.tsx`

**Purpose**: Review and approve AI-extracted insights

**Props**:
```typescript
interface ReviewStepProps {
  artifacts: BrandArtifact[];
  onApprove: (edits?: any) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onSaveDraft: (data: any) => Promise<void>;
}
```

**Sub-Components**:

#### VoiceProfileCard
```typescript
// Displays tone, personality, writing style
// Allows inline editing
// Shows confidence scores
// Evidence citations expandable
```

#### FactLibraryCard
```typescript
// Displays extracted facts in categories
// Search and filter
// Edit/delete individual facts
// Source attribution
// Confidence indicators
```

#### ConflictResolver
```typescript
// Shows conflicts between new and existing insights
// Side-by-side comparison
// Suggested resolution
// Manual override options
```

---

### 5. BrandSoulDashboard Component

**Location**: `src/app/settings/brand-soul/page.tsx`

**Purpose**: Main management interface for brand soul

**Features**:
- Health metrics display
- Source management
- Review queue
- Suggested improvements
- Activity history
- Version control

**Sub-Components**:

#### HealthScorePanel
```typescript
interface HealthScorePanelProps {
  completeness: number;    // 0-100
  freshness: number;       // 0-100
  consistency: number;     // 0-100
  onRefresh: () => void;
}
```

#### ActiveSourcesList
```typescript
interface SourceCardProps {
  artifact: BrandArtifact;
  onReview: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}
```

---

### 6. SourceManager Component

**Location**: `src/components/brand-soul/source-manager.tsx`

**Purpose**: Add, view, and manage brand sources

**Features**:
```typescript
// Add new sources (modal)
const handleAddSource = async (type: ArtifactType) => {
  switch (type) {
    case 'website-page':
      return <WebsiteCrawlForm />;
    case 'document-pdf':
      return <DocumentUploadForm />;
    case 'youtube-video':
      return <YouTubeForm />;
    case 'link-article':
      return <LinkForm />;
    case 'manual-text':
      return <ManualInputForm />;
  }
};

// View source details
const viewSource = (artifactId: string) => {
  // Open modal with full artifact details
};

// Delete source
const deleteSource = async (artifactId: string) => {
  // Confirm dialog, then delete
};
```

---

## Shared UI Components

### Custom Components to Build

#### ProgressTimeline
**Location**: `src/components/brand-soul/ui/progress-timeline.tsx`

Visual timeline showing processing steps:
```typescript
interface Step {
  name: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface ProgressTimelineProps {
  steps: Step[];
  currentStep: number;
}
```

#### ConfidenceIndicator
**Location**: `src/components/brand-soul/ui/confidence-indicator.tsx`

Visual confidence score display:
```typescript
interface ConfidenceIndicatorProps {
  score: number;          // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
}

// Visual: Progress bar or gauge
// Color coding:
//   0-50: Red (low confidence)
//   51-75: Yellow (medium)
//   76-100: Green (high)
```

#### SourceTypeIcon
**Location**: `src/components/brand-soul/ui/source-type-icon.tsx`

Icon for each source type:
```typescript
const sourceIcons: Record<ArtifactType, LucideIcon> = {
  'website-page': Globe,
  'document-pdf': FileText,
  'youtube-video': Video,
  'link-article': Link,
  'manual-text': FileEdit,
  // ...
};
```

#### ConflictBadge
**Location**: `src/components/brand-soul/ui/conflict-badge.tsx`

Highlights conflicts requiring resolution:
```typescript
interface ConflictBadgeProps {
  conflicts: Conflict[];
  onResolve: (conflictId: string, resolution: any) => void;
}
```

---

## Form Components

### WebsiteCrawlForm
```typescript
interface WebsiteCrawlFormProps {
  onSubmit: (data: WebsiteCrawlData) => Promise<void>;
  onCancel: () => void;
}

// Fields:
// - URL (required, validated)
// - Max pages (slider: 10-100)
// - Max depth (selector: 1-5)
// - Include/exclude paths (optional)
// - Advanced options (collapsible)
```

### DocumentUploadForm
```typescript
interface DocumentUploadFormProps {
  onSubmit: (files: File[], metadata: any) => Promise<void>;
  onCancel: () => void;
}

// Features:
// - Drag & drop zone
// - Multi-file upload
// - File type validation
// - Size validation
// - Preview before upload
// - Type categorization (media kit, guidelines, etc.)
```

### YouTubeForm
```typescript
interface YouTubeFormProps {
  onSubmit: (data: YouTubeData) => Promise<void>;
  onCancel: () => void;
}

// Fields:
// - URL (YouTube video or channel)
// - Type detection (auto)
// - Options (captions, comments, max videos)
// - Preview (thumbnail, title, channel)
```

### ManualInputForm
```typescript
interface ManualInputFormProps {
  onSubmit: (data: ManualInputData) => Promise<void>;
  onCancel: () => void;
}

// Fields:
// - Title (required)
// - Category (dropdown)
// - Content (rich text editor)
// - Tags (multi-select)
// - Priority (slider)
```

---

## Data Flow Patterns

### Pattern 1: Source Ingestion Flow

```
User Input (Form)
    ↓
Validation (Client-side)
    ↓
Submit to API
    ↓
Create Artifact (Firestore)
    ↓
Start Background Job
    ↓
Update UI (Optimistic)
    ↓
Real-time Status Updates (WebSocket/Polling)
    ↓
Job Complete → Update Artifact
    ↓
Notify User (Toast + Badge)
    ↓
Redirect to Review
```

### Pattern 2: Insight Review Flow

```
Load Artifact + Insights
    ↓
Display in Tabs
    ↓
User Reviews Each Section
    ↓
(Optional) User Edits
    ↓
Detect Conflicts with Existing Soul
    ↓
Show Conflict Resolution UI
    ↓
User Approves/Rejects
    ↓
If Approved → Merge into Brand Soul
    ↓
Trigger Synthesis (if needed)
    ↓
Publish New Version
    ↓
Success Message
```

### Pattern 3: Brand Soul Usage Flow

```
User Creates Campaign
    ↓
Campaign API checks for Brand Soul
    ↓
If exists → Fetch Brand Soul
    ↓
Inject into Gemini System Prompt
    ↓
Query RAG for Relevant Facts
    ↓
Generate Campaign with Brand Context
    ↓
Content matches brand voice ✓
```

---

## State Management Strategy

### Global State (Context)
- Brand soul data (current version)
- Artifacts list
- Processing jobs
- Configuration

### Local Component State
- Form inputs
- UI state (modals, tabs)
- Validation errors
- Temporary uploads

### Server State (React Query/SWR)
- API responses
- Background job status
- Real-time updates

### Recommendation: Use React Query

```typescript
// Example: Fetch brand soul
const { data: brandSoul, isLoading, refetch } = useQuery({
  queryKey: ['brandSoul', brandId],
  queryFn: () => fetchBrandSoul(brandId),
  enabled: !!brandId,
  refetchInterval: 30000, // Refetch every 30s
});

// Example: Processing job status
const { data: job } = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => fetchJobStatus(jobId),
  enabled: !!jobId && job?.status !== 'completed',
  refetchInterval: 2000, // Poll every 2s while active
});
```

---

## Integration with Existing Components

### Extend BrandDataProvider

**Current**: Provides `brandProfile`, `images`, `videos`

**Extension**: Add brand soul data

```typescript
interface ExtendedBrandDataContextType {
  // Existing
  brandProfile: BrandProfile | null;
  images: EditedImage[];
  videos: Video[];
  
  // NEW: Brand Soul
  brandSoul: BrandSoul | null;
  brandSoulLoading: boolean;
  brandSoulStats: BrandSoulStats;
  
  // NEW: Refetch methods
  refetch: {
    profile: () => Promise<void>;
    images: () => Promise<void>;
    videos: () => Promise<void>;
    brandSoul: () => Promise<void>;  // NEW
    all: () => Promise<void>;
  };
}
```

**Migration Plan**:
- Option A: Extend BrandDataProvider (simpler)
- Option B: Create separate BrandSoulProvider (cleaner separation) ← **Recommended**

### Enhance Campaign Generator

**Location**: `src/components/campaign-generator.tsx` (or wherever it is)

**Before Generation**:
```typescript
const generateCampaign = async (prompt: string) => {
  // NEW: Fetch brand soul
  const brandSoul = await getBrandSoul(brandId);
  
  // NEW: Build enhanced prompt
  const enhancedPrompt = buildPromptWithBrandContext(prompt, brandSoul);
  
  // Existing: Generate campaign
  const campaign = await generateCampaignAction(enhancedPrompt, brandId);
  
  return campaign;
};

function buildPromptWithBrandContext(prompt: string, soul: BrandSoul): string {
  return `
Generate a marketing campaign with the following requirements:
${prompt}

BRAND CONTEXT (maintain this voice and messaging):
- Tone: ${soul.voiceProfile.tone.primary}
- Values: ${soul.messagingFramework.values.map(v => v.name).join(', ')}
- Key Messages: ${soul.messagingFramework.keyMessages.map(m => m.theme).join(', ')}

Use this voice in all content.
  `;
}
```

### Enhance Global AI Chatbot

**Location**: `src/components/gemini-chatbot.tsx`

**Enhancement**: Add brand context to system messages

```typescript
const GeminiChatbot = ({ brandId }: GeminiChatbotProps) => {
  const { brandSoul } = useBrandSoul(); // NEW
  
  // When sending message to Gemini
  const sendMessage = async (userMessage: string) => {
    // Build messages with brand context
    const systemMessage = brandSoul 
      ? buildBrandContextMessage(brandSoul)
      : null;
    
    const messages = [
      ...(systemMessage ? [systemMessage] : []),
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    // Send to API
    await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, mode, brandId }),
    });
  };
};
```

---

## Component File Structure

```
src/
├── components/
│   └── brand-soul/
│       ├── setup-wizard/
│       │   ├── index.tsx                 (Main wizard)
│       │   ├── welcome-step.tsx
│       │   ├── website-crawl-step.tsx
│       │   ├── document-upload-step.tsx
│       │   ├── youtube-step.tsx
│       │   ├── manual-input-step.tsx
│       │   ├── processing-step.tsx
│       │   └── review-step.tsx
│       │
│       ├── dashboard/
│       │   ├── index.tsx                 (Main dashboard)
│       │   ├── health-score-panel.tsx
│       │   ├── quick-actions.tsx
│       │   ├── sources-list.tsx
│       │   ├── pending-reviews.tsx
│       │   └── suggestions-panel.tsx
│       │
│       ├── viewer/
│       │   ├── index.tsx                 (Brand soul viewer)
│       │   ├── voice-profile-display.tsx
│       │   ├── fact-library-explorer.tsx
│       │   ├── messaging-display.tsx
│       │   └── visual-identity-display.tsx
│       │
│       ├── source-manager/
│       │   ├── index.tsx
│       │   ├── source-list.tsx
│       │   ├── source-card.tsx
│       │   ├── add-source-modal.tsx
│       │   └── source-detail-modal.tsx
│       │
│       ├── forms/
│       │   ├── website-crawl-form.tsx
│       │   ├── document-upload-form.tsx
│       │   ├── youtube-form.tsx
│       │   ├── link-form.tsx
│       │   └── manual-input-form.tsx
│       │
│       └── ui/
│           ├── progress-timeline.tsx
│           ├── confidence-indicator.tsx
│           ├── source-type-icon.tsx
│           ├── conflict-badge.tsx
│           ├── health-gauge.tsx
│           └── processing-status.tsx
│
├── contexts/
│   └── brand-soul-context.tsx        (Global state)
│
├── lib/
│   ├── types/
│   │   └── brand-soul.ts             (All TypeScript interfaces)
│   │
│   └── brand-soul/
│       ├── api-client.ts             (API wrapper functions)
│       ├── validators.ts             (Input validation)
│       ├── formatters.ts             (Display formatting)
│       └── utils.ts                  (Helper functions)
│
└── app/
    ├── api/
    │   └── brand-soul/
    │       ├── ingest/
    │       │   ├── website/route.ts
    │       │   ├── document/route.ts
    │       │   ├── youtube/route.ts
    │       │   ├── link/route.ts
    │       │   └── manual/route.ts
    │       ├── artifact/[id]/route.ts
    │       ├── artifacts/route.ts
    │       ├── approve/[id]/route.ts
    │       ├── reject/[id]/route.ts
    │       ├── current/route.ts
    │       ├── synthesize/route.ts
    │       ├── history/route.ts
    │       ├── rollback/route.ts
    │       ├── config/route.ts
    │       └── search/route.ts
    │
    └── settings/
        └── brand-soul/
            ├── page.tsx              (Dashboard)
            ├── setup/page.tsx        (Setup wizard)
            ├── sources/page.tsx      (Source management)
            ├── history/page.tsx      (Version history)
            └── viewer/page.tsx       (Brand soul viewer)
```

---

## Backend Service Components

### Processing Workers

**Location**: `src/lib/workers/` or Cloud Functions

#### WebsiteCrawler
```typescript
class WebsiteCrawler {
  async crawl(url: string, options: CrawlOptions): Promise<CrawlResult> {
    // 1. Validate URL
    // 2. Check robots.txt
    // 3. Parse sitemap
    // 4. Queue pages
    // 5. Crawl each page
    // 6. Extract content
    // 7. Store results
  }
}
```

#### DocumentParser
```typescript
class DocumentParser {
  async parse(gcsPath: string, fileType: string): Promise<ParseResult> {
    // 1. Download from GCS
    // 2. Extract text (PDF.js, Mammoth)
    // 3. Extract images
    // 4. Parse structure
    // 5. Return structured data
  }
}
```

#### GeminiExtractor
```typescript
class GeminiExtractor {
  async extract(content: string, sourceType: string): Promise<ExtractedInsights> {
    // 1. Build extraction prompt
    // 2. Call Gemini API
    // 3. Parse JSON response
    // 4. Validate insights
    // 5. Calculate confidence
    // 6. Return structured insights
  }
}
```

#### BrandSoulSynthesizer
```typescript
class BrandSoulSynthesizer {
  async synthesize(artifacts: BrandArtifact[]): Promise<BrandSoul> {
    // 1. Collect all approved insights
    // 2. Resolve conflicts
    // 3. Build synthesis prompt
    // 4. Call Gemini Pro for deep analysis
    // 5. Generate embeddings (RAG)
    // 6. Create brand soul object
    // 7. Publish new version
  }
}
```

---

## Testing Strategy

### Unit Tests
- Form validation logic
- Data transformation functions
- Utility functions
- State management (Context)

### Integration Tests
- API endpoint responses
- Database operations
- File upload flows
- Processing pipeline

### E2E Tests (Playwright)
- Complete setup wizard flow
- Source addition and approval
- Conflict resolution
- Version rollback

### Visual Regression Tests
- Component screenshots
- Responsive layouts
- Dark mode variations

---

## Performance Optimization

### Code Splitting
```typescript
// Lazy load wizard only when needed
const BrandSoulSetupWizard = dynamic(
  () => import('@/components/brand-soul/setup-wizard'),
  { loading: () => <LoadingSkeleton /> }
);
```

### Memoization
```typescript
// Expensive calculations
const healthScore = useMemo(() => 
  calculateHealthScore(brandSoul, artifacts),
  [brandSoul, artifacts]
);

// Event handlers
const handleApprove = useCallback(async (artifactId: string) => {
  await approveInsights(artifactId);
}, [approveInsights]);
```

### Virtualization
```typescript
// For large fact libraries
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={facts.length}
  itemSize={100}
>
  {FactRow}
</FixedSizeList>
```

---

## Accessibility Implementation

### Keyboard Navigation
```typescript
// Wizard steps
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight') nextStep();
  if (e.key === 'ArrowLeft') previousStep();
  if (e.key === 'Escape') onCancel();
};
```

### Screen Reader Support
```typescript
// ARIA live regions for status updates
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
>
  {processingStatus}
</div>

// ARIA labels for icons
<Globe aria-label="Website source" />
```

### Focus Management
```typescript
// Auto-focus on modal open
const modalRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (isOpen) {
    modalRef.current?.focus();
  }
}, [isOpen]);
```

---

## Error Boundary Strategy

### Component-Level Error Boundaries

```typescript
// Wrap each major section
<ErrorBoundary fallback={<ErrorFallback />}>
  <BrandSoulSetupWizard />
</ErrorBoundary>

<ErrorBoundary fallback={<DashboardError />}>
  <BrandSoulDashboard />
</ErrorBoundary>
```

### Graceful Degradation

```typescript
// If brand soul fails to load, show basic mode
{brandSoul ? (
  <EnhancedCampaignGenerator brandSoul={brandSoul} />
) : (
  <BasicCampaignGenerator />
)}
```

---

## Next: Implementation Roadmap
See `06-implementation-roadmap.md` for phased development plan.
