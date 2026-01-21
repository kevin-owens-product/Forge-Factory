#!/bin/bash
# Pre-Generation Hook - Validates context before code generation
# Runs before any autonomous code generation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Arguments
TARGET_TYPE="${1:-}"  # feature, package, test, etc.
TARGET_NAME="${2:-}"
ADR_REF="${3:-}"

echo "=== Pre-Generation Validation ==="
echo "Type: $TARGET_TYPE"
echo "Name: $TARGET_NAME"
echo "ADR: $ADR_REF"

# Validate ADR reference if provided
if [ -n "$ADR_REF" ]; then
    ADR_FILE="tools/adrs/${ADR_REF}.md"
    if [ ! -f "$ADR_FILE" ]; then
        # Try with different patterns
        ADR_FILE=$(find tools/adrs -name "*${ADR_REF}*" -type f | head -1)
    fi

    if [ -z "$ADR_FILE" ] || [ ! -f "$ADR_FILE" ]; then
        echo "ERROR: ADR reference not found: $ADR_REF"
        echo "Available ADRs:"
        ls tools/adrs/*.md 2>/dev/null | head -10
        exit 1
    fi
    echo "ADR validated: $ADR_FILE"
fi

# Check for existing target
case "$TARGET_TYPE" in
    "package")
        if [ -d "packages/$TARGET_NAME" ]; then
            echo "WARNING: Package already exists: packages/$TARGET_NAME"
        fi
        ;;
    "feature")
        if [ -d "apps/$TARGET_NAME" ] || [ -d "packages/$TARGET_NAME" ]; then
            echo "WARNING: Feature may already exist"
        fi
        ;;
esac

# Validate project state
echo ""
echo "Project State Checks:"

# Check git status
if git status --porcelain | grep -q .; then
    echo "  - Git: Uncommitted changes present"
else
    echo "  - Git: Clean working directory"
fi

# Check dependencies
if [ -f "pnpm-lock.yaml" ]; then
    echo "  - Dependencies: Lock file present"
else
    echo "  - Dependencies: No lock file (run pnpm install)"
fi

# Check TypeScript config
if [ -f "tsconfig.base.json" ]; then
    echo "  - TypeScript: Base config found"
fi

echo ""
echo "=== Pre-Generation Complete ==="
