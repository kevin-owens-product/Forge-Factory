# Skill: Next Priority

**Trigger:** `/next-priority [--count <n>] [--category <name>]`

## Purpose

Analyze the ADR dependency graph and implementation status to recommend the next highest-priority items to build. This skill considers dependencies, business value, and technical readiness.

## Algorithm

### Step 1: Load Current State

```typescript
// Load ADR index and implementation status
const adrIndex = loadADRIndex();
const implStatus = scanImplementationStatus();
```

### Step 2: Filter Ready-to-Build

An ADR is "ready to build" when:
1. Status is NOT "completed"
2. All dependency ADRs are "completed"
3. Required packages exist (or can be created first)

```typescript
function isReadyToBuild(adr: ADR): boolean {
  if (adr.status === 'completed') return false;

  const dependencies = adrIndex.categories[adr.category].dependencies;
  return dependencies.every(dep =>
    adrIndex.categories[dep].adrs.every(a => a.status === 'completed')
  );
}
```

### Step 3: Score and Rank

Each ready ADR is scored:

```typescript
interface ADRScore {
  adrId: string;
  totalScore: number;
  breakdown: {
    priorityScore: number;    // P0=100, P1=50, P2=25
    dependencyScore: number;  // How many ADRs depend on this?
    complexityScore: number;  // Lower complexity = higher score
    businessValueScore: number; // From ADR metadata
  };
}
```

**Priority Weight (40%):**
- P0: 100 points
- P1: 50 points
- P2: 25 points

**Dependency Weight (30%):**
- Points = (number of ADRs blocked by this) * 10
- Max 100 points

**Complexity Weight (15%):**
- Simple (1 package): 100 points
- Medium (2-3 packages): 75 points
- Complex (4+ packages): 50 points

**Business Value Weight (15%):**
- Core functionality: 100 points
- Enhanced UX: 75 points
- Optimization: 50 points
- Nice-to-have: 25 points

### Step 4: Generate Recommendations

## Output Format

### Default (Top 1)

```
=== Next Priority Recommendation ===

ADR-010: Frontend Architecture & Component Library
Priority: P0 (Critical)
Category: Backend/Frontend
Score: 92.5/100

Why This Is Next:
  1. Zero blockers - all dependencies satisfied
  2. Blocks 8 other ADRs (portals, UI features)
  3. Core infrastructure required for user-facing features
  4. Medium complexity - achievable in focused session

Required Packages:
  - @forge/design-system (create new)

Estimated Components:
  - Design tokens (colors, typography, spacing)
  - Base UI components (Button, Input, Card, etc.)
  - Layout components (Container, Grid, Stack)
  - Form components with validation
  - Theme provider with dark mode

To Start:
  /build-feature ADR-010
  or
  /build-package design-system --from-adr ADR-010

Blocked ADRs (will unblock):
  - ADR-012: User Portal & Onboarding
  - ADR-013: Developer Portal
  - ADR-014: Admin Portal
  - ADR-016: Accessibility & i18n
  - ADR-017: Frontend Performance
  - ADR-018: Error Handling Patterns
  - ADR-020: Real-time Collaboration
  - ADR-023: Version History UI
```

### Multiple Recommendations (--count 5)

```
=== Top 5 Priority Recommendations ===

┌────┬─────────────────────────────────────────┬──────────┬───────┬──────────┐
│ #  │ ADR                                     │ Priority │ Score │ Unblocks │
├────┼─────────────────────────────────────────┼──────────┼───────┼──────────┤
│ 1  │ ADR-010: Frontend Architecture          │ P0       │ 92.5  │ 8 ADRs   │
│ 2  │ ADR-038: Multi-Language Code Analysis   │ P0       │ 88.0  │ 3 ADRs   │
│ 3  │ ADR-021: Multi-Compliance Framework     │ P0       │ 85.5  │ 2 ADRs   │
│ 4  │ ADR-019: AI-First Interaction           │ P0       │ 82.0  │ 1 ADR    │
│ 5  │ ADR-015: Real-time Updates              │ P1       │ 78.5  │ 4 ADRs   │
└────┴─────────────────────────────────────────┴──────────┴───────┴──────────┘

Parallel Build Opportunity:
  ADR-010 and ADR-038 have no shared dependencies.
  They can be built in parallel for faster progress.

Suggested Sprint Plan:
  Week 1: ADR-010 (Frontend Architecture)
  Week 2: ADR-038 (Code Analysis) + ADR-021 (Compliance)
  Week 3: ADR-019 (AI Interaction) + ADR-015 (Real-time)

Total Impact: Unblocks 18 additional ADRs
```

### Category Filter (--category enterprise)

```
=== Next Priority in Enterprise ===

ADR-026: Enterprise Customer Onboarding Automation
Priority: P0
Score: 85.5/100

Reason:
  - First enterprise feature to implement
  - Enables customer acquisition workflow
  - Dependencies (Auth, SSO) ready

Required Packages:
  - @forge/auth (exists)
  - @forge/sso (needs creation)
  - @forge/onboarding (needs creation)

To Start:
  /build-feature ADR-026
```

## Decision Factors Explanation

The skill explains WHY an ADR is recommended:

```
Decision Factors for ADR-010:

1. BLOCKER STATUS [+30 pts]
   This ADR blocks 8 other ADRs. Completing it will unlock
   significant downstream work.

2. PRIORITY LEVEL [+40 pts]
   P0 (Critical) - Core platform functionality required for MVP.

3. DEPENDENCY READINESS [+15 pts]
   All prerequisites completed:
   ✓ ADR-001: Vertical Slice Architecture
   ✓ ADR-002: Tenant Isolation Strategy

4. TECHNICAL COMPLEXITY [+12 pts]
   Medium complexity. Single package creation with well-defined
   scope from ADR specification.

5. BUSINESS VALUE [+10 pts]
   Core functionality enabling user-facing features.

TOTAL SCORE: 92.5/100
```

## Build Plan Generation

When multiple ADRs are recommended, the skill can generate a build plan:

```
=== Optimal Build Plan ===

Phase 1: Foundation Extension
  Duration: Focus session
  Build: ADR-010 (Frontend Architecture)
  Outcome: Design system ready

Phase 2: Core Platform (Parallel)
  Build simultaneously:
    - ADR-038 (Code Analysis)
    - ADR-021 (Compliance)
  Outcome: Analysis and compliance infrastructure

Phase 3: User Experience (Parallel)
  Build after Phase 1:
    - ADR-012 (User Portal)
    - ADR-014 (Admin Portal)
  Outcome: User-facing applications

Phase 4: Enterprise Features
  Build after Phase 2 & 3:
    - ADR-026 (Enterprise Onboarding)
    - ADR-027 (Health Monitoring)
  Outcome: Enterprise customer management

Total ADRs in Plan: 8
Expected Coverage: 45% of all ADRs
```
