/**
 * @package @forge/realtime
 * @description Tests for presence tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PresenceManager,
  createPresenceManager,
  createPresenceUpdate,
  DEFAULT_PRESENCE_CONFIG,
} from '../presence';
import { Connection, createConnection } from '../connection';
import { PresenceEvent, MessageType, ConnectionEvent, Message } from '../realtime.types';

describe('PresenceManager', () => {
  let connection: Connection;
  let presenceManager: PresenceManager;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    connection = createConnection({
      url: 'wss://test.example.com/ws',
      debug: false,
    });
    await connection.connect();
    await vi.advanceTimersByTimeAsync(0);

    presenceManager = createPresenceManager('test-channel', connection);
  });

  afterEach(() => {
    presenceManager.cleanup();
    connection.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('DEFAULT_PRESENCE_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PRESENCE_CONFIG.data).toEqual({});
      expect(DEFAULT_PRESENCE_CONFIG.trackUpdates).toBe(true);
      expect(DEFAULT_PRESENCE_CONFIG.heartbeatInterval).toBe(60000);
    });
  });

  describe('createPresenceManager', () => {
    it('should create a presence manager instance', () => {
      expect(presenceManager).toBeInstanceOf(PresenceManager);
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = presenceManager.getState();
      expect(state.channel).toBe('test-channel');
      expect(state.members.size).toBe(0);
      expect(state.me).toBeUndefined();
    });
  });

  describe('getMembers', () => {
    it('should return empty array initially', () => {
      expect(presenceManager.getMembers()).toEqual([]);
    });
  });

  describe('getMember', () => {
    it('should return undefined for non-existent member', () => {
      expect(presenceManager.getMember('non-existent')).toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('should return null initially', () => {
      expect(presenceManager.getMe()).toBeNull();
    });
  });

  describe('getMemberCount', () => {
    it('should return 0 initially', () => {
      expect(presenceManager.getMemberCount()).toBe(0);
    });
  });

  describe('isSynced', () => {
    it('should return false initially', () => {
      expect(presenceManager.isSynced()).toBe(false);
    });
  });

  describe('join', () => {
    it('should set current member', () => {
      presenceManager.join('user-1', { name: 'Alice' });

      const me = presenceManager.getMe();
      expect(me).toBeDefined();
      expect(me?.id).toBe('user-1');
      expect(me?.data).toEqual({ name: 'Alice' });
      expect(me?.online).toBe(true);
    });

    it('should start heartbeat when trackUpdates is enabled', () => {
      const manager = createPresenceManager('test-channel', connection, {
        trackUpdates: true,
        heartbeatInterval: 1000,
      });

      manager.join('user-1');

      // Advance past heartbeat interval
      vi.advanceTimersByTime(1001);

      // Should have sent heartbeat
      expect(connection.getStats().messagesSent).toBeGreaterThan(0);

      manager.cleanup();
    });
  });

  describe('leave', () => {
    it('should clear current member', () => {
      presenceManager.join('user-1');
      expect(presenceManager.getMe()).toBeDefined();

      presenceManager.leave();
      expect(presenceManager.getMe()).toBeNull();
    });

    it('should do nothing if not joined', () => {
      expect(() => presenceManager.leave()).not.toThrow();
    });
  });

  describe('update', () => {
    it('should throw if not joined', () => {
      expect(() => presenceManager.update({ status: 'busy' }))
        .toThrow('Not joined to presence');
    });

    it('should update presence data', () => {
      presenceManager.join('user-1', { name: 'Alice', status: 'online' });
      presenceManager.update({ status: 'busy' });

      const me = presenceManager.getMe();
      expect(me?.data).toEqual({ name: 'Alice', status: 'busy' });
    });
  });

  describe('event handlers', () => {
    it('should subscribe to JOIN events', () => {
      const handler = vi.fn();
      const unsub = presenceManager.on(PresenceEvent.JOIN, handler);

      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should subscribe to LEAVE events', () => {
      const handler = vi.fn();
      const unsub = presenceManager.on(PresenceEvent.LEAVE, handler);

      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should subscribe to UPDATE events', () => {
      const handler = vi.fn();
      const unsub = presenceManager.on(PresenceEvent.UPDATE, handler);

      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should subscribe to SYNC events', () => {
      const handler = vi.fn();
      const unsub = presenceManager.on(PresenceEvent.SYNC, handler);

      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      presenceManager.on(PresenceEvent.JOIN, handler);
      presenceManager.off(PresenceEvent.JOIN, handler);
    });
  });

  describe('cleanup', () => {
    it('should clear all state', () => {
      presenceManager.join('user-1');
      expect(presenceManager.getMe()).toBeDefined();

      presenceManager.cleanup();

      expect(presenceManager.getMe()).toBeNull();
      expect(presenceManager.getMembers()).toEqual([]);
      expect(presenceManager.isSynced()).toBe(false);
    });
  });
});

describe('createPresenceUpdate', () => {
  it('should create a join update', () => {
    const member = {
      id: 'user-1',
      name: 'Alice',
      joinedAt: new Date(),
      online: true,
    };

    const update = createPresenceUpdate('test-channel', member, 'join');

    expect(update.channel).toBe('test-channel');
    expect(update.member).toBe(member);
    expect(update.type).toBe('join');
  });

  it('should create a leave update', () => {
    const member = {
      id: 'user-1',
      joinedAt: new Date(),
      online: false,
    };

    const update = createPresenceUpdate('test-channel', member, 'leave');

    expect(update.type).toBe('leave');
  });

  it('should create an update update', () => {
    const member = {
      id: 'user-1',
      joinedAt: new Date(),
      online: true,
      data: { status: 'busy' },
    };

    const update = createPresenceUpdate('test-channel', member, 'update');

    expect(update.type).toBe('update');
  });
});

describe('PresenceManager message handling', () => {
  let connection: Connection;
  let presenceManager: PresenceManager;
  let messageHandler: ((message: Message) => void) | null = null;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    connection = createConnection({
      url: 'wss://test.example.com/ws',
      debug: false,
    });

    // Capture the message handler
    const originalOn = connection.on.bind(connection);
    vi.spyOn(connection, 'on').mockImplementation((event, handler) => {
      if (event === ConnectionEvent.MESSAGE) {
        messageHandler = handler as (message: Message) => void;
      }
      return originalOn(event, handler);
    });

    await connection.connect();
    await vi.advanceTimersByTimeAsync(0);

    presenceManager = createPresenceManager('test-channel', connection);
  });

  afterEach(() => {
    presenceManager.cleanup();
    connection.disconnect();
    messageHandler = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should handle PRESENCE_JOIN messages', () => {
    const joinHandler = vi.fn();
    presenceManager.on(PresenceEvent.JOIN, joinHandler);

    // Simulate incoming join message
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_JOIN,
        channel: 'test-channel',
        payload: { id: 'user-2', name: 'Bob', data: { status: 'online' } },
      });
    }

    expect(presenceManager.getMemberCount()).toBe(1);
    expect(presenceManager.getMember('user-2')).toBeDefined();
    expect(joinHandler).toHaveBeenCalled();
  });

  it('should handle PRESENCE_LEAVE messages', () => {
    const leaveHandler = vi.fn();

    // First add a member
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_JOIN,
        channel: 'test-channel',
        payload: { id: 'user-2', name: 'Bob' },
      });
    }

    presenceManager.on(PresenceEvent.LEAVE, leaveHandler);

    // Then remove them
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_LEAVE,
        channel: 'test-channel',
        payload: { id: 'user-2' },
      });
    }

    expect(presenceManager.getMemberCount()).toBe(0);
    expect(presenceManager.getMember('user-2')).toBeUndefined();
    expect(leaveHandler).toHaveBeenCalled();
  });

  it('should handle PRESENCE_UPDATE messages', () => {
    const updateHandler = vi.fn();

    // First add a member
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_JOIN,
        channel: 'test-channel',
        payload: { id: 'user-2', data: { status: 'online' } },
      });
    }

    presenceManager.on(PresenceEvent.UPDATE, updateHandler);

    // Then update them
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_UPDATE,
        channel: 'test-channel',
        payload: { id: 'user-2', data: { status: 'busy' } },
      });
    }

    const member = presenceManager.getMember('user-2');
    expect(member?.data).toEqual({ status: 'busy' });
    expect(updateHandler).toHaveBeenCalled();
  });

  it('should handle PRESENCE_SYNC messages', () => {
    const syncHandler = vi.fn();
    presenceManager.on(PresenceEvent.SYNC, syncHandler);

    // Simulate sync message with multiple members
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_SYNC,
        channel: 'test-channel',
        payload: {
          members: [
            { id: 'user-1', name: 'Alice' },
            { id: 'user-2', name: 'Bob' },
            { id: 'user-3', name: 'Charlie' },
          ],
        },
      });
    }

    expect(presenceManager.getMemberCount()).toBe(3);
    expect(presenceManager.isSynced()).toBe(true);
    expect(syncHandler).toHaveBeenCalled();
  });

  it('should ignore messages from other channels', () => {
    if (messageHandler) {
      messageHandler({
        type: MessageType.PRESENCE_JOIN,
        channel: 'other-channel',
        payload: { id: 'user-2' },
      });
    }

    expect(presenceManager.getMemberCount()).toBe(0);
  });
});
