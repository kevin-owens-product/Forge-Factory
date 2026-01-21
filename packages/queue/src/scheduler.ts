/**
 * @package @forge/queue
 * @description Scheduled and recurring job management for BullMQ
 */

import {
  ScheduledJobConfig,
  RepeatOptions,
  JobOptions,
  DEFAULT_QUEUE_CONFIG,
} from './queue.types';

/**
 * Scheduled job entry
 */
export interface ScheduledJob {
  /** Unique schedule name */
  name: string;
  /** Cron pattern or interval */
  pattern: string;
  /** Whether the schedule is active */
  active: boolean;
  /** Job data */
  data: unknown;
  /** Job options */
  opts: JobOptions;
  /** Timezone for cron */
  timezone?: string;
  /** Next scheduled execution time */
  nextRun?: Date;
  /** Last execution time */
  lastRun?: Date;
  /** Number of executions */
  executionCount: number;
  /** Maximum number of executions (optional) */
  limit?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Scheduler for managing recurring jobs
 */
export class JobScheduler {
  private readonly schedules: Map<string, ScheduledJob> = new Map();
  private readonly queueName: string;

  constructor(queueName: string) {
    this.queueName = queueName;
  }

  /**
   * Get the queue name
   */
  getQueueName(): string {
    return this.queueName;
  }

  /**
   * Add a scheduled job
   */
  addSchedule(config: ScheduledJobConfig): ScheduledJob {
    validateScheduleConfig(config);

    if (this.schedules.has(config.name)) {
      throw new Error(`Schedule with name "${config.name}" already exists`);
    }

    const schedule: ScheduledJob = {
      name: config.name,
      pattern: config.pattern,
      active: true,
      data: config.data,
      opts: {
        ...DEFAULT_QUEUE_CONFIG.defaultJobOptions,
        ...config.opts,
      },
      timezone: config.timezone || 'UTC',
      nextRun: calculateNextRun(config.pattern, config.startDate),
      executionCount: 0,
      limit: config.limit,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.schedules.set(config.name, schedule);
    return schedule;
  }

  /**
   * Remove a scheduled job
   */
  removeSchedule(name: string): boolean {
    return this.schedules.delete(name);
  }

  /**
   * Get a scheduled job by name
   */
  getSchedule(name: string): ScheduledJob | undefined {
    return this.schedules.get(name);
  }

  /**
   * Get all scheduled jobs
   */
  getAllSchedules(): ScheduledJob[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get active scheduled jobs
   */
  getActiveSchedules(): ScheduledJob[] {
    return Array.from(this.schedules.values()).filter((s) => s.active);
  }

  /**
   * Pause a scheduled job
   */
  pauseSchedule(name: string): boolean {
    const schedule = this.schedules.get(name);
    if (!schedule) {
      return false;
    }

    schedule.active = false;
    schedule.updatedAt = new Date();
    return true;
  }

  /**
   * Resume a paused scheduled job
   */
  resumeSchedule(name: string): boolean {
    const schedule = this.schedules.get(name);
    if (!schedule) {
      return false;
    }

    schedule.active = true;
    schedule.nextRun = calculateNextRun(schedule.pattern);
    schedule.updatedAt = new Date();
    return true;
  }

  /**
   * Update a scheduled job
   */
  updateSchedule(
    name: string,
    updates: Partial<ScheduledJobConfig>
  ): ScheduledJob | null {
    const schedule = this.schedules.get(name);
    if (!schedule) {
      return null;
    }

    if (updates.pattern !== undefined) {
      validateCronPattern(updates.pattern);
      schedule.pattern = updates.pattern;
      schedule.nextRun = calculateNextRun(updates.pattern);
    }

    if (updates.data !== undefined) {
      schedule.data = updates.data;
    }

    if (updates.opts !== undefined) {
      schedule.opts = { ...schedule.opts, ...updates.opts };
    }

    if (updates.timezone !== undefined) {
      schedule.timezone = updates.timezone;
    }

    if (updates.limit !== undefined) {
      schedule.limit = updates.limit;
    }

    schedule.updatedAt = new Date();
    return schedule;
  }

  /**
   * Record a job execution
   */
  recordExecution(name: string): void {
    const schedule = this.schedules.get(name);
    if (!schedule) {
      return;
    }

    schedule.executionCount++;
    schedule.lastRun = new Date();
    schedule.nextRun = calculateNextRun(schedule.pattern);
    schedule.updatedAt = new Date();

    // Check if limit has been reached
    if (schedule.limit && schedule.executionCount >= schedule.limit) {
      schedule.active = false;
    }
  }

  /**
   * Get schedules due for execution
   */
  getDueSchedules(): ScheduledJob[] {
    const now = new Date();
    return Array.from(this.schedules.values()).filter(
      (s) => s.active && s.nextRun && s.nextRun <= now
    );
  }

  /**
   * Clear all schedules
   */
  clearAll(): void {
    this.schedules.clear();
  }

  /**
   * Get schedule count
   */
  get count(): number {
    return this.schedules.size;
  }
}

/**
 * Validate a schedule configuration
 */
export function validateScheduleConfig(config: ScheduledJobConfig): void {
  if (!config.name || typeof config.name !== 'string') {
    throw new Error('Schedule name must be a non-empty string');
  }

  if (config.name.length > 256) {
    throw new Error('Schedule name must be 256 characters or less');
  }

  validateCronPattern(config.pattern);

  if (config.limit !== undefined) {
    if (!Number.isInteger(config.limit) || config.limit < 1) {
      throw new Error('Schedule limit must be a positive integer');
    }
  }

  if (config.startDate !== undefined && !(config.startDate instanceof Date)) {
    throw new Error('Start date must be a Date object');
  }

  if (config.endDate !== undefined && !(config.endDate instanceof Date)) {
    throw new Error('End date must be a Date object');
  }

  if (config.startDate && config.endDate && config.startDate >= config.endDate) {
    throw new Error('Start date must be before end date');
  }
}

/**
 * Validate a cron pattern
 */
export function validateCronPattern(pattern: string): void {
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('Cron pattern must be a non-empty string');
  }

  // Check for interval format (e.g., "every 5m", "every 1h")
  if (pattern.startsWith('every ')) {
    const intervalMatch = pattern.match(/^every\s+(\d+)([smhd])$/);
    if (!intervalMatch) {
      throw new Error(
        'Invalid interval format. Use "every <number><unit>" where unit is s, m, h, or d'
      );
    }
    return;
  }

  // Basic cron validation (5 or 6 fields)
  const parts = pattern.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new Error(
      'Cron pattern must have 5 or 6 fields (minute hour day month weekday [year])'
    );
  }

  // Validate each field has valid characters
  const validChars = /^[\d\*\/\-,]+$/;
  for (const part of parts) {
    if (!validChars.test(part)) {
      throw new Error(`Invalid cron field: ${part}`);
    }
  }
}

/**
 * Parse an interval string to milliseconds
 */
export function parseInterval(interval: string): number {
  const match = interval.match(/^every\s+(\d+)([smhd])$/);
  if (!match) {
    throw new Error('Invalid interval format');
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Calculate the next run time for a pattern
 */
export function calculateNextRun(
  pattern: string,
  after?: Date
): Date {
  const now = after || new Date();

  // Handle interval format
  if (pattern.startsWith('every ')) {
    const intervalMs = parseInterval(pattern);
    return new Date(now.getTime() + intervalMs);
  }

  // For cron patterns, use a simple next-minute calculation
  // In production, this would use a proper cron parser library
  return getNextCronTime(pattern, now);
}

/**
 * Get next cron execution time
 * This is a simplified implementation - in production, use a proper cron parser
 */
function getNextCronTime(pattern: string, after: Date): Date {
  const parts = pattern.split(/\s+/);
  const minute = parts[0];
  const hour = parts[1];
  const day = parts[2];
  const month = parts[3];
  const weekday = parts[4];

  // Create a date starting from the next minute
  const next = new Date(after);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  // Simple cron matching for common patterns
  // In production, use a library like cron-parser

  // Handle "* * * * *" (every minute)
  if (
    minute === '*' &&
    hour === '*' &&
    day === '*' &&
    month === '*' &&
    weekday === '*'
  ) {
    return next;
  }

  // Handle specific minute with wildcards for others
  if (
    /^\d+$/.test(minute) &&
    hour === '*' &&
    day === '*' &&
    month === '*' &&
    weekday === '*'
  ) {
    const targetMinute = parseInt(minute, 10);
    if (next.getMinutes() <= targetMinute) {
      next.setMinutes(targetMinute);
    } else {
      next.setHours(next.getHours() + 1);
      next.setMinutes(targetMinute);
    }
    return next;
  }

  // Handle "0 * * * *" (every hour)
  if (
    minute === '0' &&
    hour === '*' &&
    day === '*' &&
    month === '*' &&
    weekday === '*'
  ) {
    next.setMinutes(0);
    if (next <= after) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }

  // Handle "0 0 * * *" (every day at midnight)
  if (
    minute === '0' &&
    hour === '0' &&
    day === '*' &&
    month === '*' &&
    weekday === '*'
  ) {
    next.setMinutes(0);
    next.setHours(0);
    if (next <= after) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // Default: add 1 minute (fallback for complex patterns)
  return next;
}

/**
 * Convert schedule config to BullMQ repeat options
 */
export function toRepeatOptions(config: ScheduledJobConfig): RepeatOptions {
  const opts: RepeatOptions = {};

  if (config.pattern.startsWith('every ')) {
    opts.every = parseInterval(config.pattern);
  } else {
    opts.pattern = config.pattern;
  }

  if (config.timezone) {
    opts.tz = config.timezone;
  }

  if (config.startDate) {
    opts.startDate = config.startDate;
  }

  if (config.endDate) {
    opts.endDate = config.endDate;
  }

  if (config.limit) {
    opts.limit = config.limit;
  }

  return opts;
}

/**
 * Create common cron patterns
 */
export const CronPatterns = {
  /** Every minute */
  EVERY_MINUTE: '* * * * *',
  /** Every 5 minutes */
  EVERY_5_MINUTES: '*/5 * * * *',
  /** Every 15 minutes */
  EVERY_15_MINUTES: '*/15 * * * *',
  /** Every 30 minutes */
  EVERY_30_MINUTES: '*/30 * * * *',
  /** Every hour */
  EVERY_HOUR: '0 * * * *',
  /** Every day at midnight */
  DAILY_MIDNIGHT: '0 0 * * *',
  /** Every day at noon */
  DAILY_NOON: '0 12 * * *',
  /** Every Monday at midnight */
  WEEKLY_MONDAY: '0 0 * * 1',
  /** First day of every month at midnight */
  MONTHLY_FIRST: '0 0 1 * *',
} as const;

/**
 * Create a scheduler instance
 */
export function createScheduler(queueName: string): JobScheduler {
  return new JobScheduler(queueName);
}

/**
 * Format schedule for logging
 */
export function formatSchedule(schedule: ScheduledJob): string {
  const status = schedule.active ? 'active' : 'paused';
  const nextRun = schedule.nextRun
    ? schedule.nextRun.toISOString()
    : 'not scheduled';
  return `Schedule[${schedule.name}] pattern="${schedule.pattern}" status=${status} next=${nextRun} runs=${schedule.executionCount}`;
}
