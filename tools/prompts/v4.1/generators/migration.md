# Prompt: Database Migration Generator

**ID:** `forge-v4.1:generator:migration`
**Version:** 4.1.0
**Category:** Generators

## Purpose

Generate safe, reversible database migrations for schema changes with proper rollback support.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| migrationName | string | Yes | Descriptive name (e.g., "add-user-preferences") |
| changeType | string | Yes | Type of change (see below) |
| targetTable | string | Yes | Table being modified |
| changes | object | Yes | Specific changes to make |

## Change Types

1. **add_column** - Add new column(s)
2. **remove_column** - Remove column(s)
3. **modify_column** - Change column type/constraints
4. **add_index** - Add index(es)
5. **remove_index** - Remove index(es)
6. **add_table** - Create new table
7. **remove_table** - Drop table
8. **add_relation** - Add foreign key
9. **remove_relation** - Remove foreign key
10. **rename** - Rename table/column

## Safety Requirements

Per ADR-040 (Transformation Safety):
- All migrations must be reversible
- Data loss operations require explicit confirmation
- Large table changes need batching strategy
- Rollback must complete in < 5 minutes

## Generation Template

```
You are generating a database migration for the Forge Factory platform.

MIGRATION: {migrationName}
CHANGE TYPE: {changeType}
TARGET: {targetTable}

## Migration Safety Analysis

Before generating, analyze:
1. Table size (affects lock duration)
2. Data dependencies
3. Index rebuild time
4. Rollback complexity

## Prisma Schema Changes

Location: `packages/prisma/prisma/schema.prisma`

```prisma
// BEFORE (document current state)
model {TargetTable} {
  // current schema
}

// AFTER (show new state)
model {TargetTable} {
  // modified schema
}
```

## Migration Script

After schema change, run:
```bash
cd packages/prisma
pnpm prisma migrate dev --name {migration_name}
```

This generates: `prisma/migrations/{timestamp}_{migration_name}/migration.sql`

## Manual Migration (if needed)

For complex migrations requiring data transformation:

Location: `packages/prisma/src/migrations/{migration_name}.ts`

```typescript
/**
 * @prompt-id forge-v4.1:generator:migration:{migrationName}:001
 * @generated-at {timestamp}
 * @model claude-opus-4-5
 *
 * Migration: {migrationName}
 * Description: {description}
 * Reversible: Yes
 * Estimated Duration: {estimate}
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function up(): Promise<void> {
  console.log('Starting migration: {migrationName}');

  // For large tables, use batching
  const BATCH_SIZE = 1000;
  let processed = 0;

  while (true) {
    const batch = await prisma.{targetTable}.findMany({
      where: { /* condition for unmigrated records */ },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    await prisma.$transaction(
      batch.map(record =>
        prisma.{targetTable}.update({
          where: { id: record.id },
          data: { /* migration changes */ },
        })
      )
    );

    processed += batch.length;
    console.log(`Processed ${processed} records`);
  }

  console.log('Migration complete');
}

export async function down(): Promise<void> {
  console.log('Rolling back migration: {migrationName}');

  // Reverse the changes
  const BATCH_SIZE = 1000;
  let processed = 0;

  while (true) {
    const batch = await prisma.{targetTable}.findMany({
      where: { /* condition for migrated records */ },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    await prisma.$transaction(
      batch.map(record =>
        prisma.{targetTable}.update({
          where: { id: record.id },
          data: { /* reverse changes */ },
        })
      )
    );

    processed += batch.length;
    console.log(`Rolled back ${processed} records`);
  }

  console.log('Rollback complete');
}

// Validation function
export async function validate(): Promise<boolean> {
  const count = await prisma.{targetTable}.count({
    where: { /* condition for successful migration */ },
  });

  const total = await prisma.{targetTable}.count();

  console.log(`Validated: ${count}/${total} records migrated`);
  return count === total;
}
```

## Migration Checklist

Before Running:
- [ ] Schema changes reviewed
- [ ] Rollback tested locally
- [ ] Backup created
- [ ] Maintenance window scheduled (if needed)
- [ ] Monitoring in place

After Running:
- [ ] Validate migration success
- [ ] Check application health
- [ ] Monitor error rates
- [ ] Keep rollback ready for 24 hours

## Specific Change Type Templates

### Add Column

```prisma
// Add to model
newColumn String? @default("default_value")
```

```sql
-- Generated SQL
ALTER TABLE "{targetTable}" ADD COLUMN "newColumn" TEXT DEFAULT 'default_value';
```

Rollback:
```sql
ALTER TABLE "{targetTable}" DROP COLUMN "newColumn";
```

### Add Index

```prisma
@@index([fieldA, fieldB])
```

```sql
CREATE INDEX CONCURRENTLY "idx_{table}_{fields}"
ON "{targetTable}" ("fieldA", "fieldB");
```

Rollback:
```sql
DROP INDEX "idx_{table}_{fields}";
```

### Modify Column (Type Change)

**Warning:** Type changes may cause data loss. Requires:
1. Add new column
2. Migrate data
3. Drop old column
4. Rename new column

```typescript
async function up() {
  // Step 1: Add new column
  await prisma.$executeRaw`ALTER TABLE "{table}" ADD COLUMN "field_new" {newType}`;

  // Step 2: Migrate data
  await prisma.$executeRaw`
    UPDATE "{table}"
    SET "field_new" = CAST("field" AS {newType})
  `;

  // Step 3: Drop old, rename new
  await prisma.$executeRaw`ALTER TABLE "{table}" DROP COLUMN "field"`;
  await prisma.$executeRaw`ALTER TABLE "{table}" RENAME COLUMN "field_new" TO "field"`;
}
```

## Output Files

1. Modified: `packages/prisma/prisma/schema.prisma`
2. Generated: `packages/prisma/prisma/migrations/{timestamp}_{name}/migration.sql`
3. Optional: `packages/prisma/src/migrations/{name}.ts` (for data migrations)

## Estimated Impact

| Table Size | Lock Duration | Recommended Approach |
|------------|--------------|---------------------|
| < 10K rows | < 1 second | Direct migration |
| 10K - 100K | 1-10 seconds | Migration window |
| 100K - 1M | 10-60 seconds | Maintenance window |
| > 1M rows | Minutes | Online migration |
```

## Example Usages

### Example 1: Add Column
```
Add optional "preferences" JSON column to User table
```

### Example 2: Add Index
```
Add composite index on (tenantId, createdAt) to AuditLog table
for faster tenant-scoped queries
```

### Example 3: Complex Migration
```
Change "status" column from string to enum type
with data migration from old values to new enum values
```
