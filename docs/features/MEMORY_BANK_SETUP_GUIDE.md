# Memory Bank Setup Guide

## Prerequisites & Environment Configuration

The "Backend returned success but no engine ID" error occurs when required environment variables are missing or incorrect.

---

## Required Environment Variables

### 1. Enable Memory Bank Feature

Add to your `.env` file:

```bash
# Enable Memory Bank feature
MOMENTUM_ENABLE_MEMORY_BANK=true
```

**Why:** The backend checks `is_memory_bank_enabled()` before creating engines. If not set to `true`, it returns:
```json
{
  "status": "error",
  "message": "Memory Bank is not enabled. Set MOMENTUM_ENABLE_MEMORY_BANK=true"
}
```

### 2. Google Cloud Project ID

```bash
# Your Google Cloud Project ID
MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id

# Alternative (for backwards compatibility)
GOOGLE_CLOUD_PROJECT=your-project-id
```

**Why:** Required to create Vertex AI Agent Engines. The backend checks both variables.

### 3. Agent Engine Location (Optional)

```bash
# Default: us-central1
MOMENTUM_AGENT_ENGINE_LOCATION=us-central1
```

**Why:** Determines which Google Cloud region to create the Agent Engine in. Must be a region where Vertex AI Agent Engine is available.

### 4. Google Cloud Credentials

```bash
# Path to service account JSON
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# OR (for Firebase Admin)
MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type": "service_account", ...}'
```

**Why:** Required for authenticating with Google Cloud APIs.

---

## Google Cloud Setup

### Step 1: Enable Required APIs

In your Google Cloud Console, enable:

1. **Vertex AI API**
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

2. **Agent Builder API** (for Agent Engine)
   ```bash
   gcloud services enable agentbuilder.googleapis.com
   ```

3. **Cloud Firestore API** (if not already enabled)
   ```bash
   gcloud services enable firestore.googleapis.com
   ```

### Step 2: Create Service Account

1. Go to [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click "Create Service Account"
3. Name: `momentum-agent-engine`
4. Click "Create and Continue"

### Step 3: Grant Required Permissions

Add these roles to your service account:

```bash
# Vertex AI User - to create Agent Engines
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:momentum-agent-engine@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Firestore User - to store engine metadata
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:momentum-agent-engine@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Service Account User - for impersonation if needed
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:momentum-agent-engine@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

**Required Roles:**
- ✅ `roles/aiplatform.user` - Create and manage Vertex AI resources
- ✅ `roles/datastore.user` - Read/write Firestore
- ✅ `roles/iam.serviceAccountUser` - Service account operations

### Step 4: Download Service Account Key

1. In Service Accounts page, click on your service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose JSON format
5. Save the file and update your `.env`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json
```

### Step 5: Verify Vertex AI Agent Engine Availability

Not all regions support Agent Engine. Verify your region:

```bash
# Check available locations
gcloud ai models list --region=us-central1

# If us-central1 doesn't work, try:
# - us-west1
# - europe-west1
# - asia-southeast1
```

Update your `.env` with the working region:
```bash
MOMENTUM_AGENT_ENGINE_LOCATION=us-central1
```

---

## Complete `.env` Example

```bash
# ============================================
# MEMORY BANK CONFIGURATION
# ============================================

# Enable Memory Bank feature
MOMENTUM_ENABLE_MEMORY_BANK=true

# Google Cloud Project
MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id-here

# Agent Engine Location (must support Vertex AI Agent Engine)
MOMENTUM_AGENT_ENGINE_LOCATION=us-central1

# Google Cloud Credentials
GOOGLE_APPLICATION_CREDENTIALS=/Users/yourname/path/to/service-account-key.json

# ============================================
# FIREBASE CONFIGURATION
# ============================================
MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
# ... other Firebase config ...

# ============================================
# OTHER CONFIGURATION
# ============================================
MOMENTUM_PYTHON_AGENT_URL=http://127.0.0.1:8000
# ... other config ...
```

---

## Troubleshooting

### Error: "Backend returned success but no engine ID"

**Cause:** `MOMENTUM_ENABLE_MEMORY_BANK` is not set to `true`

**Fix:**
```bash
echo "MOMENTUM_ENABLE_MEMORY_BANK=true" >> .env
```

Then restart the application.

### Error: "Memory Bank is not enabled"

**Cause:** Same as above - feature flag not enabled

**Fix:** Set `MOMENTUM_ENABLE_MEMORY_BANK=true` in `.env`

### Error: "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is required"

**Cause:** Project ID not configured

**Fix:**
```bash
echo "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id" >> .env
```

### Error: "Could not automatically determine credentials"

**Cause:** Service account credentials not found

**Fix:**
1. Download service account key from Google Cloud Console
2. Update `.env` with path:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
   ```

### Error: "Permission denied" or "Forbidden"

**Cause:** Service account lacks required permissions

**Fix:** Grant the required IAM roles (see Step 3 above):
- `roles/aiplatform.user`
- `roles/datastore.user`
- `roles/iam.serviceAccountUser`

### Error: "API not enabled"

**Cause:** Vertex AI or Agent Builder API not enabled

**Fix:**
```bash
gcloud services enable aiplatform.googleapis.com
gcloud services enable agentbuilder.googleapis.com
```

### Error: "Region not supported"

**Cause:** Agent Engine not available in specified region

**Fix:** Try a different region:
```bash
MOMENTUM_AGENT_ENGINE_LOCATION=us-west1
```

---

## Verification Steps

### 1. Check Environment Variables

```bash
# In your project root
cd /Users/huguensjean/MOMENTUM_SOURCE/momentum-agent
cat .env | grep -E "MOMENTUM_ENABLE_MEMORY_BANK|MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID|MOMENTUM_AGENT_ENGINE_LOCATION"
```

**Expected output:**
```
MOMENTUM_ENABLE_MEMORY_BANK=true
MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
MOMENTUM_AGENT_ENGINE_LOCATION=us-central1
```

### 2. Check Google Cloud Authentication

```bash
gcloud auth list
gcloud config get-value project
```

**Expected:** Your service account or user account should be listed and project should match your Firebase project.

### 3. Check API Status

```bash
gcloud services list --enabled | grep -E "aiplatform|agentbuilder"
```

**Expected output:**
```
aiplatform.googleapis.com
agentbuilder.googleapis.com
```

### 4. Test Backend Connection

```bash
curl -s http://127.0.0.1:8000/agent/status
```

**Expected output:**
```json
{"status":"available","agent":"LlmAgent","runner":"Runner"}
```

### 5. Check Backend Logs

```bash
tail -f /tmp/python_service.log | grep -i "memory bank\|agent engine"
```

Look for messages like:
- ✅ "Creating Team Agent Engine for brand..."
- ✅ "Successfully created Agent Engine: ..."
- ❌ "Memory Bank is not enabled..."
- ❌ "Google API error..."

---

## Quick Setup Script

Run this to check your configuration:

```bash
#!/bin/bash

echo "🔍 Checking Memory Bank Configuration..."
echo ""

# Check .env file
if [ -f .env ]; then
  echo "✅ .env file exists"
  
  if grep -q "MOMENTUM_ENABLE_MEMORY_BANK=true" .env; then
    echo "✅ MOMENTUM_ENABLE_MEMORY_BANK is enabled"
  else
    echo "❌ MOMENTUM_ENABLE_MEMORY_BANK is NOT enabled or missing"
    echo "   Fix: Add 'MOMENTUM_ENABLE_MEMORY_BANK=true' to .env"
  fi
  
  if grep -q "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=" .env; then
    echo "✅ MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID is set"
  else
    echo "❌ MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing"
    echo "   Fix: Add 'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id' to .env"
  fi
  
  if grep -q "GOOGLE_APPLICATION_CREDENTIALS=" .env; then
    echo "✅ GOOGLE_APPLICATION_CREDENTIALS is set"
    CRED_PATH=$(grep "GOOGLE_APPLICATION_CREDENTIALS=" .env | cut -d'=' -f2)
    if [ -f "$CRED_PATH" ]; then
      echo "✅ Service account key file exists"
    else
      echo "⚠️  Service account key file not found at: $CRED_PATH"
    fi
  else
    echo "⚠️  GOOGLE_APPLICATION_CREDENTIALS not set (may use MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON)"
  fi
else
  echo "❌ .env file not found"
  echo "   Fix: Create .env file in project root"
fi

echo ""
echo "🔍 Checking Google Cloud APIs..."

# Check if gcloud is installed
if command -v gcloud &> /dev/null; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
  if [ -n "$PROJECT_ID" ]; then
    echo "✅ gcloud configured with project: $PROJECT_ID"
    
    # Check APIs
    if gcloud services list --enabled 2>/dev/null | grep -q "aiplatform.googleapis.com"; then
      echo "✅ Vertex AI API is enabled"
    else
      echo "❌ Vertex AI API is NOT enabled"
      echo "   Fix: gcloud services enable aiplatform.googleapis.com"
    fi
    
    if gcloud services list --enabled 2>/dev/null | grep -q "agentbuilder.googleapis.com"; then
      echo "✅ Agent Builder API is enabled"
    else
      echo "⚠️  Agent Builder API is NOT enabled (may be required)"
      echo "   Fix: gcloud services enable agentbuilder.googleapis.com"
    fi
  else
    echo "⚠️  gcloud not configured with a project"
  fi
else
  echo "⚠️  gcloud command not found (install Google Cloud SDK)"
fi

echo ""
echo "✅ Configuration check complete!"
```

Save as `check-memory-bank-setup.sh` and run:

```bash
chmod +x check-memory-bank-setup.sh
./check-memory-bank-setup.sh
```

---

## Next Steps

1. ✅ Set all required environment variables in `.env`
2. ✅ Enable required Google Cloud APIs
3. ✅ Configure service account with proper permissions
4. ✅ Restart the application:
   ```bash
   # Stop services
   pkill -f "python3 main.py"
   pkill -f "next dev"
   
   # Start backend
   cd python_service && ./momentum/bin/python3 main.py &
   
   # Start frontend
   cd .. && npm run dev
   ```
5. ✅ Try creating a Memory Bank again

---

## Support

If you continue to have issues:

1. Check backend logs: `tail -f /tmp/python_service.log`
2. Look for specific error messages
3. Verify all environment variables are set correctly
4. Ensure Google Cloud APIs are enabled
5. Confirm service account has required permissions

**Status:** Configuration guide complete! 📝

