# Multimodal Brand Soul - Visual Asset Extraction

## Overview

Brand Soul is now **multimodal**, extracting and displaying both textual insights AND visual assets from your brand materials. When you crawl a website, we automatically extract up to 10 images to give you a comprehensive visual understanding of your brand's online presence.

---

## ✨ What's New

### Website Image Extraction

When you add a website to Brand Soul, Firecrawl now extracts:
- ✅ **Text content** (markdown/HTML) for AI analysis
- ✅ **Up to 10 images** from the website
- ✅ **Image URLs** stored in artifact metadata
- ✅ **Visual gallery** in Brand Soul tab

### Multimodal Display

The Brand Soul tab now shows:
1. **Brand Visual Assets** section (NEW)
   - Grid layout of all extracted images
   - Organized by source (website, document, etc.)
   - Click any image for full-size lightbox view
   - Links to original source URLs

2. **Textual Insights** (existing)
   - Voice profile
   - Key facts
   - Core messages
   - Visual identity (colors, design principles)

---

## 🚀 How to Use

### Step 1: Add a Website to Brand Soul

1. Navigate to **Brand Soul** page
2. Go to **"Upload Sources"** tab
3. Click **"Add Website URL"**
4. Enter a website URL (e.g., `https://example.com`)
5. Optional: Enable "Crawl subpages" to extract from multiple pages
6. Click **"Crawl Website"**

### Step 2: Wait for Processing

The system will:
1. Crawl the website with Firecrawl
2. Extract markdown/HTML content
3. Extract up to 10 images from each page
4. Create artifact with metadata
5. Queue AI extraction job
6. Status changes: `pending` → `processing` → `extracted`

### Step 3: View Extracted Images

1. Go to **"Brand Soul"** tab
2. At the top, you'll see **"Brand Visual Assets"** section
3. Images are displayed in a responsive grid
4. Each source shows:
   - Source type badge (website, document)
   - Source title
   - Link to original URL
   - Grid of extracted images (up to 10 per source)

### Step 4: Preview Images

- Click any image to open full-size lightbox
- Click "Close" or click outside to dismiss
- Images load lazily for performance

---

## 🔧 Technical Details

### Image Extraction Process

**Firecrawl API Integration:**
```typescript
// Scrape with image extraction
const scrapeResult = await firecrawl.scrape(url, {
  formats: ['markdown', 'html', 'images'],  // Extract images!
});

// Extract up to 10 images
const extractedImages = (doc.images && Array.isArray(doc.images))
  ? doc.images
      .filter(img => img && typeof img === 'string' && img.startsWith('http'))
      .slice(0, 10)  // Limit to 10
  : [];
```

**For Multi-Page Crawls:**
```typescript
const crawlJob = await firecrawl.crawl(url, {
  limit: maxPages || 10,
  scrapeOptions: {
    formats: ['markdown', 'html', 'images'],
  },
});

// Aggregate images from all pages
const allImages: string[] = [];
pages.forEach((page: any) => {
  if (page.images && Array.isArray(page.images)) {
    allImages.push(...page.images);
  }
});

// Deduplicate and limit
const uniqueImages = [...new Set(allImages)]
  .filter(img => img && typeof img === 'string' && img.startsWith('http'))
  .slice(0, 10);
```

### Data Storage

**Artifact Metadata:**
```typescript
{
  id: "artifact_...",
  brandId: "brand123",
  type: "website",
  metadata: {
    title: "Example Company",
    url: "https://example.com",
    pagesCount: 3,
    imageCount: 8,           // NEW
    extractedImages: [       // NEW
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
      // ... up to 10 images
    ]
  }
}
```

### API Endpoints

**Get Extracted Images:**
```
GET /api/brand-soul/extracted-images?brandId={brandId}
```

**Response:**
```json
{
  "success": true,
  "artifacts": [
    {
      "id": "artifact_abc123",
      "type": "website",
      "title": "Example Company",
      "sourceUrl": "https://example.com",
      "extractedImages": [
        "https://example.com/logo.png",
        "https://example.com/hero.jpg"
      ],
      "createdAt": "2025-10-19T..."
    }
  ]
}
```

---

## 🎨 UI Components

### ExtractedImagesSection Component

**Location:** `src/components/brand-soul/ExtractedImagesSection.tsx`

**Features:**
- Fetches artifacts with extracted images
- Displays in responsive grid (2-5 columns based on screen size)
- Lazy loading for performance
- Error handling for broken images
- Full-size lightbox preview
- Source attribution with links

**Usage:**
```tsx
import ExtractedImagesSection from './ExtractedImagesSection';

<ExtractedImagesSection />
```

### Grid Layout

- **Mobile:** 2 columns
- **Tablet:** 3 columns
- **Desktop:** 4 columns
- **Large screens:** 5 columns

---

## 💡 Use Cases

### Brand Audit

**Scenario:** You want to understand how your brand appears online

**Solution:**
1. Add your website + competitor websites to Brand Soul
2. View extracted images side-by-side
3. Analyze visual consistency
4. Identify gaps or inconsistencies

### Visual Inspiration

**Scenario:** Building a new marketing campaign

**Solution:**
1. Crawl competitor websites
2. Extract their visual assets
3. Use as reference for AI image generation
4. Ensure your brand stands out

### Brand Consistency Check

**Scenario:** Verify brand guidelines are followed

**Solution:**
1. Add all your brand touchpoints (website, landing pages, etc.)
2. View extracted images in one place
3. Check for color consistency
4. Verify logo usage
5. Ensure visual alignment

---

## 🔒 Security & Privacy

### Image URLs Only

- We store **image URLs**, not the actual image files
- Images are loaded directly from original sources
- No image hosting costs
- Always up-to-date with source

### Access Control

- Images only visible to brand members
- Two-tier security: authentication + brand access
- API endpoints protected by `requireBrandAccess()`

### CORS & Loading

- Images load from original domains
- May fail if source blocks CORS
- Fallback placeholder shown for broken images

---

## 🚧 Limitations

### Image Limit

- **10 images per source** maximum
- For multi-page crawls, first 10 unique images across all pages
- Prevents excessive storage and display clutter

### External Dependencies

- Images load from original URLs
- If source website goes down, images won't load
- No local caching or mirroring

### CORS Restrictions

- Some websites block cross-origin image loading
- These images will show placeholder
- Lightbox may not work for CORS-blocked images

---

## 📊 Metrics & Analytics

### Tracking

The system tracks:
- Number of images extracted per artifact
- Success/failure rate of image extraction
- Total images across all artifacts

### Success Message

When crawling completes:
```
Website crawled successfully (3 pages, 8 images). AI extraction queued.
```

---

## 🛠️ Troubleshooting

### No images extracted

**Possible causes:**
- Website has no images
- Website blocks crawlers
- Images are loaded via JavaScript after initial render

**Solutions:**
- Try a different URL
- Ensure website is publicly accessible
- Check if website has actual `<img>` tags

### Images not displaying

**Possible causes:**
- Original website down
- CORS restrictions
- Invalid image URLs

**Solutions:**
- Check if source URL is accessible
- Look for browser console errors
- Try refreshing the Brand Soul tab

### Broken image placeholders

**Possible causes:**
- Image URL moved/deleted
- CORS blocking
- Image requires authentication

**Solutions:**
- Visit source URL to verify image exists
- Click "View source" link to check original website
- Some images may not be accessible externally

---

## 🎯 Best Practices

### For Best Results:

1. **Crawl high-quality sources**
   - Official brand websites
   - Professional portfolio sites
   - High-res image galleries

2. **Use crawl sparingly**
   - Crawl single pages when possible
   - Only enable multi-page for comprehensive sites
   - Firecrawl has API limits

3. **Regular updates**
   - Re-crawl websites quarterly
   - Update when brand refreshes
   - Keep visual assets current

4. **Combine with other sources**
   - Upload brand guidelines (PDF)
   - Add direct image uploads
   - Include video sources
   - YouTube links for dynamic content

---

## 🔄 Updates & Future Enhancements

### Current Status: ✅ Live

Multimodal Brand Soul with image extraction is **live and functional**.

### Potential Future Enhancements:

- [ ] Download and store images locally
- [ ] OCR text extraction from images
- [ ] Image similarity analysis
- [ ] Color palette extraction from images
- [ ] Visual tagging and categorization
- [ ] Bulk image download
- [ ] Image comparison tools

---

## 📚 Related Documentation

- **Brand Soul Overview:** See main Brand Soul docs
- **Firecrawl Integration:** [Firecrawl Docs](https://docs.firecrawl.dev/features/scrape)
- **Phase 1 Integration:** See `BRAND_SOUL_VERIFICATION_SUMMARY.md`

---

**Last Updated:** October 19, 2025  
**Status:** ✅ Production Ready  
**Feature:** Multimodal Brand Soul with Visual Asset Extraction
