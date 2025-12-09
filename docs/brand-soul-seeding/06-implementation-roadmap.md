# Brand Soul Seeding - Implementation Roadmap

## Overview

This document outlines a phased approach to implementing the Brand Soul Seeding feature, with realistic timelines, milestones, and success criteria.

---

## Development Phases

### Phase 0: Foundation (Week 1)
**Goal**: Set up infrastructure and dependencies

#### Tasks
1. **External Services Setup**
   - [ ] YouTube Data API access (Google Cloud Console)
   - [ ] Evaluate web crawling solutions:
     - Option A: Firecrawl.dev (paid, easier) ← **Recommended for MVP**
     - Option B: Custom Puppeteer (free, more work)
   - [ ] Configure Google Cloud Storage bucket for brand assets
   - [ ] Set up background job processing (Cloud Functions or similar)

2. **Database Schema**
   - [ ] Create Firestore collections:
     - `brandArtifacts/{brandId}/sources/{artifactId}`
     - `brandSoul/{brandId}`
     - `brandSoulVersions/{brandId}/versions/{versionId}`
     - `processingQueue/{brandId}/jobs/{jobId}`
   - [ ] Set up Firestore security rules
   - [ ] Create composite indexes

3. **Type Definitions**
   - [ ] Create `/src/lib/types/brand-soul.ts` with all TypeScript interfaces
   - [ ] Integrate with existing types system

4. **Development Environment**
   - [ ] Install dependencies (PDF.js, Mammoth.js, etc.)
   - [ ] Set up environment variables
   - [ ] Configure API routes structure

**Deliverables**:
- ✅ All external APIs configured
- ✅ Database schema deployed
- ✅ TypeScript types defined
- ✅ Dev environment ready

**Success Criteria**:
- Can create/read brand soul documents in Firestore
- Can upload files to GCS
- Can call YouTube API
- Types compile without errors

**Estimated Time**: 3-5 days

---

### Phase 1: MVP - Core Ingestion Pipeline (Weeks 2-3)
**Goal**: Implement basic source ingestion and AI extraction

#### Tasks

**Week 2: Backend Infrastructure**

1. **API Endpoints (MVP scope)**
   - [x] `POST /api/brand-soul/ingest/website` - Website crawl
   - [x] `POST /api/brand-soul/ingest/document` - Document upload
   - [x] `POST /api/brand-soul/ingest/manual` - Manual text input
   - [x] `GET /api/brand-soul/artifact/{id}` - Get artifact status
   - [x] `GET /api/brand-soul/artifacts` - List all artifacts
   - [ ] `POST /api/brand-soul/approve/{id}` - Approve insights (deferred to Week 3)

2. **Ingestion Workers**
   - [x] **WebsiteCrawler**:
     - If using Firecrawl: Integrate API
     - If custom: Implement with Puppeteer + robots.txt parser
     - Limit: 50 pages, depth 3
   - [x] **DocumentParser**:
     - PDF text extraction (PDF.js)
     - DOCX parsing (Mammoth.js)
     - Store in GCS
   - [x] **Manual Input Handler**:
     - Simple text storage
     - Validation

3. **AI Extraction Pipeline**
   - [x] **GeminiExtractor Service**:
     - Build extraction prompts for each source type
     - Call Gemini 1.5 Flash
     - Parse JSON responses
     - Calculate confidence scores
   - [x] **Error Handling**:
     - Retry logic (max 3 attempts)
     - Exponential backoff
     - Error logging

**Week 3: Synthesis & Storage**

4. **Brand Soul Synthesis**
   - [x] **BrandSoulSynthesizer Service**:
     - Collect approved insights
     - Call Gemini 1.5 Pro for synthesis
     - Generate voice profile
     - Build fact library
     - Create messaging framework
   - [x] **RAG Integration**:
     - Chunk content (500-1000 tokens)
     - Generate embeddings (text-embedding-004)
     - Store in vector DB with brand namespace

5. **Version Management**
   - [x] Create new version on synthesis
   - [x] Store version history
   - [x] Implement rollback logic

**Deliverables (Week 2-3)**:
- ✅ Working ingestion for 3 source types
- ✅ AI extraction producing insights
- ✅ Brand soul synthesis pipeline
- ✅ Basic RAG integration

**Success Criteria**:
- Can crawl a website and extract insights
- Can upload and parse PDF documents
- Can add manual text input
- AI produces coherent voice profile
- Embeddings stored in vector DB
- Can generate initial brand soul

**Estimated Time**: 10-12 days

---

### Phase 2: User Interface (Weeks 4-5)
**Goal**: Build intuitive UI for setup and management

#### Tasks

**Week 4: Setup Wizard**

1. **BrandSoulProvider Context**
   - [x] Implement global state management
   - [x] Real-time Firestore listeners
   - [x] Action methods (addSource, approveInsights, etc.)

2. **Setup Wizard Components**
   - [x] Welcome step
   - [x] Website crawl step (URL input + validation)
   - [x] Document upload step (drag & drop)
   - [x] Manual input step (rich text editor)
   - [x] Processing step (live progress)
   - [x] Review step (insights display)

3. **Form Components**
   - [x] WebsiteCrawlForm
   - [x] DocumentUploadForm
   - [x] ManualInputForm
   - [x] Validation logic
   - [x] Error messages

**Week 5: Dashboard & Management**

4. **Brand Soul Dashboard**
   - [x] Health score panel
   - [x] Active sources list
   - [x] Pending reviews queue
   - [x] Quick actions
   - [x] Activity feed

5. **Source Manager**
   - [x] Add source modal
   - [x] Source detail view
   - [x] Delete/refresh actions

6. **Review Interface**
   - [x] InsightsTabs component
   - [x] VoiceProfileCard
   - [x] FactLibraryCard
   - [x] MessagingCard
   - [x] Approval actions

**Deliverables (Week 4-5)**:
- ✅ Complete setup wizard (7 steps)
- ✅ Brand soul dashboard
- ✅ Source management UI
- ✅ Review & approval interface

**Success Criteria**:
- User can complete setup wizard in <10 minutes
- Dashboard shows real-time status
- Can review and approve insights from UI
- Mobile-responsive
- Accessibility (WCAG AA)

**Estimated Time**: 10-12 days

---

### Phase 3: Integration & Enhancement (Week 6)
**Goal**: Integrate brand soul with content generation

#### Tasks

1. **Campaign Generator Integration**
   - [x] Modify campaign generation to fetch brand soul
   - [x] Build enhanced prompts with brand context
   - [x] Inject voice profile into system message
   - [x] Query RAG for relevant facts
   - [x] Test campaigns match brand voice

2. **Global AI Chatbot Enhancement**
   - [x] Add brand context to chatbot system message
   - [x] Enable chatbot to reference brand facts
   - [x] Maintain brand voice in responses

3. **Image/Video Generation Enhancement**
   - [x] Include visual identity in image prompts
   - [x] Apply brand colors and style to generated images
   - [x] Test consistency

4. **BrandDataProvider Extension**
   - [x] Add `brandSoul` to context
   - [x] Add `refetch.brandSoul()` method
   - [x] Auto-load brand soul on brand switch

**Deliverables**:
- ✅ All AI features use brand soul automatically
- ✅ Campaigns sound like the brand
- ✅ Images match brand visual identity
- ✅ Chatbot maintains brand voice

**Success Criteria**:
- Generated campaigns get 80%+ match score with brand voice
- Users notice consistent brand personality
- Visual content aligns with brand colors/style

**Estimated Time**: 5-6 days

---

### Phase 4: Polish & Testing (Week 7)
**Goal**: Bug fixes, optimization, and user testing

#### Tasks

1. **Testing**
   - [ ] Unit tests for critical functions
   - [ ] Integration tests for API endpoints
   - [ ] E2E tests for setup wizard flow
   - [ ] Manual testing across devices/browsers

2. **Performance Optimization**
   - [ ] Code splitting for wizard
   - [ ] Optimize Firestore queries
   - [ ] Implement caching where appropriate
   - [ ] Image optimization

3. **Error Handling & Edge Cases**
   - [ ] Graceful handling of API failures
   - [ ] Offline support (progressive enhancement)
   - [ ] Edge case testing (empty brand soul, conflicts, etc.)

4. **Documentation**
   - [ ] User guide (how to set up brand soul)
   - [ ] Admin documentation
   - [ ] API documentation
   - [ ] Video tutorials

5. **User Acceptance Testing**
   - [ ] Beta test with 5-10 users
   - [ ] Collect feedback
   - [ ] Iterate on UX issues

**Deliverables**:
- ✅ Comprehensive test coverage (>80%)
- ✅ Optimized performance
- ✅ Complete documentation
- ✅ Beta testing feedback incorporated

**Success Criteria**:
- No critical bugs
- Setup wizard completion rate >75%
- User satisfaction >8/10
- Performance meets targets

**Estimated Time**: 5-6 days

---

### Phase 5: Launch & Iteration (Week 8+)
**Goal**: Production release and continuous improvement

#### Tasks

1. **Production Deployment**
   - [ ] Deploy backend services
   - [ ] Migrate database schema
   - [ ] Configure monitoring & alerts
   - [ ] Set up analytics

2. **Launch Communication**
   - [ ] Announcement to existing users
   - [ ] Tutorial videos
   - [ ] Blog post about feature
   - [ ] Email campaign

3. **Monitoring & Support**
   - [ ] Monitor error rates
   - [ ] Track usage metrics
   - [ ] Respond to user issues
   - [ ] Collect feature requests

4. **Iteration (Ongoing)**
   - [ ] Address bugs quickly
   - [ ] Implement quick wins
   - [ ] Plan Phase 2 features

**Success Criteria**:
- 50% of active users set up brand soul in first month
- <1% error rate
- Positive user feedback
- No major incidents

**Estimated Time**: Ongoing

---

## Post-MVP Enhancements (Phase 2)

### Phase 2.1: Advanced Sources (Weeks 9-10)
**Goal**: Add more ingestion options

**Features**:
- YouTube channel analysis (full integration)
- Link/article extraction
- Social media profile analysis (Twitter/X, LinkedIn)
- Batch URL import
- Scheduled re-crawling
- External article search

**Estimated Time**: 8-10 days

---

### Phase 2.2: Advanced Features (Weeks 11-12)
**Goal**: Enhanced intelligence and automation

**Features**:
- Auto-conflict resolution with confidence thresholds
- Automated drift detection (brand changed?)
- Suggested content based on brand soul
- Advanced search over brand knowledge
- Export brand book as PDF
- Webhook notifications

**Estimated Time**: 8-10 days

---

### Phase 2.3: Analytics & Insights (Weeks 13-14)
**Goal**: Provide actionable intelligence

**Features**:
- Brand soul analytics dashboard
- Source utilization metrics
- Confidence trends over time
- Brand voice consistency scoring
- Competitive brand analysis (optional)
- Content performance by voice adherence

**Estimated Time**: 8-10 days

---

## Resource Requirements

### Team Composition (Recommended)

**MVP (Phases 0-4)**:
- 1 Full-Stack Developer (primary)
- 1 Frontend Specialist (UI/UX implementation)
- 1 Backend/AI Engineer (ingestion pipeline)
- 1 Designer (UX flows, visual design)
- 1 QA Engineer (part-time, Week 7)

**Total**: 3.5-4 full-time equivalents

### External Dependencies

1. **Required APIs**:
   - YouTube Data API (free tier sufficient for MVP)
   - Web crawling service (Firecrawl.dev ~$50-100/month for testing)
   - Google Cloud services (included in existing setup)

2. **Optional Services**:
   - News API (for press mentions)
   - Social media APIs (Phase 2)

### Infrastructure Costs (Estimated)

**Monthly (MVP)**:
- Firecrawl.dev: $50-100
- YouTube API: Free
- GCS storage: $20-50 (depending on usage)
- Firestore: $20-40 (writes/reads)
- Cloud Functions: $10-30 (processing)
- **Total**: ~$100-220/month for testing/beta

**Monthly (Production)**:
- Expect 3-5x increase based on actual usage
- Budget: $300-1000/month

---

## Risk Management

### High-Risk Items

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Web crawling complexity | High | Medium | Use Firecrawl API for MVP |
| AI extraction quality | High | Medium | Human approval workflow |
| Large file processing | Medium | Medium | File size limits, Cloud Run |
| API quota limits | Medium | Low | Caching, rate limiting |
| User adoption | High | Medium | Excellent onboarding UX |
| Processing time too long | Medium | Medium | Background jobs, notifications |

### Contingency Plans

1. **Web Crawling Fails**: Fallback to manual input + document upload
2. **AI Quality Issues**: Increase human review threshold
3. **Performance Problems**: Implement queue system, async processing
4. **Low Adoption**: Gamification, incentives, better education

---

## Success Metrics

### MVP Success (End of Week 8)

**Adoption**:
- 50% of active brands set up brand soul
- 75% setup wizard completion rate
- Average setup time <15 minutes

**Quality**:
- 85%+ user satisfaction
- <5% error rate in processing
- 80%+ voice match accuracy

**Engagement**:
- 30% of campaigns use brand soul
- 60% users approve insights without edits
- 40% add >3 sources

**Technical**:
- 99% uptime
- <3 second page load
- <5 minute processing time (avg)

### Phase 2 Success (End of Week 14)

**Growth**:
- 75% of active brands with brand soul
- 50% add Phase 2 sources (articles, social)
- 30% use scheduled refreshes

**Intelligence**:
- 90% auto-conflict resolution success
- 85% drift detection accuracy
- 50% engagement with analytics

---

## Timeline Summary

```
Week 1:  [Foundation]
Week 2:  [Backend - Ingestion Pipeline]
Week 3:  [Backend - Synthesis & RAG]
Week 4:  [Frontend - Setup Wizard]
Week 5:  [Frontend - Dashboard & Management]
Week 6:  [Integration with Content Generation]
Week 7:  [Testing & Polish]
Week 8:  [Launch & Monitoring]
Week 9-10:  [Phase 2.1 - Advanced Sources]
Week 11-12: [Phase 2.2 - Advanced Features]
Week 13-14: [Phase 2.3 - Analytics]
```

**MVP Launch**: End of Week 8 (7-8 weeks total)
**Phase 2 Complete**: End of Week 14 (14 weeks total)

---

## Decision Points

### Key Decisions to Make Before Starting

1. **Web Crawling Solution**:
   - [ ] Firecrawl.dev (paid, faster to implement) ← **Recommended**
   - [ ] Custom Puppeteer (free, more work)
   - [ ] Hybrid (Firecrawl for MVP, custom for scale)

2. **State Management**:
   - [ ] Extend BrandDataProvider
   - [ ] Separate BrandSoulProvider ← **Recommended**
   - [ ] Use React Query exclusively

3. **Processing Architecture**:
   - [ ] Cloud Functions (serverless)
   - [ ] Cloud Run (containerized)
   - [ ] Hybrid (simple tasks = Functions, heavy = Run)

4. **Testing Strategy**:
   - [ ] Jest + React Testing Library
   - [ ] Playwright for E2E
   - [ ] Cypress for E2E
   - [ ] Mix of above ← **Recommended**

---

## Next Steps

### Immediate Actions (This Week)

1. **Review & Approve Design**:
   - [ ] Stakeholder review of all design docs
   - [ ] Designer review of UX flows
   - [ ] Technical review by team lead

2. **Make Key Decisions**:
   - [ ] Decide on web crawling solution
   - [ ] Finalize state management approach
   - [ ] Choose testing framework

3. **Set Up Infrastructure**:
   - [ ] Create Google Cloud project (if needed)
   - [ ] Set up APIs
   - [ ] Configure Firestore collections

4. **Kick Off Development**:
   - [ ] Assign tasks to team
   - [ ] Set up project board (Jira, Linear, etc.)
   - [ ] Schedule daily standups
   - [ ] Start Week 1 tasks

---

## Conclusion

The Brand Soul Seeding feature is a transformative addition to AdVantage that will:
- Differentiate the platform from competitors
- Significantly improve content generation quality
- Reduce time-to-market for campaigns
- Enhance user satisfaction and retention

With proper planning, a skilled team, and 7-8 weeks of focused development, this feature can be delivered as a polished MVP that provides immediate value to users while establishing a foundation for continuous enhancement.

**Recommended Next Step**: Begin Phase 0 (Foundation) immediately after design approval.

---

**End of Technical Design Documents**

All specifications ready for implementation! 🚀
