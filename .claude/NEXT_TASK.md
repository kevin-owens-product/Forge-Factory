# Autonomous Build Queue

**Status:** IN_PROGRESS
**Updated:** 2026-01-21

---

## Current Task

**Build `@forge/database` package**

### Instructions

Create the database connection management package following ADR-009.

**Files to Create:**
```
packages/database/
├── src/
│   ├── index.ts              # Export public API
│   ├── database.service.ts   # Main service class
│   ├── database.types.ts     # TypeScript interfaces
│   ├── connection-pool.ts    # PgBouncer pool management
│   └── health.ts             # Health check utilities
├── __tests__/
│   └── database.service.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Requirements:**
- Connection pooling with configurable pool size
- Tenant-aware connection handling
- Health check method
- Graceful shutdown support
- Use existing @forge/prisma for Prisma client
- 80%+ test coverage

**Reference ADR:** `tools/adrs/009-connection-pooling.md`

**After completing:**
1. Run `pnpm tsc --noEmit` to verify compilation
2. Run `pnpm lint` to check linting
3. Commit: `git add . && git commit -m "feat(database): add @forge/database package"`
4. Push: `git push`
5. Update this file: move task to COMPLETED, set next task as CURRENT

---

## Task Queue

### Phase 1: Foundation
- [ ] @forge/database ← CURRENT
- [ ] @forge/cache (Redis wrapper)
- [ ] @forge/queue (BullMQ wrapper)
- [ ] @forge/storage (S3/R2 wrapper)

### Phase 2: Security
- [ ] @forge/auth (Authentication core)
- [ ] @forge/sso (SAML/OIDC integration)
- [ ] @forge/roles (RBAC system)
- [ ] @forge/compliance (Audit logging)

### Phase 3: UI Foundation
- [ ] @forge/design-system (Component library)
- [ ] @forge/i18n (Internationalization)
- [ ] @forge/feature-flags (Feature toggles)
- [ ] @forge/realtime (WebSocket client)

### Phase 4: Applications
- [ ] apps/portal (User portal - React)
- [ ] apps/admin (Admin portal - React)

### Phase 5: Features
- [ ] Code Analysis feature (ADR-038)
- [ ] AI-Readiness Assessment (ADR-039)

---

## Completed

_(Tasks move here when done)_

---

## Instructions for Claude

When you complete the CURRENT TASK:

1. **Update this file:**
   - Check off the completed task: `- [ ]` → `- [x]`
   - Move task details to COMPLETED section
   - Copy the NEXT unchecked task to "Current Task" section
   - Write new instructions based on the task

2. **If all tasks are done:**
   - Change Status to: `**Status:** BUILD COMPLETE`
   - Write "BUILD COMPLETE" as the Current Task

3. **Update build-state.json:**
   - Increment tasksCompleted
   - Update completedPackages array
   - Set currentTask to next task ID
