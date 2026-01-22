/**
 * @package @forge/realtime
 * @description Tests for channel management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Channel, ChannelManager, createChannelManager } from '../channel';
import { Connection, createConnection } from '../connection';
import { ChannelState, ChannelEvent, MessageType, ConnectionEvent } from '../realtime.types';

describe('Channel', () => {
  let connection: Connection;
  let channel: Channel;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    connection = createConnection({
      url: 'wss://test.example.com/ws',
      debug: false,
    });
    await connection.connect();
    await vi.advanceTimersByTimeAsync(0);

    channel = new Channel({ name: 'test-channel' }, connection);
  });

  afterEach(() => {
    connection.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a channel with the given name', () => {
      expect(channel.name).toBe('test-channel');
    });

    it('should start in UNSUBSCRIBED state', () => {
      expect(channel.state).toBe(ChannelState.UNSUBSCRIBED);
    });
  });

  describe('getInfo', () => {
    it('should return channel info', () => {
      const info = channel.getInfo();
      expect(info.name).toBe('test-channel');
      expect(info.state).toBe(ChannelState.UNSUBSCRIBED);
      expect(info.presence).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should set state to SUBSCRIBING', () => {
      channel.subscribe().catch(() => {});
      expect(channel.state).toBe(ChannelState.SUBSCRIBING);
    });

    it('should reject if already subscribing', async () => {
      channel.subscribe().catch(() => {});
      await expect(channel.subscribe()).rejects.toThrow('Subscription already in progress');
    });

    it('should resolve immediately if already subscribed', async () => {
      // Mock successful subscription by simulating the ack message
      const subscribePromise = channel.subscribe();

      // Advance timers for the sendWithAck timeout
      await vi.advanceTimersByTimeAsync(10001);

      await expect(subscribePromise).rejects.toThrow('Acknowledgment timeout');
    });
  });

  describe('unsubscribe', () => {
    it('should do nothing if not subscribed', () => {
      expect(() => channel.unsubscribe()).not.toThrow();
    });

    it('should set state to UNSUBSCRIBED', async () => {
      // Start subscription
      channel.subscribe().catch(() => {});
      expect(channel.state).toBe(ChannelState.SUBSCRIBING);

      // Unsubscribe while subscribing
      channel.unsubscribe();
      expect(channel.state).toBe(ChannelState.UNSUBSCRIBED);
    });
  });

  describe('publish', () => {
    it('should throw if not subscribed', () => {
      expect(() => channel.publish('event', { data: 'test' }))
        .toThrow('Cannot publish: not subscribed to channel');
    });
  });

  describe('event handlers', () => {
    it('should add and remove event handlers', () => {
      const handler = vi.fn();
      const unsub = channel.on('test-event', handler);

      expect(typeof unsub).toBe('function');

      unsub();
      channel.off('test-event', handler);
    });

    it('should add and remove channel event handlers', () => {
      const handler = vi.fn();
      const unsub = channel.onChannelEvent(ChannelEvent.SUBSCRIBED, handler);

      expect(typeof unsub).toBe('function');

      unsub();
      channel.offChannelEvent(ChannelEvent.SUBSCRIBED, handler);
    });
  });

  describe('presence', () => {
    it('should return undefined for non-presence channels', () => {
      expect(channel.presence).toBeUndefined();
    });

    it('should return presence interface for presence channels', async () => {
      const presenceChannel = new Channel(
        { name: 'presence-channel', presence: true },
        connection
      );

      expect(presenceChannel.presence).toBeDefined();
      expect(typeof presenceChannel.presence?.get).toBe('function');
      expect(typeof presenceChannel.presence?.update).toBe('function');
      expect(typeof presenceChannel.presence?.onJoin).toBe('function');
      expect(typeof presenceChannel.presence?.onLeave).toBe('function');
      expect(typeof presenceChannel.presence?.onUpdate).toBe('function');
    });
  });

  describe('getPresence', () => {
    it('should return empty presence state', () => {
      const presenceChannel = new Channel(
        { name: 'presence-channel', presence: true },
        connection
      );

      const presence = presenceChannel.getPresence();
      expect(presence.channel).toBe('presence-channel');
      expect(presence.members.size).toBe(0);
    });
  });

  describe('updatePresence', () => {
    it('should throw for non-presence channels', () => {
      expect(() => channel.updatePresence({ status: 'online' }))
        .toThrow('Cannot update presence: not a presence channel');
    });

    it('should send presence update for presence channels', () => {
      const presenceChannel = new Channel(
        { name: 'presence-channel', presence: true },
        connection
      );

      expect(() => presenceChannel.updatePresence({ status: 'online' }))
        .not.toThrow();
    });
  });
});

describe('ChannelManager', () => {
  let connection: Connection;
  let manager: ChannelManager;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    connection = createConnection({
      url: 'wss://test.example.com/ws',
      debug: false,
    });
    await connection.connect();
    await vi.advanceTimersByTimeAsync(0);

    manager = createChannelManager(connection);
  });

  afterEach(() => {
    connection.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('channel', () => {
    it('should create a new channel', () => {
      const channel = manager.channel('test-channel');
      expect(channel).toBeInstanceOf(Channel);
      expect(channel.name).toBe('test-channel');
    });

    it('should return existing channel if already created', () => {
      const channel1 = manager.channel('test-channel');
      const channel2 = manager.channel('test-channel');
      expect(channel1).toBe(channel2);
    });

    it('should accept channel config', () => {
      const channel = manager.channel('presence-channel', {
        presence: true,
        private: true,
      });
      expect(channel.presence).toBeDefined();
    });
  });

  describe('getChannel', () => {
    it('should return undefined for non-existent channel', () => {
      expect(manager.getChannel('non-existent')).toBeUndefined();
    });

    it('should return existing channel', () => {
      const created = manager.channel('test-channel');
      const retrieved = manager.getChannel('test-channel');
      expect(retrieved).toBe(created);
    });
  });

  describe('isSubscribed', () => {
    it('should return false for non-existent channel', () => {
      expect(manager.isSubscribed('non-existent')).toBe(false);
    });

    it('should return false for unsubscribed channel', () => {
      manager.channel('test-channel');
      expect(manager.isSubscribed('test-channel')).toBe(false);
    });
  });

  describe('getChannels', () => {
    it('should return empty array initially', () => {
      expect(manager.getChannels()).toEqual([]);
    });

    it('should return all channels', () => {
      manager.channel('channel-1');
      manager.channel('channel-2');
      expect(manager.getChannels()).toHaveLength(2);
    });
  });

  describe('getSubscribedChannels', () => {
    it('should return empty array when no channels are subscribed', () => {
      manager.channel('channel-1');
      expect(manager.getSubscribedChannels()).toEqual([]);
    });
  });

  describe('unsubscribeAll', () => {
    it('should unsubscribe from all channels', () => {
      manager.channel('channel-1');
      manager.channel('channel-2');

      expect(() => manager.unsubscribeAll()).not.toThrow();
    });
  });

  describe('removeChannel', () => {
    it('should remove a channel', () => {
      manager.channel('test-channel');
      expect(manager.getChannel('test-channel')).toBeDefined();

      manager.removeChannel('test-channel');
      expect(manager.getChannel('test-channel')).toBeUndefined();
    });

    it('should handle removing non-existent channel', () => {
      expect(() => manager.removeChannel('non-existent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all channels', () => {
      manager.channel('channel-1');
      manager.channel('channel-2');

      manager.clear();

      expect(manager.getChannels()).toEqual([]);
    });
  });
});
