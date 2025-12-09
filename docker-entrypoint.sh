#!/bin/bash
# =============================================================================
# Docker Entrypoint Script for MOMENTUM
# =============================================================================
# Starts both Next.js and Python FastAPI services for Cloud Run
# =============================================================================

# Don't exit on error immediately - we need to handle errors ourselves
# set -e

# Enable job control
set -m

# Load .env file if it exists (for runtime environment variables)
# This mimics local development behavior where Next.js reads .env automatically
# Note: NEXT_PUBLIC_* variables are embedded at build time, but other vars load at runtime
if [ -f .env ]; then
    echo "Loading environment variables from .env file (like local dev)..."
    # Export variables from .env file, ignoring comments and empty lines
    # This makes them available to Node.js process.env
    set -a
    source .env
    set +a
    echo "✓ Environment variables loaded from .env file"
    echo "  (Next.js will also read .env automatically at startup)"
else
    echo "⚠ No .env file found, using environment variables from Cloud Run/container only"
fi

# Get port from environment (Cloud Run sets PORT, default to 8080)
PORT=${PORT:-8080}
PYTHON_PORT=8000

echo "=== MOMENTUM Cloud Run Startup ==="
echo "Starting services on port ${PORT}..."

# Function to handle shutdown gracefully
cleanup() {
    echo ""
    echo "Received shutdown signal, gracefully stopping services..."
    kill $NEXT_PID 2>/dev/null || true
    kill $PYTHON_PID 2>/dev/null || true
    wait $NEXT_PID 2>/dev/null || true
    wait $PYTHON_PID 2>/dev/null || true
    echo "Services stopped."
    exit 0
}

# Trap SIGTERM and SIGINT for graceful shutdown (Cloud Run sends SIGTERM)
trap cleanup SIGTERM SIGINT

# Start Python FastAPI service in background
echo "[1/2] Starting Python FastAPI service on port ${PYTHON_PORT}..."
cd python_service
python main.py > /tmp/python.log 2>&1 &
PYTHON_PID=$!
cd ..
echo "Python service started (PID: $PYTHON_PID)"

# Wait for Python service to be ready
echo "Waiting for Python service to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:${PYTHON_PORT}/hello > /dev/null 2>&1; then
        echo "✓ Python service is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠ Warning: Python service may not have started, but continuing..."
        break
    fi
    sleep 1
done

# Start Next.js in production mode
echo "[2/2] Starting Next.js server on port ${PORT}..."
echo "Current directory: $(pwd)"
echo "Checking for .next directory..."
if [ ! -d ".next" ]; then
    echo "ERROR: .next directory not found! Build may have failed."
    ls -la /app | head -20
    exit 1
fi

# Ensure we're in the app directory
cd /app

# Verify node and next are available
echo "Checking Node.js version:"
node --version || echo "ERROR: node not found"
echo "Checking Next.js installation:"
if command -v next >/dev/null 2>&1; then
    echo "✓ next command found in PATH"
    NEXT_CMD="next"
elif [ -f "node_modules/.bin/next" ]; then
    echo "✓ next found in node_modules/.bin"
    NEXT_CMD="node_modules/.bin/next"
else
    echo "⚠ next not found, trying npx"
    NEXT_CMD="npx next"
fi

# Use NODE_ENV=production and start Next.js
# Export PORT so Next.js can use it
export NODE_ENV=production
export PORT=${PORT}

# Verify environment
echo "Environment check:"
echo "  NODE_ENV=${NODE_ENV}"
echo "  PORT=${PORT}"
echo "  PWD=$(pwd)"
echo "  Next.js command: ${NEXT_CMD}"

# Start Next.js and capture both stdout and stderr
echo "Starting Next.js with: ${NEXT_CMD} start -p ${PORT} -H 0.0.0.0"
${NEXT_CMD} start -p ${PORT} -H 0.0.0.0 > /tmp/nextjs.log 2>&1 &
NEXT_PID=$!
echo "Next.js started (PID: $NEXT_PID)"

# Immediately check if process exists
sleep 1
if ! kill -0 $NEXT_PID 2>/dev/null; then
    echo "ERROR: Next.js process died immediately after start!"
    echo "Exit code check: wait $NEXT_PID 2>&1 || true"
    echo "Next.js log contents:"
    cat /tmp/nextjs.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Give Next.js a moment to start
sleep 2

# Check if process is still running
if ! kill -0 $NEXT_PID 2>/dev/null; then
    echo "ERROR: Next.js process died immediately!"
    echo "Next.js log contents:"
    cat /tmp/nextjs.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Wait for Next.js to be ready
echo "Waiting for Next.js to be ready..."
for i in {1..60}; do
    # Check if process is still running
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        echo "ERROR: Next.js process died during startup!"
        echo "Next.js log contents:"
        cat /tmp/nextjs.log 2>/dev/null || echo "No log file found"
        exit 1
    fi
    
    # Check if port is listening
    if curl -s http://localhost:${PORT} > /dev/null 2>&1; then
        echo "✓ Next.js is ready!"
        break
    fi
    
    if [ $i -eq 60 ]; then
        echo "⚠ Warning: Next.js may not have started properly after 60 seconds"
        echo "Next.js log contents:"
        tail -50 /tmp/nextjs.log 2>/dev/null || echo "No log file found"
        # Don't exit - let it continue and see if it works
        break
    fi
    sleep 1
done

echo ""
echo "=== All services started ==="
echo "Next.js: http://0.0.0.0:${PORT}"
echo "Python FastAPI: http://127.0.0.1:${PYTHON_PORT} (internal)"
echo ""

# Function to check if a process is still running
check_process() {
    local pid=$1
    local name=$2
    if ! kill -0 $pid 2>/dev/null; then
        echo "ERROR: $name process (PID: $pid) has stopped!"
        echo "Last 50 lines of log:"
        tail -50 /tmp/${name,,}.log 2>/dev/null || echo "No log file found"
        return 1
    fi
    return 0
}

# Keep the container alive and monitor both processes
echo "Monitoring services..."
while true; do
    # Check if processes are still running
    if ! check_process $NEXT_PID "Next.js"; then
        echo "Next.js service failed. Exiting..."
        kill $PYTHON_PID 2>/dev/null || true
        exit 1
    fi
    
    if ! check_process $PYTHON_PID "Python"; then
        echo "Python service failed. Exiting..."
        kill $NEXT_PID 2>/dev/null || true
        exit 1
    fi
    
    # Check if Next.js is listening on the port
    if ! netstat -tuln 2>/dev/null | grep -q ":${PORT} " && ! ss -tuln 2>/dev/null | grep -q ":${PORT} "; then
        echo "WARNING: Next.js is not listening on port ${PORT} yet..."
    fi
    
    sleep 5
done

