# Brand Soul Seeding - API Specifications

## Base URL
All endpoints: `/api/brand-soul/*`

## Authentication
All endpoints require Firebase Authentication with valid `brandId` in user profile.

---

## 1. Ingestion Endpoints

### 1.1 Website Crawl

**Endpoint**: `POST /api/brand-soul/ingest/website`

**Purpose**: Start crawling a website to extract brand content

**Request Body**:
```typescript
{
  url: string;                       // Website URL (must be valid domain)
  options?: {
    maxPages?: number;               // Default: 50
    maxDepth?: number;               // Default: 3
    includeSitemap?: boolean;        // Default: true
    followExternalLinks?: boolean;   // Default: false
    includePaths?: string[];         // Only crawl these paths
    excludePaths?: string[];         // Skip these paths
    respectRobotsTxt?: boolean;      // Default: true
  };
  priority?: number;                 // 1-10, default: 5
}
```

**Response**:
```typescript
{
  success: boolean;
  artifactId: string;                // Track this crawl job
  jobId: string;                     // Background job ID
  estimatedCompletion: string;       // ISO timestamp
  message: string;
}
```

**Status Codes**:
- `200` - Crawl started successfully
- `400` - Invalid URL or parameters
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `500` - Server error

---

### 1.2 Document Upload

**Endpoint**: `POST /api/brand-soul/ingest/document`

**Purpose**: Upload and parse brand documents (PDF, DOCX, PPTX)

**Request**: `multipart/form-data`
```typescript
{
  file: File;                        // The document file
  type: 'media-kit' | 'brand-guidelines' | 'press-release' | 'other';
  description?: string;              // Optional description
  tags?: string[];                   // Optional tags
  priority?: number;                 // 1-10, default: 5
}
```

**Response**:
```typescript
{
  success: boolean;
  artifactId: string;
  gcsPath: string;                   // Where file was stored
  jobId: string;                     // Parsing job ID
  fileSize: number;                  // Bytes
  message: string;
}
```

**Validation**:
- Max file size: 50MB
- Allowed types: PDF, DOCX, PPTX, TXT
- Virus scanning (before processing)

**Status Codes**:
- `200` - Upload successful
- `400` - Invalid file or too large
- `401` - Unauthorized
- `413` - Payload too large
- `500` - Server error

---

### 1.3 YouTube Analysis

**Endpoint**: `POST /api/brand-soul/ingest/youtube`

**Purpose**: Analyze YouTube videos or channels for brand content

**Request Body**:
```typescript
{
  url: string;                       // YouTube video or channel URL
  type: 'video' | 'channel';
  options?: {
    includeComments?: boolean;       // Analyze top comments
    maxVideos?: number;              // For channels, default: 10
    extractCaptions?: boolean;       // Default: true
  };
  priority?: number;
}
```

**Response**:
```typescript
{
  success: boolean;
  artifactId: string;
  jobId: string;
  videoCount?: number;               // For channel analysis
  estimatedCompletion: string;
  message: string;
}
```

**API Requirements**:
- YouTube Data API v3 key
- Quota: 10,000 units/day (sufficient for ~100 videos)

**Status Codes**:
- `200` - Analysis started
- `400` - Invalid YouTube URL
- `401` - Unauthorized
- `403` - YouTube API quota exceeded
- `500` - Server error

---

### 1.4 Link/Article Extraction

**Endpoint**: `POST /api/brand-soul/ingest/link`

**Purpose**: Extract content from external links (articles, blog posts, press)

**Request Body**:
```typescript
{
  url: string;                       // Article or page URL
  type: 'article' | 'press-release' | 'blog-post' | 'other';
  expectedContent?: string;          // Hint about what to extract
  priority?: number;
}
```

**Response**:
```typescript
{
  success: boolean;
  artifactId: string;
  title?: string;                    // Extracted title
  author?: string;                   // If found
  publishedDate?: string;            // If found
  wordCount: number;
  message: string;
}
```

**Status Codes**:
- `200` - Content extracted
- `400` - Invalid URL or unreachable
- `401` - Unauthorized
- `500` - Server error

---

### 1.5 Manual Text Input

**Endpoint**: `POST /api/brand-soul/ingest/manual`

**Purpose**: Add manual text input about the brand

**Request Body**:
```typescript
{
  title: string;                     // Title for this entry
  content: string;                   // The text content
  category?: string;                 // e.g., "values", "history", "products"
  tags?: string[];
  priority?: number;
}
```

**Response**:
```typescript
{
  success: boolean;
  artifactId: string;
  wordCount: number;
  message: string;
}
```

**Validation**:
- Max content length: 50,000 characters
- Min content length: 100 characters
- Title required (max 200 chars)

---

## 2. Status & Queue Management

### 2.1 Get Artifact Status

**Endpoint**: `GET /api/brand-soul/artifact/{artifactId}`

**Response**:
```typescript
{
  artifact: BrandArtifact;           // Full artifact object
  job?: ProcessingJob;               // Current job if processing
  insights?: ExtractedInsights;      // If extraction complete
}
```

---

### 2.2 Get All Brand Artifacts

**Endpoint**: `GET /api/brand-soul/artifacts?status={status}&type={type}&limit={limit}`

**Query Parameters**:
- `status`: Filter by status (optional)
- `type`: Filter by artifact type (optional)
- `limit`: Max results (default: 100)
- `offset`: Pagination offset (default: 0)

**Response**:
```typescript
{
  artifacts: BrandArtifact[];
  total: number;
  hasMore: boolean;
  stats: {
    pending: number;
    processing: number;
    extracted: number;
    approved: number;
    rejected: number;
    failed: number;
  };
}
```

---

### 2.3 Get Processing Queue

**Endpoint**: `GET /api/brand-soul/queue`

**Response**:
```typescript
{
  jobs: ProcessingJob[];
  totalJobs: number;
  activeJobs: number;
  queuedJobs: number;
  estimatedWaitTime: number;         // Seconds
}
```

---

## 3. Review & Approval

### 3.1 Review Extracted Insights

**Endpoint**: `GET /api/brand-soul/review/{artifactId}`

**Response**:
```typescript
{
  artifact: BrandArtifact;
  insights: ExtractedInsights;
  suggestedMerges: {
    voiceProfile: Partial<VoiceProfile>;
    facts: BrandFact[];
    messages: KeyMessageTheme[];
    visual: Partial<VisualIdentity>;
  };
  conflicts?: Conflict[];            // If insights conflict with existing
}

interface Conflict {
  field: string;
  existingValue: any;
  newValue: any;
  suggestedResolution: 'keep' | 'replace' | 'merge';
  reason: string;
}
```

---

### 3.2 Approve Insights

**Endpoint**: `POST /api/brand-soul/approve/{artifactId}`

**Request Body**:
```typescript
{
  approved: boolean;
  edits?: Partial<ExtractedInsights>; // Manager can edit before approving
  notes?: string;                     // Approval notes
  publishImmediately?: boolean;       // Default: true
}
```

**Response**:
```typescript
{
  success: boolean;
  artifact: BrandArtifact;           // Updated status
  brandSoul?: BrandSoul;             // If published
  newVersionId?: string;             // If new version created
  message: string;
}
```

---

### 3.3 Reject Insights

**Endpoint**: `POST /api/brand-soul/reject/{artifactId}`

**Request Body**:
```typescript
{
  reason: string;                    // Why rejected
  deleteSource?: boolean;            // Also delete the artifact
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

---

## 4. Brand Soul Management

### 4.1 Get Current Brand Soul

**Endpoint**: `GET /api/brand-soul/current`

**Response**:
```typescript
{
  brandSoul: BrandSoul | null;
  exists: boolean;
  needsSeeding: boolean;             // True if no soul exists
  completeness: number;              // 0-100
  lastUpdated: string;               // ISO timestamp
}
```

---

### 4.2 Trigger Synthesis

**Endpoint**: `POST /api/brand-soul/synthesize`

**Purpose**: Manually trigger re-synthesis of brand soul from all approved sources

**Request Body**:
```typescript
{
  includeArtifactIds?: string[];     // Specific artifacts to include
  excludeArtifactIds?: string[];     // Artifacts to exclude
  forceUpdate?: boolean;             // Ignore cache, regenerate all
  publishDraft?: boolean;            // Publish immediately or save as draft
}
```

**Response**:
```typescript
{
  success: boolean;
  jobId: string;
  estimatedCompletion: string;
  message: string;
}
```

---

### 4.3 Get Brand Soul History

**Endpoint**: `GET /api/brand-soul/history?limit={limit}`

**Response**:
```typescript
{
  versions: BrandSoulVersion[];
  currentVersionId: string;
  totalVersions: number;
}
```

---

### 4.4 Rollback to Previous Version

**Endpoint**: `POST /api/brand-soul/rollback`

**Request Body**:
```typescript
{
  versionId: string;                 // Version to rollback to
  reason: string;                    // Why rolling back
}
```

**Response**:
```typescript
{
  success: boolean;
  brandSoul: BrandSoul;
  newVersionId: string;              // New version created from rollback
  message: string;
}
```

---

## 5. Configuration

### 5.1 Update Brand Soul Config

**Endpoint**: `PATCH /api/brand-soul/config`

**Request Body**: `Partial<BrandSoulConfig>`

**Example**:
```typescript
{
  autoApprove: true,
  minimumConfidence: 80,
  maxPagesPerCrawl: 100,
  enableAutoRefresh: true,
  refreshInterval: 30  // days
}
```

**Response**:
```typescript
{
  success: boolean;
  config: BrandSoulConfig;
  message: string;
}
```

---

## 6. Search & Query

### 6.1 Search Brand Knowledge

**Endpoint**: `POST /api/brand-soul/search`

**Purpose**: Semantic search over brand knowledge base (RAG)

**Request Body**:
```typescript
{
  query: string;                     // Natural language query
  limit?: number;                    // Max results, default: 10
  category?: string;                 // Filter by category
  minConfidence?: number;            // Min confidence score
}
```

**Response**:
```typescript
{
  results: SearchResult[];
  totalResults: number;
}

interface SearchResult {
  text: string;
  sourceArtifactId: string;
  sourceType: string;
  category: string;
  confidence: number;
  relevanceScore: number;            // Similarity score
  context?: string;                  // Surrounding text
}
```

---

## 7. Webhook Events (Future)

### Event Types

```typescript
type BrandSoulEvent = 
  | 'artifact.created'
  | 'artifact.processing'
  | 'artifact.extracted'
  | 'artifact.approved'
  | 'artifact.rejected'
  | 'artifact.failed'
  | 'soul.synthesizing'
  | 'soul.published'
  | 'soul.version.created';

interface WebhookPayload {
  event: BrandSoulEvent;
  brandId: string;
  timestamp: string;
  data: any;                         // Event-specific data
}
```

---

## Error Handling

### Standard Error Response

```typescript
{
  success: false;
  error: {
    code: string;                    // Error code (e.g., "INVALID_URL")
    message: string;                 // Human-readable message
    details?: any;                   // Additional error context
  };
  requestId: string;                 // For debugging
}
```

### Common Error Codes

```typescript
// Input validation
"INVALID_URL"
"INVALID_FILE_TYPE"
"FILE_TOO_LARGE"
"MISSING_REQUIRED_FIELD"

// Authentication & Authorization
"UNAUTHORIZED"
"FORBIDDEN"
"INVALID_BRAND_ID"

// Processing
"CRAWL_FAILED"
"PARSE_FAILED"
"EXTRACTION_FAILED"
"SYNTHESIS_FAILED"

// Rate limiting
"RATE_LIMIT_EXCEEDED"
"QUOTA_EXCEEDED"

// External services
"YOUTUBE_API_ERROR"
"CRAWLER_SERVICE_UNAVAILABLE"
"STORAGE_ERROR"
```

---

## Rate Limiting

### Per-Brand Limits (MVP)

```typescript
{
  crawls: {
    perHour: 5,                      // Max 5 crawls per hour
    perDay: 20,                      // Max 20 crawls per day
  },
  uploads: {
    perHour: 20,                     // Max 20 uploads per hour
    perDay: 100,                     // Max 100 uploads per day
  },
  synthesis: {
    perHour: 10,                     // Max 10 synthesis jobs per hour
  }
}
```

### Rate Limit Headers

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1634567890
```

---

## Background Job Processing

### Job Status Polling

**Endpoint**: `GET /api/brand-soul/job/{jobId}`

**Response**:
```typescript
{
  job: ProcessingJob;
  progress: number;                  // 0-100
  currentStep: string;
  estimatedTimeRemaining: number;    // Seconds
  logs?: string[];                   // Processing logs (if verbose)
}
```

### Job Cancellation

**Endpoint**: `DELETE /api/brand-soul/job/{jobId}`

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

---

## Webhook/SSE for Real-Time Updates (Phase 2)

### Server-Sent Events

**Endpoint**: `GET /api/brand-soul/events` (SSE)

**Event Stream**:
```
event: artifact.processing
data: {"artifactId": "abc123", "progress": 45}

event: artifact.extracted
data: {"artifactId": "abc123", "insights": {...}}

event: soul.published
data: {"versionId": "v5", "timestamp": "2025-10-12T..."}
```

---

## Integration with Content Generation

### Enhanced Campaign Generation

**Modified Endpoint**: `POST /api/campaigns/generate`

**New Request Field**:
```typescript
{
  // ... existing fields
  useBrandSoul?: boolean;            // Default: true if soul exists
  brandSoulContext?: {
    includeVoice: boolean;           // Include voice profile
    includeFacts: boolean;           // Include fact library
    includeMessaging: boolean;       // Include messaging framework
    includeVisual: boolean;          // Include visual identity
  };
}
```

**System Behavior**:
- If `brandSoul` exists, automatically inject context into Gemini prompts
- Use RAG to find relevant brand facts for campaign theme
- Apply voice profile constraints to generated content
- Reference key messages in content

### Enhanced Image Generation

**Modified Flow**: `src/ai/flows/generate-ai-images.ts`

**Prompt Enhancement**:
```typescript
// Before
const prompt = userPrompt;

// After (with Brand Soul)
const brandContext = await getBrandSoulContext(brandId);
const enhancedPrompt = `
${userPrompt}

Brand visual identity:
- Colors: ${brandContext.colors.join(', ')}
- Style: ${brandContext.imageStyle.join(', ')}
- Avoid: ${brandContext.avoidedElements.join(', ')}
`;
```

### Enhanced AI Chatbot

**Modified Endpoint**: `POST /api/chat`

**System Enhancement**:
- Before each Gemini request, fetch brand soul
- Inject brand context into system message
- Enable chatbot to reference brand facts
- Maintain brand voice in all responses

**Example System Message**:
```
You are an AI assistant helping with marketing for {brandName}.

Brand Voice:
- Tone: {tone}
- Values: {values}
- Key Messages: {keyMessages}

Brand Facts:
- {top 10 most relevant facts}

Always maintain this brand voice in your responses.
```

---

## Testing Endpoints (Development Only)

### Reset Brand Soul

**Endpoint**: `POST /api/brand-soul/dev/reset`

**Purpose**: Delete all brand soul data (for testing)

**Environment**: Development only

---

### Seed Sample Data

**Endpoint**: `POST /api/brand-soul/dev/seed-sample`

**Purpose**: Create sample brand soul for testing

**Environment**: Development only

---

## Next: UX Flows
See `04-ux-flows-and-user-journey.md` for detailed user experience design.
