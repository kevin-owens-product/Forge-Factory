#!/bin/bash
# Forge Factory Overnight Autonomous Build
# Runs continuously without user approval until all tasks complete

set -o pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.claude/logs"
TIMEOUT_SECONDS=1200  # 20 minutes
MAX_RETRIES=3
MAX_SESSIONS=50

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

# macOS-compatible timeout function
run_with_timeout() {
    local timeout=$1
    local logfile=$2
    shift 2

    # Start the command in background with output redirect and stdin from /dev/null
    "$@" < /dev/null > "$logfile" 2>&1 &
    local pid=$!

    # Start a killer in background
    (sleep $timeout && kill -9 $pid 2>/dev/null) &
    local killer=$!

    # Wait for command
    wait $pid 2>/dev/null
    local exit_code=$?

    # Kill the killer if command finished
    kill $killer 2>/dev/null
    wait $killer 2>/dev/null

    return $exit_code
}

# Master log for overnight run
MASTER_LOG="$LOG_DIR/overnight-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$MASTER_LOG"
}

get_task() {
    grep -A3 "## Current Task" .claude/NEXT_TASK.md 2>/dev/null | grep -v "^$" | grep -v "## Current Task" | head -1 | sed 's/\*//g' | xargs
}

is_complete() {
    head -10 .claude/NEXT_TASK.md 2>/dev/null | grep -q "BUILD COMPLETE"
}

log "=============================================="
log "🏭 Forge Factory Overnight Build"
log "=============================================="
log "Project: $PROJECT_ROOT"
log "Timeout: $((TIMEOUT_SECONDS / 60)) min/session"
log "Master Log: $MASTER_LOG"
log "=============================================="

session=0
consecutive_failures=0

while [ $session -lt $MAX_SESSIONS ]; do
    session=$((session + 1))

    # Check if complete
    if is_complete; then
        log ""
        log "=============================================="
        log "✅ BUILD COMPLETE!"
        log "=============================================="
        log "Total Sessions: $session"
        log "Finished: $(date)"
        exit 0
    fi

    TASK=$(get_task)
    SESSION_LOG="$LOG_DIR/session-$(printf '%03d' $session)-$(date +%Y%m%d-%H%M%S).log"

    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Session $session / $MAX_SESSIONS"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "📋 Task: $TASK"
    log "📁 Log: $SESSION_LOG"

    PROMPT="Read .claude/NEXT_TASK.md. Build the current task package with tests (80%+ coverage). Commit and push. Update NEXT_TASK.md when done."

    # Run with timeout and permission bypass
    log "🔨 Building... (timeout: $((TIMEOUT_SECONDS / 60))m)"

    if run_with_timeout $TIMEOUT_SECONDS "$SESSION_LOG" claude --dangerously-skip-permissions -p "$PROMPT"; then
        log "✅ Session completed successfully"
        consecutive_failures=0

        # Show summary
        log "📋 Summary:"
        tail -10 "$SESSION_LOG" | while read line; do log "   $line"; done
    else
        EXIT_CODE=$?
        consecutive_failures=$((consecutive_failures + 1))

        if [ $EXIT_CODE -eq 137 ]; then
            log "⏰ Session timed out after $((TIMEOUT_SECONDS / 60)) minutes"
        else
            log "❌ Session failed (exit code: $EXIT_CODE)"
        fi

        # Check for repeated failures
        if [ $consecutive_failures -ge $MAX_RETRIES ]; then
            log "⛔ $MAX_RETRIES consecutive failures - pausing for 5 minutes"
            sleep 300
            consecutive_failures=0
        else
            log "⚠️ Failure $consecutive_failures/$MAX_RETRIES - retrying in 30s"
            sleep 30
        fi
    fi

    # Pull any changes
    git pull --rebase 2>/dev/null || true

    # Brief pause between sessions
    sleep 5
done

log ""
log "=============================================="
log "⚠️ Max sessions reached ($MAX_SESSIONS)"
log "=============================================="
log "Run again to continue"
