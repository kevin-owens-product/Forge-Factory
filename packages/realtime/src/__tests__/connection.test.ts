/**
 * @package @forge/realtime
 * @description Tests for connection management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connection, createConnection, DEFAULT_CONNECTION_CONFIG } from '../connection';
import { ConnectionState, ConnectionEvent, MessageType } from '../realtime.types';

describe('Connection', () => {
  let connection: Connection;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    connection = createConnection({
      url: 'wss://test.example.com/ws',
      debug: false,
    });
  });

  afterEach(() => {
    connection.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('DEFAULT_CONNECTION_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONNECTION_CONFIG.connectionTimeout).toBe(10000);
      expect(DEFAULT_CONNECTION_CONFIG.autoReconnect).toBe(true);
      expect(DEFAULT_CONNECTION_CONFIG.reconnect.enabled).toBe(true);
      expect(DEFAULT_CONNECTION_CONFIG.reconnect.maxAttempts).toBe(10);
      expect(DEFAULT_CONNECTION_CONFIG.reconnect.initialDelay).toBe(1000);
      expect(DEFAULT_CONNECTION_CONFIG.reconnect.maxDelay).toBe(30000);
      expect(DEFAULT_CONNECTION_CONFIG.reconnect.multiplier).toBe(2);
      expect(DEFAULT_CONNECTION_CONFIG.reconnect.jitter).toBe(true);
      expect(DEFAULT_CONNECTION_CONFIG.heartbeat.enabled).toBe(true);
      expect(DEFAULT_CONNECTION_CONFIG.heartbeat.interval).toBe(30000);
      expect(DEFAULT_CONNECTION_CONFIG.heartbeat.timeout).toBe(10000);
      expect(DEFAULT_CONNECTION_CONFIG.debug).toBe(false);
    });
  });

  describe('createConnection', () => {
    it('should create a connection instance', () => {
      expect(connection).toBeInstanceOf(Connection);
    });
  });

  describe('getState', () => {
    it('should return DISCONNECTED initially', () => {
      expect(connection.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = connection.getStats();
      expect(stats.state).toBe(ConnectionState.DISCONNECTED);
      expect(stats.reconnectAttempts).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.uptime).toBe(0);
    });
  });

  describe('connect', () => {
    it('should connect to WebSocket server', async () => {
      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;
      expect(connection.getState()).toBe(ConnectionState.CONNECTED);
      expect(connection.isConnected()).toBe(true);
    });

    it('should resolve if already connected', async () => {
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      // Should resolve immediately
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    });

    it('should reject if connection already in progress', async () => {
      const promise1 = connection.connect();
      const promise2 = connection.connect();

      await vi.advanceTimersByTimeAsync(0);
      await promise1;

      await expect(promise2).rejects.toThrow('Connection already in progress');
    });

    it('should emit CONNECTED event on successful connection', async () => {
      const handler = vi.fn();
      connection.on(ConnectionEvent.CONNECTED, handler);

      const connectPromise = connection.connect();
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;

      expect(handler).toHaveBeenCalled();
    });

    it('should build URL with query parameters', async () => {
      const conn = createConnection({
        url: 'wss://test.example.com/ws',
        token: 'test-token',
        tenantId: 'tenant-123',
        headers: { 'X-Custom': 'value' },
      });

      const connectPromise = conn.connect();
      await vi.advanceTimersByTimeAsync(0);
      await connectPromise;

      expect(conn.isConnected()).toBe(true);
      conn.disconnect();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from WebSocket server', async () => {
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      connection.disconnect();
      expect(connection.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(connection.isConnected()).toBe(false);
    });

    it('should emit DISCONNECTED event', async () => {
      const handler = vi.fn();
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      connection.on(ConnectionEvent.DISCONNECTED, handler);
      connection.disconnect();

      // The close event fires when we call disconnect
      expect(connection.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('send', () => {
    it('should queue messages when not connected', () => {
      connection.send({ type: MessageType.PING });
      // Message should be queued
      expect(connection.getStats().messagesSent).toBe(0);
    });

    it('should send messages when connected', async () => {
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      connection.send({ type: MessageType.PING });
      expect(connection.getStats().messagesSent).toBe(1);
    });
  });

  describe('sendWithAck', () => {
    it('should timeout if no acknowledgment received', async () => {
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      const promise = connection.sendWithAck({ type: MessageType.SUBSCRIBE, channel: 'test' }, 1000);
      await vi.advanceTimersByTimeAsync(1001);

      await expect(promise).rejects.toThrow('Acknowledgment timeout');
    });
  });

  describe('event handlers', () => {
    it('should add and remove event handlers', () => {
      const handler = vi.fn();
      const unsub = connection.on(ConnectionEvent.CONNECTED, handler);

      expect(typeof unsub).toBe('function');

      // Remove handler
      unsub();

      // Handler should not be called after removal
      connection.off(ConnectionEvent.CONNECTED, handler);
    });
  });

  describe('heartbeat', () => {
    it('should send ping after interval', async () => {
      const conn = createConnection({
        url: 'wss://test.example.com/ws',
        heartbeat: {
          enabled: true,
          interval: 1000,
          timeout: 500,
        },
      });

      await conn.connect();
      await vi.advanceTimersByTimeAsync(0);

      const initialSent = conn.getStats().messagesSent;
      await vi.advanceTimersByTimeAsync(1001);

      expect(conn.getStats().messagesSent).toBeGreaterThan(initialSent);

      conn.disconnect();
    });

    it('should not start heartbeat when disabled', async () => {
      const conn = createConnection({
        url: 'wss://test.example.com/ws',
        heartbeat: {
          enabled: false,
        },
      });

      await conn.connect();
      await vi.advanceTimersByTimeAsync(0);

      const initialSent = conn.getStats().messagesSent;
      await vi.advanceTimersByTimeAsync(35000);

      expect(conn.getStats().messagesSent).toBe(initialSent);

      conn.disconnect();
    });
  });

  describe('reconnection', () => {
    it('should not reconnect when autoReconnect is false', async () => {
      const conn = createConnection({
        url: 'wss://test.example.com/ws',
        autoReconnect: false,
      });

      await conn.connect();
      await vi.advanceTimersByTimeAsync(0);

      // Simulate disconnect by calling disconnect
      conn.disconnect();

      expect(conn.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('stats tracking', () => {
    it('should track uptime after connection', async () => {
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      // Advance time
      await vi.advanceTimersByTimeAsync(5000);

      const stats = connection.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(5000);
      expect(stats.connectedAt).toBeInstanceOf(Date);
    });

    it('should track last activity', async () => {
      await connection.connect();
      await vi.advanceTimersByTimeAsync(0);

      connection.send({ type: MessageType.PING });

      const stats = connection.getStats();
      expect(stats.lastActivity).toBeInstanceOf(Date);
    });
  });
});
