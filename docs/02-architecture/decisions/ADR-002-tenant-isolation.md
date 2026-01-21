# ADR-002: Tenant Isolation Strategy

## Status
Accepted

## Context
As a multi-tenant SaaS platform, we must ensure complete data isolation between tenants for security and compliance. We need to choose between:
1. Separate database per tenant
2. Shared database with schema per tenant
3. Shared database with shared schema, row-level filtering

## Decision
We will use **shared database with shared schema and row-level isolation** enforced at the application layer and PostgreSQL Row-Level Security (RLS).

### Implementation

#### 1. Database Level
Every table includes `tenantId`:
```prisma
model Organization {
  id        String   @id @default(cuid())
  tenantId  String   // Required on every table
  name      String
  // ...

  @@index([tenantId])
}
```

#### 2. Application Level
All queries automatically include `tenantId`:
```typescript
const tenantDb = createTenantClient(ctx.tenantId);
const orgs = await tenantDb.organization.findMany();
// Automatically includes: where: { tenantId: ctx.tenantId }
```

#### 3. API Guards
NestJS guard validates tenant access:
```typescript
@Controller('organizations')
@UseGuards(TenantGuard)
export class OrganizationController {
  // All endpoints automatically scoped to tenant
}
```

#### 4. PostgreSQL RLS (Future)
Additional safety via database-level policies:
```sql
CREATE POLICY tenant_isolation ON organizations
  USING (tenant_id = current_setting('app.current_tenant')::text);
```

### Property-Based Testing
Every query is tested with property-based tests to verify tenant isolation:
```typescript
fc.assert(
  fc.property(fc.string(), fc.string(), async (tenantA, tenantB) => {
    const resultA = await getTenantData(tenantA);
    const resultB = await getTenantData(tenantB);

    // Verify no data leakage
    expect(resultA.every(r => r.tenantId === tenantA)).toBe(true);
    expect(resultB.every(r => r.tenantId === tenantB)).toBe(true);
  })
);
```

## Consequences

### Positive
- **Cost efficient**: Single database infrastructure
- **Easier operations**: One database to backup, monitor, upgrade
- **Better resource utilization**: Shared connection pool
- **Simpler scaling**: Add resources to single database initially

### Negative
- **Noisy neighbor**: One tenant can impact others (mitigated by query limits)
- **Accidental data leakage risk**: Must be vigilant in code review
- **Complex migrations**: Must handle large tables carefully

### Mitigations
- **Mandatory `tenantId` in queries**: Enforced by typed client
- **Property-based tests**: Verify isolation on all queries
- **Database-level RLS**: Additional safety net
- **Code review**: All data access reviewed for tenant isolation
- **CI checks**: Automated tests for tenant isolation
- **Query timeouts**: Prevent runaway queries
- **Connection pooling**: Prevent connection exhaustion

## Multi-Tenancy Levels

### Level 1: Database-Per-Tenant
Future option for enterprise customers requiring complete isolation.

### Level 2: Schema-Per-Tenant
Not implemented, but possible if needed.

### Level 3: Shared Schema (Current)
What we're implementing now.

## Data Residency
For multi-region compliance:
- Each region has its own database
- Tenant data stays in assigned region
- Cross-region queries prohibited
- Region assignment immutable

## Alternatives Considered

### Separate Database Per Tenant
**Rejected**:
- Operational complexity (1000s of databases)
- Cost (minimum resources per database)
- Harder to do analytics across tenants

### Separate Schema Per Tenant
**Rejected**:
- Still complex (manage 1000s of schemas)
- Connection management difficult
- Limited schema count in PostgreSQL

## References
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma Multi-Tenancy](https://www.prisma.io/docs/guides/database/multi-tenancy)

## Review Date
2024-04-16 (3 months)
