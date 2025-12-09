# Vertex AI Search Setup Guide

## 🔍 Issue Identified

**Error Message**:
```
⚠️ Indexing Issue
Failed to get or create data store
Could not create data store
```

**Root Cause**:
```
403 Discovery Engine API has not been used in project momentum-fa852 before or it is disabled.
```

**Status**: ❌ Discovery Engine API not enabled in your Google Cloud Project

---

## ✅ Solution: Enable Discovery Engine API

### Option 1: Quick Enable (Recommended)

**Click this direct link** to enable the API for your project:

🔗 **[Enable Discovery Engine API](https://console.developers.google.com/apis/api/discoveryengine.googleapis.com/overview?project=momentum-fa852)**

Then click the **"Enable"** button on that page.

---

### Option 2: Enable via Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **momentum-fa852**
3. Navigate to **APIs & Services** → **Library**
4. Search for **"Discovery Engine API"** or **"Vertex AI Search and Conversation API"**
5. Click on the API
6. Click **"Enable"**
7. Wait 2-3 minutes for the API to activate

---

### Option 3: Enable via gcloud CLI

```bash
gcloud config set project momentum-fa852
gcloud services enable discoveryengine.googleapis.com
```

---

## 🔧 After Enabling the API

### 1. Wait for Propagation (2-3 minutes)

The API enablement needs time to propagate through Google's systems.

### 2. Grant Permissions to Service Account

Your service account needs these IAM roles:

**Required Roles**:
- `Discovery Engine Admin` (for creating/managing data stores)
- OR `Discovery Engine Editor` (for read/write access)

**To grant permissions**:

1. Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam?project=momentum-fa852)
2. Find your service account (the one in your .env file)
3. Click **Edit** (pencil icon)
4. Click **Add Another Role**
5. Search for **"Discovery Engine Admin"**
6. Select it and click **Save**

---

## 🧪 Verify Setup

### Test 1: Check API Status

```bash
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://serviceusage.googleapis.com/v1/projects/momentum-fa852/services/discoveryengine.googleapis.com"
```

Look for `"state": "ENABLED"` in the response.

### Test 2: Try Index Media Again

1. Open Team Companion in MOMENTUM app
2. Type: "index media" or use the Index Media tool
3. Should see: ✅ "Starting media index rebuild..."
4. Should complete without errors

---

## 🎯 What Is Vertex AI Search?

**Vertex AI Search** (formerly Discovery Engine) provides:

- **Semantic Search**: Natural language queries across media
- **Multimodal Search**: Search images and videos by content
- **AI-Powered**: Uses Google's search technology
- **Scalable**: Handles large media libraries

### How MOMENTUM Uses It:

1. **Media Indexing**: All uploaded/generated media indexed automatically
2. **Semantic Search**: Users can search with natural language:
   - "images of nature"
   - "videos with motion graphics"
   - "product photos"
3. **AI Agent Integration**: Team Companion can search media to answer questions
4. **Media Library**: Enhanced search in unified media library

---

## 🚨 Troubleshooting

### Error: "API not enabled"

**Solution**: Follow steps above to enable Discovery Engine API

### Error: "Permission denied"

**Solution**: Grant "Discovery Engine Admin" role to service account

### Error: "Quota exceeded"

**Solution**: Check quotas in Google Cloud Console, may need to increase limits

### Error: "Invalid credentials"

**Solution**: Verify `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON` in .env is correct

### Error: "Data store already exists"

**Solution**: This is fine - the code will use the existing data store

---

## 📊 Cost Considerations

### Vertex AI Search Pricing:

- **Data Store**: Small monthly fee per data store
- **Document Indexing**: Per-document charges (one-time per media item)
- **Search Queries**: Per-query charges

**Estimate for MOMENTUM**:
- Small teams (<1000 media items): ~$10-30/month
- Medium teams (1000-10000 items): ~$30-100/month
- Large teams (>10000 items): Custom pricing

**Free Tier**: Google Cloud offers free tier/credits for new users

---

## 🔄 Alternative: Disable Media Search (Optional)

If you don't want to use Vertex AI Search, the app will fall back to basic Firestore queries:

### Fallback Behavior (Already Implemented):

- Media search still works (using Firestore)
- Slightly less intelligent (exact matches vs semantic)
- No additional costs
- Still functional for most use cases

**To use fallback**: Simply don't enable the Discovery Engine API. The app gracefully falls back to Firestore-based search.

---

## 📝 Environment Variables

### Current Configuration:

```env
# From your .env file (inferred from logs)
MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID="momentum-fa852"

# Optional: Explicitly set location (defaults to 'global')
# MOMENTUM_SEARCH_LOCATION="global"

# Optional: Explicitly set GCP project for Vertex AI
# MOMENTUM_GOOGLE_CLOUD_PROJECT="momentum-fa852"
```

### After Enabling API:

No env variable changes needed! The code auto-detects:
- Project ID from Firebase config
- Uses 'global' location by default
- Initializes clients with proper credentials

---

## ✅ Quick Start Checklist

1. [ ] Enable Discovery Engine API (use link above)
2. [ ] Wait 2-3 minutes for propagation
3. [ ] Grant "Discovery Engine Admin" role to service account
4. [ ] Restart Python service (if running)
5. [ ] Test "Index Media" in Team Companion
6. [ ] Verify no errors in logs

---

## 🎉 Expected Behavior After Setup

### When You Use "Index Media":

```
✅ Starting media index rebuild...
✅ Created new data store: MOMENTUM Media - brand_xxx
✅ Indexed 15/15 media items
✅ Media indexing complete!
```

### When You Search Media:

```
User: "Find images with blue sky"
AI: 🔍 Found 3 images matching your query
    - Summer Landscape (95% relevance)
    - Beach Sunset (87% relevance)
    - Mountain Vista (82% relevance)
```

---

## 📞 Support

### If Issues Persist:

1. **Check Logs**: Look at Python service terminal output
2. **Verify Project ID**: Ensure momentum-fa852 is correct
3. **Check Permissions**: Service account needs proper IAM roles
4. **API Status**: Confirm API is enabled and active
5. **Wait Time**: API enablement can take up to 5 minutes

### Quick Debug Command:

```bash
# Check if API is enabled
gcloud services list --enabled --project=momentum-fa852 | grep discoveryengine
```

Should output:
```
discoveryengine.googleapis.com  Discovery Engine API
```

---

## 🎯 Summary

**Current Status**: ❌ Discovery Engine API not enabled  
**Required Action**: Enable API via link above  
**Time Required**: 5 minutes  
**Cost Impact**: ~$10-30/month (based on usage)  
**Benefits**: Advanced semantic search for media  
**Fallback**: Basic search still works without it  

**Once enabled, media indexing will work perfectly!** ✨

