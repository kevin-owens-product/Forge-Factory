/**
 * @package @forge/feature-flags
 * @description React exports for feature flags
 */

export {
  FeatureFlagProvider,
  FeatureFlagContext,
  useFeatureFlagContext,
} from './FeatureFlagProvider';

export {
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
} from './useFeatureFlag';

export {
  FeatureFlag as FeatureFlagComponent,
  Feature,
  FeatureFlagOff,
  FeatureMatch,
  VariantMatch,
  FeatureSwitch,
  ABTest,
  WithFeatureFlag,
  WithFeatureValue,
  WithVariant,
} from './FeatureFlag';
