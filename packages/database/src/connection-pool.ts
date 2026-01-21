/**
 * @package @forge/database
 * @description Connection pool management with configurable pool size
 */

import {
  PoolConfig,
  PoolStats,
  PoolEvent,
  PoolEventListener,
  DEFAULT_POOL_CONFIG,
  ConnectionStatus,
  ShutdownOptions,
  DEFAULT_SHUTDOWN_OPTIONS,
} from './database.types';

/**
 * Connection wrapper for pool management
 */
interface PooledConnection {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  inUse: boolean;
  queryCount: number;
}

/**
 * Connection pool manager for database connections
 * Implements connection pooling with configurable settings
 */
export class ConnectionPool {
  private config: PoolConfig;
  private connections: Map<string, PooledConnection> = new Map();
  private pendingRequests: Array<{
    resolve: (connection: PooledConnection) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }> = [];
  private listeners: Map<PoolEvent, Set<PoolEventListener>> = new Map();
  private status: ConnectionStatus = 'disconnected';
  private totalQueries = 0;
  private failedQueries = 0;
  private totalQueryTimeMs = 0;
  private isShuttingDown = false;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot initialize pool during shutdown');
    }

    this.status = 'connecting';

    try {
      // Create minimum connections
      const initPromises: Promise<void>[] = [];
      for (let i = 0; i < this.config.minConnections; i++) {
        initPromises.push(this.createConnection());
      }
      await Promise.all(initPromises);

      this.status = 'connected';
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Create a new connection in the pool
   */
  private async createConnection(): Promise<void> {
    const id = this.generateConnectionId();
    const connection: PooledConnection = {
      id,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      inUse: false,
      queryCount: 0,
    };

    this.connections.set(id, connection);
    this.emit('connection:created', { connectionId: id });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(timeoutMs?: number): Promise<PooledConnection> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    const timeout = timeoutMs ?? this.config.connectionTimeoutMs;

    // Try to find an available connection
    const availableConnection = this.findAvailableConnection();
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsedAt = new Date();
      this.emit('connection:acquired', { connectionId: availableConnection.id });
      return availableConnection;
    }

    // Try to create a new connection if under max
    if (this.connections.size < this.config.maxConnections) {
      await this.createConnection();
      const newConnection = this.findAvailableConnection();
      if (newConnection) {
        newConnection.inUse = true;
        newConnection.lastUsedAt = new Date();
        this.emit('connection:acquired', { connectionId: newConnection.id });
        return newConnection;
      }
    }

    // Wait for a connection to become available
    this.emit('pool:full');
    return this.waitForConnection(timeout);
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(timeoutMs: number): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.pendingRequests.findIndex((r) => r.timeoutId === timeoutId);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error('Connection acquisition timeout'));
      }, timeoutMs);

      this.pendingRequests.push({ resolve, reject, timeoutId });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: PooledConnection): void {
    const pooledConnection = this.connections.get(connection.id);
    if (!pooledConnection) {
      return;
    }

    pooledConnection.inUse = false;
    pooledConnection.lastUsedAt = new Date();
    this.emit('connection:released', { connectionId: connection.id });

    // Check if connection should be destroyed (exceeded max lifetime)
    const lifetime = Date.now() - pooledConnection.createdAt.getTime();
    if (lifetime > this.config.maxLifetimeMs) {
      this.destroyConnection(connection.id);
      return;
    }

    // Fulfill pending request if any
    this.fulfillPendingRequest();
  }

  /**
   * Fulfill a pending connection request
   */
  private fulfillPendingRequest(): void {
    if (this.pendingRequests.length === 0) {
      return;
    }

    const availableConnection = this.findAvailableConnection();
    if (!availableConnection) {
      return;
    }

    const pending = this.pendingRequests.shift();
    if (pending) {
      clearTimeout(pending.timeoutId);
      availableConnection.inUse = true;
      availableConnection.lastUsedAt = new Date();
      this.emit('connection:acquired', { connectionId: availableConnection.id });
      pending.resolve(availableConnection);
    }
  }

  /**
   * Find an available connection in the pool
   */
  private findAvailableConnection(): PooledConnection | undefined {
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        // Check if connection has been idle too long
        const idleTime = Date.now() - connection.lastUsedAt.getTime();
        if (idleTime > this.config.idleTimeoutMs) {
          this.destroyConnection(connection.id);
          continue;
        }
        return connection;
      }
    }
    return undefined;
  }

  /**
   * Destroy a connection
   */
  private destroyConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    this.emit('connection:destroyed', { connectionId });

    // Ensure minimum connections are maintained
    if (!this.isShuttingDown && this.connections.size < this.config.minConnections) {
      this.createConnection().catch(() => {
        // Silently fail - will retry on next acquire
      });
    }

    // Check if pool is empty
    if (this.connections.size === 0) {
      this.emit('pool:empty');
    }
  }

  /**
   * Record a query execution
   */
  recordQuery(success: boolean, durationMs: number): void {
    this.totalQueries++;
    this.totalQueryTimeMs += durationMs;
    if (!success) {
      this.failedQueries++;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let activeConnections = 0;
    let idleConnections = 0;

    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        activeConnections++;
      } else {
        idleConnections++;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections,
      pendingRequests: this.pendingRequests.length,
      totalQueries: this.totalQueries,
      failedQueries: this.failedQueries,
      avgQueryTimeMs: this.totalQueries > 0 ? this.totalQueryTimeMs / this.totalQueries : 0,
    };
  }

  /**
   * Get current pool status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get pool configuration
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  on(event: PoolEvent, listener: PoolEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: PoolEvent, listener: PoolEventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * Emit an event
   */
  private emit(event: PoolEvent, data?: Record<string, unknown>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(event, data);
        } catch {
          // Silently ignore listener errors
        }
      }
    }
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(options: Partial<ShutdownOptions> = {}): Promise<void> {
    const shutdownConfig = { ...DEFAULT_SHUTDOWN_OPTIONS, ...options };
    this.isShuttingDown = true;
    this.status = 'disconnected';

    // Reject all pending requests
    for (const pending of this.pendingRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Pool is shutting down'));
    }
    this.pendingRequests = [];

    // Wait for active connections to be released or timeout
    const startTime = Date.now();
    while (this.hasActiveConnections() && Date.now() - startTime < shutdownConfig.timeoutMs) {
      await this.sleep(100);
    }

    // Force close remaining connections if configured
    if (shutdownConfig.forceAfterTimeout) {
      for (const connectionId of this.connections.keys()) {
        this.destroyConnection(connectionId);
      }
    }

    this.connections.clear();
    this.listeners.clear();
  }

  /**
   * Check if there are active connections
   */
  private hasActiveConnections(): boolean {
    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
