/**
 * @package @forge/realtime
 * @description Reconnection logic with exponential backoff
 */

import { ReconnectConfig } from './realtime.types';

/**
 * Default reconnect configuration
 */
export const DEFAULT_RECONNECT_CONFIG: Required<ReconnectConfig> = {
  enabled: true,
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: true,
};

/**
 * Reconnect state
 */
export interface ReconnectState {
  /** Number of reconnect attempts */
  attempts: number;
  /** Current delay */
  delay: number;
  /** Whether reconnection is in progress */
  isReconnecting: boolean;
  /** Last error */
  lastError?: Error;
  /** Next retry timestamp */
  nextRetryAt?: Date;
}

/**
 * Reconnect event types
 */
export enum ReconnectEvent {
  ATTEMPT = 'attempt',
  SUCCESS = 'success',
  FAILURE = 'failure',
  MAX_ATTEMPTS = 'max_attempts',
  CANCELLED = 'cancelled',
}

/**
 * Reconnect handler callback
 */
export type ReconnectHandler = (state: ReconnectState) => void;

/**
 * Reconnection manager with exponential backoff
 */
export class ReconnectManager {
  private config: Required<ReconnectConfig>;
  private state: ReconnectState = {
    attempts: 0,
    delay: 0,
    isReconnecting: false,
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private handlers: Map<ReconnectEvent, Set<ReconnectHandler>> = new Map();
  private connectFn: () => Promise<void>;

  constructor(config: ReconnectConfig, connectFn: () => Promise<void>) {
    this.config = { ...DEFAULT_RECONNECT_CONFIG, ...config };
    this.connectFn = connectFn;
  }

  /**
   * Get current state
   */
  getState(): ReconnectState {
    return { ...this.state };
  }

  /**
   * Check if should attempt reconnection
   */
  shouldReconnect(): boolean {
    if (!this.config.enabled) return false;
    return this.state.attempts < this.config.maxAttempts;
  }

  /**
   * Start reconnection process
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.state.isReconnecting) {
      return;
    }

    this.state.isReconnecting = true;
    this.scheduleReconnect();
  }

  /**
   * Stop reconnection process
   */
  stop(): void {
    this.cancel();
  }

  /**
   * Cancel ongoing reconnection
   */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state.isReconnecting = false;
    this.emit(ReconnectEvent.CANCELLED);
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    this.cancel();
    this.state = {
      attempts: 0,
      delay: 0,
      isReconnecting: false,
    };
  }

  /**
   * Mark connection as successful
   */
  onConnected(): void {
    this.reset();
    this.emit(ReconnectEvent.SUCCESS);
  }

  /**
   * Mark connection as failed
   */
  onDisconnected(error?: Error): void {
    this.state.lastError = error;
    if (this.config.enabled && !this.state.isReconnecting) {
      this.start();
    }
  }

  /**
   * Subscribe to reconnect events
   */
  on(event: ReconnectEvent, handler: ReconnectHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from reconnect events
   */
  off(event: ReconnectEvent, handler: ReconnectHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * Schedule next reconnect attempt
   */
  private scheduleReconnect(): void {
    if (!this.shouldReconnect()) {
      this.state.isReconnecting = false;
      this.emit(ReconnectEvent.MAX_ATTEMPTS);
      return;
    }

    this.state.attempts++;
    this.state.delay = this.calculateDelay();
    this.state.nextRetryAt = new Date(Date.now() + this.state.delay);

    this.emit(ReconnectEvent.ATTEMPT);

    this.timer = setTimeout(() => {
      this.attemptReconnect();
    }, this.state.delay);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    this.connectFn()
      .then(() => {
        this.onConnected();
      })
      .catch((error) => {
        this.state.lastError = error;
        this.emit(ReconnectEvent.FAILURE);
        this.scheduleReconnect();
      });
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(): number {
    const { initialDelay, maxDelay, multiplier, jitter } = this.config;

    // Exponential backoff: delay = initialDelay * multiplier^(attempts - 1)
    let delay = initialDelay * Math.pow(multiplier, this.state.attempts - 1);

    // Cap at maxDelay
    delay = Math.min(delay, maxDelay);

    // Add jitter if enabled (+/- 25%)
    if (jitter) {
      const jitterRange = delay * 0.25;
      delay += Math.random() * jitterRange * 2 - jitterRange;
    }

    return Math.floor(delay);
  }

  /**
   * Emit event to handlers
   */
  private emit(event: ReconnectEvent): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const state = this.getState();
      handlers.forEach((handler) => {
        try {
          handler(state);
        } catch (error) {
          console.error('Reconnect handler error:', error);
        }
      });
    }
  }
}

/**
 * Calculate reconnect delay
 */
export function calculateBackoffDelay(
  attempt: number,
  config: ReconnectConfig
): number {
  const fullConfig = { ...DEFAULT_RECONNECT_CONFIG, ...config };
  const { initialDelay, maxDelay, multiplier, jitter } = fullConfig;

  let delay = initialDelay * Math.pow(multiplier, attempt - 1);
  delay = Math.min(delay, maxDelay);

  if (jitter) {
    const jitterRange = delay * 0.25;
    delay += Math.random() * jitterRange * 2 - jitterRange;
  }

  return Math.floor(delay);
}

/**
 * Create a reconnect manager
 */
export function createReconnectManager(
  config: ReconnectConfig,
  connectFn: () => Promise<void>
): ReconnectManager {
  return new ReconnectManager(config, connectFn);
}
