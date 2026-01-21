/**
 * @package @forge/database
 * @description TypeScript interfaces for database connection management
 */

/**
 * Database connection pool configuration
 */
export interface PoolConfig {
  /** Minimum number of connections in the pool */
  minConnections: number;
  /** Maximum number of connections in the pool */
  maxConnections: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
  /** Idle timeout in milliseconds before connection is released */
  idleTimeoutMs: number;
  /** Maximum time a connection can be alive in milliseconds */
  maxLifetimeMs: number;
  /** Retry attempts for failed connections */
  retryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelayMs: number;
}

/**
 * Default pool configuration values
 */
export const DEFAULT_POOL_CONFIG: PoolConfig = {
  minConnections: 2,
  maxConnections: 10,
  connectionTimeoutMs: 5000,
  idleTimeoutMs: 30000,
  maxLifetimeMs: 3600000,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Database service configuration
 */
export interface DatabaseConfig {
  /** Database connection URL */
  connectionUrl?: string;
  /** Pool configuration */
  pool: PoolConfig;
  /** Enable query logging */
  enableLogging: boolean;
  /** Environment (development, production, test) */
  environment: 'development' | 'production' | 'test';
}

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  pool: DEFAULT_POOL_CONFIG,
  enableLogging: false,
  environment: 'production',
};

/**
 * Connection status
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

/**
 * Pool statistics
 */
export interface PoolStats {
  /** Total number of connections in the pool */
  totalConnections: number;
  /** Number of active (in-use) connections */
  activeConnections: number;
  /** Number of idle connections */
  idleConnections: number;
  /** Number of pending connection requests */
  pendingRequests: number;
  /** Total queries executed */
  totalQueries: number;
  /** Number of failed queries */
  failedQueries: number;
  /** Average query time in milliseconds */
  avgQueryTimeMs: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the database is healthy */
  healthy: boolean;
  /** Current connection status */
  status: ConnectionStatus;
  /** Response time for health check in milliseconds */
  responseTimeMs: number;
  /** Pool statistics */
  poolStats: PoolStats;
  /** Timestamp of the health check */
  timestamp: Date;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Tenant context for multi-tenant database operations
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
 * Query options
 */
export interface QueryOptions {
  /** Query timeout in milliseconds */
  timeoutMs?: number;
  /** Tenant context for the query */
  tenant?: TenantContext;
  /** Whether to use a read replica */
  useReadReplica?: boolean;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Transaction isolation level */
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  /** Transaction timeout in milliseconds */
  timeoutMs?: number;
  /** Tenant context for the transaction */
  tenant?: TenantContext;
}

/**
 * Connection pool events
 */
export type PoolEvent =
  | 'connection:acquired'
  | 'connection:released'
  | 'connection:created'
  | 'connection:destroyed'
  | 'connection:error'
  | 'pool:full'
  | 'pool:empty';

/**
 * Event listener callback type
 */
export type PoolEventListener = (event: PoolEvent, data?: Record<string, unknown>) => void;

/**
 * Shutdown options
 */
export interface ShutdownOptions {
  /** Timeout for graceful shutdown in milliseconds */
  timeoutMs: number;
  /** Force close all connections after timeout */
  forceAfterTimeout: boolean;
}

/**
 * Default shutdown options
 */
export const DEFAULT_SHUTDOWN_OPTIONS: ShutdownOptions = {
  timeoutMs: 10000,
  forceAfterTimeout: true,
};
