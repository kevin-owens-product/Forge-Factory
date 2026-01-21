#!/bin/bash
# Session Start Hook - Initializes autonomous development environment
# This hook runs when a new Claude Code session begins

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Forge Factory: Autonomous Development Session Starting ==="
echo "Project Root: $PROJECT_ROOT"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Ensure we're in the project root
cd "$PROJECT_ROOT"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "Node.js: $NODE_VERSION"
    if [[ ! "$NODE_VERSION" =~ ^v22 ]]; then
        echo "WARNING: Node.js 22+ required, found $NODE_VERSION"
    fi
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo "pnpm: $PNPM_VERSION"
else
    echo "WARNING: pnpm not installed"
fi

# Verify dependencies are installed
if [ -d "node_modules" ]; then
    echo "Dependencies: Installed"
else
    echo "Dependencies: Not installed - run 'pnpm install'"
fi

# Load ADR index
if [ -f ".claude/adr-index.json" ]; then
    ADR_COUNT=$(grep -o '"id":' .claude/adr-index.json | wc -l)
    echo "ADRs indexed: $ADR_COUNT"
fi

# Check AI metrics
if [ -f ".ai-metrics.json" ]; then
    AI_RATIO=$(grep '"ratio"' .ai-metrics.json | grep -oP '[\d.]+' | head -1)
    echo "AI Generation Ratio: ${AI_RATIO:-unknown}"
fi

# Report package status
PACKAGE_COUNT=$(find packages -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "Packages: $((PACKAGE_COUNT - 1)) implemented"

# Report app status
APP_COUNT=$(find apps -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "Apps: $((APP_COUNT - 1)) implemented"

echo ""
echo "=== Autonomous Skills Available ==="
echo "  /build-feature     - Generate complete vertical slice from ADR"
echo "  /build-package     - Generate new @forge package"
echo "  /run-quality-gates - Execute all quality checks"
echo "  /generate-tests    - Generate tests for component"
echo "  /adr-status        - Show ADR implementation status"
echo "  /next-priority     - Suggest next P0 item to build"
echo ""
echo "=== Session Ready ==="
