# @forge/queue

BullMQ job queue wrapper for Forge Factory. Provides a high-level abstraction for managing job queues, workers, and scheduled tasks.

## Features

- **Queue Management**: Add, remove, and query jobs with ease
- **Worker Management**: Create workers with configurable concurrency and rate limiting
- **Scheduled Jobs**: Support for cron patterns and interval-based scheduling
- **Multi-tenant Support**: Tenant-scoped queues with automatic namespace isolation
- **Event System**: Listen to queue and worker lifecycle events
- **Health Checks**: Built-in health check with queue statistics
- **Graceful Shutdown**: Properly drain queues and stop workers

## Installation

```bash
pnpm add @forge/queue bullmq ioredis
```

## Usage

### Basic Queue Operations

```typescript
import { createQueueService } from '@forge/queue';

// Create a queue service
const queue = createQueueService<MyJobData, MyJobResult>('my-queue', {
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

// Initialize the queue
await queue.initialize();

// Add a job
const jobId = await queue.add('process-order', {
  orderId: '12345',
  userId: 'user-1',
});

// Add a job with options
const jobId2 = await queue.add('send-email', { to: 'user@example.com' }, {
  priority: 1,
  delay: 5000,
  attempts: 5,
});

// Get a job
const job = await queue.getJob(jobId);

// Get jobs by state
const waitingJobs = await queue.getJobs({ state: 'waiting' });
const failedJobs = await queue.getJobs({ state: 'failed', start: 0, end: 10 });

// Get queue statistics
const stats = await queue.getJobCounts();
console.log(`Waiting: ${stats.waiting}, Active: ${stats.active}`);
```

### Creating Workers

```typescript
import { createQueueService, JobData } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Create a worker with a processor function
const worker = queue.createWorker(
  async (job: JobData<MyJobData>) => {
    // Process the job
    console.log(`Processing job ${job.id}: ${job.name}`);

    // Return the result
    return { success: true, processedAt: new Date() };
  },
  {
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 60000, // 100 jobs per minute
    },
  }
);

// Listen to worker events
worker.on('completed', (event, data) => {
  console.log('Job completed:', data);
});

worker.on('failed', (event, data) => {
  console.error('Job failed:', data);
});

// Start the worker
await worker.start();

// Pause/resume
await worker.pause();
await worker.resume();

// Stop the worker
await worker.stop();
```

### Worker Pools

```typescript
import { createQueueService } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Create a pool of workers
const pool = queue.createWorkerPool(
  async (job) => {
    return processJob(job);
  },
  { concurrency: 2 }
);

// Add workers to the pool
pool.addWorker('worker-1');
pool.addWorker('worker-2');
pool.addWorker('worker-3');

// Start all workers
await pool.startAll();

// Scale the pool
await pool.scaleTo(5); // Add 2 more workers

// Get aggregated statistics
const stats = pool.getAggregatedStats();
console.log(`Total processed: ${stats.totalProcessed}`);

// Stop all workers
await pool.stopAll();
```

### Scheduled Jobs

```typescript
import { createQueueService, CronPatterns } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Add a scheduled job with cron pattern
queue.addSchedule({
  name: 'daily-cleanup',
  pattern: CronPatterns.DAILY_MIDNIGHT,
  data: { type: 'cleanup' },
});

// Add a job that runs every 5 minutes
queue.addSchedule({
  name: 'health-check',
  pattern: '*/5 * * * *',
  data: { type: 'health' },
});

// Add a job with interval
queue.addSchedule({
  name: 'sync-data',
  pattern: 'every 30m',
  data: { type: 'sync' },
});

// Pause a schedule
queue.getScheduler()?.pauseSchedule('daily-cleanup');

// Resume a schedule
queue.getScheduler()?.resumeSchedule('daily-cleanup');

// Get all schedules
const schedules = queue.getSchedules();
```

### Multi-tenant Support

```typescript
import { createQueueService } from '@forge/queue';

const queue = createQueueService('orders');
await queue.initialize();

// Create tenant-scoped queues
const tenant1Queue = queue.forTenant({ tenantId: 'tenant-1' });
const tenant2Queue = queue.forTenant({ tenantId: 'tenant-2' });

// Jobs are automatically namespaced
await tenant1Queue.add('process-order', { orderId: '1' });
// Job name becomes: tenant:tenant-1:process-order

await tenant2Queue.add('process-order', { orderId: '2' });
// Job name becomes: tenant:tenant-2:process-order

// Get jobs for a specific tenant
const tenant1Jobs = await tenant1Queue.getJobs();
```

### Event Handling

```typescript
import { createQueueService, QueueEvent } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Listen to queue events
queue.on('waiting', (event, data) => {
  console.log('New job waiting:', data);
});

queue.on('completed', (event, data) => {
  console.log('Job completed:', data);
});

queue.on('failed', (event, data) => {
  console.error('Job failed:', data);
});

queue.on('progress', (event, data) => {
  console.log('Job progress:', data);
});

// Remove listener
const listener = (event: QueueEvent, data: unknown) => console.log(event, data);
queue.on('completed', listener);
queue.off('completed', listener);
```

### Health Checks

```typescript
import { createQueueService } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Perform health check
const health = await queue.healthCheck();

if (health.healthy) {
  console.log('Queue is healthy');
  console.log(`Waiting jobs: ${health.stats.waiting}`);
  console.log(`Active jobs: ${health.stats.active}`);
  console.log(`Workers: ${health.workers.length}`);
} else {
  console.error('Queue is unhealthy:', health.error);
}
```

### Graceful Shutdown

```typescript
import { createQueueService } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await queue.shutdown({
    timeoutMs: 30000,
    drain: true, // Wait for all jobs to complete
    forceAfterTimeout: true,
  });
  process.exit(0);
});
```

### Job Cleanup

```typescript
import { createQueueService } from '@forge/queue';

const queue = createQueueService('my-queue');
await queue.initialize();

// Clean old completed and failed jobs
const cleanedCount = await queue.clean({
  completedAge: 24 * 60 * 60 * 1000, // 24 hours
  failedAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  completedCount: 1000,
  failedCount: 5000,
});

console.log(`Cleaned ${cleanedCount} jobs`);
```

## API Reference

### QueueService

- `initialize()` - Initialize the queue connection
- `add(name, data, options?)` - Add a job to the queue
- `addBulk(jobs)` - Add multiple jobs at once
- `getJob(jobId)` - Get a job by ID
- `getJobs(filter?)` - Get jobs with optional filtering
- `getJobCounts()` - Get job counts by state
- `removeJob(jobId)` - Remove a job
- `retryJob(jobId)` - Retry a failed job
- `pause()` - Pause the queue
- `resume()` - Resume the queue
- `drain()` - Remove all waiting jobs
- `clean(options?)` - Clean old jobs
- `createWorker(processor, config?)` - Create a worker
- `createWorkerPool(processor, config?)` - Create a worker pool
- `addSchedule(config)` - Add a scheduled job
- `removeSchedule(name)` - Remove a scheduled job
- `healthCheck()` - Perform health check
- `shutdown(options?)` - Gracefully shutdown

### WorkerManager

- `start()` - Start the worker
- `pause(waitForActive?)` - Pause the worker
- `resume()` - Resume the worker
- `stop(force?)` - Stop the worker
- `getStats()` - Get worker statistics
- `on(event, listener)` - Add event listener
- `off(event, listener)` - Remove event listener

### JobScheduler

- `addSchedule(config)` - Add a scheduled job
- `removeSchedule(name)` - Remove a scheduled job
- `pauseSchedule(name)` - Pause a schedule
- `resumeSchedule(name)` - Resume a schedule
- `getSchedule(name)` - Get a schedule by name
- `getAllSchedules()` - Get all schedules
- `getActiveSchedules()` - Get active schedules

## Configuration

### QueueConfig

```typescript
interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    tls: boolean;
  };
  defaultJobOptions: {
    attempts: number;
    backoff: { type: 'fixed' | 'exponential'; delay: number };
    removeOnComplete: boolean | number;
    removeOnFail: boolean | number;
  };
  enableLogging: boolean;
  environment: 'development' | 'production' | 'test';
}
```

### WorkerConfig

```typescript
interface WorkerConfig {
  concurrency: number;
  lockDuration: number;
  stalledInterval: number;
  maxStalledCount: number;
  limiter?: {
    max: number;
    duration: number;
  };
}
```

## License

ISC
