/**
 * @package @forge/database
 * @description Main database service class with tenant-aware connection handling
 */

import { ErrorCode, ForgeError } from '@forge/errors';
import { getPrismaClient, disconnectPrisma, createTenantClient, TenantClient } from '@forge/prisma';
import { ConnectionPool } from './connection-pool';
import {
  DatabaseConfig,
  DEFAULT_DATABASE_CONFIG,
  TenantContext,
  QueryOptions,
  TransactionOptions,
  HealthCheckResult,
  ConnectionStatus,
  ShutdownOptions,
  PoolStats,
} from './database.types';
import { performHealthCheck } from './health';

/**
 * Database service providing tenant-aware connection management
 */
export class DatabaseService {
  private config: DatabaseConfig;
  private pool: ConnectionPool;
  private initialized = false;
  private prismaClient: ReturnType<typeof getPrismaClient> | null = null;
  private tenantClients: Map<string, TenantClient> = new Map();

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = {
      ...DEFAULT_DATABASE_CONFIG,
      ...config,
      pool: { ...DEFAULT_DATABASE_CONFIG.pool, ...config.pool },
    };
    this.pool = new ConnectionPool(this.config.pool);
  }

  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize connection pool
      await this.pool.initialize();

      // Initialize Prisma client
      this.prismaClient = getPrismaClient();

      this.initialized = true;

      if (this.config.enableLogging) {
        console.log('[DatabaseService] Initialized successfully');
      }
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to initialize database service',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get a tenant-scoped database client
   * Ensures all queries are automatically filtered by tenant
   */
  getTenantClient(context: TenantContext): TenantClient {
    this.ensureInitialized();

    // Cache tenant clients for reuse
    if (!this.tenantClients.has(context.tenantId)) {
      const client = createTenantClient(context.tenantId);
      this.tenantClients.set(context.tenantId, client);
    }

    return this.tenantClients.get(context.tenantId)!;
  }

  /**
   * Get the raw Prisma client (use with caution - no tenant isolation)
   */
  getRawClient(): ReturnType<typeof getPrismaClient> {
    this.ensureInitialized();
    return this.prismaClient!;
  }

  /**
   * Execute a query with options
   */
  async executeQuery<T>(
    queryFn: (client: ReturnType<typeof getPrismaClient>) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    this.ensureInitialized();

    const startTime = Date.now();
    const connection = await this.pool.acquire(options.timeoutMs);

    try {
      const result = await queryFn(this.prismaClient!);
      const duration = Date.now() - startTime;
      this.pool.recordQuery(true, duration);

      if (this.config.enableLogging) {
        console.log(`[DatabaseService] Query executed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.pool.recordQuery(false, duration);

      throw new ForgeError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database query failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          correlationId: options.tenant?.correlationId,
          tenantId: options.tenant?.tenantId,
        },
      });
    } finally {
      this.pool.release(connection);
    }
  }

  /**
   * Execute a tenant-scoped query
   */
  async executeTenantQuery<T>(
    context: TenantContext,
    queryFn: (client: TenantClient) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    this.ensureInitialized();

    const startTime = Date.now();
    const connection = await this.pool.acquire(options.timeoutMs);
    const tenantClient = this.getTenantClient(context);

    try {
      const result = await queryFn(tenantClient);
      const duration = Date.now() - startTime;
      this.pool.recordQuery(true, duration);

      if (this.config.enableLogging) {
        console.log(`[DatabaseService] Tenant query executed in ${duration}ms for tenant ${context.tenantId}`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.pool.recordQuery(false, duration);

      throw new ForgeError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Tenant database query failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          correlationId: context.correlationId,
          tenantId: context.tenantId,
        },
      });
    } finally {
      this.pool.release(connection);
    }
  }

  /**
   * Execute operations within a transaction
   */
  async executeTransaction<T>(
    transactionFn: (client: ReturnType<typeof getPrismaClient>) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    this.ensureInitialized();

    const startTime = Date.now();
    const connection = await this.pool.acquire(options.timeoutMs);

    try {
      const result = await this.prismaClient!.$transaction(
        async (tx) => {
          return transactionFn(tx as ReturnType<typeof getPrismaClient>);
        },
        {
          isolationLevel: options.isolationLevel,
          timeout: options.timeoutMs,
        }
      );

      const duration = Date.now() - startTime;
      this.pool.recordQuery(true, duration);

      if (this.config.enableLogging) {
        console.log(`[DatabaseService] Transaction completed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.pool.recordQuery(false, duration);

      throw new ForgeError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database transaction failed',
        statusCode: 500,
        details: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          correlationId: options.tenant?.correlationId,
          tenantId: options.tenant?.tenantId,
        },
      });
    } finally {
      this.pool.release(connection);
    }
  }

  /**
   * Perform a health check on the database
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return performHealthCheck(this.prismaClient, this.pool);
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): PoolStats {
    return this.pool.getStats();
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    if (!this.initialized) {
      return 'disconnected';
    }
    return this.pool.getStatus();
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gracefully shutdown the database service
   */
  async shutdown(options: Partial<ShutdownOptions> = {}): Promise<void> {
    if (!this.initialized) {
      return;
    }

    if (this.config.enableLogging) {
      console.log('[DatabaseService] Shutting down...');
    }

    try {
      // Shutdown connection pool
      await this.pool.shutdown(options);

      // Disconnect Prisma
      await disconnectPrisma();

      // Clear tenant clients cache
      this.tenantClients.clear();

      this.initialized = false;
      this.prismaClient = null;

      if (this.config.enableLogging) {
        console.log('[DatabaseService] Shutdown complete');
      }
    } catch (error) {
      throw new ForgeError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to shutdown database service',
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
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database service not initialized. Call initialize() first.',
        statusCode: 500,
      });
    }
  }
}

/**
 * Singleton instance of the database service
 */
let databaseServiceInstance: DatabaseService | null = null;

/**
 * Get the singleton database service instance
 */
export function getDatabaseService(config?: Partial<DatabaseConfig>): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService(config);
  }
  return databaseServiceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetDatabaseService(): void {
  if (databaseServiceInstance) {
    databaseServiceInstance = null;
  }
}
