# Data Store Creation Verification

## Summary
All indexing paths now ensure the data store is created if it doesn't exist before indexing media.

## Verified Paths

### ✅ 1. Team Tools (Agent Tools)
**File**: `python_service/tools/media_search_tools.py`
- **Function**: `index_brand_media()`
- **Status**: ✅ **FIXED** - Now calls `search_service.index_media()` which creates the data store
- **Behavior**: 
  - Fetches all media items from Firestore for the brand
  - Calls `search_service.index_media()` which automatically creates the data store if needed
  - Returns detailed indexing results

### ✅ 2. Media Library (Frontend)
**File**: `src/lib/actions/media-library-actions.ts`
- **Function**: `indexAllMediaAction()`
- **Status**: ✅ **VERIFIED** - Calls `/media/index` endpoint
- **Endpoint**: `python_service/routers/media.py` → `index_media_endpoint()`
- **Behavior**: 
  - Calls `search_service.index_media()` which creates the data store if needed
  - Indexes media in batches of 50

### ✅ 3. Agent Router - Bulk Indexing
**File**: `python_service/routers/agent.py`
- **Endpoint**: `/agent/media-index`
- **Status**: ✅ **VERIFIED** - Calls `search_service.index_media()`
- **Behavior**: 
  - Can index all media or specific items
  - Automatically creates data store if needed
  - Fetches media from Firestore if `index_all=true`

### ✅ 4. Agent Router - Single Item Indexing
**File**: `python_service/routers/agent.py`
- **Endpoint**: `/agent/media-index-single`
- **Status**: ✅ **VERIFIED** - Calls `search_service.index_media()`
- **Behavior**: 
  - Indexes a single media item
  - Automatically creates data store if needed
  - Used when new media is uploaded

## Core Service Method

**File**: `python_service/services/media_search_service.py`
- **Method**: `index_media()`
- **Line**: 327 - Calls `_get_or_create_datastore(brand_id)`
- **Behavior**: 
  - Always ensures data store exists before indexing
  - Creates data store if it doesn't exist
  - Returns error if data store creation fails
  - Waits 2 seconds after creation to ensure data store is ready

## Data Store Creation Flow

1. **Check Cache**: First checks in-memory cache for data store name
2. **Try to Get**: Attempts to get existing data store by path
3. **Create if Missing**: If not found, creates new data store with:
   - Display name: `MOMENTUM Media - {brand_id}`
   - Industry vertical: GENERIC
   - Solution type: SOLUTION_TYPE_SEARCH
   - Content config: CONTENT_REQUIRED
4. **Wait for Ready**: Waits up to 120 seconds for creation to complete
5. **Cache Result**: Stores data store name in cache for future use

## Error Handling

All paths now include:
- Detailed error logging
- Helpful error messages for common issues (API not enabled, permissions, etc.)
- Graceful fallback when Vertex AI Search is not configured
- Full traceback logging for debugging

## Testing

To verify data store creation works:

1. **Via Team Companion**:
   ```
   User: "index all media for this brand"
   ```

2. **Via Media Library**:
   - Go to Media Library settings
   - Click "Index All Media"

3. **Check Logs**:
   - Look for: `"Getting or creating data store for brand: {brand_id}"`
   - Look for: `"Creating new media data store for brand: {brand_id}"`
   - Look for: `"Successfully created new data store: {datastore_name}"`

## Notes

- Data store creation is automatic and transparent to the user
- If creation fails, indexing will fail with a clear error message
- The data store is created once per brand and reused for all future indexing
- The data store name format: `momentum-media-{brand_id}` (lowercase, hyphens)

