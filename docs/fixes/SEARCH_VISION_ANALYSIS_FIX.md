# Search Vision Analysis Fix

## Issue
When searching for "futuristic purple", the car with that description doesn't appear in results.

## Root Cause Analysis

The vision analysis fields are already included in:
1. ✅ **Indexing** - Vision analysis fields are added to searchable content
2. ✅ **Firestore Fallback Search** - Vision analysis fields are included
3. ✅ **Media Library Search Route** - Vision analysis fields are included

However, the issue might be:
1. **Media not re-indexed** - If media was indexed before vision analysis was added, it needs to be re-indexed
2. **Multi-word query matching** - The search might not handle multi-word queries like "futuristic purple" well
3. **Vertex AI Search not working** - If data store doesn't exist, it falls back to Firestore which might not be matching properly

## Fixes Applied

### 1. Improved Multi-Word Query Matching
**File**: `src/app/api/media-library/search/route.ts`

- ✅ Enhanced to handle multi-word queries properly
- ✅ Checks if all query words appear in searchable text (not just exact phrase)
- ✅ Uses word boundary matching for better accuracy

**Before**:
```typescript
if (query) {
  filteredItems = filteredItems.filter((item: UnifiedMedia) =>
    item.title.toLowerCase().includes(queryLower) ||
    item.description?.toLowerCase().includes(queryLower) ||
    item.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))
  );
}
```

**After**:
```typescript
if (query) {
  const queryWords = queryLower.trim().split(/\s+/).filter(w => w.length > 0);
  
  filteredItems = filteredItems.filter((item: UnifiedMedia) => {
    // Build searchable text including vision analysis
    const searchableText = [
      item.title || '',
      item.description || '',
      item.prompt || '',
      ...(item.tags || []),
      item.visionDescription || '',  // ✅ Vision analysis included
      ...(item.visionKeywords || []),
      ...(item.visionCategories || []),
      item.enhancedSearchText || '',
    ].join(' ').toLowerCase();
    
    // Multi-word: check all words appear
    if (queryWords.length > 1) {
      return queryWords.every(word => {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        return wordRegex.test(searchableText);
      });
    } else {
      return searchableText.includes(queryLower);
    }
  });
}
```

### 2. Vision Analysis Already Included in Fallback Search
**File**: `src/lib/actions/media-library-actions.ts`

- ✅ Vision analysis fields are already included in `fallbackTextSearch()`
- ✅ Multi-word query matching improved

### 3. Vision Analysis Already Included in Indexing
**File**: `python_service/services/media_search_service.py`

- ✅ Vision analysis fields are added to searchable content
- ✅ Vision analysis fields are added to structured data

## Next Steps

1. **Re-index Media with Vision Analysis**:
   - Go to Media Library
   - Click "Index for Search"
   - This will re-index all media with vision analysis fields

2. **Verify Vision Analysis Exists**:
   - Check that the media item has `visionDescription`, `visionKeywords`, etc.
   - If not, run vision analysis first using "Analyze Images" or "Analyze All Media"

3. **Test Search**:
   - Search for "futuristic purple"
   - Should now find media with those terms in vision analysis

## How Search Works Now

1. **Vertex AI Search** (if available):
   - Searches across all fields including vision analysis
   - Uses semantic understanding to match queries

2. **Firestore Fallback** (if Vertex AI unavailable):
   - Searches across all fields including vision analysis
   - Multi-word queries: all words must appear (can be in different parts of text)
   - Uses word boundary matching for accuracy

Both paths now properly search vision analysis fields! ✅

