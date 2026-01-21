/**
 * @package @forge/queue
 * @description Worker management for BullMQ job processing
 */

import {
  WorkerConfig,
  WorkerStats,
  WorkerStatus,
  JobProcessor,
  JobData,
  QueueEvent,
  QueueEventListener,
  DEFAULT_WORKER_CONFIG,
} from './queue.types';
import {
  createSuccessResult,
  createFailureResult,
} from './job';

/**
 * BullMQ Worker interface (for mocking in tests)
 */
export interface BullMQWorkerInterface {
  run(): Promise<void>;
  pause(doNotWaitActive?: boolean): Promise<void>;
  resume(): Promise<void>;
  close(force?: boolean): Promise<void>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
  isRunning(): boolean;
  isPaused(): boolean;
}

/**
 * Worker manager for handling job processing
 */
export class WorkerManager<T = unknown, R = unknown> {
  private readonly queueName: string;
  private readonly config: WorkerConfig;
  private readonly processor: JobProcessor<T, R>;

  private worker: BullMQWorkerInterface | null = null;
  private status: WorkerStatus = 'closed';
  private startedAt: Date | null = null;
  private lastActivityAt: Date = new Date();

  // Statistics
  private totalProcessed: number = 0;
  private totalFailed: number = 0;
  private activeJobs: number = 0;
  private processingTimes: number[] = [];
  private readonly maxProcessingTimeSamples: number = 100;

  // Event listeners
  private readonly listeners: Map<QueueEvent, Set<QueueEventListener>> =
    new Map();

  constructor(
    queueName: string,
    processor: JobProcessor<T, R>,
    config: Partial<WorkerConfig> = {}
  ) {
    this.queueName = queueName;
    this.processor = processor;
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }

  /**
   * Set the BullMQ worker instance (for dependency injection)
   */
  setWorker(worker: BullMQWorkerInterface): void {
    this.worker = worker;
  }

  /**
   * Get the current worker configuration
   */
  getConfig(): WorkerConfig {
    return { ...this.config };
  }

  /**
   * Get the queue name this worker is processing
   */
  getQueueName(): string {
    return this.queueName;
  }

  /**
   * Get the current worker status
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Check if the worker is running
   */
  isRunning(): boolean {
    return this.status === 'running';
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      return;
    }

    if (this.status === 'closing') {
      throw new Error('Cannot start worker while it is closing');
    }

    if (!this.worker) {
      throw new Error('Worker not initialized. Call setWorker() first.');
    }

    this.status = 'running';
    this.startedAt = new Date();
    this.lastActivityAt = new Date();

    await this.worker.run();
    this.emit('resumed', undefined);
  }

  /**
   * Pause the worker (stop accepting new jobs)
   */
  async pause(waitForActive: boolean = true): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    this.status = 'paused';
    await this.worker.pause(!waitForActive);
    this.emit('paused', undefined);
  }

  /**
   * Resume a paused worker
   */
  async resume(): Promise<void> {
    if (this.status !== 'paused') {
      return;
    }

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    this.status = 'running';
    await this.worker.resume();
    this.emit('resumed', undefined);
  }

  /**
   * Stop the worker gracefully
   */
  async stop(force: boolean = false): Promise<void> {
    if (this.status === 'closed' || this.status === 'closing') {
      return;
    }

    if (!this.worker) {
      this.status = 'closed';
      return;
    }

    this.status = 'closing';

    try {
      await this.worker.close(force);
      this.status = 'closed';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Process a job
   */
  async processJob(job: JobData<T>): Promise<R> {
    const startTime = Date.now();
    this.activeJobs++;
    this.lastActivityAt = new Date();

    this.emit('active', { jobId: job.id, name: job.name });

    try {
      const result = await this.processor(job);
      const duration = Date.now() - startTime;

      this.totalProcessed++;
      this.recordProcessingTime(duration);

      const jobResult = createSuccessResult(
        job.id,
        job.name,
        result,
        duration,
        job.attemptsMade + 1
      );

      this.emit('completed', jobResult);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalFailed++;
      this.recordProcessingTime(duration);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const jobResult = createFailureResult(
        job.id,
        job.name,
        errorMessage,
        duration,
        job.attemptsMade + 1
      );

      this.emit('failed', jobResult);
      throw error;
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): WorkerStats {
    return {
      id: this.generateWorkerId(),
      queueName: this.queueName,
      status: this.status,
      activeJobs: this.activeJobs,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      jobsPerSecond: this.calculateJobsPerSecond(),
      avgProcessingTime: this.calculateAvgProcessingTime(),
      startedAt: this.startedAt || new Date(),
      lastActivityAt: this.lastActivityAt,
    };
  }

  /**
   * Reset worker statistics
   */
  resetStats(): void {
    this.totalProcessed = 0;
    this.totalFailed = 0;
    this.processingTimes = [];
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
   * Record a processing time sample
   */
  private recordProcessingTime(duration: number): void {
    this.processingTimes.push(duration);
    if (this.processingTimes.length > this.maxProcessingTimeSamples) {
      this.processingTimes.shift();
    }
  }

  /**
   * Calculate average processing time
   */
  private calculateAvgProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0;
    }
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.processingTimes.length);
  }

  /**
   * Calculate jobs per second throughput
   */
  private calculateJobsPerSecond(): number {
    if (!this.startedAt) {
      return 0;
    }

    const elapsedSeconds = (Date.now() - this.startedAt.getTime()) / 1000;
    if (elapsedSeconds === 0) {
      return 0;
    }

    return Math.round((this.totalProcessed / elapsedSeconds) * 100) / 100;
  }

  /**
   * Generate a unique worker ID
   */
  private generateWorkerId(): string {
    const timestamp = this.startedAt?.getTime().toString(36) || '0';
    return `worker_${this.queueName}_${timestamp}`;
  }
}

/**
 * Worker pool for managing multiple workers
 */
export class WorkerPool<T = unknown, R = unknown> {
  private readonly workers: Map<string, WorkerManager<T, R>> = new Map();
  private readonly queueName: string;
  private readonly processor: JobProcessor<T, R>;
  private readonly config: WorkerConfig;

  constructor(
    queueName: string,
    processor: JobProcessor<T, R>,
    config: Partial<WorkerConfig> = {}
  ) {
    this.queueName = queueName;
    this.processor = processor;
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }

  /**
   * Get the number of workers in the pool
   */
  get size(): number {
    return this.workers.size;
  }

  /**
   * Add a worker to the pool
   */
  addWorker(id?: string): WorkerManager<T, R> {
    const workerId = id || `worker_${this.workers.size}`;

    if (this.workers.has(workerId)) {
      throw new Error(`Worker with ID ${workerId} already exists`);
    }

    const worker = new WorkerManager<T, R>(
      this.queueName,
      this.processor,
      this.config
    );

    this.workers.set(workerId, worker);
    return worker;
  }

  /**
   * Remove a worker from the pool
   */
  async removeWorker(id: string, force: boolean = false): Promise<boolean> {
    const worker = this.workers.get(id);
    if (!worker) {
      return false;
    }

    await worker.stop(force);
    this.workers.delete(id);
    return true;
  }

  /**
   * Get a worker by ID
   */
  getWorker(id: string): WorkerManager<T, R> | undefined {
    return this.workers.get(id);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): WorkerManager<T, R>[] {
    return Array.from(this.workers.values());
  }

  /**
   * Start all workers
   */
  async startAll(): Promise<void> {
    const promises = Array.from(this.workers.values()).map((w) => w.start());
    await Promise.all(promises);
  }

  /**
   * Pause all workers
   */
  async pauseAll(waitForActive: boolean = true): Promise<void> {
    const promises = Array.from(this.workers.values()).map((w) =>
      w.pause(waitForActive)
    );
    await Promise.all(promises);
  }

  /**
   * Resume all workers
   */
  async resumeAll(): Promise<void> {
    const promises = Array.from(this.workers.values()).map((w) => w.resume());
    await Promise.all(promises);
  }

  /**
   * Stop all workers
   */
  async stopAll(force: boolean = false): Promise<void> {
    const promises = Array.from(this.workers.values()).map((w) =>
      w.stop(force)
    );
    await Promise.all(promises);
  }

  /**
   * Get statistics for all workers
   */
  getPoolStats(): WorkerStats[] {
    return Array.from(this.workers.values()).map((w) => w.getStats());
  }

  /**
   * Get aggregated statistics
   */
  getAggregatedStats(): {
    totalWorkers: number;
    runningWorkers: number;
    totalProcessed: number;
    totalFailed: number;
    avgProcessingTime: number;
  } {
    const stats = this.getPoolStats();

    return {
      totalWorkers: stats.length,
      runningWorkers: stats.filter((s) => s.status === 'running').length,
      totalProcessed: stats.reduce((sum, s) => sum + s.totalProcessed, 0),
      totalFailed: stats.reduce((sum, s) => sum + s.totalFailed, 0),
      avgProcessingTime:
        stats.length > 0
          ? Math.round(
              stats.reduce((sum, s) => sum + s.avgProcessingTime, 0) /
                stats.length
            )
          : 0,
    };
  }

  /**
   * Scale the pool to a specific number of workers
   */
  async scaleTo(count: number): Promise<void> {
    const current = this.workers.size;

    if (count > current) {
      // Add workers
      for (let i = current; i < count; i++) {
        this.addWorker();
      }
    } else if (count < current) {
      // Remove workers
      const toRemove = Array.from(this.workers.keys()).slice(
        count,
        current
      );
      for (const id of toRemove) {
        await this.removeWorker(id);
      }
    }
  }
}

/**
 * Create a worker manager instance
 */
export function createWorkerManager<T = unknown, R = unknown>(
  queueName: string,
  processor: JobProcessor<T, R>,
  config: Partial<WorkerConfig> = {}
): WorkerManager<T, R> {
  return new WorkerManager(queueName, processor, config);
}

/**
 * Create a worker pool instance
 */
export function createWorkerPool<T = unknown, R = unknown>(
  queueName: string,
  processor: JobProcessor<T, R>,
  config: Partial<WorkerConfig> = {}
): WorkerPool<T, R> {
  return new WorkerPool(queueName, processor, config);
}

/**
 * Format worker stats for logging
 */
export function formatWorkerStats(stats: WorkerStats): string {
  return (
    `Worker[${stats.id}] ` +
    `status=${stats.status} ` +
    `active=${stats.activeJobs} ` +
    `processed=${stats.totalProcessed} ` +
    `failed=${stats.totalFailed} ` +
    `rate=${stats.jobsPerSecond}/s ` +
    `avgTime=${stats.avgProcessingTime}ms`
  );
}
