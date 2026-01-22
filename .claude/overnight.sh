#!/bin/bash
# Forge Factory Overnight Autonomous Build
# Runs continuously without user approval until all tasks complete

set -o pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.claude/logs"
TIMEOUT_MINUTES=20
MAX_RETRIES=3
MAX_SESSIONS=50

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

# Master log for overnight run
MASTER_LOG="$LOG_DIR/overnight-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$MASTER_LOG"
}

get_task() {
    grep -A1 "## Current Task" .claude/NEXT_TASK.md 2>/dev/null | tail -1 | sed 's/\*//g' | xargs
}

is_complete() {
    head -10 .claude/NEXT_TASK.md 2>/dev/null | grep -q "BUILD COMPLETE"
}

log "=============================================="
log "🏭 Forge Factory Overnight Build"
log "=============================================="
log "Project: $PROJECT_ROOT"
log "Timeout: $TIMEOUT_MINUTES min/session"
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

    PROMPT="Autonomous build session. Read .claude/NEXT_TASK.md and complete the current task: build the package with all files, add comprehensive tests (80%+ coverage), run quality checks (pnpm tsc --noEmit, pnpm lint), commit with descriptive message, push to remote. Then update NEXT_TASK.md: mark task complete, set next task as current. Stay focused on ONE task only. Do not ask for confirmation - just execute."

    # Run with timeout and permission bypass
    log "🔨 Building... (timeout: ${TIMEOUT_MINUTES}m)"

    if timeout ${TIMEOUT_MINUTES}m claude -p "$PROMPT" --permission-mode bypassPermissions > "$SESSION_LOG" 2>&1; then
        log "✅ Session completed successfully"
        consecutive_failures=0

        # Show summary
        log "📋 Summary:"
        tail -10 "$SESSION_LOG" | while read line; do log "   $line"; done
    else
        EXIT_CODE=$?
        consecutive_failures=$((consecutive_failures + 1))

        if [ $EXIT_CODE -eq 124 ]; then
            log "⏰ Session timed out after ${TIMEOUT_MINUTES} minutes"
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
