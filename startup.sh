#!/bin/bash

echo "=== Zen Notes Startup Script ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Current directory: $(pwd)"

# If a standalone build is present, prefer running it directly
if [ -f ".next/standalone/server.js" ]; then
    echo "Detected standalone build. Starting server..."
    cd .next/standalone && exec node server.js
fi

echo "No standalone build detected. Installing and building..."

# Install dependencies (including dev) to allow building on the server
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci --production=false
else
    echo "node_modules exists, skipping install"
fi

# Build the application
echo "Building application..."
npm run build

if [ -f ".next/standalone/server.js" ]; then
    echo "Build complete. Starting standalone server..."
    cd .next/standalone && exec node server.js
else
    echo "ERROR: Standalone server not found after build (.next/standalone/server.js)."
    echo "Please ensure next.config.mjs has output: 'standalone'."
    exit 1
fi
