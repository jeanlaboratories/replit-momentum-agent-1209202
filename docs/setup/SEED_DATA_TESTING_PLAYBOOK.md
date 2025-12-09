# MOMENTUM Seed Data Testing Playbook
## Complete Guide to Test Users, Sample Brands & QA Testing

**Version**: 1.0
**Date**: November 2025
**Password for ALL test accounts**: `Welcome1!`

---

# TABLE OF CONTENTS

1. [Quick Start](#1-quick-start)
2. [Test User Accounts](#2-test-user-accounts)
3. [Sample Brands](#3-sample-brands)
4. [Brand Soul Data](#4-brand-soul-data)
5. [Sample Content](#5-sample-content)
6. [Testing Scenarios](#6-testing-scenarios)
7. [API Testing](#7-api-testing)
8. [Troubleshooting](#8-troubleshooting)
9. [Sponsorship Flow Testing](#9-sponsorship-flow-testing)

---

# 1. QUICK START

## How to Seed the Database

### Option A: Web Interface
1. Navigate to `/admin/seed`
2. Click **"Seed Database"** button
3. Wait for confirmation (creates 100+ documents)

### Option B: API Call
```bash
curl -X POST https://your-domain.com/api/admin/seed
```

### Option C: Local Development
```bash
# Ensure you're logged in
npm run dev
# Navigate to http://localhost:3000/admin/seed
```

## How to Clear All Data
1. Navigate to `/admin/seed`
2. Click **"Clear Database"** button
3. Confirm destructive action
4. All test users, brands, and content will be deleted

---

# 2. TEST USER ACCOUNTS

## Universal Password: `Welcome1!`

### Lightning FC (Sports Team)
| Email | Name | Role | User ID |
|-------|------|------|---------|
| `coach@lightningfc.team` | Coach Sarah Martinez | Manager | `lightning-coach-01` |
| `alex@lightningfc.team` | Alex Chen | Contributor | `lightning-coordinator-01` |

### Nova Labs (SaaS/Product)
| Email | Name | Role | User ID |
|-------|------|------|---------|
| `sarah@novalabs.io` | Sarah Kim | Manager | `nova-pm-01` |
| `james@novalabs.io` | James Wilson | Contributor | `nova-eng-01` |

### Spectrum Creative Studio (Creative Agency)
| Email | Name | Role | User ID |
|-------|------|------|---------|
| `maya@spectrumcreative.studio` | Maya Rodriguez | Manager | `spectrum-director-01` |
| `jordan@spectrumcreative.studio` | Jordan Taylor | Contributor | `spectrum-designer-01` |

### QuantumBio Research Lab (Research/Science)
| Email | Name | Role | User ID |
|-------|------|------|---------|
| `dr.chen@quantumbio.research` | Dr. Michael Chen | Manager | `quantum-pi-01` |
| `emma@quantumbio.research` | Dr. Emma Johnson | Contributor | `quantum-researcher-01` |

### Hope Harbor Community (Nonprofit)
| Email | Name | Role | User ID |
|-------|------|------|---------|
| `director@hopeharbor.org` | Maria Garcia | Manager | `harbor-director-01` |
| `tom@hopeharbor.org` | Tom Anderson | Contributor | `harbor-volunteer-01` |

---

# 3. SAMPLE BRANDS

## Brand Overview Table

| Brand ID | Name | Category | Location | Best For Testing |
|----------|------|----------|----------|------------------|
| `lightning-fc` | Lightning FC | Sports | Austin, TX | Team collaboration, action imagery |
| `nova-labs` | Nova Labs | Technology | San Francisco, CA | Product launches, tech demos |
| `spectrum-creative` | Spectrum Creative Studio | Creative/Design | Brooklyn, NY | Visual content, portfolios |
| `quantumbio-research` | QuantumBio Research Lab | Research/Science | Cambridge, MA | Academic, data visualization |
| `hope-harbor` | Hope Harbor Community | Nonprofit | Seattle, WA | Community impact, volunteers |

## Detailed Brand Profiles

### Lightning FC
```
Brand ID: lightning-fc
Tagline: "Strike Fast. Play Smart. Win Together."
Colors:
  - Teal: #2CAAA0
  - Green: #3DD68C
  - Gold: #FFD700

Key Metrics:
  - 250+ active players
  - 12 championships
  - 45 college commits
  - 15 years competing

Logo: https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=400
Banner: https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200
```

### Nova Labs
```
Brand ID: nova-labs
Tagline: "Productivity Powered by Intelligence"
Colors:
  - Purple: #5B21B6
  - Sky Blue: #0EA5E9
  - Orange: #F97316

Key Metrics:
  - 50K+ active users
  - 2M+ tasks automated
  - 100+ integrations
  - 500K hours saved

Key Product: TaskFlow 3.0 (AI-powered project management)

Logo: https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400
Banner: https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200
```

### Spectrum Creative Studio
```
Brand ID: spectrum-creative
Tagline: "Where Strategy Meets Beauty"
Colors:
  - Pink: #EC4899
  - Purple: #8B5CF6
  - Amber: #F59E0B

Key Metrics:
  - 120+ brands launched
  - 18 design awards
  - 98% client satisfaction
  - 8 years in business

Logo: https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400
Banner: https://images.unsplash.com/photo-1561070791-2526d30994b5?w=1200
```

### QuantumBio Research Lab
```
Brand ID: quantumbio-research
Tagline: "Where Quantum Meets Biology"
Colors:
  - Cyan: #0891B2
  - Violet: #7C3AED
  - Green: #10B981

Key Metrics:
  - 12 active studies
  - 87 publications
  - $15M grant funding
  - 45 scientists

Logo: https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400
Banner: https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1200
```

### Hope Harbor Community
```
Brand ID: hope-harbor
Tagline: "Where Community Creates Hope"
Colors:
  - Red: #DC2626
  - Blue: #2563EB
  - Amber: #F59E0B

Key Metrics:
  - 2,500+ families served
  - 500+ volunteers
  - 75K+ meals provided
  - 12K+ volunteer hours

Logo: https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400
Banner: https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200
```

---

# 4. BRAND SOUL DATA

Each brand has comprehensive Brand Soul (Team Intelligence) data including:

## Voice Profile Structure

### Lightning FC Voice
```yaml
Primary Tone: Energetic
Secondary Tones: Motivating, Team-focused, Celebratory
Avoid: Negative, Defeatist, Overly casual

Personality Traits:
  - Passionate: 0.95
  - Supportive: 0.90
  - Competitive: 0.85

Preferred Phrases:
  - "Let's go!"
  - "Game on!"
  - "Together we win"

Writing Style: Short-to-medium sentences, punchy paragraphs
```

### Nova Labs Voice
```yaml
Primary Tone: Innovative
Secondary Tones: Helpful, Solution-focused, Forward-thinking
Avoid: Jargon-heavy, Condescending, Overly technical

Personality Traits:
  - Innovative: 0.95
  - User-centric: 0.92
  - Reliable: 0.88

Preferred Phrases:
  - "Work smarter"
  - "Seamlessly integrate"
  - "Boost productivity"
```

### Spectrum Creative Voice
```yaml
Primary Tone: Artistic
Secondary Tones: Sophisticated, Collaborative, Inspiring
Avoid: Generic, Corporate-speak, Rushed

Personality Traits:
  - Creative: 0.98
  - Strategic: 0.90
  - Boutique: 0.85

Preferred Phrases:
  - "Beautifully crafted"
  - "Story-driven"
  - "Elevated design"
```

## Visual Identity Settings

| Brand | Fonts | Image Style | Lighting | Mood |
|-------|-------|-------------|----------|------|
| Lightning FC | Montserrat, Open Sans | Action sports photography | Natural outdoor | Energetic, triumphant |
| Nova Labs | Inter, JetBrains Mono | Minimalist tech aesthetic | Soft studio | Professional, innovative |
| Spectrum Creative | Playfair Display, Lato | Editorial, artistic | Dramatic studio | Sophisticated, inspiring |
| QuantumBio | Source Sans Pro, Fira Code | Scientific visualization | Clean lab | Precise, cutting-edge |
| Hope Harbor | Nunito, Roboto | Warm documentary style | Golden hour | Hopeful, community |

## Fact Library (per brand)

Each brand has 3 key facts stored:
- **Lightning FC**: Championships, player count, college placements
- **Nova Labs**: User count, hours saved, integrations
- **Spectrum Creative**: Awards, brands launched, satisfaction rate
- **QuantumBio**: Studies, publications, funding
- **Hope Harbor**: Families served, volunteers, meals provided

---

# 5. SAMPLE CONTENT

## Pre-Seeded Images (10 total)

| Brand | Image Title | Description |
|-------|-------------|-------------|
| Lightning FC | Game Day Action Shot | Dynamic soccer action photography |
| Lightning FC | Player Spotlight Portrait | Athlete in team uniform |
| Nova Labs | Product Feature Showcase | TaskFlow UI/UX screenshot |
| Nova Labs | Release Announcement Graphic | Modern tech design |
| Spectrum Creative | Brand Mood Board | Artistic collage |
| Spectrum Creative | Client Pitch Deck Cover | Professional presentation |
| QuantumBio | Lab Equipment Visualization | Scientific laboratory |
| QuantumBio | Conference Poster Design | Research poster |
| Hope Harbor | Community Service Event | Volunteers serving meals |
| Hope Harbor | Impact Story Visual | Community helping hands |

## Pre-Seeded Videos (5 total)

| Brand | Video Title | Size |
|-------|-------------|------|
| Lightning FC | Game Highlights Reel | 1mb |
| Lightning FC | Training Session Hype Video | 2mb |
| Nova Labs | Feature Release Demo | 1mb |
| Spectrum Creative | Client Project Case Study | 2mb |
| Hope Harbor | Volunteer Stories Documentary | 2mb |

## Brand Artifacts (11 total)

| Brand | Artifact Type | Status | Description |
|-------|---------------|--------|-------------|
| Lightning FC | Website | extracted | Championship history, player development |
| Lightning FC | Manual Text | completed | College placement records |
| Lightning FC | YouTube | pending | Championship highlights 2024 |
| Nova Labs | Document | completed | TaskFlow product brief |
| Nova Labs | Website | extracted | Integration documentation |
| Nova Labs | Manual Text | pending | Customer success stories |
| Spectrum Creative | Website | extracted | Portfolio, awards, case studies |
| Spectrum Creative | Document | completed | Brand guidelines template |
| Spectrum Creative | Image | private | Mood board collection |
| QuantumBio | Website | extracted | Research publications |
| QuantumBio | Document | completed | Lab facilities documentation |
| Hope Harbor | Document | completed | Annual impact report |
| Hope Harbor | Manual Text | completed | Volunteer handbook |

## Sample Campaigns (5 total)

| Campaign ID | Brand | Description |
|-------------|-------|-------------|
| demo-campaign-01 | Lightning FC | Pre-game championship hype |
| demo-campaign-02 | Nova Labs | TaskFlow 3.0 product launch |
| demo-campaign-03 | Spectrum Creative | Client project announcement |
| demo-campaign-04 | QuantumBio | Research breakthrough |
| demo-campaign-05 | Hope Harbor | Winter fundraising campaign |

---

# 6. TESTING SCENARIOS

## Scenario 1: Brand Onboarding Flow
**User**: `coach@lightningfc.team` (new user experience)

```
1. Login with email/password: Welcome1!
2. Verify brand profile displays correctly
3. Check Brand Soul insights are populated
4. Navigate to Media Library
5. Verify sample images appear
6. Test image generation with Brand Soul influence
```

**Expected Results**:
- Brand colors (#2CAAA0, #3DD68C, #FFD700) appear in generated content
- Voice profile matches "Energetic" tone
- Fact library accessible in agent context

---

## Scenario 2: Image Generation with Brand Soul
**User**: `sarah@novalabs.io`

```
1. Login as Sarah Kim
2. Open AI Chat
3. Say: "Generate a hero image for our TaskFlow 3.0 launch"
4. Verify Brand Soul influence in output
5. Check Explainability panel
```

**Expected Results**:
- Purple (#5B21B6) and tech aesthetic applied
- Minimalist design style
- "Innovative" tone in any accompanying copy

---

## Scenario 3: Video Generation
**User**: `maya@spectrumcreative.studio`

```
1. Login as Maya Rodriguez
2. Open AI Chat
3. Say: "Create a 6-second video showcasing our creative process"
4. Wait for Veo 3.1 generation (up to 2 min)
5. Verify video saves to Media Library
```

**Expected Results**:
- Video reflects artistic/editorial style
- Dramatic lighting
- Sophisticated mood

---

## Scenario 4: Team Memory Persistence
**Users**: Both `dr.chen@quantumbio.research` and `emma@quantumbio.research`

```
1. Login as Dr. Chen
2. Chat: "Remember that our next grant deadline is January 15th"
3. Verify memory saved
4. Logout
5. Login as Dr. Emma Johnson (same team)
6. Chat: "When is our grant deadline?"
7. Verify team memory recalled
```

**Expected Results**:
- Team memory accessible to both users
- Memory persists across sessions

---

## Scenario 5: Brand Soul Explainability
**User**: `tom@hopeharbor.org`

```
1. Login as Tom Anderson
2. Generate an image: "Create a volunteer recruitment poster"
3. Click on generated image
4. Open Explainability panel
5. Verify influence breakdown shows:
   - Brand colors used
   - Visual style applied
   - Community-focused mood
```

---

## Scenario 6: Multi-User Collaboration
**Users**: `coach@lightningfc.team` and `alex@lightningfc.team`

```
1. User A (Coach) creates a campaign
2. User A shares image to team library
3. User B (Alex) logs in
4. User B can see shared content
5. User B adds comment
6. User A sees notification
```

---

## Scenario 7: Complete Demo Flow (15 min)
**Recommended User**: `sarah@novalabs.io` (Nova Labs)

```
1. [2 min] Login, tour brand profile
2. [3 min] Show Brand Soul insights panel
3. [3 min] Generate image with Brand Soul
4. [3 min] Show Explainability breakdown
5. [2 min] Generate video (start, show polling)
6. [2 min] Show Memory recall
```

---

# 7. API TESTING

## Seed Database
```bash
# Seed all data
curl -X POST https://momentum.run/api/admin/seed \
  -H "Content-Type: application/json"

# Response: { "success": true, "message": "Database seeded successfully" }
```

## Test Agent Chat
```bash
# Test with Nova Labs brand
curl -X POST https://momentum.run/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "message": "Generate a product launch image",
    "brandId": "nova-labs",
    "userId": "nova-pm-01"
  }'
```

## Test Memory Recall
```bash
curl -X POST https://momentum.run/agent/memories/list \
  -H "Content-Type: application/json" \
  -d '{
    "brand_id": "lightning-fc",
    "user_id": "lightning-coach-01"
  }'
```

## Test Brand Soul Query
```bash
curl -X GET "https://momentum.run/api/brand-soul/insights?brandId=nova-labs" \
  -H "Authorization: Bearer <token>"
```

---

# 8. TROUBLESHOOTING

## Common Issues

### Login Fails
```
Issue: "Invalid credentials" error
Solution:
  1. Verify seed was run successfully
  2. Use exact password: Welcome1!
  3. Check Firebase Auth console for user
```

### Brand Data Missing
```
Issue: Brand profile shows empty
Solution:
  1. Re-run seed from /admin/seed
  2. Check Firestore console for brands collection
  3. Verify brandId matches exactly
```

### Images Not Loading
```
Issue: Sample images show broken icons
Solution:
  1. Check Cloud Storage bucket permissions
  2. Verify CORS configuration
  3. Images use Unsplash URLs - check connectivity
```

### Brand Soul Not Influencing
```
Issue: Generated images don't reflect brand
Solution:
  1. Verify Brand Soul status is "published"
  2. Check brandSoul collection in Firestore
  3. Ensure brand_id passed to agent correctly
```

### Memory Not Persisting
```
Issue: Agent doesn't remember previous context
Solution:
  1. Check Vertex AI Memory Bank is enabled
  2. Verify agentEngineId exists for user/brand
  3. Check memory collection in Firestore
```

## Database Collections Reference

| Collection | Document Count | Purpose |
|------------|----------------|---------|
| `brands` | 5 | Brand profiles |
| `users` | 10 | User accounts |
| `brandMembers` | 10 | Brand memberships |
| `brandSoul` | 5 | Brand Soul documents |
| `brandArtifacts` | 11 | Source documents |
| `comments` | 8 | Sample comments |
| `aiModelSettings` | 5 | Model configurations |
| `userProfilePreferences` | 10 | User preferences |

## Environment Requirements

```bash
# Required environment variables
GOOGLE_APPLICATION_CREDENTIALS_JSON=<firebase-service-account>
MOMENTUM_GOOGLE_API_KEY=<gemini-api-key>
MOMENTUM_FIRECRAWL_API_KEY=<firecrawl-key>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
```

---

# 9. SPONSORSHIP FLOW TESTING

## Overview

The sponsorship system allows brands to sponsor other brands, giving them **read-only access** to the sponsored brand's profile and assets. This is useful for parent organizations, investors, or partners who need visibility.

**Note**: Sponsorship data is **NOT pre-seeded** - you must test the flow manually.

## Sponsorship Status Types

| Status | Description |
|--------|-------------|
| `PENDING` | Invitation sent, awaiting response |
| `ACTIVE` | Relationship established |
| `DECLINED` | Invitation rejected |
| `REVOKED` | Active sponsorship terminated |
| `EXPIRED` | Invitation expired (7-day window) |

## Key URLs

| Page | URL | Purpose |
|------|-----|---------|
| Team Settings | `/settings/team` | View sponsorships, pending invitations |
| Sponsor Management | `/brands/[brandId]/sponsors` | Full sponsor management (Manager only) |
| Accept Invitation | `/sponsorship/invite/[token]` | Review and accept/decline invitation |

## Sponsorship Permissions

| Action | Direct Manager | Sponsored User |
|--------|----------------|----------------|
| View brand profile | Edit | Read-only |
| View assets | Full access | Read-only |
| Edit brand profile | Yes | No |
| Manage team | Yes | No |
| Initiate sponsorships | Yes | No |
| Revoke sponsorships | Yes | No |

---

## Scenario 8: Complete Sponsorship Flow (Manual Test)

### Step 1: Initiate Sponsorship
**User**: `sarah@novalabs.io` (Nova Labs Manager)

```
1. Login as Sarah Kim (Nova Labs)
2. Navigate to /settings/team OR /brands/nova-labs/sponsors
3. Click "Invite New Sponsor" or "Sponsor Team"
4. Enter target manager email: maya@spectrumcreative.studio
5. Add optional note: "We'd love to sponsor your creative work!"
6. Click "Send Invitation"
```

**Expected Results**:
- Success message appears
- Invitation created with PENDING status
- Email sent to maya@spectrumcreative.studio
- Shows in "Pending Invitations" section

### Step 2: Review Invitation
**User**: `maya@spectrumcreative.studio` (Spectrum Creative Manager)

```
1. Check email for invitation from Nova Labs
2. Click "Review Invitation" link in email
3. Or navigate directly to /sponsorship/invite/[token]
4. View invitation details:
   - Sponsor brand name: Nova Labs
   - Who invited: Sarah Kim
   - Sponsor's message
   - Permissions: View profile, View assets
```

### Step 3a: Accept Sponsorship
```
1. Click "Accept Sponsorship"
2. Verify redirect to /settings/team
3. Check "Brands Sponsoring You" section shows Nova Labs
```

**Expected Results**:
- Sponsorship status changes to ACTIVE
- Nova Labs can now view Spectrum Creative's profile (read-only)
- Both brands see the relationship in their dashboards

### Step 3b: Decline Sponsorship (Alternative)
```
1. Click "Decline Sponsorship"
2. Verify redirect to home
3. No sponsorship relationship created
```

### Step 4: Verify Sponsor Access
**User**: `sarah@novalabs.io` (as Sponsor)

```
1. Login as Sarah Kim (Nova Labs)
2. Navigate to /settings/team
3. View "Brands You Sponsor" section
4. Click on Spectrum Creative
5. Verify READ-ONLY access to their brand profile
6. Verify cannot edit profile or manage team
```

### Step 5: Revoke Sponsorship
**Either Manager can revoke**

```
1. Navigate to /settings/team OR /brands/[brandId]/sponsors
2. Find the sponsorship relationship
3. Click "Revoke Sponsorship"
4. Confirm the action
5. Verify status changes to REVOKED
6. Access immediately removed
```

---

## Scenario 9: Cross-Brand Sponsorship Network

Test a network of sponsorships between multiple brands:

```
Suggested Sponsorship Network:
┌─────────────────┐
│   Nova Labs     │
│ (Tech Company)  │
└────────┬────────┘
         │ sponsors
         ▼
┌─────────────────┐         ┌─────────────────┐
│    Lightning FC │◄────────│  Hope Harbor    │
│  (Sports Team)  │sponsors │   (Nonprofit)   │
└────────┬────────┘         └─────────────────┘
         │ sponsors
         ▼
┌─────────────────┐
│Spectrum Creative│
│(Creative Agency)│
└─────────────────┘
```

### Test Steps:
```
1. Nova Labs (sarah@novalabs.io) sponsors Lightning FC (coach@lightningfc.team)
2. Lightning FC sponsors Spectrum Creative (maya@spectrumcreative.studio)
3. Hope Harbor (director@hopeharbor.org) sponsors Lightning FC
4. Verify each manager can see their outgoing/incoming sponsorships
5. Verify read-only access works correctly
6. Revoke one sponsorship and verify access removed
```

---

## Scenario 10: Sponsorship Edge Cases

### Test Invitation Expiry
```
1. Send invitation but don't accept
2. Wait 7 days (or manually set expiresAt in Firestore)
3. Try to accept invitation
4. Verify "Invitation Expired" error
```

### Test Duplicate Prevention
```
1. Send invitation to maya@spectrumcreative.studio
2. Try to send another invitation to same email
3. Verify error: "Pending invitation already exists"
```

### Test Self-Sponsorship Prevention
```
1. Login as sarah@novalabs.io
2. Try to sponsor your own brand (nova-labs)
3. Verify this is prevented
```

### Test Non-Manager Access
```
1. Login as james@novalabs.io (Contributor, not Manager)
2. Navigate to /brands/nova-labs/sponsors
3. Verify access denied or limited functionality
```

---

## Sponsorship API Testing

### Get Sponsorships for Brand
```bash
# This uses Server Actions, not direct API
# Test via UI or Firestore console
```

### Verify Sponsorship Access
```typescript
// In browser console while logged in
const result = await verifySponsorshipAccessAction('nova-labs', 'spectrum-creative');
console.log(result); // { sponsorship: {...}, error: null }
```

### Check Firestore Collections

**sponsorships** collection:
```
Document ID: nova-labs_spectrum-creative
{
  sponsorBrandId: "nova-labs",
  sponsoredBrandId: "spectrum-creative",
  sponsorBrandName: "Nova Labs",
  sponsoredBrandName: "Spectrum Creative Studio",
  status: "ACTIVE",
  initiatedBy: "nova-pm-01",
  approvedBy: "spectrum-director-01",
  createdAt: "2025-11-29T...",
  approvedAt: "2025-11-29T...",
  metadata: {
    permissions: {
      canViewBrandProfile: true,
      canViewUploads: true
    }
  }
}
```

**sponsorshipInvitations** collection:
```
Document ID: nova-labs_maya@spectrumcreative.studio
{
  sponsorBrandId: "nova-labs",
  sponsorBrandName: "Nova Labs",
  managerEmail: "maya@spectrumcreative.studio",
  token: "abc123...", // 32-char unique token
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED",
  initiatedBy: "nova-pm-01",
  initiatedByName: "Sarah Kim",
  createdAt: "2025-11-29T...",
  expiresAt: "2025-12-06T...", // 7 days later
  note: "We'd love to sponsor your creative work!"
}
```

---

## Troubleshooting Sponsorships

### Invitation Not Received
```
Issue: Target manager didn't receive email
Solution:
  1. Check spam folder
  2. Verify email address is correct
  3. Check Firebase Extensions for email delivery
  4. Look up invitation token in Firestore and access directly
```

### Cannot Accept Invitation
```
Issue: "You don't have permission" error
Solution:
  1. Verify logged in as the correct email (invitation recipient)
  2. Verify user has MANAGER role on a brand
  3. Check invitation hasn't expired (7-day window)
  4. Check invitation status is still PENDING
```

### Sponsor Can't See Brand
```
Issue: Sponsored brand not visible after accepting
Solution:
  1. Verify sponsorship status is ACTIVE in Firestore
  2. Check permissions object has canViewBrandProfile: true
  3. Refresh the page / clear cache
  4. Verify the correct brand IDs in sponsorship document
```

---

# APPENDIX: Quick Reference Card

## Test Accounts (All use `Welcome1!`)

| Quick Test | Email |
|------------|-------|
| Sports brand | `coach@lightningfc.team` |
| Tech product | `sarah@novalabs.io` |
| Creative agency | `maya@spectrumcreative.studio` |
| Research org | `dr.chen@quantumbio.research` |
| Nonprofit | `director@hopeharbor.org` |

## Brand IDs
- `lightning-fc`
- `nova-labs`
- `spectrum-creative`
- `quantumbio-research`
- `hope-harbor`

## Key URLs
- Seed Admin: `/admin/seed`
- Brand Soul: `/brand-soul`
- Media Library: `/media`
- Settings: `/settings`

---

**Document Version**: 1.0
**Last Updated**: November 2025
