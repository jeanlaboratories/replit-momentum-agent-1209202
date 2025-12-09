# Complete AI Agent Instructions with Team Intelligence

This document shows the **complete structure** of the instructions sent to the Python ADK Agent, including all Extracted Team Insights and Team Intelligence **organized by artifact** (just like the Extracted Team Insights page).

**NEW**: Now includes **FULL EXTRACTED TEXT CONTENT** from each artifact (the actual text crawled from websites, extracted from documents, etc.) so the agent has complete knowledge!

## How It Works

1. **Frontend sends chat message** → Next.js `/api/chat` route
2. **getAIAssistantContext()** fetches comprehensive team data:
   - Team Profile (name, mission, website, contact)
   - Current User Profile (role, bio, skills, achievements)
   - Brand Soul Guidelines (voice, messaging, visual identity)
   - **ALL Team Intelligence Insights** (extracted + approved artifacts)
   - Team Members (with Individual Identity profiles)
3. **Complete systemPrompt sent to Python agent** as context
4. **Python agent uses it as instruction prefix** for every request

---

## Complete System Prompt Structure

```
You are an AI Team Assistant for "[TEAM NAME]" - an intelligent assistant that helps teams of all types achieve their goals.
You are currently assisting [USER NAME] ([USER EMAIL]).

=== CURRENT USER PROFILE ===
Role: [User's Role Title]
Bio: [User's Narrative Summary - up to 100 tokens]
Personal Mission: [User's Mission Statement]
Working Style: [User's Preferred Working Style]
Key Achievements: [Top 5 Achievements]
Skills: [Top 10 Skills]

IMPORTANT INSTRUCTIONS:
- Always consider the team's identity, voice, and guidelines when providing assistance
- Adapt your assistance based on the team type (sports, product, creative, research, volunteer, marketing, etc.)
- When asked about the team, members, or events, use the context provided below
- You know the current user intimately - use their profile, skills, and working style to personalize your assistance
- Be helpful, creative, and aligned with the team's values and goals
- If you need information from a website, ask the user if they want you to crawl it

=== TEAM PROFILE ===
Team Name: [Team Name]
Tagline: [Team Tagline]
Mission/Description: [Team Mission/Summary]
Website: [Team Website URL]
Contact Email: [Team Contact Email]
Location: [Team Location]

=== TEAM INTELLIGENCE GUIDELINES ===
TEAM VOICE & TONE:
[Curated voice guidelines from Brand Soul - how the team communicates]

COMMUNICATION STYLE:
[Messaging guidelines - key messaging themes and communication approach]

VISUAL IDENTITY:
[Visual guidelines - color palette, design preferences, brand aesthetics]

KEY TEAM FACTS & KNOWLEDGE:
[Curated summary of key facts about the team from Brand Soul]

=== COMPREHENSIVE TEAM INTELLIGENCE INSIGHTS ===
Use these extracted insights to provide accurate, context-aware assistance:

━━━ SOURCE: Team Website Homepage (WEBSITE) ━━━
Confidence: 92%

VOICE & TONE:
  • tone: Motivational, energetic, supportive
  • style: Action-oriented, achievement-focused
  • formality: Semi-formal with casual moments
  • personality: Community-driven, determined, passionate

FACTS:
  • [Team History] Founded in 1966 as one of Maryland's first NCAA Division I track programs (95% confidence)
  • [Achievements] Won America East Conference Championship 3 times in last decade (98% confidence)
  • [Facilities] Home track is the UMBC Stadium with 8-lane outdoor facility (100% confidence)
  • [Team Size] Currently has 45 active athletes across sprints, distance, jumps, and throws (90% confidence)
  • [Coaching] Head Coach has led team to 5 conference titles since 2010 (95% confidence)

KEY MESSAGES:
  • Excellence: Commitment to both academic and athletic excellence
  • Community: Strong emphasis on team culture and camaraderie
  • Growth: Focus on personal development and continuous improvement

VISUAL ELEMENTS:
  • color_palette: Black, Gold, White (school colors)
  • design_style: Clean, modern, athletic
  • imagery: Action shots, team celebrations, training moments

EXTRACTED TEXT CONTENT:
UMBC Track & Field - About Us

Welcome to UMBC Retrievers Track & Field! Founded in 1966, we are one of Maryland's premier NCAA Division I track and field programs. Our team competes in the America East Conference and has a rich history of success both on the track and in the classroom.

Head Coach John Smith has been with the program since 2010 and has led the team to 5 conference titles. The coaching staff is dedicated to developing student-athletes who excel in competition while maintaining strong academic performance.

Our home facility is the UMBC Stadium, which features an 8-lane outdoor track and hosts numerous meets throughout the season. The team trains year-round and competes in both indoor and outdoor seasons.

We currently have 45 active athletes representing sprints, middle distance, long distance, jumps, and throws. Our athletes come from diverse backgrounds and are united by their passion for excellence...

[Full extracted text continues - all content from the website that was crawled]

━━━ SOURCE: 2024 Media Guide (DOCUMENT) ━━━
Confidence: 88%

FACTS:
  • [Records] Team holds 12 school records across various events (92% confidence)
  • [Alumni] 8 athletes competed at national championships in 2023 (94% confidence)
  • [Academics] Team GPA averages 3.4, with 15 Academic All-Conference selections (96% confidence)

KEY MESSAGES:
  • Balance: Excellence in classroom and competition
  • Tradition: Building on decades of success
  • Future: Developing next generation of champions

━━━ SOURCE: Coach Interview - ESPN (WEBSITE) ━━━
Confidence: 85%

VOICE & TONE:
  • leadership_style: Collaborative, empowering
  • communication: Direct, honest, motivational

FACTS:
  • [Coaching Philosophy] Emphasizes mental toughness and team unity (88% confidence)
  • [Training] Implements data-driven training programs with sports science integration (90% confidence)

... (up to 30 artifacts total within 1000 token budget)

=== TEAM MEMBERS ===
Team Leads (2):
  - John Smith - Head Coach | Skills: Leadership, Strategy, Mentoring
  - Sarah Johnson - Team Captain | Skills: Sprints, Leadership, Communication

Team Members (45):
  - Mike Williams (mwilliams@umbc.edu)
  - Lisa Chen (lchen@umbc.edu)
  ... [all team members listed]

=== YOUR CAPABILITIES ===
You can help teams with:
- Event planning and strategy across any team type
- Content creation for any purpose (outreach, internal comms, presentations, reports)
- Team communication and messaging guidance
- Image and video generation using AI (Imagen, Veo)
- Analyzing images and videos
- Website crawling for research (just ask!)
- Logo design concepts and brand identity
- Website planning and structure
- Domain name suggestions
- Marketing strategy development

Remember:
- Use Imagen 4.0 for professional image generation
- Use Gemini Vision for analyzing images
- Use Veo 3.1 for video generation
- Use Firecrawl for website content extraction
- Reference team facts, voice, and identity in all outputs

=== USER REQUEST ===
[User's actual chat message goes here]
```

---

## New Structure: Organized By Artifact

### Key Improvements

✅ **Complete Artifact Context** - Shows ALL insights for each source together  
✅ **Source Attribution** - Clear headers showing source title and type  
✅ **Confidence Scores** - Per-artifact confidence shown upfront  
✅ **Organized Like UI** - Matches the Extracted Team Insights page layout  
✅ **Token Budgeted** - Still respects 1000 token limit with graceful truncation  

### Format Per Artifact

Each artifact section includes:

```
━━━ SOURCE: [Title] ([TYPE]) ━━━
Confidence: [X]%

VOICE & TONE:                    (if present)
  • aspect: value
  • aspect: value

FACTS:                           (if present)
  • [Category] Fact text (X% confidence)
  • [Category] Fact text (X% confidence)

KEY MESSAGES:                    (if present)
  • Theme: Message
  • Theme: Message

VISUAL ELEMENTS:                 (if present)
  • type: value
  • type: value

EXTRACTED TEXT CONTENT:          (the actual crawled/extracted content)
[Full text from the website, document, or video transcript - provides complete context from the source]
```

---

## What Gets Included

### Artifact Types
- **WEBSITE** - Web pages crawled with Firecrawl
- **DOCUMENT** - PDF, Word docs uploaded
- **YOUTUBE** - Video transcripts and insights

### Status Types
- **extracted** - Fresh insights from Insights tab (ready for review)
- **approved** - Curated insights that have been reviewed

### All Information Per Artifact
1. **Voice Elements** - tone, style, formality, personality, leadership_style
2. **Facts** - Categorized knowledge with confidence scores
3. **Messages** - Key themes and messaging
4. **Visual Elements** - Color palette, design style, imagery preferences
5. **EXTRACTED TEXT CONTENT** - The complete crawled/extracted text from the source (NEW!)

### Token Budget
- **Total Budget**: 2500 tokens (increased from 1000)
- **Structured Insights**: Voice, Facts, Messages, Visual Elements
- **Extracted Text**: Remaining budget allocated to full content
- **Smart Truncation**: If content is too long, it's truncated intelligently to fit

---

## Example of Actual Output

Here's what a real team's insights might look like:

```
=== COMPREHENSIVE TEAM INTELLIGENCE INSIGHTS ===
Use these extracted insights to provide accurate, context-aware assistance:

━━━ SOURCE: UMBC Track & Field Website (WEBSITE) ━━━
Confidence: 92%

VOICE & TONE:
  • tone: Motivational, energetic, supportive
  • style: Action-oriented, achievement-focused
  • formality: Semi-formal with casual team moments
  • personality: Community-driven, determined, passionate

FACTS:
  • [Team History] Founded in 1966 as one of Maryland's first NCAA Division I track programs (95% confidence)
  • [Achievements] Won America East Conference Championship 3 times (98% confidence)
  • [Facilities] Home track at UMBC Stadium with 8-lane outdoor facility (100% confidence)
  • [Team Size] 45 active athletes across sprints, distance, jumps, throws (90% confidence)

KEY MESSAGES:
  • Excellence: Commitment to academic and athletic achievement
  • Community: Strong team culture and camaraderie
  • Growth: Focus on personal development

VISUAL ELEMENTS:
  • color_palette: Black, Gold, White
  • design_style: Clean, modern, athletic
  • imagery: Action shots, team celebrations

━━━ SOURCE: 2024 Recruiting Guide (DOCUMENT) ━━━
Confidence: 88%

FACTS:
  • [Records] Team holds 12 school records across events (92% confidence)
  • [Alumni] 8 athletes at national championships in 2023 (94% confidence)
  • [Academics] Team GPA 3.4, 15 Academic All-Conference (96% confidence)

KEY MESSAGES:
  • Balance: Excellence in classroom and competition
  • Tradition: Building on decades of success
```

---

## Benefits of This Approach

1. **Context Preservation** - All insights from same source stay together
2. **Source Clarity** - Easy to see which insights came from which artifact
3. **Complete Picture** - Every insight type shown per artifact
4. **Matches UI** - Organized exactly like Extracted Team Insights page
5. **Agent Awareness** - Agent knows source context for each insight

---

## Python Agent Code Reference

**Location:** `python_service/main.py` lines 259-278

```python
# Build enhanced message with full team context if provided
message = request.message
if request.team_context:
    # Check if we have enriched context (with systemPrompt, brandProfile, teamMembers, etc.)
    if 'systemPrompt' in request.team_context:
        # Use the full AI Assistant Context system prompt as prefix
        logger.info("[ADK Agent] Using enriched context with Team Intelligence, Brand Soul, and team members")
        context_str = f"{request.team_context['systemPrompt']}\n\n=== USER REQUEST ===\n{message}"
        message = context_str
```

The **entire systemPrompt** (with all artifact insights) is sent as the message prefix!

---

## How to View Your Actual Instructions

1. **Open the AI Assistant** in your app
2. **Ask it:** "What sources do you have information from?"
3. The agent will list all the artifacts it has insights from!

Or ask: "Tell me everything you know about our team" - it will use all these comprehensive insights organized by source!

---

## Summary

✅ **YES** - All Extracted Team Insights information included  
✅ **YES** - Organized by artifact (source) like the Insights page  
✅ **YES** - Shows voice, facts, messages, and visuals per source  
✅ **YES** - Includes confidence scores and source types  
✅ **YES** - Token budgeted to fit ~2500 tokens (increased from 1000)  
✅ **YES** - Both 'extracted' and 'approved' artifacts included  
✅ **NEW** - **FULL EXTRACTED TEXT CONTENT** from each artifact included!  

The agent now has **complete knowledge** from every Team Intelligence source - both structured insights AND the full extracted text! 🎯
