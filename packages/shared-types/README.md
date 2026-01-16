# @forge/shared-types

Shared TypeScript types and branded types for the Forge Factory platform.

## Overview

This package provides:
- **Branded types** for type-safe IDs (TenantId, UserId, etc.)
- **Common interfaces** used across the platform
- **Request context** types
- **Audit event** types
- **Utility types** for TypeScript

## Usage

```typescript
import { TenantId, UserId, RequestContext } from '@forge/shared-types';

function getUserByTenant(tenantId: TenantId, userId: UserId): User {
  // Type-safe IDs prevent mixing up parameters
  return database.user.findUnique({
    where: { tenantId, id: userId }
  });
}
```

## Branded Types

Branded types prevent accidental mixing of IDs:

```typescript
const tenantId: TenantId = 'tenant_123' as TenantId;
const userId: UserId = 'user_456' as UserId;

// This would cause a type error:
// getUserByTenant(userId, tenantId); // ERROR: Types don't match
```

## Regions

Multi-region support with compliance information:

```typescript
import { REGIONS, Region } from '@forge/shared-types';

const usRegion = REGIONS['us-east-1'];
// {
//   name: 'US East',
//   location: 'N. Virginia',
//   compliance: ['SOC2', 'HIPAA']
// }
```

## Request Context

Standard context passed through all requests:

```typescript
import { RequestContext } from '@forge/shared-types';

function handleRequest(ctx: RequestContext) {
  console.log(ctx.tenantId); // Current tenant
  console.log(ctx.userId); // Current user
  console.log(ctx.permissions); // User permissions
  console.log(ctx.region); // Current region
}
```

## Audit Events

Standardized audit event types for SIEM integration:

```typescript
import { AuditEvent, AuditEventType } from '@forge/shared-types';

const event: AuditEvent = {
  eventType: 'organization.created',
  severity: 'info',
  actor: { type: 'user', id: userId },
  resource: { type: 'organization', id: orgId },
  // ...
};
```

## License

MIT
