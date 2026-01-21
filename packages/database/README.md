# @forge/database

Database connection management package for Forge Factory.

## Features

- Connection pooling with configurable pool size
- Tenant-aware connection handling
- Health check utilities
- Graceful shutdown support
- Query metrics tracking

## Installation

```bash
pnpm add @forge/database
```

## Usage

### Basic Setup

```typescript
import { getDatabaseService } from '@forge/database';

const db = getDatabaseService({
  pool: {
    minConnections: 2,
    maxConnections: 10,
  },
  enableLogging: true,
});

await db.initialize();
```

### Tenant-Scoped Queries

```typescript
const tenantClient = db.getTenantClient({
  tenantId: 'tenant-123',
  correlationId: 'request-abc',
});

const users = await tenantClient.user.findMany();
```

### Health Checks

```typescript
const health = await db.healthCheck();
console.log(health.healthy); // true/false
console.log(health.poolStats); // { totalConnections, activeConnections, ... }
```

### Graceful Shutdown

```typescript
await db.shutdown({
  timeoutMs: 10000,
  forceAfterTimeout: true,
});
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `pool.minConnections` | 2 | Minimum connections in pool |
| `pool.maxConnections` | 10 | Maximum connections in pool |
| `pool.connectionTimeoutMs` | 5000 | Connection acquisition timeout |
| `pool.idleTimeoutMs` | 30000 | Idle connection timeout |
| `pool.maxLifetimeMs` | 3600000 | Maximum connection lifetime |
| `enableLogging` | false | Enable query logging |

## API Reference

### DatabaseService

- `initialize()` - Initialize the database service
- `getTenantClient(context)` - Get tenant-scoped client
- `getRawClient()` - Get raw Prisma client
- `executeQuery(fn, options)` - Execute a query
- `executeTenantQuery(context, fn, options)` - Execute tenant-scoped query
- `executeTransaction(fn, options)` - Execute transaction
- `healthCheck()` - Perform health check
- `getPoolStats()` - Get pool statistics
- `shutdown(options)` - Graceful shutdown

### ConnectionPool

- `initialize()` - Initialize the pool
- `acquire(timeout)` - Acquire a connection
- `release(connection)` - Release a connection
- `getStats()` - Get pool statistics
- `shutdown(options)` - Shutdown the pool
