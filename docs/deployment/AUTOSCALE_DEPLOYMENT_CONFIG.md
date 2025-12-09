# Autoscale Deployment Configuration

## Overview

The application has been reconfigured to support **Autoscale deployment** with **Next.js only**, disabling the Python service for deployment.

## What Changed

### Deployment Type
- **Previous**: VM deployment with both Next.js and Python services
- **Current**: Autoscale deployment with Next.js only

### Deployment Configuration

```toml
[deployment]
deploymentTarget = "autoscale"
run = ["npm", "run", "start"]
build = ["npm", "run", "build"]
```

### Package.json Changes

The `start` script now runs only Next.js:

```json
"start": "next start -p ${PORT:-5000} -H 0.0.0.0"
```

**Previous configuration** (disabled for deployment):
- Used `bash start-services.sh` to start both services
- Required VM deployment for multi-service support

### Service Status

✅ **Next.js** - Running on `0.0.0.0:5000` (exposed externally)
❌ **Python FastAPI** - Disabled in production deployment

## Impact on Features

### Working Features
- ✅ Authentication (Firebase Auth)
- ✅ Health check endpoint (`/api/health`)
- ✅ User management
- ✅ Firebase Storage
- ✅ All frontend pages
- ✅ Database operations

### Limited Features (Python Service Required)
- ⚠️ Marketing campaign generation (requires Python marketing agent)
- ⚠️ AI-powered content generation
- ⚠️ Any feature using `/api/python/*` endpoints

The Python API routes will return error responses when the service is unavailable:
```json
{
  "error": "Failed to connect to Python service",
  "details": "Connection refused"
}
```

## Development vs Production

### Development Mode
- **Command**: `npm run dev`
- **Runs**: Both Next.js and Python services
- **Python available**: ✅ Yes
- **Full features**: ✅ All features work

### Production Deployment (Autoscale)
- **Command**: `npm run start`
- **Runs**: Next.js only
- **Python available**: ❌ No
- **Full features**: ⚠️ Python-dependent features disabled

## Alternative: VM Deployment with Both Services

If you need the Python service in production, you must use **VM deployment**:

1. Go to **Deployments pane** → **Manage tab**
2. Click **Change deployment type**
3. Select **Reserved VM - Web Server**
4. Update `.replit` configuration:
   ```toml
   [deployment]
   deploymentTarget = "vm"
   run = ["bash", "start-services.sh"]
   build = ["npm", "run", "build"]
   ```

See `VM_DEPLOYMENT_CONFIGURATION.md` for full VM deployment setup.

## Health Check

The `/api/health` endpoint is configured for fast health checks:

**Endpoint**: `GET /api/health`
**Response**:
```json
{"status":"ok"}
```

This endpoint:
- ✅ Responds immediately (no authentication)
- ✅ Doesn't depend on Python service
- ✅ Perfect for deployment health checks

## Port Configuration

```toml
[[ports]]
localPort = 5000
externalPort = 80
```

- **Port 5000**: Next.js server (exposed externally via port 80)
- **Port 8000**: Not exposed (Python service disabled)

## Testing Deployment

To test the production build locally:

```bash
# Build for production
npm run build

# Start production server
npm run start
```

The app will run on `http://0.0.0.0:5000` with only Next.js (no Python).

## Summary

✅ **Deployment Ready**: App configured for Autoscale deployment
✅ **Health Check**: Fast endpoint at `/api/health`
✅ **Single Service**: Next.js only (Python disabled)
⚠️ **Feature Limitation**: Python-dependent features unavailable in production
