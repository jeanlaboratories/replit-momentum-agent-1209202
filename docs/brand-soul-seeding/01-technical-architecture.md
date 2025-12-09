# Brand Soul Seeding - Technical Architecture

## Overview
The Brand Soul Seeding system is a comprehensive AI-powered brand intelligence platform that captures, analyzes, and synthesizes multi-source brand information to create a living "brand knowledge base" that powers all future content generation.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Brand Soul      │  │  Source Queue    │  │  Review &        │  │
│  │  Setup Wizard    │  │  Management      │  │  Approval UI     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API & ORCHESTRATION LAYER                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Ingestion Orchestrator (Next.js API)            │  │
│  │  • Route validation & authentication                         │  │
│  │  • Source normalization                                      │  │
│  │  • Queue management                                          │  │
│  │  • Status tracking                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
┌──────────────────────┐ ┌──────────────┐ ┌─────────────────┐
│  INGESTION WORKERS   │ │   STORAGE    │ │  AI PROCESSING  │
│                      │ │              │ │                 │
│ ┌──────────────────┐ │ │ ┌──────────┐ │ │ ┌─────────────┐ │
│ │ Website Crawler  │ │ │ │ Firebase │ │ │ │   Gemini    │ │
│ │ • Sitemap parser │ │ │ │ Firestore│ │ │ │ Content     │ │
│ │ • Page scraper   │ │ │ │          │ │ │ │ Extraction  │ │
│ │ • robots.txt     │ │ │ └──────────┘ │ │ └─────────────┘ │
│ └──────────────────┘ │ │              │ │                 │
│                      │ │ ┌──────────┐ │ │ ┌─────────────┐ │
│ ┌──────────────────┐ │ │ │  Google  │ │ │ │   Gemini    │ │
│ │ Document Parser  │ │ │ │  Cloud   │ │ │ │ Synthesis & │ │
│ │ • PDF extraction │ │ │ │  Storage │ │ │ │ Analysis    │ │
│ │ • DOCX parsing   │ │ │ │          │ │ │ └─────────────┘ │
│ │ • Text normalize │ │ │ └──────────┘ │ │                 │
│ └──────────────────┘ │ │              │ │ ┌─────────────┐ │
│                      │ │              │ │ │   Vector    │ │
│ ┌──────────────────┐ │ │              │ │ │  Embeddings │ │
│ │ YouTube Analyzer │ │ │              │ │ │  (RAG)      │ │
│ │ • Transcript API │ │ │              │ │ └─────────────┘ │
│ │ • Video metadata │ │ │              │ │                 │
│ └──────────────────┘ │ │              │ └─────────────────┘
│                      │ │              │
│ ┌──────────────────┐ │ │              │
│ │ Link Extractor   │ │ │              │
│ │ • Article scrape │ │ │              │
│ │ • Metadata parse │ │ │              │
│ └──────────────────┘ │ │              │
└──────────────────────┘ └──────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SYNTHESIS LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │               Brand Soul Synthesis Engine                    │  │
│  │  • Voice Profile Generator (tone, style, values)             │  │
│  │  • Fact Library Extractor (structured knowledge)             │  │
│  │  • Messaging Framework Builder (key themes)                  │  │
│  │  • Conflict Resolution (source prioritization)               │  │
│  │  • Confidence Scoring (fact reliability)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BRAND SOUL KNOWLEDGE BASE                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ Voice Profile  │  │  Fact Library  │  │  RAG Embeddings    │   │
│  │ • Tone         │  │  • Products    │  │  • Content chunks  │   │
│  │ • Values       │  │  • History     │  │  • Semantic search │   │
│  │ • Style guide  │  │  • Messaging   │  │  • Context vectors │   │
│  └────────────────┘  └────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CONTENT GENERATION LAYER                         │
│  • Campaign Generation (with brand context)                          │
│  • Image Generation (brand-aware prompts)                            │
│  • Video Generation (brand voice consistency)                        │
│  • Global AI Chatbot (brand-contextualized responses)                │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Ingestion Orchestrator
**Location**: `src/app/api/brand-soul/*`

**Responsibilities**:
- Accept and validate source submissions
- Route to appropriate ingestion worker
- Manage processing queue
- Track status and progress
- Handle errors and retries

**Key Endpoints**:
- `POST /api/brand-soul/ingest/website` - Start website crawl
- `POST /api/brand-soul/ingest/document` - Upload media kit
- `POST /api/brand-soul/ingest/youtube` - Analyze YouTube videos
- `POST /api/brand-soul/ingest/link` - Extract link content
- `POST /api/brand-soul/ingest/manual` - Manual text input
- `GET /api/brand-soul/status/{artifactId}` - Check processing status
- `GET /api/brand-soul/queue/{brandId}` - Get all sources for brand

### 2. Ingestion Workers

#### Website Crawler
**Technology**: Firecrawl.dev API (recommended) or custom Puppeteer
**Features**:
- Sitemap.xml parsing
- robots.txt compliance
- Configurable depth (default: 3 levels)
- Rate limiting (1 req/sec)
- Content extraction (text, images, links)
- Metadata capture (title, description, keywords)

**Flow**:
```
1. Validate domain
2. Fetch robots.txt
3. Parse sitemap.xml
4. Queue pages (up to 50 for MVP)
5. Crawl each page
6. Extract content
7. Store in Firestore + GCS
```

#### Document Parser
**Technology**: PDF.js + Mammoth.js (DOCX)
**Features**:
- PDF text extraction
- DOCX content parsing
- Image extraction from documents
- Table parsing
- Metadata extraction

**Flow**:
```
1. Upload to Google Cloud Storage
2. Generate signed URL
3. Parse document (Cloud Function)
4. Extract text + images
5. Store structured data in Firestore
```

#### YouTube Analyzer
**Technology**: YouTube Data API v3
**Features**:
- Video metadata extraction
- Transcript/caption download
- Channel information
- Video description parsing

**API Requirements**:
- YouTube Data API key (10,000 units/day free)
- Captions API access

#### Link Extractor
**Technology**: Custom fetcher with cheerio/JSDOM
**Features**:
- Article content extraction
- Open Graph metadata
- Author and publish date
- Main content identification

### 3. AI Processing Pipeline

#### Gemini Content Extraction
**Model**: `gemini-1.5-flash`
**Purpose**: Extract structured insights from raw content

**Prompt Template**:
```
Analyze this brand content and extract:
1. Brand voice and tone
2. Core values and mission
3. Key products/services
4. Target audience
5. Unique value propositions
6. Common themes and messaging

Content: {raw_content}

Output as structured JSON.
```

#### Gemini Synthesis
**Model**: `gemini-1.5-pro` (for complex synthesis)
**Purpose**: Combine all sources into unified brand soul

**Prompt Template**:
```
You are analyzing multiple sources about a brand.
Synthesize them into a comprehensive brand profile.

Sources:
{source_1}
{source_2}
...

Create:
1. Voice Profile (tone, style, personality)
2. Fact Library (verified facts with sources)
3. Key Messaging Framework
4. Visual Identity Guidelines

Resolve conflicts by prioritizing official sources.
Indicate confidence level for each fact (0-100%).
```

#### Vector Embeddings
**Technology**: Google Genkit + Existing RAG system
**Purpose**: Enable semantic search over brand knowledge

**Process**:
```
1. Chunk content (500-1000 tokens)
2. Generate embeddings (text-embedding-004)
3. Store in vector DB with brand namespace
4. Enable similarity search
```

### 4. Brand Soul Storage

#### Firestore Collections

**`brandArtifacts/{brandId}/sources/{artifactId}`**
- Tracks all ingested sources
- Processing status
- Metadata and provenance

**`brandSoul/{brandId}`**
- Current published brand soul
- Version pointer
- Last updated timestamp

**`brandSoulVersions/{brandId}/versions/{versionId}`**
- Historical versions
- Change tracking
- Approval metadata

**Google Cloud Storage**
- Raw files (PDFs, media kits)
- Extracted images
- Crawled HTML snapshots

### 5. Review & Approval System

**Workflow**:
```
1. Sources ingested → "pending" status
2. AI extracts insights → "extracted" status
3. Manager reviews → approve/edit/reject
4. Approved insights → merged into brand soul
5. Published → version incremented
```

**Permissions**:
- **Managers**: Full approval rights, edit brand soul
- **Contributors**: Submit sources, suggest edits (pending approval)

## Technology Stack

### Frontend
- **Next.js 15** (App Router) - UI framework
- **React Context** - State management (BrandSoulProvider)
- **ShadCN/UI** - Component library
- **TailwindCSS** - Styling

### Backend
- **Next.js API Routes** - Orchestration layer
- **Firebase Cloud Functions** - Background processing
- **Google Cloud Run** - Heavy processing (document parsing)

### Storage
- **Firebase Firestore** - Metadata, status, brand soul
- **Google Cloud Storage** - Raw files, documents
- **Vector Database** - RAG embeddings (existing system)

### AI & ML
- **Google Gemini 1.5 Flash** - Content extraction
- **Google Gemini 1.5 Pro** - Synthesis
- **Genkit** - AI orchestration
- **text-embedding-004** - Vector embeddings

### External Services
- **Firecrawl.dev** (recommended) - Web crawling
- **YouTube Data API v3** - Video analysis
- **Optional**: News API, social media APIs

## Security Considerations

### Authentication
- All endpoints require Firebase Authentication
- Brand ownership validation
- Role-based access control (RBAC)

### Data Privacy
- User data isolation (by brandId)
- Secure file uploads (signed URLs)
- No cross-brand data leakage

### Rate Limiting
- Per-brand crawl limits (50 pages MVP)
- API quota management
- Exponential backoff on errors

### Content Safety
- Validate URLs (prevent SSRF attacks)
- Sanitize extracted content
- File type validation
- Size limits (50MB per file)

## Performance Optimization

### Caching Strategy
- Cache crawled pages (24 hours)
- Cache API responses (YouTube, etc.)
- Cache embeddings (permanent with version)

### Background Processing
- Queue-based architecture
- Async processing for heavy tasks
- Progress tracking
- Retry logic (max 3 attempts)

### Cost Management
- Crawl depth limits
- Page count caps
- Embedding quotas per brand
- Archive old versions (keep last 5)

## Monitoring & Observability

### Metrics to Track
- Ingestion success/failure rates
- Processing time per source type
- API quota usage
- Storage consumption
- User engagement (sources added, approvals)

### Logging
- All ingestion events
- Error logs with context
- Audit trail for approvals
- Performance metrics

### Alerts
- API quota approaching limit
- Processing failures (>10% error rate)
- Storage approaching quota
- Unusual crawl activity

## Scalability Considerations

### Current MVP Scale
- 50 pages per website crawl
- 10 documents per brand
- 10 YouTube videos per brand
- 100 manual text entries per brand

### Future Scale (Phase 2+)
- Unlimited pages (with smart sampling)
- Background refresh on schedule
- Multi-language support
- Advanced conflict resolution

## Integration Points

### Existing Systems

#### BrandDataProvider
- Extend to include `brandSoul` in context
- Add `refetch.brandSoul()` method
- Auto-load on brand switch

#### Content Generation
- Campaign generator gets brand context
- Image generation uses brand style
- Video prompts include brand voice
- Global chatbot has brand knowledge

#### RAG System
- Extend vector namespace per brand
- Query brand knowledge for context
- Combine with campaign-specific context

## Next Steps
See implementation roadmap in `06-implementation-roadmap.md`
