/**
 * @package @forge/feature-flags
 * @description Tests for multivariate variants
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateVariantWeights,
  normalizeVariantWeights,
  selectVariant,
  getVariantById,
  createABTest,
  createMultivariateTest,
  VariantManager,
} from '../variants';
import { Variant, UserContext, EvaluationReason } from '../feature-flags.types';

describe('validateVariantWeights', () => {
  it('should return true for empty variants', () => {
    expect(validateVariantWeights([])).toBe(true);
  });

  it('should return true when weights sum to 100', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 50 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 50 },
    ];
    expect(validateVariantWeights(variants)).toBe(true);
  });

  it('should return false when weights do not sum to 100', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 40 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 40 },
    ];
    expect(validateVariantWeights(variants)).toBe(false);
  });

  it('should handle single variant with 100% weight', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 100 },
    ];
    expect(validateVariantWeights(variants)).toBe(true);
  });
});

describe('normalizeVariantWeights', () => {
  it('should return empty array for empty input', () => {
    expect(normalizeVariantWeights([])).toEqual([]);
  });

  it('should normalize weights to sum to 100', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 40 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 60 },
    ];
    const normalized = normalizeVariantWeights(variants);
    const sum = normalized.reduce((s, v) => s + v.weight, 0);
    expect(sum).toBe(100);
  });

  it('should distribute evenly when all weights are zero', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 0 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 0 },
    ];
    const normalized = normalizeVariantWeights(variants);
    expect(normalized[0].weight).toBe(50);
    expect(normalized[1].weight).toBe(50);
  });

  it('should preserve proportions when normalizing', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 20 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 80 },
    ];
    const normalized = normalizeVariantWeights(variants);
    expect(normalized[0].weight).toBe(20);
    expect(normalized[1].weight).toBe(80);
  });

  it('should handle non-100 sums', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 10 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 40 },
    ];
    const normalized = normalizeVariantWeights(variants);
    expect(normalized[0].weight).toBe(20);
    expect(normalized[1].weight).toBe(80);
  });
});

describe('selectVariant', () => {
  const userContext: UserContext = { id: 'user-123' };

  it('should return null for empty variants', () => {
    const result = selectVariant([], userContext, 'test-flag');
    expect(result).toBeNull();
  });

  it('should return a variant', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 50 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 50 },
    ];
    const result = selectVariant(variants, userContext, 'test-flag');
    expect(result).not.toBeNull();
    expect(['v1', 'v2']).toContain(result?.variantId);
    expect(result?.reason).toBe(EvaluationReason.VARIANT);
  });

  it('should return consistent variant for same user', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 50 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 50 },
    ];
    const result1 = selectVariant(variants, userContext, 'test-flag');
    const result2 = selectVariant(variants, userContext, 'test-flag');
    expect(result1?.variantId).toBe(result2?.variantId);
  });

  it('should select single variant with 100% weight', () => {
    const variants: Variant<string>[] = [
      { id: 'only', name: 'Only Variant', value: 'only', weight: 100 },
    ];
    const result = selectVariant(variants, userContext, 'test-flag');
    expect(result?.variantId).toBe('only');
  });

  it('should normalize variants if weights are invalid', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 30 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 30 },
    ];
    const result = selectVariant(variants, userContext, 'test-flag');
    expect(result).not.toBeNull();
  });

  it('should include variant name in result', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Control', value: 'control', weight: 100 },
    ];
    const result = selectVariant(variants, userContext, 'test-flag');
    expect(result?.name).toBe('Control');
  });

  it('should include variant value in result', () => {
    const variants: Variant<string>[] = [
      { id: 'v1', name: 'Control', value: 'control-value', weight: 100 },
    ];
    const result = selectVariant(variants, userContext, 'test-flag');
    expect(result?.value).toBe('control-value');
  });
});

describe('getVariantById', () => {
  const variants: Variant<string>[] = [
    { id: 'v1', name: 'Variant 1', value: 'a', weight: 50 },
    { id: 'v2', name: 'Variant 2', value: 'b', weight: 50 },
  ];

  it('should return variant by ID', () => {
    const variant = getVariantById(variants, 'v1');
    expect(variant).not.toBeNull();
    expect(variant?.id).toBe('v1');
    expect(variant?.name).toBe('Variant 1');
  });

  it('should return null for non-existent ID', () => {
    const variant = getVariantById(variants, 'non-existent');
    expect(variant).toBeNull();
  });

  it('should return null for empty variants', () => {
    const variant = getVariantById([], 'v1');
    expect(variant).toBeNull();
  });
});

describe('createABTest', () => {
  it('should create A/B test with default 50/50 split', () => {
    const variants = createABTest('control', 'treatment');
    expect(variants).toHaveLength(2);
    expect(variants[0].id).toBe('control');
    expect(variants[0].weight).toBe(50);
    expect(variants[1].id).toBe('treatment');
    expect(variants[1].weight).toBe(50);
  });

  it('should create A/B test with custom split', () => {
    const variants = createABTest('control', 'treatment', 30);
    expect(variants[0].weight).toBe(70);
    expect(variants[1].weight).toBe(30);
  });

  it('should use correct names', () => {
    const variants = createABTest('old', 'new');
    expect(variants[0].name).toBe('Control');
    expect(variants[1].name).toBe('Treatment');
  });

  it('should use provided values', () => {
    const variants = createABTest({ theme: 'light' }, { theme: 'dark' });
    expect(variants[0].value).toEqual({ theme: 'light' });
    expect(variants[1].value).toEqual({ theme: 'dark' });
  });
});

describe('createMultivariateTest', () => {
  it('should create multivariate test', () => {
    const variants = createMultivariateTest([
      { name: 'Red', value: 'red', weight: 33 },
      { name: 'Blue', value: 'blue', weight: 33 },
      { name: 'Green', value: 'green', weight: 34 },
    ]);
    expect(variants).toHaveLength(3);
    expect(variants[0].id).toBe('variant-0');
    expect(variants[1].id).toBe('variant-1');
    expect(variants[2].id).toBe('variant-2');
  });

  it('should preserve names and values', () => {
    const variants = createMultivariateTest([
      { name: 'Option A', value: 'a', weight: 50 },
      { name: 'Option B', value: 'b', weight: 50 },
    ]);
    expect(variants[0].name).toBe('Option A');
    expect(variants[0].value).toBe('a');
  });

  it('should preserve weights', () => {
    const variants = createMultivariateTest([
      { name: 'A', value: 'a', weight: 20 },
      { name: 'B', value: 'b', weight: 80 },
    ]);
    expect(variants[0].weight).toBe(20);
    expect(variants[1].weight).toBe(80);
  });
});

describe('VariantManager', () => {
  let manager: VariantManager<string>;
  const userContext: UserContext = { id: 'user-123' };

  beforeEach(() => {
    manager = new VariantManager('test-flag', [
      { id: 'v1', name: 'Variant 1', value: 'a', weight: 50 },
      { id: 'v2', name: 'Variant 2', value: 'b', weight: 50 },
    ]);
  });

  describe('getVariants', () => {
    it('should return all variants', () => {
      const variants = manager.getVariants();
      expect(variants).toHaveLength(2);
    });

    it('should return a copy', () => {
      const variants = manager.getVariants();
      variants.push({ id: 'v3', name: 'Variant 3', value: 'c', weight: 0 });
      expect(manager.getVariants()).toHaveLength(2);
    });
  });

  describe('addVariant', () => {
    it('should add a variant', () => {
      manager.addVariant({ id: 'v3', name: 'Variant 3', value: 'c', weight: 30 });
      expect(manager.getVariants()).toHaveLength(3);
    });

    it('should renormalize weights after adding', () => {
      manager.addVariant({ id: 'v3', name: 'Variant 3', value: 'c', weight: 50 });
      const sum = manager.getVariants().reduce((s, v) => s + v.weight, 0);
      expect(sum).toBeCloseTo(100);
    });
  });

  describe('removeVariant', () => {
    it('should remove a variant', () => {
      const removed = manager.removeVariant('v1');
      expect(removed).toBe(true);
      expect(manager.getVariants()).toHaveLength(1);
    });

    it('should return false for non-existent variant', () => {
      const removed = manager.removeVariant('non-existent');
      expect(removed).toBe(false);
    });

    it('should renormalize weights after removing', () => {
      manager.removeVariant('v1');
      const remaining = manager.getVariants();
      expect(remaining[0].weight).toBe(100);
    });
  });

  describe('updateVariant', () => {
    it('should update a variant', () => {
      const updated = manager.updateVariant('v1', { name: 'Updated Variant 1' });
      expect(updated).toBe(true);
      expect(manager.getVariant('v1')?.name).toBe('Updated Variant 1');
    });

    it('should return false for non-existent variant', () => {
      const updated = manager.updateVariant('non-existent', { name: 'Test' });
      expect(updated).toBe(false);
    });

    it('should renormalize weights when weight is updated', () => {
      manager.updateVariant('v1', { weight: 20 });
      const sum = manager.getVariants().reduce((s, v) => s + v.weight, 0);
      expect(sum).toBeCloseTo(100);
    });

    it('should not renormalize when updating other properties', () => {
      const originalWeights = manager.getVariants().map(v => v.weight);
      manager.updateVariant('v1', { name: 'New Name' });
      const newWeights = manager.getVariants().map(v => v.weight);
      expect(newWeights).toEqual(originalWeights);
    });
  });

  describe('setWeights', () => {
    it('should set weights for variants', () => {
      manager.setWeights({ v1: 30, v2: 70 });
      expect(manager.getVariant('v1')?.weight).toBe(30);
      expect(manager.getVariant('v2')?.weight).toBe(70);
    });

    it('should normalize after setting weights', () => {
      manager.setWeights({ v1: 10, v2: 40 });
      const sum = manager.getVariants().reduce((s, v) => s + v.weight, 0);
      expect(sum).toBeCloseTo(100);
    });

    it('should ignore unknown variant IDs', () => {
      manager.setWeights({ v1: 30, unknown: 100 });
      expect(manager.getVariants()).toHaveLength(2);
    });
  });

  describe('selectForUser', () => {
    it('should select variant for user', () => {
      const result = manager.selectForUser(userContext);
      expect(result).not.toBeNull();
      expect(['v1', 'v2']).toContain(result?.variantId);
    });

    it('should return consistent result for same user', () => {
      const result1 = manager.selectForUser(userContext);
      const result2 = manager.selectForUser(userContext);
      expect(result1?.variantId).toBe(result2?.variantId);
    });
  });

  describe('getVariant', () => {
    it('should get variant by ID', () => {
      const variant = manager.getVariant('v1');
      expect(variant).not.toBeNull();
      expect(variant?.id).toBe('v1');
    });

    it('should return null for non-existent ID', () => {
      const variant = manager.getVariant('non-existent');
      expect(variant).toBeNull();
    });
  });

  describe('isValid', () => {
    it('should return true when weights are valid', () => {
      expect(manager.isValid()).toBe(true);
    });

    it('should return true for normalized variants', () => {
      manager.setWeights({ v1: 10, v2: 20 });
      expect(manager.isValid()).toBe(true);
    });
  });

  describe('getDistribution', () => {
    it('should return distribution info', () => {
      const distribution = manager.getDistribution();
      expect(distribution).toHaveLength(2);
      expect(distribution[0]).toEqual({
        variantId: 'v1',
        name: 'Variant 1',
        weight: 50,
      });
    });
  });

  describe('initialization', () => {
    it('should normalize weights on initialization', () => {
      const mgr = new VariantManager('test', [
        { id: 'v1', name: 'V1', value: 'a', weight: 10 },
        { id: 'v2', name: 'V2', value: 'b', weight: 40 },
      ]);
      const sum = mgr.getVariants().reduce((s, v) => s + v.weight, 0);
      expect(sum).toBeCloseTo(100);
    });

    it('should handle empty variants', () => {
      const mgr = new VariantManager('test');
      expect(mgr.getVariants()).toEqual([]);
    });
  });
});
