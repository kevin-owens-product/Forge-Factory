/**
 * @package @forge/queue
 * @description Main queue service for BullMQ job management
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import {
  QueueConfig,
  QueueStats,
  JobOptions,
  JobData,
  JobFilter,
  JobProcessor,
  JobResult,
  HealthCheckResult,
  ShutdownOptions,
  BulkAddResult,
  CleanupOptions,
  ScheduledJobConfig,
  TenantContext,
  QueueEvent,
  QueueEventListener,
  WorkerConfig,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_SHUTDOWN_OPTIONS,
  DEFAULT_CLEANUP_OPTIONS,
} from './queue.types';
import {
  createJobData,
  validateJobName,
  validateJobData,
  validateJobOptions,
  filterByState,
  filterByName,
  sortByTimestamp,
  paginateJobs,
  buildTenantJobName,
} from './job';
import {
  WorkerManager,
  WorkerPool,
  createWorkerManager,
  createWorkerPool,
} from './worker';
import {
  JobScheduler,
  createScheduler,
  ScheduledJob,
} from './scheduler';

/**
 * BullMQ Queue interface (for mocking in tests)
 */
export interface BullMQQueueInterface {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }>;
  addBulk(jobs: Array<{ name: string; data: unknown; opts?: Record<string, unknown> }>): Promise<Array<{ id: string }>>;
  getJob(id: string): Promise<JobData | null>;
  getJobs(states?: string[], start?: number, end?: number): Promise<JobData[]>;
  getJobCounts(...states: string[]): Promise<Record<string, number>>;
  remove(id: string): Promise<void>;
  removeJobs(pattern: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  drain(): Promise<void>;
  clean(grace: number, limit: number, type: string): Promise<string[]>;
  close(): Promise<void>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Main queue service class
 */
export class QueueService<T = unknown, R = unknown> {
  private readonly name: string;
  private readonly config: QueueConfig;

  private queue: BullMQQueueInterface | null = null;
  private worker: WorkerManager<T, R> | null = null;
  private scheduler: JobScheduler | null = null;
  private initialized: boolean = false;
  private shuttingDown: boolean = false;

  // In-memory job storage for testing/mocking
  private jobs: Map<string, JobData<T>> = new Map();

  // Event listeners
  private readonly listeners: Map<QueueEvent, Set<QueueEventListener>> =
    new Map();

  // Statistics
  private totalAdded: number = 0;
  private totalProcessed: number = 0;
  private totalFailed: number = 0;

  constructor(name: string, config: Partial<QueueConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  /**
   * Set the BullMQ queue instance (for dependency injection)
   */
  setQueue(queue: BullMQQueueInterface): void {
    this.queue = queue;
  }

  /**
   * Get the queue configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }

  /**
   * Get the queue name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the queue service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.shuttingDown) {
      throw this.createError('Cannot initialize queue while shutting down');
    }

    // Initialize scheduler
    this.scheduler = createScheduler(this.name);

    this.initialized = true;
    this.emit('ready', undefined);
  }

  /**
   * Add a job to the queue
   */
  async add(
    jobName: string,
    data: T,
    options: Partial<JobOptions> = {}
  ): Promise<string> {
    this.ensureInitialized();

    validateJobName(jobName);
    validateJobData(data);
    validateJobOptions(options);

    const jobData = createJobData(jobName, data, {
      ...this.config.defaultJobOptions,
      ...options,
    });

    if (this.queue) {
      const result = await this.queue.add(jobName, data, {
        ...options,
        jobId: jobData.id,
      });
      jobData.id = result.id;
    }

    this.jobs.set(jobData.id, jobData);
    this.totalAdded++;

    this.emit('waiting', { jobId: jobData.id, name: jobName });

    return jobData.id;
  }

  /**
   * Add multiple jobs to the queue
   */
  async addBulk(
    jobs: Array<{ name: string; data: T; opts?: Partial<JobOptions> }>
  ): Promise<BulkAddResult> {
    this.ensureInitialized();

    const result: BulkAddResult = {
      added: 0,
      jobIds: [],
      errors: [],
    };

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        validateJobName(job.name);
        validateJobData(job.data);
        if (job.opts) {
          validateJobOptions(job.opts);
        }

        const jobId = await this.add(job.name, job.data, job.opts);
        result.jobIds.push(jobId);
        result.added++;
      } catch (error) {
        result.errors.push({
          index: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<JobData<T> | null> {
    this.ensureInitialized();

    if (this.queue) {
      return this.queue.getJob(jobId) as Promise<JobData<T> | null>;
    }

    return this.jobs.get(jobId) || null;
  }

  /**
   * Get jobs with optional filtering
   */
  async getJobs(filter: JobFilter = {}): Promise<JobData<T>[]> {
    this.ensureInitialized();

    let jobs: JobData<T>[];

    if (this.queue) {
      const states = filter.state
        ? Array.isArray(filter.state)
          ? filter.state
          : [filter.state]
        : undefined;
      jobs = (await this.queue.getJobs(
        states,
        filter.start,
        filter.end
      )) as JobData<T>[];
    } else {
      jobs = Array.from(this.jobs.values());
    }

    // Apply filters
    if (filter.state) {
      jobs = filterByState(jobs, filter.state) as JobData<T>[];
    }

    if (filter.name) {
      jobs = filterByName(jobs, filter.name) as JobData<T>[];
    }

    // Sort by timestamp
    jobs = sortByTimestamp(jobs, filter.order) as JobData<T>[];

    // Paginate
    if (filter.start !== undefined || filter.end !== undefined) {
      jobs = paginateJobs(
        jobs,
        filter.start || 0,
        filter.end || jobs.length
      ) as JobData<T>[];
    }

    return jobs;
  }

  /**
   * Get job counts by state
   */
  async getJobCounts(): Promise<QueueStats> {
    this.ensureInitialized();

    if (this.queue) {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused'
      );
      return {
        name: this.name,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
        total: this.totalAdded,
      };
    }

    // Count from in-memory storage
    const jobs = Array.from(this.jobs.values());
    return {
      name: this.name,
      waiting: jobs.filter((j) => j.state === 'waiting').length,
      active: jobs.filter((j) => j.state === 'active').length,
      completed: jobs.filter((j) => j.state === 'completed').length,
      failed: jobs.filter((j) => j.state === 'failed').length,
      delayed: jobs.filter((j) => j.state === 'delayed').length,
      paused: jobs.filter((j) => j.state === 'paused').length,
      total: this.totalAdded,
    };
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    this.ensureInitialized();

    if (this.queue) {
      await this.queue.remove(jobId);
    }

    return this.jobs.delete(jobId);
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: number): Promise<void> {
    this.ensureInitialized();

    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.max(0, Math.min(100, progress));
      this.emit('progress', { jobId, progress: job.progress });
    }
  }

  /**
   * Process a job (used internally by worker)
   */
  async processJob(jobId: string, result: R): Promise<JobResult<R>> {
    this.ensureInitialized();

    const job = this.jobs.get(jobId);
    if (!job) {
      throw this.createError(`Job not found: ${jobId}`);
    }

    job.state = 'completed';
    job.returnvalue = result;
    job.finishedOn = Date.now();
    this.totalProcessed++;

    const jobResult: JobResult<R> = {
      jobId: job.id,
      name: job.name,
      success: true,
      data: result,
      duration: job.finishedOn - (job.processedOn || job.timestamp),
      attempts: job.attemptsMade,
    };

    this.emit('completed', jobResult);
    return jobResult;
  }

  /**
   * Mark a job as failed
   */
  async failJob(jobId: string, error: string): Promise<void> {
    this.ensureInitialized();

    const job = this.jobs.get(jobId);
    if (!job) {
      throw this.createError(`Job not found: ${jobId}`);
    }

    job.state = 'failed';
    job.failedReason = error;
    job.finishedOn = Date.now();
    this.totalFailed++;

    this.emit('failed', { jobId, name: job.name, error });
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<string> {
    this.ensureInitialized();

    const job = this.jobs.get(jobId);
    if (!job) {
      throw this.createError(`Job not found: ${jobId}`);
    }

    if (job.state !== 'failed') {
      throw this.createError('Can only retry failed jobs');
    }

    // Create a new job with the same data
    return this.add(job.name, job.data, job.opts);
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    this.ensureInitialized();

    if (this.queue) {
      await this.queue.pause();
    }

    this.emit('paused', undefined);
  }

  /**
   * Resume a paused queue
   */
  async resume(): Promise<void> {
    this.ensureInitialized();

    if (this.queue) {
      await this.queue.resume();
    }

    this.emit('resumed', undefined);
  }

  /**
   * Drain the queue (remove all waiting jobs)
   */
  async drain(): Promise<void> {
    this.ensureInitialized();

    if (this.queue) {
      await this.queue.drain();
    } else {
      // Remove all waiting jobs from in-memory storage
      for (const [id, job] of this.jobs) {
        if (job.state === 'waiting') {
          this.jobs.delete(id);
        }
      }
    }

    this.emit('drained', undefined);
  }

  /**
   * Clean old jobs from the queue
   */
  async clean(options: Partial<CleanupOptions> = {}): Promise<number> {
    this.ensureInitialized();

    const opts = { ...DEFAULT_CLEANUP_OPTIONS, ...options };
    let cleaned = 0;

    if (this.queue) {
      const completedCleaned = await this.queue.clean(
        opts.completedAge,
        opts.completedCount || 1000,
        'completed'
      );
      const failedCleaned = await this.queue.clean(
        opts.failedAge,
        opts.failedCount || 5000,
        'failed'
      );
      cleaned = completedCleaned.length + failedCleaned.length;
    } else {
      // Clean from in-memory storage
      const now = Date.now();
      for (const [id, job] of this.jobs) {
        if (job.state === 'completed' && job.finishedOn) {
          if (now - job.finishedOn > opts.completedAge) {
            this.jobs.delete(id);
            cleaned++;
          }
        }
        if (job.state === 'failed' && job.finishedOn) {
          if (now - job.finishedOn > opts.failedAge) {
            this.jobs.delete(id);
            cleaned++;
          }
        }
      }
    }

    this.emit('cleaned', { count: cleaned });
    return cleaned;
  }

  /**
   * Create a worker for this queue
   */
  createWorker(
    processor: JobProcessor<T, R>,
    config: Partial<WorkerConfig> = {}
  ): WorkerManager<T, R> {
    this.ensureInitialized();

    this.worker = createWorkerManager(this.name, processor, config);
    return this.worker;
  }

  /**
   * Create a worker pool for this queue
   */
  createWorkerPool(
    processor: JobProcessor<T, R>,
    config: Partial<WorkerConfig> = {}
  ): WorkerPool<T, R> {
    this.ensureInitialized();

    return createWorkerPool(this.name, processor, config);
  }

  /**
   * Get the worker manager
   */
  getWorker(): WorkerManager<T, R> | null {
    return this.worker;
  }

  /**
   * Add a scheduled job
   */
  addSchedule(config: ScheduledJobConfig): ScheduledJob {
    this.ensureInitialized();

    if (!this.scheduler) {
      throw this.createError('Scheduler not initialized');
    }

    return this.scheduler.addSchedule(config);
  }

  /**
   * Remove a scheduled job
   */
  removeSchedule(name: string): boolean {
    if (!this.scheduler) {
      return false;
    }

    return this.scheduler.removeSchedule(name);
  }

  /**
   * Get all scheduled jobs
   */
  getSchedules(): ScheduledJob[] {
    if (!this.scheduler) {
      return [];
    }

    return this.scheduler.getAllSchedules();
  }

  /**
   * Get the scheduler
   */
  getScheduler(): JobScheduler | null {
    return this.scheduler;
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const stats = await this.getJobCounts();
      const workerStats = this.worker ? [this.worker.getStats()] : [];

      return {
        healthy: true,
        connected: this.initialized,
        stats,
        workers: workerStats,
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        connected: false,
        stats: {
          name: this.name,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
          total: 0,
        },
        workers: [],
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add an event listener
   */
  on(event: QueueEvent, listener: QueueEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove an event listener
   */
  off(event: QueueEvent, listener: QueueEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * Gracefully shutdown the queue
   */
  async shutdown(options: Partial<ShutdownOptions> = {}): Promise<void> {
    if (this.shuttingDown || !this.initialized) {
      return;
    }

    this.shuttingDown = true;
    const opts = { ...DEFAULT_SHUTDOWN_OPTIONS, ...options };

    // Create a timeout promise
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(
        () => reject(new Error('Shutdown timeout')),
        opts.timeoutMs
      );
    });

    try {
      const shutdownTasks: Promise<void>[] = [];

      // Stop the worker if running
      if (this.worker) {
        shutdownTasks.push(this.worker.stop(opts.forceAfterTimeout));
      }

      // Drain the queue if requested
      if (opts.drain) {
        shutdownTasks.push(this.drain());
      }

      // Close the BullMQ queue
      if (this.queue) {
        shutdownTasks.push(this.queue.close());
      }

      await Promise.race([Promise.all(shutdownTasks), timeoutPromise]);
    } catch (error) {
      if (
        opts.forceAfterTimeout &&
        error instanceof Error &&
        error.message === 'Shutdown timeout'
      ) {
        // Force close
        if (this.worker) {
          await this.worker.stop(true);
        }
      } else {
        throw error;
      }
    } finally {
      this.initialized = false;
      this.shuttingDown = false;
      this.jobs.clear();
      this.scheduler?.clearAll();
    }
  }

  /**
   * Create a tenant-scoped queue
   */
  forTenant(context: TenantContext): TenantQueue<T, R> {
    return new TenantQueue(this, context);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: QueueEvent, data: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(event, data);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw this.createError('Queue service not initialized');
    }
  }

  /**
   * Create a ForgeError
   */
  private createError(message: string): ForgeError {
    return new ForgeError({
      code: ErrorCode.QUEUE_ERROR,
      message,
      statusCode: 500,
    });
  }
}

/**
 * Tenant-scoped queue wrapper
 */
export class TenantQueue<T = unknown, R = unknown> {
  private readonly service: QueueService<T, R>;
  private readonly context: TenantContext;
  private readonly namespace: string;

  constructor(service: QueueService<T, R>, context: TenantContext) {
    this.service = service;
    this.context = context;
    this.namespace = `tenant:${context.tenantId}:`;
  }

  /**
   * Get the tenant context
   */
  getContext(): TenantContext {
    return { ...this.context };
  }

  /**
   * Add a job to the queue
   */
  async add(
    jobName: string,
    data: T,
    options: Partial<JobOptions> = {}
  ): Promise<string> {
    const tenantJobName = buildTenantJobName(this.context.tenantId, jobName);
    return this.service.add(tenantJobName, data, options);
  }

  /**
   * Add multiple jobs to the queue
   */
  async addBulk(
    jobs: Array<{ name: string; data: T; opts?: Partial<JobOptions> }>
  ): Promise<BulkAddResult> {
    const tenantJobs = jobs.map((job) => ({
      ...job,
      name: buildTenantJobName(this.context.tenantId, job.name),
    }));
    return this.service.addBulk(tenantJobs);
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<JobData<T> | null> {
    return this.service.getJob(jobId);
  }

  /**
   * Get jobs for this tenant
   */
  async getJobs(filter: JobFilter = {}): Promise<JobData<T>[]> {
    const jobs = await this.service.getJobs(filter);
    return jobs.filter((job) =>
      job.name.startsWith(this.namespace)
    );
  }
}

// Singleton instance
let queueServiceInstance: QueueService | null = null;

/**
 * Get the singleton queue service instance
 */
export function getQueueService(
  name: string = 'default',
  config: Partial<QueueConfig> = {}
): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService(name, config);
  }
  return queueServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetQueueService(): void {
  queueServiceInstance = null;
}

/**
 * Create a new queue service instance
 */
export function createQueueService<T = unknown, R = unknown>(
  name: string,
  config: Partial<QueueConfig> = {}
): QueueService<T, R> {
  return new QueueService<T, R>(name, config);
}
