/**
 * @package @forge/queue
 * @description Tests for queue service and related utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  QueueService,
  TenantQueue,
  getQueueService,
  resetQueueService,
  createQueueService,
} from '../src/queue.service';
import {
  WorkerManager,
  WorkerPool,
  createWorkerManager,
  createWorkerPool,
  formatWorkerStats,
} from '../src/worker';
import {
  JobScheduler,
  createScheduler,
  validateScheduleConfig,
  validateCronPattern,
  parseInterval,
  calculateNextRun,
  toRepeatOptions,
  CronPatterns,
  formatSchedule,
} from '../src/scheduler';
import {
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
  filterByState,
  filterByName,
  sortByTimestamp,
  paginateJobs,
  groupByState,
  countByState,
} from '../src/job';
import {
  DEFAULT_REDIS_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_WORKER_CONFIG,
  DEFAULT_SHUTDOWN_OPTIONS,
  DEFAULT_CLEANUP_OPTIONS,
  JobData,
  JobOptions,
} from '../src/queue.types';

// Mock @forge/errors
vi.mock('@forge/errors', () => ({
  ErrorCode: {
    QUEUE_ERROR: 'INT_9004',
  },
  ForgeError: class ForgeError extends Error {
    code: string;
    statusCode: number;
    details?: unknown;
    metadata?: Record<string, unknown>;

    constructor(params: {
      code: string;
      message: string;
      statusCode: number;
      details?: unknown;
      metadata?: Record<string, unknown>;
    }) {
      super(params.message);
      this.code = params.code;
      this.statusCode = params.statusCode;
      this.details = params.details;
      this.metadata = params.metadata;
    }
  },
}));

// Create mock worker interface
function createMockWorkerInterface() {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    isRunning: vi.fn().mockReturnValue(true),
    isPaused: vi.fn().mockReturnValue(false),
  };
}

describe('Job Utilities', () => {
  describe('generateJobId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateJobId();
      const id2 = generateJobId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct prefix', () => {
      const id = generateJobId();
      expect(id).toMatch(/^job_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('createJobData', () => {
    it('should create job data with defaults', () => {
      const job = createJobData('test-job', { foo: 'bar' });
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ foo: 'bar' });
      expect(job.state).toBe('waiting');
      expect(job.progress).toBe(0);
      expect(job.attemptsMade).toBe(0);
    });

    it('should use custom job ID when provided', () => {
      const job = createJobData('test-job', {}, { jobId: 'custom-id' });
      expect(job.id).toBe('custom-id');
    });

    it('should merge options with defaults', () => {
      const job = createJobData('test-job', {}, { attempts: 5, priority: 1 });
      expect(job.opts.attempts).toBe(5);
      expect(job.opts.priority).toBe(1);
    });
  });

  describe('createSuccessResult', () => {
    it('should create success result', () => {
      const result = createSuccessResult('job-1', 'test', { done: true }, 100, 1);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-1');
      expect(result.name).toBe('test');
      expect(result.data).toEqual({ done: true });
      expect(result.duration).toBe(100);
      expect(result.attempts).toBe(1);
    });
  });

  describe('createFailureResult', () => {
    it('should create failure result', () => {
      const result = createFailureResult('job-1', 'test', 'Something went wrong', 50, 3);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should return 0 for attempt 0', () => {
      const delay = calculateBackoffDelay({ type: 'fixed', delay: 1000 }, 0);
      expect(delay).toBe(0);
    });

    it('should return fixed delay', () => {
      const delay = calculateBackoffDelay({ type: 'fixed', delay: 1000 }, 3);
      expect(delay).toBe(1000);
    });

    it('should calculate exponential delay', () => {
      const strategy = { type: 'exponential' as const, delay: 1000 };
      expect(calculateBackoffDelay(strategy, 1)).toBe(1000);
      expect(calculateBackoffDelay(strategy, 2)).toBe(2000);
      expect(calculateBackoffDelay(strategy, 3)).toBe(4000);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when attempts remain', () => {
      expect(shouldRetry(1, 3)).toBe(true);
      expect(shouldRetry(2, 3)).toBe(true);
    });

    it('should return false when max attempts reached', () => {
      expect(shouldRetry(3, 3)).toBe(false);
      expect(shouldRetry(4, 3)).toBe(false);
    });
  });

  describe('validateJobName', () => {
    it('should accept valid names', () => {
      expect(() => validateJobName('valid-job')).not.toThrow();
      expect(() => validateJobName('job:with:colons')).not.toThrow();
      expect(() => validateJobName('job_123')).not.toThrow();
      expect(() => validateJobName('job.name')).not.toThrow();
    });

    it('should reject empty names', () => {
      expect(() => validateJobName('')).toThrow('non-empty string');
    });

    it('should reject long names', () => {
      expect(() => validateJobName('a'.repeat(257))).toThrow('256 characters');
    });

    it('should reject invalid characters', () => {
      expect(() => validateJobName('job name')).toThrow('alphanumeric');
      expect(() => validateJobName('job@name')).toThrow('alphanumeric');
    });
  });

  describe('validateJobData', () => {
    it('should accept valid data', () => {
      expect(() => validateJobData({ foo: 'bar' })).not.toThrow();
      expect(() => validateJobData([1, 2, 3])).not.toThrow();
      expect(() => validateJobData('string')).not.toThrow();
      expect(() => validateJobData(123)).not.toThrow();
      expect(() => validateJobData(null)).not.toThrow();
      expect(() => validateJobData(undefined)).not.toThrow();
    });

    it('should reject circular references', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      expect(() => validateJobData(obj)).toThrow('JSON serializable');
    });
  });

  describe('validateJobOptions', () => {
    it('should accept valid options', () => {
      expect(() => validateJobOptions({ attempts: 3 })).not.toThrow();
      expect(() => validateJobOptions({ priority: 1 })).not.toThrow();
      expect(() => validateJobOptions({ delay: 5000 })).not.toThrow();
    });

    it('should reject invalid attempts', () => {
      expect(() => validateJobOptions({ attempts: 0 })).toThrow('positive integer');
      expect(() => validateJobOptions({ attempts: -1 })).toThrow('positive integer');
    });

    it('should reject invalid delay', () => {
      expect(() => validateJobOptions({ delay: -1 })).toThrow('non-negative');
    });

    it('should reject invalid backoff type', () => {
      expect(() =>
        validateJobOptions({ backoff: { type: 'invalid' as 'fixed', delay: 1000 } })
      ).toThrow('fixed');
    });

    it('should reject empty job ID', () => {
      expect(() => validateJobOptions({ jobId: '' })).toThrow('non-empty string');
    });
  });

  describe('isTerminalState', () => {
    it('should return true for terminal states', () => {
      expect(isTerminalState('completed')).toBe(true);
      expect(isTerminalState('failed')).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isTerminalState('waiting')).toBe(false);
      expect(isTerminalState('active')).toBe(false);
      expect(isTerminalState('delayed')).toBe(false);
    });
  });

  describe('isActiveState', () => {
    it('should return true for active states', () => {
      expect(isActiveState('active')).toBe(true);
      expect(isActiveState('waiting')).toBe(true);
      expect(isActiveState('delayed')).toBe(true);
    });

    it('should return false for inactive states', () => {
      expect(isActiveState('completed')).toBe(false);
      expect(isActiveState('failed')).toBe(false);
    });
  });

  describe('formatJobForLog', () => {
    it('should format job for logging', () => {
      const job = createJobData('test-job', {});
      const formatted = formatJobForLog(job);
      expect(formatted).toContain('test-job');
      expect(formatted).toContain('waiting');
      expect(formatted).toContain('0/3');
    });
  });

  describe('calculateJobAge', () => {
    it('should calculate job age', () => {
      const job = createJobData('test-job', {});
      job.timestamp = Date.now() - 5000;
      const age = calculateJobAge(job);
      expect(age).toBeGreaterThanOrEqual(5000);
      expect(age).toBeLessThan(6000);
    });
  });

  describe('calculateProcessingDuration', () => {
    it('should return null if not processed', () => {
      const job = createJobData('test-job', {});
      expect(calculateProcessingDuration(job)).toBe(null);
    });

    it('should calculate duration', () => {
      const job = createJobData('test-job', {});
      job.processedOn = Date.now() - 1000;
      job.finishedOn = Date.now();
      const duration = calculateProcessingDuration(job);
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('buildTenantJobName', () => {
    it('should build tenant namespaced name', () => {
      expect(buildTenantJobName('tenant-1', 'process')).toBe('tenant:tenant-1:process');
    });
  });

  describe('extractTenantId', () => {
    it('should extract tenant ID', () => {
      expect(extractTenantId('tenant:tenant-1:process')).toBe('tenant-1');
    });

    it('should return null for non-tenant names', () => {
      expect(extractTenantId('process')).toBe(null);
    });
  });

  describe('extractJobName', () => {
    it('should extract job name', () => {
      expect(extractJobName('tenant:tenant-1:process')).toBe('process');
    });

    it('should return original name if not namespaced', () => {
      expect(extractJobName('process')).toBe('process');
    });
  });

  describe('mergeJobOptions', () => {
    it('should merge options', () => {
      const defaults: JobOptions = {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      };
      const overrides = { attempts: 5, priority: 1 };
      const merged = mergeJobOptions(defaults, overrides);
      expect(merged.attempts).toBe(5);
      expect(merged.priority).toBe(1);
      expect(merged.backoff.type).toBe('exponential');
    });
  });

  describe('serializeJob and deserializeJob', () => {
    it('should serialize and deserialize job', () => {
      const job = createJobData('test-job', { foo: 'bar' });
      job.processedOn = Date.now();
      const serialized = serializeJob(job);
      const deserialized = deserializeJob(serialized);
      expect(deserialized.id).toBe(job.id);
      expect(deserialized.name).toBe(job.name);
      expect(deserialized.data).toEqual(job.data);
    });
  });

  describe('filterByState', () => {
    it('should filter jobs by single state', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
      ];
      jobs[0].state = 'waiting';
      jobs[1].state = 'active';
      jobs[2].state = 'waiting';
      const filtered = filterByState(jobs, 'waiting');
      expect(filtered).toHaveLength(2);
    });

    it('should filter by multiple states', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
      ];
      jobs[0].state = 'waiting';
      jobs[1].state = 'active';
      jobs[2].state = 'completed';
      const filtered = filterByState(jobs, ['waiting', 'active']);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('filterByName', () => {
    it('should filter jobs by name', () => {
      const jobs = [
        createJobData('job-a', {}),
        createJobData('job-b', {}),
        createJobData('job-a', {}),
      ];
      const filtered = filterByName(jobs, 'job-a');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('sortByTimestamp', () => {
    it('should sort by timestamp descending', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
      ];
      jobs[0].timestamp = 1000;
      jobs[1].timestamp = 3000;
      jobs[2].timestamp = 2000;
      const sorted = sortByTimestamp(jobs, 'desc');
      expect(sorted[0].timestamp).toBe(3000);
      expect(sorted[1].timestamp).toBe(2000);
      expect(sorted[2].timestamp).toBe(1000);
    });

    it('should sort by timestamp ascending', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
      ];
      jobs[0].timestamp = 3000;
      jobs[1].timestamp = 1000;
      jobs[2].timestamp = 2000;
      const sorted = sortByTimestamp(jobs, 'asc');
      expect(sorted[0].timestamp).toBe(1000);
    });
  });

  describe('paginateJobs', () => {
    it('should paginate jobs', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
        createJobData('job4', {}),
        createJobData('job5', {}),
      ];
      const page = paginateJobs(jobs, 1, 4);
      expect(page).toHaveLength(3);
      expect(page[0].name).toBe('job2');
    });
  });

  describe('groupByState', () => {
    it('should group jobs by state', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
      ];
      jobs[0].state = 'waiting';
      jobs[1].state = 'active';
      jobs[2].state = 'waiting';
      const groups = groupByState(jobs);
      expect(groups.get('waiting')?.length).toBe(2);
      expect(groups.get('active')?.length).toBe(1);
    });
  });

  describe('countByState', () => {
    it('should count jobs by state', () => {
      const jobs = [
        createJobData('job1', {}),
        createJobData('job2', {}),
        createJobData('job3', {}),
      ];
      jobs[0].state = 'waiting';
      jobs[1].state = 'active';
      jobs[2].state = 'waiting';
      const counts = countByState(jobs);
      expect(counts.get('waiting')).toBe(2);
      expect(counts.get('active')).toBe(1);
    });
  });
});

describe('WorkerManager', () => {
  let worker: WorkerManager;
  let mockWorkerInterface: ReturnType<typeof createMockWorkerInterface>;

  beforeEach(() => {
    worker = createWorkerManager('test-queue', async (job) => {
      return { processed: true, jobId: job.id };
    });
    mockWorkerInterface = createMockWorkerInterface();
    worker.setWorker(mockWorkerInterface);
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const config = worker.getConfig();
      expect(config.concurrency).toBe(DEFAULT_WORKER_CONFIG.concurrency);
    });

    it('should accept custom config', () => {
      const customWorker = createWorkerManager('test', async () => ({}), {
        concurrency: 10,
      });
      expect(customWorker.getConfig().concurrency).toBe(10);
    });
  });

  describe('lifecycle', () => {
    it('should start successfully', async () => {
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      expect(worker.getStatus()).toBe('running');
    });

    it('should not restart when already running', async () => {
      await worker.start();
      await worker.start();
      expect(mockWorkerInterface.run).toHaveBeenCalledTimes(1);
    });

    it('should pause and resume', async () => {
      await worker.start();
      await worker.pause();
      expect(worker.getStatus()).toBe('paused');
      await worker.resume();
      expect(worker.getStatus()).toBe('running');
    });

    it('should stop gracefully', async () => {
      await worker.start();
      await worker.stop();
      expect(worker.getStatus()).toBe('closed');
    });

    it('should throw when starting without worker', async () => {
      const noWorker = createWorkerManager('test', async () => ({}));
      await expect(noWorker.start()).rejects.toThrow('not initialized');
    });

    it('should throw when starting during close', async () => {
      await worker.start();
      const stopPromise = worker.stop();
      await expect(worker.start()).rejects.toThrow('closing');
      await stopPromise;
    });
  });

  describe('job processing', () => {
    beforeEach(async () => {
      await worker.start();
    });

    it('should process job successfully', async () => {
      const job = createJobData('test-job', { foo: 'bar' });
      const result = await worker.processJob(job);
      expect(result).toEqual({ processed: true, jobId: job.id });
    });

    it('should track statistics', async () => {
      const job = createJobData('test-job', {});
      await worker.processJob(job);
      const stats = worker.getStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.totalFailed).toBe(0);
    });

    it('should track failed jobs', async () => {
      const failingWorker = createWorkerManager('test', async () => {
        throw new Error('Processing failed');
      });
      failingWorker.setWorker(mockWorkerInterface);
      await failingWorker.start();

      const job = createJobData('test-job', {});
      await expect(failingWorker.processJob(job)).rejects.toThrow('Processing failed');

      const stats = failingWorker.getStats();
      expect(stats.totalFailed).toBe(1);
    });

    it('should emit events', async () => {
      const completedListener = vi.fn();
      worker.on('completed', completedListener);

      const job = createJobData('test-job', {});
      await worker.processJob(job);

      expect(completedListener).toHaveBeenCalled();
    });

    it('should reset statistics', async () => {
      const job = createJobData('test-job', {});
      await worker.processJob(job);
      worker.resetStats();
      const stats = worker.getStats();
      expect(stats.totalProcessed).toBe(0);
    });
  });

  describe('events', () => {
    it('should add and remove listeners', async () => {
      const listener = vi.fn();
      worker.on('completed', listener);
      worker.off('completed', listener);

      await worker.start();
      const job = createJobData('test-job', {});
      await worker.processJob(job);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = createWorkerPool('test-queue', async (job) => {
      return { processed: true, jobId: job.id };
    });
  });

  it('should add workers', () => {
    pool.addWorker('worker-1');
    pool.addWorker('worker-2');
    expect(pool.size).toBe(2);
  });

  it('should reject duplicate worker IDs', () => {
    pool.addWorker('worker-1');
    expect(() => pool.addWorker('worker-1')).toThrow('already exists');
  });

  it('should get worker by ID', () => {
    pool.addWorker('worker-1');
    const worker = pool.getWorker('worker-1');
    expect(worker).toBeDefined();
    expect(worker?.getQueueName()).toBe('test-queue');
  });

  it('should get all workers', () => {
    pool.addWorker('worker-1');
    pool.addWorker('worker-2');
    const workers = pool.getAllWorkers();
    expect(workers).toHaveLength(2);
  });

  it('should remove worker', async () => {
    const w = pool.addWorker('worker-1');
    w.setWorker(createMockWorkerInterface());
    await w.start();

    const removed = await pool.removeWorker('worker-1');
    expect(removed).toBe(true);
    expect(pool.size).toBe(0);
  });

  it('should return false when removing non-existent worker', async () => {
    const removed = await pool.removeWorker('non-existent');
    expect(removed).toBe(false);
  });

  it('should scale pool', async () => {
    await pool.scaleTo(3);
    expect(pool.size).toBe(3);
    await pool.scaleTo(1);
    expect(pool.size).toBe(1);
  });

  it('should get pool statistics', () => {
    pool.addWorker('worker-1');
    pool.addWorker('worker-2');
    const stats = pool.getPoolStats();
    expect(stats).toHaveLength(2);
  });

  it('should get aggregated statistics', () => {
    pool.addWorker('worker-1');
    pool.addWorker('worker-2');
    const stats = pool.getAggregatedStats();
    expect(stats.totalWorkers).toBe(2);
  });
});

describe('formatWorkerStats', () => {
  it('should format worker stats', () => {
    const stats = {
      id: 'worker-1',
      queueName: 'test-queue',
      status: 'running' as const,
      activeJobs: 2,
      totalProcessed: 100,
      totalFailed: 5,
      jobsPerSecond: 10,
      avgProcessingTime: 50,
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };
    const formatted = formatWorkerStats(stats);
    expect(formatted).toContain('worker-1');
    expect(formatted).toContain('running');
    expect(formatted).toContain('100');
    expect(formatted).toContain('5');
  });
});

describe('JobScheduler', () => {
  let scheduler: JobScheduler;

  beforeEach(() => {
    scheduler = createScheduler('test-queue');
  });

  describe('schedule management', () => {
    it('should add schedule', () => {
      const schedule = scheduler.addSchedule({
        name: 'daily-job',
        pattern: '0 0 * * *',
      });
      expect(schedule.name).toBe('daily-job');
      expect(schedule.active).toBe(true);
    });

    it('should reject duplicate schedule names', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      expect(() =>
        scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' })
      ).toThrow('already exists');
    });

    it('should remove schedule', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      const removed = scheduler.removeSchedule('job-1');
      expect(removed).toBe(true);
      expect(scheduler.count).toBe(0);
    });

    it('should get schedule by name', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      const schedule = scheduler.getSchedule('job-1');
      expect(schedule?.name).toBe('job-1');
    });

    it('should get all schedules', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      scheduler.addSchedule({ name: 'job-2', pattern: '0 * * * *' });
      const schedules = scheduler.getAllSchedules();
      expect(schedules).toHaveLength(2);
    });

    it('should get active schedules', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      scheduler.addSchedule({ name: 'job-2', pattern: '0 * * * *' });
      scheduler.pauseSchedule('job-1');
      const active = scheduler.getActiveSchedules();
      expect(active).toHaveLength(1);
    });
  });

  describe('pause and resume', () => {
    it('should pause schedule', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      const paused = scheduler.pauseSchedule('job-1');
      expect(paused).toBe(true);
      expect(scheduler.getSchedule('job-1')?.active).toBe(false);
    });

    it('should resume schedule', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      scheduler.pauseSchedule('job-1');
      const resumed = scheduler.resumeSchedule('job-1');
      expect(resumed).toBe(true);
      expect(scheduler.getSchedule('job-1')?.active).toBe(true);
    });

    it('should return false for non-existent schedule', () => {
      expect(scheduler.pauseSchedule('non-existent')).toBe(false);
      expect(scheduler.resumeSchedule('non-existent')).toBe(false);
    });
  });

  describe('update schedule', () => {
    it('should update schedule', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      const updated = scheduler.updateSchedule('job-1', { pattern: '0 * * * *' });
      expect(updated?.pattern).toBe('0 * * * *');
    });

    it('should return null for non-existent schedule', () => {
      const updated = scheduler.updateSchedule('non-existent', { pattern: '0 * * * *' });
      expect(updated).toBe(null);
    });
  });

  describe('record execution', () => {
    it('should record execution', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      scheduler.recordExecution('job-1');
      const schedule = scheduler.getSchedule('job-1');
      expect(schedule?.executionCount).toBe(1);
      expect(schedule?.lastRun).toBeDefined();
    });

    it('should deactivate when limit reached', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *', limit: 2 });
      scheduler.recordExecution('job-1');
      scheduler.recordExecution('job-1');
      const schedule = scheduler.getSchedule('job-1');
      expect(schedule?.active).toBe(false);
    });
  });

  describe('clear all', () => {
    it('should clear all schedules', () => {
      scheduler.addSchedule({ name: 'job-1', pattern: '* * * * *' });
      scheduler.addSchedule({ name: 'job-2', pattern: '0 * * * *' });
      scheduler.clearAll();
      expect(scheduler.count).toBe(0);
    });
  });
});

describe('Schedule Validation', () => {
  describe('validateScheduleConfig', () => {
    it('should accept valid config', () => {
      expect(() =>
        validateScheduleConfig({ name: 'job', pattern: '* * * * *' })
      ).not.toThrow();
    });

    it('should reject empty name', () => {
      expect(() => validateScheduleConfig({ name: '', pattern: '* * * * *' })).toThrow(
        'non-empty string'
      );
    });

    it('should reject long name', () => {
      expect(() =>
        validateScheduleConfig({ name: 'a'.repeat(257), pattern: '* * * * *' })
      ).toThrow('256 characters');
    });

    it('should reject invalid limit', () => {
      expect(() =>
        validateScheduleConfig({ name: 'job', pattern: '* * * * *', limit: 0 })
      ).toThrow('positive integer');
    });

    it('should reject invalid date range', () => {
      expect(() =>
        validateScheduleConfig({
          name: 'job',
          pattern: '* * * * *',
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-01-01'),
        })
      ).toThrow('before end date');
    });
  });

  describe('validateCronPattern', () => {
    it('should accept valid cron patterns', () => {
      expect(() => validateCronPattern('* * * * *')).not.toThrow();
      expect(() => validateCronPattern('0 0 * * *')).not.toThrow();
      expect(() => validateCronPattern('*/5 * * * *')).not.toThrow();
      expect(() => validateCronPattern('0 0 1 * *')).not.toThrow();
    });

    it('should accept interval format', () => {
      expect(() => validateCronPattern('every 5m')).not.toThrow();
      expect(() => validateCronPattern('every 1h')).not.toThrow();
      expect(() => validateCronPattern('every 30s')).not.toThrow();
    });

    it('should reject invalid cron patterns', () => {
      expect(() => validateCronPattern('')).toThrow('non-empty string');
      expect(() => validateCronPattern('* * *')).toThrow('5 or 6 fields');
      expect(() => validateCronPattern('invalid')).toThrow('5 or 6 fields');
    });

    it('should reject invalid interval format', () => {
      expect(() => validateCronPattern('every 5x')).toThrow('Invalid interval');
    });
  });
});

describe('parseInterval', () => {
  it('should parse seconds', () => {
    expect(parseInterval('every 30s')).toBe(30000);
  });

  it('should parse minutes', () => {
    expect(parseInterval('every 5m')).toBe(300000);
  });

  it('should parse hours', () => {
    expect(parseInterval('every 2h')).toBe(7200000);
  });

  it('should parse days', () => {
    expect(parseInterval('every 1d')).toBe(86400000);
  });

  it('should throw for invalid format', () => {
    expect(() => parseInterval('invalid')).toThrow();
  });
});

describe('calculateNextRun', () => {
  it('should calculate next run for interval', () => {
    const now = new Date();
    const next = calculateNextRun('every 5m', now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getTime() - now.getTime()).toBe(300000);
  });

  it('should calculate next run for cron', () => {
    const now = new Date();
    const next = calculateNextRun('* * * * *', now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('toRepeatOptions', () => {
  it('should convert interval to repeat options', () => {
    const opts = toRepeatOptions({ name: 'job', pattern: 'every 5m' });
    expect(opts.every).toBe(300000);
  });

  it('should convert cron to repeat options', () => {
    const opts = toRepeatOptions({ name: 'job', pattern: '0 * * * *' });
    expect(opts.pattern).toBe('0 * * * *');
  });

  it('should include timezone', () => {
    const opts = toRepeatOptions({
      name: 'job',
      pattern: '* * * * *',
      timezone: 'America/New_York',
    });
    expect(opts.tz).toBe('America/New_York');
  });

  it('should include limit', () => {
    const opts = toRepeatOptions({
      name: 'job',
      pattern: '* * * * *',
      limit: 10,
    });
    expect(opts.limit).toBe(10);
  });
});

describe('CronPatterns', () => {
  it('should have valid patterns', () => {
    expect(() => validateCronPattern(CronPatterns.EVERY_MINUTE)).not.toThrow();
    expect(() => validateCronPattern(CronPatterns.EVERY_5_MINUTES)).not.toThrow();
    expect(() => validateCronPattern(CronPatterns.EVERY_HOUR)).not.toThrow();
    expect(() => validateCronPattern(CronPatterns.DAILY_MIDNIGHT)).not.toThrow();
    expect(() => validateCronPattern(CronPatterns.WEEKLY_MONDAY)).not.toThrow();
    expect(() => validateCronPattern(CronPatterns.MONTHLY_FIRST)).not.toThrow();
  });
});

describe('formatSchedule', () => {
  it('should format schedule', () => {
    const scheduler = createScheduler('test');
    const schedule = scheduler.addSchedule({
      name: 'daily-job',
      pattern: '0 0 * * *',
    });
    const formatted = formatSchedule(schedule);
    expect(formatted).toContain('daily-job');
    expect(formatted).toContain('0 0 * * *');
    expect(formatted).toContain('active');
  });
});

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    resetQueueService();
    service = createQueueService('test-queue');
  });

  afterEach(async () => {
    if (service.isInitialized()) {
      await service.shutdown();
    }
    resetQueueService();
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
    });

    it('should not reinitialize', async () => {
      await service.initialize();
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
    });

    it('should get queue name', () => {
      expect(service.getName()).toBe('test-queue');
    });

    it('should get config', () => {
      const config = service.getConfig();
      expect(config).toEqual(DEFAULT_QUEUE_CONFIG);
    });
  });

  describe('job operations', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add a job', async () => {
      const jobId = await service.add('process', { data: 'test' });
      expect(jobId).toBeDefined();
    });

    it('should get a job', async () => {
      const jobId = await service.add('process', { data: 'test' });
      const job = await service.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.name).toBe('process');
    });

    it('should get jobs', async () => {
      await service.add('process', { data: 1 });
      await service.add('process', { data: 2 });
      const jobs = await service.getJobs();
      expect(jobs).toHaveLength(2);
    });

    it('should filter jobs by state', async () => {
      await service.add('process', {});
      const jobs = await service.getJobs({ state: 'waiting' });
      expect(jobs.every((j) => j.state === 'waiting')).toBe(true);
    });

    it('should filter jobs by name', async () => {
      await service.add('job-a', {});
      await service.add('job-b', {});
      const jobs = await service.getJobs({ name: 'job-a' });
      expect(jobs.every((j) => j.name === 'job-a')).toBe(true);
    });

    it('should remove a job', async () => {
      const jobId = await service.add('process', {});
      const removed = await service.removeJob(jobId);
      expect(removed).toBe(true);
      expect(await service.getJob(jobId)).toBe(null);
    });

    it('should throw when not initialized', async () => {
      const uninitService = createQueueService('test');
      await expect(uninitService.add('job', {})).rejects.toThrow('not initialized');
    });
  });

  describe('bulk operations', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add bulk jobs', async () => {
      const result = await service.addBulk([
        { name: 'job-1', data: { id: 1 } },
        { name: 'job-2', data: { id: 2 } },
        { name: 'job-3', data: { id: 3 } },
      ]);
      expect(result.added).toBe(3);
      expect(result.jobIds).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors in bulk add', async () => {
      const result = await service.addBulk([
        { name: 'valid-job', data: {} },
        { name: '', data: {} }, // Invalid name
      ]);
      expect(result.added).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });
  });

  describe('job counts', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get job counts', async () => {
      await service.add('job', {});
      await service.add('job', {});
      const counts = await service.getJobCounts();
      expect(counts.waiting).toBe(2);
      expect(counts.total).toBe(2);
    });
  });

  describe('progress', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should update job progress', async () => {
      const jobId = await service.add('job', {});
      await service.updateProgress(jobId, 50);
      const job = await service.getJob(jobId);
      expect(job?.progress).toBe(50);
    });

    it('should clamp progress to 0-100', async () => {
      const jobId = await service.add('job', {});
      await service.updateProgress(jobId, 150);
      const job = await service.getJob(jobId);
      expect(job?.progress).toBe(100);
    });
  });

  describe('job completion', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should process job', async () => {
      const jobId = await service.add('job', {});
      const result = await service.processJob(jobId, { done: true });
      expect(result.success).toBe(true);
      const job = await service.getJob(jobId);
      expect(job?.state).toBe('completed');
    });

    it('should fail job', async () => {
      const jobId = await service.add('job', {});
      await service.failJob(jobId, 'Something went wrong');
      const job = await service.getJob(jobId);
      expect(job?.state).toBe('failed');
      expect(job?.failedReason).toBe('Something went wrong');
    });

    it('should retry failed job', async () => {
      const jobId = await service.add('job', { value: 1 });
      await service.failJob(jobId, 'Failed');
      const newJobId = await service.retryJob(jobId);
      expect(newJobId).not.toBe(jobId);
      const newJob = await service.getJob(newJobId);
      expect(newJob?.state).toBe('waiting');
    });

    it('should throw when retrying non-failed job', async () => {
      const jobId = await service.add('job', {});
      await expect(service.retryJob(jobId)).rejects.toThrow('failed jobs');
    });
  });

  describe('pause and resume', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should pause and resume', async () => {
      await service.pause();
      await service.resume();
      // No error means success
    });

    it('should emit events', async () => {
      const pausedListener = vi.fn();
      const resumedListener = vi.fn();
      service.on('paused', pausedListener);
      service.on('resumed', resumedListener);

      await service.pause();
      await service.resume();

      expect(pausedListener).toHaveBeenCalled();
      expect(resumedListener).toHaveBeenCalled();
    });
  });

  describe('drain', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should drain waiting jobs', async () => {
      await service.add('job', {});
      await service.add('job', {});
      await service.drain();
      const counts = await service.getJobCounts();
      expect(counts.waiting).toBe(0);
    });
  });

  describe('clean', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should clean old jobs', async () => {
      const jobId = await service.add('job', {});
      await service.processJob(jobId, {});
      // Artificially age the job
      const job = await service.getJob(jobId);
      if (job) {
        job.finishedOn = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      }
      const cleaned = await service.clean({ completedAge: 24 * 60 * 60 * 1000 });
      expect(cleaned).toBe(1);
    });
  });

  describe('worker', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should create worker', () => {
      const worker = service.createWorker(async (job) => ({ id: job.id }));
      expect(worker).toBeDefined();
      expect(service.getWorker()).toBe(worker);
    });

    it('should create worker pool', () => {
      const pool = service.createWorkerPool(async (job) => ({ id: job.id }));
      expect(pool).toBeDefined();
    });
  });

  describe('scheduler', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add schedule', () => {
      const schedule = service.addSchedule({
        name: 'daily',
        pattern: '0 0 * * *',
      });
      expect(schedule.name).toBe('daily');
    });

    it('should remove schedule', () => {
      service.addSchedule({ name: 'daily', pattern: '0 0 * * *' });
      const removed = service.removeSchedule('daily');
      expect(removed).toBe(true);
    });

    it('should get schedules', () => {
      service.addSchedule({ name: 'daily', pattern: '0 0 * * *' });
      service.addSchedule({ name: 'hourly', pattern: '0 * * * *' });
      const schedules = service.getSchedules();
      expect(schedules).toHaveLength(2);
    });

    it('should get scheduler', () => {
      const scheduler = service.getScheduler();
      expect(scheduler).toBeDefined();
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return healthy status', async () => {
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.connected).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add and remove listeners', async () => {
      const listener = vi.fn();
      service.on('waiting', listener);

      await service.add('job', {});
      expect(listener).toHaveBeenCalled();

      service.off('waiting', listener);
      listener.mockClear();

      await service.add('job', {});
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.shutdown();
      expect(service.isInitialized()).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      await service.shutdown();
      expect(service.isInitialized()).toBe(false);
    });
  });
});

describe('TenantQueue', () => {
  let service: QueueService;
  let tenantQueue: TenantQueue;

  beforeEach(async () => {
    service = createQueueService('test-queue');
    await service.initialize();
    tenantQueue = service.forTenant({ tenantId: 'tenant-123' });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should get tenant context', () => {
    const context = tenantQueue.getContext();
    expect(context.tenantId).toBe('tenant-123');
  });

  it('should add job with tenant namespace', async () => {
    const jobId = await tenantQueue.add('process', { data: 'test' });
    const job = await service.getJob(jobId);
    expect(job?.name).toBe('tenant:tenant-123:process');
  });

  it('should add bulk jobs with tenant namespace', async () => {
    const result = await tenantQueue.addBulk([
      { name: 'job-1', data: {} },
      { name: 'job-2', data: {} },
    ]);
    expect(result.added).toBe(2);
  });

  it('should get tenant jobs only', async () => {
    await tenantQueue.add('job', {});
    await service.add('other-job', {}); // Non-tenant job
    const jobs = await tenantQueue.getJobs();
    expect(jobs.every((j) => j.name.startsWith('tenant:tenant-123:'))).toBe(true);
  });

  it('should isolate tenant data', async () => {
    const tenant1 = service.forTenant({ tenantId: 'tenant-1' });
    const tenant2 = service.forTenant({ tenantId: 'tenant-2' });

    await tenant1.add('job', { data: 1 });
    await tenant2.add('job', { data: 2 });

    const tenant1Jobs = await tenant1.getJobs();
    const tenant2Jobs = await tenant2.getJobs();

    expect(tenant1Jobs).toHaveLength(1);
    expect(tenant2Jobs).toHaveLength(1);
  });
});

describe('Singleton', () => {
  it('should return same instance', () => {
    const instance1 = getQueueService('default');
    const instance2 = getQueueService();
    expect(instance1).toBe(instance2);
  });

  it('should reset instance', () => {
    const instance1 = getQueueService('default');
    resetQueueService();
    const instance2 = getQueueService('default');
    expect(instance1).not.toBe(instance2);
  });
});

describe('Types and Defaults', () => {
  it('should have correct default Redis config', () => {
    expect(DEFAULT_REDIS_CONFIG.host).toBe('localhost');
    expect(DEFAULT_REDIS_CONFIG.port).toBe(6379);
    expect(DEFAULT_REDIS_CONFIG.db).toBe(0);
    expect(DEFAULT_REDIS_CONFIG.keyPrefix).toBe('forge:queue:');
  });

  it('should have correct default queue config', () => {
    expect(DEFAULT_QUEUE_CONFIG.redis).toEqual(DEFAULT_REDIS_CONFIG);
    expect(DEFAULT_QUEUE_CONFIG.defaultJobOptions.attempts).toBe(3);
    expect(DEFAULT_QUEUE_CONFIG.enableLogging).toBe(false);
  });

  it('should have correct default worker config', () => {
    expect(DEFAULT_WORKER_CONFIG.concurrency).toBe(1);
    expect(DEFAULT_WORKER_CONFIG.lockDuration).toBe(30000);
  });

  it('should have correct default shutdown options', () => {
    expect(DEFAULT_SHUTDOWN_OPTIONS.timeoutMs).toBe(30000);
    expect(DEFAULT_SHUTDOWN_OPTIONS.forceAfterTimeout).toBe(true);
    expect(DEFAULT_SHUTDOWN_OPTIONS.drain).toBe(false);
  });

  it('should have correct default cleanup options', () => {
    expect(DEFAULT_CLEANUP_OPTIONS.completedAge).toBe(24 * 60 * 60 * 1000);
    expect(DEFAULT_CLEANUP_OPTIONS.failedAge).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
