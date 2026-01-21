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

    # Also check NEXT_TASK.md for completion marker
    if [ -f ".claude/NEXT_TASK.md" ]; then
        if grep -q "BUILD COMPLETE" .claude/NEXT_TASK.md; then
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

    # The prompt for Claude
    local prompt="You are in an autonomous build session for Forge Factory.

READ .claude/NEXT_TASK.md to see your current task.

EXECUTE the task completely:
1. Read the task instructions
2. Build the package/feature as specified
3. Ensure all files are created with proper structure
4. Add tests achieving 80%+ coverage
5. Run quality checks (pnpm tsc --noEmit, pnpm lint)
6. Commit your changes with a descriptive message
7. Push to the current branch

AFTER COMPLETING THE TASK:
1. Update .claude/NEXT_TASK.md:
   - Move current task to completed
   - Set the NEXT task from the queue as current
   - If no more tasks, write 'BUILD COMPLETE' at the top
2. Update .claude/build-state.json with progress

IMPORTANT:
- Stay focused on the ONE task in NEXT_TASK.md
- Do not start additional tasks
- Commit and push before finishing
- Update NEXT_TASK.md for the next session

Begin by reading .claude/NEXT_TASK.md"

    # Run Claude with the prompt
    # Using --print for non-interactive mode, --dangerously-skip-permissions for automation
    echo "$prompt" | claude --print --dangerously-skip-permissions 2>&1 | tee "$log_file"

    local exit_code=${PIPESTATUS[1]}

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
