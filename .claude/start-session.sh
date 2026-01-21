#!/bin/bash
# Quick session starter - reads state and outputs focused instructions
# Usage: ./start-session.sh

set -e
cd "$(dirname "$0")/.."

echo "=== Forge Factory: Session Quick Start ==="
echo ""

# Read build state
if [ -f ".claude/build-state.json" ]; then
    CURRENT_PHASE=$(grep -o '"currentPhase": *"[^"]*"' .claude/build-state.json | cut -d'"' -f4)
    STATUS=$(grep -o '"status": *"[^"]*"' .claude/build-state.json | head -1 | cut -d'"' -f4)
else
    STATUS="not-started"
fi

# Count existing packages
EXISTING_PACKAGES=$(ls -d packages/*/ 2>/dev/null | wc -l)

echo "Current Status: $STATUS"
echo "Packages Built: $EXISTING_PACKAGES"
echo ""

# Determine next task based on what exists
if [ ! -d "packages/database" ]; then
    echo "=== YOUR TASK THIS SESSION ==="
    echo ""
    echo "Build @forge/database package:"
    echo ""
    echo "Create packages/database/ with:"
    echo "  - Connection pooling (ADR-009)"
    echo "  - PgBouncer integration"
    echo "  - Health checks"
    echo "  - Tenant-aware connections"
    echo ""
    echo "Files to create:"
    echo "  packages/database/src/index.ts"
    echo "  packages/database/src/database.service.ts"
    echo "  packages/database/src/database.types.ts"
    echo "  packages/database/src/pool.ts"
    echo "  packages/database/__tests__/database.service.test.ts"
    echo "  packages/database/package.json"
    echo "  packages/database/tsconfig.json"
    echo ""
    echo "When done: git commit and update .claude/build-state.json"

elif [ ! -d "packages/cache" ]; then
    echo "=== YOUR TASK THIS SESSION ==="
    echo ""
    echo "Build @forge/cache package (Redis wrapper)"

elif [ ! -d "packages/queue" ]; then
    echo "=== YOUR TASK THIS SESSION ==="
    echo ""
    echo "Build @forge/queue package (BullMQ wrapper)"

elif [ ! -d "packages/auth" ]; then
    echo "=== YOUR TASK THIS SESSION ==="
    echo ""
    echo "Build @forge/auth package (ADR-026)"

elif [ ! -d "packages/design-system" ]; then
    echo "=== YOUR TASK THIS SESSION ==="
    echo ""
    echo "Build @forge/design-system package (ADR-010)"

else
    echo "=== YOUR TASK THIS SESSION ==="
    echo ""
    echo "Check .claude/build-state.json for next incomplete task"
    echo "Or run: /adr-status to see what ADRs need implementation"
fi

echo ""
echo "=== CONTEXT-SAVING TIPS ==="
echo "1. Focus on ONE package/feature per session"
echo "2. Commit frequently"
echo "3. Update .claude/build-state.json when done"
echo "4. End session after completing the task"
