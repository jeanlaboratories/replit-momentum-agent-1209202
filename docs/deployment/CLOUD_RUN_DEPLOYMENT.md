# Google Cloud Run Deployment Guide

This guide explains how to deploy MOMENTUM to Google Cloud Run.

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** installed (for local testing)
4. **Environment variables** configured in Cloud Run

## Architecture

The Dockerfile creates a single container that runs:
- **Next.js** on port 8080 (configurable via PORT env var)
- **Python FastAPI** on port 8000 (internal, accessed via localhost)

Cloud Run will:
- Route all traffic to Next.js on port 8080
- Next.js proxies Python API requests to localhost:8000

## Quick Start

### 1. Build and Test Locally

```bash
# Build the Docker image
docker build -t momentum:latest .

# Run locally (test before deploying)
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e MOMENTUM_GOOGLE_API_KEY="your-key" \
  -e MOMENTUM_FIRECRAWL_API_KEY="your-key" \
  -e MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}' \
  -e MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY="your-key" \
  -e MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-domain" \
  -e MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project" \
  -e MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-bucket" \
  -e MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-id" \
  -e MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID="your-id" \
  momentum:latest

# Test in browser
open http://localhost:8080
```

### 2. Deploy to Cloud Run

#### Option A: Using gcloud CLI

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build and deploy in one command
gcloud run deploy momentum \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "PORT=8080"
```

#### Option B: Using Cloud Build (Automated)

```bash
# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml

# This will:
# 1. Build the Docker image
# 2. Push to Container Registry
# 3. Deploy to Cloud Run
```

### 3. Set Environment Variables

After deployment, set all required environment variables:

```bash
gcloud run services update momentum \
  --region us-central1 \
  --set-env-vars \
    "MOMENTUM_GOOGLE_API_KEY=your-key,\
    MOMENTUM_FIRECRAWL_API_KEY=your-key,\
    MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON='{\"type\":\"service_account\",...}',\
    MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY=your-key,\
    MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain,\
    MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project,\
    MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket,\
    MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-id,\
    MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID=your-id,\
    PORT=8080"
```

**Or use Secret Manager (Recommended for Production):**

```bash
# Create secrets
echo -n "your-api-key" | gcloud secrets create momentum-google-api-key --data-file=-
echo -n "your-firecrawl-key" | gcloud secrets create momentum-firecrawl-api-key --data-file=-
# ... create other secrets

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding momentum-google-api-key \
  --member serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role roles/secretmanager.secretAccessor

# Update service to use secrets
gcloud run services update momentum \
  --region us-central1 \
  --update-secrets \
    "MOMENTUM_GOOGLE_API_KEY=momentum-google-api-key:latest,\
    MOMENTUM_FIRECRAWL_API_KEY=momentum-firecrawl-api-key:latest"
```

### 4. Configure Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service momentum \
  --domain your-domain.com \
  --region us-central1

# Follow instructions to verify domain ownership
```

## Environment Variables

All environment variables from `.env` must be set in Cloud Run. See `ENV_SETUP_GUIDE.md` for details.

**Required Variables:**
- `MOMENTUM_GOOGLE_API_KEY`
- `MOMENTUM_FIRECRAWL_API_KEY`
- `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY`
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID`
- `PORT=8080` (Cloud Run sets this automatically)

**Optional Variables:**
- `MOMENTUM_NEXT_PUBLIC_SITE_URL` (your Cloud Run URL)
- `MOMENTUM_PYTHON_AGENT_URL` (defaults to http://127.0.0.1:8000)

## Resource Configuration

### Recommended Settings

- **Memory:** 2Gi (minimum for AI operations)
- **CPU:** 2 vCPU
- **Timeout:** 300 seconds (5 minutes for AI generation)
- **Max Instances:** 10 (adjust based on traffic)
- **Min Instances:** 0 (to save costs) or 1 (for faster cold starts)

### Update Resources

```bash
gcloud run services update momentum \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

## Monitoring and Logs

### View Logs

```bash
# Stream logs
gcloud run services logs read momentum --region us-central1 --follow

# View recent logs
gcloud run services logs read momentum --region us-central1 --limit 50
```

### Set Up Monitoring

1. Go to Cloud Console → Cloud Run → momentum
2. Click "Monitoring" tab
3. Set up alerts for:
   - High error rates
   - High latency
   - Container crashes

## Troubleshooting

### Container Fails to Start

1. **Check logs:**
   ```bash
   gcloud run services logs read momentum --region us-central1
   ```

2. **Common issues:**
   - Missing environment variables
   - Invalid JSON in `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - Port not set to 8080
   - Insufficient memory (increase to 2Gi+)

### Python Service Not Responding

- Check that Python service starts before Next.js
- Verify `MOMENTUM_PYTHON_AGENT_URL` is set to `http://127.0.0.1:8000`
- Check logs for Python service errors

### Next.js Build Fails

- Ensure all dependencies are in `package.json`
- Check for TypeScript errors: `npm run typecheck`
- Verify `next.config.ts` is valid

### High Memory Usage

- Increase memory allocation
- Check for memory leaks in logs
- Consider increasing `--max-instances` to distribute load

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - id: 'auth'
        uses: 'google-github-actions/auth@v1'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'
      
      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v1'
      
      - name: 'Deploy to Cloud Run'
        run: |
          gcloud run deploy momentum \
            --source . \
            --region us-central1 \
            --platform managed
```

## Cost Optimization

1. **Set min-instances to 0** (unless you need always-on)
2. **Use request-based scaling** (default)
3. **Monitor usage** in Cloud Console
4. **Set up budget alerts**
5. **Use Cloud Run's free tier** (2 million requests/month)

## Security Best Practices

1. **Use Secret Manager** for sensitive values
2. **Enable IAM authentication** if needed (remove `--allow-unauthenticated`)
3. **Set up VPC connector** if accessing private resources
4. **Enable Cloud Armor** for DDoS protection
5. **Regularly update dependencies** for security patches

## Next Steps

1. Set up custom domain
2. Configure Cloud CDN for static assets
3. Set up monitoring and alerts
4. Configure backup and disaster recovery
5. Set up CI/CD pipeline

## Support

For issues or questions:
- Check Cloud Run logs
- Review `TECHNICAL_UNDERSTANDING.md` for architecture details
- See `ENV_SETUP_GUIDE.md` for environment variable setup

