# Skill: ADR Status

**Trigger:** `/adr-status [--category <name>] [--priority <P0|P1|P2>] [--verbose]`

## Purpose

Display the implementation status of all Architecture Decision Records (ADRs), showing what has been built, what's in progress, and what remains.

## Data Sources

1. `.claude/adr-index.json` - ADR catalog and metadata
2. `tools/adrs/*.md` - ADR documents
3. `packages/` - Implemented packages
4. `apps/` - Implemented applications

## Execution Steps

### Step 1: Load ADR Index

```typescript
const adrIndex = JSON.parse(fs.readFileSync('.claude/adr-index.json'));
```

### Step 2: Scan Implementation Status

For each ADR, check:
1. Does the mapped package exist in `packages/`?
2. Is there a feature module in `apps/api/src/modules/`?
3. Are there UI components in `apps/portal/src/features/`?
4. Is there test coverage?

### Step 3: Calculate Completion Percentage

```typescript
interface ADRStatus {
  adrId: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2';
  category: string;
  status: 'not-started' | 'in-progress' | 'completed';
  completion: number; // 0-100
  components: {
    database: boolean;
    package: boolean;
    api: boolean;
    ui: boolean;
    tests: boolean;
  };
  blockedBy: string[]; // Dependency ADRs not yet implemented
}
```

## Output Formats

### Summary View (Default)

```
=== Forge Factory ADR Implementation Status ===
Last Updated: {timestamp}

Overall Progress: 15/49 ADRs (30.6%)

By Priority:
  P0 (Critical):    3/12 completed  (25%)
  P1 (Important):   8/25 completed  (32%)
  P2 (Nice-to-have): 4/12 completed  (33%)

By Category:
  Foundation:              2/2  [##########] 100%
  Backend:                 1/3  [###-------]  33%
  Portals:                 2/12 [##--------]  17%
  Enterprise:              3/9  [###-------]  33%
  Transformation Playbooks: 0/7  [----------]   0%
  AI & Code Analysis:      3/4  [########--]  75%
  Advanced:                1/3  [###-------]  33%

Next P0 to Implement: ADR-016 (Accessibility & i18n)
```

### Detailed View (--verbose)

```
=== Forge Factory ADR Implementation Status ===

Category: Foundation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADR-001: Vertical Slice Architecture [COMPLETED]
  Priority: P0
  Package:  @forge/prisma ✓
  API:      Vertical slice pattern ✓
  Tests:    ✓
  Coverage: 92%

ADR-002: Tenant Isolation Strategy [COMPLETED]
  Priority: P0
  Package:  @forge/prisma (RLS) ✓
  API:      Tenant middleware ✓
  Tests:    ✓
  Coverage: 88%

Category: Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADR-009: Connection Pooling [IN PROGRESS]
  Priority: P1
  Package:  @forge/database (partial)
  API:      Not started
  Tests:    Pending
  Blocked:  None

ADR-010: Frontend Architecture [NOT STARTED]
  Priority: P0
  Package:  @forge/design-system ✗
  API:      N/A
  UI:       Not started
  Blocked:  None

...

Category: AI & Code Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADR-038: Multi-Language Code Analysis [NOT STARTED]
  Priority: P0
  Package:  @forge/code-analysis ✗
  API:      Not started
  Tests:    Pending
  Blocked:  ADR-001, ADR-002

ADR-039: AI-Readiness Assessment [NOT STARTED]
  Priority: P0
  Package:  @forge/ai-readiness ✗
  API:      Not started
  Tests:    Pending
  Blocked:  ADR-038

...
```

### Category Filter

```bash
/adr-status --category enterprise
```

```
=== Enterprise ADRs ===

ADR-019-enterprise: Enterprise Customer Management [COMPLETED]
ADR-020-super-admin: Super Admin Portal [IN PROGRESS]
ADR-024: Change Management [NOT STARTED]
ADR-025: ROI Tracking [NOT STARTED]
ADR-026: Enterprise Onboarding [NOT STARTED]
ADR-027: Customer Health Monitoring [NOT STARTED]
ADR-028: Customer Expansion [NOT STARTED]
ADR-029: Support Ticket Management [NOT STARTED]
ADR-030: Project Governance [NOT STARTED]

Summary: 1/9 completed (11%)
```

### Priority Filter

```bash
/adr-status --priority P0
```

```
=== P0 (Critical) ADRs ===

COMPLETED:
  ✓ ADR-001: Vertical Slice Architecture
  ✓ ADR-002: Tenant Isolation Strategy

IN PROGRESS:
  ◐ ADR-014: Admin Portal (50%)

NOT STARTED (BLOCKED):
  ✗ ADR-010: Frontend Architecture
    Blocked by: None (READY TO START)
  ✗ ADR-012: User Portal & Onboarding
    Blocked by: ADR-010
  ✗ ADR-016: Accessibility & i18n
    Blocked by: ADR-010

NOT STARTED (DEPENDENCIES MET):
  → ADR-019: AI-First Interaction
  → ADR-021: Multi-Compliance Framework
  → ADR-026: Enterprise Onboarding

Summary: 2/12 completed
Recommended Next: ADR-010 (Frontend Architecture)
```

## Dependency Graph

The skill can also output a dependency graph:

```
/adr-status --graph
```

```
ADR Dependency Graph:

ADR-001 (Vertical Slice) ──┬── ADR-009 (Connection Pooling)
                          │
                          ├── ADR-010 (Frontend) ──┬── ADR-012 (User Portal)
                          │                        ├── ADR-013 (Dev Portal)
                          │                        ├── ADR-014 (Admin Portal)
                          │                        └── ADR-016 (a11y/i18n)
                          │
ADR-002 (Tenant Isolation)─┴── ADR-021 (Compliance)
                               │
                               └── ADR-026 (Enterprise Onboarding)

Legend: ✓ Completed  ◐ In Progress  ✗ Not Started
```

## JSON Export

For programmatic access:

```bash
/adr-status --json > adr-status.json
```

```json
{
  "timestamp": "2026-01-21T00:00:00Z",
  "summary": {
    "total": 49,
    "completed": 15,
    "inProgress": 5,
    "notStarted": 29,
    "percentComplete": 30.6
  },
  "adrs": [
    {
      "id": "ADR-001",
      "title": "Vertical Slice Architecture",
      "priority": "P0",
      "category": "foundation",
      "status": "completed",
      "completion": 100,
      "blockedBy": []
    }
    // ...
  ]
}
```

## Update Mechanism

The ADR status is automatically updated when:
1. New packages are created
2. Features are generated via `/build-feature`
3. Tests are added
4. Manual sync via `/adr-status --sync`
