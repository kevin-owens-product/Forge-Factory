/**
 * @package @forge/database
 * @description Tests for database service and connection pool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionPool } from '../src/connection-pool';
import {
  DatabaseService,
  getDatabaseService,
  resetDatabaseService,
} from '../src/database.service';
import {
  performHealthCheck,
  isPoolHealthy,
  getHealthStatusString,
  createHealthResponse,
} from '../src/health';
import {
  DEFAULT_POOL_CONFIG,
  DEFAULT_DATABASE_CONFIG,
  DEFAULT_SHUTDOWN_OPTIONS,
  PoolStats,
  HealthCheckResult,
} from '../src/database.types';

// Mock @forge/prisma
vi.mock('@forge/prisma', () => ({
  getPrismaClient: vi.fn(() => ({
    $queryRaw: vi.fn().mockResolvedValue([{ health_check: 1 }]),
    $transaction: vi.fn((fn) => fn({})),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
  createTenantClient: vi.fn((tenantId: string) => ({
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: '1', tenantId }),
      update: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({ count: 1 }),
    },
  })),
}));

// Mock @forge/errors
vi.mock('@forge/errors', () => ({
  ErrorCode: {
    DATABASE_ERROR: 'INT_9002',
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

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool();
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('initialization', () => {
    it('should create pool with default config', () => {
      const config = pool.getConfig();
      expect(config).toEqual(DEFAULT_POOL_CONFIG);
    });

    it('should create pool with custom config', () => {
      const customPool = new ConnectionPool({
        minConnections: 5,
        maxConnections: 20,
      });
      const config = customPool.getConfig();
      expect(config.minConnections).toBe(5);
      expect(config.maxConnections).toBe(20);
    });

    it('should initialize with minimum connections', async () => {
      await pool.initialize();
      const stats = pool.getStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(DEFAULT_POOL_CONFIG.minConnections);
      expect(pool.getStatus()).toBe('connected');
    });

    it('should throw when initializing during shutdown', async () => {
      await pool.initialize();
      const shutdownPromise = pool.shutdown();
      await expect(pool.initialize()).rejects.toThrow('Cannot initialize pool during shutdown');
      await shutdownPromise;
    });
  });

  describe('connection acquisition', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should acquire and release connections', async () => {
      const connection = await pool.acquire();
      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.inUse).toBe(true);

      pool.release(connection);
      expect(pool.getStats().idleConnections).toBeGreaterThan(0);
    });

    it('should create new connection when needed', async () => {
      const initialStats = pool.getStats();
      const connections = [];

      // Acquire all existing connections
      for (let i = 0; i < initialStats.totalConnections; i++) {
        connections.push(await pool.acquire());
      }

      // Acquire one more (should create new connection)
      const newConnection = await pool.acquire();
      expect(pool.getStats().totalConnections).toBe(initialStats.totalConnections + 1);

      // Release all
      for (const conn of connections) {
        pool.release(conn);
      }
      pool.release(newConnection);
    });

    it('should timeout when pool is full', async () => {
      // Create pool with max 2 connections
      const smallPool = new ConnectionPool({
        minConnections: 2,
        maxConnections: 2,
        connectionTimeoutMs: 100,
      });
      await smallPool.initialize();

      // Acquire all connections
      const conn1 = await smallPool.acquire();
      const conn2 = await smallPool.acquire();

      // Try to acquire when full
      await expect(smallPool.acquire(100)).rejects.toThrow('Connection acquisition timeout');

      smallPool.release(conn1);
      smallPool.release(conn2);
      await smallPool.shutdown();
    });

    it('should throw when acquiring during shutdown', async () => {
      const shutdownPromise = pool.shutdown();
      await expect(pool.acquire()).rejects.toThrow('Pool is shutting down');
      await shutdownPromise;
    });

    it('should fulfill pending requests when connection released', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 1,
        connectionTimeoutMs: 5000,
      });
      await smallPool.initialize();

      const conn1 = await smallPool.acquire();

      // Start acquiring (will wait)
      const acquirePromise = smallPool.acquire();

      // Release after a short delay
      setTimeout(() => {
        smallPool.release(conn1);
      }, 50);

      const conn2 = await acquirePromise;
      expect(conn2).toBeDefined();

      smallPool.release(conn2);
      await smallPool.shutdown();
    });
  });

  describe('connection lifecycle', () => {
    it('should destroy connections that exceed max lifetime', async () => {
      const shortLifetimePool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 2,
        maxLifetimeMs: 100,
      });
      await shortLifetimePool.initialize();

      const conn = await shortLifetimePool.acquire();
      const connId = conn.id;

      // Wait for lifetime to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      shortLifetimePool.release(conn);

      // Get a new connection (should be different)
      const newConn = await shortLifetimePool.acquire();
      expect(newConn.id).not.toBe(connId);

      shortLifetimePool.release(newConn);
      await shortLifetimePool.shutdown();
    });

    it('should destroy idle connections', async () => {
      const shortIdlePool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 3,
        idleTimeoutMs: 50,
      });
      await shortIdlePool.initialize();

      // Acquire and release to create idle connection
      const conn1 = await shortIdlePool.acquire();
      shortIdlePool.release(conn1);

      // Wait for idle timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Acquire again (should get fresh connection)
      const conn2 = await shortIdlePool.acquire();
      shortIdlePool.release(conn2);

      await shortIdlePool.shutdown();
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should track query statistics', () => {
      pool.recordQuery(true, 100);
      pool.recordQuery(true, 200);
      pool.recordQuery(false, 50);

      const stats = pool.getStats();
      expect(stats.totalQueries).toBe(3);
      expect(stats.failedQueries).toBe(1);
      expect(stats.avgQueryTimeMs).toBeCloseTo(116.67, 1);
    });

    it('should return correct pool stats', async () => {
      const conn = await pool.acquire();
      const stats = pool.getStats();

      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(stats.totalConnections - 1);
      expect(stats.pendingRequests).toBe(0);

      pool.release(conn);
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should emit connection events', async () => {
      const acquiredEvents: unknown[] = [];
      const releasedEvents: unknown[] = [];

      pool.on('connection:acquired', (event, data) => {
        acquiredEvents.push({ event, data });
      });
      pool.on('connection:released', (event, data) => {
        releasedEvents.push({ event, data });
      });

      const conn = await pool.acquire();
      pool.release(conn);

      expect(acquiredEvents.length).toBe(1);
      expect(releasedEvents.length).toBe(1);
    });

    it('should remove event listeners', async () => {
      const events: unknown[] = [];
      const listener = (event: unknown, data: unknown) => {
        events.push({ event, data });
      };

      pool.on('connection:acquired', listener);
      pool.off('connection:acquired', listener);

      const conn = await pool.acquire();
      pool.release(conn);

      expect(events.length).toBe(0);
    });

    it('should emit pool:full event', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 1,
        connectionTimeoutMs: 100,
      });
      await smallPool.initialize();

      let fullEventEmitted = false;
      smallPool.on('pool:full', () => {
        fullEventEmitted = true;
      });

      const conn = await smallPool.acquire();

      // This will timeout but should emit pool:full
      try {
        await smallPool.acquire(50);
      } catch {
        // Expected timeout
      }

      expect(fullEventEmitted).toBe(true);

      smallPool.release(conn);
      await smallPool.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown', async () => {
      await pool.initialize();
      const conn = await pool.acquire();
      pool.release(conn);

      await pool.shutdown();
      expect(pool.getStatus()).toBe('disconnected');
    });

    it('should reject pending requests on shutdown', async () => {
      const smallPool = new ConnectionPool({
        minConnections: 1,
        maxConnections: 1,
        connectionTimeoutMs: 5000,
      });
      await smallPool.initialize();

      const conn = await smallPool.acquire();

      // Start a pending acquire
      const acquirePromise = smallPool.acquire();

      // Shutdown
      await smallPool.shutdown();

      await expect(acquirePromise).rejects.toThrow('Pool is shutting down');
    });

    it('should force close connections after timeout', async () => {
      await pool.initialize();
      const conn = await pool.acquire();
      // Don't release

      await pool.shutdown({
        timeoutMs: 100,
        forceAfterTimeout: true,
      });

      expect(pool.getStats().totalConnections).toBe(0);
    });
  });
});

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    resetDatabaseService();
    service = new DatabaseService();
  });

  afterEach(async () => {
    if (service.isInitialized()) {
      await service.shutdown();
    }
    resetDatabaseService();
  });

  describe('initialization', () => {
    it('should create service with default config', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
      expect(service.getStatus()).toBe('connected');
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      await service.initialize(); // Should not throw
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('tenant client', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get tenant client', () => {
      const client = service.getTenantClient({ tenantId: 'tenant-123' });
      expect(client).toBeDefined();
      expect(client.user).toBeDefined();
    });

    it('should cache tenant clients', () => {
      const client1 = service.getTenantClient({ tenantId: 'tenant-123' });
      const client2 = service.getTenantClient({ tenantId: 'tenant-123' });
      expect(client1).toBe(client2);
    });

    it('should create different clients for different tenants', () => {
      const client1 = service.getTenantClient({ tenantId: 'tenant-123' });
      const client2 = service.getTenantClient({ tenantId: 'tenant-456' });
      expect(client1).not.toBe(client2);
    });

    it('should throw when not initialized', () => {
      const uninitializedService = new DatabaseService();
      expect(() =>
        uninitializedService.getTenantClient({ tenantId: 'test' })
      ).toThrow('Database service not initialized');
    });
  });

  describe('raw client', () => {
    it('should get raw client when initialized', async () => {
      await service.initialize();
      const client = service.getRawClient();
      expect(client).toBeDefined();
    });

    it('should throw when not initialized', () => {
      expect(() => service.getRawClient()).toThrow('Database service not initialized');
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should execute query', async () => {
      const result = await service.executeQuery(async (client) => {
        return { success: true };
      });
      expect(result).toEqual({ success: true });
    });

    it('should execute tenant query', async () => {
      const result = await service.executeTenantQuery(
        { tenantId: 'tenant-123' },
        async (client) => {
          return client.user.findMany();
        }
      );
      expect(result).toEqual([]);
    });

    it('should track query statistics', async () => {
      await service.executeQuery(async () => ({ data: 'test' }));
      await service.executeQuery(async () => ({ data: 'test2' }));

      const stats = service.getPoolStats();
      expect(stats.totalQueries).toBeGreaterThanOrEqual(2);
    });
  });

  describe('transaction execution', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should execute transaction', async () => {
      const result = await service.executeTransaction(async (client) => {
        return { transactionResult: true };
      });
      expect(result).toEqual({ transactionResult: true });
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should perform health check', async () => {
      const health = await service.healthCheck();
      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.poolStats).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.shutdown();
      expect(service.isInitialized()).toBe(false);
      expect(service.getStatus()).toBe('disconnected');
    });

    it('should handle shutdown when not initialized', async () => {
      await service.shutdown(); // Should not throw
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getDatabaseService();
      const instance2 = getDatabaseService();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getDatabaseService();
      resetDatabaseService();
      const instance2 = getDatabaseService();
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('Health Utilities', () => {
  describe('performHealthCheck', () => {
    it('should return healthy when connected', async () => {
      const pool = new ConnectionPool();
      await pool.initialize();

      const mockPrisma = {
        $queryRaw: vi.fn().mockResolvedValue([{ health_check: 1 }]),
      };

      const result = await performHealthCheck(mockPrisma, pool);
      expect(result.healthy).toBe(true);
      expect(result.status).toBe('connected');

      await pool.shutdown();
    });

    it('should return unhealthy when pool not connected', async () => {
      const pool = new ConnectionPool();
      const mockPrisma = {
        $queryRaw: vi.fn(),
      };

      const result = await performHealthCheck(mockPrisma, pool);
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('disconnected');
    });

    it('should return unhealthy when no Prisma client', async () => {
      const pool = new ConnectionPool();
      await pool.initialize();

      const result = await performHealthCheck(null, pool);
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Prisma client not available');

      await pool.shutdown();
    });

    it('should return unhealthy when query fails', async () => {
      const pool = new ConnectionPool();
      await pool.initialize();

      const mockPrisma = {
        $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const result = await performHealthCheck(mockPrisma, pool);
      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection refused');

      await pool.shutdown();
    });
  });

  describe('isPoolHealthy', () => {
    it('should return true for healthy pool', () => {
      const stats: PoolStats = {
        totalConnections: 5,
        activeConnections: 2,
        idleConnections: 3,
        pendingRequests: 0,
        totalQueries: 1000,
        failedQueries: 5,
        avgQueryTimeMs: 50,
      };
      expect(isPoolHealthy(stats)).toBe(true);
    });

    it('should return false when no connections', () => {
      const stats: PoolStats = {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        pendingRequests: 0,
        totalQueries: 0,
        failedQueries: 0,
        avgQueryTimeMs: 0,
      };
      expect(isPoolHealthy(stats)).toBe(false);
    });

    it('should return false when pool full with pending requests', () => {
      const stats: PoolStats = {
        totalConnections: 5,
        activeConnections: 5,
        idleConnections: 0,
        pendingRequests: 3,
        totalQueries: 1000,
        failedQueries: 0,
        avgQueryTimeMs: 50,
      };
      expect(isPoolHealthy(stats)).toBe(false);
    });

    it('should return false when error rate too high', () => {
      const stats: PoolStats = {
        totalConnections: 5,
        activeConnections: 2,
        idleConnections: 3,
        pendingRequests: 0,
        totalQueries: 1000,
        failedQueries: 150, // 15% error rate
        avgQueryTimeMs: 50,
      };
      expect(isPoolHealthy(stats)).toBe(false);
    });
  });

  describe('getHealthStatusString', () => {
    it('should return correct status strings', () => {
      expect(getHealthStatusString('connected')).toBe('healthy');
      expect(getHealthStatusString('connecting')).toBe('starting');
      expect(getHealthStatusString('disconnected')).toBe('stopped');
      expect(getHealthStatusString('error')).toBe('unhealthy');
    });
  });

  describe('createHealthResponse', () => {
    it('should create 200 response for healthy', () => {
      const result: HealthCheckResult = {
        healthy: true,
        status: 'connected',
        responseTimeMs: 5,
        poolStats: {
          totalConnections: 5,
          activeConnections: 2,
          idleConnections: 3,
          pendingRequests: 0,
          totalQueries: 100,
          failedQueries: 1,
          avgQueryTimeMs: 25.5,
        },
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      const response = createHealthResponse(result);
      expect(response.status).toBe(200);
      expect(response.body.healthy).toBe(true);
      expect(response.body.status).toBe('healthy');
    });

    it('should create 503 response for unhealthy', () => {
      const result: HealthCheckResult = {
        healthy: false,
        status: 'error',
        responseTimeMs: 5000,
        poolStats: {
          totalConnections: 0,
          activeConnections: 0,
          idleConnections: 0,
          pendingRequests: 5,
          totalQueries: 10,
          failedQueries: 10,
          avgQueryTimeMs: 0,
        },
        timestamp: new Date('2024-01-01T00:00:00Z'),
        error: 'Connection failed',
      };

      const response = createHealthResponse(result);
      expect(response.status).toBe(503);
      expect(response.body.healthy).toBe(false);
      expect(response.body.status).toBe('unhealthy');
    });
  });
});

describe('Types and Defaults', () => {
  it('should have correct default pool config', () => {
    expect(DEFAULT_POOL_CONFIG.minConnections).toBe(2);
    expect(DEFAULT_POOL_CONFIG.maxConnections).toBe(10);
    expect(DEFAULT_POOL_CONFIG.connectionTimeoutMs).toBe(5000);
    expect(DEFAULT_POOL_CONFIG.idleTimeoutMs).toBe(30000);
    expect(DEFAULT_POOL_CONFIG.maxLifetimeMs).toBe(3600000);
    expect(DEFAULT_POOL_CONFIG.retryAttempts).toBe(3);
    expect(DEFAULT_POOL_CONFIG.retryDelayMs).toBe(1000);
  });

  it('should have correct default database config', () => {
    expect(DEFAULT_DATABASE_CONFIG.pool).toEqual(DEFAULT_POOL_CONFIG);
    expect(DEFAULT_DATABASE_CONFIG.enableLogging).toBe(false);
    expect(DEFAULT_DATABASE_CONFIG.environment).toBe('production');
  });

  it('should have correct default shutdown options', () => {
    expect(DEFAULT_SHUTDOWN_OPTIONS.timeoutMs).toBe(10000);
    expect(DEFAULT_SHUTDOWN_OPTIONS.forceAfterTimeout).toBe(true);
  });
});
