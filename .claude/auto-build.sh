#!/bin/bash
# Forge Factory Autonomous Build - Agent SDK Version
# Runs the TypeScript autonomous builder

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the autonomous builder
echo "Starting autonomous builder..."
npx tsx autonomous-builder.ts "$@"
