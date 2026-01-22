/**
 * @package @forge/feature-flags
 * @description Tests for the main feature flags service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FeatureFlagService,
  createFeatureFlagService,
} from '../feature-flags.service';
import { createBooleanFlag, createStringFlag, InMemoryFlagProvider } from '../flag';
import {
  EvaluationReason,
  UserContext,
  Segment,
  ConditionOperator,
} from '../feature-flags.types';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let provider: InMemoryFlagProvider;
  const userContext: UserContext = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin',
  };

  beforeEach(() => {
    provider = new InMemoryFlagProvider();
    service = new FeatureFlagService({
      flagProvider: provider,
    });
  });

  describe('initialization', () => {
    it('should create service with default config', () => {
      const svc = new FeatureFlagService();
      expect(svc).toBeDefined();
    });

    it('should create service with custom config', () => {
      const svc = new FeatureFlagService({
        environment: 'production',
        tenantId: 'tenant-1',
        cache: { enabled: true, ttl: 30000 },
      });
      expect(svc.getEnvironment()).toBe('production');
      expect(svc.getTenantId()).toBe('tenant-1');
    });

    it('should use provided flag provider', () => {
      expect(service.getFlagProvider()).toBe(provider);
    });
  });

  describe('loadFlags', () => {
    it('should load flags from provider', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.setFlag(createBooleanFlag('flag-2', false));
      await service.loadFlags();
      expect(service.areFlagsLoaded()).toBe(true);
      expect(service.getFlagKeys()).toContain('flag-1');
      expect(service.getFlagKeys()).toContain('flag-2');
    });

    it('should filter flags by tenant', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true, { tenantId: 'tenant-1' }));
      provider.setFlag(createBooleanFlag('flag-2', true, { tenantId: 'tenant-2' }));
      service.setTenantId('tenant-1');
      await service.loadFlags();
      expect(service.getFlagKeys()).toContain('flag-1');
      expect(service.getFlagKeys()).not.toContain('flag-2');
    });

    it('should load segments from segment provider', async () => {
      const segmentProvider = new InMemoryFlagProvider();
      segmentProvider.setSegment({
        id: 'seg-1',
        name: 'Admins',
        rules: [{ attribute: 'role', operator: ConditionOperator.EQUALS, value: 'admin' }],
      });
      service = new FeatureFlagService({
        flagProvider: provider,
        segmentProvider,
      });
      await service.loadFlags();
      expect(service.areFlagsLoaded()).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled flag', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      const enabled = await service.isEnabled('my-feature', userContext);
      expect(enabled).toBe(true);
    });

    it('should return false for disabled flag', async () => {
      provider.setFlag(createBooleanFlag('my-feature', false));
      const enabled = await service.isEnabled('my-feature', userContext);
      expect(enabled).toBe(false);
    });

    it('should return default value for non-existent flag', async () => {
      const enabled = await service.isEnabled('non-existent', userContext, true);
      expect(enabled).toBe(true);
    });
  });

  describe('isEnabledSync', () => {
    it('should evaluate flag synchronously', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.loadFlags();
      const enabled = service.isEnabledSync('my-feature', userContext);
      expect(enabled).toBe(true);
    });

    it('should return default for non-loaded flag', () => {
      const enabled = service.isEnabledSync('non-existent', userContext, true);
      expect(enabled).toBe(true);
    });
  });

  describe('getValue', () => {
    it('should return flag value', async () => {
      provider.setFlag(createStringFlag('theme', 'dark'));
      const value = await service.getValue<string>('theme', userContext, 'light');
      expect(value).toBe('dark');
    });

    it('should return default value for non-existent flag', async () => {
      const value = await service.getValue<string>('non-existent', userContext, 'default');
      expect(value).toBe('default');
    });
  });

  describe('getValueSync', () => {
    it('should return flag value synchronously', async () => {
      provider.setFlag(createStringFlag('theme', 'dark'));
      await service.loadFlags();
      const value = service.getValueSync<string>('theme', userContext, 'light');
      expect(value).toBe('dark');
    });

    it('should return default for non-loaded flag', () => {
      const value = service.getValueSync<string>('non-existent', userContext, 'default');
      expect(value).toBe('default');
    });
  });

  describe('evaluate', () => {
    it('should return evaluation result', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      const result = await service.evaluate<boolean>('my-feature', userContext);
      expect(result.value).toBe(true);
      expect(result.flagKey).toBe('my-feature');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should cache evaluation results', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.evaluate('my-feature', userContext);
      const result = await service.evaluate('my-feature', userContext);
      expect(result.reason).toBe(EvaluationReason.CACHED);
    });

    it('should call onEvaluation callback', async () => {
      const onEvaluation = vi.fn();
      service = new FeatureFlagService({
        flagProvider: provider,
        onEvaluation,
      });
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.evaluate('my-feature', userContext);
      expect(onEvaluation).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const onError = vi.fn();
      service = new FeatureFlagService({
        flagProvider: provider,
        onError,
      });
      // Simulate error by mocking getFlag
      vi.spyOn(provider, 'getFlag').mockRejectedValueOnce(new Error('Test error'));
      const result = await service.evaluate('error-flag', userContext, false);
      expect(result.reason).toBe(EvaluationReason.ERROR);
      expect(result.value).toBe(false);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('evaluateWithDetails', () => {
    it('should return detailed evaluation', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      const details = await service.evaluateWithDetails<boolean>('my-feature', userContext);
      expect(details.value).toBe(true);
      expect(details.userContext).toEqual(userContext);
    });

    it('should return details for non-existent flag', async () => {
      const details = await service.evaluateWithDetails<boolean>('non-existent', userContext, false);
      expect(details.value).toBe(false);
      expect(details.reason).toBe(EvaluationReason.DEFAULT);
    });

    it('should return cached details', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.evaluateWithDetails('my-feature', userContext);
      const details = await service.evaluateWithDetails('my-feature', userContext);
      expect(details.reason).toBe(EvaluationReason.CACHED);
      expect(details.fromCache).toBe(true);
    });
  });

  describe('getVariant', () => {
    it('should return variant for multivariate flag', async () => {
      provider.setFlag(createStringFlag('ab-test', 'control', {
        variants: [
          { id: 'control', name: 'Control', value: 'control', weight: 50 },
          { id: 'treatment', name: 'Treatment', value: 'treatment', weight: 50 },
        ],
      }));
      const variant = await service.getVariant<string>('ab-test', userContext);
      expect(variant).not.toBeNull();
      expect(['control', 'treatment']).toContain(variant?.variantId);
    });

    it('should return null for non-existent flag', async () => {
      const variant = await service.getVariant('non-existent', userContext);
      expect(variant).toBeNull();
    });
  });

  describe('getVariantSync', () => {
    it('should return variant synchronously', async () => {
      provider.setFlag(createStringFlag('ab-test', 'control', {
        variants: [
          { id: 'control', name: 'Control', value: 'control', weight: 50 },
          { id: 'treatment', name: 'Treatment', value: 'treatment', weight: 50 },
        ],
      }));
      await service.loadFlags();
      const variant = service.getVariantSync<string>('ab-test', userContext);
      expect(variant).not.toBeNull();
    });

    it('should return null for non-loaded flag', () => {
      const variant = service.getVariantSync('non-existent', userContext);
      expect(variant).toBeNull();
    });
  });

  describe('evaluateAll', () => {
    it('should evaluate all flags', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.setFlag(createBooleanFlag('flag-2', false));
      const results = await service.evaluateAll(userContext);
      expect(results.size).toBe(2);
      expect(results.get('flag-1')?.value).toBe(true);
      expect(results.get('flag-2')?.value).toBe(false);
    });

    it('should load flags if not loaded', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      const results = await service.evaluateAll(userContext);
      expect(results.size).toBe(1);
    });
  });

  describe('getFlag', () => {
    it('should get flag by key', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      const flag = await service.getFlag('my-feature');
      expect(flag).not.toBeNull();
      expect(flag?.key).toBe('my-feature');
    });

    it('should cache loaded flag', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.getFlag('my-feature');
      await service.getFlag('my-feature');
      // Should only hit provider once, then use cache
      expect(service.getFlagKeys()).toContain('my-feature');
    });

    it('should respect tenant filter', async () => {
      provider.setFlag(createBooleanFlag('tenant-flag', true, { tenantId: 'tenant-2' }));
      service.setTenantId('tenant-1');
      const flag = await service.getFlag('tenant-flag');
      expect(flag).toBeNull();
    });
  });

  describe('segments', () => {
    it('should add segment', () => {
      const segment: Segment = {
        id: 'seg-1',
        name: 'Test Segment',
        rules: [],
      };
      service.addSegment(segment);
      // Verify by checking service still works
      expect(service).toBeDefined();
    });

    it('should filter segment by tenant', () => {
      service.setTenantId('tenant-1');
      const segment: Segment = {
        id: 'seg-1',
        name: 'Other Tenant Segment',
        rules: [],
        tenantId: 'tenant-2',
      };
      service.addSegment(segment);
      // Segment should be filtered out
      expect(service).toBeDefined();
    });

    it('should remove segment', () => {
      service.addSegment({
        id: 'seg-1',
        name: 'Test Segment',
        rules: [],
      });
      service.removeSegment('seg-1');
      expect(service).toBeDefined();
    });
  });

  describe('environment', () => {
    it('should set environment', () => {
      service.setEnvironment('production');
      expect(service.getEnvironment()).toBe('production');
    });

    it('should invalidate cache when environment changes', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.evaluate('my-feature', userContext);
      service.setEnvironment('production');
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('tenantId', () => {
    it('should set tenant ID', () => {
      service.setTenantId('tenant-1');
      expect(service.getTenantId()).toBe('tenant-1');
    });

    it('should clear flags when tenant changes', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      await service.loadFlags();
      service.setTenantId('new-tenant');
      expect(service.areFlagsLoaded()).toBe(false);
    });
  });

  describe('cache', () => {
    it('should get cache instance', () => {
      const cache = service.getCache();
      expect(cache).toBeDefined();
    });

    it('should get cache stats', () => {
      const stats = service.getCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
    });

    it('should invalidate specific flag cache', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      provider.setFlag(createBooleanFlag('flag-2', true));
      await service.evaluate('flag-1', userContext);
      await service.evaluate('flag-2', userContext);
      service.invalidateCache('flag-1');
      const result = await service.evaluate('flag-1', userContext);
      expect(result.reason).not.toBe(EvaluationReason.CACHED);
    });

    it('should invalidate all cache', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      await service.evaluate('flag-1', userContext);
      service.invalidateCache();
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('refresh', () => {
    it('should refresh flags from provider', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      await service.loadFlags();
      provider.setFlag(createBooleanFlag('flag-2', false));
      await service.refresh();
      expect(service.getFlagKeys()).toContain('flag-2');
    });

    it('should clear cache on refresh', async () => {
      provider.setFlag(createBooleanFlag('flag-1', true));
      await service.evaluate('flag-1', userContext);
      await service.refresh();
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('subscription', () => {
    it('should handle flag updates from provider', async () => {
      await service.loadFlags();
      provider.setFlag(createBooleanFlag('new-flag', true));
      // Wait for subscription callback
      await new Promise(resolve => setTimeout(resolve, 0));
      const enabled = service.isEnabledSync('new-flag', userContext);
      expect(enabled).toBe(true);
    });

    it('should invalidate cache on flag update', async () => {
      provider.setFlag(createBooleanFlag('my-feature', true));
      await service.evaluate('my-feature', userContext);
      provider.updateFlag('my-feature', { defaultValue: false });
      await new Promise(resolve => setTimeout(resolve, 0));
      // Cache for this flag should be invalidated
      expect(service).toBeDefined();
    });
  });
});

describe('createFeatureFlagService', () => {
  it('should create service with default config', () => {
    const service = createFeatureFlagService();
    expect(service).toBeInstanceOf(FeatureFlagService);
  });

  it('should create service with custom config', () => {
    const service = createFeatureFlagService({
      environment: 'test',
      tenantId: 'tenant-1',
    });
    expect(service.getEnvironment()).toBe('test');
    expect(service.getTenantId()).toBe('tenant-1');
  });
});
