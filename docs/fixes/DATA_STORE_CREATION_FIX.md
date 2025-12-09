# Data Store Creation Fix - Enhanced Error Handling

## Changes Made

### 1. Enhanced Error Handling in Data Store Creation
- Added specific exception handling for:
  - `NotFound` - Collection or data store doesn't exist
  - `PermissionDenied` - Service account lacks permissions
  - `FailedPrecondition` - API not enabled or precondition failed
- Added detailed logging at each step
- Logs full tracebacks for debugging

### 2. Better Error Propagation
- Exceptions during data store creation are now properly caught and returned
- Error messages include:
  - Specific error type
  - Error code (if available)
  - Full error message
  - Suggestions for fixing

### 3. Improved Verification
- Verifies data store exists before indexing
- Uses the path returned by the API (not constructed path)
- Fails fast if verification fails

## What to Check

When you try to index media now, check the Python service logs for:

1. **Data Store Creation Attempt**:
   ```
   Getting or creating data store for brand: {brand_id}
   Creating new media data store for brand: {brand_id}
   Calling create_data_store with parent=...
   ```

2. **Success**:
   ```
   Successfully created new data store: {result.name}
   Verified created data store is accessible
   ```

3. **Errors** (will show specific error type):
   - `NOT_FOUND` - Collection or data store doesn't exist
   - `PERMISSION_DENIED` - Service account lacks permissions
   - `FAILED_PRECONDITION` - API not enabled
   - Other errors with full traceback

## Common Issues and Solutions

### Issue 1: NOT_FOUND Error
**Error**: `404 Collection not found` or `404 Data store not found`

**Possible Causes**:
- Collection `default_collection` doesn't exist
- Discovery Engine API not enabled
- Wrong project ID or location

**Solution**:
1. Enable Discovery Engine API: https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project={project_id}
2. Wait 2-3 minutes for API to activate
3. The `default_collection` should be created automatically when API is first used

### Issue 2: PERMISSION_DENIED Error
**Error**: `403 Permission denied`

**Solution**:
1. Go to IAM Console: https://console.cloud.google.com/iam-admin/iam?project={project_id}
2. Find your service account
3. Add role: "Discovery Engine Admin"
4. Save and wait 1-2 minutes

### Issue 3: FAILED_PRECONDITION Error
**Error**: `Failed precondition` or `API not enabled`

**Solution**:
1. Enable Discovery Engine API
2. Wait for activation
3. Verify service account permissions

## Testing

After these changes, when you try to index media:

1. **Check Python Service Logs** - You'll see detailed error messages
2. **Check Frontend Error** - Error messages will be more specific
3. **Use Test Endpoint** (after restart):
   ```bash
   curl "http://127.0.0.1:8000/agent/test-datastore/brand-1764966728064-hpexbg"
   ```

## Next Steps

1. **Restart Python Service** to load the enhanced error handling
2. **Try Indexing Again** - Check logs for specific error
3. **Fix Based on Error**:
   - If NOT_FOUND → Enable API and check collection
   - If PERMISSION_DENIED → Add Discovery Engine Admin role
   - If other error → Check logs for details

The enhanced error handling will now show you exactly what's failing, making it much easier to fix the issue.

