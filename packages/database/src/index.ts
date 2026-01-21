/**
 * @package @forge/database
 * @description Database connection management for Forge Factory
 */

// Types
export {
  PoolConfig,
  DEFAULT_POOL_CONFIG,
  DatabaseConfig,
  DEFAULT_DATABASE_CONFIG,
  ConnectionStatus,
  PoolStats,
  HealthCheckResult,
  TenantContext,
  QueryOptions,
  TransactionOptions,
  PoolEvent,
  PoolEventListener,
  ShutdownOptions,
  DEFAULT_SHUTDOWN_OPTIONS,
} from './database.types';

// Connection Pool
export { ConnectionPool } from './connection-pool';

// Database Service
export {
  DatabaseService,
  getDatabaseService,
  resetDatabaseService,
} from './database.service';

// Health Utilities
export {
  performHealthCheck,
  isPoolHealthy,
  getHealthStatusString,
  createHealthResponse,
} from './health';
