#!/bin/bash
# Forge Factory Build Helper
# Runs interactive Claude sessions with the right prompt

cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Get current task
TASK=$(grep -A1 "## Current Task" .claude/NEXT_TASK.md | tail -1 | sed 's/\*//g')

echo "=============================================="
echo "  🏭 Forge Factory Build Session"
echo "=============================================="
echo ""
echo "  📋 Current Task: $TASK"
echo ""
echo "  Starting interactive Claude session..."
echo "  Claude will build the task automatically."
echo ""
echo "  When done, run this script again for the next task."
echo "=============================================="
echo ""

# Run Claude interactively with the prompt
claude "Read .claude/NEXT_TASK.md and complete the current task. Build all required files, add tests with 80%+ coverage, commit, push, then update NEXT_TASK.md with the next task."
