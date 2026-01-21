# Next Task

**Updated:** 2026-01-21

## Current Task

Build `@forge/database` package

## Instructions

Create the database connection management package following ADR-009.

### Files to Create

```
packages/database/
├── src/
│   ├── index.ts
│   ├── database.service.ts
│   ├── database.types.ts
│   ├── pool.ts
│   └── health.ts
├── __tests__/
│   └── database.service.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Key Requirements

1. Connection pooling with PgBouncer support
2. Tenant-aware connection handling
3. Health check endpoints
4. Graceful shutdown
5. 80%+ test coverage

### Reference

- ADR: `tools/adrs/009-connection-pooling.md`
- Template: `.claude/skills/build-package.md`

### When Complete

1. Run quality gates: `pnpm lint && pnpm test`
2. Commit: `git commit -m "feat(database): add @forge/database package"`
3. Update this file with next task
4. Update `.claude/build-state.json`

---

## Task Queue

1. ~~@forge/database~~ (current)
2. @forge/cache
3. @forge/queue
4. @forge/storage
5. @forge/auth
6. @forge/sso
7. @forge/roles
8. @forge/design-system
9. ... (see build-workflow.json)
