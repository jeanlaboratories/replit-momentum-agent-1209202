# Docker Deployment Summary

## Files Created

### 1. **Dockerfile**
Multi-stage Dockerfile that:
- Builds Next.js production bundle
- Installs Python 3.11 and dependencies
- Creates optimized production image
- Runs both services in a single container

### 2. **docker-entrypoint.sh**
Startup script that:
- Starts Python FastAPI service on port 8000 (internal)
- Starts Next.js on port 8080 (Cloud Run default)
- Handles graceful shutdown (SIGTERM)
- Waits for services to be ready

### 3. **.dockerignore**
Excludes unnecessary files from Docker build context:
- node_modules, .next, build artifacts
- Development files, tests, documentation
- Environment files (.env)

### 4. **cloudbuild.yaml**
Google Cloud Build configuration for automated CI/CD:
- Builds Docker image
- Pushes to Container Registry
- Deploys to Cloud Run

### 5. **CLOUD_RUN_DEPLOYMENT.md**
Complete deployment guide with:
- Step-by-step instructions
- Environment variable setup
- Resource configuration
- Troubleshooting tips

### 6. **docker-test.sh**
Local testing script to verify Docker build

## Architecture

```
┌─────────────────────────────────────┐
│     Google Cloud Run Container      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Next.js (Port 8080)        │  │
│  │   - Handles all HTTP traffic │  │
│  │   - Proxies to Python API    │  │
│  └──────────────────────────────┘  │
│              │                      │
│              │ localhost:8000       │
│              ▼                      │
│  ┌──────────────────────────────┐  │
│  │   Python FastAPI (Port 8000)  │  │
│  │   - ADK Agent                 │  │
│  │   - Internal only             │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Quick Start

### Test Locally
```bash
# Build image
docker build -t momentum:test .

# Run with .env file
docker run -p 8080:8080 --env-file .env -e PORT=8080 momentum:test

# Or use test script
./docker-test.sh
```

### Deploy to Cloud Run
```bash
# Simple deployment
gcloud run deploy momentum \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080

# Or use Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## Key Features

✅ **Multi-stage build** - Optimized image size
✅ **Security** - Non-root user, minimal attack surface
✅ **Health checks** - Automatic container health monitoring
✅ **Graceful shutdown** - Handles SIGTERM properly
✅ **Environment variables** - All config via env vars
✅ **Production ready** - Optimized for Cloud Run

## Requirements

- Node.js 22+
- Python 3.11+
- All environment variables from `.env` file
- 2GB+ memory recommended for AI operations
- 2 vCPU recommended

## Next Steps

1. Test Docker build locally: `./docker-test.sh`
2. Set up environment variables in Cloud Run
3. Deploy: `gcloud run deploy momentum --source .`
4. Configure custom domain (optional)
5. Set up monitoring and alerts

See `CLOUD_RUN_DEPLOYMENT.md` for detailed instructions.

