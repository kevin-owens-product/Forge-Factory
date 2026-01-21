# Forge Factory: Autonomous Development Guide

This document provides complete instructions for Claude to autonomously build and rebuild the Forge Factory platform using the ADR-driven architecture.

## Quick Start

```bash
# Start a new Claude Code session
claude

# Initialize autonomous development
> /adr-status              # Check current implementation status
> /next-priority           # Get recommended next task
> /build-feature ADR-XXX   # Build a specific ADR
> /full-build              # Start complete autonomous build
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS DEVELOPMENT SYSTEM                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │    ADRs     │────▶│   Skills    │────▶│   Code      │       │
│  │  (49 docs)  │     │  (6 skills) │     │  Generation │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                   │                   │                │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Prompts   │     │   Hooks     │     │   Quality   │       │
│  │  (Library)  │     │ (Lifecycle) │     │   Gates     │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘               │
│                             │                                    │
│                             ▼                                    │
│                    ┌─────────────┐                               │
│                    │   Metrics   │                               │
│                    │  Tracking   │                               │
│                    └─────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
.claude/
├── settings.json           # Claude Code configuration
├── adr-index.json         # ADR catalog and dependencies
├── build-state.json       # Current build progress
├── hooks/
│   ├── session-start.sh   # Session initialization
│   ├── pre-generation.sh  # Pre-code generation validation
│   ├── post-generation.sh # Post-generation quality gates
│   └── pre-commit.sh      # Commit validation
├── skills/
│   ├── build-feature.md   # Generate feature from ADR
│   ├── build-package.md   # Create new package
│   ├── run-quality-gates.md # Execute quality checks
│   ├── adr-status.md      # Show implementation status
│   ├── next-priority.md   # Recommend next task
│   ├── generate-tests.md  # Generate test suites
│   └── full-build.md      # Complete platform build
├── workflows/
│   └── build-workflow.json # Build orchestration
└── templates/              # Code templates

tools/
├── adrs/                   # 49 Architecture Decision Records
└── prompts/
    └── v4.1/
        ├── index.md        # Prompt library index
        ├── features/       # Feature generation prompts
        ├── generators/     # Scaffolding prompts
        └── utilities/      # Refactoring prompts

.ai-metrics.json            # AI generation tracking
```

## Available Skills

### `/build-feature <adr-number>`

Generate a complete vertical slice from an ADR.

```bash
> /build-feature ADR-012   # Build User Portal from ADR
```

**What it does:**
1. Reads and parses the ADR
2. Checks dependencies are satisfied
3. Generates database schema (Prisma)
4. Creates package with service/repository
5. Builds API endpoints (NestJS)
6. Creates UI components (React)
7. Generates comprehensive tests
8. Runs quality gates

### `/build-package <name>`

Create a new `@forge/<name>` package.

```bash
> /build-package analytics  # Create @forge/analytics
```

**What it does:**
1. Creates package directory structure
2. Generates package.json, tsconfig.json
3. Creates service, types, errors
4. Sets up test infrastructure
5. Adds path alias to tsconfig.base.json

### `/run-quality-gates`

Execute all quality validation checks.

```bash
> /run-quality-gates        # Full check
> /run-quality-gates --fix  # Auto-fix issues
```

**Gates executed:**
1. TypeScript compilation
2. ESLint validation
3. Prettier formatting
4. Circular dependency check
5. Test execution
6. Coverage verification
7. Security scan

### `/adr-status`

Display implementation status of all ADRs.

```bash
> /adr-status                    # Summary view
> /adr-status --verbose          # Detailed view
> /adr-status --category portal  # Filter by category
> /adr-status --priority P0      # Filter by priority
```

### `/next-priority`

Get intelligent recommendation for what to build next.

```bash
> /next-priority           # Top recommendation
> /next-priority --count 5 # Top 5 recommendations
```

**Algorithm considers:**
- Dependency satisfaction
- Priority level (P0 > P1 > P2)
- Blocking factor (unblocks other ADRs)
- Complexity estimate

### `/generate-tests <path>`

Generate tests to achieve 80%+ coverage.

```bash
> /generate-tests packages/auth/src/auth.service.ts
```

### `/full-build`

Execute complete autonomous platform build.

```bash
> /full-build              # Build everything
> /full-build --phase 1    # Build specific phase
> /full-build --dry-run    # Preview without building
> /full-build --continue   # Resume from checkpoint
```

**Build Phases:**
1. Foundation & Core Packages
2. Security & Auth
3. UI Foundation
4. Applications
5. Feature Vertical Slices
6. AI & Code Analysis
7. Final Integration

## Build Workflow

### Phase 1: Foundation (Priority: Critical)

| Package | ADR | Status |
|---------|-----|--------|
| @forge/database | ADR-009 | Pending |
| @forge/cache | - | Pending |
| @forge/queue | - | Pending |
| @forge/storage | - | Pending |

### Phase 2: Security (Priority: Critical)

| Package | ADR | Status |
|---------|-----|--------|
| @forge/auth | ADR-026 | Pending |
| @forge/sso | ADR-026 | Pending |
| @forge/roles | ADR-002 | Pending |
| @forge/compliance | ADR-021 | Pending |
| @forge/encryption | - | Pending (Human Review) |

### Phase 3: UI Foundation (Priority: High)

| Package | ADR | Status |
|---------|-----|--------|
| @forge/design-system | ADR-010 | Pending |
| @forge/i18n | ADR-016 | Pending |
| @forge/feature-flags | ADR-022 | Pending |
| @forge/analytics | - | Pending |
| @forge/realtime | ADR-015 | Pending |

### Phase 4: Applications (Priority: High)

| Application | ADR | Status |
|-------------|-----|--------|
| apps/api | - | Partial |
| apps/portal | ADR-012 | Pending |
| apps/admin | ADR-014 | Pending |
| apps/developer | ADR-013 | Pending |
| apps/super-admin | ADR-020 | Pending |

### Phase 5-7: Features & Integration

See `.claude/workflows/build-workflow.json` for complete task list.

## Code Generation Rules

### Traceability (Required)

All generated code must include:

```typescript
/**
 * @prompt-id forge-v4.1:feature:{name}:{sequence}
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 * @adr-ref ADR-XXX
 */
```

### Quality Requirements

- TypeScript strict mode
- ESLint with zero warnings
- 80% minimum test coverage
- No circular dependencies
- Security scan pass

### Prohibited Patterns

- Raw SQL queries (use Prisma)
- Hardcoded configuration
- console.log in production
- TODO comments
- Direct cross-app imports
- Bypassing security checks

### Human Review Required

These areas require human review before merge:

- Authentication logic
- Payment processing
- Security-critical code
- Encryption/decryption
- Data migrations affecting production
- Permission checks

## Hooks System

### Session Start

Runs when Claude Code session begins:
- Verifies environment
- Shows available skills
- Reports current status

### Pre-Generation

Runs before code generation:
- Validates ADR reference
- Checks dependencies
- Verifies project state

### Post-Generation

Runs after code generation:
- TypeScript compilation
- ESLint validation
- Test execution
- Coverage check
- Security scan

### Pre-Commit

Final validation before commit:
- No secrets in code
- No console.log
- Prompt IDs present
- No raw SQL
- Security files have human review annotation

## Metrics Tracking

Metrics are tracked in `.ai-metrics.json`:

```json
{
  "summary": {
    "totalLines": 50000,
    "aiGeneratedLines": 37500,
    "ratio": 0.75
  },
  "byCategory": {
    "features": { "ratio": 0.85 },
    "tests": { "ratio": 0.90 },
    "infrastructure": { "ratio": 0.60 },
    "security": { "ratio": 0.20 }
  }
}
```

Target AI generation ratio: **75%** overall

## Checkpoint & Resume

Build progress is saved to `.claude/build-state.json`:

```json
{
  "currentPhase": 2,
  "currentTask": "task-2-3",
  "completedADRs": ["ADR-001", "ADR-002"],
  "checkpoints": [
    {
      "timestamp": "2026-01-21T12:00:00Z",
      "phase": 1,
      "commit": "abc123"
    }
  ]
}
```

Resume from checkpoint:
```bash
> /full-build --continue
```

## Error Recovery

If build fails:

1. Error logged with context
2. Partial work committed
3. State saved for resume
4. Fix suggestion provided

```bash
# After fixing the issue
> /full-build --continue

# Or skip problematic task
> /full-build --continue --skip task-2-3
```

## Best Practices

### Starting Fresh

```bash
> /adr-status              # Understand current state
> /next-priority           # Get recommendation
> /build-feature ADR-XXX   # Start with recommended ADR
```

### Continuing Work

```bash
> /adr-status --verbose    # Check detailed progress
> /full-build --continue   # Resume automated build
```

### Quality First

```bash
> /run-quality-gates       # Always run before commit
> /generate-tests <path>   # Ensure coverage
```

### Tracking Progress

```bash
> cat .claude/build-state.json  # View build state
> cat .ai-metrics.json          # View generation metrics
```

## ADR Reference

| Category | ADRs | Priority |
|----------|------|----------|
| Foundation | 001, 002 | P0 |
| Backend | 009, 010, 011 | P0-P1 |
| Portals | 012-023 | P0-P2 |
| Enterprise | 024-030 | P0-P2 |
| Playbooks | 031-037 | P1-P2 |
| AI/Code Analysis | 038-041, 047, 052-053 | P0-P1 |

Full ADR index: `.claude/adr-index.json`

## Support

- ADRs: `tools/adrs/`
- Prompts: `tools/prompts/v4.1/`
- Conventions: `CLAUDE.md`
- Build State: `.claude/build-state.json`
- Metrics: `.ai-metrics.json`
