/**
 * @package @forge/cache
 * @description Redis client wrapper with connection management
 */

import {
  RedisConfig,
  DEFAULT_REDIS_CONFIG,
  ConnectionStatus,
  CacheEvent,
  CacheEventListener,
  ShutdownOptions,
  DEFAULT_SHUTDOWN_OPTIONS,
} from './cache.types';

/**
 * Minimal interface for Redis client operations
 * This allows for easy mocking in tests and potential adapters
 */
export interface RedisClientInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  quit(): Promise<void>;
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean; XX?: boolean }): Promise<string | null>;
  del(key: string | string[]): Promise<number>;
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(keyValuePairs: [string, string][]): Promise<string>;
  exists(key: string | string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, options?: { MATCH?: string; COUNT?: number }): Promise<{ cursor: number; keys: string[] }>;
  info(section?: string): Promise<string>;
  flushdb(): Promise<string>;
  setnx(key: string, value: string): Promise<number>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

/**
 * Redis connection manager
 * Handles connection lifecycle, reconnection, and events
 */
export class RedisClient {
  private config: RedisConfig;
  private client: RedisClientInterface | null = null;
  private status: ConnectionStatus = 'disconnected';
  private eventListeners: Map<CacheEvent, Set<CacheEventListener>> = new Map();
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = {
      ...DEFAULT_REDIS_CONFIG,
      ...config,
    };
  }

  /**
   * Set the Redis client (useful for dependency injection and testing)
   */
  setClient(client: RedisClientInterface): void {
    this.client = client;
  }

  /**
   * Get the underlying Redis client
   */
  getClient(): RedisClientInterface | null {
    return this.client;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot connect while shutting down');
    }

    if (this.status === 'connected') {
      return;
    }

    this.status = 'connecting';
    this.emit('connect');

    try {
      if (!this.client) {
        // In a real implementation, we would create the Redis client here
        // For now, we expect it to be injected via setClient
        throw new Error('Redis client not configured. Use setClient() to provide a Redis client instance.');
      }

      await this.client.connect();
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.emit('ready');
    } catch (error) {
      this.status = 'error';
      this.emit('error', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected' || !this.client) {
      return;
    }

    try {
      await this.client.quit();
      this.status = 'disconnected';
      this.emit('disconnect');
    } catch (error) {
      // Force disconnect on error
      try {
        await this.client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.status = 'disconnected';
      this.emit('disconnect');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(options: Partial<ShutdownOptions> = {}): Promise<void> {
    const opts = { ...DEFAULT_SHUTDOWN_OPTIONS, ...options };
    this.isShuttingDown = true;

    const shutdownPromise = this.disconnect();

    if (opts.forceAfterTimeout) {
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout')), opts.timeoutMs);
      });

      try {
        await Promise.race([shutdownPromise, timeoutPromise]);
      } catch {
        // Force close on timeout
        if (this.client) {
          try {
            await this.client.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        }
        this.status = 'disconnected';
      }
    } else {
      await shutdownPromise;
    }

    this.emit('close');
    this.isShuttingDown = false;
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    if (!this.client || this.status !== 'connected') {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Get configuration
   */
  getConfig(): RedisConfig {
    return { ...this.config };
  }

  /**
   * Get key prefix
   */
  getKeyPrefix(): string {
    return this.config.keyPrefix;
  }

  /**
   * Execute a Redis command with timeout
   */
  async execute<T>(
    operation: (client: RedisClientInterface) => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }

    if (this.status !== 'connected') {
      throw new Error(`Redis client is ${this.status}`);
    }

    const timeout = timeoutMs ?? this.config.commandTimeoutMs;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Redis command timeout'));
      }, timeout);

      operation(this.client!)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get Redis server info
   */
  async getServerInfo(): Promise<Record<string, string>> {
    const info = await this.execute((client) => client.info());
    const lines = info.split('\n');
    const result: Record<string, string> = {};

    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }

    return result;
  }

  /**
   * Add event listener
   */
  on(event: CacheEvent, listener: CacheEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: CacheEvent, listener: CacheEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event
   */
  private emit(event: CacheEvent, data?: Record<string, unknown>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event, data);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Attempt to reconnect
   */
  async reconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.status = 'error';
      this.emit('error', { error: 'Max reconnection attempts reached' });
      throw new Error('Max reconnection attempts reached');
    }

    this.status = 'reconnecting';
    this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.retryDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxRetryDelayMs
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      if (this.config.reconnectOnError && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        return this.reconnect();
      }
      throw error;
    }
  }

  /**
   * Reset reconnection attempts counter
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }
}

/**
 * Singleton instance of the Redis client
 */
let redisClientInstance: RedisClient | null = null;

/**
 * Get the singleton Redis client instance
 */
export function getRedisClient(config?: Partial<RedisConfig>): RedisClient {
  if (!redisClientInstance) {
    redisClientInstance = new RedisClient(config);
  }
  return redisClientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetRedisClient(): void {
  if (redisClientInstance) {
    redisClientInstance = null;
  }
}
