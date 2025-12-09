# Cloud Run Deployment Guide

This guide explains how to deploy the Momentum application to Google Cloud Run from source.

## Prerequisites

1. **Google Cloud SDK** installed and configured
2. **gcloud** authenticated with appropriate permissions
3. Project ID set: `gcloud config set project automl-migration-test`

## Quick Deploy from Source

The simplest way to deploy is using the `--source` flag, which builds from the Dockerfile:

```bash
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
  --set-env-vars-from-file=cloud-run-env.yaml
```

## Deploy with Inline Environment Variables

If you prefer to specify environment variables inline:

```bash
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
  --set-env-vars="MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY=<your-api-key>,MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-auth-domain>,MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>,MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-storage-bucket>,MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>,MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID=<your-app-id>,MOMENTUM_GOOGLE_API_KEY=<your-google-api-key>,MOMENTUM_FIRECRAWL_API_KEY=<your-firecrawl-key>"
```

## Production Deploy with Secrets (Recommended)

For production deployments, use Google Secret Manager for sensitive values:

### Step 1: Create secrets (one-time setup)

```bash
# Create secrets in Secret Manager
echo -n "your-google-api-key" | gcloud secrets create MOMENTUM_GOOGLE_API_KEY --data-file=-
echo -n "your-firecrawl-key" | gcloud secrets create MOMENTUM_FIRECRAWL_API_KEY --data-file=-
echo -n '{"type":"service_account",...}' | gcloud secrets create MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON --data-file=-
```

### Step 2: Deploy with secrets

```bash
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
  --set-secrets="MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON=MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON:latest,MOMENTUM_GOOGLE_API_KEY=MOMENTUM_GOOGLE_API_KEY:latest,MOMENTUM_FIRECRAWL_API_KEY=MOMENTUM_FIRECRAWL_API_KEY:latest" \
  --set-env-vars="MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY=<your-api-key>,MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-auth-domain>,MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>,MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-storage-bucket>,MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>,MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID=<your-app-id>"
```

## Using Cloud Build (CI/CD)

For automated deployments via Cloud Build, use the existing `cloudbuild.yaml`:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

## Configuration Details

| Flag | Value | Description |
|------|-------|-------------|
| `--source .` | Current directory | Build from Dockerfile in source |
| `--region` | us-central1 | Cloud Run region |
| `--port` | 8080 | External port (Next.js) |
| `--memory` | 2Gi | Required for dual-service architecture |
| `--cpu` | 2 | Required for Next.js + Python |
| `--timeout` | 300 | 5 min timeout for video generation |
| `--max-instances` | 10 | Scale limit |
| `--min-instances` | 0 | Scale to zero when idle |

## Architecture

The Dockerfile builds a multi-service container:
- **Next.js** (port 8080) - Frontend and API routes
- **Python FastAPI** (port 8000, internal) - AI/ML backend services

The `docker-entrypoint.sh` script starts both services and monitors their health.

## Environment Variables

All environment variables use the `MOMENTUM_` prefix:

| Variable | Description |
|----------|-------------|
| `MOMENTUM_NEXT_PUBLIC_FIREBASE_*` | Firebase configuration |
| `MOMENTUM_GOOGLE_API_KEY` | Google AI API key |
| `MOMENTUM_FIRECRAWL_API_KEY` | Firecrawl API key |
| `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON` | Service account JSON |

## Troubleshooting

### View logs
```bash
gcloud run logs read momentum --region us-central1
```

### Check service status
```bash
gcloud run services describe momentum --region us-central1
```

### Test locally with Docker
```bash
docker build -t momentum .
docker run -p 8080:8080 --env-file .env momentum
```
