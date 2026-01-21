/**
 * @package @forge/cache
 * @description TypeScript interfaces for Redis cache management
 */

/**
 * Redis connection configuration
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
  /** Command timeout in milliseconds */
  commandTimeoutMs: number;
  /** Enable TLS/SSL connection */
  tls: boolean;
  /** Key prefix for namespacing */
  keyPrefix: string;
  /** Retry attempts for failed connections */
  retryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelayMs: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs: number;
  /** Enable ready check on connection */
  enableReadyCheck: boolean;
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts: number;
  /** Reconnect on error */
  reconnectOnError: boolean;
}

/**
 * Default Redis configuration values
 */
export const DEFAULT_REDIS_CONFIG: RedisConfig = {
  host: 'localhost',
  port: 6379,
  db: 0,
  connectTimeoutMs: 10000,
  commandTimeoutMs: 5000,
  tls: false,
  keyPrefix: 'forge:',
  retryAttempts: 3,
  retryDelayMs: 100,
  maxRetryDelayMs: 3000,
  enableReadyCheck: true,
  maxReconnectAttempts: 10,
  reconnectOnError: true,
};

/**
 * Cache service configuration
 */
export interface CacheConfig {
  /** Redis connection configuration */
  redis: RedisConfig;
  /** Default TTL in seconds (1 hour) */
  defaultTtlSeconds: number;
  /** Enable cache logging */
  enableLogging: boolean;
  /** Environment (development, production, test) */
  environment: 'development' | 'production' | 'test';
  /** Enable compression for values over threshold */
  enableCompression: boolean;
  /** Compression threshold in bytes */
  compressionThresholdBytes: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  redis: DEFAULT_REDIS_CONFIG,
  defaultTtlSeconds: 3600,
  enableLogging: false,
  environment: 'production',
  enableCompression: false,
  compressionThresholdBytes: 1024,
};

/**
 * Connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'reconnecting';

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  /** Key of the cache entry */
  key: string;
  /** TTL remaining in seconds (-1 if no expiry) */
  ttlSeconds: number;
  /** Size in bytes (approximate) */
  sizeBytes: number;
  /** When the entry was created */
  createdAt?: Date;
}

/**
 * Cache entry with value and metadata
 */
export interface CacheEntry<T = unknown> {
  /** The cached value */
  value: T;
  /** Entry metadata */
  metadata: CacheEntryMetadata;
}

/**
 * Options for get operations
 */
export interface GetOptions {
  /** Namespace for tenant isolation */
  namespace?: string;
  /** Whether to refresh TTL on access */
  refreshTtl?: boolean;
}

/**
 * Options for set operations
 */
export interface SetOptions {
  /** Namespace for tenant isolation */
  namespace?: string;
  /** TTL in seconds (overrides default) */
  ttlSeconds?: number;
  /** Only set if key doesn't exist (NX) */
  ifNotExists?: boolean;
  /** Only set if key exists (XX) */
  ifExists?: boolean;
}

/**
 * Options for delete operations
 */
export interface DeleteOptions {
  /** Namespace for tenant isolation */
  namespace?: string;
}

/**
 * Options for batch operations
 */
export interface BatchOptions {
  /** Namespace for tenant isolation */
  namespace?: string;
  /** TTL in seconds for set operations */
  ttlSeconds?: number;
}

/**
 * Result of a batch get operation
 */
export interface BatchGetResult<T = unknown> {
  /** Successfully retrieved entries */
  found: Map<string, T>;
  /** Keys that were not found */
  missing: string[];
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Total number of get operations */
  totalGets: number;
  /** Total number of set operations */
  totalSets: number;
  /** Total number of delete operations */
  totalDeletes: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Average operation latency in milliseconds */
  avgLatencyMs: number;
  /** Total operations performed */
  totalOperations: number;
  /** Number of failed operations */
  failedOperations: number;
  /** Connection status */
  status: ConnectionStatus;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the cache is healthy */
  healthy: boolean;
  /** Current connection status */
  status: ConnectionStatus;
  /** Response time for health check in milliseconds */
  responseTimeMs: number;
  /** Cache statistics */
  stats: CacheStats;
  /** Timestamp of the health check */
  timestamp: Date;
  /** Error message if unhealthy */
  error?: string;
  /** Redis server info */
  serverInfo?: {
    version: string;
    connectedClients: number;
    usedMemory: string;
    uptime: number;
  };
}

/**
 * Shutdown options
 */
export interface ShutdownOptions {
  /** Timeout for graceful shutdown in milliseconds */
  timeoutMs: number;
  /** Force close connection after timeout */
  forceAfterTimeout: boolean;
}

/**
 * Default shutdown options
 */
export const DEFAULT_SHUTDOWN_OPTIONS: ShutdownOptions = {
  timeoutMs: 5000,
  forceAfterTimeout: true,
};

/**
 * Cache events
 */
export type CacheEvent =
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'reconnecting'
  | 'ready'
  | 'close';

/**
 * Event listener callback type
 */
export type CacheEventListener = (event: CacheEvent, data?: Record<string, unknown>) => void;

/**
 * Tenant context for multi-tenant cache operations
 */
export interface TenantContext {
  /** Tenant identifier */
  tenantId: string;
  /** Optional user identifier */
  userId?: string;
  /** Request correlation ID for tracing */
  correlationId?: string;
}

/**
 * Serialized cache value wrapper
 */
export interface SerializedValue {
  /** The serialized data */
  data: string;
  /** Original type indicator */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined' | 'date' | 'buffer';
  /** Whether the value is compressed */
  compressed: boolean;
  /** Version for future compatibility */
  version: number;
}

/**
 * Lock options for distributed locking
 */
export interface LockOptions {
  /** Lock TTL in milliseconds */
  ttlMs: number;
  /** Maximum wait time for acquiring lock */
  waitTimeMs: number;
  /** Retry interval in milliseconds */
  retryIntervalMs: number;
}

/**
 * Default lock options
 */
export const DEFAULT_LOCK_OPTIONS: LockOptions = {
  ttlMs: 10000,
  waitTimeMs: 5000,
  retryIntervalMs: 100,
};

/**
 * Lock result
 */
export interface LockResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  /** Lock token for release */
  token?: string;
  /** Error message if failed */
  error?: string;
}
