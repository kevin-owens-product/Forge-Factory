# ADR-005: Event Architecture & Message Queue

## Status
Accepted

## Context

Need asynchronous event processing for:
- **Background Jobs**: Analysis (5-10 min), refactoring (10-20 min)
- **Webhooks**: Deliver to customer endpoints with retries
- **Event Sourcing**: Audit trail for compliance
- **Inter-Service Communication**: Decouple microservices

### Requirements
- Process 10K+ events/second
- Exactly-once delivery for critical events
- At-least-once delivery for others
- Event replay for debugging
- Multi-tenant event isolation

## Decision

**Architecture**:
### 1. **Redis Streams** for Event Bus (Primary)
### 2. **BullMQ** for Job Queue (Background Jobs)
### 3. **PostgreSQL** for Event Store (Audit Trail)

## Architecture

```typescript
Event Producer → Redis Streams → Consumer Groups → Workers
                      ↓
                PostgreSQL Event Store (Audit)
```

## Implementation

### 1. Event Types

```typescript
// Event categories
enum EventType {
  // Analysis events
  ANALYSIS_STARTED = 'analysis.started',
  ANALYSIS_PROGRESS = 'analysis.progress',
  ANALYSIS_COMPLETED = 'analysis.completed',
  ANALYSIS_FAILED = 'analysis.failed',

  // Refactoring events
  REFACTORING_STARTED = 'refactoring.started',
  REFACTORING_COMPLETED = 'refactoring.completed',
  REFACTORING_PR_CREATED = 'refactoring.pr_created',

  // User events
  USER_CREATED = 'user.created',
  USER_INVITED = 'user.invited',
  USER_DELETED = 'user.deleted',

  // Webhook events
  WEBHOOK_DELIVERY_SUCCEEDED = 'webhook.delivery.succeeded',
  WEBHOOK_DELIVERY_FAILED = 'webhook.delivery.failed',
}

interface Event<T = any> {
  id: string // UUID
  type: EventType
  tenantId: string
  userId?: string
  data: T
  metadata: {
    timestamp: Date
    source: string // 'api', 'worker', 'webhook'
    correlationId?: string
  }
}
```

### 2. Redis Streams (Event Bus)

**Publish Event**:
```typescript
// lib/events.ts
import { redis } from './redis'

export async function publishEvent<T>(event: Event<T>): Promise<string> {
  const streamKey = `events:${event.tenantId}`

  // Add to Redis Stream
  const eventId = await redis.xadd(
    streamKey,
    '*', // Auto-generate ID
    'data',
    JSON.stringify(event)
  )

  // Also store in PostgreSQL for audit trail
  await db.event.create({
    data: {
      id: event.id,
      type: event.type,
      tenantId: event.tenantId,
      userId: event.userId,
      data: event.data,
      createdAt: event.metadata.timestamp,
    },
  })

  return eventId
}
```

**Consume Events**:
```typescript
// workers/event-consumer.ts
import { redis } from '../lib/redis'

const CONSUMER_GROUP = 'analysis-workers'
const CONSUMER_NAME = `worker-${process.pid}`

async function consumeEvents() {
  // Create consumer group if not exists
  try {
    await redis.xgroup('CREATE', 'events:*', CONSUMER_GROUP, '0', 'MKSTREAM')
  } catch (err) {
    // Group already exists
  }

  while (true) {
    // Read from stream
    const results = await redis.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_NAME,
      'BLOCK',
      5000, // 5 second timeout
      'COUNT',
      10, // Process 10 events at a time
      'STREAMS',
      'events:*',
      '>' // Only new messages
    )

    if (!results || results.length === 0) continue

    for (const [stream, messages] of results) {
      for (const [id, fields] of messages) {
        const event = JSON.parse(fields[1])

        try {
          await handleEvent(event)

          // Acknowledge message
          await redis.xack(stream, CONSUMER_GROUP, id)
        } catch (err) {
          console.error(`Failed to process event ${id}:`, err)
          // Message will be retried by another consumer
        }
      }
    }
  }
}

async function handleEvent(event: Event) {
  switch (event.type) {
    case 'analysis.started':
      await runAnalysis(event.data.analysisId)
      break
    case 'webhook.delivery.succeeded':
      await logWebhookSuccess(event.data)
      break
    // ...
  }
}
```

### 3. BullMQ (Job Queue)

**For Long-Running Jobs**:
```typescript
// lib/queue.ts
import { Queue, Worker, QueueScheduler } from 'bullmq'

const analysisQueue = new Queue('analysis', {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 1000, // Keep last 1000 failed jobs
  },
})

// Add job to queue
export async function queueAnalysis(repositoryId: string, config: AnalysisConfig) {
  const job = await analysisQueue.add('run-analysis', {
    repositoryId,
    config,
  })

  return job.id
}

// Worker
const analysisWorker = new Worker(
  'analysis',
  async (job) => {
    const { repositoryId, config } = job.data

    // Update progress
    await job.updateProgress(10)

    // Clone repository
    const repoPath = await cloneRepository(repositoryId)
    await job.updateProgress(30)

    // Run analysis
    const results = await analyzeCode(repoPath, config)
    await job.updateProgress(80)

    // Store results
    await db.analysis.update({
      where: { id: job.id },
      data: { results, status: 'completed' },
    })
    await job.updateProgress(100)

    return results
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    },
    concurrency: 5, // Process 5 jobs concurrently
  }
)

analysisWorker.on('completed', (job) => {
  console.log(`Analysis ${job.id} completed`)
  publishEvent({
    type: 'analysis.completed',
    data: { analysisId: job.id },
  })
})

analysisWorker.on('failed', (job, err) => {
  console.error(`Analysis ${job.id} failed:`, err)
  publishEvent({
    type: 'analysis.failed',
    data: { analysisId: job.id, error: err.message },
  })
})
```

### Job Priorities

```typescript
// High priority (user-initiated, interactive)
await analysisQueue.add('run-analysis', data, { priority: 1 })

// Normal priority (background)
await analysisQueue.add('run-analysis', data, { priority: 5 })

// Low priority (batch jobs, cleanup)
await analysisQueue.add('cleanup', data, { priority: 10 })
```

### 4. Event Replay (Debugging)

```typescript
// Replay events for a tenant (from PostgreSQL)
export async function replayEvents(tenantId: string, fromDate: Date) {
  const events = await db.event.findMany({
    where: {
      tenantId,
      createdAt: { gte: fromDate },
    },
    orderBy: { createdAt: 'asc' },
  })

  for (const event of events) {
    await publishEvent(event)
  }

  console.log(`Replayed ${events.length} events for tenant ${tenantId}`)
}
```

## Monitoring

```typescript
// Job queue metrics
setInterval(async () => {
  const counts = await analysisQueue.getJobCounts()

  await datadog.gauge('queue.waiting', counts.waiting)
  await datadog.gauge('queue.active', counts.active)
  await datadog.gauge('queue.completed', counts.completed)
  await datadog.gauge('queue.failed', counts.failed)
}, 30000)
```

## Consequences

### Positive
- **Async Processing**: Non-blocking API responses
- **Scalability**: Horizontal scaling of workers
- **Reliability**: Automatic retries, dead letter queues
- **Audit Trail**: All events stored in PostgreSQL

### Negative
- **Complexity**: Distributed system challenges
- **Eventual Consistency**: Events processed asynchronously
- **Debugging**: Harder to trace issues across async boundaries

### Mitigations
- Correlation IDs for request tracing
- BullMQ dashboard for job monitoring
- PostgreSQL event store for replay/debugging

## References
- [Redis Streams](https://redis.io/docs/data-types/streams/)
- [BullMQ Documentation](https://docs.bullmq.io/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
