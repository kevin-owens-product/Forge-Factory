/**
 * @package @forge/feature-flags
 * @description React hooks for feature flag evaluation
 */

import { useMemo, useCallback } from 'react';
import {
  FlagValue,
  UserContext,
  EvaluationDetails,
  VariantResult,
  UseFeatureFlagOptions,
} from '../feature-flags.types';
import { useFeatureFlagContext } from './FeatureFlagProvider';

/**
 * Hook to check if a boolean flag is enabled
 */
export function useFeatureFlag(
  flagKey: string,
  options: UseFeatureFlagOptions = {}
): boolean {
  const { isEnabled } = useFeatureFlagContext();
  const defaultValue = typeof options.defaultValue === 'boolean' ? options.defaultValue : false;

  return useMemo(
    () => isEnabled(flagKey, defaultValue),
    [isEnabled, flagKey, defaultValue]
  );
}

/**
 * Hook to get a flag value
 */
export function useFeatureFlagValue<T extends FlagValue>(
  flagKey: string,
  defaultValue: T
): T {
  const { getValue } = useFeatureFlagContext();

  return useMemo(
    () => getValue<T>(flagKey, defaultValue),
    [getValue, flagKey, defaultValue]
  );
}

/**
 * Hook to get flag evaluation details
 */
export function useFeatureFlagDetails<T extends FlagValue>(
  flagKey: string,
  defaultValue: T
): EvaluationDetails<T> {
  const { getDetails } = useFeatureFlagContext();

  return useMemo(
    () => getDetails<T>(flagKey, defaultValue),
    [getDetails, flagKey, defaultValue]
  );
}

/**
 * Hook to get a variant for multivariate flags
 */
export function useVariant<T extends FlagValue>(
  flagKey: string
): VariantResult<T> | null {
  const { getVariant } = useFeatureFlagContext();

  return useMemo(
    () => getVariant<T>(flagKey),
    [getVariant, flagKey]
  );
}

/**
 * Hook to get and set user context
 */
export function useUserContext(): {
  userContext: UserContext | undefined;
  setUserContext: (context: UserContext) => void;
} {
  const { userContext, setUserContext } = useFeatureFlagContext();
  return { userContext, setUserContext };
}

/**
 * Hook to get loading and error states
 */
export function useFeatureFlagStatus(): {
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<void>;
} {
  const { isLoading, error, refresh } = useFeatureFlagContext();
  return { isLoading, error, refresh };
}

/**
 * Hook to check multiple flags at once
 */
export function useFeatureFlags(
  flagKeys: string[],
  defaultValue = false
): Record<string, boolean> {
  const { isEnabled } = useFeatureFlagContext();

  return useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const key of flagKeys) {
      result[key] = isEnabled(key, defaultValue);
    }
    return result;
  }, [isEnabled, flagKeys, defaultValue]);
}

/**
 * Hook to check if any of the given flags are enabled
 */
export function useAnyFeatureFlag(
  flagKeys: string[],
  defaultValue = false
): boolean {
  const { isEnabled } = useFeatureFlagContext();

  return useMemo(
    () => flagKeys.some(key => isEnabled(key, defaultValue)),
    [isEnabled, flagKeys, defaultValue]
  );
}

/**
 * Hook to check if all of the given flags are enabled
 */
export function useAllFeatureFlags(
  flagKeys: string[],
  defaultValue = false
): boolean {
  const { isEnabled } = useFeatureFlagContext();

  return useMemo(
    () => flagKeys.every(key => isEnabled(key, defaultValue)),
    [isEnabled, flagKeys, defaultValue]
  );
}

/**
 * Hook to get a callback that evaluates a flag
 * Useful when you need to check flags in event handlers
 */
export function useFeatureFlagCallback(): {
  isEnabled: (flagKey: string, defaultValue?: boolean) => boolean;
  getValue: <T extends FlagValue>(flagKey: string, defaultValue: T) => T;
} {
  const context = useFeatureFlagContext();

  const isEnabled = useCallback(
    (flagKey: string, defaultValue = false) => context.isEnabled(flagKey, defaultValue),
    [context]
  );

  const getValue = useCallback(
    <T extends FlagValue>(flagKey: string, defaultValue: T) => context.getValue<T>(flagKey, defaultValue),
    [context]
  );

  return { isEnabled, getValue };
}
