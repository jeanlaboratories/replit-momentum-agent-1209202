#!/bin/bash
# Test script to verify environment variables during build
echo "Testing environment variables..."
echo "MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY: ${MOMENTUM_NEXT_PUBLIC_FIREBASE_API_KEY:0:20}..."
echo "NEXT_PUBLIC_FIREBASE_API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY:0:20}..."
