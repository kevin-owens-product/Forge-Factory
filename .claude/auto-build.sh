#!/bin/bash
# Forge Factory Autonomous Build Loop
# Kicks off sequential Claude sessions to build the entire platform
#
# Usage: ./auto-build.sh [--max-sessions N] [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.claude/logs"
MAX_SESSIONS=50
DRY_RUN=false
SESSION_COUNT=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --max-sessions)
            MAX_SESSIONS="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Setup
mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

echo "=============================================="
echo "  Forge Factory Autonomous Build"
echo "=============================================="
echo "Project: $PROJECT_ROOT"
echo "Max Sessions: $MAX_SESSIONS"
echo "Dry Run: $DRY_RUN"
echo "Started: $(date)"
echo "=============================================="
echo ""

# Function to check if build is complete
is_build_complete() {
    if [ -f ".claude/build-state.json" ]; then
        local status=$(grep -o '"status": *"[^"]*"' .claude/build-state.json | head -1 | cut -d'"' -f4)
        if [ "$status" = "completed" ]; then
            return 0
        fi
    fi

    # Check NEXT_TASK.md Status line for BUILD COMPLETE
    if [ -f ".claude/NEXT_TASK.md" ]; then
        if grep -q '^\*\*Status:\*\* BUILD COMPLETE' .claude/NEXT_TASK.md; then
            return 0
        fi
    fi

    return 1
}

# Function to run a single Claude session
run_session() {
    local session_num=$1
    local log_file="$LOG_DIR/session-$(printf '%03d' $session_num)-$(date +%Y%m%d-%H%M%S).log"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Session $session_num"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Log: $log_file"
    echo "Time: $(date)"

    # Read current task for display
    if [ -f ".claude/NEXT_TASK.md" ]; then
        local current_task=$(grep -A1 "## Current Task" .claude/NEXT_TASK.md | tail -1)
        echo "Task: $current_task"
    fi
    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo "[DRY RUN] Would execute Claude session"
        return 0
    fi

    # The prompt for Claude (kept short to avoid arg length limits)
    local prompt="Autonomous build session. Read .claude/NEXT_TASK.md and complete the current task: build the package, add tests (80%+ coverage), run quality checks, commit, push. Then update NEXT_TASK.md with the next task from the queue. Stay focused on ONE task only."

    # Run Claude with the prompt as argument
    # Using --permission-mode bypassPermissions for automation
    claude -p "$prompt" --permission-mode bypassPermissions 2>&1 | tee "$log_file"

    local exit_code=${PIPESTATUS[0]}

    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "WARNING: Session exited with code $exit_code"
        echo "Check log: $log_file"
    fi

    # Give a moment for git operations to complete
    sleep 2

    # Pull any changes (in case of race conditions)
    git pull --rebase 2>/dev/null || true

    return $exit_code
}

# Main loop
echo "Starting autonomous build loop..."
echo ""

while [ $SESSION_COUNT -lt $MAX_SESSIONS ]; do
    SESSION_COUNT=$((SESSION_COUNT + 1))

    # Check if build is complete
    if is_build_complete; then
        echo ""
        echo "=============================================="
        echo "  BUILD COMPLETE!"
        echo "=============================================="
        echo "Total Sessions: $((SESSION_COUNT - 1))"
        echo "Finished: $(date)"
        echo "=============================================="
        exit 0
    fi

    # Run session
    run_session $SESSION_COUNT

    # Brief pause between sessions
    echo ""
    echo "Session $SESSION_COUNT complete. Pausing 5 seconds..."
    sleep 5
done

echo ""
echo "=============================================="
echo "  MAX SESSIONS REACHED"
echo "=============================================="
echo "Completed $SESSION_COUNT sessions"
echo "Build may not be complete - check .claude/NEXT_TASK.md"
echo "Resume with: ./auto-build.sh"
echo "=============================================="
