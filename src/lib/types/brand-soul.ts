// Brand Soul Seeding - Production Type Definitions
// Based on design doc: docs/brand-soul-seeding/02-data-models-and-schema.md

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Artifact visibility determines who can see and use the artifact's insights.
 * - 'private': Only the creator can see this artifact and its insights
 * - 'pending_approval': Visible to the creator, awaiting manager approval to become team-visible
 * - 'team': Visible to all team members and included in team synthesis
 */
export type ArtifactVisibility = 'private' | 'pending_approval' | 'team';

export type ArtifactType = 
  | 'website-page'
  | 'website-sitemap'
  | 'website'              // Generic website crawl
  | 'document-pdf'
  | 'document-docx'
  | 'document-pptx'
  | 'document'             // Generic document
  | 'image-jpg'
  | 'image-png'
  | 'image-webp'
  | 'image'                // Generic image
  | 'video-mp4'
  | 'video-mov'
  | 'video-webm'
  | 'video'                // Generic video
  | 'youtube-video'
  | 'youtube-channel'
  | 'link-article'
  | 'link-press-release'
  | 'manual-text'
  | 'social-profile';

export type ProcessingStatus =
  | 'pending'        // Queued for processing
  | 'processing'     // Currently being processed
  | 'extracting'     // AI extracting insights
  | 'extracted'      // Insights ready for review
  | 'approved'       // Approved by manager
  | 'rejected'       // Rejected by manager
  | 'failed'         // Processing failed
  | 'archived';      // Archived (no longer active)

export type BrandSoulStatus = 'draft' | 'published' | 'updating';

// ============================================================================
// Brand Artifacts (Sources)
// ============================================================================

export interface BrandArtifact {
  id: string;                           // Auto-generated artifact ID
  brandId: string;                      // Reference to brand
  type: ArtifactType;                   // Type of source
  source: SourceReference;              // URL or file reference
  status: ProcessingStatus;             // Current processing state
  metadata: ArtifactMetadata;           // Source-specific metadata

  // Large content stored in Firebase Storage (not in Firestore)
  contentRef?: ContentReference;        // Reference to stored content
  insightsRef?: InsightsReference;      // Reference to extracted insights
  documentRef?: ContentReference;       // Reference to original document file

  // Visibility and privacy controls
  visibility: ArtifactVisibility;       // Who can see this artifact ('private', 'pending_approval', 'team')

  // Processing info
  createdAt: Timestamp | string;        // When artifact was created
  createdBy: string;                    // User ID who added this
  processedAt?: Timestamp | string;     // When processing completed

  // Visibility approval workflow (for pending_approval -> team transition)
  proposedForTeamAt?: Timestamp | string;   // When submitted for team approval
  proposedForTeamBy?: string;               // User who submitted for team approval
  visibilityApprovedAt?: Timestamp | string; // When visibility was approved by manager
  visibilityApprovedBy?: string;            // Manager who approved visibility
  visibilityRejectedAt?: Timestamp | string; // When visibility was rejected
  visibilityRejectionReason?: string;       // Why visibility was rejected

  // Legacy approval fields (for insights approval - separate from visibility)
  approvedAt?: Timestamp | string;      // When insights were approved
  approvedBy?: string;                  // Manager who approved
  rejectedAt?: Timestamp | string;      // If rejected
  rejectionReason?: string;             // Why rejected

  retryCount: number;                   // Number of processing retries
  lastError?: string;                   // Last error message if failed
  checksum?: string;                    // For duplicate detection
  priority: number;                     // Processing priority (1-10)
}

export interface SourceReference {
  url?: string;                         // For web sources
  storagePath?: string;                 // For uploaded files (Firebase Storage)
  fileName?: string;                    // Original file name
  fileSize?: number;                    // Size in bytes
  fileType?: string;                    // File MIME type
  mimeType?: string;                    // File MIME type (alternative)
  crawledAt?: string;                   // When website was crawled
  uploadedAt?: string;                  // When file was uploaded
  [key: string]: any;                   // Allow additional source-specific metadata
}

export interface ContentReference {
  path: string;                         // Storage path to content
  size: number;                         // Content size in bytes
  checksum: string;                     // MD5 checksum
  storedAt: string;                     // ISO timestamp
}

export interface InsightsReference {
  path: string;                         // Storage path to insights JSON
  confidence: number;                   // Overall confidence score
  extractedAt: string;                  // ISO timestamp
  model: string;                        // AI model used
}

export interface ArtifactMetadata {
  title?: string;                       // Page/document title
  description?: string;                 // Brief description
  author?: string;                      // Content author
  publishedDate?: string;               // Original publish date
  language?: string;                    // Content language (ISO 639-1)
  wordCount?: number;                   // Text word count
  pageCount?: number;                   // For documents
  pagesCount?: number;                  // For multi-page crawls
  duration?: number;                    // For videos (seconds)
  fileName?: string;                    // File name
  fileType?: string;                    // File MIME type
  fileSize?: number;                    // File size in bytes
  url?: string;                         // URL if applicable
  urls?: string[];                      // Multiple URLs for crawls
  crawledAt?: string;                   // When crawled
  tags?: string[];                      // User-added tags
  customFields?: Record<string, any>;   // Extensible metadata
  [key: string]: any;                   // Allow additional metadata
}

// ============================================================================
// Image Extraction Options
// ============================================================================

export interface ImageExtractionOptions {
  maxImages?: number;         // Maximum number of images to extract (default: 10)
  minWidth?: number;          // Minimum image width in pixels
  minHeight?: number;         // Minimum image height in pixels
  keywords?: string[];        // Keywords to filter by (alt-text, filename)
}

// ============================================================================
// Extracted Insights (Stored in Firebase Storage as JSON)
// ============================================================================

export interface ExtractedInsights {
  voiceElements: VoiceElement[];        // Tone, style indicators
  facts: ExtractedFact[];               // Factual information
  messages: KeyMessage[];               // Key messaging themes
  visualElements: VisualElement[];      // Colors, design preferences
  raw: string;                          // Raw AI response (JSON)
  extractedAt: string;                  // ISO timestamp
  model: string;                        // AI model used (e.g., "gemini-2.5-flash")
  confidence: number;                   // Overall confidence (0-100)
  // Optional modification tracking fields
  modifiedAt?: string;                  // ISO timestamp when last modified
  modifiedBy?: string;                  // User ID who made the modification
}

export interface VoiceElement {
  aspect: 'tone' | 'style' | 'personality' | 'formality';
  value: string;                        // e.g., "professional", "friendly"
  evidence: string[];                   // Text snippets supporting this
  confidence: number;                   // 0-100
}

export interface ExtractedFact {
  category: string;                     // e.g., "product", "history", "value"
  fact: string;                         // The actual fact
  source: string;                       // Where it came from
  confidence: number;                   // How confident we are (0-100)
  extractedFrom: string;                // Text snippet
}

export interface KeyMessage {
  theme: string;                        // Main theme
  message: string;                      // The key message
  frequency: number;                    // How often this appears
  importance: number;                   // Calculated importance (1-10)
}

export interface VisualElement {
  type: 'color' | 'font' | 'style' | 'imagery' | 'avoid' | 'photographicPreference' | 'scenePreference';
  value: string;
  context: string;
}

// ============================================================================
// Brand Soul (Current Published State)
// ============================================================================

export interface BrandSoul {
  brandId: string;
  latestVersionId: string;              // Points to current version
  status: BrandSoulStatus;
  
  // Core Brand Soul Components
  voiceProfile: VoiceProfile;
  factLibrary: FactLibrary;
  messagingFramework: MessagingFramework;
  visualIdentity?: VisualIdentity;
  
  // Metadata
  createdAt: Timestamp | string;
  createdBy: string;                    // User ID who created the Brand Soul
  lastUpdatedAt: Timestamp | string;
  lastPublishedAt: Timestamp | string;
  lastUpdatedBy: string;
  
  // Statistics
  stats: BrandSoulStats;
  
  // Configuration
  config: BrandSoulConfig;
}

export interface VoiceProfile {
  tone: ToneProfile;
  personality: PersonalityTraits;
  writingStyle: WritingStyle;
  vocabulary: VocabularyPreferences;
  formality: number;                    // 1-10 scale (casual to formal)
  enthusiasm: number;                   // 1-10 scale (reserved to enthusiastic)
  expertise: number;                    // 1-10 scale (approachable to technical)
}

export interface ToneProfile {
  primary: string;                      // e.g., "professional"
  secondary: string[];                  // e.g., ["friendly", "innovative"]
  avoid: string[];                      // e.g., ["aggressive", "salesy"]
  examples: string[];                   // Example sentences in brand voice
  confidence: number;                   // How confident we are (0-100)
}

export interface PersonalityTraits {
  traits: Array<{
    name: string;                       // e.g., "innovative", "trustworthy"
    strength: number;                   // 1-10
    evidence: string[];                 // Supporting quotes
  }>;
  archetype?: string;                   // Brand archetype (e.g., "Hero", "Sage")
}

export interface WritingStyle {
  sentenceLength: 'short' | 'medium' | 'long' | 'varied';
  paragraphStructure: string;
  punctuationStyle: string;
  preferredPhrases: string[];
  avoidedPhrases: string[];
}

export interface VocabularyPreferences {
  preferredTerms: Record<string, string>; // e.g., "customers" vs "clients"
  industryJargon: string[];             // Acceptable technical terms
  bannedWords: string[];                // Words to avoid
  brandSpecificTerms: string[];         // Unique brand terminology
}

export interface FactLibrary {
  facts: BrandFact[];
  categories: string[];                 // Auto-generated categories
  totalFacts: number;
  lastUpdated: Timestamp | string;
}

export interface BrandFact {
  id: string;
  category: string;                     // e.g., "product", "company", "achievement"
  fact: string;                         // The actual fact
  sources: FactSource[];                // Multiple sources can support one fact
  confidence: number;                   // Aggregate confidence (0-100)
  importance: number;                   // How important is this fact (1-10)
  lastVerified: Timestamp | string;
  tags: string[];
  relatedFacts: string[];               // IDs of related facts
}

export interface FactSource {
  artifactId: string;                   // Reference to source artifact
  snippet: string;                      // Text snippet where fact was found
  confidence: number;                   // This source's confidence
  priority: number;                     // Source priority (official > third-party)
}

export interface MessagingFramework {
  mission?: string;                     // Company mission
  vision?: string;                      // Company vision
  values: CoreValue[];
  taglines: string[];
  keyMessages: KeyMessageTheme[];
  elevatorPitch?: string;
}

export interface CoreValue {
  name: string;                         // e.g., "Innovation"
  description: string;                  // What it means
  examples: string[];                   // How it's demonstrated
  sources: string[];                    // Artifact IDs that mention this
}

export interface KeyMessageTheme {
  theme: string;
  messages: string[];
  importance: number;                   // 1-10
  frequency: number;                    // How often it appears
}

export interface VisualIdentity {
  colors: ColorPalette;
  typography: Typography;
  imageStyle: ImageStyle;
}

export interface ColorPalette {
  primary: string[];                    // Hex colors
  secondary: string[];
  accent: string[];
  context: string;                      // Where these were found
}

export interface Typography {
  fonts: string[];
  style: string;
}

export interface ImageStyle {
  style: string;                        // e.g., "minimalist", "vibrant"
  subjects: string[];                   // Common subjects
  examples: string[];                   // URLs to example images
  
  // Phase 1 Enhanced Controls
  photographicPreferences?: PhotographicPreferences;
  scenePreferences?: ScenePreferences;
  avoid?: string[];                     // Elements to avoid in images (negative prompts)
}

// Phase 1: Photographic Preferences extracted from Brand Soul
export interface PhotographicPreferences {
  lighting?: {
    preferred: string[];                // e.g., ["natural", "soft", "golden-hour"]
    avoid?: string[];                   // e.g., ["harsh", "fluorescent"]
    context?: string;                   // Where this was detected
  };
  mood?: {
    preferred: string[];                // e.g., ["calm", "professional", "energetic"]
    avoid?: string[];                   // e.g., ["chaotic", "dark"]
    context?: string;
  };
  composition?: {
    preferred: string[];                // e.g., ["rule-of-thirds", "minimalist", "symmetrical"]
    context?: string;
  };
  shotPreferences?: {
    lens?: string[];                    // e.g., ["50mm", "macro"]
    framing?: string[];                 // e.g., ["close-up", "wide"]
    depthOfField?: string[];            // e.g., ["shallow", "deep"]
    context?: string;
  };
}

// Phase 1: Scene Preferences (which scene types are common for this brand)
export interface ScenePreferences {
  commonScenes: Array<{
    sceneType: string;                  // e.g., "human", "product", "ingredient"
    sceneSubtype: string;               // e.g., "lifestyle", "hero", "flatlay"
    frequency: number;                  // How often this scene appears (0-1)
    examples: string[];                 // URLs to example images
    confidence: number;                 // Confidence in this preference (0-100)
  }>;
  avoidScenes?: string[];               // Scene types to avoid
  context?: string;                     // Where these preferences were detected
}

export interface BrandSoulStats {
  totalSources: number;
  approvedSources: number;
  pendingSources: number;
  totalFacts: number;
  confidenceScore: number;              // Average confidence (0-100)
  lastSynthesisDate: Timestamp | string;
  healthScore: number;                  // Overall health (0-100)
}

export interface BrandSoulConfig {
  autoApprove: boolean;                 // Auto-approve high-confidence insights
  confidenceThreshold: number;          // Minimum confidence for auto-approve
  enableRAG: boolean;                   // Enable RAG embeddings
  synthesisFrequency: 'manual' | 'daily' | 'weekly';
  notifications: NotificationConfig;
}

export interface NotificationConfig {
  onNewSource: boolean;
  onInsightsReady: boolean;
  onSynthesisComplete: boolean;
  email?: string;
}

// ============================================================================
// Processing Jobs
// ============================================================================

export interface ProcessingJob {
  id: string;
  brandId: string;
  artifactId: string;
  type: 'extract-insights' | 'synthesize' | 'embed';
  status: ProcessingStatus;
  
  progress: number;                     // 0-100
  currentStep?: string;
  
  createdAt: Timestamp | string;
  startedAt?: Timestamp | string;
  completedAt?: Timestamp | string;
  
  retryCount: number;
  lastError?: string;
  
  // Job-specific data
  data?: Record<string, any>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface IngestWebsiteRequest {
  brandId: string;
  url: string;
  crawlSubpages?: boolean;              // Whether to crawl multiple pages
  maxPages?: number;                    // Default: 50 (max pages to crawl)
  maxDepth?: number;                    // Default: 3 (crawl depth)
  tags?: string[];                      // Optional tags
  imageOptions?: ImageExtractionOptions; // Image extraction options
}

export interface IngestDocumentRequest {
  brandId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  // File content uploaded separately via signed URL
}

export interface IngestManualTextRequest {
  brandId: string;
  title: string;
  content: string;
  tags?: string[];
}

export interface IngestResponse {
  success: boolean;
  artifactId?: string;
  jobId?: string;
  message: string;
}

export interface GetArtifactResponse {
  artifact: BrandArtifact;
  content?: string;                     // Large content (from storage)
  insights?: ExtractedInsights;         // Extracted insights (from storage)
}

export interface ListArtifactsResponse {
  artifacts: BrandArtifact[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApproveInsightsRequest {
  artifactId: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface SynthesizeBrandSoulRequest {
  brandId: string;
  forceRebuild?: boolean;               // Force complete rebuild
}

export interface SynthesizeBrandSoulResponse {
  success: boolean;
  versionId?: string;
  message: string;
}
