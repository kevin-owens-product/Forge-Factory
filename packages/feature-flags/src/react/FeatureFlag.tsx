/**
 * @package @forge/feature-flags
 * @description React components for conditional rendering based on feature flags
 */

import React from 'react';
import {
  FlagValue,
  FeatureFlagComponentProps,
  FeatureComponentProps,
} from '../feature-flags.types';
import { useFeatureFlag, useFeatureFlagValue, useVariant } from './useFeatureFlag';

/**
 * Component for conditional rendering based on a boolean flag
 */
export function FeatureFlag({
  flagKey,
  children,
  fallback,
  defaultValue = false,
}: FeatureFlagComponentProps): React.ReactNode {
  const isEnabled = useFeatureFlag(flagKey, { defaultValue });

  if (isEnabled) {
    return children;
  }

  return fallback ?? null;
}

/**
 * Component for rendering based on flag value
 */
export function Feature<T extends FlagValue>({
  flagKey,
  render,
  defaultValue,
  fallback,
}: FeatureComponentProps<T>): React.ReactNode {
  const value = useFeatureFlagValue<T>(flagKey, defaultValue);
  const variant = useVariant<T>(flagKey);

  if (value === undefined || value === null) {
    return fallback ?? null;
  }

  return render(value, variant ?? undefined);
}

/**
 * Show content when flag is disabled
 */
export function FeatureFlagOff({
  flagKey,
  children,
  defaultValue = false,
}: Omit<FeatureFlagComponentProps, 'fallback'>): React.ReactNode {
  const isEnabled = useFeatureFlag(flagKey, { defaultValue });

  if (!isEnabled) {
    return children;
  }

  return null;
}

/**
 * Show content when flag matches a specific value
 */
export function FeatureMatch<T extends FlagValue>({
  flagKey,
  value,
  children,
  defaultValue,
}: {
  flagKey: string;
  value: T;
  children: React.ReactNode;
  defaultValue: T;
}): React.ReactNode {
  const flagValue = useFeatureFlagValue<T>(flagKey, defaultValue);

  if (flagValue === value) {
    return children;
  }

  return null;
}

/**
 * Show content when user is in a specific variant
 */
export function VariantMatch<T extends FlagValue>({
  flagKey,
  variantId,
  children,
  fallback,
}: {
  flagKey: string;
  variantId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const variant = useVariant<T>(flagKey);

  if (variant?.variantId === variantId) {
    return children;
  }

  return fallback ?? null;
}

/**
 * Switch component for multivariate flags
 */
export function FeatureSwitch<T extends FlagValue>({
  flagKey,
  cases,
  defaultCase,
}: {
  flagKey: string;
  cases: Record<string, React.ReactNode>;
  defaultCase?: React.ReactNode;
}): React.ReactNode {
  const variant = useVariant<T>(flagKey);

  if (variant && variant.variantId in cases) {
    return cases[variant.variantId];
  }

  return defaultCase ?? null;
}

/**
 * A/B Test component for simple binary tests
 */
export function ABTest({
  flagKey,
  control,
  treatment,
  defaultValue = false,
}: {
  flagKey: string;
  control: React.ReactNode;
  treatment: React.ReactNode;
  defaultValue?: boolean;
}): React.ReactNode {
  const isEnabled = useFeatureFlag(flagKey, { defaultValue });

  return isEnabled ? treatment : control;
}

/**
 * Render prop component for more complex flag usage
 */
export function WithFeatureFlag({
  flagKey,
  defaultValue = false,
  children,
}: {
  flagKey: string;
  defaultValue?: boolean;
  children: (isEnabled: boolean) => React.ReactNode;
}): React.ReactNode {
  const isEnabled = useFeatureFlag(flagKey, { defaultValue });
  return children(isEnabled);
}

/**
 * Render prop component for flag values
 */
export function WithFeatureValue<T extends FlagValue>({
  flagKey,
  defaultValue,
  children,
}: {
  flagKey: string;
  defaultValue: T;
  children: (value: T) => React.ReactNode;
}): React.ReactNode {
  const value = useFeatureFlagValue<T>(flagKey, defaultValue);
  return children(value);
}

/**
 * Render prop component for variants
 */
export function WithVariant<T extends FlagValue>({
  flagKey,
  children,
}: {
  flagKey: string;
  children: (variant: ReturnType<typeof useVariant<T>>) => React.ReactNode;
}): React.ReactNode {
  const variant = useVariant<T>(flagKey);
  return children(variant);
}
