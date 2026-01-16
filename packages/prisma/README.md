# @forge/prisma

Prisma ORM schema and database client for the Forge Factory platform.

## Overview

This package provides:
- **Multi-tenant database schema** with Row-Level Security
- **Prisma client** with tenant isolation
- **Type-safe database queries**
- **Migration management**

## Schema Highlights

### Multi-Tenancy
Every table includes `tenantId` to ensure data isolation:

```prisma
model Organization {
  id        String   @id @default(cuid())
  tenantId  String   // Tenant isolation
  name      String
  // ...
}
```

### Key Models

- **Tenant**: Organization/company using the platform
- **User**: Platform users with roles and permissions
- **Session**: User sessions with device tracking
- **ApiKey**: API keys for programmatic access
- **Role**: Custom roles with granular permissions
- **ApprovalPolicy**: Approval workflow configurations
- **ApprovalRequest**: Pending approval requests
- **SandboxEnvironment**: Demo/trial environments
- **SiemConfig**: Audit log export configuration
- **SamlConfig**: SAML SSO configuration
- **ScimConfig**: SCIM user provisioning
- **Organization**: The first feature (organization management)
- **AuditLog**: Security audit trail

## Usage

### Basic Queries

```typescript
import { db } from '@forge/prisma';

// Get all organizations for a tenant
const orgs = await db.organization.findMany({
  where: { tenantId: 'tenant_123' }
});
```

### Tenant-Isolated Client

```typescript
import { createTenantClient } from '@forge/prisma';

const tenantDb = createTenantClient('tenant_123');

// tenantId is automatically included
const orgs = await tenantDb.organization.findMany();
```

## Migrations

```bash
# Create a new migration
pnpm migrate:dev --name add_new_table

# Apply migrations to production
pnpm migrate:deploy

# Reset database (dev only)
pnpm migrate:reset

# Open Prisma Studio
pnpm studio
```

## Connection Pooling

This package is configured to work with PgBouncer:

- `DATABASE_URL`: Points to PgBouncer for application queries
- `DATABASE_DIRECT_URL`: Direct connection for migrations

## License

MIT
