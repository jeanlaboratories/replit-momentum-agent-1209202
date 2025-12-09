// Unified Media Library Types

import { Timestamp } from 'firebase/firestore';

export type MediaType = 'image' | 'video';
export type MediaSource = 'upload' | 'ai-generated' | 'brand-soul' | 'edited' | 'chatbot' | 'imagen' | 'veo';

export interface AuditEvent {
  userId: string;
  action: 'created' | 'edited' | 'published' | 'unpublished' | 'tagged' | 'collected';
  timestamp: string;
  details?: string;
}

export interface UnifiedMedia {
  id: string;
  brandId: string;
  type: MediaType;
  
  // URLs
  url: string;
  thumbnailUrl?: string;
  
  // Metadata
  title: string;
  description?: string;
  tags: string[];
  collections: string[];
  
  // Source tracking
  source: MediaSource;
  sourceArtifactId?: string;
  sourceImageId?: string;
  sourceVideoId?: string;
  
  // Timestamps & Audit
  createdAt: Timestamp | string;
  createdBy: string;
  uploadedBy?: string;
  generatedBy?: string;
  
  // AI metadata
  prompt?: string;
  explainability?: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  };
  
  // Input images for generation
  inputImageUrl?: string;
  characterReferenceUrl?: string;
  startFrameUrl?: string;
  endFrameUrl?: string;

  // Visual metadata
  colors?: Array<{ hex: string; rgb: number[]; proportion: number }>;

  fileSize?: number;
  dimensions?: { width: number; height: number };
  mimeType?: string;

  // Vision analysis metadata
  visionDescription?: string;
  visionKeywords?: string[];
  visionCategories?: string[];
  enhancedSearchText?: string;

  // Privacy
  isPublished?: boolean;

  // Audit
  auditTrail?: AuditEvent[];
}

export interface MediaCollection {
  id: string;
  brandId: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  parentId?: string;
  createdAt: Timestamp | string;
  createdBy: string;
  mediaCount: number;
  updatedAt?: Timestamp | string;
}

export interface MediaSearchFilters {
  type?: MediaType;
  collections?: string[];
  tags?: string[];
  source?: MediaSource;
  dateRange?: {
    start: string;
    end: string;
  };
  createdBy?: string;
  hasColors?: boolean;
  hasExplainability?: boolean;
  isPublished?: boolean;
}

export interface MediaSearchRequest {
  brandId: string;
  query?: string;
  filters?: MediaSearchFilters;
  sort?: 'date-desc' | 'date-asc' | 'title' | 'size';
  cursor?: string;
  limit?: number;
}

export interface MediaSearchResponse {
  items: UnifiedMedia[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface CreateMediaRequest {
  brandId: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  tags?: string[];
  collections?: string[];
  source: MediaSource;
  sourceArtifactId?: string;
  sourceImageId?: string;
  sourceVideoId?: string;
  prompt?: string;
  explainability?: UnifiedMedia['explainability'];
  inputImageUrl?: string;
  characterReferenceUrl?: string;
  startFrameUrl?: string;
  endFrameUrl?: string;
  colors?: UnifiedMedia['colors'];
  fileSize?: number;
  dimensions?: { width: number; height: number };
  mimeType?: string;
}

export interface UpdateMediaRequest {
  title?: string;
  description?: string;
  tags?: string[];
  collections?: string[];
  isPublished?: boolean;
}

export interface BulkOperationRequest {
  mediaIds: string[];
  operation: 'add-tags' | 'remove-tags' | 'add-to-collection' | 'remove-from-collection' | 'delete' | 'publish' | 'unpublish';
  tags?: string[];
  collectionId?: string;
}
