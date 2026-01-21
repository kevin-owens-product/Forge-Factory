/**
 * @package @forge/queue
 * @description Job utilities and helpers for BullMQ queue management
 */

import {
  JobData,
  JobOptions,
  JobState,
  JobResult,
  BackoffStrategy,
  DEFAULT_QUEUE_CONFIG,
} from './queue.types';

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `job_${timestamp}_${random}`;
}

/**
 * Create job data structure from input
 */
export function createJobData<T>(
  name: string,
  data: T,
  options: Partial<JobOptions> = {}
): JobData<T> {
  const mergedOptions: JobOptions = {
    ...DEFAULT_QUEUE_CONFIG.defaultJobOptions,
    ...options,
  };

  return {
    id: options.jobId || generateJobId(),
    name,
    data,
    opts: mergedOptions,
    state: 'waiting',
    progress: 0,
    attemptsMade: 0,
    timestamp: options.timestamp || Date.now(),
  };
}

/**
 * Create a successful job result
 */
export function createSuccessResult<R>(
  jobId: string,
  name: string,
  data: R,
  duration: number,
  attempts: number
): JobResult<R> {
  return {
    jobId,
    name,
    success: true,
    data,
    duration,
    attempts,
  };
}

/**
 * Create a failed job result
 */
export function createFailureResult(
  jobId: string,
  name: string,
  error: string,
  duration: number,
  attempts: number
): JobResult {
  return {
    jobId,
    name,
    success: false,
    error,
    duration,
    attempts,
  };
}

/**
 * Calculate backoff delay for a retry attempt
 */
export function calculateBackoffDelay(
  strategy: BackoffStrategy,
  attemptNumber: number
): number {
  if (attemptNumber < 1) {
    return 0;
  }

  if (strategy.type === 'fixed') {
    return strategy.delay;
  }

  // Exponential backoff: delay * 2^(attempt-1)
  return strategy.delay * Math.pow(2, attemptNumber - 1);
}

/**
 * Check if a job should be retried
 */
export function shouldRetry(
  attemptsMade: number,
  maxAttempts: number
): boolean {
  return attemptsMade < maxAttempts;
}

/**
 * Validate job name
 */
export function validateJobName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Job name must be a non-empty string');
  }

  if (name.length > 256) {
    throw new Error('Job name must be 256 characters or less');
  }

  // Allow alphanumeric, hyphens, underscores, and colons
  if (!/^[\w:.-]+$/.test(name)) {
    throw new Error(
      'Job name must contain only alphanumeric characters, hyphens, underscores, periods, and colons'
    );
  }
}

/**
 * Validate job data
 */
export function validateJobData(data: unknown): void {
  if (data === undefined) {
    return; // undefined is allowed
  }

  // Check if data can be serialized to JSON
  try {
    JSON.stringify(data);
  } catch {
    throw new Error('Job data must be JSON serializable');
  }
}

/**
 * Validate job options
 */
export function validateJobOptions(options: Partial<JobOptions>): void {
  if (options.attempts !== undefined) {
    if (!Number.isInteger(options.attempts) || options.attempts < 1) {
      throw new Error('Job attempts must be a positive integer');
    }
  }

  if (options.priority !== undefined) {
    if (!Number.isInteger(options.priority)) {
      throw new Error('Job priority must be an integer');
    }
  }

  if (options.delay !== undefined) {
    if (!Number.isInteger(options.delay) || options.delay < 0) {
      throw new Error('Job delay must be a non-negative integer');
    }
  }

  if (options.timeout !== undefined) {
    if (!Number.isInteger(options.timeout) || options.timeout < 0) {
      throw new Error('Job timeout must be a non-negative integer');
    }
  }

  if (options.backoff !== undefined) {
    if (!['fixed', 'exponential'].includes(options.backoff.type)) {
      throw new Error('Backoff type must be "fixed" or "exponential"');
    }
    if (
      !Number.isInteger(options.backoff.delay) ||
      options.backoff.delay < 0
    ) {
      throw new Error('Backoff delay must be a non-negative integer');
    }
  }

  if (options.jobId !== undefined) {
    if (typeof options.jobId !== 'string' || options.jobId.length === 0) {
      throw new Error('Job ID must be a non-empty string');
    }
  }
}

/**
 * Check if a job state is terminal (completed or failed)
 */
export function isTerminalState(state: JobState): boolean {
  return state === 'completed' || state === 'failed';
}

/**
 * Check if a job state is active
 */
export function isActiveState(state: JobState): boolean {
  return state === 'active' || state === 'waiting' || state === 'delayed';
}

/**
 * Format job for logging
 */
export function formatJobForLog(job: JobData): string {
  return `Job[${job.id}] name=${job.name} state=${job.state} attempts=${job.attemptsMade}/${job.opts.attempts}`;
}

/**
 * Calculate job age in milliseconds
 */
export function calculateJobAge(job: JobData): number {
  return Date.now() - job.timestamp;
}

/**
 * Calculate job processing duration
 */
export function calculateProcessingDuration(job: JobData): number | null {
  if (!job.processedOn) {
    return null;
  }

  const endTime = job.finishedOn || Date.now();
  return endTime - job.processedOn;
}

/**
 * Build a namespaced job name for tenant isolation
 */
export function buildTenantJobName(
  tenantId: string,
  jobName: string
): string {
  return `tenant:${tenantId}:${jobName}`;
}

/**
 * Extract tenant ID from a namespaced job name
 */
export function extractTenantId(namespacedName: string): string | null {
  const match = namespacedName.match(/^tenant:([^:]+):/);
  return match ? match[1] : null;
}

/**
 * Extract original job name from a namespaced job name
 */
export function extractJobName(namespacedName: string): string {
  const match = namespacedName.match(/^tenant:[^:]+:(.+)$/);
  return match ? match[1] : namespacedName;
}

/**
 * Merge job options with defaults
 */
export function mergeJobOptions(
  defaults: JobOptions,
  overrides: Partial<JobOptions>
): JobOptions {
  return {
    ...defaults,
    ...overrides,
    backoff: overrides.backoff
      ? { ...defaults.backoff, ...overrides.backoff }
      : defaults.backoff,
  };
}

/**
 * Convert job data to a plain object for serialization
 */
export function serializeJob<T>(job: JobData<T>): Record<string, unknown> {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    opts: job.opts,
    state: job.state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    returnvalue: job.returnvalue,
    stacktrace: job.stacktrace,
    failedReason: job.failedReason,
  };
}

/**
 * Deserialize a plain object back to job data
 */
export function deserializeJob<T>(data: Record<string, unknown>): JobData<T> {
  return {
    id: data.id as string,
    name: data.name as string,
    data: data.data as T,
    opts: data.opts as JobOptions,
    state: data.state as JobState,
    progress: data.progress as number,
    attemptsMade: data.attemptsMade as number,
    timestamp: data.timestamp as number,
    processedOn: data.processedOn as number | undefined,
    finishedOn: data.finishedOn as number | undefined,
    returnvalue: data.returnvalue,
    stacktrace: data.stacktrace as string[] | undefined,
    failedReason: data.failedReason as string | undefined,
  };
}

/**
 * Create a job filter function
 */
export function createJobFilter(
  predicate: (job: JobData) => boolean
): (job: JobData) => boolean {
  return predicate;
}

/**
 * Filter jobs by state
 */
export function filterByState(
  jobs: JobData[],
  states: JobState | JobState[]
): JobData[] {
  const stateArray = Array.isArray(states) ? states : [states];
  return jobs.filter((job) => stateArray.includes(job.state));
}

/**
 * Filter jobs by name
 */
export function filterByName(jobs: JobData[], name: string): JobData[] {
  return jobs.filter((job) => job.name === name);
}

/**
 * Sort jobs by timestamp
 */
export function sortByTimestamp(
  jobs: JobData[],
  order: 'asc' | 'desc' = 'desc'
): JobData[] {
  return [...jobs].sort((a, b) => {
    return order === 'asc'
      ? a.timestamp - b.timestamp
      : b.timestamp - a.timestamp;
  });
}

/**
 * Paginate jobs array
 */
export function paginateJobs(
  jobs: JobData[],
  start: number,
  end: number
): JobData[] {
  return jobs.slice(start, end);
}

/**
 * Group jobs by state
 */
export function groupByState(jobs: JobData[]): Map<JobState, JobData[]> {
  const groups = new Map<JobState, JobData[]>();

  for (const job of jobs) {
    const existing = groups.get(job.state) || [];
    existing.push(job);
    groups.set(job.state, existing);
  }

  return groups;
}

/**
 * Count jobs by state
 */
export function countByState(jobs: JobData[]): Map<JobState, number> {
  const counts = new Map<JobState, number>();

  for (const job of jobs) {
    counts.set(job.state, (counts.get(job.state) || 0) + 1);
  }

  return counts;
}
