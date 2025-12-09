# MOMENTUM - Deep Technical Understanding

## Executive Summary

MOMENTUM is an AI-powered Team Intelligence & Execution Platform built with Next.js 15, Firebase, and Google Genkit. It transforms scattered team knowledge into actionable intelligence that guides AI-generated content across text, images, and videos. The platform is designed for universal team types (sports, product, creative, research, volunteer) and provides context-aware AI generation powered by a continuously learning knowledge base.

---

## Architecture Overview

### Technology Stack

**Frontend:**
- **Next.js 15** (App Router) - React framework with Server Components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **ShadCN UI** - Component library built on Radix UI
- **React Hooks** - State management (useAuth, useBrandData, useComments)

**Backend:**
- **Firebase Firestore** - NoSQL database for all application data
- **Firebase Authentication** - Email/password auth with email verification
- **Firebase Storage** - Media asset storage (images, videos, documents)
- **Python FastAPI** (port 8000) - Hosts Google ADK agent for agentic AI
- **Next.js API Routes** - Server-side API endpoints

**AI Layer:**
- **Google Genkit** - AI orchestration framework
- **Gemini 2.0/2.5 Flash** - Text generation and vision
- **Imagen 4.0** - Image generation
- **Veo 3.1** - Video generation
- **Google ADK (Agent Development Kit)** - Fully agentic assistant with tool use
- **Firecrawl SDK** - Website crawling for Team Intelligence

**Deployment:**
- **Replit VM** - Reserved VM deployment
- **Concurrent Services** - Next.js (port 5000) + Python FastAPI (port 8000)

---

## Core Systems

### 1. Team Intelligence (Brand Soul)

**Purpose:** Continuously learns from diverse sources to create a living knowledge base that influences all AI generation.

**Data Flow:**
```
Source Ingestion → Artifact Creation → AI Extraction → Approval → Brand Soul Synthesis → AI Context
```

**Key Components:**

#### Artifact Ingestion (`brandArtifacts/{brandId}/sources/{artifactId}`)
- **Types:** website, document (PDF/DOCX/PPTX), YouTube video, manual text, social profile
- **Status Flow:** `pending` → `processing` → `extracting` → `extracted` → `approved` → `published`
- **Storage:** Content stored in Firebase Storage, metadata in Firestore
- **Processing:** Background jobs queue AI extraction using Gemini

#### Brand Soul Structure (`brandSoul/{brandId}`)
- **Voice Profile:** Tone, personality, writing style, vocabulary preferences
- **Fact Library:** Categorized facts with confidence scores and sources
- **Messaging Framework:** Mission, vision, values, taglines, key messages
- **Visual Identity:** Colors, typography, image style preferences

#### Context Generation (`src/lib/brand-soul/context.ts`)
- **getBrandSoulContext()** - Formats Brand Soul for AI prompts
- **getComprehensiveTeamIntelligence()** - Extracts insights from all artifacts
- **Token Budget Management** - Truncates to fit within model limits
- **Versioning** - Historical versions stored in `brandSoulVersions/{brandId}/versions/{versionId}`

**Integration Points:**
- All AI generation flows check for Brand Soul context
- AI Assistant receives full Team Intelligence (100k token budget)
- Image generation uses visual identity guidelines
- Text generation matches voice and messaging framework

---

### 2. AI Generation System

**Architecture:** Multi-modal AI generation with Team Intelligence context injection.

#### Text Generation (`src/ai/flows/`)
- **generate-brand-text.ts** - Comprehensive brand text (mission, taglines, ad copy, etc.)
- **generate-brand-summary.ts** - Team mission statement generation
- **generate-ai-campaign-content.ts** - Initiative content generation
- **regenerate-ad-copy.ts** - Content regeneration with context

**Context Injection Pattern:**
```typescript
const brandSoulContext = await getBrandSoulContext(brandId, true, 1500);
const brandSoulGuidelines = getBrandSoulInstruction(brandSoulContext);
// Inject into prompt template
```

#### Image Generation (`src/ai/flows/generate-ai-images.ts`)
- **Model:** Imagen 4.0 via Google Genkit
- **Context:** Visual identity from Brand Soul (colors, style, imagery preferences)
- **Explainability:** Tracks how Brand Soul influenced generation
- **Enhanced Prompts:** Scene classification, lighting, mood, composition controls

#### Video Generation (`src/ai/flows/generate-video.ts`)
- **Model:** Veo 3.1 via Google Genkit
- **Process:** Async operation with polling (max 2 minutes)
- **Context:** Team Intelligence influences video style and content

#### Image Editing (`nano_banana` tool)
- **Model:** Gemini 2.5 Flash Image Preview
- **Workflow:** User uploads image → Agent analyzes with vision → Generates edited version
- **Location:** Python service (`momentum_agent.py`)

---

### 3. Agentic AI Assistant (ADK Agent)

**Location:** `python_service/momentum_agent.py`

**Architecture:**
- **Framework:** Google ADK (Agent Development Kit)
- **Model:** Gemini 2.0 Flash
- **Session Management:** SQLite database for persistent conversations
- **Context:** Full Team Intelligence + Individual Identity + Team Members

**Tools Available:**
1. **generate_text** - Gemini text generation
2. **generate_image** - Imagen 4.0 image generation
3. **generate_video** - Veo 3.1 video generation
4. **analyze_image** - Gemini Vision analysis
5. **crawl_website** - Firecrawl website extraction
6. **create_event** - Natural language event creation
7. **suggest_domain_names** - Domain name suggestions
8. **create_team_strategy** - Strategic planning
9. **plan_website** - Website structure planning
10. **design_logo_concepts** - Logo design concepts
11. **nano_banana** - Image editing

**Session Management:**
- **DatabaseSessionService** - SQLite persistence
- **Auto-cleanup:** Sessions cleared after media generation (prevents token overflow)
- **Message Limit:** Auto-clear after 5 messages to prevent accumulation
- **Composite Keys:** `{brandId}_{userId}` for session isolation

**Context Building (`src/lib/ai-assistant-context.ts`):**
- Fetches Brand Profile, Brand Soul, Team Members, Individual Identity
- Builds comprehensive system prompt with Team Intelligence
- Includes active sponsor profiles for cross-team collaboration
- Token budget: 100k for Team Intelligence insights

**API Endpoint:** `POST /api/chat` → Proxies to Python service `/agent/chat`

---

### 4. Initiative Planning System

**Core Concept:** Multi-day initiative planner (formerly "campaign timeline") for any team project type.

**Data Model:**
```typescript
CampaignTimeline = CampaignDay[]
CampaignDay = {
  id: string
  day: number
  date: string (ISO) // Preserves actual date regardless of renumbering
  contentBlocks: ContentBlock[]
}
```

**Features:**
- **Calendar View** - Visual calendar with date selection
- **Day View** - Detailed content block editing
- **Natural Language Event Creator** - AI parses user description into structured event
- **Timezone Support** - Full timezone-aware date handling
- **Content Blocks** - Social Media Post, Email Newsletter, Blog Post Idea
- **Media Integration** - Attach images/videos from media library

**Event Creation Flow:**
1. User provides natural language description
2. `POST /api/parse-event-description` parses with AI
3. Returns structured `campaignRequest` with days and content blocks
4. User can generate AI content for the event
5. Event saved to `campaigns/{campaignId}` collection

**State Management:**
- Unsaved changes tracking
- Comment system integration (threaded comments on events/blocks)
- Audit trails (createdBy, updatedBy, timestamps)

---

### 5. Media Library System

**Purpose:** Unified media management (Zenfolio-inspired) consolidating all media sources.

**Data Model:**
```typescript
UnifiedMedia = {
  id: string
  brandId: string
  type: 'image' | 'video'
  source: 'upload' | 'ai-generated' | 'brand-soul' | 'edited'
  url: string
  title: string
  tags: string[]
  collections: string[]
  // ... metadata
}
```

**Migration System:**
- **Auto-migration** on first page load if `unifiedMedia` is empty
- **Sources Migrated:**
  1. `images` collection (AI-generated and edited images)
  2. `videos` collection (AI-generated videos)
  3. `brandArtifacts` collection (Brand Soul extracted images)
- **Duplicate Prevention:** Uses `sourceImageId`, `sourceVideoId`, `sourceArtifactId`

**Features:**
- **Collections** - Organize media into albums
- **Search & Filter** - By type, source, tags, date
- **Cursor Pagination** - Efficient large dataset handling
- **Virtual Scrolling** - Performance optimization
- **Brand Soul Sync** - Manual sync button for new Brand Soul images

**Storage:**
- Firebase Storage for actual files
- Firestore `unifiedMedia` collection for metadata
- Collection counts maintained in `mediaCollections/{collectionId}`

---

### 6. Authentication & Authorization

**Authentication Flow:**
1. User signs up with email/password
2. Firebase Auth creates user
3. Email verification required before login
4. Server action creates Firestore user profile
5. Secure session cookie created (httpOnly)
6. User profile fetched on auth state change

**User Profile Structure:**
```typescript
User = {
  uid: string
  email: string
  displayName: string
  brandId: string // Links user to their team
}
```

**Authorization Model:**
- **Brand Membership** (`brandMembers/{brandId}_{userId}`)
  - Roles: `MANAGER` (Team Lead) | `CONTRIBUTOR` (Member)
  - Status: `ACTIVE` | `INACTIVE`
- **Firestore Security Rules** - Enforce brand-level access control
- **Server-side Checks** - `requireBrandAccess()` validates membership

**Invitation System:**
- Managers invite by email
- Invitation stored in `brandInvitations/{brandId}_{email}`
- Token-based acceptance flow
- Auto-consumption on login if email matches

---

### 7. Comment System

**Architecture:** Threaded comments with @mentions, flags, and resolution tracking.

**Data Model:**
```typescript
Comment = {
  id: string
  brandId: string
  contextType: 'campaign' | 'contentBlock' | 'image' | 'video' | 'brandProfile'
  contextId: string
  parentId?: string // null for top-level, set for replies
  body: string
  createdBy: string
  status: 'active' | 'edited' | 'deleted' | 'resolved' | 'flagged'
  replyCount: number // Denormalized
  revisionHistory?: CommentRevision[]
}
```

**Features:**
- **Threaded Replies** - Nested comment structure
- **@Mentions** - Autocomplete team member mentions
- **Flagging** - Report inappropriate content
- **Resolution** - Mark comments as resolved
- **Revision History** - Track edits
- **Context Aggregation** - `commentContexts/{brandId}_{contextType}_{contextId}` tracks stats

**Mention System:**
- Fetches team members for autocomplete
- Parses `@username` patterns
- Creates notifications for mentioned users

---

### 8. Individual Identity System

**Purpose:** Personal profiles for team members (70% individual, 30% team context).

**Data Model:**
```typescript
IndividualIdentity = {
  id: string // `${brandId}_${userId}`
  brandId: string
  userId: string
  roleTitle?: string
  narrativeSummary?: string
  achievements?: string[]
  skills?: string[]
  workingStyle?: string
  personalMission?: string
  personalValues?: string[]
  testimonials?: Array<{text, author, role, date}>
  socialLinks?: Array<{platform, url}>
}
```

**Context Building (`src/lib/individual-identity/context.ts`):**
- Fetches Individual Identity
- Includes Team Voice guidelines (30% team context)
- Extracts Team Intelligence mentions of the individual
- Formats for AI generation prompts

**Use Cases:**
- Personal profile pages
- AI Assistant personalization
- Team member spotlights
- Skills-based task assignment

---

### 9. Sponsorship System

**Purpose:** Cross-team collaboration where one team sponsors another.

**Data Model:**
```typescript
Sponsorship = {
  id: string // `${sponsorBrandId}_${sponsoredBrandId}`
  sponsorBrandId: string
  sponsoredBrandId: string
  status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REVOKED' | 'EXPIRED'
  permissions: {
    canViewBrandProfile: boolean
    canViewUploads: boolean
  }
}
```

**Flow:**
1. Sponsor team sends invitation to sponsored team manager
2. Invitation stored in `sponsorshipInvitations/{sponsorBrandId}_{email}`
3. Manager accepts/declines
4. Active sponsorship grants view-only access
5. Sponsored team appears in sponsor's AI Assistant context

---

## Data Architecture

### Firestore Collections

**Core Collections:**
- `users/{userId}` - User profiles
- `brands/{brandId}` - Team metadata
- `brandMembers/{brandId}_{userId}` - Team membership
- `brandInvitations/{brandId}_{email}` - Team invitations
- `campaigns/{campaignId}` - Saved initiatives
- `images/{imageId}` - AI-generated images (legacy, migrating to unifiedMedia)
- `videos/{videoId}` - AI-generated videos (legacy, migrating to unifiedMedia)
- `unifiedMedia/{mediaId}` - Unified media library
- `mediaCollections/{collectionId}` - Media collections/albums

**Team Intelligence Collections:**
- `brandArtifacts/{brandId}/sources/{artifactId}` - Ingested sources
- `brandSoul/{brandId}` - Published Team Intelligence
- `brandSoulVersions/{brandId}/versions/{versionId}` - Historical versions
- `brandSoulJobs/{jobId}` - Processing jobs

**Collaboration Collections:**
- `comments/{commentId}` - Threaded comments
- `commentContexts/{contextId}` - Comment aggregation
- `commentFlags/{flagId}` - Flagged comments
- `individualIdentities/{brandId}_{userId}` - Personal profiles
- `sponsorships/{sponsorBrandId}_{sponsoredBrandId}` - Cross-team sponsorships

### Firebase Storage Structure

```
gs://{bucket}/
  {brandId}/
    images/
      {imageId}.png
    videos/
      {videoId}.mp4
    documents/
      {documentId}.pdf
    brand-soul/
      artifacts/
        {artifactId}/
          content.txt
          images/
            {imageId}.png
          screenshots/
            {screenshotId}.png
```

---

## API Architecture

### Next.js API Routes (`src/app/api/`)

**Authentication:**
- `POST /api/auth/session` - Create secure session
- `POST /api/auth/consume-invitation` - Auto-consume invitations

**Team Intelligence:**
- `POST /api/brand-soul/ingest/website` - Crawl website
- `POST /api/brand-soul/ingest/document` - Upload document
- `POST /api/brand-soul/ingest/video` - Ingest YouTube video
- `POST /api/brand-soul/ingest/manual` - Manual text entry
- `GET /api/brand-soul/get` - Get Brand Soul
- `POST /api/brand-soul/synthesize` - Synthesize Brand Soul from artifacts
- `GET /api/brand-soul/artifacts` - List artifacts
- `GET /api/brand-soul/insights` - Get insights

**AI Generation:**
- `POST /api/generate-campaign-content` - Generate initiative content
- `POST /api/parse-event-description` - Parse natural language event

**Media:**
- `POST /api/media-library/create` - Create media entry
- `POST /api/media-library/search` - Search media
- `POST /api/media-library/migrate` - Migrate legacy media
- `GET /api/media-library/collections` - List collections

**Chat:**
- `POST /api/chat` - Chat with ADK agent (proxies to Python service)
- `GET /api/chat/history` - Get chat history
- `POST /api/chat/delete-session` - Clear session

**Python Service Proxy:**
- `GET /api/python/hello` - Health check
- `POST /api/python/marketing-agent/[...path]` - Proxy to Python FastAPI

### Python FastAPI Service (`python_service/main.py`)

**Endpoints:**
- `GET /` - Health check
- `POST /agent/chat` - ADK agent chat
- `GET /agent/status` - Agent availability
- `POST /agent/delete-session` - Clear session
- `GET /agent/session-stats` - Session statistics
- `GET /agent/chat-history` - Chat history
- `POST /extract-colors` - Extract color palette from screenshot

---

## Security Architecture

### Authentication
- **Firebase Auth** - Email/password with email verification
- **Secure Sessions** - httpOnly cookies for server-side auth
- **Email Verification** - Required before login (enforced in `use-auth.tsx`)

### Authorization
- **Firestore Security Rules** - Brand-level access control
- **Server-side Validation** - `requireBrandAccess()` checks membership
- **Role-based Permissions** - MANAGER vs CONTRIBUTOR roles
- **Sponsorship Access** - View-only access for sponsored teams

### Data Isolation
- **Brand-scoped Queries** - All queries filter by `brandId`
- **Composite Keys** - `{brandId}_{userId}` for multi-tenant isolation
- **Session Isolation** - ADK agent sessions scoped by brand/user

### Input Validation
- **URL Validation** - Firecrawl only accepts http/https URLs
- **SSRF Prevention** - Media URLs validated to Firebase Storage only
- **Type Safety** - TypeScript + Zod schemas for API validation

---

## Performance Optimizations

### Frontend
- **Server Components** - Reduce client-side JavaScript
- **Virtual Scrolling** - Media library handles large datasets
- **Cursor Pagination** - Efficient pagination without offset
- **Client-side Sorting** - Avoids Firestore composite indexes
- **Image Optimization** - Next.js Image component with remote patterns

### Backend
- **Parallel Fetching** - Promise.all() for independent data
- **Token Budget Management** - Truncates context to fit model limits
- **Session Cleanup** - Auto-clear after media generation (prevents token overflow)
- **Batch Operations** - Migration system processes in batches

### Caching Strategy
- **No Caching** - Real-time updates for Team Intelligence context
- **Session Persistence** - SQLite database for chat history
- **Firestore Indexes** - Composite indexes for common queries

---

## Deployment Architecture

### Replit VM Deployment
- **Single VM** - Reserved VM instance
- **Port 5000** - Next.js frontend (external)
- **Port 8000** - Python FastAPI (internal, proxied by Next.js)
- **Concurrent Services** - `concurrently` runs both services
- **Start Script** - `start-services.sh` manages startup

### Environment Variables
- **MOMENTUM_ Prefix** - All env vars use this prefix for Replit Secrets
- **Next.js Mapping** - `next.config.ts` maps `MOMENTUM_NEXT_PUBLIC_*` to `NEXT_PUBLIC_*`
- **Required Variables:**
  - Firebase client config (6 variables)
  - Firebase admin credentials (JSON)
  - Google API key
  - Firecrawl API key

### Database
- **Firestore** - Managed NoSQL database
- **Firebase Storage** - Managed file storage
- **SQLite** - Local database for ADK agent sessions (`agent_sessions.db`)

---

## Key Design Patterns

### 1. Context Injection Pattern
All AI generation flows follow this pattern:
```typescript
const brandSoulContext = await getBrandSoulContext(brandId, includeComprehensive, tokenBudget);
const guidelines = getBrandSoulInstruction(brandSoulContext);
// Inject into prompt template
```

### 2. Server Action Pattern
Server actions handle auth, authorization, and data access:
```typescript
export async function someAction(brandId: string, ...args) {
  const user = await getAuthenticatedUser();
  await requireBrandAccess(user.uid, brandId);
  // ... business logic
}
```

### 3. Composite Key Pattern
Multi-tenant isolation using composite keys:
- `brandMembers/{brandId}_{userId}`
- `individualIdentities/{brandId}_{userId}`
- `sponsorships/{sponsorBrandId}_{sponsoredBrandId}`

### 4. Status Flow Pattern
Artifacts follow a clear status flow:
`pending` → `processing` → `extracting` → `extracted` → `approved` → `published`

### 5. Denormalization Pattern
Aggregated data stored for performance:
- `replyCount` on comments
- `totalComments` on comment contexts
- Collection counts on media collections

---

## Integration Points

### External Services
1. **Firecrawl** - Website crawling for Team Intelligence
2. **Google AI** - Gemini, Imagen, Veo models
3. **Firebase** - Auth, Firestore, Storage
4. **Replit** - VM deployment platform

### Internal Services
1. **Next.js ↔ Python FastAPI** - HTTP proxy for ADK agent
2. **Frontend ↔ Backend** - Server actions + API routes
3. **Genkit Flows ↔ Brand Soul** - Context injection for AI generation

---

## Future Architecture Considerations

### Scalability
- **Firestore Limits** - Consider sharding for very large teams
- **Session Management** - May need Redis for distributed sessions
- **Media Storage** - Consider CDN for global media delivery
- **Background Jobs** - May need Cloud Tasks for large processing jobs

### Feature Extensions
- **Real-time Collaboration** - WebSocket support for live editing
- **Mobile Apps** - React Native or Flutter apps
- **Integrations** - Calendar, CRM, project management tools
- **Advanced Analytics** - Team Intelligence quality scores, usage metrics

---

## Development Workflow

### Local Development
```bash
npm run dev  # Starts Next.js (5000) + Python (8000)
npm run dev:next  # Next.js only
npm run dev:python  # Python only
```

### Code Organization
- `src/app/` - Next.js pages and API routes
- `src/components/` - React components
- `src/lib/` - Shared utilities and business logic
- `src/ai/flows/` - Genkit AI flows
- `python_service/` - Python FastAPI service
- `docs/` - Documentation

### Type Safety
- TypeScript throughout
- Zod schemas for API validation
- Shared types in `src/lib/types.ts`

---

## Critical Dependencies

### AI Models
- **Gemini 2.0/2.5 Flash** - Text and vision
- **Imagen 4.0** - Image generation
- **Veo 3.1** - Video generation

### Infrastructure
- **Firebase** - Core backend services
- **Google Cloud** - AI model hosting
- **Firecrawl** - Website crawling

### Framework
- **Next.js 15** - React framework
- **Python 3.11+** - ADK agent runtime
- **Node.js 22+** - Frontend runtime

---

## Known Limitations & Considerations

1. **Session Token Limits** - ADK agent sessions auto-clear after media generation to prevent overflow
2. **Firestore Queries** - Some queries use client-side sorting to avoid composite indexes
3. **Media Migration** - One-time migration from legacy collections to unifiedMedia
4. **Email Verification** - Required before login (strict enforcement)
5. **Single VM Deployment** - All services run on one VM instance

---

## Conclusion

MOMENTUM is a sophisticated AI-powered platform with a well-architected system for Team Intelligence, multi-modal AI generation, and team collaboration. The architecture emphasizes:

- **Context-Aware AI** - All generation influenced by Team Intelligence
- **Multi-Tenant Isolation** - Brand-scoped data and access control
- **Scalable Data Model** - Firestore collections with proper indexing
- **Type Safety** - TypeScript throughout with Zod validation
- **Security First** - Authentication, authorization, and input validation
- **Performance** - Optimizations for large datasets and real-time updates

The platform successfully bridges the gap between team knowledge management and AI-powered content generation, providing a unified workspace for diverse team types.

