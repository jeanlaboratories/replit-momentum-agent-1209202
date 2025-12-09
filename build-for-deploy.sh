#!/bin/bash
# Build script for Replit deployment
# Ensures NEXT_PUBLIC_* environment variables are available at build time

set -e

echo "=== Loading build environment variables ==="

# Source the build.env file to get NEXT_PUBLIC_* variables
if [ -f "build.env" ]; then
  echo "Loading from build.env..."
  set -a
  source build.env
  set +a
  echo "Loaded NEXT_PUBLIC_FIREBASE_PROJECT_ID: $NEXT_PUBLIC_FIREBASE_PROJECT_ID"
fi

echo ""
echo "=== Running Next.js build ==="
npx next build

echo ""
echo "=== Build complete ==="
