/**
 * @package @forge/queue
 * @description BullMQ job queue wrapper for Forge Factory
 *
 * This package provides a high-level abstraction over BullMQ for
 * managing job queues, workers, and scheduled tasks.
 *
 * @example Basic usage
 * ```typescript
 * import { QueueService, createQueueService } from '@forge/queue';
 *
 * // Create a queue service
 * const queue = createQueueService<MyJobData, MyJobResult>('my-queue');
 * await queue.initialize();
 *
 * // Add a job
 * const jobId = await queue.add('process-data', { userId: '123' });
 *
 * // Create a worker
 * const worker = queue.createWorker(async (job) => {
 *   // Process the job
 *   return { processed: true };
 * });
 *
 * // Add a scheduled job
 * queue.addSchedule({
 *   name: 'cleanup',
 *   pattern: '0 0 * * *', // Daily at midnight
 *   data: { type: 'cleanup' },
 * });
 * ```
 */

// Types
export type {
  RedisConfig,
  QueueConfig,
  BackoffStrategy,
  JobOptions,
  JobState,
  JobData,
  JobResult,
  WorkerConfig,
  WorkerStats,
  WorkerStatus,
  RateLimiterConfig,
  JobProcessor,
  QueueEvent,
  QueueEventListener,
  QueueStats,
  HealthCheckResult,
  ShutdownOptions,
  ScheduledJobConfig,
  RepeatOptions,
  CleanupOptions,
  BulkAddResult,
  JobFilter,
  TenantContext,
} from './queue.types';

// Default configurations
export {
  DEFAULT_REDIS_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_WORKER_CONFIG,
  DEFAULT_SHUTDOWN_OPTIONS,
  DEFAULT_CLEANUP_OPTIONS,
} from './queue.types';

// Queue service
export {
  QueueService,
  TenantQueue,
  getQueueService,
  resetQueueService,
  createQueueService,
} from './queue.service';

export type { BullMQQueueInterface } from './queue.service';

// Worker management
export {
  WorkerManager,
  WorkerPool,
  createWorkerManager,
  createWorkerPool,
  formatWorkerStats,
} from './worker';

export type { BullMQWorkerInterface } from './worker';

// Job utilities
export {
  generateJobId,
  createJobData,
  createSuccessResult,
  createFailureResult,
  calculateBackoffDelay,
  shouldRetry,
  validateJobName,
  validateJobData,
  validateJobOptions,
  isTerminalState,
  isActiveState,
  formatJobForLog,
  calculateJobAge,
  calculateProcessingDuration,
  buildTenantJobName,
  extractTenantId,
  extractJobName,
  mergeJobOptions,
  serializeJob,
  deserializeJob,
  createJobFilter,
  filterByState,
  filterByName,
  sortByTimestamp,
  paginateJobs,
  groupByState,
  countByState,
} from './job';

// Scheduler
export {
  JobScheduler,
  createScheduler,
  validateScheduleConfig,
  validateCronPattern,
  parseInterval,
  calculateNextRun,
  toRepeatOptions,
  CronPatterns,
  formatSchedule,
} from './scheduler';

export type { ScheduledJob } from './scheduler';
