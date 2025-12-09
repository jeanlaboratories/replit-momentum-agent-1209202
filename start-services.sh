#!/bin/bash

# Production startup script for VM deployment
# Starts both Python FastAPI and Next.js services

set -e  # Exit on error

echo "=== AdVantage Production Startup ==="
echo "Starting services for VM deployment..."

# Start Python service in the background
echo ""
echo "[1/2] Starting Python FastAPI service..."
(cd python_service && python main.py) &
PYTHON_PID=$!
echo "Python service started (PID: $PYTHON_PID)"

# Wait for Python service to be ready on localhost
echo "Waiting for Python service to be ready on localhost:8000..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:8000/hello > /dev/null 2>&1; then
    echo "✓ Python service is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠ Warning: Python service may not have started, but continuing with Next.js..."
    break
  fi
  sleep 1
done

# Start Next.js in production mode
echo ""
echo "[2/2] Starting Next.js server..."
# Use PORT environment variable if set (for deployment), otherwise default to 5000
npm run start:next &
NEXT_PID=$!
echo "Next.js started (PID: $NEXT_PID)"

echo ""
echo "=== All services started ==="
echo "Python FastAPI: http://127.0.0.1:8000 (internal only)"
echo "Next.js: http://0.0.0.0:${PORT:-5000} (external)"
echo ""

# Function to handle shutdown
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $PYTHON_PID 2>/dev/null || true
    kill $NEXT_PID 2>/dev/null || true
    exit 0
}

# Trap SIGTERM and SIGINT for graceful shutdown
trap cleanup SIGTERM SIGINT

# Wait for both processes
wait $PYTHON_PID $NEXT_PID
