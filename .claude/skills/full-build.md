# Skill: Full Build

**Trigger:** `/full-build [--phase <1|2|3|4|all>] [--dry-run] [--continue]`

## Purpose

Execute a complete autonomous build of the Forge Factory platform from ADRs. This is the master orchestration skill that coordinates all other skills to build the entire platform.

## Build Philosophy

The Forge Factory platform is built following the **dependency order** defined in ADRs:
1. Foundation first (database, tenant isolation)
2. Core packages (shared libraries)
3. Applications (API, portals)
4. Features (vertical slices)
5. Integration (E2E flows)

## Build Phases

### Phase 1: Foundation & Core Packages

**Objective:** Establish the infrastructure layer

**ADRs:**
- ADR-001: Vertical Slice Architecture
- ADR-002: Tenant Isolation Strategy
- ADR-009: Connection Pooling

**Packages to Build:**
```
@forge/database        # Connection management
@forge/cache           # Redis client
@forge/queue           # BullMQ wrapper
@forge/storage         # S3/R2 client
@forge/shared-types    # TypeScript types (exists)
@forge/errors          # Error handling (exists)
@forge/prisma          # Database ORM (exists)
```

**Validation:**
- All packages compile
- Unit tests pass
- Integration tests for DB/Cache/Queue

### Phase 2: Security & Auth

**Objective:** Establish security infrastructure

**ADRs:**
- ADR-021: Multi-Compliance Framework
- ADR-026: Enterprise Customer Onboarding (auth portion)

**Packages to Build:**
```
@forge/auth            # Authentication core
@forge/sso             # SSO/SAML integration
@forge/roles           # RBAC system
@forge/compliance      # Compliance utilities
@forge/encryption      # Encryption helpers
```

**Validation:**
- Auth flows work
- SSO integration tested
- RBAC permissions enforced
- Compliance logging active

### Phase 3: API & Applications

**Objective:** Build user-facing applications

**ADRs:**
- ADR-010: Frontend Architecture
- ADR-012: User Portal
- ADR-013: Developer Portal
- ADR-014: Admin Portal
- ADR-020: Super Admin Portal

**Applications to Build:**
```
apps/api/              # NestJS API (enhance)
apps/portal/           # User portal (React)
apps/admin/            # Admin portal (React)
apps/developer/        # Developer portal (React)
apps/super-admin/      # Platform admin (React)
```

**Packages to Build:**
```
@forge/design-system   # UI components
@forge/i18n            # Internationalization
@forge/feature-flags   # Feature toggles
@forge/analytics       # Usage analytics
@forge/realtime        # WebSocket client
```

**Validation:**
- All apps build
- Design system renders
- i18n works
- Feature flags toggle

### Phase 4: Features & Integration

**Objective:** Complete vertical slices

**ADRs:**
- ADR-015: Real-time Updates
- ADR-016: Accessibility & i18n
- ADR-017: Frontend Performance
- ADR-018: Error Handling Patterns
- ADR-019: AI-First Interaction
- ADR-022: Feature Flagging
- ADR-023: Version History UI
- All Enterprise ADRs (024-030)
- All Transformation Playbooks (031-037)
- All AI/Code Analysis ADRs (038-041)

**Features to Build:**
- User onboarding flow
- Team management
- Project management
- Code analysis
- Transformation tracking
- ROI dashboard
- Support system

**Validation:**
- E2E tests pass
- Accessibility audit passes
- Performance budgets met

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FULL BUILD ORCHESTRATION                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Foundation                                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                 │
│ │ @forge/     │ │ @forge/     │ │ @forge/     │                 │
│ │ database    │ │ cache       │ │ queue       │                 │
│ └─────────────┘ └─────────────┘ └─────────────┘                 │
│        │              │              │                           │
│        └──────────────┼──────────────┘                          │
│                       ▼                                          │
│              Integration Tests                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Security                                                │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                 │
│ │ @forge/auth │ │ @forge/sso  │ │ @forge/roles│                 │
│ └─────────────┘ └─────────────┘ └─────────────┘                 │
│        │              │              │                           │
│        └──────────────┼──────────────┘                          │
│                       ▼                                          │
│              Security Audit                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Applications                                            │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│ │ API     │ │ Portal  │ │ Admin   │ │ DevPortal│                │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                 │
│      │           │           │           │                       │
│      └───────────┼───────────┼───────────┘                      │
│                  ▼                                               │
│            Build & Test                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Features                                                │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ For each remaining ADR in dependency order:                │   │
│ │   1. /build-feature ADR-XXX                               │   │
│ │   2. /generate-tests <feature-path>                       │   │
│ │   3. /run-quality-gates --path <feature-path>             │   │
│ └───────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│                    E2E Test Suite                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FINAL: Validation                                                │
│   • All quality gates pass                                       │
│   • Coverage >= 80%                                              │
│   • E2E tests pass                                               │
│   • Accessibility audit passes                                   │
│   • Security scan clean                                          │
│   • Performance budgets met                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Checkpoint System

After each phase:
1. Save progress to `.claude/build-state.json`
2. Commit work with phase marker
3. Run quality gates
4. Update `.ai-metrics.json`

```json
// .claude/build-state.json
{
  "currentPhase": 2,
  "completedADRs": ["ADR-001", "ADR-002", "ADR-009"],
  "completedPackages": ["database", "cache", "queue"],
  "lastCheckpoint": "2026-01-21T12:00:00Z",
  "errors": [],
  "warnings": []
}
```

## Continue Mode

Resume from last checkpoint:

```bash
/full-build --continue
```

Reads `.claude/build-state.json` and continues from `currentPhase`.

## Dry Run Mode

Preview what would be built:

```bash
/full-build --dry-run
```

Output:
```
=== Full Build Dry Run ===

Phase 1: Foundation (3 packages)
  Create: @forge/database
  Create: @forge/cache
  Create: @forge/queue
  Estimated files: 45
  Estimated lines: ~3,500

Phase 2: Security (5 packages)
  Create: @forge/auth
  Create: @forge/sso
  Create: @forge/roles
  Create: @forge/compliance
  Create: @forge/encryption
  Estimated files: 78
  Estimated lines: ~6,200

Phase 3: Applications (4 apps, 5 packages)
  Enhance: apps/api
  Create: apps/portal
  Create: apps/admin
  Create: apps/developer
  Create: @forge/design-system
  Create: @forge/i18n
  Create: @forge/feature-flags
  Create: @forge/analytics
  Create: @forge/realtime
  Estimated files: 250
  Estimated lines: ~20,000

Phase 4: Features (34 ADRs)
  Feature slices for remaining ADRs
  Estimated files: 400+
  Estimated lines: ~35,000

Total Estimates:
  Packages: 30+
  Applications: 5
  Files: 750+
  Lines of Code: ~65,000
  Test Files: 200+
  Test Coverage Target: 80%

Would you like to proceed?
```

## Output Format

```
=== Full Build Execution ===
Started: 2026-01-21T10:00:00Z
Mode: Full (all phases)

PHASE 1: Foundation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[10:01] Creating @forge/database...
[10:05] Creating @forge/cache...
[10:08] Creating @forge/queue...
[10:12] Running integration tests...
[10:15] ✓ Phase 1 complete (15 minutes)
        Packages: 3
        Files: 45
        Coverage: 89%

PHASE 2: Security
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[10:16] Creating @forge/auth...
[10:25] Creating @forge/sso...
...
[10:45] ✓ Phase 2 complete (29 minutes)
        Packages: 5
        Files: 78
        Coverage: 85%
        Security Scan: PASSED

PHASE 3: Applications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...

=== Full Build Complete ===
Duration: 4 hours 32 minutes
Total Packages: 30
Total Apps: 5
Total Files: 752
Total Lines: 64,892
Test Coverage: 87%
ADRs Implemented: 49/49 (100%)

All quality gates PASSED
Platform ready for deployment
```

## Error Recovery

If build fails:
1. Error is logged with context
2. Partial work is committed
3. State saved for resume
4. Suggestion provided for fix

```
ERROR at Phase 2, Step 3 (SSO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Error: SAML library integration failed
File: packages/sso/src/saml.provider.ts:45

Partial work committed: feat(sso): add base SSO structure
State saved: .claude/build-state.json

To resume after fixing:
  /full-build --continue

Or skip SSO and continue:
  /full-build --continue --skip ADR-026-sso
```
