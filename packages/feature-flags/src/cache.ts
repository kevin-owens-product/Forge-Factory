/**
 * @package @forge/feature-flags
 * @description Flag caching with TTL support
 */

import {
  CacheConfig,
  CachedFlag,
  FlagValue,
  EvaluationReason,
  UserContext,
} from './feature-flags.types';

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 60000, // 1 minute
  maxSize: 1000,
  keyPrefix: 'ff',
};

/**
 * Generate a hash for user context
 */
export function hashUserContext(context: UserContext): string {
  const parts = [
    context.id,
    context.tenantId || '',
    context.role ? (Array.isArray(context.role) ? context.role.join(',') : context.role) : '',
    context.groups?.join(',') || '',
    context.isBeta ? '1' : '0',
    context.isInternal ? '1' : '0',
  ];

  const str = parts.join(':');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate cache key
 */
export function generateCacheKey(
  flagKey: string,
  userHash?: string,
  prefix?: string
): string {
  const parts = [prefix || 'ff', flagKey];
  if (userHash) {
    parts.push(userHash);
  }
  return parts.join(':');
}

/**
 * In-memory cache for flag evaluations
 */
export class FlagCache {
  private cache: Map<string, CachedFlag> = new Map();
  private config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Get cached value
   */
  get<T extends FlagValue>(
    flagKey: string,
    userContext?: UserContext
  ): CachedFlag<T> | null {
    if (!this.config.enabled) {
      return null;
    }

    const userHash = userContext ? hashUserContext(userContext) : undefined;
    const cacheKey = generateCacheKey(flagKey, userHash, this.config.keyPrefix);
    const cached = this.cache.get(cacheKey) as CachedFlag<T> | undefined;

    if (!cached) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (cached.expiresAt < new Date()) {
      this.cache.delete(cacheKey);
      this.misses++;
      return null;
    }

    this.hits++;
    return cached;
  }

  /**
   * Set cached value
   */
  set<T extends FlagValue>(
    flagKey: string,
    value: T,
    reason: EvaluationReason,
    userContext?: UserContext,
    ttl?: number
  ): void {
    if (!this.config.enabled) {
      return;
    }

    // Check max size
    if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const userHash = userContext ? hashUserContext(userContext) : undefined;
    const cacheKey = generateCacheKey(flagKey, userHash, this.config.keyPrefix);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl ?? this.config.ttl));

    const cached: CachedFlag<T> = {
      value,
      reason,
      cachedAt: now,
      expiresAt,
      flagKey,
      userHash,
    };

    this.cache.set(cacheKey, cached);
  }

  /**
   * Invalidate a specific flag
   */
  invalidate(flagKey: string): void {
    const prefix = `${this.config.keyPrefix || 'ff'}:${flagKey}`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all cached values
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Invalidate by user
   */
  invalidateByUser(userContext: UserContext): void {
    const userHash = hashUserContext(userContext);
    for (const [key, cached] of this.cache.entries()) {
      if (cached.userHash === userHash) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries
   */
  private evictOldest(): void {
    const entries = [...this.cache.entries()];
    entries.sort((a, b) => a[1].cachedAt.getTime() - b[1].cachedAt.getTime());

    // Remove oldest 10%
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    enabled: boolean;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      enabled: this.config.enabled,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Clean expired entries
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get config
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    if (!this.config.enabled) {
      this.invalidateAll();
    }
  }
}
