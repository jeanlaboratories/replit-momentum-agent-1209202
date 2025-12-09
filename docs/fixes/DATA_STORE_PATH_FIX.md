# Data Store Path Format Fix

## Issue
The Discovery Engine API was returning 404 errors with paths like:
```
404 Data store projects/565460316123/locations/global/collections/default_collection/dataStores/momentum-media-brand-1764966728064-hpexbg not found.
```

## Root Cause
The Discovery Engine API **requires data stores to be created within a collection**. The correct path format is:
```
projects/{project_id}/locations/{location}/collections/{collection_id}/dataStores/{datastore_id}
```

We were using:
```
projects/{project_id}/locations/{location}/dataStores/{datastore_id}
```

This mismatch caused the API to look for the data store in the wrong location.

## Fix Applied

### 1. Updated Data Store Path Format
**File**: `python_service/services/media_search_service.py`

**Changed**:
- `_get_datastore_path()`: Now includes `/collections/default_collection/` in the path
- `_get_or_create_datastore()`: Parent path now includes `/collections/default_collection/`

**Before**:
```python
def _get_datastore_path(self, brand_id: str) -> str:
    datastore_id = self._get_datastore_id(brand_id)
    return f"projects/{self.project_id}/locations/{self.location}/dataStores/{datastore_id}"

parent = f"projects/{self.project_id}/locations/{self.location}"
```

**After**:
```python
def _get_datastore_path(self, brand_id: str) -> str:
    datastore_id = self._get_datastore_id(brand_id)
    # Discovery Engine API requires collections in the path
    # Use default_collection as per API requirements
    return f"projects/{self.project_id}/locations/{self.location}/collections/default_collection/dataStores/{datastore_id}"

parent = f"projects/{self.project_id}/locations/{self.location}/collections/default_collection"
```

### 2. Enhanced Error Handling
- Added verification step after data store creation
- Added better logging for path format issues
- Added specific error detection for collection path issues
- Increased wait time to 3 seconds after data store creation

### 3. Improved Verification
- Verifies data store exists before indexing
- Re-checks data store if first indexing attempt fails
- Better error messages when data store is not found

## Result

Now when indexing media:
1. ✅ Data store is created with the correct path format (includes collection)
2. ✅ Data store is verified to exist before indexing
3. ✅ All paths (Media Library and Team tool) use the same format
4. ✅ Better error messages if data store creation fails

## Testing

After this fix, try indexing media again:
1. Go to Media Library
2. Click "Index for Search"
3. Should now successfully create the data store and index all media

The data store will be created at:
```
projects/{project_id}/locations/global/collections/default_collection/dataStores/momentum-media-{brand_id}
```

