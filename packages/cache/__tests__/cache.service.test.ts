/**
 * @package @forge/cache
 * @description Tests for cache service and related utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisClient, RedisClientInterface } from '../src/redis-client';
import {
  CacheService,
  TenantCache,
  getCacheService,
  resetCacheService,
} from '../src/cache.service';
import {
  serialize,
  deserialize,
  encode,
  decode,
  buildKey,
  extractKey,
  validateKey,
  calculateSize,
  detectValueType,
  generateLockToken,
} from '../src/serialization';
import {
  DEFAULT_REDIS_CONFIG,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_SHUTDOWN_OPTIONS,
  DEFAULT_LOCK_OPTIONS,
  CacheStats,
  SerializedValue,
} from '../src/cache.types';

// Mock @forge/errors
vi.mock('@forge/errors', () => ({
  ErrorCode: {
    CACHE_ERROR: 'INT_9003',
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

// Create mock Redis client
function createMockRedisClient(): RedisClientInterface {
  const storage = new Map<string, string>();

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) ?? null);
    }),
    set: vi.fn().mockImplementation((key: string, value: string, options?: { EX?: number; NX?: boolean; XX?: boolean }) => {
      if (options?.NX && storage.has(key)) {
        return Promise.resolve(null);
      }
      if (options?.XX && !storage.has(key)) {
        return Promise.resolve(null);
      }
      storage.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn().mockImplementation((key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      let count = 0;
      for (const k of keys) {
        if (storage.delete(k)) {
          count++;
        }
      }
      return Promise.resolve(count);
    }),
    mget: vi.fn().mockImplementation((keys: string[]) => {
      return Promise.resolve(keys.map((k) => storage.get(k) ?? null));
    }),
    mset: vi.fn().mockImplementation((keyValuePairs: [string, string][]) => {
      for (const [k, v] of keyValuePairs) {
        storage.set(k, v);
      }
      return Promise.resolve('OK');
    }),
    exists: vi.fn().mockImplementation((key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      let count = 0;
      for (const k of keys) {
        if (storage.has(k)) {
          count++;
        }
      }
      return Promise.resolve(count);
    }),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(3600),
    keys: vi.fn().mockImplementation((pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      const matches = Array.from(storage.keys()).filter((k) => regex.test(k));
      return Promise.resolve(matches);
    }),
    scan: vi.fn().mockResolvedValue({ cursor: 0, keys: [] }),
    info: vi.fn().mockResolvedValue('redis_version:7.0.0\nconnected_clients:1\nused_memory_human:1M\nuptime_in_seconds:1000'),
    flushdb: vi.fn().mockImplementation(() => {
      storage.clear();
      return Promise.resolve('OK');
    }),
    setnx: vi.fn().mockImplementation((key: string, value: string) => {
      if (storage.has(key)) {
        return Promise.resolve(0);
      }
      storage.set(key, value);
      return Promise.resolve(1);
    }),
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('Serialization', () => {
  describe('detectValueType', () => {
    it('should detect null', () => {
      expect(detectValueType(null)).toBe('null');
    });

    it('should detect undefined', () => {
      expect(detectValueType(undefined)).toBe('undefined');
    });

    it('should detect string', () => {
      expect(detectValueType('hello')).toBe('string');
    });

    it('should detect number', () => {
      expect(detectValueType(42)).toBe('number');
    });

    it('should detect boolean', () => {
      expect(detectValueType(true)).toBe('boolean');
      expect(detectValueType(false)).toBe('boolean');
    });

    it('should detect date', () => {
      expect(detectValueType(new Date())).toBe('date');
    });

    it('should detect buffer', () => {
      expect(detectValueType(Buffer.from('test'))).toBe('buffer');
    });

    it('should detect array', () => {
      expect(detectValueType([1, 2, 3])).toBe('array');
    });

    it('should detect object', () => {
      expect(detectValueType({ foo: 'bar' })).toBe('object');
    });
  });

  describe('serialize and deserialize', () => {
    it('should handle string', () => {
      const serialized = serialize('hello');
      expect(serialized.type).toBe('string');
      expect(deserialize(serialized)).toBe('hello');
    });

    it('should handle number', () => {
      const serialized = serialize(42);
      expect(serialized.type).toBe('number');
      expect(deserialize(serialized)).toBe(42);
    });

    it('should handle boolean', () => {
      const serialized = serialize(true);
      expect(serialized.type).toBe('boolean');
      expect(deserialize(serialized)).toBe(true);
    });

    it('should handle null', () => {
      const serialized = serialize(null);
      expect(serialized.type).toBe('null');
      expect(deserialize(serialized)).toBe(null);
    });

    it('should handle undefined', () => {
      const serialized = serialize(undefined);
      expect(serialized.type).toBe('undefined');
      expect(deserialize(serialized)).toBe(undefined);
    });

    it('should handle date', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const serialized = serialize(date);
      expect(serialized.type).toBe('date');
      const result = deserialize(serialized) as Date;
      expect(result.getTime()).toBe(date.getTime());
    });

    it('should handle buffer', () => {
      const buffer = Buffer.from('test data');
      const serialized = serialize(buffer);
      expect(serialized.type).toBe('buffer');
      const result = deserialize(serialized) as Buffer;
      expect(result.toString()).toBe('test data');
    });

    it('should handle array', () => {
      const arr = [1, 'two', true];
      const serialized = serialize(arr);
      expect(serialized.type).toBe('array');
      expect(deserialize(serialized)).toEqual(arr);
    });

    it('should handle object', () => {
      const obj = { name: 'test', value: 123 };
      const serialized = serialize(obj);
      expect(serialized.type).toBe('object');
      expect(deserialize(serialized)).toEqual(obj);
    });

    it('should handle nested objects with special types', () => {
      const obj = {
        date: new Date('2024-01-01'),
        set: new Set([1, 2, 3]),
        map: new Map([['a', 1], ['b', 2]]),
      };
      const serialized = serialize(obj);
      const result = deserialize(serialized) as {
        date: Date;
        set: Set<number>;
        map: Map<string, number>;
      };
      // The reviver restores Date, Set, and Map objects via __type markers
      expect(result.date).toBeInstanceOf(Date);
      expect(result.date.getTime()).toBe(obj.date.getTime());
      expect(result.set).toBeInstanceOf(Set);
      expect(Array.from(result.set)).toEqual(Array.from(obj.set));
      expect(result.map).toBeInstanceOf(Map);
      expect(Array.from(result.map.entries())).toEqual(Array.from(obj.map.entries()));
    });
  });

  describe('encode and decode', () => {
    it('should encode and decode serialized value', () => {
      const serialized = serialize({ test: 'value' });
      const encoded = encode(serialized);
      const decoded = decode(encoded);
      expect(decoded).toEqual(serialized);
    });

    it('should handle legacy format', () => {
      const legacy = JSON.stringify({ foo: 'bar' });
      const decoded = decode(legacy);
      expect(decoded.version).toBe(1);
    });

    it('should handle raw string', () => {
      const decoded = decode('plain string');
      expect(decoded.type).toBe('string');
      expect(decoded.data).toBe('plain string');
    });
  });

  describe('buildKey and extractKey', () => {
    it('should build key without namespace', () => {
      expect(buildKey('forge:', undefined, 'mykey')).toBe('forge:mykey');
    });

    it('should build key with namespace', () => {
      expect(buildKey('forge:', 'tenant:123:', 'mykey')).toBe('forge:tenant:123:mykey');
    });

    it('should extract key without namespace', () => {
      expect(extractKey('forge:', undefined, 'forge:mykey')).toBe('mykey');
    });

    it('should extract key with namespace', () => {
      expect(extractKey('forge:', 'tenant:123:', 'forge:tenant:123:mykey')).toBe('mykey');
    });
  });

  describe('validateKey', () => {
    it('should accept valid keys', () => {
      expect(() => validateKey('valid-key')).not.toThrow();
      expect(() => validateKey('key:with:colons')).not.toThrow();
      expect(() => validateKey('key_123')).not.toThrow();
    });

    it('should reject empty keys', () => {
      expect(() => validateKey('')).toThrow('non-empty string');
    });

    it('should reject long keys', () => {
      expect(() => validateKey('a'.repeat(513))).toThrow('512 characters');
    });

    it('should reject non-printable characters', () => {
      expect(() => validateKey('key\x00')).toThrow('printable ASCII');
    });
  });

  describe('calculateSize', () => {
    it('should return 0 for null/undefined', () => {
      expect(calculateSize(null)).toBe(0);
      expect(calculateSize(undefined)).toBe(0);
    });

    it('should calculate string size', () => {
      expect(calculateSize('hello')).toBe(5);
    });

    it('should return 8 for numbers', () => {
      expect(calculateSize(42)).toBe(8);
    });

    it('should return 4 for booleans', () => {
      expect(calculateSize(true)).toBe(4);
    });
  });

  describe('generateLockToken', () => {
    it('should generate unique tokens', () => {
      const token1 = generateLockToken();
      const token2 = generateLockToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate non-empty tokens', () => {
      const token = generateLockToken();
      expect(token.length).toBeGreaterThan(0);
    });
  });
});

describe('RedisClient', () => {
  let client: RedisClient;
  let mockRedis: RedisClientInterface;

  beforeEach(() => {
    client = new RedisClient();
    mockRedis = createMockRedisClient();
    client.setClient(mockRedis);
  });

  afterEach(async () => {
    await client.shutdown();
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const config = client.getConfig();
      expect(config).toEqual(DEFAULT_REDIS_CONFIG);
    });

    it('should accept custom config', () => {
      const customClient = new RedisClient({
        host: 'redis.example.com',
        port: 6380,
        keyPrefix: 'custom:',
      });
      const config = customClient.getConfig();
      expect(config.host).toBe('redis.example.com');
      expect(config.port).toBe(6380);
      expect(config.keyPrefix).toBe('custom:');
    });
  });

  describe('connection', () => {
    it('should connect successfully', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(client.getStatus()).toBe('connected');
    });

    it('should not reconnect when already connected', async () => {
      await client.connect();
      await client.connect();
      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect successfully', async () => {
      await client.connect();
      await client.disconnect();
      expect(client.getStatus()).toBe('disconnected');
    });

    it('should throw when connecting during shutdown', async () => {
      await client.connect();
      const shutdownPromise = client.shutdown();
      await expect(client.connect()).rejects.toThrow('shutting down');
      await shutdownPromise;
    });
  });

  describe('ping', () => {
    it('should return true when connected', async () => {
      await client.connect();
      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should execute operations', async () => {
      const result = await client.execute((c) => c.ping());
      expect(result).toBe('PONG');
    });

    it('should throw when not connected', async () => {
      await client.disconnect();
      await expect(client.execute((c) => c.ping())).rejects.toThrow('disconnected');
    });

    it('should timeout on long operations', async () => {
      const slowOperation = () =>
        new Promise<string>((resolve) => setTimeout(() => resolve('done'), 1000));

      await expect(
        client.execute(slowOperation, 50)
      ).rejects.toThrow('timeout');
    });
  });

  describe('events', () => {
    it('should emit connect event', async () => {
      const listener = vi.fn();
      client.on('connect', listener);
      await client.connect();
      expect(listener).toHaveBeenCalledWith('connect', undefined);
    });

    it('should emit ready event', async () => {
      const listener = vi.fn();
      client.on('ready', listener);
      await client.connect();
      expect(listener).toHaveBeenCalledWith('ready', undefined);
    });

    it('should emit disconnect event', async () => {
      const listener = vi.fn();
      await client.connect();
      client.on('disconnect', listener);
      await client.disconnect();
      expect(listener).toHaveBeenCalledWith('disconnect', undefined);
    });

    it('should remove event listeners', async () => {
      const listener = vi.fn();
      client.on('connect', listener);
      client.off('connect', listener);
      await client.connect();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('server info', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should get server info', async () => {
      const info = await client.getServerInfo();
      expect(info.redis_version).toBe('7.0.0');
      expect(info.connected_clients).toBe('1');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await client.connect();
      await client.shutdown();
      expect(client.getStatus()).toBe('disconnected');
    });

    it('should emit close event', async () => {
      const listener = vi.fn();
      client.on('close', listener);
      await client.connect();
      await client.shutdown();
      expect(listener).toHaveBeenCalled();
    });
  });
});

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: RedisClientInterface;

  beforeEach(() => {
    resetCacheService();
    service = new CacheService();
    mockRedis = createMockRedisClient();
    service.setRedisClient(mockRedis);
  });

  afterEach(async () => {
    if (service.isInitialized()) {
      await service.shutdown();
    }
    resetCacheService();
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(service.isInitialized()).toBe(false);
    });

    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
      expect(service.getStatus()).toBe('connected');
    });

    it('should not reinitialize', async () => {
      await service.initialize();
      await service.initialize();
      expect(mockRedis.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('get and set', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should set and get a value', async () => {
      await service.set('testKey', 'testValue');
      const result = await service.get<string>('testKey');
      expect(result).toBe('testValue');
    });

    it('should return null for missing key', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBe(null);
    });

    it('should handle complex objects', async () => {
      const obj = { name: 'test', values: [1, 2, 3], nested: { a: 1 } };
      await service.set('objKey', obj);
      const result = await service.get('objKey');
      expect(result).toEqual(obj);
    });

    it('should throw when not initialized', async () => {
      const uninitializedService = new CacheService();
      await expect(uninitializedService.get('key')).rejects.toThrow('not initialized');
    });

    it('should validate keys', async () => {
      await expect(service.get('')).rejects.toThrow('non-empty string');
    });
  });

  describe('set options', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should respect ifNotExists option', async () => {
      await service.set('key1', 'value1');
      const result = await service.set('key1', 'value2', { ifNotExists: true });
      expect(result).toBe(false);
      const value = await service.get('key1');
      expect(value).toBe('value1');
    });

    it('should respect ifExists option', async () => {
      const result = await service.set('newKey', 'value', { ifExists: true });
      expect(result).toBe(false);
    });

    it('should use namespace', async () => {
      await service.set('key', 'value1', { namespace: 'ns1:' });
      await service.set('key', 'value2', { namespace: 'ns2:' });

      const result1 = await service.get('key', { namespace: 'ns1:' });
      const result2 = await service.get('key', { namespace: 'ns2:' });

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should delete existing key', async () => {
      await service.set('key', 'value');
      const result = await service.delete('key');
      expect(result).toBe(true);
      expect(await service.get('key')).toBe(null);
    });

    it('should return false for non-existent key', async () => {
      const result = await service.delete('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return true for existing key', async () => {
      await service.set('key', 'value');
      const result = await service.exists('key');
      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const result = await service.exists('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('batch operations', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get multiple values', async () => {
      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      const result = await service.getMany<string>(['key1', 'key2', 'key3']);
      expect(result.found.get('key1')).toBe('value1');
      expect(result.found.get('key2')).toBe('value2');
      expect(result.missing).toContain('key3');
    });

    it('should set multiple values', async () => {
      const entries = new Map<string, string>([
        ['batch1', 'value1'],
        ['batch2', 'value2'],
      ]);

      await service.setMany(entries);

      const result1 = await service.get('batch1');
      const result2 = await service.get('batch2');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should delete multiple values', async () => {
      await service.set('del1', 'value1');
      await service.set('del2', 'value2');

      const count = await service.deleteMany(['del1', 'del2', 'del3']);
      expect(count).toBe(2);
    });
  });

  describe('getOrSet', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return existing value', async () => {
      await service.set('existing', 'cached');
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await service.getOrSet('existing', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory for missing value', async () => {
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await service.getOrSet('missing', factory);

      expect(result).toBe('fresh');
      expect(factory).toHaveBeenCalled();
    });

    it('should cache factory result', async () => {
      const factory = vi.fn().mockResolvedValue('fresh');

      await service.getOrSet('newKey', factory);
      const cached = await service.get('newKey');

      expect(cached).toBe('fresh');
    });
  });

  describe('getWithMetadata', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return value with metadata', async () => {
      await service.set('metaKey', 'metaValue');

      const result = await service.getWithMetadata('metaKey');

      expect(result).not.toBe(null);
      expect(result?.value).toBe('metaValue');
      expect(result?.metadata.key).toBe('metaKey');
      expect(result?.metadata.ttlSeconds).toBeDefined();
    });

    it('should return null for missing key', async () => {
      const result = await service.getWithMetadata('nonexistent');
      expect(result).toBe(null);
    });
  });

  describe('locking', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should acquire lock', async () => {
      const result = await service.acquireLock('resource1');
      expect(result.acquired).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should fail to acquire lock when held', async () => {
      const first = await service.acquireLock('resource2', { waitTimeMs: 0 });
      expect(first.acquired).toBe(true);

      const second = await service.acquireLock('resource2', { waitTimeMs: 100 });
      expect(second.acquired).toBe(false);
    });

    it('should release lock', async () => {
      const { token } = await service.acquireLock('resource3');
      const released = await service.releaseLock('resource3', token!);
      expect(released).toBe(true);
    });

    it('should not release lock with wrong token', async () => {
      await service.acquireLock('resource4');
      const released = await service.releaseLock('resource4', 'wrong-token');
      expect(released).toBe(false);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track hits and misses', async () => {
      await service.set('statKey', 'value');
      await service.get('statKey'); // hit
      await service.get('missing'); // miss

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should track operations', async () => {
      await service.set('key1', 'value');
      await service.get('key1');
      await service.delete('key1');

      const stats = service.getStats();
      expect(stats.totalSets).toBe(1);
      expect(stats.totalGets).toBe(1);
      expect(stats.totalDeletes).toBe(1);
    });

    it('should calculate hit rate', async () => {
      await service.set('key', 'value');
      await service.get('key'); // hit
      await service.get('key'); // hit
      await service.get('miss'); // miss

      const stats = service.getStats();
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should reset statistics', async () => {
      await service.set('key', 'value');
      await service.get('key');

      service.resetStats();
      const stats = service.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return healthy status', async () => {
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('connected');
      expect(health.serverInfo).toBeDefined();
    });

    it('should include server info', async () => {
      const health = await service.healthCheck();
      expect(health.serverInfo?.version).toBe('7.0.0');
    });
  });

  describe('tenant cache', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should create tenant cache', () => {
      const tenantCache = service.forTenant({ tenantId: 'tenant-123' });
      expect(tenantCache).toBeInstanceOf(TenantCache);
    });

    it('should isolate tenant data', async () => {
      const tenant1 = service.forTenant({ tenantId: 'tenant-1' });
      const tenant2 = service.forTenant({ tenantId: 'tenant-2' });

      await tenant1.set('key', 'value1');
      await tenant2.set('key', 'value2');

      expect(await tenant1.get('key')).toBe('value1');
      expect(await tenant2.get('key')).toBe('value2');
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
      await service.shutdown();
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getCacheService();
      const instance2 = getCacheService();
      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getCacheService();
      resetCacheService();
      const instance2 = getCacheService();
      expect(instance1).not.toBe(instance2);
    });
  });
});

describe('TenantCache', () => {
  let service: CacheService;
  let tenantCache: TenantCache;
  let mockRedis: RedisClientInterface;

  beforeEach(async () => {
    service = new CacheService();
    mockRedis = createMockRedisClient();
    service.setRedisClient(mockRedis);
    await service.initialize();
    tenantCache = service.forTenant({ tenantId: 'test-tenant' });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should get and set values', async () => {
    await tenantCache.set('key', 'value');
    const result = await tenantCache.get('key');
    expect(result).toBe('value');
  });

  it('should delete values', async () => {
    await tenantCache.set('key', 'value');
    await tenantCache.delete('key');
    const result = await tenantCache.get('key');
    expect(result).toBe(null);
  });

  it('should check existence', async () => {
    await tenantCache.set('key', 'value');
    expect(await tenantCache.exists('key')).toBe(true);
    expect(await tenantCache.exists('missing')).toBe(false);
  });

  it('should support batch operations', async () => {
    const entries = new Map([
      ['k1', 'v1'],
      ['k2', 'v2'],
    ]);
    await tenantCache.setMany(entries);

    const result = await tenantCache.getMany(['k1', 'k2']);
    expect(result.found.size).toBe(2);
  });

  it('should support getOrSet', async () => {
    const result = await tenantCache.getOrSet('newKey', async () => 'computed');
    expect(result).toBe('computed');

    const cached = await tenantCache.get('newKey');
    expect(cached).toBe('computed');
  });
});

describe('Types and Defaults', () => {
  it('should have correct default Redis config', () => {
    expect(DEFAULT_REDIS_CONFIG.host).toBe('localhost');
    expect(DEFAULT_REDIS_CONFIG.port).toBe(6379);
    expect(DEFAULT_REDIS_CONFIG.db).toBe(0);
    expect(DEFAULT_REDIS_CONFIG.keyPrefix).toBe('forge:');
  });

  it('should have correct default cache config', () => {
    expect(DEFAULT_CACHE_CONFIG.redis).toEqual(DEFAULT_REDIS_CONFIG);
    expect(DEFAULT_CACHE_CONFIG.defaultTtlSeconds).toBe(3600);
    expect(DEFAULT_CACHE_CONFIG.enableLogging).toBe(false);
  });

  it('should have correct default shutdown options', () => {
    expect(DEFAULT_SHUTDOWN_OPTIONS.timeoutMs).toBe(5000);
    expect(DEFAULT_SHUTDOWN_OPTIONS.forceAfterTimeout).toBe(true);
  });

  it('should have correct default lock options', () => {
    expect(DEFAULT_LOCK_OPTIONS.ttlMs).toBe(10000);
    expect(DEFAULT_LOCK_OPTIONS.waitTimeMs).toBe(5000);
    expect(DEFAULT_LOCK_OPTIONS.retryIntervalMs).toBe(100);
  });
});
