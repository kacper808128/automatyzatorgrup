#!/bin/bash

echo "🚀 Facebook Group Automation - Starting..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (first time only)..."
    echo "This may take a few minutes ☕"
    npm install
    echo ""
fi

# Start the application
echo "✨ Launching application..."
npm start
