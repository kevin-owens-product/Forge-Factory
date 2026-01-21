/**
 * @package @forge/cache
 * @description Main cache service class with tenant-aware operations
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import { RedisClient, RedisClientInterface } from './redis-client';
import {
  CacheConfig,
  DEFAULT_CACHE_CONFIG,
  TenantContext,
  GetOptions,
  SetOptions,
  DeleteOptions,
  BatchOptions,
  BatchGetResult,
  CacheStats,
  HealthCheckResult,
  ConnectionStatus,
  ShutdownOptions,
  LockOptions,
  DEFAULT_LOCK_OPTIONS,
  LockResult,
  CacheEntry,
} from './cache.types';
import {
  serialize,
  deserialize,
  encode,
  decode,
  buildKey,
  validateKey,
  calculateSize,
  generateLockToken,
} from './serialization';

/**
 * Cache service providing tenant-aware Redis cache operations
 */
export class CacheService {
  private config: CacheConfig;
  private redisClient: RedisClient;
  private initialized = false;
  private stats: CacheStats;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ...DEFAULT_CACHE_CONFIG,
      ...config,
      redis: { ...DEFAULT_CACHE_CONFIG.redis, ...config.redis },
    };
    this.redisClient = new RedisClient(this.config.redis);
    this.stats = this.initializeStats();
  }

  /**
   * Initialize statistics object
   */
  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      totalGets: 0,
      totalSets: 0,
      totalDeletes: 0,
      hitRate: 0,
      avgLatencyMs: 0,
      totalOperations: 0,
      failedOperations: 0,
      status: 'disconnected',
    };
  }

  /**
   * Set the Redis client (for dependency injection)
   */
  setRedisClient(client: RedisClientInterface): void {
    this.redisClient.setClient(client);
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.redisClient.connect();
      this.initialized = true;
      this.stats.status = 'connected';

      if (this.config.enableLogging) {
        console.log('[CacheService] Initialized successfully');
      }
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Failed to initialize cache service',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a value from the cache
   */
  async get<T = unknown>(key: string, options: GetOptions = {}): Promise<T | null> {
    this.ensureInitialized();
    validateKey(key);

    const startTime = Date.now();
    const fullKey = buildKey(this.config.redis.keyPrefix, options.namespace, key);

    try {
      const result = await this.redisClient.execute(
        (client) => client.get(fullKey)
      );

      this.stats.totalGets++;
      this.stats.totalOperations++;

      if (result === null) {
        this.stats.misses++;
        this.updateHitRate();
        this.recordLatency(startTime);
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      // Refresh TTL if requested
      if (options.refreshTtl) {
        await this.redisClient.execute(
          (client) => client.expire(fullKey, this.config.defaultTtlSeconds)
        );
      }

      const serialized = decode(result);
      const value = deserialize<T>(serialized);

      this.recordLatency(startTime);

      if (this.config.enableLogging) {
        console.log(`[CacheService] GET ${fullKey} - hit`);
      }

      return value;
    } catch (error) {
      this.stats.failedOperations++;
      this.recordLatency(startTime);

      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache get operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { key: fullKey },
      });
    }
  }

  /**
   * Get a value with its metadata
   */
  async getWithMetadata<T = unknown>(key: string, options: GetOptions = {}): Promise<CacheEntry<T> | null> {
    this.ensureInitialized();
    validateKey(key);

    const fullKey = buildKey(this.config.redis.keyPrefix, options.namespace, key);

    try {
      const [result, ttl] = await Promise.all([
        this.redisClient.execute((client) => client.get(fullKey)),
        this.redisClient.execute((client) => client.ttl(fullKey)),
      ]);

      if (result === null) {
        return null;
      }

      const serialized = decode(result);
      const value = deserialize<T>(serialized);

      return {
        value,
        metadata: {
          key,
          ttlSeconds: ttl,
          sizeBytes: calculateSize(result),
        },
      };
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache getWithMetadata operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { key: fullKey },
      });
    }
  }

  /**
   * Set a value in the cache
   */
  async set<T = unknown>(key: string, value: T, options: SetOptions = {}): Promise<boolean> {
    this.ensureInitialized();
    validateKey(key);

    const startTime = Date.now();
    const fullKey = buildKey(this.config.redis.keyPrefix, options.namespace, key);
    const ttl = options.ttlSeconds ?? this.config.defaultTtlSeconds;

    try {
      const serialized = serialize(value);
      const encoded = encode(serialized);

      const setOptions: { EX?: number; NX?: boolean; XX?: boolean } = {};
      if (ttl > 0) {
        setOptions.EX = ttl;
      }
      if (options.ifNotExists) {
        setOptions.NX = true;
      }
      if (options.ifExists) {
        setOptions.XX = true;
      }

      const result = await this.redisClient.execute(
        (client) => client.set(fullKey, encoded, setOptions)
      );

      this.stats.totalSets++;
      this.stats.totalOperations++;
      this.recordLatency(startTime);

      const success = result === 'OK';

      if (this.config.enableLogging) {
        console.log(`[CacheService] SET ${fullKey} - ${success ? 'success' : 'skipped'}`);
      }

      return success;
    } catch (error) {
      this.stats.failedOperations++;
      this.recordLatency(startTime);

      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache set operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { key: fullKey },
      });
    }
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string, options: DeleteOptions = {}): Promise<boolean> {
    this.ensureInitialized();
    validateKey(key);

    const startTime = Date.now();
    const fullKey = buildKey(this.config.redis.keyPrefix, options.namespace, key);

    try {
      const result = await this.redisClient.execute(
        (client) => client.del(fullKey)
      );

      this.stats.totalDeletes++;
      this.stats.totalOperations++;
      this.recordLatency(startTime);

      if (this.config.enableLogging) {
        console.log(`[CacheService] DEL ${fullKey} - ${result > 0 ? 'deleted' : 'not found'}`);
      }

      return result > 0;
    } catch (error) {
      this.stats.failedOperations++;
      this.recordLatency(startTime);

      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache delete operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { key: fullKey },
      });
    }
  }

  /**
   * Check if a key exists in the cache
   */
  async exists(key: string, options: GetOptions = {}): Promise<boolean> {
    this.ensureInitialized();
    validateKey(key);

    const fullKey = buildKey(this.config.redis.keyPrefix, options.namespace, key);

    try {
      const result = await this.redisClient.execute(
        (client) => client.exists(fullKey)
      );
      return result > 0;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache exists operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { key: fullKey },
      });
    }
  }

  /**
   * Get multiple values from the cache
   */
  async getMany<T = unknown>(keys: string[], options: BatchOptions = {}): Promise<BatchGetResult<T>> {
    this.ensureInitialized();

    for (const key of keys) {
      validateKey(key);
    }

    const fullKeys = keys.map((key) =>
      buildKey(this.config.redis.keyPrefix, options.namespace, key)
    );

    try {
      const results = await this.redisClient.execute(
        (client) => client.mget(fullKeys)
      );

      const found = new Map<string, T>();
      const missing: string[] = [];

      results.forEach((result, index) => {
        const originalKey = keys[index];
        if (result === null) {
          missing.push(originalKey);
          this.stats.misses++;
        } else {
          const serialized = decode(result);
          const value = deserialize<T>(serialized);
          found.set(originalKey, value);
          this.stats.hits++;
        }
      });

      this.stats.totalGets += keys.length;
      this.stats.totalOperations += keys.length;
      this.updateHitRate();

      return { found, missing };
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache getMany operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Set multiple values in the cache
   */
  async setMany<T = unknown>(entries: Map<string, T>, options: BatchOptions = {}): Promise<boolean> {
    this.ensureInitialized();

    const keyValuePairs: [string, string][] = [];

    for (const [key, value] of entries) {
      validateKey(key);
      const fullKey = buildKey(this.config.redis.keyPrefix, options.namespace, key);
      const serialized = serialize(value);
      const encoded = encode(serialized);
      keyValuePairs.push([fullKey, encoded]);
    }

    try {
      await this.redisClient.execute(
        (client) => client.mset(keyValuePairs)
      );

      // Set TTL for each key if specified
      const ttl = options.ttlSeconds ?? this.config.defaultTtlSeconds;
      if (ttl > 0) {
        await Promise.all(
          keyValuePairs.map(([fullKey]) =>
            this.redisClient.execute((client) => client.expire(fullKey, ttl))
          )
        );
      }

      this.stats.totalSets += entries.size;
      this.stats.totalOperations += entries.size;

      return true;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache setMany operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete multiple values from the cache
   */
  async deleteMany(keys: string[], options: DeleteOptions = {}): Promise<number> {
    this.ensureInitialized();

    for (const key of keys) {
      validateKey(key);
    }

    const fullKeys = keys.map((key) =>
      buildKey(this.config.redis.keyPrefix, options.namespace, key)
    );

    try {
      const result = await this.redisClient.execute(
        (client) => client.del(fullKeys)
      );

      this.stats.totalDeletes += keys.length;
      this.stats.totalOperations += keys.length;

      return result;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache deleteMany operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete all keys matching a pattern in a namespace
   */
  async deleteByPattern(pattern: string, namespace?: string): Promise<number> {
    this.ensureInitialized();

    const fullPattern = buildKey(this.config.redis.keyPrefix, namespace, pattern);

    try {
      const keys = await this.redisClient.execute(
        (client) => client.keys(fullPattern)
      );

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redisClient.execute(
        (client) => client.del(keys)
      );

      this.stats.totalDeletes += keys.length;
      this.stats.totalOperations += keys.length;

      return result;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache deleteByPattern operation failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { pattern: fullPattern },
      });
    }
  }

  /**
   * Get or set a value with a factory function
   */
  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    options: SetOptions = {}
  ): Promise<T> {
    this.ensureInitialized();

    const existing = await this.get<T>(key, { namespace: options.namespace });
    if (existing !== null) {
      return existing;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Acquire a distributed lock
   */
  async acquireLock(key: string, options: Partial<LockOptions> = {}): Promise<LockResult> {
    this.ensureInitialized();

    const opts = { ...DEFAULT_LOCK_OPTIONS, ...options };
    const lockKey = buildKey(this.config.redis.keyPrefix, 'locks:', key);
    const token = generateLockToken();
    const startTime = Date.now();

    // Use do-while to ensure at least one attempt
    do {
      try {
        const result = await this.redisClient.execute((client) =>
          client.set(lockKey, token, { EX: Math.ceil(opts.ttlMs / 1000), NX: true })
        );

        if (result === 'OK') {
          return { acquired: true, token };
        }

        // If no wait time remaining, exit immediately
        if (Date.now() - startTime >= opts.waitTimeMs) {
          break;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, opts.retryIntervalMs));
      } catch (error) {
        return {
          acquired: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    } while (Date.now() - startTime < opts.waitTimeMs);

    return { acquired: false, error: 'Lock acquisition timeout' };
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    this.ensureInitialized();

    const lockKey = buildKey(this.config.redis.keyPrefix, 'locks:', key);

    try {
      // Only release if token matches
      const currentToken = await this.redisClient.execute((client) =>
        client.get(lockKey)
      );

      if (currentToken !== token) {
        return false;
      }

      const result = await this.redisClient.execute((client) =>
        client.del(lockKey)
      );

      return result > 0;
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Failed to release lock',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: { key: lockKey },
      });
    }
  }

  /**
   * Get cache for a specific tenant
   */
  forTenant(context: TenantContext): TenantCache {
    return new TenantCache(this, context);
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const stats = this.getStats();

    try {
      const isHealthy = await this.redisClient.ping();
      const responseTimeMs = Date.now() - startTime;

      if (!isHealthy) {
        return {
          healthy: false,
          status: this.redisClient.getStatus(),
          responseTimeMs,
          stats,
          timestamp: new Date(),
          error: 'Ping failed',
        };
      }

      const serverInfo = await this.redisClient.getServerInfo();

      return {
        healthy: true,
        status: 'connected',
        responseTimeMs,
        stats,
        timestamp: new Date(),
        serverInfo: {
          version: serverInfo.redis_version || 'unknown',
          connectedClients: parseInt(serverInfo.connected_clients || '0', 10),
          usedMemory: serverInfo.used_memory_human || 'unknown',
          uptime: parseInt(serverInfo.uptime_in_seconds || '0', 10),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        status: this.redisClient.getStatus(),
        responseTimeMs: Date.now() - startTime,
        stats,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      status: this.redisClient.getStatus(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.redisClient.getStatus();
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gracefully shutdown the cache service
   */
  async shutdown(options: Partial<ShutdownOptions> = {}): Promise<void> {
    if (!this.initialized) {
      return;
    }

    if (this.config.enableLogging) {
      console.log('[CacheService] Shutting down...');
    }

    try {
      await this.redisClient.shutdown(options);
      this.initialized = false;
      this.stats.status = 'disconnected';

      if (this.config.enableLogging) {
        console.log('[CacheService] Shutdown complete');
      }
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Failed to shutdown cache service',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Ensure the service is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ForgeError({
        code: ErrorCode.CACHE_ERROR,
        message: 'Cache service not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Record operation latency
   */
  private recordLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    const total = this.stats.totalOperations;
    this.stats.avgLatencyMs =
      ((this.stats.avgLatencyMs * (total - 1)) + latency) / total;
  }
}

/**
 * Tenant-scoped cache wrapper
 */
export class TenantCache {
  private service: CacheService;
  private context: TenantContext;

  constructor(service: CacheService, context: TenantContext) {
    this.service = service;
    this.context = context;
  }

  /**
   * Get the tenant namespace
   */
  private getNamespace(): string {
    return `tenant:${this.context.tenantId}:`;
  }

  async get<T = unknown>(key: string, options: GetOptions = {}): Promise<T | null> {
    return this.service.get<T>(key, {
      ...options,
      namespace: this.getNamespace(),
    });
  }

  async set<T = unknown>(key: string, value: T, options: SetOptions = {}): Promise<boolean> {
    return this.service.set(key, value, {
      ...options,
      namespace: this.getNamespace(),
    });
  }

  async delete(key: string, options: DeleteOptions = {}): Promise<boolean> {
    return this.service.delete(key, {
      ...options,
      namespace: this.getNamespace(),
    });
  }

  async exists(key: string): Promise<boolean> {
    return this.service.exists(key, { namespace: this.getNamespace() });
  }

  async getMany<T = unknown>(keys: string[]): Promise<BatchGetResult<T>> {
    return this.service.getMany<T>(keys, { namespace: this.getNamespace() });
  }

  async setMany<T = unknown>(entries: Map<string, T>, options: BatchOptions = {}): Promise<boolean> {
    return this.service.setMany(entries, {
      ...options,
      namespace: this.getNamespace(),
    });
  }

  async deleteMany(keys: string[]): Promise<number> {
    return this.service.deleteMany(keys, { namespace: this.getNamespace() });
  }

  async deleteByPattern(pattern: string): Promise<number> {
    return this.service.deleteByPattern(pattern, this.getNamespace());
  }

  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    options: SetOptions = {}
  ): Promise<T> {
    return this.service.getOrSet(key, factory, {
      ...options,
      namespace: this.getNamespace(),
    });
  }
}

/**
 * Singleton instance of the cache service
 */
let cacheServiceInstance: CacheService | null = null;

/**
 * Get the singleton cache service instance
 */
export function getCacheService(config?: Partial<CacheConfig>): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(config);
  }
  return cacheServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCacheService(): void {
  if (cacheServiceInstance) {
    cacheServiceInstance = null;
  }
}
