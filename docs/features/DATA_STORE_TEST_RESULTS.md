# Data Store Creation Test Results

## Test Attempted
Tried to test data store creation using the test endpoint, but the endpoint returned 404 (service may need restart to pick up new routes).

## Current Status
- ✅ Service is running on port 8000
- ✅ Media indexing endpoint is accessible
- ❌ Test endpoint not accessible (may need service restart)
- ❌ Data store creation is failing (404 errors when indexing)

## What We Know

1. **Error Message**: 
   ```
   404 Data store projects/565460316123/locations/global/collections/default_collection/dataStores/momentum-media-brand-1764966728064-hpexbg not found
   ```

2. **Path Format**: ✅ Correct - includes `/collections/default_collection/`

3. **Issue**: Data store is not being created, or creation is failing silently

## Next Steps to Diagnose

### Option 1: Check Python Service Logs Directly
When you try to index media, check the Python service console output (or logs) for:
- `"Getting or creating data store for brand: {brand_id}"`
- `"Creating new media data store for brand: {brand_id}"`
- `"Calling create_data_store with parent=..."`
- Any error messages

### Option 2: Restart Python Service
The test endpoint was added but may not be loaded. Restart the Python service:
```bash
# Kill existing service
pkill -f "uvicorn.*main:app"

# Restart it
cd python_service
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then test with:
```bash
curl "http://127.0.0.1:8000/agent/test-datastore/brand-1764966728064-hpexbg"
```

### Option 3: Check Common Issues

1. **Discovery Engine API Enabled?**
   - Check: https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project=momentum-fa852
   - If not enabled, enable it and wait 2-3 minutes

2. **Service Account Permissions?**
   - Service account needs "Discovery Engine Admin" role
   - Check: https://console.cloud.google.com/iam-admin/iam?project=momentum-fa852

3. **Project ID Correct?**
   - The error shows project: `565460316123`
   - Verify this matches your actual project ID

4. **Collection Exists?**
   - The `default_collection` should be created automatically
   - But if it doesn't exist, data store creation will fail

## Expected Behavior

When indexing media:
1. `_get_or_create_datastore()` is called
2. It checks if data store exists at: `projects/{project_id}/locations/global/collections/default_collection/dataStores/momentum-media-{brand_id}`
3. If not found, creates it with parent: `projects/{project_id}/locations/global/collections/default_collection`
4. Waits for creation (up to 120 seconds)
5. Verifies data store exists
6. Proceeds with indexing

## Most Likely Issues

Based on the 404 error, the most likely causes are:

1. **Data store creation is failing silently** - Check logs for creation errors
2. **Collection doesn't exist** - The `default_collection` may need to be created first
3. **API not enabled** - Discovery Engine API may not be enabled
4. **Permissions issue** - Service account may not have required permissions

## Enhanced Error Handling Added

The code now includes:
- ✅ Detailed logging at each step
- ✅ Verification before indexing
- ✅ Clear error messages
- ✅ Path format includes collection

Check the Python service logs when you try to index to see exactly where it's failing.

