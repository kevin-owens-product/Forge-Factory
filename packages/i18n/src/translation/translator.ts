/**
 * @package @forge/i18n
 * @description Translation engine
 */

import {
  LocaleCode,
  Namespace,
  TranslationKey,
  TranslationMessages,
  TranslationValue,
  TranslateOptions,
  TranslationBackend,
  MissingKeyHandler,
} from '../i18n.types';
import { LocaleManager } from '../locale/locale-manager';
import { Interpolator } from './interpolation';
import { Pluralizer } from './pluralization';

/**
 * Translator handles loading and resolving translations
 */
export class Translator {
  private localeManager: LocaleManager;
  private interpolator: Interpolator;
  private pluralizer: Pluralizer;
  private translations: Map<string, TranslationMessages> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private backend?: TranslationBackend;
  private defaultNamespace: Namespace;
  private onMissingKey?: MissingKeyHandler;
  private debug: boolean;

  constructor(
    localeManager: LocaleManager,
    interpolator: Interpolator,
    options?: {
      backend?: TranslationBackend;
      defaultNamespace?: Namespace;
      onMissingKey?: MissingKeyHandler;
      debug?: boolean;
    }
  ) {
    this.localeManager = localeManager;
    this.interpolator = interpolator;
    this.pluralizer = new Pluralizer(localeManager);
    this.backend = options?.backend;
    this.defaultNamespace = options?.defaultNamespace ?? 'common';
    this.onMissingKey = options?.onMissingKey;
    this.debug = options?.debug ?? false;
  }

  /**
   * Get translation storage key
   */
  private getStorageKey(locale: LocaleCode, namespace?: Namespace): string {
    return namespace ? `${locale}:${namespace}` : locale;
  }

  /**
   * Load translations for a locale and namespace
   */
  async loadTranslations(locale: LocaleCode, namespace?: Namespace): Promise<void> {
    const key = this.getStorageKey(locale, namespace);

    // Check if already loaded
    if (this.translations.has(key)) {
      return;
    }

    // Check if already loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    // Load from backend
    if (this.backend) {
      const loadingPromise = (async () => {
        try {
          const messages = await this.backend!.load(locale, namespace);
          this.addTranslations(locale, messages, namespace);
        } catch (error) {
          if (this.debug) {
            console.error(`Failed to load translations for ${key}:`, error);
          }
          // Add empty translations to prevent repeated load attempts
          this.translations.set(key, {});
        } finally {
          this.loadingPromises.delete(key);
        }
      })();

      this.loadingPromises.set(key, loadingPromise);
      return loadingPromise;
    }
  }

  /**
   * Add translations at runtime
   */
  addTranslations(
    locale: LocaleCode,
    messages: TranslationMessages,
    namespace?: Namespace
  ): void {
    const key = this.getStorageKey(locale, namespace);
    const existing = this.translations.get(key) ?? {};
    this.translations.set(key, this.deepMerge(existing, messages));
  }

  /**
   * Deep merge translation objects
   */
  private deepMerge(target: TranslationMessages, source: TranslationMessages): TranslationMessages {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(sourceValue) &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as TranslationMessages,
          sourceValue as TranslationMessages
        );
      } else {
        result[key] = sourceValue;
      }
    }

    return result;
  }

  /**
   * Translate a key
   */
  translate(key: TranslationKey, options?: TranslateOptions): string {
    const locale = options?.locale ?? this.localeManager.getCurrentLocale();
    const namespace = options?.namespace ?? this.defaultNamespace;

    // Try to get the translation value
    let value = this.getValue(key, locale, namespace);

    // If not found, try the fallback locale
    if (value === undefined) {
      const fallbackLocale = this.localeManager.getFallbackLocale();
      if (fallbackLocale !== locale) {
        value = this.getValue(key, fallbackLocale, namespace);
      }
    }

    // If still not found, handle missing key
    if (value === undefined) {
      return this.handleMissingKey(key, locale, namespace, options?.defaultValue);
    }

    // Process the value
    return this.processValue(value, locale, options);
  }

  /**
   * Get a translation value by key
   */
  private getValue(
    key: TranslationKey,
    locale: LocaleCode,
    namespace?: Namespace
  ): TranslationValue | undefined {
    // Try with namespace
    if (namespace) {
      const nsKey = this.getStorageKey(locale, namespace);
      const nsMessages = this.translations.get(nsKey);
      if (nsMessages) {
        const value = this.getNestedValue(nsMessages, key);
        if (value !== undefined) return value;
      }
    }

    // Try without namespace
    const localeKey = this.getStorageKey(locale);
    const messages = this.translations.get(localeKey);
    if (messages) {
      return this.getNestedValue(messages, key);
    }

    return undefined;
  }

  /**
   * Get a nested value using dot notation
   */
  private getNestedValue(
    obj: TranslationMessages,
    path: string
  ): TranslationValue | undefined {
    const keys = path.split('.');
    let current: TranslationValue | undefined = obj;

    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as TranslationMessages)[key];
    }

    return current;
  }

  /**
   * Process a translation value (pluralization, interpolation)
   */
  private processValue(
    value: TranslationValue,
    locale: LocaleCode,
    options?: TranslateOptions
  ): string {
    let text: string;

    // Handle pluralization
    if (options?.count !== undefined && typeof value !== 'string') {
      text = this.pluralizer.selectPlural(value, options.count, locale);
    } else if (typeof value === 'string') {
      text = value;
    } else if (typeof value === 'object' && value !== null) {
      // Try to get 'other' as default for object values
      if ('other' in value && typeof value.other === 'string') {
        text = value.other;
      } else {
        text = JSON.stringify(value);
      }
    } else {
      text = String(value);
    }

    // Handle ICU format in string
    if (options?.values || options?.count !== undefined) {
      const values = {
        ...options?.values,
        count: options?.count,
      };

      // Check for ICU syntax
      if (this.pluralizer.hasICUSyntax(text)) {
        text = this.pluralizer.parseICU(text, values as Record<string, string | number | boolean>, locale);
      }
    }

    // Apply interpolation
    if (options?.values) {
      text = this.interpolator.interpolate(text, options.values, locale);
    }

    // Replace count placeholder
    if (options?.count !== undefined) {
      text = text.replace(/\{\{count\}\}/g, String(options.count));
      text = text.replace(/#/g, String(options.count));
    }

    return text;
  }

  /**
   * Handle missing translation key
   */
  private handleMissingKey(
    key: TranslationKey,
    locale: LocaleCode,
    namespace?: Namespace,
    defaultValue?: string
  ): string {
    // Call custom handler if provided
    if (this.onMissingKey) {
      const result = this.onMissingKey(key, locale, namespace);
      if (typeof result === 'string') {
        return result;
      }
    }

    // Log in debug mode
    if (this.debug) {
      console.warn(`Missing translation: ${namespace ? `${namespace}:` : ''}${key} [${locale}]`);
    }

    // Return default value or key
    return defaultValue ?? key;
  }

  /**
   * Check if a translation exists
   */
  exists(
    key: TranslationKey,
    options?: { namespace?: Namespace; locale?: LocaleCode }
  ): boolean {
    const locale = options?.locale ?? this.localeManager.getCurrentLocale();
    const namespace = options?.namespace ?? this.defaultNamespace;

    const value = this.getValue(key, locale, namespace);
    return value !== undefined;
  }

  /**
   * Get all loaded translations for a locale
   */
  getTranslations(locale: LocaleCode, namespace?: Namespace): TranslationMessages | undefined {
    return this.translations.get(this.getStorageKey(locale, namespace));
  }

  /**
   * Get all loaded locale-namespace combinations
   */
  getLoadedResources(): Array<{ locale: LocaleCode; namespace?: Namespace }> {
    const resources: Array<{ locale: LocaleCode; namespace?: Namespace }> = [];

    for (const key of this.translations.keys()) {
      const [locale, namespace] = key.split(':');
      resources.push({ locale, namespace });
    }

    return resources;
  }

  /**
   * Clear all loaded translations
   */
  clearTranslations(): void {
    this.translations.clear();
    this.loadingPromises.clear();
  }

  /**
   * Clear translations for a specific locale
   */
  clearLocaleTranslations(locale: LocaleCode): void {
    for (const key of this.translations.keys()) {
      if (key === locale || key.startsWith(`${locale}:`)) {
        this.translations.delete(key);
      }
    }
  }

  /**
   * Check if translations are loaded for a locale
   */
  isLoaded(locale: LocaleCode, namespace?: Namespace): boolean {
    return this.translations.has(this.getStorageKey(locale, namespace));
  }

  /**
   * Check if translations are currently loading
   */
  isLoading(locale: LocaleCode, namespace?: Namespace): boolean {
    return this.loadingPromises.has(this.getStorageKey(locale, namespace));
  }

  /**
   * Set the translation backend
   */
  setBackend(backend: TranslationBackend): void {
    this.backend = backend;
  }

  /**
   * Get the pluralizer instance
   */
  getPluralizer(): Pluralizer {
    return this.pluralizer;
  }

  /**
   * Get the interpolator instance
   */
  getInterpolator(): Interpolator {
    return this.interpolator;
  }
}
