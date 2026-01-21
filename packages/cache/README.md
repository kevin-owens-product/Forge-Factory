# @forge/cache

Redis caching wrapper for Forge Factory with tenant isolation, connection pooling, and health checks.

## Features

- Redis connection management with configurable options
- Get/Set/Delete operations with TTL support
- JSON serialization/deserialization with special type handling
- Namespace support for tenant isolation
- Batch operations (getMany, setMany, deleteMany)
- Health check with server info
- Distributed locking
- Connection pooling support (via ioredis)
- Graceful shutdown support
- Comprehensive statistics tracking

## Installation

```bash
pnpm add @forge/cache
```

## Usage

### Basic Usage

```typescript
import { CacheService, getCacheService } from '@forge/cache';

// Using singleton
const cache = getCacheService({
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

// Initialize the service
await cache.initialize();

// Set a value
await cache.set('user:123', { name: 'John', email: 'john@example.com' });

// Get a value
const user = await cache.get<{ name: string; email: string }>('user:123');

// Delete a value
await cache.delete('user:123');

// Check existence
const exists = await cache.exists('user:123');

// Shutdown gracefully
await cache.shutdown();
```

### With TTL

```typescript
// Set with custom TTL (in seconds)
await cache.set('session:abc', sessionData, { ttlSeconds: 1800 }); // 30 minutes

// Set only if key doesn't exist
await cache.set('unique-key', value, { ifNotExists: true });

// Set only if key exists
await cache.set('existing-key', value, { ifExists: true });
```

### Batch Operations

```typescript
// Get multiple values
const result = await cache.getMany<User>(['user:1', 'user:2', 'user:3']);
console.log(result.found); // Map of found entries
console.log(result.missing); // Array of missing keys

// Set multiple values
const entries = new Map([
  ['key1', value1],
  ['key2', value2],
]);
await cache.setMany(entries, { ttlSeconds: 3600 });

// Delete multiple values
const deletedCount = await cache.deleteMany(['key1', 'key2', 'key3']);
```

### Get or Set Pattern

```typescript
// Get from cache, or compute and cache if missing
const user = await cache.getOrSet(
  'user:123',
  async () => {
    // Expensive operation - only called on cache miss
    return await fetchUserFromDatabase(123);
  },
  { ttlSeconds: 3600 }
);
```

### Tenant Isolation

```typescript
// Create a tenant-scoped cache
const tenantCache = cache.forTenant({ tenantId: 'tenant-123' });

// All operations are automatically namespaced
await tenantCache.set('config', { theme: 'dark' });
const config = await tenantCache.get('config');

// Data is isolated between tenants
const tenant1Cache = cache.forTenant({ tenantId: 'tenant-1' });
const tenant2Cache = cache.forTenant({ tenantId: 'tenant-2' });

await tenant1Cache.set('key', 'value1');
await tenant2Cache.set('key', 'value2');

// Each tenant sees their own data
await tenant1Cache.get('key'); // 'value1'
await tenant2Cache.get('key'); // 'value2'
```

### Distributed Locking

```typescript
// Acquire a lock
const lock = await cache.acquireLock('resource:123', {
  ttlMs: 10000,     // Lock expires after 10 seconds
  waitTimeMs: 5000, // Wait up to 5 seconds to acquire
});

if (lock.acquired) {
  try {
    // Do exclusive work
    await doExclusiveOperation();
  } finally {
    // Release the lock
    await cache.releaseLock('resource:123', lock.token!);
  }
}
```

### Health Checks

```typescript
const health = await cache.healthCheck();

console.log(health.healthy); // true/false
console.log(health.status); // 'connected' | 'disconnected' | 'error'
console.log(health.responseTimeMs); // Ping latency
console.log(health.serverInfo); // Redis server info
console.log(health.stats); // Cache statistics
```

### Statistics

```typescript
const stats = cache.getStats();

console.log(stats.hits); // Cache hits
console.log(stats.misses); // Cache misses
console.log(stats.hitRate); // Hit rate percentage
console.log(stats.totalOperations);
console.log(stats.avgLatencyMs);

// Reset statistics
cache.resetStats();
```

### Custom Redis Client

```typescript
import Redis from 'ioredis';
import { CacheService } from '@forge/cache';

const cache = new CacheService();

// Create and configure your own ioredis client
const redisClient = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'secret',
  // ... other ioredis options
});

// Inject the client
cache.setRedisClient(redisClient);

await cache.initialize();
```

## Configuration

```typescript
interface CacheConfig {
  redis: {
    host: string;              // Default: 'localhost'
    port: number;              // Default: 6379
    password?: string;
    db: number;                // Default: 0
    connectTimeoutMs: number;  // Default: 10000
    commandTimeoutMs: number;  // Default: 5000
    tls: boolean;              // Default: false
    keyPrefix: string;         // Default: 'forge:'
    retryAttempts: number;     // Default: 3
    retryDelayMs: number;      // Default: 100
    maxRetryDelayMs: number;   // Default: 3000
    enableReadyCheck: boolean; // Default: true
    maxReconnectAttempts: number; // Default: 10
    reconnectOnError: boolean; // Default: true
  };
  defaultTtlSeconds: number;   // Default: 3600 (1 hour)
  enableLogging: boolean;      // Default: false
  environment: 'development' | 'production' | 'test';
}
```

## API Reference

### CacheService

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize the cache connection |
| `shutdown(options?)` | Gracefully shutdown the connection |
| `get<T>(key, options?)` | Get a value from cache |
| `getWithMetadata<T>(key, options?)` | Get a value with TTL and size info |
| `set<T>(key, value, options?)` | Set a value in cache |
| `delete(key, options?)` | Delete a value |
| `exists(key, options?)` | Check if key exists |
| `getMany<T>(keys, options?)` | Get multiple values |
| `setMany<T>(entries, options?)` | Set multiple values |
| `deleteMany(keys, options?)` | Delete multiple values |
| `deleteByPattern(pattern, namespace?)` | Delete by pattern |
| `getOrSet<T>(key, factory, options?)` | Get or compute value |
| `acquireLock(key, options?)` | Acquire distributed lock |
| `releaseLock(key, token)` | Release distributed lock |
| `forTenant(context)` | Get tenant-scoped cache |
| `healthCheck()` | Perform health check |
| `getStats()` | Get cache statistics |
| `resetStats()` | Reset statistics |
| `getStatus()` | Get connection status |
| `isInitialized()` | Check if initialized |

### TenantCache

Same methods as CacheService but automatically namespaced by tenant ID.

## License

ISC
