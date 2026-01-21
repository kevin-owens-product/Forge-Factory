# Prompt: Create Feature

**ID:** `forge-v4.1:feature:create-feature`
**Version:** 4.1.0
**Category:** Features

## Purpose

Generate a complete vertical slice feature including database schema, API endpoints, UI components, and tests.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| featureName | string | Yes | PascalCase name (e.g., "UserProfile") |
| adrReference | string | No | ADR number to reference (e.g., "ADR-012") |
| includeUI | boolean | No | Generate UI components (default: true) |
| tenantScoped | boolean | No | Include tenant isolation (default: true) |

## Context Requirements

Before using this prompt, ensure:
1. ADR for the feature exists and is approved
2. Database schema is defined in ADR
3. API contracts are specified
4. UI mockups/specs are available (if UI needed)

## Prompt Template

```
You are generating a complete vertical slice feature for the Forge Factory platform.

FEATURE: {featureName}
ADR REFERENCE: {adrReference}

## Requirements from ADR

{Paste relevant sections from ADR including:
- Data model
- API endpoints
- Business rules
- UI requirements}

## Generation Instructions

### 1. Database Layer

Create Prisma schema additions in `packages/prisma/prisma/schema.prisma`:

- Add model with all required fields
- Include tenant isolation: `tenantId String`
- Include audit fields: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- Add appropriate indexes
- Define relations

Example structure:
```prisma
model {FeatureName} {
  id        String   @id @default(cuid())
  tenantId  String
  // feature-specific fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?
  updatedBy String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  @@index([tenantId])
}
```

### 2. Package Layer

Create or update package `packages/{feature-name}/`:

**src/index.ts**
- Export all public APIs

**src/{feature}.service.ts**
- Business logic methods
- Input validation
- Error handling
- Audit logging calls

**src/{feature}.repository.ts**
- Prisma queries
- Tenant-scoped operations
- Pagination support

**src/{feature}.types.ts**
- TypeScript interfaces
- Zod schemas for validation

### 3. API Layer

Create NestJS module in `apps/api/src/modules/{feature}/`:

**{feature}.module.ts**
- Import dependencies
- Register providers

**{feature}.controller.ts**
- REST endpoints
- OpenAPI decorators
- Request validation
- Response formatting

**{feature}.dto.ts**
- Request DTOs
- Response DTOs
- Validation decorators

### 4. UI Layer (if includeUI)

Create React components in `apps/portal/src/features/{feature}/`:

**components/**
- {Feature}List.tsx
- {Feature}Detail.tsx
- {Feature}Form.tsx
- {Feature}Card.tsx

**hooks/**
- use{Feature}.ts (TanStack Query)
- use{Feature}Mutations.ts

**pages/**
- {Feature}ListPage.tsx
- {Feature}DetailPage.tsx

### 5. Tests

Generate test files achieving 80%+ coverage:

- Unit tests for service
- Unit tests for repository
- Integration tests for API
- Component tests for UI
- E2E tests for critical flows

## Output Files

List all files to be created with their full paths.

## Traceability

Add to every generated file:
```typescript
/**
 * @prompt-id forge-v4.1:feature:{featureName}:{sequence}
 * @generated-at {ISO-8601 timestamp}
 * @model claude-opus-4-5
 * @adr-ref {adrReference}
 */
```

## Quality Checks

After generation, verify:
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] All tests pass
- [ ] Coverage >= 80%
- [ ] No circular dependencies
- [ ] Tenant isolation enforced
- [ ] Audit logging present
```

## Example Usage

```
/create-feature UserProfile --adr ADR-012
```

## Success Criteria

Feature is complete when:
1. All files generated and compile
2. API endpoints respond correctly
3. UI renders and functions
4. Tests pass with 80%+ coverage
5. Prompt ID traceability in place
