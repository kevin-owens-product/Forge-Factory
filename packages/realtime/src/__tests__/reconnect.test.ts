/**
 * @package @forge/realtime
 * @description Tests for reconnection logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ReconnectManager,
  ReconnectEvent,
  calculateBackoffDelay,
  createReconnectManager,
  DEFAULT_RECONNECT_CONFIG,
} from '../reconnect';

describe('DEFAULT_RECONNECT_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_RECONNECT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_RECONNECT_CONFIG.maxAttempts).toBe(10);
    expect(DEFAULT_RECONNECT_CONFIG.initialDelay).toBe(1000);
    expect(DEFAULT_RECONNECT_CONFIG.maxDelay).toBe(30000);
    expect(DEFAULT_RECONNECT_CONFIG.multiplier).toBe(2);
    expect(DEFAULT_RECONNECT_CONFIG.jitter).toBe(true);
  });
});

describe('calculateBackoffDelay', () => {
  it('should calculate delay for first attempt', () => {
    const delay = calculateBackoffDelay(1, {
      enabled: true,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: false,
    });

    expect(delay).toBe(1000);
  });

  it('should apply exponential backoff', () => {
    const config = {
      enabled: true,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: false,
    };

    expect(calculateBackoffDelay(1, config)).toBe(1000);
    expect(calculateBackoffDelay(2, config)).toBe(2000);
    expect(calculateBackoffDelay(3, config)).toBe(4000);
    expect(calculateBackoffDelay(4, config)).toBe(8000);
    expect(calculateBackoffDelay(5, config)).toBe(16000);
  });

  it('should cap at maxDelay', () => {
    const delay = calculateBackoffDelay(10, {
      enabled: true,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: false,
    });

    expect(delay).toBe(30000);
  });

  it('should add jitter when enabled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const delay = calculateBackoffDelay(1, {
      enabled: true,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: true,
    });

    // With jitter, delay should be within +/- 25% of base delay
    expect(delay).toBeGreaterThanOrEqual(750);
    expect(delay).toBeLessThanOrEqual(1250);

    vi.restoreAllMocks();
  });

  it('should use default config values when not provided', () => {
    const delay = calculateBackoffDelay(1, { enabled: true });
    expect(delay).toBeGreaterThan(0);
  });
});

describe('ReconnectManager', () => {
  let manager: ReconnectManager;
  let connectFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    connectFn = vi.fn().mockResolvedValue(undefined);
    manager = createReconnectManager(
      {
        enabled: true,
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 1000,
        multiplier: 2,
        jitter: false,
      },
      connectFn
    );
  });

  afterEach(() => {
    manager.cancel();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('createReconnectManager', () => {
    it('should create a manager instance', () => {
      expect(manager).toBeInstanceOf(ReconnectManager);
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = manager.getState();
      expect(state.attempts).toBe(0);
      expect(state.delay).toBe(0);
      expect(state.isReconnecting).toBe(false);
    });
  });

  describe('shouldReconnect', () => {
    it('should return true when attempts are below max', () => {
      expect(manager.shouldReconnect()).toBe(true);
    });

    it('should return false when reconnection is disabled', () => {
      const disabledManager = createReconnectManager(
        { enabled: false },
        connectFn
      );
      expect(disabledManager.shouldReconnect()).toBe(false);
    });
  });

  describe('start', () => {
    it('should not start if reconnection is disabled', () => {
      const disabledManager = createReconnectManager(
        { enabled: false },
        connectFn
      );

      disabledManager.start();
      expect(disabledManager.getState().isReconnecting).toBe(false);
    });

    it('should start reconnection process', () => {
      manager.start();
      expect(manager.getState().isReconnecting).toBe(true);
    });

    it('should not start if already reconnecting', () => {
      manager.start();
      const state1 = manager.getState();

      manager.start();
      const state2 = manager.getState();

      expect(state2.attempts).toBe(state1.attempts);
    });

    it('should schedule reconnection attempt', async () => {
      manager.start();

      // Wait for the delay
      await vi.advanceTimersByTimeAsync(101);

      expect(connectFn).toHaveBeenCalled();
    });

    it('should emit ATTEMPT event', async () => {
      const handler = vi.fn();
      manager.on(ReconnectEvent.ATTEMPT, handler);

      manager.start();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop reconnection process', () => {
      manager.start();
      expect(manager.getState().isReconnecting).toBe(true);

      manager.stop();
      expect(manager.getState().isReconnecting).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel and emit CANCELLED event', () => {
      const handler = vi.fn();
      manager.on(ReconnectEvent.CANCELLED, handler);

      manager.start();
      manager.cancel();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      manager.start();
      expect(manager.getState().attempts).toBe(1);

      manager.reset();

      const state = manager.getState();
      expect(state.attempts).toBe(0);
      expect(state.delay).toBe(0);
      expect(state.isReconnecting).toBe(false);
    });
  });

  describe('onConnected', () => {
    it('should reset and emit SUCCESS event', () => {
      const handler = vi.fn();
      manager.on(ReconnectEvent.SUCCESS, handler);

      manager.start();
      manager.onConnected();

      expect(handler).toHaveBeenCalled();
      expect(manager.getState().attempts).toBe(0);
    });
  });

  describe('onDisconnected', () => {
    it('should start reconnection if enabled', () => {
      manager.onDisconnected(new Error('Connection lost'));
      expect(manager.getState().isReconnecting).toBe(true);
    });

    it('should store last error', () => {
      const error = new Error('Connection lost');
      manager.onDisconnected(error);

      expect(manager.getState().lastError).toBe(error);
    });
  });

  describe('max attempts', () => {
    it('should stop after max attempts and emit MAX_ATTEMPTS event', async () => {
      const maxHandler = vi.fn();
      const failureHandler = vi.fn();
      connectFn.mockRejectedValue(new Error('Connection failed'));

      manager.on(ReconnectEvent.MAX_ATTEMPTS, maxHandler);
      manager.on(ReconnectEvent.FAILURE, failureHandler);

      manager.start();

      // Run through all attempts
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }

      expect(maxHandler).toHaveBeenCalled();
      expect(manager.getState().isReconnecting).toBe(false);
    });
  });

  describe('exponential backoff', () => {
    it('should increase delay with each attempt', async () => {
      connectFn.mockRejectedValue(new Error('Connection failed'));

      manager.start();
      const delay1 = manager.getState().delay;

      await vi.advanceTimersByTimeAsync(delay1 + 10);

      const delay2 = manager.getState().delay;

      expect(delay2).toBeGreaterThan(delay1);
    });
  });

  describe('event handlers', () => {
    it('should add and remove event handlers', () => {
      const handler = vi.fn();
      const unsub = manager.on(ReconnectEvent.ATTEMPT, handler);

      expect(typeof unsub).toBe('function');

      unsub();
      manager.off(ReconnectEvent.ATTEMPT, handler);
    });
  });
});
