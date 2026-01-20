# ADR-004: Caching Strategy

## Status
Accepted

## Context

Caching is critical for performance and cost optimization:
- **Reduce database load**: 70% of queries are cacheable
- **Improve API latency**: Target P95 < 200ms (vs. 800ms without cache)
- **Lower LLM costs**: Cache LLM responses (30-50% cost savings)
- **Handle traffic spikes**: Black Friday-style load surges

### Requirements
- Support 100K concurrent users
- Cache hit rate > 95% for hot data
- Cache invalidation < 100ms
- Multi-tenant cache isolation
- TTL policies per data type

## Decision

**Multi-Layer Caching Strategy**:

### 1. **Browser Cache** (Static Assets)
### 2. **CDN Cache** (CloudFront)
### 3. **React Query** (Client-Side API Cache)
### 4. **Redis** (Server-Side Data Cache)
### 5. **PostgreSQL Query Cache**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cache Hierarchy                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  L1: Browser Cache (Static Assets)                          │
│      Cache-Control: public, max-age=31536000, immutable     │
│      ├─ JS/CSS bundles (versioned URLs)                     │
│      ├─ Images, fonts                                        │
│      └─ Service Worker (offline support)                    │
│                                                               │
│  L2: CDN Cache (CloudFront)                                  │
│      Cache-Control: public, s-maxage=3600                   │
│      ├─ API responses (public data)                         │
│      ├─ Static pages                                         │
│      └─ Edge compute (Lambda@Edge)                          │
│                                                               │
│  L3: React Query (Client Memory)                            │
│      staleTime: 5 min, cacheTime: 10 min                    │
│      ├─ User data, repositories                             │
│      ├─ Analysis results                                     │
│      └─ Dashboard metrics                                    │
│                                                               │
│  L4: Redis (Server-Side)                                     │
│      TTL: 5 min to 24 hours (varies by data type)           │
│      ├─ API responses (per-tenant)                          │
│      ├─ LLM responses (by hash)                             │
│      ├─ Session data                                         │
│      └─ Rate limiting counters                              │
│                                                               │
│  L5: PostgreSQL (Query Result Cache)                        │
│      Built-in query plan cache                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Browser Cache (Static Assets)

**Next.js Configuration**:
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
}
```

### 2. CDN Cache (CloudFront)

**CloudFront Distribution**:
```typescript
// terraform/cloudfront.tf
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_lb.app.dns_name
    origin_id   = "forge-api"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "forge-api"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "X-Tenant-ID"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }
}
```

**API Response Caching**:
```typescript
// apps/api/src/plugins/cache-control.ts
export function setCacheControl(ttl: number, type: 'public' | 'private' = 'private') {
  return (request, reply, done) => {
    reply.header('Cache-Control', `${type}, max-age=${ttl}, stale-while-revalidate=${ttl * 2}`)
    done()
  }
}

// Usage
fastify.get('/api/v1/repositories', {
  onRequest: [fastify.authenticate],
  onSend: [setCacheControl(300, 'private')], // 5 min cache
}, handler)
```

### 3. React Query (Client Cache)

**Configuration** (from ADR-011):
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
})
```

### 4. Redis Cache (Server-Side)

**Redis Setup**:
```typescript
// apps/api/src/lib/redis.ts
import Redis from 'ioredis'

export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  keyPrefix: 'forge:',
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

export const redisCluster = new Redis.Cluster(
  [
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 },
  ],
  {
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
    },
  }
)
```

**Cache Patterns**:

**Pattern 1: Cache-Aside (Lazy Loading)**
```typescript
async function getRepository(id: string): Promise<Repository> {
  const cacheKey = `repository:${id}`

  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // Cache miss, fetch from database
  const repo = await db.repository.findUnique({ where: { id } })

  if (repo) {
    // Store in cache (5 min TTL)
    await redis.setex(cacheKey, 300, JSON.stringify(repo))
  }

  return repo
}
```

**Pattern 2: Write-Through**
```typescript
async function updateRepository(id: string, data: UpdateRepoData): Promise<Repository> {
  // Update database
  const repo = await db.repository.update({
    where: { id },
    data,
  })

  // Update cache immediately
  const cacheKey = `repository:${id}`
  await redis.setex(cacheKey, 300, JSON.stringify(repo))

  return repo
}
```

**Pattern 3: Cache Invalidation**
```typescript
async function deleteRepository(id: string): Promise<void> {
  // Delete from database
  await db.repository.delete({ where: { id } })

  // Invalidate cache
  await redis.del(`repository:${id}`)

  // Invalidate related caches
  await redis.del(`repositories:tenant:${repo.tenantId}`)
}
```

**Pattern 4: LLM Response Caching**
```typescript
async function callLLM(prompt: string, model: string): Promise<string> {
  // Create cache key (hash of prompt + model)
  const cacheKey = `llm:${hashString(prompt + model)}`

  // Check cache
  const cached = await redis.get(cacheKey)
  if (cached) {
    return cached
  }

  // Call LLM API
  const response = await anthropic.messages.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0].text

  // Cache for 7 days (LLM responses are deterministic)
  await redis.setex(cacheKey, 7 * 24 * 60 * 60, content)

  return content
}
```

### TTL Policies by Data Type

```typescript
const TTL_POLICIES = {
  // User data (frequently accessed, changes rarely)
  'user:*': 15 * 60, // 15 minutes

  // Repository data (moderate frequency)
  'repository:*': 5 * 60, // 5 minutes

  // Analysis results (infrequent changes)
  'analysis:*': 60 * 60, // 1 hour

  // LLM responses (deterministic, cache aggressively)
  'llm:*': 7 * 24 * 60 * 60, // 7 days

  // Session data (short-lived)
  'session:*': 15 * 60, // 15 minutes

  // Rate limiting counters (very short-lived)
  'rate_limit:*': 60, // 1 minute

  // API responses (per-tenant, moderate TTL)
  'api:*': 5 * 60, // 5 minutes
}
```

### Multi-Tenant Cache Isolation

**Key Naming Convention**:
```typescript
// Include tenant ID in cache key
const cacheKey = `repositories:tenant:${tenantId}`

// Invalidate all caches for a tenant
async function invalidateTenantCache(tenantId: string) {
  const pattern = `*:tenant:${tenantId}:*`
  const keys = await redis.keys(pattern)

  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

### Cache Warming

**Pre-populate hot data on startup**:
```typescript
// apps/api/src/server.ts
fastify.addHook('onReady', async () => {
  console.log('Warming cache...')

  // Fetch top 100 repositories
  const repos = await db.repository.findMany({
    take: 100,
    orderBy: { accessCount: 'desc' },
  })

  // Store in cache
  for (const repo of repos) {
    await redis.setex(
      `repository:${repo.id}`,
      300,
      JSON.stringify(repo)
    )
  }

  console.log(`Warmed cache with ${repos.length} repositories`)
})
```

## Monitoring

**Cache Metrics**:
```typescript
// Track cache hit/miss rates
fastify.addHook('onResponse', async (request, reply) => {
  const cacheHit = reply.getHeader('X-Cache-Status') === 'HIT'

  await datadog.increment('cache.requests', 1, {
    status: cacheHit ? 'hit' : 'miss',
    endpoint: request.routerPath,
  })
})

// Redis metrics
setInterval(async () => {
  const info = await redis.info('stats')
  const hits = parseFloat(info.match(/keyspace_hits:(\d+)/)?.[1] || '0')
  const misses = parseFloat(info.match(/keyspace_misses:(\d+)/)?.[1] || '0')
  const hitRate = hits / (hits + misses)

  await datadog.gauge('redis.hit_rate', hitRate)
}, 60000)
```

## Consequences

### Positive
- **95%+ cache hit rate** for hot data
- **70% reduction in database load**
- **30-50% LLM cost savings** via response caching
- **Sub-200ms API latency** (P95)

### Negative
- **Cache invalidation complexity**
- **Memory cost** (~$100-500/month for Redis)
- **Stale data risk** (must tune TTLs carefully)

### Mitigations
- Clear invalidation patterns (write-through, delete on update)
- Redis Cluster for high availability
- Short TTLs for critical data (5 min default)

## References
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- ADR-011: State Management (React Query caching)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
