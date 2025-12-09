# VM Deployment Configuration - Final Setup

## Overview

This application uses **Replit VM Deployment** because it requires both a Next.js frontend and a Python FastAPI backend running simultaneously.

## Key Deployment Constraints

### VM Deployment Requirements (from Replit Documentation)

1. **Single External Port Only**: VM deployments only support **ONE external port** being exposed
2. **No Localhost Exposure**: The external port's corresponding internal port should not use `localhost`
3. **Background Services Allowed**: VM deployments are ideal for apps with background services (like our Python FastAPI)

## Current Configuration

### Architecture
```
Internet → Port 80 (External) → Port 5000 (Next.js) → Port 8000 (Python on localhost)
```

- **Next.js**: Runs on `0.0.0.0:5000` (exposed externally via port 80)
- **Python FastAPI**: Runs on `127.0.0.1:8000` (localhost only, not exposed externally)
- **Communication**: Next.js proxies requests to Python via `http://127.0.0.1:8000`

### Deployment Settings

```toml
[deployment]
deploymentTarget = "vm"
run = ["bash", "start-services.sh"]
build = ["npm", "run", "build"]
```

### Port Configuration

Only **ONE external port** is configured in `.replit`:
```toml
[[ports]]
localPort = 5000
externalPort = 80
```

**Note**: Port 8000 is NOT externally exposed - it's internal only for service-to-service communication.

### Startup Process

The `start-services.sh` script ensures services start in the correct order:

1. **Start Python service** on `127.0.0.1:8000` (background)
2. **Wait for Python** to be ready (health check on `/hello`)
3. **Start Next.js** on `0.0.0.0:5000` (exposed externally)
4. **Monitor both** processes

### Health Check Endpoint

- **Endpoint**: `/api/health`
- **Response**: `{"status":"ok"}`
- **Purpose**: Quick health check without authentication
- **Location**: `src/app/api/health/route.ts`

## Environment Variables

### PYTHON_SERVICE_URL

Set in `next.config.ts`:
```typescript
env: {
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000',
}
```

This allows Next.js to communicate with the Python service on localhost.

### Required Secrets

All set via Replit Secrets (secure):
- `GOOGLE_API_KEY` - For Python marketing agent
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - For Firebase admin
- `NEXT_PUBLIC_FIREBASE_*` - For Firebase client

## Files Modified for VM Deployment

1. **python_service/main.py**
   - Changed: `host="0.0.0.0"` → `host="127.0.0.1"`
   - Reason: Python should only listen on localhost, not externally

2. **start-services.sh**
   - Created ordered startup script
   - Waits for Python before starting Next.js
   - Uses `127.0.0.1:8000` for health checks

3. **next.config.ts**
   - Added `PYTHON_SERVICE_URL` environment variable
   - Set to `http://127.0.0.1:8000` for localhost communication

4. **src/app/api/health/route.ts**
   - NEW: Fast health check endpoint
   - Returns immediate 200 response

5. **package.json**
   - Updated `start` script to use `bash start-services.sh`

## Why Not Autoscale?

Autoscale deployments have these limitations:
- ❌ Only supports a **single web service** (can't run background services)
- ❌ Scales to zero when idle (not suitable for persistent Python service)
- ❌ No background activities outside request handling

VM deployment is required because:
- ✅ Supports **multiple services** (Next.js + Python)
- ✅ Always running (persistent Python service)
- ✅ Can run background tasks
- ✅ Predictable costs

## Testing

All endpoints verified working:
- ✅ Health check: `GET /api/health` → `{"status":"ok"}`
- ✅ Python service: `GET http://127.0.0.1:8000/hello` → Marketing agent status
- ✅ Next.js proxy: `GET /api/python/hello` → Proxies to Python service
- ✅ Both services start in correct order

## Deployment Ready

The application is now properly configured for VM deployment with:
- ✅ Single external port (5000 → 80)
- ✅ Python service on localhost only
- ✅ Ordered service startup
- ✅ Fast health check endpoint
- ✅ All secrets configured
