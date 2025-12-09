# Brand Soul Seeding - Data Models & Schema

## Firestore Collections

### `brandArtifacts/{brandId}/sources/{artifactId}`

Stores metadata about all ingested brand sources.

```typescript
interface BrandArtifact {
  id: string;                    // Auto-generated artifact ID
  brandId: string;               // Reference to brand
  type: ArtifactType;            // Type of source
  source: SourceReference;       // URL or file reference
  status: ProcessingStatus;      // Current processing state
  metadata: ArtifactMetadata;    // Source-specific metadata
  extractedInsights?: ExtractedInsights; // AI-extracted data
  createdAt: Timestamp;          // When artifact was created
  createdBy: string;             // User ID who added this
  processedAt?: Timestamp;       // When processing completed
  approvedAt?: Timestamp;        // When insights were approved
  approvedBy?: string;           // Manager who approved
  rejectedAt?: Timestamp;        // If rejected
  rejectionReason?: string;      // Why rejected
  retryCount: number;            // Number of processing retries
  lastError?: string;            // Last error message if failed
  checksum?: string;             // For duplicate detection
  priority: number;              // Processing priority (1-10)
}

type ArtifactType = 
  | 'website-page'
  | 'website-sitemap'
  | 'document-pdf'
  | 'document-docx'
  | 'document-pptx'
  | 'youtube-video'
  | 'youtube-channel'
  | 'link-article'
  | 'link-press-release'
  | 'manual-text'
  | 'social-profile';

type ProcessingStatus =
  | 'pending'        // Queued for processing
  | 'processing'     // Currently being processed
  | 'extracting'     // AI extracting insights
  | 'extracted'      // Insights ready for review
  | 'approved'       // Approved by manager
  | 'rejected'       // Rejected by manager
  | 'failed'         // Processing failed
  | 'archived';      // Archived (no longer active)

interface SourceReference {
  url?: string;                  // For web sources
  gcsPath?: string;              // For uploaded files
  fileName?: string;             // Original file name
  fileSize?: number;             // Size in bytes
  mimeType?: string;             // File MIME type
}

interface ArtifactMetadata {
  title?: string;                // Page/document title
  description?: string;          // Brief description
  author?: string;               // Content author
  publishedDate?: string;        // Original publish date
  language?: string;             // Content language
  wordCount?: number;            // Text word count
  pageCount?: number;            // For documents
  duration?: number;             // For videos (seconds)
  tags?: string[];               // User-added tags
  customFields?: Record<string, any>; // Extensible metadata
}

interface ExtractedInsights {
  voiceElements?: VoiceElement[];     // Tone, style indicators
  facts?: ExtractedFact[];            // Factual information
  messages?: KeyMessage[];            // Key messaging themes
  visualElements?: VisualElement[];   // Colors, design preferences
  raw: string;                        // Raw AI response (JSON)
  extractedAt: Timestamp;             // When extraction happened
  model: string;                      // AI model used
  confidence: number;                 // Overall confidence (0-100)
}

interface VoiceElement {
  aspect: 'tone' | 'style' | 'personality' | 'formality';
  value: string;                      // e.g., "professional", "friendly"
  evidence: string[];                 // Text snippets supporting this
  confidence: number;                 // 0-100
}

interface ExtractedFact {
  category: string;                   // e.g., "product", "history", "value"
  fact: string;                       // The actual fact
  source: string;                     // Where it came from
  confidence: number;                 // How confident we are (0-100)
  extractedFrom: string;              // Text snippet
}

interface KeyMessage {
  theme: string;                      // Main theme
  message: string;                    // The key message
  frequency: number;                  // How often this appears
  importance: number;                 // Calculated importance (1-10)
}

interface VisualElement {
  type: 'color' | 'font' | 'style' | 'imagery';
  value: string;
  context: string;
}
```

---

### `brandSoul/{brandId}`

The published, current brand soul for a brand.

```typescript
interface BrandSoul {
  brandId: string;
  latestVersionId: string;           // Points to current version
  status: 'draft' | 'published' | 'updating';
  
  // Core Brand Soul Components
  voiceProfile: VoiceProfile;
  factLibrary: FactLibrary;
  messagingFramework: MessagingFramework;
  visualIdentity?: VisualIdentity;
  
  // Metadata
  createdAt: Timestamp;
  lastUpdatedAt: Timestamp;
  lastPublishedAt: Timestamp;
  lastUpdatedBy: string;
  
  // Statistics
  stats: BrandSoulStats;
  
  // Configuration
  config: BrandSoulConfig;
}

interface VoiceProfile {
  tone: ToneProfile;
  personality: PersonalityTraits;
  writingStyle: WritingStyle;
  vocabulary: VocabularyPreferences;
  formality: number;                 // 1-10 scale (casual to formal)
  enthusiasm: number;                // 1-10 scale (reserved to enthusiastic)
  expertise: number;                 // 1-10 scale (approachable to technical)
}

interface ToneProfile {
  primary: string;                   // e.g., "professional"
  secondary: string[];               // e.g., ["friendly", "innovative"]
  avoid: string[];                   // e.g., ["aggressive", "salesy"]
  examples: string[];                // Example sentences in brand voice
  confidence: number;                // How confident we are (0-100)
}

interface PersonalityTraits {
  traits: Array<{
    name: string;                    // e.g., "innovative", "trustworthy"
    strength: number;                // 1-10
    evidence: string[];              // Supporting quotes
  }>;
  archetype?: string;                // Brand archetype (e.g., "Hero", "Sage")
}

interface WritingStyle {
  sentenceLength: 'short' | 'medium' | 'long' | 'varied';
  paragraphStructure: string;
  punctuationStyle: string;
  preferredPhrases: string[];
  avoidedPhrases: string[];
}

interface VocabularyPreferences {
  preferredTerms: Record<string, string>; // e.g., "customers" vs "clients"
  industryJargon: string[];          // Acceptable technical terms
  bannedWords: string[];             // Words to avoid
  brandSpecificTerms: string[];      // Unique brand terminology
}

interface FactLibrary {
  facts: BrandFact[];
  categories: string[];              // Auto-generated categories
  totalFacts: number;
  lastUpdated: Timestamp;
}

interface BrandFact {
  id: string;
  category: string;                  // e.g., "product", "company", "achievement"
  fact: string;                      // The actual fact
  sources: FactSource[];             // Multiple sources can support one fact
  confidence: number;                // Aggregate confidence (0-100)
  importance: number;                // How important is this fact (1-10)
  lastVerified: Timestamp;
  tags: string[];
  relatedFacts: string[];            // IDs of related facts
}

interface FactSource {
  artifactId: string;                // Reference to source artifact
  snippet: string;                   // Text snippet where fact was found
  confidence: number;                // This source's confidence
  priority: number;                  // Source priority (official > third-party)
}

interface MessagingFramework {
  mission?: string;                  // Company mission
  vision?: string;                   // Company vision
  values: CoreValue[];
  taglines: string[];
  keyMessages: KeyMessageTheme[];
  elevator Pitch?: string;
}

interface CoreValue {
  name: string;                      // e.g., "Innovation"
  description: string;               // What it means
  howWeShowIt: string[];             // Examples
  importance: number;                // 1-10
}

interface KeyMessageTheme {
  theme: string;                     // e.g., "Sustainability"
  messages: string[];                // Key messages under this theme
  targetAudience: string[];          // Who this resonates with
  frequency: number;                 // How often this appears in sources
  priority: number;                  // 1-10
}

interface VisualIdentity {
  colors: BrandColor[];
  typography?: Typography;
  imageStyle?: ImageStyle;
  logoGuidelines?: string;
}

interface BrandColor {
  name: string;                      // e.g., "Primary Blue"
  hex: string;                       // #0066CC
  rgb: string;                       // rgb(0, 102, 204)
  usage: string;                     // When to use this color
  associations: string[];            // What this color represents
}

interface Typography {
  primaryFont?: string;
  secondaryFont?: string;
  headingStyle?: string;
  bodyTextStyle?: string;
}

interface ImageStyle {
  style: string[];                   // e.g., ["modern", "minimalist"]
  preferredSubjects: string[];
  avoidedElements: string[];
  colorTreatment: string;
}

interface BrandSoulStats {
  totalSources: number;
  approvedSources: number;
  pendingSources: number;
  totalFacts: number;
  confidenceScore: number;           // Overall confidence (0-100)
  completeness: number;              // How complete is the profile (0-100)
  lastIngestionDate: Timestamp;
}

interface BrandSoulConfig {
  autoApprove: boolean;              // Auto-approve high-confidence insights
  minimumConfidence: number;         // Threshold for auto-approval
  enableWebCrawling: boolean;
  crawlDepth: number;                // Max crawl depth
  maxPagesPerCrawl: number;
  enableAutoRefresh: boolean;        // Periodic re-crawling
  refreshInterval: number;           // Days between refreshes
}
```

---

### `brandSoulVersions/{brandId}/versions/{versionId}`

Historical versions of brand soul for audit trail and rollback.

```typescript
interface BrandSoulVersion {
  versionId: string;                 // v1, v2, v3, etc.
  brandId: string;
  
  // Snapshot of brand soul at this version
  voiceProfile: VoiceProfile;
  factLibrary: FactLibrary;
  messagingFramework: MessagingFramework;
  visualIdentity?: VisualIdentity;
  
  // Version metadata
  createdAt: Timestamp;
  createdBy: string;                 // User who published this version
  publishReason: string;             // Why this version was created
  
  // Change tracking
  changes: VersionChange[];
  previousVersionId?: string;
  
  // Statistics snapshot
  stats: BrandSoulStats;
}

interface VersionChange {
  type: 'added' | 'modified' | 'removed';
  component: 'voiceProfile' | 'factLibrary' | 'messaging' | 'visual';
  field: string;                     // Specific field changed
  oldValue?: any;
  newValue?: any;
  reason?: string;                   // Why this change was made
}
```

---

### `processingQueue/{brandId}/jobs/{jobId}`

Queue for background processing jobs.

```typescript
interface ProcessingJob {
  jobId: string;
  brandId: string;
  type: 'crawl' | 'parse' | 'extract' | 'synthesize';
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: number;                  // 1-10, higher = more urgent
  
  // Job configuration
  config: JobConfig;
  
  // Progress tracking
  progress: number;                  // 0-100
  currentStep?: string;              // What's happening now
  totalSteps: number;
  completedSteps: number;
  
  // Timing
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  estimatedCompletion?: Timestamp;
  
  // Results
  result?: any;
  error?: JobError;
  
  // Retry logic
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Timestamp;
}

interface JobConfig {
  artifactIds?: string[];            // Related artifacts
  parameters?: Record<string, any>;  // Job-specific parameters
}

interface JobError {
  code: string;
  message: string;
  stack?: string;
  timestamp: Timestamp;
  recoverable: boolean;              // Can this be retried?
}
```

---

## Google Cloud Storage Structure

```
gs://advantage-brand-assets/{brandId}/
  soul/
    documents/
      {artifactId}/
        original.pdf
        extracted.txt
        images/
          image-1.png
          image-2.png
    
    crawled-pages/
      {artifactId}/
        page.html
        page.txt
        metadata.json
    
    youtube/
      {artifactId}/
        transcript.txt
        metadata.json
    
    raw-sources/
      {timestamp}-source-backup.json
    
    embeddings/
      {versionId}/
        chunks-metadata.json
```

---

## Vector Database Schema (RAG)

Using existing RAG vector database with brand-specific namespaces.

```typescript
interface BrandKnowledgeChunk {
  id: string;
  brandId: string;
  versionId: string;                 // Brand soul version
  
  // Content
  text: string;                      // The actual text chunk
  embedding: number[];               // Vector embedding
  
  // Metadata for retrieval
  sourceArtifactId: string;
  sourceType: ArtifactType;
  category: string;                  // "voice", "fact", "message", etc.
  importance: number;                // 1-10
  confidence: number;                // 0-100
  
  // Context
  precedingText?: string;            // For better context
  followingText?: string;
  
  // Indexing
  tags: string[];
  keywords: string[];
  entities: string[];                // Named entities (products, people, etc.)
  
  createdAt: Timestamp;
}
```

---

## TypeScript Interfaces Summary

All interfaces will be defined in: `src/lib/types/brand-soul.ts`

```typescript
// Export all types
export type {
  // Artifacts
  BrandArtifact,
  ArtifactType,
  ProcessingStatus,
  SourceReference,
  ArtifactMetadata,
  ExtractedInsights,
  VoiceElement,
  ExtractedFact,
  KeyMessage,
  VisualElement,
  
  // Brand Soul
  BrandSoul,
  VoiceProfile,
  ToneProfile,
  PersonalityTraits,
  WritingStyle,
  VocabularyPreferences,
  FactLibrary,
  BrandFact,
  FactSource,
  MessagingFramework,
  CoreValue,
  KeyMessageTheme,
  VisualIdentity,
  BrandColor,
  Typography,
  ImageStyle,
  BrandSoulStats,
  BrandSoulConfig,
  
  // Versions
  BrandSoulVersion,
  VersionChange,
  
  // Processing
  ProcessingJob,
  JobConfig,
  JobError,
  
  // RAG
  BrandKnowledgeChunk,
};
```

---

## Database Indexes

### Firestore Composite Indexes

```
Collection: brandArtifacts/{brandId}/sources
- brandId + status (ASC) + createdAt (DESC)
- brandId + type (ASC) + status (ASC)
- brandId + createdBy (ASC) + createdAt (DESC)
- brandId + approvedBy (ASC) + approvedAt (DESC)

Collection: processingQueue/{brandId}/jobs
- brandId + status (ASC) + priority (DESC)
- brandId + type (ASC) + createdAt (DESC)
```

---

## Data Validation Rules

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Brand artifacts - only brand members can read/write
    match /brandArtifacts/{brandId}/sources/{artifactId} {
      allow read: if request.auth != null && 
                     isClientAuthorized(request.auth.token.userId, brandId);
      allow create: if request.auth != null && 
                       isClientAuthorized(request.auth.token.userId, brandId);
      allow update: if request.auth != null && 
                       isClientAuthorized(request.auth.token.userId, brandId) &&
                       (isManager(request.auth.token.userId, brandId) || 
                        resource.data.createdBy == request.auth.token.userId);
      allow delete: if request.auth != null && 
                       isManager(request.auth.token.userId, brandId);
    }
    
    // Brand soul - read by members, write by managers only
    match /brandSoul/{brandId} {
      allow read: if request.auth != null && 
                     isClientAuthorized(request.auth.token.userId, brandId);
      allow write: if request.auth != null && 
                      isManager(request.auth.token.userId, brandId);
    }
    
    // Brand soul versions - read-only for all brand members
    match /brandSoulVersions/{brandId}/versions/{versionId} {
      allow read: if request.auth != null && 
                     isClientAuthorized(request.auth.token.userId, brandId);
      allow write: if false; // Only server can write
    }
    
    // Helper functions
    function isClientAuthorized(userId, brandId) {
      return get(/databases/$(database)/documents/users/$(userId)).data.brandId == brandId;
    }
    
    function isManager(userId, brandId) {
      let user = get(/databases/$(database)/documents/users/$(userId)).data;
      return user.brandId == brandId && user.role == 'manager';
    }
  }
}
```

---

## Migration Strategy

For existing brands without brand soul:

```typescript
interface MigrationPlan {
  // Phase 1: Create empty brand soul
  createEmptyBrandSoul(brandId: string): Promise<void>;
  
  // Phase 2: Migrate existing brand profile data
  migrateBrandProfile(brandId: string): Promise<void>;
  
  // Phase 3: Prompt user to complete seeding
  promptUserToSeed(brandId: string): Promise<void>;
}
```

---

## Next: API Specifications
See `03-api-specifications.md` for detailed endpoint documentation.
