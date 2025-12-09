# Momentum Marketing Agent - Tool Reference

This document provides comprehensive documentation for all tools available to the Momentum Marketing Agent.

## Table of Contents

1. [Text & Content Generation](#1-text--content-generation)
2. [Image Generation & Editing](#2-image-generation--editing)
3. [Video Generation](#3-video-generation)
4. [Media Search](#4-media-search)
5. [Document Search (RAG)](#5-document-search-rag)
6. [Web Search & Crawling](#6-web-search--crawling)
7. [Team Tools](#7-team-tools)
8. [Memory System](#8-memory-system)
9. [Video Analysis](#9-video-analysis)

---

## 1. Text & Content Generation

### `generate_text`

Generates text using Gemini for conversations, brainstorming, and content creation.

**File**: `momentum_agent.py`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | str | Yes | The text prompt or question |
| `context` | str | No | Additional conversation context |

**Example**:
```python
generate_text(
    prompt="Write a tagline for a coffee shop",
    context="The shop is called 'Morning Brew' and focuses on organic coffee"
)
```

**Output**:
```python
{
    "status": "success",
    "text": "Wake up to nature's finest brew.",
    "model": "gemini-2.5-flash"
}
```

---

## 2. Image Generation & Editing

### `generate_image`

Generates images using Imagen 4.0 from text prompts.

**File**: `tools/media_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | str | Yes | - | Description of the image to generate |
| `brand_id` | str | No | "" | Brand ID for team-specific styling |
| `aspect_ratio` | str | No | "1:1" | Options: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9" |
| `number_of_images` | int | No | 1 | Number of images (1-8) |
| `person_generation` | str | No | "" | "allow_all" or "allow_adult" |
| `safety_filter_level` | str | No | "" | "block_only_high", "block_medium_and_above", "block_low_and_above" |
| `output_mime_type` | str | No | "" | "image/png" or "image/jpeg" |

**Example**:
```python
generate_image(
    prompt="A golden retriever playing in a sunny park",
    aspect_ratio="16:9",
    number_of_images=3
)
```

**Output**:
```python
{
    "status": "success",
    "message": "Successfully generated 3 images",
    "format": "url",
    "prompt": "A golden retriever playing in a sunny park",
    "image_url": "https://storage.googleapis.com/...",
    "image_urls": ["https://...", "https://...", "https://..."]
}
```

---

### `nano_banana`

Edits and composes images using Imagen 3 (Nano Banana) with text prompts and reference images.

**File**: `tools/media_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | str | Yes | - | Detailed description of the edit/composition |
| `image_url` | str | No | "" | **Full URL** of image to edit (from Attached Media) |
| `reference_images` | str | No | "" | Comma-separated URLs for up to 14 reference images |
| `mask_url` | str | No | "" | Mask image URL for selective editing |
| `mode` | str | No | "" | "edit" for editing, "compose" for multi-image composition |
| `aspect_ratio` | str | No | "1:1" | Output aspect ratio |
| `number_of_images` | int | No | 1 | Number of output images (1-4) |
| `person_generation` | str | No | "" | "allow_all" or "allow_adult" |

**Example**:
```python
# Edit an existing image
nano_banana(
    prompt="Make the car red instead of blue",
    image_url="https://storage.googleapis.com/bucket/car.png",
    number_of_images=2
)

# Compose with reference images
nano_banana(
    prompt="Create a scene with these characters in a forest",
    reference_images="https://example.com/char1.png,https://example.com/char2.png",
    mode="compose",
    aspect_ratio="16:9"
)
```

**Output**:
```python
{
    "status": "success",
    "message": "Successfully edited image",
    "format": "url",
    "image_url": "https://storage.googleapis.com/...",
    "image_urls": ["https://...", "https://..."],
    "skipped_references": null
}
```

**Important Notes**:
- Always use the complete URL (starting with `https://`) from the "Attached Media" section
- Do NOT use just the filename - use the full URL

---

## 3. Video Generation

### `generate_video`

Generates videos using Veo 3.1 from text prompts and optional image inputs.

**File**: `tools/media_tools.py`

**Supported Modes**:
- **Text-to-Video**: Generate from text prompt only
- **Image-to-Video**: Animate a static image
- **Frames-to-Video**: Interpolate between start and end frames
- **Video Extension**: Extend an existing Veo-generated video
- **Character Reference**: Generate with consistent character/object

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | str | Yes | - | Video description (up to 1024 tokens) |
| `image_url` | str | No | "" | Image to animate (Image-to-Video) |
| `character_reference` | str | No | "" | Character reference image (Ingredients mode) |
| `start_frame` | str | No | "" | Starting frame (Frames-to-Video) |
| `end_frame` | str | No | "" | Ending frame (Frames-to-Video) |
| `aspect_ratio` | str | No | "9:16" | "16:9" (Landscape) or "9:16" (Portrait) |
| `resolution` | str | No | "720p" | "720p" or "1080p" (1080p only for 8s) |
| `duration_seconds` | int | No | 0 | 4, 6, or 8 seconds |
| `person_generation` | str | No | "" | "allow_all" to include people |
| `video_url` | str | No | "" | DEPRECATED - use `veo_video_uri` |
| `veo_video_uri` | str | No | "" | Veo URI for video extension (valid 2 days) |
| `reference_images` | str | No | "" | Comma-separated URLs (up to 3) |
| `use_fast_model` | bool | No | False | Use faster generation model |

**Example**:
```python
# Text-to-Video
generate_video(
    prompt="An eagle soaring over mountain peaks at sunset",
    aspect_ratio="16:9",
    duration_seconds=6
)

# Image-to-Video
generate_video(
    prompt="The character walks forward and waves",
    image_url="https://storage.googleapis.com/bucket/character.png",
    duration_seconds=4
)

# Video Extension
generate_video(
    prompt="Continue the scene with the eagle landing on a branch",
    veo_video_uri="files/abc123def456",  # From previous generation
    duration_seconds=4
)
```

**Output**:
```python
{
    "status": "success",
    "message": "Video generated successfully",
    "format": "url",
    "prompt": "An eagle soaring over mountain peaks",
    "video_url": "https://storage.googleapis.com/...",
    "video_urls": ["https://..."],
    "veo_video_uri": "files/abc123def456"  # Save this for extension!
}
```

**Important Notes**:
- Store the `veo_video_uri` from the response - it's valid for 2 days and required for video extension
- 1080p resolution only available with 8-second duration

---

## 4. Media Search

### `search_media_library`

Searches the media library using Vertex AI semantic search.

**File**: `tools/media_search_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | str | Yes | - | Natural language search query |
| `brand_id` | str | No | "" | Brand ID for scoped search |
| `media_type` | str | No | "" | "image", "video", or "" for all |
| `source` | str | No | "" | "upload", "ai-generated", "brand-soul", "edited" |
| `collections` | str | No | "" | Comma-separated collection IDs |
| `tags` | str | No | "" | Comma-separated tags |
| `limit` | int | No | 10 | Maximum results (1-50) |

**Example**:
```python
search_media_library(
    query="product photos with blue background",
    media_type="image",
    source="upload",
    limit=20
)
```

**Output**:
```python
{
    "status": "success",
    "results": [
        {
            "id": "media123",
            "title": "Product Shot Blue",
            "description": "Product on blue background",
            "type": "image",
            "source": "upload",
            "url": "https://storage.googleapis.com/...",
            "thumbnail_url": "https://...",
            "tags": ["product", "blue"],
            "relevance_score": 0.92
        }
    ],
    "total_count": 15,
    "search_time_ms": 120,
    "query": "product photos with blue background"
}
```

---

### `search_images`

Convenience wrapper for image-only search.

**Parameters**: Same as `search_media_library` (without `media_type`)

**Example**:
```python
search_images(query="team photos", limit=10)
```

---

### `search_videos`

Convenience wrapper for video-only search.

**Parameters**: Same as `search_media_library` (without `media_type`)

**Example**:
```python
search_videos(query="product launch", limit=5)
```

---

### `search_team_media`

Team media search with granular source filtering options.

**File**: `tools/team_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | str | Yes | - | Natural language search query |
| `brand_id` | str | No | "" | Brand/Team ID |
| `media_type` | str | No | "" | "image", "video", or "" for all |
| `include_ai_generated` | bool | No | True | Include AI-generated content |
| `include_uploads` | bool | No | True | Include uploaded content |
| `include_brand_soul` | bool | No | True | Include brand soul assets |
| `limit` | int | No | 20 | Maximum results (1-50) |

**Example**:
```python
search_team_media(
    query="marketing materials",
    media_type="image",
    include_ai_generated=False,
    include_uploads=True,
    limit=15
)
```

---

### `find_similar_media`

Finds media similar to a given media item using semantic similarity.

**File**: `tools/team_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `media_id` | str | Yes | - | ID of the reference media item |
| `brand_id` | str | No | "" | Brand/Team ID |
| `limit` | int | No | 10 | Maximum results (1-20) |

**Example**:
```python
find_similar_media(media_id="img_abc123", limit=10)
```

**Output**:
```python
{
    "status": "success",
    "results": [
        {
            "id": "img_def456",
            "title": "Similar Product Shot",
            "similarity_score": 0.89,
            "url": "https://..."
        }
    ],
    "reference_id": "img_abc123"
}
```

---

## 5. Document Search (RAG)

### `query_brand_documents`

Queries indexed brand documents using Vertex AI RAG Engine.

**File**: `tools/rag_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | str | Yes | - | Question or search query |
| `brand_id` | str | No | "" | Brand ID for document retrieval |

**Example**:
```python
query_brand_documents(
    query="What are our brand colors according to the style guide?",
    brand_id="brand123"
)
```

**Output**:
```python
{
    "status": "success",
    "content": "According to your brand style guide, the primary colors are...",
    "answer": "According to your brand style guide...",
    "contexts": [
        {
            "file": "brand-style-guide.pdf",
            "text": "Primary colors: #1a73e8 (Blue), #34a853 (Green)..."
        }
    ],
    "sources_count": 2
}
```

---

### `index_brand_document`

Indexes a document from Google Cloud Storage into the brand's RAG corpus.

**File**: `tools/rag_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `gcs_uri` | str | Yes | - | GCS URI format: `gs://bucket/path/file` |
| `brand_id` | str | No | "" | Brand ID for indexing |

**Example**:
```python
index_brand_document(
    gcs_uri="gs://my-bucket/docs/brand-guide.pdf",
    brand_id="brand123"
)
```

**Output**:
```python
{
    "status": "success",
    "corpus_name": "projects/.../ragCorpora/brand123",
    "files_indexed": 1,
    "message": "Document indexed successfully"
}
```

---

## 6. Web Search & Crawling

### `search_web`

Searches the web using multiple providers (Google Custom Search > SerpAPI > DuckDuckGo).

**File**: `momentum_agent.py`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | str | Yes | The search query |

**Example**:
```python
search_web(query="latest AI marketing trends 2024")
```

**Output**:
```python
{
    "status": "success",
    "results": [
        {
            "title": "Top AI Marketing Trends for 2024",
            "href": "https://example.com/ai-marketing-trends",
            "body": "Discover the latest AI marketing trends..."
        }
    ],
    "query": "latest AI marketing trends 2024",
    "source": "google_custom_search"
}
```

---

### `crawl_website`

Crawls and extracts content from any website URL using Firecrawl.

**File**: `momentum_agent.py`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | str | Yes | Website URL (must start with http:// or https://) |

**Example**:
```python
crawl_website(url="https://example.com/about")
```

**Output**:
```python
{
    "status": "success",
    "url": "https://example.com/about",
    "title": "About Us - Example Company",
    "content": "# About Us\n\nWe are a leading...",  # Markdown format
    "description": "Learn about Example Company's mission and values"
}
```

---

## 7. Team Tools

### `suggest_domain_names`

Suggests creative domain names for teams based on keywords.

**File**: `tools/team_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `keywords` | str | Yes | - | Comma-separated keywords |
| `team_type` | str | No | "" | sports, product, creative, research, volunteer, marketing |

**Example**:
```python
suggest_domain_names(
    keywords="tech, innovation, startup",
    team_type="product"
)
```

**Output**:
```python
{
    "status": "success",
    "content": "Here are domain name suggestions:\n1. techinnovate.io\n2. startupforge.com...",
    "domains": []
}
```

---

### `create_team_strategy`

Creates a comprehensive strategic plan for any team type.

**File**: `tools/team_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `team_name` | str | Yes | - | Name of the team |
| `team_type` | str | Yes | - | Type of team |
| `goals` | str | No | "" | Team goals and objectives |

**Example**:
```python
create_team_strategy(
    team_name="Project Phoenix",
    team_type="product",
    goals="Launch MVP in Q2, achieve 10k users by Q3"
)
```

**Output**:
```python
{
    "status": "success",
    "content": "# Strategic Plan for Project Phoenix\n\n## Vision\n...",
    "strategy": {}
}
```

---

### `plan_website`

Plans a professional website structure with pages, features, and content strategy.

**File**: `tools/team_tools.py`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | str | Yes | Domain name for the website |
| `team_name` | str | Yes | Name of the team |
| `team_type` | str | Yes | Type of team |

**Example**:
```python
plan_website(
    domain="projectphoenix.io",
    team_name="Project Phoenix",
    team_type="product"
)
```

**Output**:
```python
{
    "status": "success",
    "content": "# Website Plan for projectphoenix.io\n\n## Pages\n1. Home\n2. Features...",
    "plan": {}
}
```

---

### `create_event`

Creates a preview for a team event or campaign with AI-generated content.

**File**: `tools/team_tools.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `description` | str | Yes | - | Natural language event description |
| `brand_id` | str | No | "" | Brand/Team ID |
| `character_sheet_urls` | str | No | "" | Comma-separated URLs for character consistency |
| `enable_character_consistency` | bool | No | False | Enable consistent characters across images |

**Example**:
```python
# Basic event
create_event(
    description="3-day product launch campaign starting Monday",
    brand_id="brand123"
)

# With character consistency
create_event(
    description="Campaign featuring our mascot Buddy the Bear",
    brand_id="brand123",
    character_sheet_urls="https://storage.googleapis.com/bucket/buddy.png",
    enable_character_consistency=True
)
```

**Output**:
```python
{
    "status": "success",
    "message": "Event preview created",
    "preview_data": {
        "action": "generate-campaign",
        "prompt": "3-day product launch campaign",
        "campaignName": "Product Launch",
        "totalPosts": 9,
        "brandId": "brand123",
        "characterConsistency": {
            "enabled": True,
            "characters": [
                {
                    "id": "char_1",
                    "name": "Buddy the Bear",
                    "characterSheetUrl": "https://...",
                    "isActive": True
                }
            ]
        }
    }
}
```

---

## 8. Memory System

### `recall_memory` (async)

Recalls information from long-term memory banks (personal and team).

**File**: `momentum_agent.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | str | Yes | - | Search query for memories |
| `user_id` | str | No | "" | User ID (uses context if not provided) |
| `scope` | str | No | "all" | "all", "personal", or "team" |

**Example**:
```python
# Search all memories
await recall_memory(query="favorite color", scope="all")

# Search only personal memories
await recall_memory(query="birthday", scope="personal")

# Search only team memories
await recall_memory(query="brand guidelines", scope="team")
```

**Output**:
```python
{
    "status": "success",
    "memories": [
        "[Personal] User's favorite color is blue",
        "[Team] Brand primary color is #1a73e8"
    ],
    "personal_count": 1,
    "team_count": 1
}
```

---

### `save_memory` (async)

Saves important information to long-term memory.

**File**: `momentum_agent.py`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_text` | str | Yes | - | Information to remember |
| `user_id` | str | No | "" | User ID (uses context if not provided) |
| `scope` | str | No | "personal" | "personal" or "team" |

**When to use PERSONAL scope**:
- Favorite things (color, food, music, sports teams)
- Personal preferences and opinions
- Name, location, job, personal details
- Important dates (birthday, anniversary)
- Hobbies, interests, activities
- Goals, dreams, aspirations
- Family members, pets, relationships

**When to use TEAM scope**:
- Brand guidelines and preferences
- Team-wide knowledge
- Company policies or procedures
- Shared resources or contacts
- Team preferences (tone, style)

**Example**:
```python
# Save personal memory
await save_memory(
    memory_text="User's favorite color is blue",
    scope="personal"
)

# Save team memory
await save_memory(
    memory_text="Brand voice should be friendly and professional",
    scope="team"
)
```

**Output**:
```python
{
    "status": "success",
    "message": "Personal memory saved successfully.",
    "scope": "personal"
}
```

---

## 9. Video Analysis

### `process_youtube_video`

Analyzes a YouTube video using Gemini with vision capabilities.

**File**: `momentum_agent.py`

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | str | Yes | YouTube video URL |
| `prompt` | str | Yes | Analysis prompt/question |

**Example**:
```python
process_youtube_video(
    url="https://youtube.com/watch?v=dQw4w9WgXcQ",
    prompt="What is the main topic and key takeaways from this video?"
)
```

**Output**:
```python
{
    "analysis": "This video discusses...",
    "model": "gemini-2.5-flash"
}
```

---

## Quick Reference

| Tool | Category | Key Use Case |
|------|----------|--------------|
| `generate_text` | Content | Text generation, brainstorming |
| `generate_image` | Image | Create images from prompts |
| `nano_banana` | Image | Edit/compose images |
| `generate_video` | Video | Create videos from text/images |
| `search_media_library` | Search | Find media by description |
| `search_images` | Search | Find images specifically |
| `search_videos` | Search | Find videos specifically |
| `search_team_media` | Search | Team media with source filters |
| `find_similar_media` | Search | Find similar content |
| `query_brand_documents` | RAG | Answer questions from docs |
| `index_brand_document` | RAG | Add documents to corpus |
| `search_web` | Web | Search the internet |
| `crawl_website` | Web | Extract website content |
| `suggest_domain_names` | Team | Generate domain ideas |
| `create_team_strategy` | Team | Create strategic plans |
| `plan_website` | Team | Plan website structure |
| `create_event` | Team | Create campaign previews |
| `recall_memory` | Memory | Retrieve saved information |
| `save_memory` | Memory | Store important facts |
| `process_youtube_video` | Analysis | Analyze YouTube videos |

---

## Error Handling

All tools return consistent error responses:

```python
{
    "status": "error",
    "error": "Description of what went wrong"
}
```

Common error scenarios:
- Missing required parameters
- Invalid parameter values
- API rate limits exceeded
- Network/service unavailability
- Authentication failures

---

## Best Practices

1. **Image URLs**: Always use complete URLs (starting with `https://`) from the "Attached Media" section when using `nano_banana` or other media tools.

2. **Video Extension**: Store the `veo_video_uri` returned from `generate_video` - it's valid for 2 days and required for extending videos.

3. **Memory Scopes**: Use "personal" for user-specific preferences and "team" for shared brand/organization knowledge.

4. **Character Consistency**: When creating campaigns with consistent characters, set `enable_character_consistency=True` and provide character sheet URLs.

5. **Async Functions**: `recall_memory` and `save_memory` are async functions that must be awaited.
