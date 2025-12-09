# Data Store Indexing Fix

## Issue
When trying to index media, we get the following error:
```
404 Data store projects/565460316123/locations/global/collections/default_collection/dataStores/momentum-media-brand-1764966728064-hpexbg not found.
```

The error path includes `/collections/default_collection/` which is unusual and suggests a path format mismatch.

## Root Cause
The data store doesn't exist, and the creation process may be failing silently or the API is using a different path format internally.

## Changes Made

### 1. Enhanced Error Handling in Data Store Creation
**File**: `python_service/services/media_search_service.py`

- Added detailed logging for data store creation process
- Added logging for parent path and data store ID
- Added exception handling for `AlreadyExists` errors (race conditions)
- Added full traceback logging for creation failures
- Increased timeout from 60 to 120 seconds for data store creation

### 2. Improved Indexing Error Messages
**File**: `python_service/services/media_search_service.py`

- Added detailed logging for each media item indexing attempt
- Added specific handling for `NotFound` errors with branch path information
- Added debug logging for successful indexing operations
- Improved error messages to include context about what failed

### 3. Better Error Feedback
**File**: `python_service/services/media_search_service.py`

- Enhanced error messages when data store creation fails
- Added helpful troubleshooting information in error responses
- Added 2-second wait after data store creation to ensure it's fully ready

## Next Steps

### 1. Check Python Service Logs
When you try to index media again, check the Python service logs for:
- Data store creation attempts
- Any errors during creation
- The actual paths being used

### 2. Verify API Enablement
Ensure the Discovery Engine API is enabled:
- Check: https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project=momentum-fa852
- If not enabled, enable it and wait 2-3 minutes

### 3. Verify Service Account Permissions
Ensure your service account has the "Discovery Engine Admin" role:
- Go to: https://console.cloud.google.com/iam-admin/iam?project=momentum-fa852
- Find your service account
- Verify it has "Discovery Engine Admin" role

### 4. Test Data Store Creation
Try indexing media again and check:
- Python service logs for detailed error messages
- Whether the data store is being created successfully
- If creation fails, what the specific error is

## Debugging

To see detailed logs:
1. Check Python service logs: `/tmp/python_service.log` or wherever your service logs are
2. Look for log messages starting with:
   - `[INFO] Creating new media data store for brand:`
   - `[INFO] Calling create_data_store with parent=`
   - `[ERROR] Failed to create data store:`

## Expected Behavior

After these fixes:
1. Data store creation should log detailed information
2. If creation fails, you'll see the exact error and traceback
3. Indexing will wait 2 seconds after data store creation to ensure it's ready
4. Better error messages will help identify the root cause

## Path Format Note

The error message shows a path with `/collections/default_collection/` which is unusual. The code constructs paths as:
- `projects/{project_id}/locations/{location}/dataStores/{datastore_id}`
- `projects/{project_id}/locations/{location}/dataStores/{datastore_id}/branches/default_branch`

If the API is expecting a different format, we may need to adjust the path construction. The detailed logging will help identify if this is the issue.

