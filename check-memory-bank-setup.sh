#!/bin/bash

echo "🔍 MOMENTUM Memory Bank Configuration Checker"
echo "=============================================="
echo ""

# Check .env file
if [ -f .env ]; then
  echo "✅ .env file exists"
  echo ""
  
  echo "📋 Checking required environment variables..."
  echo ""
  
  # Check MOMENTUM_ENABLE_MEMORY_BANK
  if grep -q "MOMENTUM_ENABLE_MEMORY_BANK=true" .env; then
    echo "  ✅ MOMENTUM_ENABLE_MEMORY_BANK=true"
  elif grep -q "MOMENTUM_ENABLE_MEMORY_BANK" .env; then
    VALUE=$(grep "MOMENTUM_ENABLE_MEMORY_BANK" .env | cut -d'=' -f2)
    echo "  ❌ MOMENTUM_ENABLE_MEMORY_BANK=$VALUE (should be 'true')"
    echo "     Fix: Change to MOMENTUM_ENABLE_MEMORY_BANK=true"
  else
    echo "  ❌ MOMENTUM_ENABLE_MEMORY_BANK is MISSING"
    echo "     Fix: Add this line to .env:"
    echo "     MOMENTUM_ENABLE_MEMORY_BANK=true"
  fi
  
  # Check MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if grep -q "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=" .env; then
    PROJECT_ID=$(grep "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=" .env | cut -d'=' -f2)
    if [ -n "$PROJECT_ID" ]; then
      echo "  ✅ MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=$PROJECT_ID"
    else
      echo "  ❌ MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID is EMPTY"
      echo "     Fix: Set it to your Google Cloud project ID"
    fi
  else
    echo "  ❌ MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID is MISSING"
    echo "     Fix: Add this line to .env:"
    echo "     MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id"
  fi
  
  # Check MOMENTUM_AGENT_ENGINE_LOCATION
  if grep -q "MOMENTUM_AGENT_ENGINE_LOCATION=" .env; then
    LOCATION=$(grep "MOMENTUM_AGENT_ENGINE_LOCATION=" .env | cut -d'=' -f2)
    echo "  ✅ MOMENTUM_AGENT_ENGINE_LOCATION=$LOCATION"
  else
    echo "  ⚠️  MOMENTUM_AGENT_ENGINE_LOCATION not set (will default to us-central1)"
  fi
  
  # Check GOOGLE_APPLICATION_CREDENTIALS
  if grep -q "GOOGLE_APPLICATION_CREDENTIALS=" .env; then
    CRED_PATH=$(grep "GOOGLE_APPLICATION_CREDENTIALS=" .env | cut -d'=' -f2)
    echo "  ✅ GOOGLE_APPLICATION_CREDENTIALS is set"
    if [ -f "$CRED_PATH" ]; then
      echo "     ✅ Service account key file exists: $CRED_PATH"
    else
      echo "     ❌ Service account key file NOT FOUND: $CRED_PATH"
      echo "     Fix: Download service account key from Google Cloud Console"
    fi
  elif grep -q "MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON=" .env; then
    echo "  ✅ MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON is set"
  else
    echo "  ❌ No Google Cloud credentials configured"
    echo "     Fix: Add one of:"
    echo "     - GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json"
    echo "     - MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON='{...}'"
  fi
  
else
  echo "❌ .env file NOT FOUND"
  echo "   Fix: Create .env file in project root"
  echo ""
  exit 1
fi

echo ""
echo "=============================================="
echo ""

# Count issues
ISSUES=0
if ! grep -q "MOMENTUM_ENABLE_MEMORY_BANK=true" .env; then
  ISSUES=$((ISSUES + 1))
fi
if ! grep -q "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID=." .env; then
  ISSUES=$((ISSUES + 1))
fi
if ! grep -q "GOOGLE_APPLICATION_CREDENTIALS\|MOMENTUM_GOOGLE_APPLICATION_CREDENTIALS_JSON" .env; then
  ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "✅ All required environment variables are set!"
  echo ""
  echo "Next steps:"
  echo "1. Ensure Google Cloud APIs are enabled:"
  echo "   - Vertex AI API: gcloud services enable aiplatform.googleapis.com"
  echo "   - Agent Builder API: gcloud services enable agentbuilder.googleapis.com"
  echo ""
  echo "2. Restart the application to apply changes"
  echo ""
else
  echo "⚠️  Found $ISSUES issue(s) that need to be fixed"
  echo ""
  echo "Please update your .env file and restart the application"
  echo ""
fi

echo "For detailed setup instructions, see: MEMORY_BANK_SETUP_GUIDE.md"

