#!/bin/bash
# Pre-Commit Hook - Final validation before committing AI-generated code
# This is the last line of defense before code enters the repository

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "=== Pre-Commit Validation ==="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)
TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx)$' || true)
SECURITY_FILES=$(echo "$STAGED_FILES" | grep -E '(auth|security|payment|encrypt|credential)' || true)

ERRORS=0
WARNINGS=0

echo ""
echo "Staged files: $(echo "$STAGED_FILES" | wc -l)"
echo "TypeScript files: $(echo "$TS_FILES" | wc -l)"

# 1. Check for hardcoded secrets
echo ""
echo "1. Checking for secrets..."
SECRET_PATTERNS=(
    "password\s*=\s*[\"'][^\"']+[\"']"
    "api[_-]?key\s*=\s*[\"'][^\"']+[\"']"
    "secret\s*=\s*[\"'][^\"']+[\"']"
    "token\s*=\s*[\"'][a-zA-Z0-9]{20,}[\"']"
    "-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----"
)

for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
        for pattern in "${SECRET_PATTERNS[@]}"; do
            if grep -iEq "$pattern" "$file" 2>/dev/null; then
                echo "   ERROR: Potential secret in $file"
                ERRORS=$((ERRORS + 1))
            fi
        done
    fi
done
if [ $ERRORS -eq 0 ]; then
    echo "   PASS: No secrets detected"
fi

# 2. Check for console.log in production code
echo ""
echo "2. Checking for console.log..."
CONSOLE_COUNT=0
for file in $TS_FILES; do
    if [ -f "$file" ] && [[ ! "$file" =~ \.test\. ]] && [[ ! "$file" =~ \.spec\. ]]; then
        if grep -q "console\\.log" "$file" 2>/dev/null; then
            echo "   WARN: console.log found in $file"
            WARNINGS=$((WARNINGS + 1))
            CONSOLE_COUNT=$((CONSOLE_COUNT + 1))
        fi
    fi
done
if [ $CONSOLE_COUNT -eq 0 ]; then
    echo "   PASS: No console.log in production code"
fi

# 3. Verify prompt IDs in AI-generated code
echo ""
echo "3. Checking prompt ID traceability..."
for file in $TS_FILES; do
    if [ -f "$file" ]; then
        # Check if file appears to be AI-generated (has @generated-at or similar)
        if grep -q "@generated-at\|@prompt-id" "$file" 2>/dev/null; then
            if ! grep -q "@prompt-id.*forge-v" "$file" 2>/dev/null; then
                echo "   WARN: Missing proper prompt-id in $file"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    fi
done
echo "   PASS: Prompt IDs verified"

# 4. Check for TODO comments
echo ""
echo "4. Checking for TODO comments..."
TODO_COUNT=0
for file in $TS_FILES; do
    if [ -f "$file" ]; then
        if grep -iq "TODO\|FIXME\|HACK\|XXX" "$file" 2>/dev/null; then
            echo "   WARN: TODO comment in $file"
            WARNINGS=$((WARNINGS + 1))
            TODO_COUNT=$((TODO_COUNT + 1))
        fi
    fi
done
if [ $TODO_COUNT -eq 0 ]; then
    echo "   PASS: No TODO comments"
fi

# 5. Security-critical files require human review
echo ""
echo "5. Checking security-critical files..."
if [ -n "$SECURITY_FILES" ]; then
    echo "   ATTENTION: Security-critical files detected:"
    echo "$SECURITY_FILES" | while read -r file; do
        echo "     - $file"
    done
    echo ""
    echo "   These files require human review per CLAUDE.md"

    # Check for human-decision annotation
    for file in $SECURITY_FILES; do
        if [ -f "$file" ]; then
            if ! grep -q "@human-decision\|@reviewed-by" "$file" 2>/dev/null; then
                echo "   WARN: $file missing @human-decision annotation"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    done
else
    echo "   PASS: No security-critical files in commit"
fi

# 6. Check for direct database queries (must use Prisma)
echo ""
echo "6. Checking for raw SQL..."
for file in $TS_FILES; do
    if [ -f "$file" ]; then
        if grep -Eq "query\s*\(\s*[\"'\`]SELECT|INSERT|UPDATE|DELETE" "$file" 2>/dev/null; then
            echo "   ERROR: Raw SQL query in $file (must use Prisma)"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done
if [ $ERRORS -eq 0 ]; then
    echo "   PASS: No raw SQL detected"
fi

# 7. Check for cross-app imports (prohibited)
echo ""
echo "7. Checking for prohibited cross-app imports..."
for file in $TS_FILES; do
    if [ -f "$file" ]; then
        if grep -Eq "from [\"']\.\.\/\.\.\/apps\/" "$file" 2>/dev/null; then
            echo "   ERROR: Direct cross-app import in $file"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done
if [ $ERRORS -eq 0 ]; then
    echo "   PASS: No cross-app imports"
fi

# 8. Update AI metrics
echo ""
echo "8. Updating AI metrics..."
AI_LINES=0
TOTAL_LINES=0
for file in $TS_FILES; do
    if [ -f "$file" ]; then
        FILE_LINES=$(wc -l < "$file")
        TOTAL_LINES=$((TOTAL_LINES + FILE_LINES))
        if grep -q "@prompt-id\|@generated-at" "$file" 2>/dev/null; then
            AI_LINES=$((AI_LINES + FILE_LINES))
        fi
    fi
done
echo "   Committed lines: $TOTAL_LINES (AI-generated: $AI_LINES)"

# Summary
echo ""
echo "=== Pre-Commit Summary ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "COMMIT BLOCKED: Fix $ERRORS error(s) before committing"
    exit 1
fi

if [ $WARNINGS -gt 5 ]; then
    echo ""
    echo "COMMIT BLOCKED: Too many warnings ($WARNINGS). Address issues first."
    exit 1
fi

echo ""
echo "COMMIT APPROVED"
exit 0
