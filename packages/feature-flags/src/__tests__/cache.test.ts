/**
 * @package @forge/feature-flags
 * @description Tests for flag caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DEFAULT_CACHE_CONFIG,
  hashUserContext,
  generateCacheKey,
  FlagCache,
} from '../cache';
import { UserContext, EvaluationReason } from '../feature-flags.types';

describe('DEFAULT_CACHE_CONFIG', () => {
  it('should have default values', () => {
    expect(DEFAULT_CACHE_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CACHE_CONFIG.ttl).toBe(60000);
    expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
    expect(DEFAULT_CACHE_CONFIG.keyPrefix).toBe('ff');
  });
});

describe('hashUserContext', () => {
  it('should generate consistent hash for same context', () => {
    const context: UserContext = { id: 'user-123' };
    const hash1 = hashUserContext(context);
    const hash2 = hashUserContext(context);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different users', () => {
    const context1: UserContext = { id: 'user-123' };
    const context2: UserContext = { id: 'user-456' };
    const hash1 = hashUserContext(context1);
    const hash2 = hashUserContext(context2);
    expect(hash1).not.toBe(hash2);
  });

  it('should include tenantId in hash', () => {
    const context1: UserContext = { id: 'user-123', tenantId: 'tenant-1' };
    const context2: UserContext = { id: 'user-123', tenantId: 'tenant-2' };
    const hash1 = hashUserContext(context1);
    const hash2 = hashUserContext(context2);
    expect(hash1).not.toBe(hash2);
  });

  it('should include role in hash', () => {
    const context1: UserContext = { id: 'user-123', role: 'admin' };
    const context2: UserContext = { id: 'user-123', role: 'user' };
    const hash1 = hashUserContext(context1);
    const hash2 = hashUserContext(context2);
    expect(hash1).not.toBe(hash2);
  });

  it('should handle array roles', () => {
    const context: UserContext = { id: 'user-123', role: ['admin', 'editor'] };
    const hash = hashUserContext(context);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
  });

  it('should include groups in hash', () => {
    const context1: UserContext = { id: 'user-123', groups: ['team-a'] };
    const context2: UserContext = { id: 'user-123', groups: ['team-b'] };
    const hash1 = hashUserContext(context1);
    const hash2 = hashUserContext(context2);
    expect(hash1).not.toBe(hash2);
  });

  it('should include isBeta in hash', () => {
    const context1: UserContext = { id: 'user-123', isBeta: true };
    const context2: UserContext = { id: 'user-123', isBeta: false };
    const hash1 = hashUserContext(context1);
    const hash2 = hashUserContext(context2);
    expect(hash1).not.toBe(hash2);
  });

  it('should include isInternal in hash', () => {
    const context1: UserContext = { id: 'user-123', isInternal: true };
    const context2: UserContext = { id: 'user-123', isInternal: false };
    const hash1 = hashUserContext(context1);
    const hash2 = hashUserContext(context2);
    expect(hash1).not.toBe(hash2);
  });

  it('should handle missing optional fields', () => {
    const context: UserContext = { id: 'user-123' };
    const hash = hashUserContext(context);
    expect(hash).toBeDefined();
  });
});

describe('generateCacheKey', () => {
  it('should generate key with prefix and flag key', () => {
    const key = generateCacheKey('my-flag');
    expect(key).toBe('ff:my-flag');
  });

  it('should include user hash when provided', () => {
    const key = generateCacheKey('my-flag', 'abc123');
    expect(key).toBe('ff:my-flag:abc123');
  });

  it('should use custom prefix', () => {
    const key = generateCacheKey('my-flag', undefined, 'custom');
    expect(key).toBe('custom:my-flag');
  });

  it('should use custom prefix with user hash', () => {
    const key = generateCacheKey('my-flag', 'abc123', 'custom');
    expect(key).toBe('custom:my-flag:abc123');
  });
});

describe('FlagCache', () => {
  let cache: FlagCache;
  const userContext: UserContext = { id: 'user-123' };

  beforeEach(() => {
    cache = new FlagCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get/set', () => {
    it('should set and get cached value', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      const cached = cache.get<boolean>('my-flag', userContext);
      expect(cached).not.toBeNull();
      expect(cached?.value).toBe(true);
    });

    it('should return null for non-existent key', () => {
      const cached = cache.get('non-existent', userContext);
      expect(cached).toBeNull();
    });

    it('should return null when cache is disabled', () => {
      cache = new FlagCache({ enabled: false });
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      const cached = cache.get('my-flag', userContext);
      expect(cached).toBeNull();
    });

    it('should not set when cache is disabled', () => {
      cache = new FlagCache({ enabled: false });
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });

    it('should include reason in cached data', () => {
      cache.set('my-flag', true, EvaluationReason.RULE_MATCH, userContext);
      const cached = cache.get<boolean>('my-flag', userContext);
      expect(cached?.reason).toBe(EvaluationReason.RULE_MATCH);
    });

    it('should include flagKey in cached data', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      const cached = cache.get<boolean>('my-flag', userContext);
      expect(cached?.flagKey).toBe('my-flag');
    });

    it('should include timestamps', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      const cached = cache.get<boolean>('my-flag', userContext);
      expect(cached?.cachedAt).toBeInstanceOf(Date);
      expect(cached?.expiresAt).toBeInstanceOf(Date);
    });

    it('should cache without user context', () => {
      cache.set('global-flag', true, EvaluationReason.DEFAULT);
      const cached = cache.get<boolean>('global-flag');
      expect(cached?.value).toBe(true);
    });
  });

  describe('expiration', () => {
    it('should return null for expired entry', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      vi.advanceTimersByTime(70000); // Advance past TTL
      const cached = cache.get('my-flag', userContext);
      expect(cached).toBeNull();
    });

    it('should use custom TTL', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext, 5000);
      vi.advanceTimersByTime(3000);
      expect(cache.get('my-flag', userContext)).not.toBeNull();
      vi.advanceTimersByTime(3000);
      expect(cache.get('my-flag', userContext)).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('should invalidate specific flag', () => {
      cache.set('flag-1', true, EvaluationReason.DEFAULT, userContext);
      cache.set('flag-2', true, EvaluationReason.DEFAULT, userContext);
      cache.invalidate('flag-1');
      expect(cache.get('flag-1', userContext)).toBeNull();
      expect(cache.get('flag-2', userContext)).not.toBeNull();
    });

    it('should invalidate all entries for a flag', () => {
      const context1: UserContext = { id: 'user-1' };
      const context2: UserContext = { id: 'user-2' };
      cache.set('my-flag', true, EvaluationReason.DEFAULT, context1);
      cache.set('my-flag', false, EvaluationReason.DEFAULT, context2);
      cache.invalidate('my-flag');
      expect(cache.get('my-flag', context1)).toBeNull();
      expect(cache.get('my-flag', context2)).toBeNull();
    });
  });

  describe('invalidateAll', () => {
    it('should clear all entries', () => {
      cache.set('flag-1', true, EvaluationReason.DEFAULT, userContext);
      cache.set('flag-2', true, EvaluationReason.DEFAULT, userContext);
      cache.invalidateAll();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('invalidateByUser', () => {
    it('should invalidate entries for specific user', () => {
      const context1: UserContext = { id: 'user-1' };
      const context2: UserContext = { id: 'user-2' };
      cache.set('my-flag', true, EvaluationReason.DEFAULT, context1);
      cache.set('my-flag', false, EvaluationReason.DEFAULT, context2);
      cache.invalidateByUser(context1);
      expect(cache.get('my-flag', context1)).toBeNull();
      expect(cache.get('my-flag', context2)).not.toBeNull();
    });
  });

  describe('max size', () => {
    it('should evict oldest entries when max size is reached', () => {
      cache = new FlagCache({ maxSize: 5 });
      for (let i = 0; i < 6; i++) {
        cache.set(`flag-${i}`, true, EvaluationReason.DEFAULT, { id: `user-${i}` });
      }
      expect(cache.getStats().size).toBeLessThanOrEqual(5);
    });

    it('should evict about 10% when at max size', () => {
      cache = new FlagCache({ maxSize: 10 });
      for (let i = 0; i < 10; i++) {
        cache.set(`flag-${i}`, true, EvaluationReason.DEFAULT, { id: `user-${i}` });
      }
      // Adding one more should trigger eviction
      cache.set('flag-extra', true, EvaluationReason.DEFAULT, { id: 'user-extra' });
      expect(cache.getStats().size).toBeLessThanOrEqual(10);
    });
  });

  describe('getStats', () => {
    it('should track hits', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      cache.get('my-flag', userContext);
      cache.get('my-flag', userContext);
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track misses', () => {
      cache.get('non-existent', userContext);
      cache.get('another-non-existent', userContext);
      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      cache.get('my-flag', userContext); // Hit
      cache.get('non-existent', userContext); // Miss
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should include cache size', () => {
      cache.set('flag-1', true, EvaluationReason.DEFAULT, userContext);
      cache.set('flag-2', true, EvaluationReason.DEFAULT, userContext);
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it('should indicate if cache is enabled', () => {
      const stats = cache.getStats();
      expect(stats.enabled).toBe(true);
    });
  });

  describe('resetStats', () => {
    it('should reset hits and misses', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      cache.get('my-flag', userContext);
      cache.get('non-existent', userContext);
      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      cache.set('flag-1', true, EvaluationReason.DEFAULT, userContext);
      cache.set('flag-2', true, EvaluationReason.DEFAULT, { id: 'user-2' });
      vi.advanceTimersByTime(70000);
      const removed = cache.cleanup();
      expect(removed).toBe(2);
      expect(cache.getStats().size).toBe(0);
    });

    it('should not remove non-expired entries', () => {
      cache.set('flag-1', true, EvaluationReason.DEFAULT, userContext);
      vi.advanceTimersByTime(30000);
      const removed = cache.cleanup();
      expect(removed).toBe(0);
      expect(cache.getStats().size).toBe(1);
    });

    it('should return count of removed entries', () => {
      cache.set('flag-1', true, EvaluationReason.DEFAULT, userContext);
      cache.set('flag-2', true, EvaluationReason.DEFAULT, { id: 'user-2' });
      cache.set('flag-3', true, EvaluationReason.DEFAULT, { id: 'user-3' });
      vi.advanceTimersByTime(70000);
      const removed = cache.cleanup();
      expect(removed).toBe(3);
    });
  });

  describe('getConfig', () => {
    it('should return cache config', () => {
      cache = new FlagCache({ ttl: 30000, keyPrefix: 'test' });
      const config = cache.getConfig();
      expect(config.ttl).toBe(30000);
      expect(config.keyPrefix).toBe('test');
    });

    it('should return a copy of config', () => {
      const config = cache.getConfig();
      config.ttl = 99999;
      expect(cache.getConfig().ttl).toBe(60000);
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      cache.updateConfig({ ttl: 30000 });
      expect(cache.getConfig().ttl).toBe(30000);
    });

    it('should clear cache when disabled', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      cache.updateConfig({ enabled: false });
      expect(cache.getStats().size).toBe(0);
    });

    it('should preserve other config values', () => {
      cache = new FlagCache({ ttl: 30000, keyPrefix: 'test' });
      cache.updateConfig({ ttl: 60000 });
      expect(cache.getConfig().keyPrefix).toBe('test');
    });
  });

  describe('expiration tracking', () => {
    it('should increment misses when entry expires', () => {
      cache.set('my-flag', true, EvaluationReason.DEFAULT, userContext);
      vi.advanceTimersByTime(70000);
      cache.get('my-flag', userContext);
      expect(cache.getStats().misses).toBe(1);
    });
  });
});
