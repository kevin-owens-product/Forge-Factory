/**
 * @package @forge/i18n
 * @description TypeScript interfaces for internationalization
 */

/**
 * Supported locale format (e.g., 'en', 'en-US', 'zh-Hans-CN')
 */
export type LocaleCode = string;

/**
 * Translation namespace for code splitting
 */
export type Namespace = string;

/**
 * Translation key path (e.g., 'common.buttons.submit')
 */
export type TranslationKey = string;

/**
 * Interpolation values for translations
 */
export type InterpolationValues = Record<string, string | number | boolean | Date | null | undefined>;

/**
 * Plural categories following CLDR
 */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Translation value - can be string, object with plurals, or nested object
 */
export type TranslationValue =
  | string
  | { [K in PluralCategory]?: string }
  | { [key: string]: TranslationValue };

/**
 * Translation messages for a locale
 */
export interface TranslationMessages {
  [key: string]: TranslationValue;
}

/**
 * Locale configuration
 */
export interface LocaleConfig {
  /** Locale code (e.g., 'en-US') */
  code: LocaleCode;
  /** Display name in the locale's own language */
  name: string;
  /** Display name in English */
  englishName: string;
  /** Text direction */
  direction: 'ltr' | 'rtl';
  /** Date format pattern */
  dateFormat?: string;
  /** Time format pattern */
  timeFormat?: string;
  /** Number format options */
  numberFormat?: Intl.NumberFormatOptions;
  /** Currency code (e.g., 'USD') */
  currency?: string;
  /** Week start day (0 = Sunday, 1 = Monday) */
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Plural rules function */
  pluralRules?: (count: number) => PluralCategory;
}

/**
 * Locale detection source
 */
export type LocaleDetectionSource =
  | 'query'     // URL query parameter (e.g., ?locale=en)
  | 'path'      // URL path segment (e.g., /en/page)
  | 'subdomain' // Subdomain (e.g., en.example.com)
  | 'cookie'    // Browser cookie
  | 'storage'   // Local storage
  | 'header'    // Accept-Language header
  | 'navigator' // Browser navigator.language
  | 'default';  // Default fallback

/**
 * Locale detection options
 */
export interface LocaleDetectionOptions {
  /** Sources to check, in order of priority */
  sources?: LocaleDetectionSource[];
  /** Cookie name for cookie detection */
  cookieName?: string;
  /** Storage key for localStorage detection */
  storageKey?: string;
  /** Query parameter name for URL detection */
  queryParam?: string;
  /** Path segment index (0-based) for path detection */
  pathIndex?: number;
  /** Cache detected locale */
  cacheDetection?: boolean;
}

/**
 * Translation loader function
 */
export type TranslationLoader = (
  locale: LocaleCode,
  namespace?: Namespace
) => Promise<TranslationMessages> | TranslationMessages;

/**
 * Translation backend configuration
 */
export interface TranslationBackend {
  /** Load translations for a locale and optional namespace */
  load: TranslationLoader;
  /** Preload specific locales */
  preload?: LocaleCode[];
}

/**
 * Interpolation options
 */
export interface InterpolationOptions {
  /** Prefix for interpolation (default: '{{') */
  prefix?: string;
  /** Suffix for interpolation (default: '}}') */
  suffix?: string;
  /** Escape HTML in values (default: true) */
  escapeHtml?: boolean;
  /** Format functions for specific value types */
  formatters?: Record<string, (value: unknown, locale: LocaleCode) => string>;
  /** Undefined value placeholder */
  undefinedPlaceholder?: string;
  /** Null value placeholder */
  nullPlaceholder?: string;
}

/**
 * Missing key handler
 */
export type MissingKeyHandler = (
  key: TranslationKey,
  locale: LocaleCode,
  namespace?: Namespace
) => string | void;

/**
 * Date format style
 */
export type DateFormatStyle = 'full' | 'long' | 'medium' | 'short';

/**
 * Number format style
 */
export type NumberFormatStyle = 'decimal' | 'currency' | 'percent' | 'unit';

/**
 * Relative time unit
 */
export type RelativeTimeUnit =
  | 'year' | 'years'
  | 'quarter' | 'quarters'
  | 'month' | 'months'
  | 'week' | 'weeks'
  | 'day' | 'days'
  | 'hour' | 'hours'
  | 'minute' | 'minutes'
  | 'second' | 'seconds';

/**
 * Format options for dates
 */
export interface DateFormatOptions {
  /** Date style */
  dateStyle?: DateFormatStyle;
  /** Time style */
  timeStyle?: DateFormatStyle;
  /** Custom format pattern */
  pattern?: string;
  /** Timezone */
  timeZone?: string;
}

/**
 * Format options for numbers
 */
export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  /** Format style */
  style?: NumberFormatStyle;
}

/**
 * Format options for currency
 */
export interface CurrencyFormatOptions extends Omit<Intl.NumberFormatOptions, 'style'> {
  /** Currency code (e.g., 'USD') */
  currency: string;
  /** Display format */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
}

/**
 * Format options for relative time
 */
export interface RelativeTimeFormatOptions {
  /** Numeric display ('always' or 'auto') */
  numeric?: 'always' | 'auto';
  /** Style ('long', 'short', 'narrow') */
  style?: 'long' | 'short' | 'narrow';
}

/**
 * I18n service configuration
 */
export interface I18nConfig {
  /** Default locale */
  defaultLocale: LocaleCode;
  /** Supported locales */
  supportedLocales: LocaleCode[];
  /** Locale configurations */
  locales?: Record<LocaleCode, Partial<LocaleConfig>>;
  /** Fallback locale (defaults to defaultLocale) */
  fallbackLocale?: LocaleCode;
  /** Locale detection options */
  detection?: LocaleDetectionOptions;
  /** Translation backend */
  backend?: TranslationBackend;
  /** Inline translations */
  translations?: Record<LocaleCode, TranslationMessages>;
  /** Default namespace */
  defaultNamespace?: Namespace;
  /** Load namespaces on init */
  namespaces?: Namespace[];
  /** Interpolation options */
  interpolation?: InterpolationOptions;
  /** Missing key handler */
  onMissingKey?: MissingKeyHandler;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Translation options
 */
export interface TranslateOptions {
  /** Namespace to use */
  namespace?: Namespace;
  /** Default value if key not found */
  defaultValue?: string;
  /** Interpolation values */
  values?: InterpolationValues;
  /** Count for pluralization */
  count?: number;
  /** Context for contextual translations */
  context?: string;
  /** Locale override */
  locale?: LocaleCode;
}

/**
 * I18n service interface
 */
export interface I18nService {
  /** Current locale */
  readonly locale: LocaleCode;
  /** All supported locales */
  readonly locales: LocaleCode[];
  /** Whether translations are loaded */
  readonly isReady: boolean;

  /** Initialize the service */
  init(): Promise<void>;

  /** Change the current locale */
  changeLocale(locale: LocaleCode): Promise<void>;

  /** Translate a key */
  t(key: TranslationKey, options?: TranslateOptions): string;

  /** Check if a translation exists */
  exists(key: TranslationKey, options?: { namespace?: Namespace; locale?: LocaleCode }): boolean;

  /** Load translations for a namespace */
  loadNamespace(namespace: Namespace, locale?: LocaleCode): Promise<void>;

  /** Add translations at runtime */
  addTranslations(locale: LocaleCode, translations: TranslationMessages, namespace?: Namespace): void;

  /** Get locale configuration */
  getLocaleConfig(locale?: LocaleCode): LocaleConfig;

  /** Format a date */
  formatDate(date: Date | number, options?: DateFormatOptions): string;

  /** Format a number */
  formatNumber(value: number, options?: NumberFormatOptions): string;

  /** Format currency */
  formatCurrency(value: number, options?: CurrencyFormatOptions): string;

  /** Format relative time */
  formatRelativeTime(value: number, unit: RelativeTimeUnit, options?: RelativeTimeFormatOptions): string;

  /** Format a list */
  formatList(items: string[], style?: 'conjunction' | 'disjunction' | 'unit'): string;

  /** Subscribe to locale changes */
  onLocaleChange(callback: (locale: LocaleCode) => void): () => void;

  /** Destroy the service */
  destroy(): void;
}

/**
 * React context value
 */
export interface I18nContextValue extends I18nService {
  /** Whether currently loading */
  isLoading: boolean;
  /** Error if any occurred */
  error: Error | null;
}

/**
 * React provider props
 */
export interface I18nProviderProps {
  /** I18n configuration */
  config: I18nConfig;
  /** Initial locale override */
  initialLocale?: LocaleCode;
  /** Children */
  children: React.ReactNode;
  /** Loading fallback */
  fallback?: React.ReactNode;
  /** Error fallback */
  errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode);
}

/**
 * Translation hook options
 */
export interface UseTranslationOptions {
  /** Namespace(s) to load */
  ns?: Namespace | Namespace[];
  /** Key prefix */
  keyPrefix?: string;
}

/**
 * Translation hook return value
 */
export interface UseTranslationReturn {
  /** Translation function */
  t: (key: TranslationKey, options?: TranslateOptions) => string;
  /** Current locale */
  locale: LocaleCode;
  /** All available locales */
  locales: LocaleCode[];
  /** Change locale */
  changeLocale: (locale: LocaleCode) => Promise<void>;
  /** Whether translations are ready */
  ready: boolean;
  /** I18n service instance */
  i18n: I18nService;
}

/**
 * Trans component props
 */
export interface TransProps {
  /** Translation key */
  i18nKey: TranslationKey;
  /** Namespace */
  ns?: Namespace;
  /** Default value */
  defaults?: string;
  /** Interpolation values */
  values?: InterpolationValues;
  /** Count for pluralization */
  count?: number;
  /** Context */
  context?: string;
  /** Component mappings for rich text */
  components?: Record<string, React.ReactElement>;
  /** Tag name for wrapper element */
  tag?: keyof JSX.IntrinsicElements;
  /** Wrapper element props */
  tagProps?: Record<string, unknown>;
}

/**
 * Plural rule function type
 */
export type PluralRuleFunction = (count: number) => PluralCategory;

/**
 * Built-in plural rules
 */
export interface PluralRules {
  [locale: string]: PluralRuleFunction;
}

/**
 * Event types for locale changes
 */
export interface I18nEvents {
  localeChange: LocaleCode;
  missingKey: { key: TranslationKey; locale: LocaleCode; namespace?: Namespace };
  loaded: { locale: LocaleCode; namespace?: Namespace };
  error: Error;
}

/**
 * Event handler type
 */
export type I18nEventHandler<E extends keyof I18nEvents> = (payload: I18nEvents[E]) => void;
