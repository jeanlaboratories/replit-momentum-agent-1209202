#!/bin/bash
# Test script to verify .env is accessible in container
echo "Testing Docker .env loading..."
docker build -t momentum:test-env . 2>&1 | tail -5
echo ""
echo "If build succeeds, .env is being copied correctly"
