# ADR-006: Background Job Architecture

## Status
Accepted

## Context

Background jobs are core to Forge Factory:
- **Analysis Jobs**: 5-10 minutes for 100K LOC
- **Refactoring Jobs**: 10-20 minutes for complex refactorings
- **Test Generation**: 5-10 minutes for test suites
- **Webhook Delivery**: With retries and exponential backoff
- **Data Cleanup**: Daily/weekly maintenance tasks

### Requirements
- SLA: Analysis < 5 min, Refactoring < 10 min
- Handle 10K concurrent jobs
- Automatic retries (transient failures)
- Progress tracking (0-100%)
- Job cancellation (user-requested)

## Decision

Use **BullMQ** (Redis-backed job queue) with dedicated worker pools

**Why BullMQ**:
- Built on Redis (already in stack)
- Priority queues
- Rate limiting
- Progress tracking
- Job scheduling (cron)
- Excellent TypeScript support

## Architecture

```typescript
API Request → BullMQ Queue → Worker Pool → Progress Updates → WebSocket
                  ↓
            PostgreSQL (Job Status)
```

## Job Types

```typescript
// 1. Analysis Jobs (High Priority)
{
  queue: 'analysis',
  concurrency: 10,
  sla: '5 minutes',
  retries: 3,
}

// 2. Refactoring Jobs (High Priority)
{
  queue: 'refactoring',
  concurrency: 5,
  sla: '10 minutes',
  retries: 2,
}

// 3. Test Generation (Medium Priority)
{
  queue: 'test-generation',
  concurrency: 5,
  sla: '10 minutes',
  retries: 2,
}

// 4. Webhook Delivery (High Priority, Fast)
{
  queue: 'webhooks',
  concurrency: 50,
  sla: '5 seconds',
  retries: 5,
  backoff: 'exponential',
}

// 5. Data Cleanup (Low Priority)
{
  queue: 'cleanup',
  concurrency: 2,
  sla: 'none',
  retries: 1,
}
```

## Implementation

### Job Definition

```typescript
// lib/queues.ts
import { Queue, Worker } from 'bullmq'

const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
}

export const analysisQueue = new Queue('analysis', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 }, // Keep 1 day
    removeOnFail: { age: 7 * 24 * 3600, count: 5000 }, // Keep 1 week
  },
})

export const refactoringQueue = new Queue('refactoring', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
  },
})

export const webhookQueue = new Queue('webhooks', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, 8s, 16s
    timeout: 30000, // 30s max per webhook call
  },
})
```

### Worker Implementation

```typescript
// workers/analysis-worker.ts
import { Worker } from 'bullmq'
import { publishEvent } from '../lib/events'

const worker = new Worker(
  'analysis',
  async (job) => {
    const { repositoryId, config } = job.data

    console.log(`Starting analysis job ${job.id} for repo ${repositoryId}`)

    // Update database status
    await db.analysisRun.update({
      where: { id: job.id },
      data: { status: 'running', startedAt: new Date() },
    })

    // Step 1: Clone repository (10%)
    await job.updateProgress(5)
    const repoPath = await cloneRepository(repositoryId)
    await job.updateProgress(10)

    // Emit progress via WebSocket
    emitAnalysisProgress(job.id, 10)

    // Step 2: Analyze files (70%)
    await job.updateProgress(15)
    const analysisResults = await analyzeCodebase(repoPath, config, (progress) => {
      const totalProgress = 15 + (progress * 0.65) // 15% to 80%
      job.updateProgress(totalProgress)
      emitAnalysisProgress(job.id, totalProgress)
    })

    // Step 3: Generate recommendations (15%)
    await job.updateProgress(80)
    const recommendations = await generateRecommendations(analysisResults)
    await job.updateProgress(95)

    // Step 4: Save results (5%)
    await db.analysisRun.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        results: analysisResults,
        recommendations,
      },
    })

    await job.updateProgress(100)
    emitAnalysisProgress(job.id, 100)

    // Publish completion event
    await publishEvent({
      type: 'analysis.completed',
      tenantId: job.data.tenantId,
      data: { analysisId: job.id, repositoryId },
    })

    console.log(`Completed analysis job ${job.id}`)

    return analysisResults
  },
  {
    connection,
    concurrency: 10, // Process 10 analyses concurrently
    limiter: {
      max: 100, // Max 100 jobs per...
      duration: 60000, // ...1 minute
    },
  }
)

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed in ${job.finishedOn - job.processedOn}ms`)
})

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err)

  // Update database
  db.analysisRun.update({
    where: { id: job.id },
    data: {
      status: 'failed',
      error: err.message,
      completedAt: new Date(),
    },
  })

  // Publish failure event
  publishEvent({
    type: 'analysis.failed',
    tenantId: job.data.tenantId,
    data: { analysisId: job.id, error: err.message },
  })
})

worker.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`)
})
```

### Queue Job

```typescript
// apps/api/src/features/analysis/routes.ts
fastify.post('/analyses', {
  onRequest: [fastify.authenticate],
  schema: {
    body: {
      type: 'object',
      required: ['repositoryId'],
      properties: {
        repositoryId: { type: 'string' },
        config: { type: 'object' },
      },
    },
  },
}, async (request, reply) => {
  const { repositoryId, config } = request.body

  // Create database record
  const analysis = await db.analysisRun.create({
    data: {
      repositoryId,
      tenantId: request.user.currentTenantId,
      userId: request.user.id,
      status: 'queued',
      config,
    },
  })

  // Queue job
  const job = await analysisQueue.add('run-analysis', {
    analysisId: analysis.id,
    repositoryId,
    tenantId: request.user.currentTenantId,
    config,
  }, {
    jobId: analysis.id, // Use same ID for job and database record
    priority: 1, // High priority (user-initiated)
  })

  return {
    id: analysis.id,
    status: 'queued',
    estimatedDuration: 300, // 5 minutes
  }
})
```

### Job Cancellation

```typescript
// apps/api/src/features/analysis/routes.ts
fastify.delete('/analyses/:id', {
  onRequest: [fastify.authenticate],
}, async (request, reply) => {
  const { id } = request.params

  // Get job from BullMQ
  const job = await analysisQueue.getJob(id)

  if (!job) {
    return reply.code(404).send({ error: 'Job not found' })
  }

  // Cancel job
  await job.remove()

  // Update database
  await db.analysisRun.update({
    where: { id },
    data: { status: 'cancelled', completedAt: new Date() },
  })

  return { status: 'cancelled' }
})
```

### Scheduled Jobs (Cron)

```typescript
// workers/scheduled-jobs.ts
import { Queue, QueueScheduler } from 'bullmq'

// Cleanup old clones daily at 2 AM
await cleanupQueue.add(
  'cleanup-old-clones',
  {},
  {
    repeat: {
      pattern: '0 2 * * *', // Cron syntax
    },
  }
)

// Aggregate usage metrics hourly
await metricsQueue.add(
  'aggregate-usage',
  {},
  {
    repeat: {
      pattern: '0 * * * *', // Every hour
    },
  }
)
```

## Monitoring

```typescript
// Prometheus metrics
import { register, Counter, Gauge, Histogram } from 'prom-client'

const jobsProcessed = new Counter({
  name: 'jobs_processed_total',
  help: 'Total jobs processed',
  labelNames: ['queue', 'status'],
})

const jobDuration = new Histogram({
  name: 'job_duration_seconds',
  help: 'Job processing duration',
  labelNames: ['queue'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
})

const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'status'],
})

// Update metrics
worker.on('completed', (job) => {
  jobsProcessed.inc({ queue: 'analysis', status: 'completed' })
  jobDuration.observe({ queue: 'analysis' }, (job.finishedOn - job.processedOn) / 1000)
})

// Track queue sizes
setInterval(async () => {
  const counts = await analysisQueue.getJobCounts()
  queueSize.set({ queue: 'analysis', status: 'waiting' }, counts.waiting)
  queueSize.set({ queue: 'analysis', status: 'active' }, counts.active)
}, 30000)
```

## SLA Monitoring

```typescript
// Alert if jobs exceed SLA
worker.on('completed', async (job) => {
  const duration = (job.finishedOn - job.processedOn) / 1000 // seconds
  const SLA_THRESHOLD = 300 // 5 minutes

  if (duration > SLA_THRESHOLD) {
    await datadog.event({
      title: `Analysis job ${job.id} exceeded SLA`,
      text: `Duration: ${duration}s (threshold: ${SLA_THRESHOLD}s)`,
      alert_type: 'warning',
      tags: ['job:analysis', 'sla:breach'],
    })
  }
})
```

## Consequences

### Positive
- **Reliability**: Automatic retries for transient failures
- **Scalability**: Horizontal scaling of workers
- **Visibility**: Progress tracking, job history
- **SLA Enforcement**: Monitoring and alerting

### Negative
- **Complexity**: Distributed job processing
- **Redis Dependency**: Single point of failure (mitigated by Redis Cluster)

### Mitigations
- Redis Cluster for high availability
- Dead letter queue for failed jobs
- Comprehensive monitoring and alerting

## References
- [BullMQ Documentation](https://docs.bullmq.io/)
- ADR-005: Event Architecture (events vs. jobs)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-20
