// Brand Soul POC - Minimal Types for Proof of Concept

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BrandArtifactPOC {
  id: string;
  brandId: string;
  type: 'manual-text';
  status: ProcessingStatus;
  
  // Metadata (stays in Firestore)
  metadata: {
    title: string;
    wordCount: number;
    createdAt: string;
    createdBy: string;
  };
  
  // Reference to large content (NOT stored in Firestore)
  contentRef: {
    path: string;           // Path to content (GCS or Object Storage)
    size: number;
    checksum: string;
  };
  
  // Reference to extracted insights (NOT stored in Firestore)
  insightsRef?: {
    path: string;           // Path to insights JSON
    confidence: number;
    extractedAt: string;
  };
  
  // Processing info
  processedAt?: string;
  error?: string;
}

export interface ProcessingJobPOC {
  id: string;
  brandId: string;
  artifactId: string;
  type: 'extract-insights';
  status: ProcessingStatus;
  
  progress: number;        // 0-100
  currentStep?: string;
  
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  error?: string;
}

export interface ExtractedInsightsPOC {
  voiceElements: {
    tone: string;
    style: string;
    formality: number;     // 1-10
    examples: string[];
  };
  
  keyFacts: Array<{
    category: string;
    fact: string;
    confidence: number;    // 0-100
  }>;
  
  coreValues: string[];
  
  confidence: number;      // Overall confidence 0-100
  extractedAt: string;
  model: string;           // AI model used
}

// API Request/Response Types
export interface IngestManualTextRequest {
  title: string;
  content: string;
  brandId: string;
}

export interface IngestManualTextResponse {
  success: boolean;
  artifactId?: string;
  jobId?: string;
  message: string;
}

export interface GetArtifactResponse {
  artifact: BrandArtifactPOC;
  content?: string;        // Fetched from storage
  insights?: ExtractedInsightsPOC; // Fetched from storage
}
