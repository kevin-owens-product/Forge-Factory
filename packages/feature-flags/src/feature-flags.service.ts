/**
 * @package @forge/feature-flags
 * @description Main feature flags service
 */

import {
  FeatureFlag,
  FlagValue,
  UserContext,
  EvaluationResult,
  EvaluationDetails,
  EvaluationReason,
  VariantResult,
  FeatureFlagConfig,
  Segment,
  FlagProvider,
  SegmentProvider,
} from './feature-flags.types';
import { FlagCache, DEFAULT_CACHE_CONFIG } from './cache';
import { FlagEvaluator, InMemoryFlagProvider } from './flag';

/**
 * Feature flags service
 */
export class FeatureFlagService {
  private evaluator: FlagEvaluator;
  private cache: FlagCache;
  private flagProvider: FlagProvider;
  private segmentProvider?: SegmentProvider;
  private config: FeatureFlagConfig;
  private environment?: string;
  private tenantId?: string;
  private flagsLoaded = false;
  private loadedFlags: Map<string, FeatureFlag> = new Map();

  constructor(config: FeatureFlagConfig = {}) {
    this.config = config;
    this.environment = config.environment;
    this.tenantId = config.tenantId;
    this.cache = new FlagCache(config.cache || DEFAULT_CACHE_CONFIG);
    this.evaluator = new FlagEvaluator({ environment: config.environment });
    this.flagProvider = config.flagProvider || new InMemoryFlagProvider();
    this.segmentProvider = config.segmentProvider;

    // Subscribe to flag updates if provider supports it
    if (this.flagProvider.subscribe) {
      this.flagProvider.subscribe(flags => {
        this.handleFlagUpdates(flags);
      });
    }
  }

  /**
   * Load all flags from provider
   */
  async loadFlags(): Promise<void> {
    const flags = await this.flagProvider.getAllFlags();
    this.loadedFlags.clear();

    for (const flag of flags) {
      // Filter by tenant if configured
      if (this.tenantId && flag.tenantId && flag.tenantId !== this.tenantId) {
        continue;
      }
      this.loadedFlags.set(flag.key, flag);
    }

    // Load segments if provider exists
    if (this.segmentProvider) {
      const segments = await this.segmentProvider.getAllSegments();
      for (const segment of segments) {
        if (this.tenantId && segment.tenantId && segment.tenantId !== this.tenantId) {
          continue;
        }
        this.evaluator.addSegment(segment);
      }
    }

    this.flagsLoaded = true;
  }

  /**
   * Handle flag updates from provider
   */
  private handleFlagUpdates(flags: FeatureFlag[]): void {
    for (const flag of flags) {
      if (this.tenantId && flag.tenantId && flag.tenantId !== this.tenantId) {
        continue;
      }

      // Invalidate cache for updated flag
      this.cache.invalidate(flag.key);
      this.loadedFlags.set(flag.key, flag);
    }
  }

  /**
   * Get flag by key
   */
  async getFlag<T extends FlagValue>(key: string): Promise<FeatureFlag<T> | null> {
    // Check loaded flags first
    const loaded = this.loadedFlags.get(key) as FeatureFlag<T> | undefined;
    if (loaded) return loaded;

    // Load from provider
    const flag = await this.flagProvider.getFlag<T>(key);
    if (flag && (!this.tenantId || !flag.tenantId || flag.tenantId === this.tenantId)) {
      this.loadedFlags.set(key, flag);
      return flag;
    }

    return null;
  }

  /**
   * Check if a boolean flag is enabled
   */
  async isEnabled(
    flagKey: string,
    userContext?: UserContext,
    defaultValue = false
  ): Promise<boolean> {
    const result = await this.evaluate<boolean>(flagKey, userContext, defaultValue);
    return result.value;
  }

  /**
   * Evaluate a flag synchronously (uses loaded flags)
   */
  isEnabledSync(
    flagKey: string,
    userContext?: UserContext,
    defaultValue = false
  ): boolean {
    const flag = this.loadedFlags.get(flagKey);
    if (!flag) return defaultValue;

    const result = this.evaluator.evaluate(flag, userContext, defaultValue);
    return Boolean(result.value);
  }

  /**
   * Get a flag value
   */
  async getValue<T extends FlagValue>(
    flagKey: string,
    userContext?: UserContext,
    defaultValue?: T
  ): Promise<T> {
    const result = await this.evaluate<T>(flagKey, userContext, defaultValue);
    return result.value;
  }

  /**
   * Get a flag value synchronously
   */
  getValueSync<T extends FlagValue>(
    flagKey: string,
    userContext?: UserContext,
    defaultValue?: T
  ): T {
    const flag = this.loadedFlags.get(flagKey) as FeatureFlag<T> | undefined;
    if (!flag) return defaultValue as T;

    const result = this.evaluator.evaluate(flag, userContext, defaultValue);
    return result.value;
  }

  /**
   * Evaluate a flag
   */
  async evaluate<T extends FlagValue>(
    flagKey: string,
    userContext?: UserContext,
    defaultValue?: T
  ): Promise<EvaluationResult<T>> {
    const startTime = performance.now();

    try {
      // Check cache
      const cached = this.cache.get<T>(flagKey, userContext);
      if (cached) {
        const result: EvaluationResult<T> = {
          flagKey,
          value: cached.value,
          reason: EvaluationReason.CACHED,
          timestamp: new Date(),
          evaluationTime: performance.now() - startTime,
        };
        this.config.onEvaluation?.(result);
        return result;
      }

      // Get flag
      const flag = await this.getFlag<T>(flagKey);
      if (!flag) {
        const result: EvaluationResult<T> = {
          flagKey,
          value: defaultValue as T,
          reason: EvaluationReason.DEFAULT,
          timestamp: new Date(),
          evaluationTime: performance.now() - startTime,
        };
        return result;
      }

      // Evaluate
      const result = this.evaluator.evaluate(flag, userContext, defaultValue);

      // Cache result
      this.cache.set(flagKey, result.value, result.reason, userContext);

      // Notify
      this.config.onEvaluation?.(result);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.onError?.(err, flagKey);

      return {
        flagKey,
        value: defaultValue as T,
        reason: EvaluationReason.ERROR,
        timestamp: new Date(),
        evaluationTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Evaluate with details
   */
  async evaluateWithDetails<T extends FlagValue>(
    flagKey: string,
    userContext?: UserContext,
    defaultValue?: T
  ): Promise<EvaluationDetails<T>> {
    const flag = await this.getFlag<T>(flagKey);
    if (!flag) {
      return {
        flagKey,
        value: defaultValue as T,
        reason: EvaluationReason.DEFAULT,
        timestamp: new Date(),
        flag: undefined as unknown as FeatureFlag<T>,
        userContext,
        fromCache: false,
      };
    }

    // Check cache
    const cached = this.cache.get<T>(flagKey, userContext);
    if (cached) {
      return {
        flagKey,
        value: cached.value,
        reason: EvaluationReason.CACHED,
        timestamp: new Date(),
        flag,
        userContext,
        fromCache: true,
      };
    }

    const details = this.evaluator.evaluateWithDetails(flag, userContext, defaultValue);

    // Cache result
    this.cache.set(flagKey, details.value, details.reason, userContext);

    return details;
  }

  /**
   * Get variant for multivariate flag
   */
  async getVariant<T extends FlagValue>(
    flagKey: string,
    userContext: UserContext
  ): Promise<VariantResult<T> | null> {
    const flag = await this.getFlag<T>(flagKey);
    if (!flag) return null;

    return this.evaluator.getVariant(flag, userContext);
  }

  /**
   * Get variant synchronously
   */
  getVariantSync<T extends FlagValue>(
    flagKey: string,
    userContext: UserContext
  ): VariantResult<T> | null {
    const flag = this.loadedFlags.get(flagKey) as FeatureFlag<T> | undefined;
    if (!flag) return null;

    return this.evaluator.getVariant(flag, userContext);
  }

  /**
   * Evaluate multiple flags
   */
  async evaluateAll<T extends FlagValue>(
    userContext?: UserContext
  ): Promise<Map<string, EvaluationResult<T>>> {
    const results = new Map<string, EvaluationResult<T>>();

    if (!this.flagsLoaded) {
      await this.loadFlags();
    }

    for (const [key] of this.loadedFlags) {
      const result = await this.evaluate<T>(key, userContext);
      results.set(key, result);
    }

    return results;
  }

  /**
   * Get all flag keys
   */
  getFlagKeys(): string[] {
    return [...this.loadedFlags.keys()];
  }

  /**
   * Add segment
   */
  addSegment(segment: Segment): void {
    if (this.tenantId && segment.tenantId && segment.tenantId !== this.tenantId) {
      return;
    }
    this.evaluator.addSegment(segment);
  }

  /**
   * Remove segment
   */
  removeSegment(segmentId: string): void {
    this.evaluator.removeSegment(segmentId);
  }

  /**
   * Set environment
   */
  setEnvironment(environment: string): void {
    this.environment = environment;
    this.evaluator.setEnvironment(environment);
    this.cache.invalidateAll();
  }

  /**
   * Get environment
   */
  getEnvironment(): string | undefined {
    return this.environment;
  }

  /**
   * Set tenant ID
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
    this.cache.invalidateAll();
    this.loadedFlags.clear();
    this.flagsLoaded = false;
  }

  /**
   * Get tenant ID
   */
  getTenantId(): string | undefined {
    return this.tenantId;
  }

  /**
   * Get cache instance
   */
  getCache(): FlagCache {
    return this.cache;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): ReturnType<FlagCache['getStats']> {
    return this.cache.getStats();
  }

  /**
   * Invalidate cache
   */
  invalidateCache(flagKey?: string): void {
    if (flagKey) {
      this.cache.invalidate(flagKey);
    } else {
      this.cache.invalidateAll();
    }
  }

  /**
   * Refresh flags from provider
   */
  async refresh(): Promise<void> {
    this.cache.invalidateAll();
    await this.loadFlags();
  }

  /**
   * Check if flags are loaded
   */
  areFlagsLoaded(): boolean {
    return this.flagsLoaded;
  }

  /**
   * Get flag provider
   */
  getFlagProvider(): FlagProvider {
    return this.flagProvider;
  }
}

/**
 * Create a feature flag service
 */
export function createFeatureFlagService(
  config: FeatureFlagConfig = {}
): FeatureFlagService {
  return new FeatureFlagService(config);
}
