#!/bin/bash
# Forge Factory Autonomous Build - Simple & Reliable
# Runs Claude sessions sequentially with timeout protection

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.claude/logs"
MAX_SESSIONS=${1:-50}
TIMEOUT_MINUTES=10

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

echo "=============================================="
echo "  🏭 Forge Factory Autonomous Build"
echo "=============================================="
echo "Project: $PROJECT_ROOT"
echo "Max Sessions: $MAX_SESSIONS"
echo "Timeout: $TIMEOUT_MINUTES minutes per session"
echo "Started: $(date)"
echo "=============================================="

# Check if build complete
is_complete() {
    grep -q '^\*\*Status:\*\* BUILD COMPLETE' .claude/NEXT_TASK.md 2>/dev/null
}

# Get current task
get_task() {
    grep -A1 "## Current Task" .claude/NEXT_TASK.md 2>/dev/null | tail -1 | sed 's/\*//g'
}

# Main loop
for ((session=1; session<=MAX_SESSIONS; session++)); do

    # Check if done
    if is_complete; then
        echo ""
        echo "=============================================="
        echo "  ✅ BUILD COMPLETE!"
        echo "=============================================="
        echo "Finished: $(date)"
        exit 0
    fi

    TASK=$(get_task)
    LOG_FILE="$LOG_DIR/session-$(printf '%03d' $session)-$(date +%Y%m%d-%H%M%S).log"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Session $session of $MAX_SESSIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  📋 Task: $TASK"
    echo "  📁 Log: $LOG_FILE"
    echo "  🕐 Started: $(date +%H:%M:%S)"
    echo ""

    PROMPT="Autonomous build session. Read .claude/NEXT_TASK.md and complete the current task: build the package, add tests (80%+ coverage), run quality checks, commit, push. Then update NEXT_TASK.md with the next task from the queue. Stay focused on ONE task only."

    # Run with timeout - foreground, no background tricks
    echo "  🔨 Building..."
    if timeout ${TIMEOUT_MINUTES}m claude -p "$PROMPT" > "$LOG_FILE" 2>&1; then
        echo "  ✅ Session completed"
        echo ""
        echo "  📋 Summary (last 15 lines):"
        echo "  ─────────────────────────────────────"
        tail -15 "$LOG_FILE" | sed 's/^/  /'
        echo "  ─────────────────────────────────────"
    else
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            echo "  ⏰ Session timed out after $TIMEOUT_MINUTES minutes"
        else
            echo "  ❌ Session failed (exit code: $EXIT_CODE)"
        fi
        echo "  Check log: $LOG_FILE"
        echo ""
        echo "  Waiting 10 seconds before retry..."
        sleep 10
    fi

    # Pull any changes from other sessions
    git pull --rebase 2>/dev/null || true

    # Brief pause between sessions
    sleep 3
done

echo ""
echo "=============================================="
echo "  ⚠️  Max sessions reached ($MAX_SESSIONS)"
echo "=============================================="
echo "Run again to continue: ./.claude/auto-build.sh"
