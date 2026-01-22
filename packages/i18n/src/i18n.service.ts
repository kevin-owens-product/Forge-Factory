/**
 * @package @forge/i18n
 * @description Main I18n service
 */

import {
  I18nConfig,
  I18nService,
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
} from './i18n.types';
import { LocaleManager, LocaleDetector, FormatManager } from './locale';
import { Translator, Interpolator } from './translation';

/**
 * Type for locale change callbacks
 */
type LocaleChangeCallback = (locale: LocaleCode) => void;

/**
 * Create an I18n service instance
 */
export function createI18n(config: I18nConfig): I18nServiceImpl {
  return new I18nServiceImpl(config);
}

/**
 * I18n service implementation
 */
export class I18nServiceImpl implements I18nService {
  private config: I18nConfig;
  private localeManager: LocaleManager;
  private localeDetector: LocaleDetector;
  private formatManager: FormatManager;
  private translator: Translator;
  private interpolator: Interpolator;
  private localeChangeCallbacks: Set<LocaleChangeCallback> = new Set();
  private initialized = false;

  constructor(config: I18nConfig) {
    this.config = config;

    // Initialize locale manager
    this.localeManager = new LocaleManager(
      config.defaultLocale,
      config.supportedLocales,
      config.locales,
      config.fallbackLocale
    );

    // Initialize locale detector
    this.localeDetector = new LocaleDetector(this.localeManager, config.detection);

    // Initialize format manager
    this.formatManager = new FormatManager(config.defaultLocale);

    // Initialize interpolator
    this.interpolator = new Interpolator(config.interpolation);

    // Initialize translator
    this.translator = new Translator(this.localeManager, this.interpolator, {
      backend: config.backend,
      defaultNamespace: config.defaultNamespace,
      onMissingKey: config.onMissingKey,
      debug: config.debug,
    });

    // Add inline translations if provided
    if (config.translations) {
      for (const [locale, messages] of Object.entries(config.translations)) {
        this.translator.addTranslations(locale, messages);
      }
    }
  }

  /**
   * Current locale
   */
  get locale(): LocaleCode {
    return this.localeManager.getCurrentLocale();
  }

  /**
   * All supported locales
   */
  get locales(): LocaleCode[] {
    return this.localeManager.getSupportedLocales();
  }

  /**
   * Whether the service is initialized
   */
  get isReady(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Detect locale
    const detectedLocale = this.localeDetector.detect();
    this.localeManager.setCurrentLocale(detectedLocale);
    this.formatManager.setLocale(detectedLocale);

    // Load default namespace for current locale
    if (this.config.backend) {
      await this.translator.loadTranslations(detectedLocale, this.config.defaultNamespace);
    }

    // Load additional namespaces
    if (this.config.namespaces) {
      await Promise.all(
        this.config.namespaces.map((ns) =>
          this.translator.loadTranslations(detectedLocale, ns)
        )
      );
    }

    // Preload other locales if configured
    if (this.config.backend?.preload) {
      await Promise.all(
        this.config.backend.preload.map(async (locale) => {
          if (locale !== detectedLocale) {
            await this.translator.loadTranslations(locale, this.config.defaultNamespace);
          }
        })
      );
    }

    this.initialized = true;
  }

  /**
   * Change the current locale
   */
  async changeLocale(locale: LocaleCode): Promise<void> {
    const resolvedLocale = this.localeManager.resolveLocale(locale);

    // Load translations if not already loaded
    if (!this.translator.isLoaded(resolvedLocale, this.config.defaultNamespace)) {
      await this.translator.loadTranslations(resolvedLocale, this.config.defaultNamespace);
    }

    // Update managers
    this.localeManager.setCurrentLocale(resolvedLocale);
    this.formatManager.setLocale(resolvedLocale);

    // Persist the locale
    this.localeDetector.persistLocale(resolvedLocale);

    // Notify callbacks
    this.notifyLocaleChange(resolvedLocale);
  }

  /**
   * Translate a key
   */
  t(key: TranslationKey, options?: TranslateOptions): string {
    return this.translator.translate(key, options);
  }

  /**
   * Check if a translation exists
   */
  exists(key: TranslationKey, options?: { namespace?: Namespace; locale?: LocaleCode }): boolean {
    return this.translator.exists(key, options);
  }

  /**
   * Load a namespace
   */
  async loadNamespace(namespace: Namespace, locale?: LocaleCode): Promise<void> {
    const targetLocale = locale ?? this.locale;
    await this.translator.loadTranslations(targetLocale, namespace);
  }

  /**
   * Add translations at runtime
   */
  addTranslations(locale: LocaleCode, translations: TranslationMessages, namespace?: Namespace): void {
    this.translator.addTranslations(locale, translations, namespace);
  }

  /**
   * Get locale configuration
   */
  getLocaleConfig(locale?: LocaleCode): LocaleConfig {
    return this.localeManager.getConfig(locale);
  }

  /**
   * Format a date
   */
  formatDate(date: Date | number, options?: DateFormatOptions): string {
    return this.formatManager.formatDate(date, options);
  }

  /**
   * Format a number
   */
  formatNumber(value: number, options?: NumberFormatOptions): string {
    return this.formatManager.formatNumber(value, options);
  }

  /**
   * Format currency
   */
  formatCurrency(value: number, options: CurrencyFormatOptions): string {
    return this.formatManager.formatCurrency(value, options);
  }

  /**
   * Format relative time
   */
  formatRelativeTime(
    value: number,
    unit: RelativeTimeUnit,
    options?: RelativeTimeFormatOptions
  ): string {
    return this.formatManager.formatRelativeTime(value, unit, options);
  }

  /**
   * Format a list
   */
  formatList(items: string[], style?: 'conjunction' | 'disjunction' | 'unit'): string {
    return this.formatManager.formatList(items, style);
  }

  /**
   * Subscribe to locale changes
   */
  onLocaleChange(callback: (locale: LocaleCode) => void): () => void {
    this.localeChangeCallbacks.add(callback);
    return () => {
      this.localeChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notify all locale change callbacks
   */
  private notifyLocaleChange(locale: LocaleCode): void {
    for (const callback of this.localeChangeCallbacks) {
      try {
        callback(locale);
      } catch (error) {
        if (this.config.debug) {
          console.error('Error in locale change callback:', error);
        }
      }
    }
  }

  /**
   * Destroy the service
   */
  destroy(): void {
    this.localeChangeCallbacks.clear();
    this.translator.clearTranslations();
    this.formatManager.clearCaches();
    this.initialized = false;
  }

  // Additional utility methods

  /**
   * Get the text direction for the current or specified locale
   */
  getDirection(locale?: LocaleCode): 'ltr' | 'rtl' {
    return this.localeManager.getDirection(locale);
  }

  /**
   * Check if a locale is supported
   */
  isSupported(locale: LocaleCode): boolean {
    return this.localeManager.isSupported(locale);
  }

  /**
   * Get the best matching locale from a list
   */
  getBestMatch(preferredLocales: LocaleCode[]): LocaleCode {
    return this.localeManager.getBestMatch(preferredLocales);
  }

  /**
   * Get the translator instance
   */
  getTranslator(): Translator {
    return this.translator;
  }

  /**
   * Get the format manager instance
   */
  getFormatManager(): FormatManager {
    return this.formatManager;
  }

  /**
   * Get the locale manager instance
   */
  getLocaleManager(): LocaleManager {
    return this.localeManager;
  }

  /**
   * Get the locale detector instance
   */
  getLocaleDetector(): LocaleDetector {
    return this.localeDetector;
  }

  /**
   * Format time ago
   */
  formatTimeAgo(date: Date | number, options?: RelativeTimeFormatOptions): string {
    return this.formatManager.formatTimeAgo(date, options);
  }

  /**
   * Format bytes
   */
  formatBytes(bytes: number, decimals?: number): string {
    return this.formatManager.formatBytes(bytes, decimals);
  }

  /**
   * Format duration
   */
  formatDuration(ms: number, options?: { precision?: 'seconds' | 'minutes' | 'hours' }): string {
    return this.formatManager.formatDuration(ms, options);
  }

  /**
   * Format ordinal
   */
  formatOrdinal(n: number): string {
    return this.formatManager.formatOrdinal(n);
  }
}
