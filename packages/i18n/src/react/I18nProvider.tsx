/**
 * @package @forge/i18n
 * @description React I18n context provider
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  I18nContextValue,
  I18nProviderProps,
  LocaleCode,
  LocaleConfig,
  Namespace,
  TranslationKey,
  TranslationMessages,
  TranslateOptions,
  DateFormatOptions,
  NumberFormatOptions,
  CurrencyFormatOptions,
  RelativeTimeFormatOptions,
  RelativeTimeUnit,
} from '../i18n.types';
import { createI18n, I18nServiceImpl } from '../i18n.service';

/**
 * I18n context
 */
export const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * I18n Provider component
 */
export function I18nProvider({
  config,
  initialLocale,
  children,
  fallback = null,
  errorFallback,
}: I18nProviderProps): React.ReactElement {
  const [i18n] = useState<I18nServiceImpl>(() => createI18n(config));
  const [locale, setLocale] = useState<LocaleCode>(initialLocale ?? config.defaultLocale);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize i18n
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Override locale if initialLocale is provided
        if (initialLocale) {
          await i18n.changeLocale(initialLocale);
        } else {
          await i18n.init();
        }

        if (mounted) {
          setLocale(i18n.locale);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [i18n, initialLocale]);

  // Subscribe to locale changes
  useEffect(() => {
    const unsubscribe = i18n.onLocaleChange((newLocale) => {
      setLocale(newLocale);
    });

    return unsubscribe;
  }, [i18n]);

  // Memoized change locale function
  const changeLocale = useCallback(
    async (newLocale: LocaleCode): Promise<void> => {
      try {
        setIsLoading(true);
        await i18n.changeLocale(newLocale);
      } finally {
        setIsLoading(false);
      }
    },
    [i18n]
  );

  // Create context value
  const contextValue = useMemo<I18nContextValue>(() => ({
    locale,
    locales: i18n.locales,
    isReady: i18n.isReady,
    isLoading,
    error,
    init: () => i18n.init(),
    changeLocale,
    t: (key: TranslationKey, options?: TranslateOptions) => i18n.t(key, options),
    exists: (key: TranslationKey, options?: { namespace?: Namespace; locale?: LocaleCode }) =>
      i18n.exists(key, options),
    loadNamespace: (namespace: Namespace, loc?: LocaleCode) =>
      i18n.loadNamespace(namespace, loc),
    addTranslations: (loc: LocaleCode, translations: TranslationMessages, ns?: Namespace) =>
      i18n.addTranslations(loc, translations, ns),
    getLocaleConfig: (loc?: LocaleCode): LocaleConfig => i18n.getLocaleConfig(loc),
    formatDate: (date: Date | number, options?: DateFormatOptions) =>
      i18n.formatDate(date, options),
    formatNumber: (value: number, options?: NumberFormatOptions) =>
      i18n.formatNumber(value, options),
    formatCurrency: (value: number, options: CurrencyFormatOptions) =>
      i18n.formatCurrency(value, options),
    formatRelativeTime: (value: number, unit: RelativeTimeUnit, options?: RelativeTimeFormatOptions) =>
      i18n.formatRelativeTime(value, unit, options),
    formatList: (items: string[], style?: 'conjunction' | 'disjunction' | 'unit') =>
      i18n.formatList(items, style),
    onLocaleChange: (callback: (loc: LocaleCode) => void) => i18n.onLocaleChange(callback),
    destroy: () => i18n.destroy(),
  }), [locale, i18n, isLoading, error, changeLocale]);

  // Show error fallback if there's an error
  if (error) {
    if (errorFallback) {
      return (
        <>
          {typeof errorFallback === 'function' ? errorFallback(error) : errorFallback}
        </>
      );
    }
    // If no error fallback, still render children (degraded mode)
  }

  // Show loading fallback during initialization
  if (isLoading && !i18n.isReady) {
    return <>{fallback}</>;
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to access the i18n context
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}

/**
 * Hook to check if translations are ready
 */
export function useI18nReady(): boolean {
  const { isReady, isLoading } = useI18n();
  return isReady && !isLoading;
}

/**
 * Hook to get the current locale
 */
export function useLocale(): LocaleCode {
  const { locale } = useI18n();
  return locale;
}

/**
 * Hook to get all available locales
 */
export function useLocales(): LocaleCode[] {
  const { locales } = useI18n();
  return locales;
}

/**
 * Hook to change the locale
 */
export function useChangeLocale(): (locale: LocaleCode) => Promise<void> {
  const { changeLocale } = useI18n();
  return changeLocale;
}

/**
 * Hook to get the text direction
 */
export function useDirection(): 'ltr' | 'rtl' {
  const { getLocaleConfig } = useI18n();
  return getLocaleConfig().direction;
}
