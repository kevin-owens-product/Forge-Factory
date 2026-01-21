#!/bin/bash
# Post-Generation Hook - Validates generated code quality
# Runs after any autonomous code generation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Arguments
TARGET_PATH="${1:-}"
SKIP_TESTS="${2:-false}"

echo "=== Post-Generation Quality Gates ==="
echo "Target: $TARGET_PATH"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

FAILED=0

# 1. TypeScript Compilation Check
echo ""
echo "1. TypeScript Compilation..."
if pnpm tsc --noEmit 2>/dev/null; then
    echo "   PASS: TypeScript compilation successful"
else
    echo "   FAIL: TypeScript compilation errors"
    FAILED=$((FAILED + 1))
fi

# 2. ESLint Check
echo ""
echo "2. ESLint Validation..."
if [ -n "$TARGET_PATH" ] && [ -e "$TARGET_PATH" ]; then
    if pnpm eslint "$TARGET_PATH" --max-warnings 0 2>/dev/null; then
        echo "   PASS: ESLint passed"
    else
        echo "   FAIL: ESLint errors found"
        FAILED=$((FAILED + 1))
    fi
else
    if pnpm lint 2>/dev/null; then
        echo "   PASS: ESLint passed"
    else
        echo "   FAIL: ESLint errors found"
        FAILED=$((FAILED + 1))
    fi
fi

# 3. Prettier Check
echo ""
echo "3. Prettier Formatting..."
if pnpm prettier --check "**/*.{ts,tsx,js,jsx,json}" 2>/dev/null; then
    echo "   PASS: Formatting correct"
else
    echo "   INFO: Running auto-format..."
    pnpm prettier --write "**/*.{ts,tsx,js,jsx,json}" 2>/dev/null || true
fi

# 4. Circular Dependency Check
echo ""
echo "4. Circular Dependencies..."
if command -v madge &> /dev/null || [ -f "node_modules/.bin/madge" ]; then
    if pnpm check:circular 2>/dev/null; then
        echo "   PASS: No circular dependencies"
    else
        echo "   FAIL: Circular dependencies detected"
        FAILED=$((FAILED + 1))
    fi
else
    echo "   SKIP: madge not available"
fi

# 5. Test Execution (if not skipped)
if [ "$SKIP_TESTS" != "true" ]; then
    echo ""
    echo "5. Test Execution..."
    if [ -n "$TARGET_PATH" ]; then
        TEST_PATH="${TARGET_PATH%.ts}.test.ts"
        if [ -f "$TEST_PATH" ]; then
            if pnpm vitest run "$TEST_PATH" 2>/dev/null; then
                echo "   PASS: Tests passed"
            else
                echo "   FAIL: Tests failed"
                FAILED=$((FAILED + 1))
            fi
        else
            echo "   WARN: No test file found at $TEST_PATH"
        fi
    else
        if pnpm test 2>/dev/null; then
            echo "   PASS: All tests passed"
        else
            echo "   FAIL: Tests failed"
            FAILED=$((FAILED + 1))
        fi
    fi
else
    echo ""
    echo "5. Test Execution... SKIPPED"
fi

# 6. Security Scan
echo ""
echo "6. Security Scan..."
if command -v semgrep &> /dev/null; then
    if [ -n "$TARGET_PATH" ] && [ -e "$TARGET_PATH" ]; then
        if semgrep --config auto "$TARGET_PATH" --quiet 2>/dev/null; then
            echo "   PASS: No security issues"
        else
            echo "   WARN: Security scan found issues"
        fi
    else
        echo "   SKIP: Full scan deferred to CI"
    fi
else
    echo "   SKIP: semgrep not available"
fi

# 7. Prompt ID Verification
echo ""
echo "7. Prompt ID Traceability..."
if [ -n "$TARGET_PATH" ] && [ -f "$TARGET_PATH" ]; then
    if grep -q "@prompt-id" "$TARGET_PATH"; then
        PROMPT_ID=$(grep "@prompt-id" "$TARGET_PATH" | head -1)
        echo "   PASS: Prompt ID found - $PROMPT_ID"
    else
        echo "   WARN: No @prompt-id annotation"
    fi
else
    echo "   SKIP: No specific file to check"
fi

# Summary
echo ""
echo "=== Quality Gate Summary ==="
if [ $FAILED -eq 0 ]; then
    echo "STATUS: ALL GATES PASSED"
    exit 0
else
    echo "STATUS: $FAILED GATE(S) FAILED"
    echo "Please fix issues before committing"
    exit 1
fi
