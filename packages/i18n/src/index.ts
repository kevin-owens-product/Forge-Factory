/**
 * @package @forge/i18n
 * @description Internationalization library for Forge Factory
 *
 * Features:
 * - Locale detection (browser, URL, cookie, header)
 * - Translation loading with namespace support
 * - Variable interpolation with named params
 * - Pluralization with ICU message format support
 * - Number/date/currency formatting
 * - React integration (Provider, hooks, components)
 * - TypeScript type-safe translations
 */

// Core service
export { createI18n, I18nServiceImpl } from './i18n.service';

// Locale module
export {
  LocaleManager,
  LocaleDetector,
  FormatManager,
  DEFAULT_LOCALE_CONFIGS,
  DEFAULT_PLURAL_RULES,
  DEFAULT_DETECTION_OPTIONS,
} from './locale';

// Translation module
export {
  Translator,
  Interpolator,
  Pluralizer,
  DEFAULT_INTERPOLATION_OPTIONS,
} from './translation';

// React module
export {
  I18nProvider,
  I18nContext,
  useI18n,
  useI18nReady,
  useLocale,
  useLocales,
  useChangeLocale,
  useDirection,
  useTranslation,
  useNs,
  useNamespaces,
  Trans,
  Plural,
  DateTime,
  NumberFormat,
  RelativeTime,
} from './react';
export type {
  PluralProps,
  DateTimeProps,
  NumberFormatProps,
  RelativeTimeProps,
} from './react';

// Types
export type {
  // Locale types
  LocaleCode,
  Namespace,
  TranslationKey,
  InterpolationValues,
  PluralCategory,
  TranslationValue,
  TranslationMessages,
  LocaleConfig,
  LocaleDetectionSource,
  LocaleDetectionOptions,
  // Translation types
  TranslationLoader,
  TranslationBackend,
  InterpolationOptions,
  MissingKeyHandler,
  // Format types
  DateFormatStyle,
  NumberFormatStyle,
  RelativeTimeUnit,
  DateFormatOptions,
  NumberFormatOptions,
  CurrencyFormatOptions,
  RelativeTimeFormatOptions,
  // Service types
  I18nConfig,
  TranslateOptions,
  I18nService,
  // React types
  I18nContextValue,
  I18nProviderProps,
  UseTranslationOptions,
  UseTranslationReturn,
  TransProps,
  // Event types
  PluralRuleFunction,
  PluralRules,
  I18nEvents,
  I18nEventHandler,
} from './i18n.types';
