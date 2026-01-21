/**
 * @package @forge/database
 * @description Health check utilities for database connections
 */

import { ConnectionPool } from './connection-pool';
import { HealthCheckResult, ConnectionStatus } from './database.types';

/**
 * Perform a health check on the database
 */
export async function performHealthCheck(
  prismaClient: { $queryRaw: (query: unknown) => Promise<unknown> } | null,
  pool: ConnectionPool
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const poolStats = pool.getStats();
  const status = pool.getStatus();

  // If pool is not connected, return unhealthy
  if (status !== 'connected') {
    return {
      healthy: false,
      status,
      responseTimeMs: Date.now() - startTime,
      poolStats,
      timestamp: new Date(),
      error: `Pool is in ${status} state`,
    };
  }

  // If no Prisma client, return unhealthy
  if (!prismaClient) {
    return {
      healthy: false,
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      poolStats,
      timestamp: new Date(),
      error: 'Prisma client not available',
    };
  }

  try {
    // Execute a simple query to verify database connectivity
    await prismaClient.$queryRaw`SELECT 1 as health_check`;

    return {
      healthy: true,
      status: 'connected',
      responseTimeMs: Date.now() - startTime,
      poolStats,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      poolStats,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Database health check failed',
    };
  }
}

/**
 * Check if the database is healthy based on pool stats
 */
export function isPoolHealthy(poolStats: ReturnType<ConnectionPool['getStats']>): boolean {
  // Pool is unhealthy if:
  // - No connections available
  // - All connections are active and there are pending requests
  // - Error rate is too high (> 10%)

  if (poolStats.totalConnections === 0) {
    return false;
  }

  if (poolStats.activeConnections === poolStats.totalConnections && poolStats.pendingRequests > 0) {
    return false;
  }

  if (poolStats.totalQueries > 100) {
    const errorRate = poolStats.failedQueries / poolStats.totalQueries;
    if (errorRate > 0.1) {
      return false;
    }
  }

  return true;
}

/**
 * Get health status string based on connection status
 */
export function getHealthStatusString(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'healthy';
    case 'connecting':
      return 'starting';
    case 'disconnected':
      return 'stopped';
    case 'error':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

/**
 * Create a health check response for HTTP endpoints
 */
export function createHealthResponse(result: HealthCheckResult): {
  status: number;
  body: Record<string, unknown>;
} {
  const statusCode = result.healthy ? 200 : 503;

  return {
    status: statusCode,
    body: {
      status: getHealthStatusString(result.status),
      healthy: result.healthy,
      database: {
        connected: result.status === 'connected',
        responseTimeMs: result.responseTimeMs,
        error: result.error,
      },
      pool: {
        total: result.poolStats.totalConnections,
        active: result.poolStats.activeConnections,
        idle: result.poolStats.idleConnections,
        pending: result.poolStats.pendingRequests,
      },
      metrics: {
        totalQueries: result.poolStats.totalQueries,
        failedQueries: result.poolStats.failedQueries,
        avgQueryTimeMs: Math.round(result.poolStats.avgQueryTimeMs * 100) / 100,
      },
      timestamp: result.timestamp.toISOString(),
    },
  };
}
