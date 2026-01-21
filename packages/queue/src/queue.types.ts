/**
 * @package @forge/queue
 * @description TypeScript interfaces for BullMQ job queue management
 */

/**
 * Redis connection configuration for queue
 */
export interface RedisConfig {
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password (optional) */
  password?: string;
  /** Redis database number */
  db: number;
  /** Connection timeout in milliseconds */
  connectTimeoutMs: number;
  /** Enable TLS/SSL connection */
  tls: boolean;
  /** Key prefix for namespacing */
  keyPrefix: string;
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts: number;
}

/**
 * Default Redis configuration values
 */
export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: 'localhost',
  port: 6379,
  db: 0,
  connectTimeoutMs: 10000,
  tls: false,
  keyPrefix: 'forge:queue:',
  maxReconnectAttempts: 10,
};

/**
 * Queue service configuration
 */
export interface QueueConfig {
  /** Redis connection configuration */
  redis: RedisConfig;
  /** Default job options */
  defaultJobOptions: JobOptions;
  /** Enable queue logging */
  enableLogging: boolean;
  /** Environment (development, production, test) */
  environment: 'development' | 'production' | 'test';
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  redis: DEFAULT_REDIS_CONFIG,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
  enableLogging: false,
  environment: 'production',
};

/**
 * Backoff strategy configuration
 */
export interface BackoffStrategy {
  /** Type of backoff: fixed or exponential */
  type: 'fixed' | 'exponential';
  /** Initial delay in milliseconds */
  delay: number;
}

/**
 * Job options for queue processing
 */
export interface JobOptions {
  /** Number of retry attempts */
  attempts: number;
  /** Backoff strategy for retries */
  backoff: BackoffStrategy;
  /** Remove job from queue when completed */
  removeOnComplete: boolean | number;
  /** Remove job from queue when failed */
  removeOnFail: boolean | number;
  /** Job priority (lower = higher priority) */
  priority?: number;
  /** Delay before processing in milliseconds */
  delay?: number;
  /** Job timeout in milliseconds */
  timeout?: number;
  /** Timestamp when job should be processed */
  timestamp?: number;
  /** Unique job ID */
  jobId?: string;
  /** Stack trace limit for errors */
  stackTraceLimit?: number;
}

/**
 * Job state
 */
export type JobState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'waiting-children';

/**
 * Job data structure
 */
export interface JobData<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Job name/type */
  name: string;
  /** Job payload data */
  data: T;
  /** Job options */
  opts: JobOptions;
  /** Current job state */
  state: JobState;
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of attempts made */
  attemptsMade: number;
  /** Timestamp when job was added */
  timestamp: number;
  /** Timestamp when processing started */
  processedOn?: number;
  /** Timestamp when job finished */
  finishedOn?: number;
  /** Job result data */
  returnvalue?: unknown;
  /** Stack trace if failed */
  stacktrace?: string[];
  /** Error message if failed */
  failedReason?: string;
}

/**
 * Job result after processing
 */
export interface JobResult<R = unknown> {
  /** Job ID */
  jobId: string;
  /** Job name */
  name: string;
  /** Whether the job succeeded */
  success: boolean;
  /** Result data if successful */
  data?: R;
  /** Error message if failed */
  error?: string;
  /** Processing duration in milliseconds */
  duration: number;
  /** Number of attempts */
  attempts: number;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Number of concurrent jobs to process */
  concurrency: number;
  /** Lock duration in milliseconds */
  lockDuration: number;
  /** Lock renew time in milliseconds */
  lockRenewTime: number;
  /** Stalled job check interval in milliseconds */
  stalledInterval: number;
  /** Maximum number of stalled job checks */
  maxStalledCount: number;
  /** Limiter configuration for rate limiting */
  limiter?: RateLimiterConfig;
  /** Skip delay check for faster processing */
  skipDelayCheck?: boolean;
  /** Use sandboxed processor (separate process) */
  useWorkerThreads?: boolean;
}

/**
 * Default worker configuration
 */
export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  concurrency: 1,
  lockDuration: 30000,
  lockRenewTime: 15000,
  stalledInterval: 30000,
  maxStalledCount: 1,
};

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum number of jobs to process */
  max: number;
  /** Time window in milliseconds */
  duration: number;
}

/**
 * Worker status
 */
export type WorkerStatus = 'running' | 'paused' | 'closing' | 'closed' | 'error';

/**
 * Worker statistics
 */
export interface WorkerStats {
  /** Worker ID */
  id: string;
  /** Queue name */
  queueName: string;
  /** Current status */
  status: WorkerStatus;
  /** Number of active jobs */
  activeJobs: number;
  /** Total jobs processed */
  totalProcessed: number;
  /** Total jobs failed */
  totalFailed: number;
  /** Jobs processed per second */
  jobsPerSecond: number;
  /** Average processing time in milliseconds */
  avgProcessingTime: number;
  /** Worker start time */
  startedAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Job processor function type
 */
export type JobProcessor<T = unknown, R = unknown> = (
  job: JobData<T>
) => Promise<R>;

/**
 * Queue events
 */
export type QueueEvent =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'progress'
  | 'stalled'
  | 'error'
  | 'paused'
  | 'resumed'
  | 'cleaned'
  | 'drained'
  | 'ready';

/**
 * Event listener callback type
 */
export type QueueEventListener<T = unknown> = (
  event: QueueEvent,
  data?: T
) => void;

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Queue name */
  name: string;
  /** Number of waiting jobs */
  waiting: number;
  /** Number of active jobs */
  active: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of delayed jobs */
  delayed: number;
  /** Number of paused jobs */
  paused: number;
  /** Total jobs ever added */
  total: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the queue is healthy */
  healthy: boolean;
  /** Connection status */
  connected: boolean;
  /** Queue statistics */
  stats: QueueStats;
  /** Worker statistics */
  workers: WorkerStats[];
  /** Response time for health check in milliseconds */
  responseTimeMs: number;
  /** Timestamp of the health check */
  timestamp: Date;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Shutdown options
 */
export interface ShutdownOptions {
  /** Timeout for graceful shutdown in milliseconds */
  timeoutMs: number;
  /** Force close connection after timeout */
  forceAfterTimeout: boolean;
  /** Drain queue before shutdown */
  drain: boolean;
}

/**
 * Default shutdown options
 */
export const DEFAULT_SHUTDOWN_OPTIONS: ShutdownOptions = {
  timeoutMs: 30000,
  forceAfterTimeout: true,
  drain: false,
};

/**
 * Scheduled job configuration
 */
export interface ScheduledJobConfig {
  /** Unique identifier for the scheduled job */
  name: string;
  /** Cron expression or repeat interval */
  pattern: string;
  /** Job data to send */
  data?: unknown;
  /** Job options */
  opts?: Partial<JobOptions>;
  /** Timezone for cron (default: UTC) */
  timezone?: string;
  /** Start date for the schedule */
  startDate?: Date;
  /** End date for the schedule */
  endDate?: Date;
  /** Maximum number of times to run */
  limit?: number;
  /** Immediately run on schedule creation */
  immediately?: boolean;
}

/**
 * Repeat options for scheduled jobs
 */
export interface RepeatOptions {
  /** Cron pattern */
  pattern?: string;
  /** Fixed interval in milliseconds */
  every?: number;
  /** Start date */
  startDate?: Date | string | number;
  /** End date */
  endDate?: Date | string | number;
  /** Maximum number of times to repeat */
  limit?: number;
  /** Count of repetitions done */
  count?: number;
  /** Current date (used internally) */
  currentDate?: Date | string | number;
  /** Timezone */
  tz?: string;
}

/**
 * Job cleanup options
 */
export interface CleanupOptions {
  /** Maximum age of completed jobs to keep (milliseconds) */
  completedAge: number;
  /** Maximum age of failed jobs to keep (milliseconds) */
  failedAge: number;
  /** Maximum number of completed jobs to keep */
  completedCount?: number;
  /** Maximum number of failed jobs to keep */
  failedCount?: number;
}

/**
 * Default cleanup options
 */
export const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
  completedAge: 24 * 60 * 60 * 1000, // 24 hours
  failedAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  completedCount: 1000,
  failedCount: 5000,
};

/**
 * Bulk job addition result
 */
export interface BulkAddResult {
  /** Number of jobs successfully added */
  added: number;
  /** Job IDs that were added */
  jobIds: string[];
  /** Errors if any jobs failed to add */
  errors: Array<{ index: number; error: string }>;
}

/**
 * Job filter options for querying
 */
export interface JobFilter {
  /** Filter by job state */
  state?: JobState | JobState[];
  /** Filter by job name */
  name?: string;
  /** Start index for pagination */
  start?: number;
  /** End index for pagination */
  end?: number;
  /** Sort order */
  order?: 'asc' | 'desc';
}

/**
 * Tenant context for multi-tenant queue operations
 */
export interface TenantContext {
  /** Tenant identifier */
  tenantId: string;
  /** Optional user identifier */
  userId?: string;
  /** Request correlation ID for tracing */
  correlationId?: string;
}
