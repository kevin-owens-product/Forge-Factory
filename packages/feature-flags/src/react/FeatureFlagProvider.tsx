/**
 * @package @forge/feature-flags
 * @description React context provider for feature flags
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  FeatureFlag,
  FlagValue,
  UserContext,
  EvaluationDetails,
  EvaluationReason,
  VariantResult,
  FeatureFlagContextValue,
  FeatureFlagProviderProps,
} from '../feature-flags.types';
import { FeatureFlagService } from '../feature-flags.service';
import { InMemoryFlagProvider } from '../flag';

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

/**
 * Feature flag provider component
 */
export function FeatureFlagProvider({
  children,
  config,
  initialFlags,
  userContext: initialUserContext,
  loadingComponent,
  errorComponent,
}: FeatureFlagProviderProps): React.ReactNode {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [userContext, setUserContextState] = useState<UserContext | undefined>(initialUserContext);
  const [service] = useState(() => {
    const provider = new InMemoryFlagProvider({ flags: initialFlags });
    return new FeatureFlagService({
      ...config,
      flagProvider: config?.flagProvider || provider,
    });
  });

  useEffect(() => {
    async function loadFlags() {
      try {
        setIsLoading(true);
        setError(undefined);
        await service.loadFlags();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    loadFlags();
  }, [service]);

  const isEnabled = useCallback(
    (flagKey: string, defaultValue = false): boolean => {
      return service.isEnabledSync(flagKey, userContext, defaultValue);
    },
    [service, userContext]
  );

  const getValue = useCallback(
    <T extends FlagValue>(flagKey: string, defaultValue: T): T => {
      return service.getValueSync<T>(flagKey, userContext, defaultValue);
    },
    [service, userContext]
  );

  const getDetails = useCallback(
    <T extends FlagValue>(flagKey: string, defaultValue: T): EvaluationDetails<T> => {
      const flag = service.getFlagKeys().includes(flagKey);
      if (!flag) {
        return {
          flagKey,
          value: defaultValue,
          reason: EvaluationReason.DEFAULT,
          timestamp: new Date(),
          flag: undefined as unknown as FeatureFlag<T>,
          userContext,
          fromCache: false,
        };
      }

      const value = service.getValueSync<T>(flagKey, userContext, defaultValue);
      return {
        flagKey,
        value,
        reason: EvaluationReason.DEFAULT,
        timestamp: new Date(),
        flag: undefined as unknown as FeatureFlag<T>,
        userContext,
        fromCache: false,
      };
    },
    [service, userContext]
  );

  const getVariant = useCallback(
    <T extends FlagValue>(flagKey: string): VariantResult<T> | null => {
      if (!userContext) return null;
      return service.getVariantSync<T>(flagKey, userContext);
    },
    [service, userContext]
  );

  const setUserContext = useCallback((context: UserContext) => {
    setUserContextState(context);
    service.invalidateCache();
  }, [service]);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      await service.refresh();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const contextValue = useMemo<FeatureFlagContextValue>(
    () => ({
      isEnabled,
      getValue,
      getDetails,
      getVariant,
      userContext,
      setUserContext,
      isLoading,
      error,
      refresh,
    }),
    [isEnabled, getValue, getDetails, getVariant, userContext, setUserContext, isLoading, error, refresh]
  );

  if (isLoading && loadingComponent) {
    return loadingComponent as React.ReactNode;
  }

  if (error && errorComponent) {
    return errorComponent as React.ReactNode;
  }

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Use feature flag context
 */
export function useFeatureFlagContext(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlagContext must be used within a FeatureFlagProvider');
  }
  return context;
}

export { FeatureFlagContext };
