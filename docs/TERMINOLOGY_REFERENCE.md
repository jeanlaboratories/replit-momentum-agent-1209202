# MOMENTUM Terminology Reference Guide

Quick reference for Brand → Team terminology changes during rebrand implementation.

## GUI Text Updates

### Navigation & Headers

| Old | New |
|-----|-----|
| "Brand Profile" | "Team Profile" |
| "Brand Soul" | "Team Intelligence" |
| "Campaign Calendar" | "Initiative Calendar" |
| "Your Brand" | "Your Team" |
| "Brand Context" | "Team Context" |
| "Brand Assets" | "Team Assets" |

### Buttons & Actions

| Old | New |
|-----|-----|
| "Create Brand" | "Create Team" |
| "Edit Brand Profile" | "Edit Team Profile" |
| "Upload Brand Asset" | "Upload Team Asset" |
| "Delete Brand Asset" | "Delete Team Asset" |
| "Generate Brand Copy" | "Generate Team Content" |
| "Add Brand Sources" | "Add Team Knowledge" |
| "Crawl Brand Website" | "Crawl Team Website" |
| "Brand Soul Analytics" | "Intelligence Analytics" |
| "View Brand Assets" | "View Team Assets" |

### Form Labels & Fields

| Old | New |
|-----|-----|
| "Brand Name" | "Team Name" |
| "Brand Tagline" | "Team Tagline" |
| "Brand Summary" | "Team Mission" |
| "Brand Website" | "Team Website" |
| "Brand Logo" | "Team Logo" |
| "Brand Banner" | "Team Banner" |
| "Brand Documents" | "Team Knowledge Sources" |
| "Brand Vision" | "Team Mission" |
| "Brand Voice" | "Team Voice" |

### Messages & Descriptions

| Old | New |
|-----|-----|
| "No brand selected" | "No team selected" |
| "Loading brand profile..." | "Loading team profile..." |
| "Brand created successfully" | "Team created successfully" |
| "Brand updated successfully" | "Team updated successfully" |
| "Upload brand assets to get started" | "Upload team assets to get started" |
| "Your brand's unique voice" | "Your team's unique voice" |
| "Brand Soul helps AI understand your brand" | "Team Intelligence helps AI understand your team" |

### Roles & Permissions

| Old | New |
|-----|-----|
| "Brand Manager" | "Team Lead" |
| "Brand Member" | "Team Member" |
| "Invite to Brand" | "Invite to Team" |
| "Brand Access" | "Team Access" |
| "Manage Brand Team" | "Manage Team Members" |

## Database Collections

**Note**: Keep existing collection names to avoid migration complexity. Create type aliases in code instead.

| Collection Name | Display Name | Notes |
|-----------------|--------------|-------|
| `brands` | Teams | Keep DB name, use "Team" in UI |
| `brandMembers` | Team Members | Keep DB name, use "Team Member" in UI |
| `brandArtifacts` | Team Intelligence Artifacts | Keep DB name |
| `brandSoul` | Team Intelligence | Keep DB name |
| `campaigns` | Initiatives | Consider migration if feasible |

## TypeScript Type Aliases

Create these in a new file `src/lib/types/momentum-aliases.ts`:

```typescript
// Type aliases for rebrand - allows gradual migration
export type Team = BrandProfile;
export type TeamMember = BrandMember;
export type TeamRole = BrandRole;
export type TeamIntelligence = BrandSoul;
export type TeamArtifact = BrandArtifact;
export type Initiative = CampaignTimeline;
export type TeamAsset = BrandAsset;
```

## Component Naming

### Priority: User-Facing Text First
DO NOT rename components yet—focus on visible text strings only.

**Phase 1**: Update all user-visible text  
**Phase 2**: Gradually rename components as needed  
**Phase 3**: Refactor internal code structure

## String Constants File

Create `src/lib/constants/terminology.ts`:

```typescript
export const TERMINOLOGY = {
  // Entity names
  TEAM: 'Team',
  TEAM_PROFILE: 'Team Profile',
  TEAM_INTELLIGENCE: 'Team Intelligence',
  TEAM_MEMBER: 'Team Member',
  TEAM_LEAD: 'Team Lead',
  INITIATIVE: 'Initiative',
  
  // Actions
  CREATE_TEAM: 'Create Team',
  EDIT_TEAM: 'Edit Team Profile',
  DELETE_TEAM: 'Delete Team',
  INVITE_MEMBER: 'Invite Team Member',
  
  // Descriptions
  TEAM_INTELLIGENCE_DESC: 'Your team\'s living playbook—AI learns from your knowledge sources to guide all content generation',
  INITIATIVE_PLANNER_DESC: 'Plan and execute multi-day team initiatives with AI-powered content creation',
  
  // Placeholders
  TEAM_NAME_PLACEHOLDER: 'e.g., Riverside High Tigers, Product Marketing Team, Creative Studio',
  TEAM_MISSION_PLACEHOLDER: 'What is your team\'s mission or purpose?',
} as const;
```

## Search & Replace Patterns

**CAUTION**: Use carefully with exact match only. Many internal variable names should NOT be changed.

### Safe to Replace (User-Facing Only)

```bash
# Page titles
"Brand Profile" → "Team Profile"
"Brand Soul" → "Team Intelligence"

# Button text
"Create Brand" → "Create Team"
"Upload Brand Asset" → "Upload Team Asset"

# Form labels
"Brand Name" → "Team Name"
"Brand Tagline" → "Team Tagline"

# Headers
"Your Brand" → "Your Team"
```

### DO NOT Replace (Internal Code)

```bash
# Database references
brandId ← Keep as-is
brandProfile ← Keep as-is
brandMembers ← Keep as-is

# API endpoints
/api/brand-profile ← Keep as-is
/api/brand-soul ← Keep as-is

# Collection names in Firestore
'brands' ← Keep as-is
'brandMembers' ← Keep as-is
```

## Priority Files to Update

### High Priority (Week 1)
1. `src/components/layout/header.tsx` - Navigation menu
2. `src/app/page.tsx` - Main campaign page
3. `src/app/brand-profile/page.tsx` - Profile page
4. `src/app/brand-soul/page.tsx` - Intelligence page
5. `src/components/campaign-timeline-editor.tsx` - Initiative planner

### Medium Priority (Week 2)
6. All button labels and form fields
7. Toast messages and notifications
8. Help text and tooltips
9. Error messages
10. Modal dialog content

### Low Priority (Week 3+)
11. Documentation and README
12. Code comments
13. Internal variable names (optional)

## Testing Checklist

- [ ] No "Brand" visible in main navigation
- [ ] No "Brand" in page titles
- [ ] No "Brand" in buttons or links
- [ ] No "Brand" in form labels
- [ ] No "Brand" in toast messages
- [ ] No "Brand" in modal dialogs
- [ ] No "Brand" in tooltips
- [ ] No "Brand" in placeholder text
- [ ] Screenshots updated
- [ ] Help documentation updated

## Edge Cases to Watch

1. **Error Messages**: Update error text that mentions "brand"
2. **Email Templates**: Update any email content (verification, invitations)
3. **Dynamic Text**: Check text generated by AI or templates
4. **Console Logs**: Keep technical logs as-is (not user-facing)
5. **API Responses**: Update user-facing messages, keep technical fields

---

**Last Updated**: October 22, 2025  
**Purpose**: Implementation reference for MOMENTUM rebrand
