#!/bin/bash
# Script to populate build-env.yaml from Secret Manager
# This allows us to use --build-env-vars-file with gcloud run deploy

PROJECT_ID="momentum-fa852"

echo "# Build-time environment variables for Next.js NEXT_PUBLIC_* variables" > build-env.yaml
echo "# These are embedded into the client bundle at build time" >> build-env.yaml
echo "" >> build-env.yaml

# Fetch each secret and add to build-env.yaml
for secret in MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY MOMENTUM_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET MOMENTUM_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID MOMENTUM_NEXT_PUBLIC_FIREBASE_APP_ID; do
  # Map MOMENTUM_NEXT_PUBLIC_* to NEXT_PUBLIC_*
  NEXT_PUBLIC_NAME=$(echo $secret | sed 's/MOMENTUM_//')
  VALUE=$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT_ID" 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$VALUE" ]; then
    echo "$NEXT_PUBLIC_NAME: \"$VALUE\"" >> build-env.yaml
    echo "✓ Fetched $NEXT_PUBLIC_NAME"
  else
    echo "# $NEXT_PUBLIC_NAME: (secret not found or empty)" >> build-env.yaml
    echo "✗ Failed to fetch $NEXT_PUBLIC_NAME"
  fi
done

echo ""
echo "build-env.yaml created. You can now use:"
echo "  gcloud run deploy momentum --source . --build-env-vars-file=build-env.yaml"
