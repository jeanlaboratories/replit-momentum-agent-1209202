#!/bin/bash
# =============================================================================
# Quick Docker Build and Test Script
# =============================================================================
# This script helps test the Docker build locally before deploying to Cloud Run
# =============================================================================

set -e

echo "=== MOMENTUM Docker Build Test ==="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠ Warning: .env file not found. Some features may not work."
    echo "   Create .env file from env.template before testing."
    echo ""
fi

# Build the Docker image
echo "[1/3] Building Docker image..."
docker build -t momentum:test .

if [ $? -eq 0 ]; then
    echo "✓ Docker image built successfully!"
else
    echo "✗ Docker build failed!"
    exit 1
fi

echo ""
echo "[2/3] Testing Docker image (dry run)..."
echo "   Image: momentum:test"
echo "   Size: $(docker images momentum:test --format '{{.Size}}')"
echo ""

# Check if user wants to run the container
read -p "Do you want to run the container locally? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "[3/3] Starting container..."
    echo "   Next.js will be available at: http://localhost:8080"
    echo "   Python service will be available at: http://localhost:8000"
    echo ""
    echo "   Press Ctrl+C to stop"
    echo ""
    
    # Run the container
    docker run -p 8080:8080 \
        --env-file .env \
        -e PORT=8080 \
        momentum:test
else
    echo ""
    echo "✓ Build test complete!"
    echo ""
    echo "To run the container manually:"
    echo "  docker run -p 8080:8080 --env-file .env -e PORT=8080 momentum:test"
    echo ""
    echo "To deploy to Cloud Run:"
    echo "  gcloud run deploy momentum --source . --region us-central1"
    echo ""
fi

