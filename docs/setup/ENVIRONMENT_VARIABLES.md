# Environment Variables

All environment variables in this project use the `MOMENTUM_` prefix for Replit Secrets.

## Required Environment Variables

### Firebase Client Configuration (Browser)
These are mapped in `next.config.ts` to make them available in the browser:

- `MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID

### Server-side Configuration

- `MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON` - Firebase admin service account JSON
- `MOMENTUM_GOOGLE_API_KEY` - Google API key for AI features
- `MOMENTUM_FIRECRAWL_API_KEY` - Firecrawl API key for website crawling

## How It Works

1. **Browser Environment Variables**: Next.js requires client-side variables to start with `NEXT_PUBLIC_`. We map `MOMENTUM_NEXT_PUBLIC_*` to `NEXT_PUBLIC_*` in `next.config.ts`.

2. **Server Environment Variables**: These are used directly in server-side code (API routes, server actions, etc.).

## Files Updated

### Environment Variable Mapping
- `next.config.ts` - Maps MOMENTUM_ variables to NEXT_PUBLIC_ for browser access

### Firebase Configuration
- `src/lib/firebase.ts` - Client-side Firebase initialization
- `src/lib/firebase/admin.ts` - Server-side Firebase admin

### Firecrawl Integration
- `src/lib/firecrawl-service.ts` - Firecrawl service for website crawling
- `src/lib/brand-soul/workers/extraction-worker.ts` - Brand Soul document extraction
- `src/app/api/brand-soul/ingest/website/route.ts` - Website ingestion API

### Python Service
- `python_service/marketing_agent.py` - Python-based marketing agent
