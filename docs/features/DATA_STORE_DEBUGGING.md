# Data Store Creation Debugging Guide

## Current Issue
Data store creation appears to be failing, resulting in 404 errors when trying to index media.

## Enhanced Error Handling Added

### 1. Better Logging
- Added detailed logging at each step of data store creation
- Logs the parent path, data store ID, and full error details
- Logs the path returned by the API vs. expected path

### 2. Verification Steps
- Verifies data store exists after creation
- Verifies data store is accessible before indexing
- Returns clear error messages if verification fails

### 3. Path Handling
- Uses the path returned by the API (not the constructed path)
- Handles cases where API returns a different path format

## Next Steps to Debug

### 1. Check Python Service Logs
When you try to index media, check the Python service logs for:
- `"Getting or creating data store for brand: {brand_id}"`
- `"Creating new media data store for brand: {brand_id}"`
- `"Calling create_data_store with parent=..."`
- `"Successfully created new data store: {result.name}"`
- Any error messages

### 2. Common Issues

**Issue 1: API Not Enabled**
- Error: `403 SERVICE_DISABLED` or `API has not been used`
- Solution: Enable Discovery Engine API in Google Cloud Console

**Issue 2: Missing Permissions**
- Error: `403 PERMISSION_DENIED`
- Solution: Grant "Discovery Engine Admin" role to service account

**Issue 3: Collection Doesn't Exist**
- Error: `404 Collection not found`
- Solution: The `default_collection` should be created automatically, but if not, we may need to create it first

**Issue 4: Path Format Mismatch**
- Error: `404 Data store not found` (but creation succeeded)
- Solution: Use the path returned by the API, not the constructed path

### 3. Test Data Store Creation

Try creating a data store manually to see what error you get:

```python
from services.media_search_service import get_media_search_service

service = get_media_search_service()
result = service._get_or_create_datastore("your-brand-id")
print(f"Result: {result}")
```

### 4. Check Service Account Permissions

Verify your service account has:
- `Discovery Engine Admin` role
- Access to the project: `momentum-fa852` (or your project ID)

## Expected Behavior

When indexing media:
1. `_get_or_create_datastore()` is called
2. It checks if data store exists
3. If not, creates it with parent: `projects/{project_id}/locations/{location}/collections/default_collection`
4. Waits for creation to complete (up to 120 seconds)
5. Verifies data store is accessible
6. Returns the data store path
7. Indexing proceeds using that path

## If Creation Still Fails

If data store creation is still failing after these improvements:

1. **Check the actual error** in Python service logs
2. **Verify API is enabled** in Google Cloud Console
3. **Verify service account permissions**
4. **Try creating the collection manually** if needed
5. **Check if there's a quota limit** on data stores

The enhanced error handling should now provide much clearer error messages about what's failing.

