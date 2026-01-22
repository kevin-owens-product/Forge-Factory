/**
 * @package @forge/feature-flags
 * @description Multivariate flag variants and distribution
 */

import {
  Variant,
  VariantResult,
  FlagValue,
  EvaluationReason,
  UserContext,
} from './feature-flags.types';
import { hashUserForRollout } from './targeting';

/**
 * Validate that variant weights sum to 100
 */
export function validateVariantWeights<T extends FlagValue>(variants: Variant<T>[]): boolean {
  if (variants.length === 0) return true;
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  return totalWeight === 100;
}

/**
 * Normalize variant weights to sum to 100
 */
export function normalizeVariantWeights<T extends FlagValue>(variants: Variant<T>[]): Variant<T>[] {
  if (variants.length === 0) return [];

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) {
    // Distribute evenly
    const evenWeight = 100 / variants.length;
    return variants.map(v => ({ ...v, weight: evenWeight }));
  }

  const factor = 100 / totalWeight;
  return variants.map(v => ({ ...v, weight: v.weight * factor }));
}

/**
 * Select a variant based on user context
 * Uses consistent hashing for stable assignment
 */
export function selectVariant<T extends FlagValue>(
  variants: Variant<T>[],
  context: UserContext,
  flagKey: string
): VariantResult<T> | null {
  if (variants.length === 0) return null;

  // Normalize weights if needed
  const normalizedVariants = validateVariantWeights(variants)
    ? variants
    : normalizeVariantWeights(variants);

  // Get user bucket (0-99)
  const bucket = hashUserForRollout(context.id, flagKey);

  // Find variant based on bucket
  let cumulativeWeight = 0;
  for (const variant of normalizedVariants) {
    cumulativeWeight += variant.weight;
    if (bucket < cumulativeWeight) {
      return {
        variantId: variant.id,
        name: variant.name,
        value: variant.value,
        reason: EvaluationReason.VARIANT,
      };
    }
  }

  // Fallback to last variant (shouldn't happen with normalized weights)
  const lastVariant = normalizedVariants[normalizedVariants.length - 1];
  return {
    variantId: lastVariant.id,
    name: lastVariant.name,
    value: lastVariant.value,
    reason: EvaluationReason.VARIANT,
  };
}

/**
 * Get variant by ID
 */
export function getVariantById<T extends FlagValue>(
  variants: Variant<T>[],
  variantId: string
): Variant<T> | null {
  return variants.find(v => v.id === variantId) ?? null;
}

/**
 * Create a simple A/B test variant configuration
 */
export function createABTest<T extends FlagValue>(
  controlValue: T,
  treatmentValue: T,
  treatmentPercentage = 50
): Variant<T>[] {
  return [
    {
      id: 'control',
      name: 'Control',
      value: controlValue,
      weight: 100 - treatmentPercentage,
    },
    {
      id: 'treatment',
      name: 'Treatment',
      value: treatmentValue,
      weight: treatmentPercentage,
    },
  ];
}

/**
 * Create a multivariate test configuration
 */
export function createMultivariateTest<T extends FlagValue>(
  variants: { name: string; value: T; weight: number }[]
): Variant<T>[] {
  return variants.map((v, index) => ({
    id: `variant-${index}`,
    name: v.name,
    value: v.value,
    weight: v.weight,
  }));
}

/**
 * Variant manager class for managing variants
 */
export class VariantManager<T extends FlagValue = FlagValue> {
  private variants: Variant<T>[];
  private readonly flagKey: string;

  constructor(flagKey: string, variants: Variant<T>[] = []) {
    this.flagKey = flagKey;
    this.variants = normalizeVariantWeights(variants);
  }

  /**
   * Get all variants
   */
  getVariants(): Variant<T>[] {
    return [...this.variants];
  }

  /**
   * Add a variant
   */
  addVariant(variant: Variant<T>): void {
    this.variants.push(variant);
    this.variants = normalizeVariantWeights(this.variants);
  }

  /**
   * Remove a variant
   */
  removeVariant(variantId: string): boolean {
    const index = this.variants.findIndex(v => v.id === variantId);
    if (index === -1) return false;
    this.variants.splice(index, 1);
    if (this.variants.length > 0) {
      this.variants = normalizeVariantWeights(this.variants);
    }
    return true;
  }

  /**
   * Update a variant
   */
  updateVariant(variantId: string, updates: Partial<Omit<Variant<T>, 'id'>>): boolean {
    const variant = this.variants.find(v => v.id === variantId);
    if (!variant) return false;

    Object.assign(variant, updates);
    if (updates.weight !== undefined) {
      this.variants = normalizeVariantWeights(this.variants);
    }
    return true;
  }

  /**
   * Set variant weights
   */
  setWeights(weights: Record<string, number>): void {
    for (const variant of this.variants) {
      if (weights[variant.id] !== undefined) {
        variant.weight = weights[variant.id];
      }
    }
    this.variants = normalizeVariantWeights(this.variants);
  }

  /**
   * Select variant for user
   */
  selectForUser(context: UserContext): VariantResult<T> | null {
    return selectVariant(this.variants, context, this.flagKey);
  }

  /**
   * Get variant by ID
   */
  getVariant(variantId: string): Variant<T> | null {
    return getVariantById(this.variants, variantId);
  }

  /**
   * Validate weights sum to 100
   */
  isValid(): boolean {
    return validateVariantWeights(this.variants);
  }

  /**
   * Get distribution statistics
   */
  getDistribution(): { variantId: string; name: string; weight: number }[] {
    return this.variants.map(v => ({
      variantId: v.id,
      name: v.name,
      weight: v.weight,
    }));
  }
}
