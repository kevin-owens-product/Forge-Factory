/**
 * @package @forge/cache
 * @description Redis caching wrapper for Forge Factory
 */

// Types
export {
  // Configuration
  RedisConfig,
  DEFAULT_REDIS_CONFIG,
  CacheConfig,
  DEFAULT_CACHE_CONFIG,

  // Status and Events
  ConnectionStatus,
  CacheEvent,
  CacheEventListener,

  // Cache Entry
  CacheEntry,
  CacheEntryMetadata,
  SerializedValue,

  // Options
  GetOptions,
  SetOptions,
  DeleteOptions,
  BatchOptions,
  BatchGetResult,
  ShutdownOptions,
  DEFAULT_SHUTDOWN_OPTIONS,

  // Locking
  LockOptions,
  DEFAULT_LOCK_OPTIONS,
  LockResult,

  // Statistics and Health
  CacheStats,
  HealthCheckResult,

  // Tenant
  TenantContext,
} from './cache.types';

// Redis Client
export {
  RedisClient,
  RedisClientInterface,
  getRedisClient,
  resetRedisClient,
} from './redis-client';

// Cache Service
export {
  CacheService,
  TenantCache,
  getCacheService,
  resetCacheService,
} from './cache.service';

// Serialization Utilities
export {
  serialize,
  deserialize,
  encode,
  decode,
  buildKey,
  extractKey,
  validateKey,
  calculateSize,
  detectValueType,
  generateLockToken,
} from './serialization';
