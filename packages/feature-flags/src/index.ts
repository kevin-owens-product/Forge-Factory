/**
 * @package @forge/feature-flags
 * @description Feature flag management for Forge Factory
 */

// Types
export * from './feature-flags.types';

// Targeting
export {
  hashUserForRollout,
  compareSemver,
  getAttributeValue,
  evaluateCondition,
  evaluateRuleConditions,
  evaluateRule,
  isUserInSegment,
  TargetingEvaluator,
} from './targeting';

// Variants
export {
  validateVariantWeights,
  normalizeVariantWeights,
  selectVariant,
  getVariantById,
  createABTest,
  createMultivariateTest,
  VariantManager,
} from './variants';

// Cache
export {
  DEFAULT_CACHE_CONFIG,
  hashUserContext,
  generateCacheKey,
  FlagCache,
} from './cache';

// Flags
export {
  createFlag,
  createBooleanFlag,
  createStringFlag,
  createNumberFlag,
  createJsonFlag,
  FlagEvaluator,
  InMemoryFlagProvider,
} from './flag';

// Service
export {
  FeatureFlagService,
  createFeatureFlagService,
} from './feature-flags.service';

// React (optional, re-exported for convenience)
export {
  FeatureFlagProvider,
  FeatureFlagContext,
  useFeatureFlagContext,
  useFeatureFlag,
  useFeatureFlagValue,
  useFeatureFlagDetails,
  useVariant,
  useUserContext,
  useFeatureFlagStatus,
  useFeatureFlags,
  useAnyFeatureFlag,
  useAllFeatureFlags,
  useFeatureFlagCallback,
  FeatureFlagComponent,
  Feature,
  FeatureFlagOff,
  FeatureMatch,
  VariantMatch,
  FeatureSwitch,
  ABTest,
  WithFeatureFlag,
  WithFeatureValue,
  WithVariant,
} from './react';
