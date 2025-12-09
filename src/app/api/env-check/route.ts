import { NextResponse } from 'next/server';

/**
 * API route to verify environment variables are loaded correctly
 * This helps debug environment variable loading issues
 */
export async function GET() {
  const envCheck = {
    // Server-side variables (should be available)
    server: {
      MOMENTUM_GOOGLE_API_KEY: process.env.MOMENTUM_GOOGLE_API_KEY ? '✓ Set' : '✗ Missing',
      MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON ? '✓ Set' : '✗ Missing',
      MOMENTUM_FIRECRAWL_API_KEY: process.env.MOMENTUM_FIRECRAWL_API_KEY ? '✓ Set' : '✗ Missing',
    },
    // Client-side variables (from next.config.ts mapping)
    client: {
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✓ Set' : '✗ Missing',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✓ Set' : '✗ Missing',
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✓ Set' : '✗ Missing',
    },
    // Raw MOMENTUM_ variables (before mapping)
    raw: {
      MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY: process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing',
      MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing',
      MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing',
    },
  };

  return NextResponse.json(envCheck, { status: 200 });
}

