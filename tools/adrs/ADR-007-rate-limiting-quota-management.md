# ADR-007: API Rate Limiting & Quota Management

## Status
Accepted

## Context

Rate limiting is essential for:
- **Fair Usage**: Prevent single tenant from monopolizing resources
- **DDoS Protection**: Protect against abuse and attacks
- **Cost Control**: Limit expensive LLM calls
- **Tiered Access**: Enforce pricing tier limits

### Requirements
- Support 4 pricing tiers (Free, Team, Business, Enterprise)
- Enforce LOC quotas (10K, 100K, 500K, unlimited)
- API rate limits (100, 1000, 5000, 10000 req/min)
- Soft vs. hard limits (warn vs. block)
- Per-user and per-tenant limits

## Decision

**Multi-Layer Rate Limiting**:
### 1. **API Gateway** (CloudFront/AWS WAF) - DDoS Protection
### 2. **Fastify Plugin** (@fastify/rate-limit) - Tier-Based Limits
### 3. **Redis** - Distributed Rate Limit Counters
### 4. **PostgreSQL** - Usage Quotas (Monthly LOC)

## Architecture

```typescript
┌─────────────────────────────────────────────────────────────┐
│                  Rate Limiting Layers                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  L1: CloudFront + AWS WAF (10K req/s per IP)                │
│       └─ Block suspicious traffic (geo, IP reputation)      │
│                                                               │
│  L2: Fastify Rate Limit (Tier-Based)                        │
│       ├─ Free: 100 req/min                                   │
│       ├─ Team: 1000 req/min                                  │
│       ├─ Business: 5000 req/min                              │
│       └─ Enterprise: 10000 req/min                           │
│                                                               │
│  L3: Usage Quotas (Monthly LOC)                              │
│       ├─ Free: 10K LOC/month                                 │
│       ├─ Team: 100K LOC/month + overage billing             │
│       ├─ Business: 500K LOC/month + overage billing         │
│       └─ Enterprise: Unlimited                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Tier-Based Rate Limiting

**Rate Limits by Tier**:
```typescript
const RATE_LIMITS = {
  free: { max: 100, timeWindow: 60 * 1000 }, // 100 req/min
  team: { max: 1000, timeWindow: 60 * 1000 }, // 1000 req/min
  business: { max: 5000, timeWindow: 60 * 1000 }, // 5000 req/min
  enterprise: { max: 10000, timeWindow: 60 * 1000 }, // 10000 req/min
}
```

**Fastify Plugin**:
```typescript
// apps/api/src/plugins/rate-limit.ts
import rateLimit from '@fastify/rate-limit'

export default fp(async (fastify) => {
  await fastify.register(rateLimit, {
    global: false, // We'll apply selectively
    redis: fastify.redis, // Use Redis for distributed counters
    keyGenerator: (request) => {
      // Rate limit per tenant (not per user)
      return `rate-limit:${request.user.currentTenantId}`
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${context.max} req/${context.timeWindow}ms`,
        retryAfter: context.ttl, // Milliseconds until reset
      }
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  })

  // Decorator to apply tier-based rate limiting
  fastify.decorate('rateLimitByTier', (request, reply, done) => {
    const tier = request.user.organization.tier // 'free', 'team', 'business', 'enterprise'
    const limits = RATE_LIMITS[tier]

    // Apply rate limit
    fastify.rateLimit({
      max: limits.max,
      timeWindow: limits.timeWindow,
    })(request, reply, done)
  })
})
```

**Usage**:
```typescript
// apps/api/src/features/analysis/routes.ts
fastify.post('/analyses', {
  onRequest: [
    fastify.authenticate,
    fastify.rateLimitByTier, // Apply tier-based rate limiting
  ],
}, async (request, reply) => {
  // Create analysis
})
```

### 2. Usage Quotas (Monthly LOC)

**Quota Limits**:
```typescript
const LOC_QUOTAS = {
  free: 10_000, // 10K LOC/month (hard limit)
  team: 100_000, // 100K LOC/month (soft limit, overage billing)
  business: 500_000, // 500K LOC/month (soft limit, overage billing)
  enterprise: null, // Unlimited
}

const OVERAGE_PRICING = {
  team: 0.001, // $0.001/LOC
  business: 0.0008, // $0.0008/LOC
}
```

**Check Quota Before Analysis**:
```typescript
// apps/api/src/features/analysis/routes.ts
fastify.post('/analyses', {
  onRequest: [
    fastify.authenticate,
    fastify.rateLimitByTier,
    checkUsageQuota, // New middleware
  ],
}, async (request, reply) => {
  // ...
})

async function checkUsageQuota(request, reply) {
  const { currentTenantId } = request.user
  const { repositoryId } = request.body

  // Get repository size
  const repo = await db.repository.findUnique({
    where: { id: repositoryId },
    select: { linesOfCode: true },
  })

  // Get current month's usage
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const usage = await db.usage.aggregate({
    where: {
      tenantId: currentTenantId,
      createdAt: { gte: startOfMonth },
    },
    _sum: {
      linesOfCode: true,
    },
  })

  const currentUsage = usage._sum.linesOfCode || 0
  const newUsage = currentUsage + repo.linesOfCode

  const tier = request.user.organization.tier
  const quota = LOC_QUOTAS[tier]

  // Hard limit (Free tier)
  if (tier === 'free' && newUsage > quota) {
    return reply.code(402).send({
      error: 'Quota exceeded',
      message: `You've used ${currentUsage.toLocaleString()} of ${quota.toLocaleString()} LOC this month. Upgrade to continue.`,
      upgrade_url: '/billing/upgrade',
    })
  }

  // Soft limit (Paid tiers) - allow overage with billing
  if (quota && newUsage > quota && tier !== 'enterprise') {
    const overage = newUsage - quota
    const overageCost = overage * OVERAGE_PRICING[tier]

    // Warn user about overage
    reply.header('X-Quota-Warning', `Overage: ${overage} LOC ($${overageCost.toFixed(2)})`)
  }

  // Track usage (for billing)
  await db.usage.create({
    data: {
      tenantId: currentTenantId,
      userId: request.user.id,
      type: 'analysis',
      linesOfCode: repo.linesOfCode,
      metadata: { repositoryId, analysisId: request.body.analysisId },
    },
  })
}
```

### 3. Per-Endpoint Rate Limits

**Special limits for expensive endpoints**:
```typescript
// LLM calls are expensive, stricter limits
fastify.post('/refactoring/jobs', {
  onRequest: [
    fastify.authenticate,
    fastify.rateLimit({
      max: 10, // Max 10 refactoring jobs...
      timeWindow: 60 * 60 * 1000, // ...per hour
    }),
  ],
}, async (request, reply) => {
  // Create refactoring job
})

// Webhook deliveries (prevent abuse)
fastify.post('/webhooks/test', {
  onRequest: [
    fastify.authenticate,
    fastify.rateLimit({
      max: 5, // Max 5 test webhooks...
      timeWindow: 60 * 1000, // ...per minute
    }),
  ],
}, async (request, reply) => {
  // Send test webhook
})
```

### 4. Bypass for Enterprise

**Whitelist enterprise customers**:
```typescript
fastify.decorate('rateLimitByTier', (request, reply, done) => {
  const tier = request.user.organization.tier

  // Skip rate limiting for enterprise
  if (tier === 'enterprise') {
    return done()
  }

  const limits = RATE_LIMITS[tier]
  fastify.rateLimit({
    max: limits.max,
    timeWindow: limits.timeWindow,
  })(request, reply, done)
})
```

### 5. CloudFront + AWS WAF (DDoS Protection)

**WAF Rules**:
```hcl
# terraform/waf.tf
resource "aws_wafv2_web_acl" "main" {
  name  = "forge-factory-waf"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rule 1: Rate limit per IP (10K req/5 min)
  rule {
    name     = "rate-limit-per-ip"
    priority = 1

    statement {
      rate_based_statement {
        limit              = 10000
        aggregate_key_type = "IP"
      }
    }

    action {
      block {}
    }
  }

  # Rule 2: Geo-blocking (if needed)
  rule {
    name     = "geo-blocking"
    priority = 2

    statement {
      geo_match_statement {
        country_codes = ["CN", "RU"] # Example: block certain countries
      }
    }

    action {
      block {}
    }
  }

  # Rule 3: IP reputation (AWS Managed Rules)
  rule {
    name     = "aws-ip-reputation"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }
  }
}
```

## Monitoring

**Track Rate Limit Violations**:
```typescript
fastify.addHook('onResponse', async (request, reply) => {
  if (reply.statusCode === 429) {
    await datadog.increment('rate_limit.exceeded', 1, {
      endpoint: request.routerPath,
      tier: request.user.organization.tier,
    })
  }
})
```

**Dashboard Metrics**:
- **Rate Limit Hits**: Count of 429 responses per tier/endpoint
- **Quota Usage**: % of monthly quota used
- **Overage**: $ amount of overage charges per tenant
- **Top Consumers**: Tenants approaching limits

## Consequences

### Positive
- **Fair Usage**: No single tenant monopolizes resources
- **DDoS Protection**: Multi-layer defense
- **Revenue Protection**: Enforce pricing tiers
- **Cost Control**: Limit expensive operations

### Negative
- **User Friction**: Legitimate users may hit limits
- **Support Burden**: "Why was I rate limited?" tickets
- **Complexity**: Multiple rate limiting layers

### Mitigations
- Clear error messages with retry-after headers
- Usage dashboard showing current quota
- Proactive alerts at 80% quota usage
- Easy self-service upgrade flow

## References
- [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit)
- [AWS WAF](https://aws.amazon.com/waf/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
