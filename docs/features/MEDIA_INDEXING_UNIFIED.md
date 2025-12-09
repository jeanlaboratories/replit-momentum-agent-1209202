# Media Indexing - Unified Implementation

## Summary
Both the Media Library and Team tool now use the **exact same endpoint and logic** for indexing media, ensuring consistent behavior including automatic data store creation.

## Changes Made

### ✅ 1. Media Library Action Updated
**File**: `src/lib/actions/media-library-actions.ts`
- **Before**: Called `/media/index` in batches, didn't check result success properly
- **After**: Calls `/agent/media-index` with `index_all=true` (same as Team tool)
- **Result**: Uses identical logic, creates data store automatically

### ✅ 2. Frontend Error Handling Improved
**File**: `src/app/media/page.tsx`
- Now properly checks `result.success` (not just HTTP status)
- Displays error details when indexing fails
- Shows error count in success message if any errors occurred

## Unified Flow

Both paths now follow this flow:

```
User Action
    ↓
indexAllMediaAction() / index_brand_media()
    ↓
POST /agent/media-index
    {
        brand_id: "...",
        index_all: true
    }
    ↓
Agent Router: media_index_endpoint()
    ↓
Fetches all media from Firestore
    ↓
search_service.index_media(brand_id, media_items)
    ↓
_get_or_create_datastore(brand_id)  ← Creates data store if needed
    ↓
Indexes all media items
    ↓
Returns result with success/error status
```

## Key Benefits

1. **Consistent Behavior**: Both paths use identical logic
2. **Data Store Creation**: Both automatically create data store if missing
3. **Better Error Handling**: Properly checks result status, not just HTTP status
4. **Single Source of Truth**: One endpoint handles all indexing
5. **No Batching Issues**: Processes all media in one call, ensuring data store is created first

## Endpoint Details

**Endpoint**: `POST /agent/media-index`

**Request**:
```json
{
  "brand_id": "brand-123",
  "index_all": true
}
```

**Response** (Success):
```json
{
  "status": "success",
  "message": "Indexed 15/15 media items",
  "indexed_count": 15,
  "errors": null
}
```

**Response** (Error):
```json
{
  "status": "error",
  "message": "Failed to get or create data store",
  "indexed_count": 0,
  "errors": [
    "Failed to get or create data store. This may be due to: ..."
  ]
}
```

## Verification

Both paths now:
- ✅ Create data store automatically if it doesn't exist
- ✅ Use the same `search_service.index_media()` method
- ✅ Return the same response format
- ✅ Handle errors consistently
- ✅ Provide detailed error messages

## Testing

To verify both work the same:

1. **Media Library**:
   - Go to Media Library
   - Click "Index for Search"
   - Should create data store if needed

2. **Team Tool**:
   - Ask Team Companion: "index all media"
   - Should create data store if needed

Both should now behave identically!

