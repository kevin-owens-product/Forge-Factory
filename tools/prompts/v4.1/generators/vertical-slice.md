# Prompt: Vertical Slice Generator

**ID:** `forge-v4.1:generator:vertical-slice`
**Version:** 4.1.0
**Category:** Generators

## Purpose

Generate a complete vertical slice following ADR-001 architecture. A vertical slice includes all layers from database to UI for a single feature/entity.

## Vertical Slice Anatomy

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Pages     │ │ Components  │ │   Hooks     │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Controller  │ │    DTOs     │ │  Middleware │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Service   │ │ Validators  │ │   Events    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Repository  │ │   Prisma    │ │    Cache    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entityName | string | Yes | Singular entity name (e.g., "Project") |
| pluralName | string | No | Plural form (defaults to entityName + 's') |
| fields | object[] | Yes | Entity fields definition |
| operations | string[] | No | CRUD operations to include |
| relations | object[] | No | Related entities |

## Field Definition

```typescript
interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'enum';
  required: boolean;
  unique?: boolean;
  indexed?: boolean;
  enumValues?: string[];
  default?: any;
  description: string;
}
```

## Generation Template

```
You are generating a complete vertical slice for the Forge Factory platform.

ENTITY: {entityName}
PLURAL: {pluralName}

## Entity Definition

Fields:
{For each field:}
- {field.name}: {field.type} {field.required ? '(required)' : '(optional)'}
  Description: {field.description}

Relations:
{For each relation:}
- {relation.name}: {relation.type} -> {relation.target}

## Layer-by-Layer Generation

### 1. Database Layer (Prisma Schema)

Location: `packages/prisma/prisma/schema.prisma`

```prisma
/**
 * @prompt-id forge-v4.1:generator:vertical-slice:{entityName}:001
 */
model {EntityName} {
  id        String   @id @default(cuid())
  tenantId  String

  // Entity fields
  {For each field:}
  {field.name} {PrismaType} {field.required ? '' : '?'} {field.unique ? '@unique' : ''} {field.default ? `@default(${field.default})` : ''}

  // Audit fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?
  updatedBy String?
  deletedAt DateTime? // Soft delete

  // Relations
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  {For each relation:}
  {relation.name} {relation.target} @relation(...)

  // Indexes
  @@index([tenantId])
  @@index([tenantId, createdAt])
  {For each indexed field:}
  @@index([tenantId, {field.name}])
}
```

### 2. Package Layer

Location: `packages/{entity-name}/`

**src/index.ts**
```typescript
/**
 * @prompt-id forge-v4.1:generator:vertical-slice:{entityName}:002
 */
export * from './{entity-name}.service';
export * from './{entity-name}.repository';
export * from './{entity-name}.types';
export * from './{entity-name}.errors';
```

**src/{entity-name}.types.ts**
```typescript
/**
 * @prompt-id forge-v4.1:generator:vertical-slice:{entityName}:003
 */
import { z } from 'zod';

// Zod Schemas
export const {EntityName}Schema = z.object({
  {For each field:}
  {field.name}: z.{zodType}(){field.required ? '' : '.optional()'},
});

export const Create{EntityName}Schema = {EntityName}Schema.omit({ id: true });
export const Update{EntityName}Schema = Create{EntityName}Schema.partial();

// TypeScript Types
export type {EntityName} = z.infer<typeof {EntityName}Schema>;
export type Create{EntityName}Input = z.infer<typeof Create{EntityName}Schema>;
export type Update{EntityName}Input = z.infer<typeof Update{EntityName}Schema>;

// Query types
export interface {EntityName}Query {
  tenantId: string;
  page?: number;
  limit?: number;
  sortBy?: keyof {EntityName};
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Partial<{EntityName}>;
}

export interface {EntityName}List {
  data: {EntityName}[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

**src/{entity-name}.repository.ts**
```typescript
/**
 * @prompt-id forge-v4.1:generator:vertical-slice:{entityName}:004
 */
import { PrismaClient } from '@prisma/client';
import { {EntityName}, {EntityName}Query, {EntityName}List, Create{EntityName}Input, Update{EntityName}Input } from './{entity-name}.types';

export class {EntityName}Repository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<{EntityName} | null> {
    return this.prisma.{entityName}.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findMany(query: {EntityName}Query): Promise<{EntityName}List> {
    const { tenantId, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', filters } = query;

    const where = {
      tenantId,
      deletedAt: null,
      ...filters,
    };

    const [data, total] = await Promise.all([
      this.prisma.{entityName}.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.{entityName}.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: Create{EntityName}Input, tenantId: string, userId: string): Promise<{EntityName}> {
    return this.prisma.{entityName}.create({
      data: {
        ...data,
        tenantId,
        createdBy: userId,
      },
    });
  }

  async update(id: string, data: Update{EntityName}Input, tenantId: string, userId: string): Promise<{EntityName}> {
    return this.prisma.{entityName}.update({
      where: { id, tenantId },
      data: {
        ...data,
        updatedBy: userId,
      },
    });
  }

  async delete(id: string, tenantId: string, userId: string): Promise<void> {
    await this.prisma.{entityName}.update({
      where: { id, tenantId },
      data: {
        deletedAt: new Date(),
        updatedBy: userId,
      },
    });
  }
}
```

**src/{entity-name}.service.ts**
```typescript
/**
 * @prompt-id forge-v4.1:generator:vertical-slice:{entityName}:005
 */
import { {EntityName}Repository } from './{entity-name}.repository';
import { {EntityName}, Create{EntityName}Input, Update{EntityName}Input, {EntityName}Query, {EntityName}List } from './{entity-name}.types';
import { {EntityName}NotFoundError } from './{entity-name}.errors';
import { AuditService } from '@forge/audit';

export class {EntityName}Service {
  constructor(
    private readonly repository: {EntityName}Repository,
    private readonly auditService: AuditService,
  ) {}

  async getById(id: string, tenantId: string): Promise<{EntityName}> {
    const entity = await this.repository.findById(id, tenantId);
    if (!entity) {
      throw new {EntityName}NotFoundError(id);
    }
    return entity;
  }

  async list(query: {EntityName}Query): Promise<{EntityName}List> {
    return this.repository.findMany(query);
  }

  async create(data: Create{EntityName}Input, tenantId: string, userId: string): Promise<{EntityName}> {
    const entity = await this.repository.create(data, tenantId, userId);

    await this.auditService.log({
      action: '{ENTITY_NAME}_CREATED',
      entityType: '{EntityName}',
      entityId: entity.id,
      tenantId,
      userId,
      newValues: data,
    });

    return entity;
  }

  async update(id: string, data: Update{EntityName}Input, tenantId: string, userId: string): Promise<{EntityName}> {
    const existing = await this.getById(id, tenantId);

    const updated = await this.repository.update(id, data, tenantId, userId);

    await this.auditService.log({
      action: '{ENTITY_NAME}_UPDATED',
      entityType: '{EntityName}',
      entityId: id,
      tenantId,
      userId,
      oldValues: existing,
      newValues: data,
    });

    return updated;
  }

  async delete(id: string, tenantId: string, userId: string): Promise<void> {
    await this.getById(id, tenantId); // Verify exists

    await this.repository.delete(id, tenantId, userId);

    await this.auditService.log({
      action: '{ENTITY_NAME}_DELETED',
      entityType: '{EntityName}',
      entityId: id,
      tenantId,
      userId,
    });
  }
}
```

### 3. API Layer (NestJS)

Location: `apps/api/src/modules/{entity-name}/`

{Generate controller, DTOs, module as in add-api-endpoint template}

### 4. UI Layer (React)

Location: `apps/portal/src/features/{entity-name}/`

{Generate pages, components, hooks}

### 5. Tests

{Generate comprehensive tests for all layers}

## Output Summary

Files generated:
1. `packages/prisma/prisma/schema.prisma` (modified)
2. `packages/{entity-name}/` (new directory with 6 files)
3. `apps/api/src/modules/{entity-name}/` (new directory with 4 files)
4. `apps/portal/src/features/{entity-name}/` (new directory with 8 files)
5. Test files for each layer

Total estimated files: ~25
Total estimated lines: ~2,000
```

## Example Usage

```
Generate vertical slice for "TransformationProject" entity:
- name: string (required)
- description: string (optional)
- status: enum (draft, active, completed, archived)
- startDate: date (optional)
- endDate: date (optional)
- budget: number (optional)
- customerId: relation to Customer
```
