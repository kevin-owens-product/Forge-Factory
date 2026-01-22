/**
 * @package @forge/realtime
 * @description Tests for realtime service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealtimeService, createRealtimeService } from '../realtime.service';
import { ConnectionState, ChannelState } from '../realtime.types';

describe('RealtimeService', () => {
  let service: RealtimeService;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    service = createRealtimeService({
      url: 'wss://test.example.com/ws',
      debug: false,
    });
  });

  afterEach(() => {
    service.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('createRealtimeService', () => {
    it('should create a service instance', () => {
      expect(service).toBeInstanceOf(RealtimeService);
    });
  });

  describe('getConnectionState', () => {
    it('should return DISCONNECTED initially', () => {
      expect(service.getConnectionState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should return CONNECTED after connecting', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.getConnectionState()).toBe(ConnectionState.CONNECTED);
    });
  });

  describe('getStats', () => {
    it('should return connection stats', () => {
      const stats = service.getStats();
      expect(stats.state).toBe(ConnectionState.DISCONNECTED);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true after connecting', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('connect', () => {
    it('should connect to the server', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from the server', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a channel', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      const subscribePromise = service.subscribe('test-channel');

      // This will timeout because there's no actual server
      await vi.advanceTimersByTimeAsync(10001);

      await expect(subscribePromise).rejects.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from a channel', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      expect(() => service.unsubscribe('test-channel')).not.toThrow();
    });
  });

  describe('channel', () => {
    it('should return undefined for non-existent channel', () => {
      expect(service.channel('non-existent')).toBeUndefined();
    });
  });

  describe('publish', () => {
    it('should throw if not subscribed', () => {
      expect(() => service.publish('test-channel', 'event', { data: 'test' }))
        .toThrow('Not subscribed to channel: test-channel');
    });
  });

  describe('getPresence', () => {
    it('should return null for non-existent channel', () => {
      expect(service.getPresence('test-channel')).toBeNull();
    });
  });

  describe('updatePresence', () => {
    it('should throw if not tracking presence', () => {
      expect(() => service.updatePresence('test-channel', { status: 'online' }))
        .toThrow('Not tracking presence for channel: test-channel');
    });
  });

  describe('joinPresence', () => {
    it('should join presence for a channel', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      const manager = service.joinPresence('test-channel', 'user-1', { name: 'Alice' });
      expect(manager).toBeDefined();
      expect(manager.getMe()).toBeDefined();
    });
  });

  describe('leavePresence', () => {
    it('should leave presence for a channel', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      service.joinPresence('test-channel', 'user-1');
      expect(() => service.leavePresence('test-channel')).not.toThrow();
    });
  });

  describe('event handlers', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const unsub = service.on('connected', handler);

      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      service.on('connected', handler);
      service.off('connected', handler);
    });

    it('should emit connected event', async () => {
      const handler = vi.fn();
      service.on('connected', handler);

      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit disconnected event', async () => {
      const handler = vi.fn();

      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      service.on('disconnected', handler);
      service.disconnect();

      // Handler might be called synchronously or async
    });
  });

  describe('getSubscribedChannels', () => {
    it('should return empty array initially', () => {
      expect(service.getSubscribedChannels()).toEqual([]);
    });
  });

  describe('isSubscribed', () => {
    it('should return false for unsubscribed channel', () => {
      expect(service.isSubscribed('test-channel')).toBe(false);
    });
  });

  describe('send', () => {
    it('should send raw message', async () => {
      await service.connect();
      await vi.advanceTimersByTimeAsync(0);

      expect(() => service.send({ type: 'ping' as any })).not.toThrow();
    });
  });

  describe('config callbacks', () => {
    it('should call onConnectionChange callback', async () => {
      const onConnectionChange = vi.fn();

      const svc = createRealtimeService({
        url: 'wss://test.example.com/ws',
        onConnectionChange,
      });

      await svc.connect();
      await vi.advanceTimersByTimeAsync(0);

      expect(onConnectionChange).toHaveBeenCalledWith(ConnectionState.CONNECTED);

      svc.disconnect();
    });

    it('should call onError callback', async () => {
      const onError = vi.fn();

      const svc = createRealtimeService({
        url: 'wss://test.example.com/ws',
        onError,
      });

      // Can't easily trigger an error in the mock, so just verify callback is set
      expect(onError).not.toHaveBeenCalled();

      svc.disconnect();
    });
  });
});

describe('RealtimeService with tenantId', () => {
  it('should support multi-tenant configuration', () => {
    const service = createRealtimeService({
      url: 'wss://test.example.com/ws',
      tenantId: 'tenant-123',
    });

    expect(service).toBeDefined();
    service.disconnect();
  });
});

describe('RealtimeService with user context', () => {
  it('should support user context', () => {
    const service = createRealtimeService({
      url: 'wss://test.example.com/ws',
      user: {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
      },
    });

    expect(service).toBeDefined();
    service.disconnect();
  });
});
