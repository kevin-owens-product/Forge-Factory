# ADR-004: Multi-Layer Caching Strategy

## Status
Accepted

## Context
As a SaaS platform serving multiple tenants with real-time requirements, we need a comprehensive caching strategy that:
- Reduces database load
- Improves API response times (target p95 < 200ms)
- Maintains data consistency across tenants
- Supports real-time invalidation
- Scales with user growth
- Remains cost-effective

Without caching, every request would hit the database, leading to:
- High latency (p95 > 1s)
- Database connection exhaustion
- Poor user experience
- Higher infrastructure costs

## Decision
We will implement a **multi-layer caching strategy** using Redis as the primary cache, with careful invalidation policies to ensure data consistency.

### Cache Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Browser Cache (Static Assets)            │
│  TTL: 1 year                                        │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: CDN Cache (CloudFront)                    │
│  TTL: 1 hour (API), 1 day (assets)                  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3: Application Cache (Redis)                 │
│  TTL: Varies by data type                           │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Layer 4: Database Query Cache (PostgreSQL)         │
│  TTL: 5 minutes                                      │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Source: PostgreSQL Database                        │
└─────────────────────────────────────────────────────┘
```

## Implementation Details

### Layer 1: Browser Cache
**Purpose**: Static assets (JS, CSS, images, fonts)

**Configuration**:
```nginx
# Immutable assets (with hash in filename)
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# HTML (never cache)
location ~* \.html$ {
  expires -1;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### Layer 2: CDN Cache (CloudFront)
**Purpose**: API responses (read-heavy), static assets

**Configuration**:
```typescript
// API responses
Cache-Control: public, max-age=3600, s-maxage=3600
Vary: Authorization, Accept-Language

// Static assets
Cache-Control: public, max-age=86400, immutable
```

**Invalidation**:
- On deployment: Invalidate all API routes
- On asset change: New hash in filename (automatic cache bust)

### Layer 3: Application Cache (Redis)
**Primary caching layer for application data**

#### Cache Structure
```typescript
interface CacheKey {
  // Pattern: {type}:{tenantId}:{identifier}:{version?}

  // Examples:
  'session:{sessionId}'                    // TTL: 24h
  'user:{userId}'                          // TTL: 1h
  'organization:{tenantId}:{orgId}'        // TTL: 1h
  'permissions:{userId}'                   // TTL: 15m
  'api-key:{keyPrefix}'                    // TTL: 1h
  'rate-limit:{tenantId}:{endpoint}'       // TTL: 1m
  'llm-response:{hash}'                    // TTL: 7d
  'analytics:{tenantId}:realtime'          // TTL: 1m
}
```

#### Data Types and TTLs
| Data Type | TTL | Invalidation |
|-----------|-----|--------------|
| **Sessions** | 24 hours | On logout, password change |
| **User data** | 1 hour | On update, role change |
| **Organization data** | 1 hour | On update |
| **Permissions** | 15 minutes | On role change, permission update |
| **API keys** | 1 hour | On key rotation |
| **Rate limits** | 1 minute | Rolling window |
| **LLM responses** | 7 days | Never (immutable) |
| **Analytics aggregates** | 1 minute | On data update |
| **Feature flags** | 5 minutes | On flag change |

#### Cache Patterns

##### 1. Cache-Aside (Lazy Loading)
```typescript
async function getOrganization(orgId: string): Promise<Organization> {
  const cacheKey = `organization:${ctx.tenantId}:${orgId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss - fetch from DB
  const org = await prisma.organization.findUnique({
    where: { id: orgId, tenantId: ctx.tenantId }
  });

  // Store in cache
  await redis.setex(cacheKey, 3600, JSON.stringify(org));

  return org;
}
```

##### 2. Write-Through
```typescript
async function updateOrganization(
  orgId: string,
  data: UpdateOrganizationDto
): Promise<Organization> {
  // Update database
  const org = await prisma.organization.update({
    where: { id: orgId, tenantId: ctx.tenantId },
    data,
  });

  // Update cache
  const cacheKey = `organization:${ctx.tenantId}:${orgId}`;
  await redis.setex(cacheKey, 3600, JSON.stringify(org));

  // Invalidate related caches
  await invalidateOrganizationCaches(ctx.tenantId, orgId);

  return org;
}
```

##### 3. Read-Through (for heavy computations)
```typescript
async function getAnalyticsSummary(tenantId: TenantId): Promise<AnalyticsSummary> {
  const cacheKey = `analytics:${tenantId}:summary`;

  return await redis.getOrCompute(cacheKey, async () => {
    // Expensive aggregation
    const summary = await computeAnalyticsSummary(tenantId);
    return summary;
  }, {
    ttl: 300, // 5 minutes
  });
}
```

### Layer 4: Database Query Cache
**Purpose**: PostgreSQL shared_buffers and query result cache

**Configuration**:
```sql
-- PostgreSQL configuration
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
```

## Cache Invalidation Strategy

### Invalidation Patterns

#### 1. Time-Based (TTL)
Simplest approach - let cache expire naturally.
```typescript
await redis.setex(key, ttl, value);
```

#### 2. Event-Based
Invalidate on entity changes:
```typescript
// When organization updated
await redis.del(`organization:${tenantId}:${orgId}`);
await redis.del(`organization:${tenantId}:list`);
```

#### 3. Tag-Based
Group related cache keys:
```typescript
// Store with tags
await cacheService.set(key, value, {
  ttl: 3600,
  tags: [`tenant:${tenantId}`, `organization:${orgId}`]
});

// Invalidate all caches for a tenant
await cacheService.invalidateTag(`tenant:${tenantId}`);
```

#### 4. Version-Based
Increment version instead of deleting:
```typescript
// Store with version
const version = await redis.incr(`version:organization:${orgId}`);
const cacheKey = `organization:${orgId}:v${version}`;
await redis.setex(cacheKey, 3600, JSON.stringify(org));

// On update, increment version (old cache becomes stale)
await redis.incr(`version:organization:${orgId}`);
```

### Tenant Isolation
All cache keys include `tenantId` to prevent cross-tenant data leakage:
```typescript
// GOOD
`organization:${tenantId}:${orgId}`

// BAD - missing tenant isolation
`organization:${orgId}`
```

## Cache Service Interface

```typescript
interface CacheService {
  // Basic operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPattern(pattern: string): Promise<number>;

  // Advanced operations
  getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T>;

  // Tag-based invalidation
  setWithTags<T>(key: string, value: T, tags: string[], ttl?: number): Promise<void>;
  invalidateTag(tag: string): Promise<void>;

  // Multi-get (pipeline)
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: [string, T][], ttl?: number): Promise<void>;

  // Atomic operations
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;

  // Lists (for queues, real-time data)
  lpush(key: string, value: unknown): Promise<number>;
  rpop<T>(key: string): Promise<T | null>;

  // Pub/Sub (for cache invalidation across instances)
  publish(channel: string, message: unknown): Promise<void>;
  subscribe(channel: string, handler: (message: unknown) => void): void;
}
```

## React Query Integration (Client-Side)

### Server State Caching
```typescript
// apps/portal/src/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      cacheTime: 1000 * 60 * 30,      // 30 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
```

### Optimistic Updates
```typescript
const updateOrganization = useMutation({
  mutationFn: (data: UpdateOrgDto) => api.updateOrganization(orgId, data),
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['organization', orgId]);

    // Snapshot previous value
    const previous = queryClient.getQueryData(['organization', orgId]);

    // Optimistically update cache
    queryClient.setQueryData(['organization', orgId], newData);

    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['organization', orgId], context.previous);
  },
  onSettled: () => {
    // Refetch to sync with server
    queryClient.invalidateQueries(['organization', orgId]);
  },
});
```

## Cache Warming

### On Application Start
```typescript
async function warmCache() {
  // Preload frequently accessed data
  const activeTenantsCount = await prisma.tenant.count({
    where: { status: 'active' }
  });

  if (activeTenantsCount < 1000) {
    // Small dataset - warm all
    const tenants = await prisma.tenant.findMany({
      where: { status: 'active' }
    });

    for (const tenant of tenants) {
      await cacheService.set(
        `tenant:${tenant.id}`,
        tenant,
        3600
      );
    }
  }
}
```

### On Deployment (Zero Downtime)
1. New instances start with empty cache
2. Gradual cache warming via traffic
3. Optional: Copy cache from old instances

## Monitoring

### Metrics to Track
```typescript
// Prometheus metrics
cache_hits_total{layer="redis", type="organization"}
cache_misses_total{layer="redis", type="organization"}
cache_latency_seconds{layer="redis", operation="get"}
cache_size_bytes{layer="redis"}
cache_evictions_total{layer="redis", reason="maxmemory"}
```

### Cache Hit Rate Target
- **Overall**: > 80%
- **Session data**: > 95%
- **User data**: > 75%
- **LLM responses**: > 60%

### Alerts
```yaml
- alert: LowCacheHitRate
  expr: cache_hits_total / (cache_hits_total + cache_misses_total) < 0.8
  for: 10m
  annotations:
    summary: Cache hit rate below 80%

- alert: HighCacheLatency
  expr: cache_latency_seconds{operation="get", p99} > 0.01
  for: 5m
  annotations:
    summary: Cache GET latency above 10ms
```

## Cost Optimization

### Redis Sizing
```typescript
// Estimate cache size
const estimatedCacheSize = {
  sessions: 10000 * 2_000,           // 10k users × 2KB = 20MB
  users: 10000 * 5_000,              // 10k users × 5KB = 50MB
  organizations: 1000 * 10_000,      // 1k orgs × 10KB = 10MB
  permissions: 10000 * 1_000,        // 10k users × 1KB = 10MB
  llmResponses: 100000 * 5_000,      // 100k responses × 5KB = 500MB
  analytics: 1000 * 50_000,          // 1k tenants × 50KB = 50MB
  other: 100_000_000,                // 100MB buffer

  total: 740_000_000,                // ~740MB
};

// Recommendation: 2GB Redis instance (allows for 2.7x growth)
```

### Eviction Policy
```redis
maxmemory-policy allkeys-lru
```

When memory limit reached:
- Evict least recently used keys
- More important than evicting by TTL
- Ensures frequently accessed data stays cached

## Consequences

### Positive
- **Fast response times**: p95 < 200ms for cached data
- **Reduced database load**: 80% of reads served from cache
- **Better scalability**: Can handle 10x more users with same DB
- **Cost effective**: Redis much cheaper than scaling PostgreSQL
- **Improved user experience**: Instant page loads

### Negative
- **Complexity**: More moving parts, cache invalidation logic
- **Consistency challenges**: Stale data possible
- **Memory costs**: Redis infrastructure costs
- **Debugging harder**: Must check cache state during issues

### Mitigations
- **Clear invalidation rules**: Document when each cache is invalidated
- **Monitoring**: Track hit rates, latency, size
- **TTLs**: Aggressive TTLs prevent stale data (trade-off with hit rate)
- **Testing**: Property tests for cache consistency
- **Observability**: Redis logs, cache debugging tools

## Alternatives Considered

### 1. No Caching
**Rejected**: Would require massive database scaling, poor performance

### 2. In-Memory Cache (Node.js)
**Rejected**:
- Doesn't work across multiple instances
- Lost on deployment
- Can't share between services

### 3. Memcached
**Rejected**:
- Less feature-rich than Redis
- No pub/sub for cache invalidation
- No data structures (lists, sets, sorted sets)

### 4. Varnish
**Considered** for HTTP caching, but:
- CDN (CloudFront) provides same benefits
- Adds another layer of complexity

## Future Enhancements

### 1. Edge Caching
Deploy Redis to edge locations for lower latency:
```
User (EU) → CloudFront (EU) → Redis (EU) → API (US)
```

### 2. Cache Compression
For large objects:
```typescript
await redis.set(key, compress(JSON.stringify(largeObject)));
```

### 3. Probabilistic Data Structures
For approximate queries:
```typescript
// Bloom filter: "Has user X seen notification Y?"
await redis.bfAdd('notifications:seen', `${userId}:${notificationId}`);
```

### 4. Cache Precomputation
Background jobs to warm cache before data is requested:
```typescript
// Nightly job
async function precomputeAnalytics() {
  for (const tenant of activeTenants) {
    const analytics = await computeAnalytics(tenant.id);
    await cacheService.set(`analytics:${tenant.id}`, analytics, 86400);
  }
}
```

## References
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Caching Strategies](https://aws.amazon.com/caching/best-practices/)
- [React Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Cache Stampede Prevention](https://en.wikipedia.org/wiki/Cache_stampede)

## Review Date
2024-04-16 (3 months)
