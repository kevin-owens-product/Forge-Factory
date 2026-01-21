# Skill: Build Feature from ADR

**Trigger:** `/build-feature <adr-number> [--dry-run]`

## Purpose

Generate a complete vertical slice implementation from an Architecture Decision Record (ADR). This skill reads the ADR specification and generates all necessary code including database schema, API endpoints, UI components, and tests.

## Prerequisites

1. ADR must exist in `tools/adrs/`
2. All dependency ADRs must be implemented (check `.claude/adr-index.json`)
3. Required packages must exist (or will be created)

## Execution Steps

### Step 1: Load and Parse ADR

```bash
# Read the target ADR
ADR_PATH="tools/adrs/ADR-{number}-*.md"

# Extract key sections:
# - Context and Problem Statement
# - Decision Drivers
# - Considered Options
# - Decision Outcome
# - Technical Specifications
# - Database Schema
# - API Contracts
# - UI Components
```

### Step 2: Dependency Check

Query `.claude/adr-index.json` to verify:
- All prerequisite ADRs are implemented
- Required packages exist in `packages/`
- No circular dependencies will be introduced

### Step 3: Generate Database Layer

If ADR includes database schema:

1. Create/update Prisma schema in `packages/prisma/prisma/schema.prisma`
2. Add tenant isolation fields (`tenantId`, `createdBy`, `updatedBy`)
3. Generate migration: `pnpm prisma migrate dev --name {feature-name}`
4. Create seed data in `packages/prisma/src/seeds/`

### Step 4: Generate Package (if needed)

If ADR maps to a new package:

```typescript
// packages/{package-name}/
├── src/
│   ├── index.ts              // Public exports
│   ├── {feature}.service.ts  // Business logic
│   ├── {feature}.repository.ts // Data access
│   ├── {feature}.types.ts    // TypeScript interfaces
│   └── {feature}.validators.ts // Zod schemas
├── __tests__/
│   ├── {feature}.service.test.ts
│   └── {feature}.repository.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Step 5: Generate API Layer

In `apps/api/`:

1. Create module: `src/modules/{feature}/`
2. Create controller with CRUD endpoints
3. Create DTOs with validation
4. Create service calling package logic
5. Register module in `app.module.ts`
6. Add OpenAPI documentation

### Step 6: Generate UI Components

If ADR includes UI specifications:

1. Create feature directory in portal app
2. Generate React components with TypeScript
3. Add state management (TanStack Query)
4. Add i18n keys (no hardcoded strings)
5. Ensure accessibility (ARIA labels, keyboard nav)

### Step 7: Generate Tests

For each generated file:

1. Unit tests (80%+ coverage)
2. Integration tests for API endpoints
3. Component tests for UI
4. E2E tests for critical paths

### Step 8: Add Prompt Traceability

Add to every generated file:

```typescript
/**
 * @prompt-id forge-v4.1:feature:{adr-number}:{sequence}
 * @generated-at {ISO-timestamp}
 * @model claude-opus-4-5
 * @adr-ref ADR-{number}
 */
```

### Step 9: Run Quality Gates

Execute post-generation hook:
- TypeScript compilation
- ESLint validation
- Prettier formatting
- Test execution
- Coverage verification

### Step 10: Update Tracking

1. Update `.ai-metrics.json` with generation statistics
2. Mark ADR as implemented in tracking
3. Log generation summary

## Output Format

```
=== Feature Generation Complete ===
ADR: ADR-{number} - {title}
Files Generated: {count}
Lines of Code: {count}
Test Coverage: {percent}%
Quality Gates: PASSED

Generated Files:
  - packages/{name}/src/...
  - apps/api/src/modules/{name}/...
  - apps/portal/src/features/{name}/...

Next Steps:
  1. Review generated code
  2. Run full test suite: pnpm test
  3. Test locally: pnpm dev
  4. Create PR when ready
```

## Safety Checks

Before generation, verify:
- [ ] ADR is approved (status: approved)
- [ ] Dependencies are satisfied
- [ ] No existing code will be overwritten without backup
- [ ] Feature doesn't touch security-critical code without flag

## Dry Run Mode

With `--dry-run` flag:
- Parse ADR and show what would be generated
- List all files that would be created
- Show dependency tree
- Do NOT create any files
