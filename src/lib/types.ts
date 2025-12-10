


export interface Brand {
    id: string;
    name: string;
    profile: BrandProfile;
}

export type ContentBlock = {
  id: string;
  contentType: 'Social Media Post' | 'Email Newsletter' | 'Blog Post Idea';
  keyMessage: string;
  toneOfVoice: 'Professional' | 'Playful' | 'Urgent';
  assetUrl?: string; // URL of selected image/video from galleries
  imageUrl?: string; // URL of AI-generated or saved image
  scheduledTime?: string;
  adCopy?: string; // Add adCopy here
};

export type CampaignDay = {
  id: string;
  day: number;
  date: string; // ISO date string to persist the actual date regardless of renumbering
  contentBlocks: ContentBlock[];
};

export type CampaignTimeline = CampaignDay[];

export type GeneratedContentBlock = {
  id?: string; // Add ID field to maintain link with comments
  contentType: string;
  adCopy: string;
  imagePrompt: string;
  imageUrl?: string;
  imageIsGenerating?: boolean;
  // Add these to pass context to the regeneration function
  keyMessage?: string;
  toneOfVoice?: string;
  scheduledTime?: string;
  // Nano Banana AI Image Studio metadata for persistence
  sourceImageUrl?: string; // Original source image used for editing
  fusionSourceUrls?: string[]; // Additional images used for fusion
  maskUrl?: string; // Mask image used for masked editing
  editPrompt?: string; // The text prompt used for AI image editing
};

export type GeneratedDay = {
  day: number;
  date?: string; // Optional date field to preserve day gaps when saving/loading
  contentBlocks: GeneratedContentBlock[];
};

export type GeneratedCampaignContent = GeneratedDay[];

// For Mock Data and Firestore user profiles
export type User = {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string; // Add optional photoURL for avatar
    brandId: string;
  agentEngineId?: string; // For personal, persistent memory
  agentEngineName?: string; // For personal, persistent memory name
};


export type Campaign = {
    id:string;
    brandId: string;
    name: string;
    createdBy: string; // user uid who created the campaign
    createdAt: string; // timestamp when campaign was created
    updatedBy?: string; // user uid who last saved the campaign
    updatedAt?: string; // timestamp when campaign was last saved
    content: GeneratedCampaignContent;
    originalPrompt?: string; // The master prompt used to generate the campaign - persists and is editable
};

/**
 * Represents a video in the application.
 */
export interface Video {
  id: string;
  brandId: string;
  videoUrl: string;
  title: string;
  description: string;
  uploadedBy?: string; // user uid who uploaded the video
  uploadedAt?: string; // timestamp when video was uploaded
  generatedBy?: string; // user uid who generated the video (if AI-generated)
  generatedAt?: string; // timestamp when video was generated (if AI-generated)
  inputImageUrl?: string; // Optional input image used for generation
  characterReferenceUrl?: string; // Optional character reference image
  startFrameUrl?: string; // Optional start frame image
  endFrameUrl?: string; // Optional end frame image
  veoVideoUri?: string; // Gemini API file URI for video extension (valid for 2 days from generation)
  // Vision Analysis fields for enhanced search capabilities
  visionDescription?: string; // AI-generated description of video content
  visionKeywords?: string[]; // AI-generated keywords for search
  visionCategories?: string[]; // AI-generated categories for classification
}

/**
 * Represents a generated music track in the application.
 */
export interface Music {
  id: string;
  brandId: string;
  url: string;
  prompt: string;
  negative_prompt?: string;
  sample_index?: number;
  sample_count?: number;
  seed?: number;
  duration: number; // Duration in seconds (Lyria 2 generates 30-second clips)
  sampleRate: number; // Sample rate in Hz (Lyria 2 uses 48kHz)
  format: string; // Audio format (e.g., "wav")
  createdAt?: string | Date | { toDate: () => Date };
  createdBy?: string; // user uid who generated the music
  filename?: string;
}

/**
 * Represents an edited image in the application.
 */
export interface EditedImage {
  id: string;
  brandId: string;
  title: string;
  prompt: string;
  sourceImageUrl: string;
  additionalImageUrls?: string[]; // Additional source images for multi-image fusion
  generatedImageUrl: string;
  uploadedBy?: string; // user uid who uploaded the source image
  uploadedAt?: string; // timestamp when source image was uploaded
  generatedBy?: string; // user uid who generated the edited image
  generatedAt?: string; // timestamp when image was generated
  explainability?: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  }; // Brand Soul influence data for AI-generated images
  // Vision Analysis fields for enhanced search capabilities
  visionDescription?: string; // AI-generated description of the image content
  visionKeywords?: string[]; // AI-generated keywords for searchability  
  visionCategories?: string[]; // AI-generated categories for classification
  enhancedSearchText?: string; // Combined search text including vision analysis
  relevanceScore?: number; // Search relevance score for ranking
}

export interface BrandAsset {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video' | 'document';
  prompt?: string; // Added for AI generated assets
    uploadedBy?: string; // user uid who uploaded the asset
    uploadedAt?: string; // timestamp when asset was uploaded
    updatedBy?: string; // user uid who last updated the asset
    updatedAt?: string; // timestamp when asset was last updated
  isPublished?: boolean;
}

export interface BrandText {
    coreText: {
        missionVision: string;
        brandStory: string;
        taglines: string[];
    };
    marketingText: {
        adCopy: string[];
        productDescriptions: string[];
        emailCampaigns: string[];
        landingPageCopy: string;
    };
    contentMarketingText: {
        blogPosts: string[];
        socialMediaCaptions: string[];
        whitePapers: string[];
        videoScripts: string[];
    };
    technicalSupportText: {
        userManuals: string;
        faqs: { question: string; answer: string; }[];
    };
    publicRelationsText: {
        pressReleases: string[];
        companyStatements: string[];
        mediaKitText: string;
    };
}


export interface EngagementMetric {
    label: string;
    value: string | number;
    icon?: string;
}

export interface PinnedPost {
    id: string;
    title: string;
    content: string;
    imageUrl?: string;
    linkUrl?: string;
    linkText?: string;
    createdAt: string;
}

export interface FeedSection {
    id: string;
    title: string;
    slug: string;
    contentType: 'updates' | 'solutions' | 'insights' | 'events' | 'images' | 'videos' | 'resources' | 'documents';
    items?: Array<{
        id: string;
        title: string;
        excerpt: string;
        date: string;
        imageUrl?: string;
    }>;
}

export interface BrandProfile {
    summary?: string;
    brandText?: BrandText;
    brandTextAttributions?: Record<string, { userId: string; userName: string; copiedAt: string }>;
    images: BrandAsset[];
    videos: BrandAsset[];
    documents: BrandAsset[];
    
    engagementMetrics?: EngagementMetric[];
    pinnedPost?: PinnedPost;
    feedSections?: FeedSection[];
    tagline?: string;
    websiteUrl?: string;
    contactEmail?: string;
    location?: string;
    bannerImageUrl?: string;
    logoUrl?: string;
}

export interface UserProfilePreferences {
    userId: string;
    brandId: string;
    displayName?: string;
    bannerImageUrl?: string;
    logoUrl?: string;
    brandText?: BrandText;
    tagline?: string;
    summary?: string;
    websiteUrl?: string;
    contactEmail?: string;
    location?: string;
    timezone?: string; // IANA timezone string (e.g., "America/New_York")
    updatedAt: string;
}

// Individual Identity - Personal context for team members
export interface IndividualIdentity {
    id: string; // Composite key: `${brandId}_${userId}`
    brandId: string;
    userId: string;
    
    // Core Identity
    roleTitle?: string; // e.g., "Senior Product Designer", "Marketing Lead"
    narrativeSummary?: string; // Personal bio/background story
    
    // Professional Profile
    achievements?: string[]; // Notable accomplishments
    skills?: string[]; // Core competencies and expertise
    workingStyle?: string; // How they prefer to work, collaborate
    
    // Personal Mission & Values
    personalMission?: string; // Their individual purpose/goals
    personalTagline?: string; // Personal catchphrase or motto
    personalValues?: string[]; // What matters most to them
    
    // Social Proof & Recognition
    testimonials?: Array<{
        text: string;
        author: string;
        role?: string;
        date?: string;
    }>;
    
    // External Presence
    socialLinks?: Array<{
        platform: string; // 'LinkedIn', 'Twitter', 'Portfolio', etc.
        url: string;
    }>;
    
    // Metadata
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
    lastGeneratedAt?: string; // When AI last generated text from this identity
}

// Context for personal profile AI generation
export interface IndividualContext {
    exists: boolean;
    identity?: IndividualIdentity;
    teamVoiceGuidelines?: string; // Brand voice to maintain consistency
    individualMentions?: string; // Team Intelligence facts mentioning this person
    fullContext?: string; // Formatted context for AI prompts
}

// Team Management Types
export type BrandRole = 'MANAGER' | 'CONTRIBUTOR';

export interface BrandMember {
  id: string; // Composite key: `${brandId}_${userId}`
  brandId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL?: string;
  role: BrandRole;
  status: 'ACTIVE' | 'INACTIVE';
  invitedBy?: string; // userId of who invited them
  joinedAt?: string; // ISO 8601 - when the member joined
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface BrandInvitation {
  id: string; // Composite key: `${brandId}_${email}`
  brandId: string;
  email: string;
  displayName: string; // Full name of the person being invited
  role: BrandRole;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  invitedBy: string; // userId of who invited them
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  acceptedAt?: string; // ISO 8601
}

export interface UserBrandPermissions {
  canEditBrandProfile: boolean;
  canInviteUsers: boolean;
  canManageTeam: boolean;
  canDeleteContent: boolean;
}

// Comment System Types
export type CommentContextType = 'campaign' | 'contentBlock' | 'image' | 'video' | 'brandProfile';

export type CommentStatus = 'active' | 'edited' | 'deleted' | 'resolved' | 'flagged' | 'hidden';

export interface Comment {
  id: string;
  brandId: string;
  contextType: CommentContextType;
  contextId: string;
  parentId?: string | null; // null for top-level threads, set for replies
  body: string;
  attachments?: string[]; // URLs to attachments
  createdBy: string; // userId
  createdByName: string; // denormalized for display
  createdByPhoto?: string; // denormalized for display
  createdAt: string; // ISO 8601
  editedAt?: string; // ISO 8601
  resolvedAt?: string; // ISO 8601
  resolvedBy?: string; // userId
  status: CommentStatus;
  replyCount: number; // denormalized count
  flagCount: number; // denormalized count
  revisionHistory?: CommentRevision[];
}

export interface CommentRevision {
  body: string;
  editedAt: string;
  editedBy: string;
}

export interface CommentThread extends Comment {
  replies?: Comment[];
  hasMoreReplies?: boolean;
}

export interface CommentContext {
  id: string; // {brandId}_{contextType}_{contextId}
  brandId: string;
  contextType: CommentContextType;
  contextId: string;
  totalComments: number;
  activeComments: number;
  resolvedComments: number;
  flaggedComments: number;
  lastCommentAt?: string; // ISO 8601
  lastCommentBy?: string; // userId
}

// Flag System Types
export type FlagReason = 'inappropriate' | 'spam' | 'off_topic' | 'harassment' | 'other';

export type FlagStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

export interface CommentFlag {
  id: string;
  brandId: string;
  commentId: string;
  reason: FlagReason;
  notes?: string;
  flaggedBy: string; // userId
  flaggedByName: string; // denormalized for display
  createdAt: string; // ISO 8601
  status: FlagStatus;
  reviewedBy?: string; // userId (manager)
  reviewedByName?: string; // denormalized for display
  reviewedAt?: string; // ISO 8601
  resolutionNotes?: string;
}

// Comment UI State Types
export interface CommentUIState {
  showComments: boolean;
  filter: 'all' | 'open' | 'resolved' | 'flagged';
  replyingTo?: string; // commentId
  editingComment?: string; // commentId
  flaggingComment?: string; // commentId
}

// Comment Notification Types
export type CommentNotificationType = 'mention' | 'reply' | 'flag' | 'resolution';

export interface CommentNotification {
  id: string;
  brandId: string;
  userId: string; // recipient
  type: CommentNotificationType;
  commentId: string;
  contextType: CommentContextType;
  contextId: string;
  triggeredBy: string; // userId who triggered the notification
  triggeredByName: string; // denormalized for display
  message: string;
  read: boolean;
  createdAt: string; // ISO 8601
  readAt?: string; // ISO 8601
}

// Comment Statistics Types
export interface CommentStats {
  id: string; // {brandId}_{week}
  brandId: string;
  weekStarting: string; // ISO 8601
  totalComments: number;
  activeComments: number;
  resolvedComments: number;
  flaggedComments: number;
  topContributors: Array<{
    userId: string;
    userName: string;
    commentCount: number;
  }>;
}

// Sponsorship System Types
export type SponsorshipStatus = 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED' | 'EXPIRED';

export interface Sponsorship {
  id: string; // Composite key: `${sponsorBrandId}_${sponsoredBrandId}`
  sponsorBrandId: string; // Brand providing sponsorship
  sponsoredBrandId: string; // Brand being sponsored
  sponsorBrandName: string; // Denormalized for display
  sponsoredBrandName: string; // Denormalized for display
  status: SponsorshipStatus;
  initiatedBy: string; // userId of sponsor who initiated
  approvedBy?: string; // userId of sponsored brand manager who approved
  createdAt: string; // ISO 8601
  approvedAt?: string; // ISO 8601
  revokedAt?: string; // ISO 8601
  revokedBy?: string; // userId of who revoked (can be sponsor or sponsored brand manager)
  metadata?: {
    note?: string; // Optional note from sponsor
    permissions?: {
      canViewBrandProfile: boolean;
      canViewUploads: boolean;
    };
  };
}

export interface SponsorshipInvitation {
  id: string; // Composite key: `${sponsorBrandId}_${managerEmail}`
  sponsorBrandId: string; // Brand sending invitation
  sponsorBrandName: string; // Denormalized for display
  managerEmail: string; // Email of target brand's manager
  targetBrandId?: string; // Brand being invited (if known)
  targetBrandName?: string; // Denormalized for display (if known)
  token: string; // Unique token for security
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  initiatedBy: string; // userId of sponsor who sent invitation
  initiatedByName: string; // Denormalized for display
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  respondedAt?: string; // ISO 8601
  respondedBy?: string; // userId of manager who responded
  note?: string; // Optional note from sponsor
}

// Extended user permissions for sponsorship context
export interface UserSponsorshipPermissions extends UserBrandPermissions {
  isSponsoredUser: boolean;
  sponsorBrandIds: string[]; // Brand IDs that user has sponsored access to
  canInitiateSponsorships: boolean;
  canApproveSponsorships: boolean;
}

// ============================================================================
// PHASE 1: ENHANCED CONTENT GENERATION SCHEMAS (Matchpoint Integration)
// ============================================================================

// Scene Type Classification (Matchpoint Scene Mix Engine)
export type SceneType = 'human' | 'product' | 'ingredient' | 'detail';

export type HumanSceneSubtype = 'solo' | 'group' | 'ugc' | 'action' | 'lifestyle';
export type ProductSceneSubtype = 'hero' | 'lifestyle' | 'macro' | 'pack' | 'inuse';
export type IngredientSceneSubtype = 'flatlay' | 'macro' | 'collage' | 'texture';

export type SceneSubtype = HumanSceneSubtype | ProductSceneSubtype | IngredientSceneSubtype;

// Photographic Controls (Enhanced Image Generation)
export type LightingStyle = 
  | 'natural' 
  | 'studio' 
  | 'dramatic' 
  | 'soft' 
  | 'golden-hour' 
  | 'backlit' 
  | 'diffused';

export type MoodStyle = 
  | 'energetic' 
  | 'calm' 
  | 'professional' 
  | 'playful' 
  | 'luxurious' 
  | 'minimal' 
  | 'vibrant';

export type CompositionStyle = 
  | 'rule-of-thirds' 
  | 'centered' 
  | 'symmetrical' 
  | 'dynamic' 
  | 'minimalist' 
  | 'layered';

export type LensType = '35mm' | '50mm' | '85mm' | 'macro' | 'wide-angle' | 'telephoto';
export type FramingType = 'wide' | 'medium' | 'close-up' | 'extreme-close' | 'top-down';
export type DepthOfField = 'shallow' | 'deep' | 'medium';

export interface ShotSpecifications {
  lens: LensType;
  framing: FramingType;
  depthOfField: DepthOfField;
}

// Animation Directives (Enhanced Video Generation)
export type CameraMovement = 'dolly-in' | 'dolly-out' | 'orbit' | 'pan-left' | 'pan-right' | 'static';
export type SubjectMotion = 
  | 'steam-rising' 
  | 'liquid-pour' 
  | 'product-spin' 
  | 'hair-sway' 
  | 'fabric-flow' 
  | 'sparkle';

export interface AnimationDirectives {
  enabled: boolean;
  cameraMovement?: CameraMovement;
  subjectMotion?: SubjectMotion;
}

// Enhanced Image Prompt Schema
export interface EnhancedImagePrompt {
  // Core prompt
  basePrompt: string;
  
  // Scene Classification
  sceneType: SceneType;
  sceneSubtype: SceneSubtype;
  
  // Photographic Controls
  lighting?: LightingStyle;
  mood?: MoodStyle;
  composition?: CompositionStyle;
  shotSpecs?: ShotSpecifications;
  
  // Brand Integration
  brandColors?: string[]; // Hex color codes
  brandStyleTags?: string[]; // e.g., ['minimal', 'modern', 'luxury']

  // Animation (for video)
  animationDirectives?: AnimationDirectives;
  
  // Metadata
  generatedAt?: string;
  modelUsed?: string;
}

// Scene Mix Policy (Strategic Content Planning)
export interface SceneMixGoal {
  human: number; // 0-1 proportion
  product: number; // 0-1 proportion
  ingredient: number; // 0-1 proportion
  detail?: number; // 0-1 proportion (optional)
}

export interface SubtypeWeights {
  human?: Record<HumanSceneSubtype, number>;
  product?: Record<ProductSceneSubtype, number>;
  ingredient?: Record<IngredientSceneSubtype, number>;
}

export interface CampaignSignals {
  campaignIntent: 'awareness' | 'conversion' | 'engagement' | 'education';
  industry?: string; // e.g., 'beauty/cosmetics', 'food/beverage', 'tech/saas'
  brandPersona?: string; // e.g., 'premium/minimalist', 'playful/energetic'
  audienceProfile?: {
    ageRange?: string; // e.g., '25-45'
    gender?: string; // e.g., 'all', 'female', 'male'
    interests?: string[]; // e.g., ['skincare', 'wellness']
  };
  seasonality?: string; // e.g., 'summer', 'holiday'
}

export interface SceneMixPolicy {
  id: string; // Policy ID
  campaignId: string;
  policyVersion: string; // e.g., 'v1'
  
  // Mix Strategy
  mixGoal: SceneMixGoal;
  subtypeWeights?: SubtypeWeights;
  
  // Reasoning
  rationale: string; // AI-generated explanation of why this mix was chosen
  signalsUsed: CampaignSignals;
  
  // Exploration
  explorationRate?: number; // 0-1, for A/B testing variations
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;
  createdBy?: string; // userId
}

// Scene Classification Result
export interface SceneClassification {
  sceneType: SceneType;
  sceneSubtype: SceneSubtype;
  confidence: number; // 0-1
  reasoning?: string; // Why this classification was chosen
}

// Quality Control & Scoring Types
export interface BrandAlignmentScore {
  overallScore: number; // 0-1 cosine similarity
  pass: boolean; // score > threshold
  threshold: number; // Configurable per brand
  details: {
    toneMatch: number; // 0-1
    messagingMatch: number; // 0-1
    vocabularyMatch: number; // 0-1
  };
  recommendations?: string[]; // Suggestions for improvement
}

export interface ClaimVerification {
  claim: string;
  verified: boolean;
  source: string | null; // Reference to Brand Soul fact
  confidence: number; // 0-1
  reasoning?: string;
}

export interface ContentQualityReport {
  contentId: string;
  brandAlignmentScore?: BrandAlignmentScore;
  claimVerifications?: ClaimVerification[];
  passedQualityGate: boolean;
  issuesFound: string[];
  timestamp: string;
}

// Extended GeneratedContentBlock with Enhanced Metadata
export interface EnhancedGeneratedContentBlock extends GeneratedContentBlock {
  // Enhanced Image Data
  enhancedImagePrompt?: EnhancedImagePrompt;
  sceneClassification?: SceneClassification;
  
  // Quality Metrics
  qualityReport?: ContentQualityReport;
  
  // Regeneration Tracking
  regenerationCount?: number;
  originalVersion?: GeneratedContentBlock;
  regenerationHistory?: Array<{
    version: number;
    timestamp: string;
    reason?: string;
    userId?: string;
  }>;
}


export interface MediaAttachment {
  id?: string;
  type: 'image' | 'video' | 'pdf' | 'audio';
  url: string;
  file?: File;
  fileName?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

// ============================================================================
// CHARACTER CONSISTENCY FOR CAMPAIGN IMAGE GENERATION
// ============================================================================

/**
 * Character reference for maintaining visual consistency across campaign images.
 * Based on Nano Banana (Gemini 2.5 Flash Image) character consistency approach.
 */
export interface CharacterReference {
  id: string;
  name: string; // e.g., "Main Character", "Brand Mascot", "Product Hero"
  description?: string; // Brief description of the character
  characterSheetUrl: string; // URL to character sheet image (multiple angles/poses)
  isActive: boolean; // Whether to use this character in generation
}

/**
 * Configuration for character consistency in campaign image generation.
 */
export interface CharacterConsistencyConfig {
  enabled: boolean; // Whether to enable character consistency
  characters: CharacterReference[]; // List of character references
  useSceneToSceneConsistency: boolean; // Whether to pass previous scene images as references
  maxReferenceImages: number; // Max reference images per generation (default 14, Nano Banana limit)
}

/**
 * Extended GeneratedContentBlock with character consistency metadata.
 */
export interface CharacterConsistentContentBlock extends GeneratedContentBlock {
  characterReferences?: string[]; // URLs of character references used
  previousSceneUrl?: string; // URL of previous scene used for consistency
  generationModel?: 'imagen' | 'nano_banana'; // Which model was used
}
