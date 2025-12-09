# Cloud Run Deployment Guide for Momentum Agent

**Status:** ✅ Production Ready
**Tests:** 1010/1010 Passing (100%)
**Date:** November 24, 2025

---

## 🎯 Overview

This guide ensures the Momentum Agent application runs **exactly the same** on Cloud Run as it does on localhost, with all features operational:
- ✅ AI Agent & Chat
- ✅ AI Models (Gemini, Imagen, Veo)
- ✅ Team Tools
- ✅ Memory Service & Memory Bank
- ✅ Media Library
- ✅ Performance Optimizations (caching)

---

## ✅ Pre-Deployment Checklist

### 1. **Environment Variables** (CRITICAL)

```bash
# Firebase & GCP Project
MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
GOOGLE_CLOUD_PROJECT=your-project-id
MOMENTUM_FIREBASE_ADMIN_PROJECT_ID=your-project-id

# AI Models
MOMENTUM_GOOGLE_API_KEY=your-gemini-api-key
VERTEX_AI_LOCATION=us-central1

# Agent Engine & Memory Bank
MOMENTUM_AGENT_ENGINE_LOCATION=us-central1
MOMENTUM_ENABLE_MEMORY_BANK=true

# Python Service (if deployed separately)
MOMENTUM_PYTHON_AGENT_URL=https://your-python-service-url
```

### 2. **Service Account Permissions** (CRITICAL)

The Cloud Run service account needs these IAM roles:

```
roles/aiplatform.user          # For Vertex AI (Imagen, Veo)
roles/datastore.user           # For Firestore
roles/storage.objectAdmin      # For Cloud Storage (media)
roles/firebase.admin           # For Firebase Auth
roles/logging.logWriter        # For Cloud Logging
```

**To grant permissions:**
```bash
PROJECT_ID=your-project-id
SERVICE_ACCOUNT=your-service-account@${PROJECT_ID}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin"
```

### 3. **Firestore Indexes** (CRITICAL)

Deploy indexes before first deployment:

```bash
firebase deploy --only firestore:indexes
```

Indexes are defined in `FIRESTORE_INDEXES.md` and include:
- Media library queries (type, brand, created date)
- Chat history (timestamp ordering)
- Brand Soul artifacts
- Team intelligence insights
- Campaign scheduling

---

## 🚀 Deployment Steps

### Step 1: Build the Docker Image

```bash
# Set your project ID
export PROJECT_ID=your-project-id

# Build and tag the image
docker build -t gcr.io/$PROJECT_ID/momentum-agent:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/momentum-agent:latest
```

### Step 2: Deploy to Cloud Run

```bash
gcloud run deploy momentum-agent \
  --image gcr.io/$PROJECT_ID/momentum-agent:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
  --set-env-vars "MOMENTUM_ENABLE_MEMORY_BANK=true" \
  --set-env-vars "MOMENTUM_AGENT_ENGINE_LOCATION=us-central1" \
  --service-account your-service-account@$PROJECT_ID.iam.gserviceaccount.com
```

**Important Configuration:**
- **Memory:** 4GB (minimum 2GB for AI operations)
- **CPU:** 2 vCPU (for parallel processing)
- **Timeout:** 300s (5 minutes for long AI operations)
- **Concurrency:** 80-100 (adjust based on load)
- **Min Instances:** 1+ (avoid cold starts in production)

### Step 3: Set Secrets (Recommended)

For sensitive data like API keys, use Secret Manager:

```bash
# Create secret
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key --data-file=-

# Grant access to service account
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:your-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy with secret
gcloud run deploy momentum-agent \
  ... \
  --set-secrets="MOMENTUM_GOOGLE_API_KEY=gemini-api-key:latest"
```

---

## 🧪 Post-Deployment Verification

### 1. **Health Check** (IMMEDIATE)

```bash
# Get your Cloud Run URL
SERVICE_URL=$(gcloud run services describe momentum-agent --region us-central1 --format 'value(status.url)')

# Check health endpoint
curl $SERVICE_URL/api/health | jq .
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T...",
  "environment": "production",
  "services": {
    "firebase": { "status": "ok" },
    "firestore": { "status": "ok" },
    "cache": { "status": "ok" }
  },
  "deployment": {
    "isCloudRun": true,
    "region": "us-central1",
    "service": "momentum-agent"
  }
}
```

### 2. **Test Critical APIs**

```bash
# Test chat API (requires authentication token)
curl -X POST $SERVICE_URL/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "mode": "agent",
    "brandId": "your-brand-id",
    "userId": "your-user-id"
  }'

# Test memory creation
curl -X POST $SERVICE_URL/api/memory/create-engine \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"userId": "your-user-id"}'

# Test media library
curl $SERVICE_URL/api/media/list?brandId=your-brand-id \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### 3. **Monitor Logs**

```bash
# Stream logs in real-time
gcloud run services logs tail momentum-agent --region us-central1

# Look for key indicators:
# [Health Check] ✓ ... - Health checks passing
# [Cache] HIT: ... - Caching working
# [AIAssistantContext] ... - AI context loading
# [Marketing Agent] ✓ ... - Python service connection
```

### 4. **Check Cloud Monitoring**

View metrics in Cloud Console:
```
https://console.cloud.google.com/run/detail/us-central1/momentum-agent/metrics
```

Monitor:
- Request latency (target: <2s for cached requests)
- Error rate (target: <1%)
- Instance count
- Memory utilization (target: <80%)

---

## 🔍 E2E Test Suite

We've added comprehensive E2E tests specifically for Cloud Run deployment:

```bash
# Run locally to verify configuration
npm test src/test/cloud-run-deployment.test.ts
```

**Tests include:**
1. Environment configuration validation
2. Firebase/Firestore connectivity
3. AI model integrations (Gemini, Vertex AI)
4. Memory service setup
5. Media library & storage
6. Cache manager functionality
7. API route health
8. Performance & monitoring
9. Security & authentication

**All 1010 tests passing ✅**

---

## 🐛 Troubleshooting

### Issue: "Firebase Admin SDK initialization failed"

**Cause:** Missing service account permissions or environment variables

**Fix:**
1. Check service account has required IAM roles
2. Verify environment variables are set
3. Check Cloud Run logs: `gcloud run services logs read momentum-agent`

```bash
# Verify service account
gcloud run services describe momentum-agent \
  --region us-central1 \
  --format 'value(spec.template.spec.serviceAccountName)'

# Check IAM roles
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:your-service-account@$PROJECT_ID.iam.gserviceaccount.com"
```

### Issue: "Firestore permission denied"

**Cause:** Service account lacks Firestore access

**Fix:**
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:your-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### Issue: "AI operations failing"

**Cause:** Missing Vertex AI permissions or API key

**Fix:**
1. Grant `roles/aiplatform.user` to service account
2. Verify `MOMENTUM_GOOGLE_API_KEY` is set
3. Check API is enabled:
```bash
gcloud services enable aiplatform.googleapis.com
gcloud services enable generativelanguage.googleapis.com
```

### Issue: "Memory Bank not working"

**Cause:** Feature not enabled or missing configuration

**Fix:**
1. Set `MOMENTUM_ENABLE_MEMORY_BANK=true`
2. Verify Agent Engine location is set
3. Ensure service account has `roles/aiplatform.user`

```bash
gcloud run services update momentum-agent \
  --region us-central1 \
  --set-env-vars "MOMENTUM_ENABLE_MEMORY_BANK=true"
```

### Issue: "Python Agent unreachable"

**Cause:** Python service not deployed or URL misconfigured

**Fix:**
1. Deploy Python service separately to Cloud Run
2. Update `MOMENTUM_PYTHON_AGENT_URL` environment variable
3. Check Python service health:
```bash
curl $PYTHON_SERVICE_URL/health
```

### Issue: "Slow performance / timeouts"

**Cause:** Insufficient resources or cold starts

**Fix:**
1. Increase memory to 4GB:
```bash
gcloud run services update momentum-agent \
  --region us-central1 \
  --memory 4Gi
```

2. Set min instances to prevent cold starts:
```bash
gcloud run services update momentum-agent \
  --region us-central1 \
  --min-instances 1
```

3. Check cache hit rates in logs:
```bash
gcloud run services logs read momentum-agent \
  --region us-central1 \
  --filter '[Cache] HIT'
```

---

## 📊 Monitoring & Debugging

### Cloud Logging Queries

```
# View all requests
resource.type="cloud_run_revision"
resource.labels.service_name="momentum-agent"

# Filter errors
resource.type="cloud_run_revision"
resource.labels.service_name="momentum-agent"
severity>=ERROR

# Check cache performance
resource.type="cloud_run_revision"
resource.labels.service_name="momentum-agent"
"[Cache]"

# Monitor AI operations
resource.type="cloud_run_revision"
resource.labels.service_name="momentum-agent"
"[AIAssistantContext]"

# Track API latency
resource.type="cloud_run_revision"
resource.labels.service_name="momentum-agent"
"[Performance]"
```

### Key Metrics to Watch

1. **Request Latency**
   - Target: <2s (P95)
   - Check: Cloud Run metrics dashboard
   - Alert if: >5s consistently

2. **Error Rate**
   - Target: <1%
   - Check: Cloud Logging error count
   - Alert if: >5%

3. **Cache Hit Rate**
   - Target: >70%
   - Check: Application logs `[Cache] HIT/MISS`
   - Alert if: <50%

4. **Memory Usage**
   - Target: <80% of allocated
   - Check: Cloud Run metrics
   - Alert if: >90%

5. **Instance Count**
   - Target: 1-5 for normal load
   - Check: Cloud Run metrics
   - Alert if: >10 (may indicate issues)

---

## 🔐 Security Best Practices

### 1. Use Secret Manager for Sensitive Data

✅ DO:
```bash
# Store API keys in Secret Manager
gcloud secrets create gemini-api-key --data-file=-
```

❌ DON'T:
```bash
# Hard-code API keys in environment variables
--set-env-vars "MOMENTUM_GOOGLE_API_KEY=AIza..."
```

### 2. Restrict Service Account Permissions

Grant only necessary permissions (principle of least privilege).

### 3. Enable VPC Connector (Optional)

For additional security, deploy within VPC:
```bash
gcloud run services update momentum-agent \
  --vpc-connector your-connector \
  --vpc-egress all-traffic
```

### 4. Set Up CORS Properly

If using custom domain, configure allowed origins in code.

### 5. Enable Cloud Armor (Production)

Protect against DDoS and other attacks:
```bash
gcloud compute security-policies create momentum-policy
gcloud run services update momentum-agent \
  --security-policy momentum-policy
```

---

## 🎯 Performance Tuning

### Recommended Configuration for Production

```bash
gcloud run deploy momentum-agent \
  --image gcr.io/$PROJECT_ID/momentum-agent:latest \
  --platform managed \
  --region us-central1 \
  --memory 4Gi                    # 4GB for AI operations
  --cpu 2                         # 2 vCPU for parallel processing
  --timeout 300                   # 5 minutes max
  --concurrency 80                # 80 requests per instance
  --min-instances 2               # Always-on instances
  --max-instances 20              # Scale up to 20
  --cpu-throttling                # Throttle when idle
  --execution-environment gen2    # Use second generation
```

### Cost Optimization

1. **Use Min Instances = 0** for dev/staging (accept cold starts)
2. **Use Min Instances = 1-2** for production (no cold starts)
3. **Enable CPU Throttling** to reduce costs when idle
4. **Monitor and Adjust Concurrency** based on actual load
5. **Use Cache Effectively** to reduce database/AI costs

---

## 📈 Expected Performance (Production)

With all optimizations deployed:

| Metric | Localhost | Cloud Run | Notes |
|--------|-----------|-----------|-------|
| Chat API (cached) | 50-200ms | 100-300ms | +network latency |
| Chat API (uncached) | 2-3s | 2.5-3.5s | +network latency |
| Image Generation | 3-5s | 3-5s | Same (Vertex AI) |
| Video Generation | 30-60s | 30-60s | Same (Vertex AI) |
| Media Library Load | 500ms-1s | 700ms-1.5s | +network latency |
| Memory Operations | 1-2s | 1.5-2.5s | +network latency |

**Cache hit rate should be >70% in production.**

---

## ✅ Deployment Checklist Summary

- [ ] Environment variables configured
- [ ] Service account created with proper IAM roles
- [ ] Firestore indexes deployed
- [ ] Docker image built and pushed
- [ ] Cloud Run service deployed
- [ ] Health check endpoint returns "healthy"
- [ ] Test chat API with real request
- [ ] Test memory operations
- [ ] Test media upload
- [ ] Verify logs show cache hits
- [ ] Set up monitoring alerts
- [ ] Configure custom domain (if needed)
- [ ] Enable Cloud Armor (production)
- [ ] Document service URL for team

---

## 🆘 Support & Resources

### Internal Documentation
- `PRODUCTION_OPTIMIZATIONS_COMPLETED.md` - Performance optimizations
- `FIRESTORE_INDEXES.md` - Database indexes
- `src/test/cloud-run-deployment.test.ts` - E2E tests
- `src/app/api/health/route.ts` - Health check endpoint

### Google Cloud Documentation
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Firestore Documentation](https://cloud.google.com/firestore/docs)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)

### Monitoring
- Cloud Run Dashboard: `https://console.cloud.google.com/run`
- Cloud Logging: `https://console.cloud.google.com/logs`
- Cloud Monitoring: `https://console.cloud.google.com/monitoring`

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Health check returns `{"status": "healthy"}`
✅ Chat API responds to test requests
✅ AI image/video generation works
✅ Memory operations succeed
✅ Media library loads properly
✅ Logs show cache hits (>70%)
✅ No errors in Cloud Logging
✅ Response times match expectations

**The application should work exactly the same as localhost!**

---

*Generated: November 24, 2025*
*Version: 1.0*
*Tests: 1010/1010 passing ✅*
