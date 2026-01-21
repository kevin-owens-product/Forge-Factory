# ADR-060: Usage Tracking & Quota Enforcement

**Status:** Accepted
**Date:** 2026-01-21
**Priority:** P1 - Enterprise Ready
**Complexity:** High

---

## Context

Usage-based billing requires accurate tracking of resource consumption. Quota enforcement prevents abuse and ensures fair resource distribution. This system must be highly available, accurate, and performant.

### Business Requirements

- **Accuracy:** <0.1% discrepancy in usage tracking
- **Real-time:** Sub-second quota checks
- **Scale:** Handle 10K+ requests/second
- **Reliability:** 99.99% availability for quota checks
- **Flexibility:** Support multiple metering dimensions
- **Billing:** Generate accurate invoices

### Usage Metrics

| Metric | Unit | Billing Impact |
|--------|------|----------------|
| API Calls | Requests | Per-request pricing |
| LLM Tokens | Tokens | Primary cost driver |
| Storage | GB-hours | Storage tier pricing |
| Compute | CPU-hours | Processing costs |
| Transformations | Count | Feature usage |
| Users | Seats | Per-seat licensing |

### Quota Types

| Type | Enforcement | Example |
|------|-------------|---------|
| Hard | Reject over limit | API rate limit |
| Soft | Allow with warning | Storage approaching limit |
| Burst | Allow temporary spike | Traffic burst |
| Rolling | Time-windowed | Daily/monthly limits |

---

## Decision

We will implement a **distributed usage tracking and quota system** with:

1. **Usage Collector** - Capture usage events
2. **Aggregation Pipeline** - Summarize usage data
3. **Quota Engine** - Enforce limits in real-time
4. **Billing Integration** - Generate invoices
5. **Usage Analytics** - Reporting and insights

### Architecture Overview

```typescript
interface UsageTrackingSystem {
  // Recording
  recordUsage(event: UsageEvent): Promise<void>;
  recordBatch(events: UsageEvent[]): Promise<void>;

  // Querying
  getUsage(query: UsageQuery): Promise<UsageData>;
  getCurrentPeriodUsage(orgId: string): Promise<PeriodUsage>;

  // Quota
  checkQuota(orgId: string, metric: string, amount: number): Promise<QuotaCheck>;
  reserveQuota(orgId: string, metric: string, amount: number): Promise<QuotaReservation>;
  releaseQuota(reservationId: string): Promise<void>;

  // Billing
  generateInvoiceData(orgId: string, period: BillingPeriod): Promise<InvoiceData>;
}

interface UsageEvent {
  id: string;
  timestamp: Date;

  // Identity
  organizationId: string;
  projectId?: string;
  userId?: string;

  // Metric
  metric: string;          // e.g., "llm_tokens", "api_calls"
  value: number;
  unit: string;

  // Context
  source: string;          // Service that generated event
  resourceId?: string;
  metadata?: Record<string, any>;

  // Idempotency
  idempotencyKey?: string;
}

interface QuotaConfig {
  organizationId: string;
  metric: string;

  // Limits
  limit: number;
  period: 'hour' | 'day' | 'month' | 'billing_cycle';
  type: 'hard' | 'soft' | 'burst';

  // Burst configuration
  burstLimit?: number;
  burstDuration?: number;

  // Actions
  onExceed: 'reject' | 'warn' | 'throttle' | 'notify';
  notificationThresholds: number[];  // e.g., [0.8, 0.9, 1.0]
}

interface QuotaCheck {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  warning?: string;
}
```

### Component 1: Usage Collector

Capture usage events from all services.

```typescript
class UsageCollector {
  constructor(
    private eventQueue: EventQueue,
    private deduplicator: Deduplicator,
    private batcher: EventBatcher
  ) {}

  async recordUsage(event: UsageEvent): Promise<void> {
    // Validate event
    this.validateEvent(event);

    // Check for duplicate (idempotency)
    if (event.idempotencyKey) {
      const isDuplicate = await this.deduplicator.check(event.idempotencyKey);
      if (isDuplicate) {
        return; // Skip duplicate
      }
    }

    // Add to batch for efficient processing
    await this.batcher.add(event);
  }

  async recordBatch(events: UsageEvent[]): Promise<void> {
    // Validate all events
    events.forEach(e => this.validateEvent(e));

    // Filter duplicates
    const uniqueEvents = await this.filterDuplicates(events);

    // Send to queue
    await this.eventQueue.sendBatch(uniqueEvents);
  }

  private validateEvent(event: UsageEvent): void {
    if (!event.organizationId) {
      throw new ValidationError('organizationId is required');
    }

    if (!event.metric) {
      throw new ValidationError('metric is required');
    }

    if (typeof event.value !== 'number' || event.value < 0) {
      throw new ValidationError('value must be a non-negative number');
    }

    if (!VALID_METRICS.includes(event.metric)) {
      throw new ValidationError(`Invalid metric: ${event.metric}`);
    }
  }
}

class EventBatcher {
  private batches: Map<string, UsageEvent[]> = new Map();
  private flushInterval: NodeJS.Timeout;

  constructor(
    private queue: EventQueue,
    private batchSize: number = 100,
    private flushIntervalMs: number = 1000
  ) {
    this.flushInterval = setInterval(() => this.flushAll(), flushIntervalMs);
  }

  async add(event: UsageEvent): Promise<void> {
    const key = `${event.organizationId}:${event.metric}`;

    let batch = this.batches.get(key);
    if (!batch) {
      batch = [];
      this.batches.set(key, batch);
    }

    batch.push(event);

    // Flush if batch is full
    if (batch.length >= this.batchSize) {
      await this.flush(key);
    }
  }

  private async flush(key: string): Promise<void> {
    const batch = this.batches.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    this.batches.set(key, []);
    await this.queue.sendBatch(batch);
  }

  private async flushAll(): Promise<void> {
    for (const key of this.batches.keys()) {
      await this.flush(key);
    }
  }
}

// Middleware for automatic usage tracking
class UsageTrackingMiddleware {
  constructor(private collector: UsageCollector) {}

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      res.on('finish', async () => {
        // Track API call
        await this.collector.recordUsage({
          id: generateId(),
          timestamp: new Date(),
          organizationId: req.user?.organizationId,
          projectId: req.params.projectId,
          userId: req.user?.id,
          metric: 'api_calls',
          value: 1,
          unit: 'requests',
          source: 'api-gateway',
          metadata: {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            duration: Date.now() - startTime,
          },
          idempotencyKey: req.headers['x-request-id'] as string,
        });
      });

      next();
    };
  }
}
```

### Component 2: Aggregation Pipeline

Summarize usage data for efficient querying and billing.

```typescript
class UsageAggregator {
  constructor(
    private eventStore: EventStore,
    private aggregateStore: AggregateStore
  ) {}

  async processEvents(events: UsageEvent[]): Promise<void> {
    // Group by organization and metric
    const groups = this.groupEvents(events);

    for (const [key, groupEvents] of groups) {
      const [orgId, metric] = key.split(':');

      // Update real-time counters
      await this.updateRealTimeCounters(orgId, metric, groupEvents);

      // Store events for historical analysis
      await this.eventStore.insertBatch(groupEvents);
    }
  }

  private async updateRealTimeCounters(
    orgId: string,
    metric: string,
    events: UsageEvent[]
  ): Promise<void> {
    const total = events.reduce((sum, e) => sum + e.value, 0);

    // Update current hour aggregate
    const hourKey = this.getHourKey(new Date());
    await this.aggregateStore.increment(
      `${orgId}:${metric}:hour:${hourKey}`,
      total
    );

    // Update current day aggregate
    const dayKey = this.getDayKey(new Date());
    await this.aggregateStore.increment(
      `${orgId}:${metric}:day:${dayKey}`,
      total
    );

    // Update current billing period
    const billingPeriod = await this.getBillingPeriod(orgId);
    await this.aggregateStore.increment(
      `${orgId}:${metric}:billing:${billingPeriod}`,
      total
    );
  }

  async aggregateDaily(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Get all organizations
    const organizations = await this.orgService.listAll();

    for (const org of organizations) {
      for (const metric of TRACKED_METRICS) {
        // Sum hourly aggregates
        const hourlyAggregates = await this.getHourlyAggregates(
          org.id,
          metric,
          yesterday
        );

        const dailyTotal = hourlyAggregates.reduce((sum, h) => sum + h.value, 0);

        // Store daily aggregate
        await this.aggregateStore.set({
          organizationId: org.id,
          metric,
          period: 'day',
          periodKey: this.getDayKey(yesterday),
          value: dailyTotal,
          breakdown: hourlyAggregates,
        });

        // Clean up hourly data (keep for 7 days)
        await this.cleanupOldHourlyData(org.id, metric, 7);
      }
    }
  }

  async getUsage(query: UsageQuery): Promise<UsageData> {
    // Determine granularity based on date range
    const granularity = this.determineGranularity(query.startDate, query.endDate);

    // Get aggregates
    const aggregates = await this.aggregateStore.query({
      organizationId: query.organizationId,
      metrics: query.metrics,
      period: granularity,
      startKey: this.getPeriodKey(query.startDate, granularity),
      endKey: this.getPeriodKey(query.endDate, granularity),
    });

    // Format response
    return {
      organizationId: query.organizationId,
      startDate: query.startDate,
      endDate: query.endDate,
      granularity,
      metrics: this.formatMetrics(aggregates),
      totals: this.calculateTotals(aggregates),
    };
  }
}
```

### Component 3: Quota Engine

Real-time quota enforcement.

```typescript
class QuotaEngine {
  constructor(
    private quotaStore: QuotaStore,
    private usageStore: UsageStore,
    private redis: RedisClient
  ) {}

  async checkQuota(
    orgId: string,
    metric: string,
    amount: number
  ): Promise<QuotaCheck> {
    // Get quota configuration
    const config = await this.getQuotaConfig(orgId, metric);
    if (!config) {
      return { allowed: true, currentUsage: 0, limit: Infinity, remaining: Infinity, resetAt: new Date() };
    }

    // Get current usage from Redis (fast path)
    const currentUsage = await this.getCurrentUsage(orgId, metric, config.period);

    // Check against limit
    const projectedUsage = currentUsage + amount;

    if (projectedUsage > config.limit) {
      if (config.type === 'hard') {
        return {
          allowed: false,
          currentUsage,
          limit: config.limit,
          remaining: Math.max(0, config.limit - currentUsage),
          resetAt: this.getResetTime(config.period),
          warning: `Quota exceeded: ${metric}`,
        };
      }

      if (config.type === 'soft') {
        // Allow but warn
        return {
          allowed: true,
          currentUsage,
          limit: config.limit,
          remaining: 0,
          resetAt: this.getResetTime(config.period),
          warning: `Quota exceeded: ${metric}. Additional charges may apply.`,
        };
      }

      if (config.type === 'burst') {
        // Check burst allowance
        const burstAllowed = await this.checkBurstAllowance(orgId, metric, config);
        if (burstAllowed) {
          return {
            allowed: true,
            currentUsage,
            limit: config.limit,
            remaining: 0,
            resetAt: this.getResetTime(config.period),
            warning: `Using burst capacity for ${metric}`,
          };
        }
      }
    }

    // Check notification thresholds
    let warning: string | undefined;
    for (const threshold of config.notificationThresholds.sort().reverse()) {
      if (projectedUsage >= config.limit * threshold && currentUsage < config.limit * threshold) {
        warning = `${metric} usage at ${Math.round(threshold * 100)}% of limit`;
        await this.sendThresholdNotification(orgId, metric, threshold);
        break;
      }
    }

    return {
      allowed: true,
      currentUsage,
      limit: config.limit,
      remaining: config.limit - currentUsage,
      resetAt: this.getResetTime(config.period),
      warning,
    };
  }

  async reserveQuota(
    orgId: string,
    metric: string,
    amount: number
  ): Promise<QuotaReservation> {
    // Check quota first
    const check = await this.checkQuota(orgId, metric, amount);
    if (!check.allowed) {
      throw new QuotaExceededError(check.warning);
    }

    // Create reservation
    const reservationId = generateId();
    const reservation: QuotaReservation = {
      id: reservationId,
      organizationId: orgId,
      metric,
      amount,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute expiry
    };

    // Atomically increment usage counter
    const key = this.getUsageKey(orgId, metric);
    await this.redis.multi()
      .incrby(key, amount)
      .set(`reservation:${reservationId}`, JSON.stringify(reservation), 'EX', 300)
      .exec();

    return reservation;
  }

  async commitQuota(reservationId: string): Promise<void> {
    const reservationJson = await this.redis.get(`reservation:${reservationId}`);
    if (!reservationJson) {
      throw new NotFoundError('Reservation not found or expired');
    }

    const reservation = JSON.parse(reservationJson) as QuotaReservation;
    reservation.status = 'committed';

    // Remove reservation (usage already counted)
    await this.redis.del(`reservation:${reservationId}`);
  }

  async releaseQuota(reservationId: string): Promise<void> {
    const reservationJson = await this.redis.get(`reservation:${reservationId}`);
    if (!reservationJson) {
      return; // Already expired or released
    }

    const reservation = JSON.parse(reservationJson) as QuotaReservation;

    // Atomically decrement usage counter
    const key = this.getUsageKey(reservation.organizationId, reservation.metric);
    await this.redis.multi()
      .decrby(key, reservation.amount)
      .del(`reservation:${reservationId}`)
      .exec();
  }

  private async getCurrentUsage(
    orgId: string,
    metric: string,
    period: QuotaPeriod
  ): Promise<number> {
    const key = this.getUsageKey(orgId, metric, period);
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  private getUsageKey(orgId: string, metric: string, period?: QuotaPeriod): string {
    const periodKey = this.getPeriodKey(new Date(), period || 'billing_cycle');
    return `quota:${orgId}:${metric}:${periodKey}`;
  }
}

// Rate limiter using token bucket algorithm
class RateLimiter {
  constructor(private redis: RedisClient) {}

  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const count = await this.redis.zcard(key);

    if (count >= limit) {
      // Get oldest entry to calculate retry time
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfter = oldest.length > 0
        ? Math.ceil((parseInt(oldest[1]) + windowMs - now) / 1000)
        : 1;

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + windowMs),
        retryAfter,
      };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}:${generateId()}`);
    await this.redis.expire(key, Math.ceil(windowMs / 1000));

    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: new Date(now + windowMs),
    };
  }
}
```

### Component 4: Billing Integration

Generate accurate invoices from usage data.

```typescript
class BillingUsageService {
  constructor(
    private aggregator: UsageAggregator,
    private pricingService: PricingService,
    private invoiceStore: InvoiceStore
  ) {}

  async generateInvoiceData(
    orgId: string,
    period: BillingPeriod
  ): Promise<InvoiceData> {
    // Get usage for billing period
    const usage = await this.aggregator.getUsage({
      organizationId: orgId,
      startDate: period.startDate,
      endDate: period.endDate,
      metrics: BILLABLE_METRICS,
    });

    // Get pricing for organization
    const pricing = await this.pricingService.getPricing(orgId);

    // Calculate line items
    const lineItems: InvoiceLineItem[] = [];

    for (const [metric, value] of Object.entries(usage.totals)) {
      const price = pricing.getPrice(metric);
      if (price) {
        lineItems.push({
          description: this.getMetricDescription(metric),
          metric,
          quantity: value,
          unit: this.getMetricUnit(metric),
          unitPrice: price.unitPrice,
          amount: value * price.unitPrice,
          tiers: price.tiers ? this.calculateTieredPricing(value, price.tiers) : undefined,
        });
      }
    }

    // Apply discounts
    const discounts = await this.calculateDiscounts(orgId, lineItems);

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const totalDiscounts = discounts.reduce((sum, d) => sum + d.amount, 0);
    const total = subtotal - totalDiscounts;

    return {
      organizationId: orgId,
      period,
      lineItems,
      discounts,
      subtotal,
      total,
      currency: pricing.currency,
      generatedAt: new Date(),
    };
  }

  private calculateTieredPricing(
    quantity: number,
    tiers: PricingTier[]
  ): TierBreakdown[] {
    const breakdown: TierBreakdown[] = [];
    let remaining = quantity;

    for (const tier of tiers.sort((a, b) => a.upTo - b.upTo)) {
      if (remaining <= 0) break;

      const tierQuantity = Math.min(remaining, tier.upTo - (tier.from || 0));
      breakdown.push({
        tier: tier.name,
        from: tier.from || 0,
        upTo: tier.upTo,
        quantity: tierQuantity,
        unitPrice: tier.unitPrice,
        amount: tierQuantity * tier.unitPrice,
      });

      remaining -= tierQuantity;
    }

    return breakdown;
  }

  async reconcileUsage(
    orgId: string,
    period: BillingPeriod
  ): Promise<ReconciliationResult> {
    // Get aggregated usage
    const aggregatedUsage = await this.aggregator.getUsage({
      organizationId: orgId,
      startDate: period.startDate,
      endDate: period.endDate,
      metrics: BILLABLE_METRICS,
    });

    // Get raw events for verification
    const rawEvents = await this.eventStore.query({
      organizationId: orgId,
      startDate: period.startDate,
      endDate: period.endDate,
    });

    // Calculate totals from raw events
    const rawTotals = this.calculateRawTotals(rawEvents);

    // Compare
    const discrepancies: Discrepancy[] = [];

    for (const metric of BILLABLE_METRICS) {
      const aggregated = aggregatedUsage.totals[metric] || 0;
      const raw = rawTotals[metric] || 0;

      if (Math.abs(aggregated - raw) / Math.max(aggregated, raw, 1) > 0.001) {
        discrepancies.push({
          metric,
          aggregatedValue: aggregated,
          rawValue: raw,
          difference: aggregated - raw,
          percentageDifference: ((aggregated - raw) / raw) * 100,
        });
      }
    }

    return {
      period,
      reconciled: discrepancies.length === 0,
      discrepancies,
      aggregatedTotals: aggregatedUsage.totals,
      rawTotals,
    };
  }
}
```

### Component 5: Usage Analytics

Reporting and insights.

```typescript
class UsageAnalyticsService {
  constructor(
    private aggregator: UsageAggregator,
    private analyticsStore: AnalyticsStore
  ) {}

  async getUsageDashboard(
    orgId: string,
    period: DateRange
  ): Promise<UsageDashboard> {
    const [
      currentUsage,
      previousUsage,
      quotaStatus,
      trends,
      breakdown,
    ] = await Promise.all([
      this.aggregator.getUsage({ organizationId: orgId, ...period }),
      this.getPreviousPeriodUsage(orgId, period),
      this.getQuotaStatus(orgId),
      this.calculateTrends(orgId, period),
      this.getUsageBreakdown(orgId, period),
    ]);

    return {
      summary: {
        totalApiCalls: currentUsage.totals.api_calls || 0,
        totalLLMTokens: currentUsage.totals.llm_tokens || 0,
        totalStorage: currentUsage.totals.storage_gb || 0,
        estimatedCost: await this.estimateCost(orgId, currentUsage),
      },
      comparison: this.compareWithPrevious(currentUsage, previousUsage),
      quotaStatus,
      trends,
      breakdown,
      recommendations: await this.generateRecommendations(orgId, currentUsage),
    };
  }

  async getUsageBreakdown(
    orgId: string,
    period: DateRange
  ): Promise<UsageBreakdown> {
    // By project
    const byProject = await this.analyticsStore.aggregateByDimension({
      organizationId: orgId,
      ...period,
      dimension: 'projectId',
    });

    // By user
    const byUser = await this.analyticsStore.aggregateByDimension({
      organizationId: orgId,
      ...period,
      dimension: 'userId',
    });

    // By metric
    const byMetric = await this.analyticsStore.aggregateByDimension({
      organizationId: orgId,
      ...period,
      dimension: 'metric',
    });

    // By time
    const byTime = await this.aggregator.getUsage({
      organizationId: orgId,
      ...period,
      granularity: 'day',
    });

    return {
      byProject,
      byUser,
      byMetric,
      byTime: byTime.metrics,
    };
  }

  async generateRecommendations(
    orgId: string,
    usage: UsageData
  ): Promise<UsageRecommendation[]> {
    const recommendations: UsageRecommendation[] = [];

    // Check for inefficient LLM usage
    if (usage.totals.llm_tokens > 1000000) {
      const avgTokensPerRequest = usage.totals.llm_tokens / usage.totals.api_calls;
      if (avgTokensPerRequest > 10000) {
        recommendations.push({
          type: 'optimization',
          metric: 'llm_tokens',
          title: 'High average token usage per request',
          description: 'Consider using context optimization to reduce token usage',
          potentialSavings: this.estimateTokenSavings(usage),
        });
      }
    }

    // Check for approaching quota
    const quotaStatus = await this.getQuotaStatus(orgId);
    for (const [metric, status] of Object.entries(quotaStatus)) {
      if (status.percentUsed > 80) {
        recommendations.push({
          type: 'quota',
          metric,
          title: `${metric} approaching limit`,
          description: `You've used ${status.percentUsed}% of your ${metric} quota`,
          action: 'Consider upgrading your plan',
        });
      }
    }

    return recommendations;
  }
}
```

---

## Consequences

### Positive

1. **Accuracy:** Precise usage tracking for billing
2. **Real-time:** Instant quota enforcement
3. **Scalability:** Handles high request volumes
4. **Visibility:** Detailed usage analytics
5. **Flexibility:** Multiple quota and pricing models

### Negative

1. **Complexity:** Distributed counter management
2. **Latency:** Quota checks add request latency
3. **Consistency:** Eventual consistency in aggregates
4. **Cost:** Redis and analytics infrastructure

### Trade-offs

- **Accuracy vs. Performance:** More accuracy = more latency
- **Real-time vs. Cost:** Real-time counters = more infrastructure
- **Granularity vs. Storage:** More detail = more storage

---

## Implementation Plan

### Phase 1: Usage Collection (Week 1-2)
- Implement event collector
- Build batching pipeline
- Add middleware integration

### Phase 2: Aggregation (Week 3-4)
- Implement aggregation pipeline
- Build storage layer
- Add query API

### Phase 3: Quota Engine (Week 5-6)
- Implement quota checks
- Build rate limiter
- Add reservation system

### Phase 4: Analytics & Billing (Week 7-8)
- Build analytics dashboard
- Implement billing integration
- Add reconciliation

---

## References

- [Stripe Usage-Based Billing](https://stripe.com/docs/billing/subscriptions/usage-based)
- [Redis Rate Limiting](https://redis.io/commands/incr#pattern-rate-limiter)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)

---

**Decision Maker:** Product Lead + Engineering Lead
**Approved By:** Finance + Engineering Leadership
**Implementation Owner:** Platform Engineering Team
