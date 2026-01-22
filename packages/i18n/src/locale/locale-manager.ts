/**
 * @package @forge/i18n
 * @description Locale management functionality
 */

import {
  LocaleCode,
  LocaleConfig,
  PluralCategory,
  PluralRuleFunction,
} from '../i18n.types';

/**
 * Default locale configurations for common locales
 */
const DEFAULT_LOCALE_CONFIGS: Record<string, Partial<LocaleConfig>> = {
  en: {
    name: 'English',
    englishName: 'English',
    direction: 'ltr',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'h:mm a',
    currency: 'USD',
    weekStartDay: 0,
  },
  'en-US': {
    name: 'English (United States)',
    englishName: 'English (United States)',
    direction: 'ltr',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'h:mm a',
    currency: 'USD',
    weekStartDay: 0,
  },
  'en-GB': {
    name: 'English (United Kingdom)',
    englishName: 'English (United Kingdom)',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'GBP',
    weekStartDay: 1,
  },
  es: {
    name: 'Español',
    englishName: 'Spanish',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    weekStartDay: 1,
  },
  fr: {
    name: 'Français',
    englishName: 'French',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    weekStartDay: 1,
  },
  de: {
    name: 'Deutsch',
    englishName: 'German',
    direction: 'ltr',
    dateFormat: 'dd.MM.yyyy',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    weekStartDay: 1,
  },
  it: {
    name: 'Italiano',
    englishName: 'Italian',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    weekStartDay: 1,
  },
  pt: {
    name: 'Português',
    englishName: 'Portuguese',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'BRL',
    weekStartDay: 0,
  },
  ja: {
    name: '日本語',
    englishName: 'Japanese',
    direction: 'ltr',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    currency: 'JPY',
    weekStartDay: 0,
  },
  ko: {
    name: '한국어',
    englishName: 'Korean',
    direction: 'ltr',
    dateFormat: 'yyyy.MM.dd',
    timeFormat: 'HH:mm',
    currency: 'KRW',
    weekStartDay: 0,
  },
  zh: {
    name: '中文',
    englishName: 'Chinese',
    direction: 'ltr',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    currency: 'CNY',
    weekStartDay: 1,
  },
  'zh-CN': {
    name: '中文（简体）',
    englishName: 'Chinese (Simplified)',
    direction: 'ltr',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    currency: 'CNY',
    weekStartDay: 1,
  },
  'zh-TW': {
    name: '中文（繁體）',
    englishName: 'Chinese (Traditional)',
    direction: 'ltr',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    currency: 'TWD',
    weekStartDay: 0,
  },
  ar: {
    name: 'العربية',
    englishName: 'Arabic',
    direction: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'SAR',
    weekStartDay: 6,
  },
  he: {
    name: 'עברית',
    englishName: 'Hebrew',
    direction: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currency: 'ILS',
    weekStartDay: 0,
  },
  ru: {
    name: 'Русский',
    englishName: 'Russian',
    direction: 'ltr',
    dateFormat: 'dd.MM.yyyy',
    timeFormat: 'HH:mm',
    currency: 'RUB',
    weekStartDay: 1,
  },
  nl: {
    name: 'Nederlands',
    englishName: 'Dutch',
    direction: 'ltr',
    dateFormat: 'dd-MM-yyyy',
    timeFormat: 'HH:mm',
    currency: 'EUR',
    weekStartDay: 1,
  },
  pl: {
    name: 'Polski',
    englishName: 'Polish',
    direction: 'ltr',
    dateFormat: 'dd.MM.yyyy',
    timeFormat: 'HH:mm',
    currency: 'PLN',
    weekStartDay: 1,
  },
};

/**
 * Default plural rules based on CLDR
 */
const DEFAULT_PLURAL_RULES: Record<string, PluralRuleFunction> = {
  // English, German, etc. - "one" for 1, "other" for rest
  en: (count: number): PluralCategory => (count === 1 ? 'one' : 'other'),
  de: (count: number): PluralCategory => (count === 1 ? 'one' : 'other'),
  es: (count: number): PluralCategory => (count === 1 ? 'one' : 'other'),
  it: (count: number): PluralCategory => (count === 1 ? 'one' : 'other'),
  pt: (count: number): PluralCategory => (count === 1 ? 'one' : 'other'),
  nl: (count: number): PluralCategory => (count === 1 ? 'one' : 'other'),

  // French - "one" for 0 and 1
  fr: (count: number): PluralCategory => (count <= 1 ? 'one' : 'other'),

  // Japanese, Chinese, Korean - no plural forms
  ja: (): PluralCategory => 'other',
  ko: (): PluralCategory => 'other',
  zh: (): PluralCategory => 'other',

  // Arabic - complex plural rules
  ar: (count: number): PluralCategory => {
    if (count === 0) return 'zero';
    if (count === 1) return 'one';
    if (count === 2) return 'two';
    const mod100 = count % 100;
    if (mod100 >= 3 && mod100 <= 10) return 'few';
    if (mod100 >= 11 && mod100 <= 99) return 'many';
    return 'other';
  },

  // Russian - complex plural rules
  ru: (count: number): PluralCategory => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) return 'many';
    return 'other';
  },

  // Polish - similar to Russian
  pl: (count: number): PluralCategory => {
    if (count === 1) return 'one';
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    if (mod10 === 0 || mod10 === 1 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 12 && mod100 <= 14)) return 'many';
    return 'other';
  },

  // Hebrew
  he: (count: number): PluralCategory => {
    if (count === 1) return 'one';
    if (count === 2) return 'two';
    if (count > 10 && count % 10 === 0) return 'many';
    return 'other';
  },
};

/**
 * LocaleManager handles locale configuration and validation
 */
export class LocaleManager {
  private configs: Map<LocaleCode, LocaleConfig> = new Map();
  private supportedLocales: Set<LocaleCode> = new Set();
  private defaultLocale: LocaleCode;
  private fallbackLocale: LocaleCode;
  private currentLocale: LocaleCode;

  constructor(
    defaultLocale: LocaleCode,
    supportedLocales: LocaleCode[],
    customConfigs?: Record<LocaleCode, Partial<LocaleConfig>>,
    fallbackLocale?: LocaleCode
  ) {
    this.defaultLocale = defaultLocale;
    this.fallbackLocale = fallbackLocale ?? defaultLocale;
    this.currentLocale = defaultLocale;

    // Initialize supported locales
    for (const locale of supportedLocales) {
      this.supportedLocales.add(locale);
      this.initLocaleConfig(locale, customConfigs?.[locale]);
    }

    // Ensure default and fallback are supported
    if (!this.supportedLocales.has(defaultLocale)) {
      this.supportedLocales.add(defaultLocale);
      this.initLocaleConfig(defaultLocale, customConfigs?.[defaultLocale]);
    }

    if (!this.supportedLocales.has(this.fallbackLocale)) {
      this.supportedLocales.add(this.fallbackLocale);
      this.initLocaleConfig(this.fallbackLocale, customConfigs?.[this.fallbackLocale]);
    }
  }

  /**
   * Initialize locale configuration with defaults
   */
  private initLocaleConfig(locale: LocaleCode, custom?: Partial<LocaleConfig>): void {
    const baseLocale = this.getBaseLocale(locale);
    const defaults = DEFAULT_LOCALE_CONFIGS[locale] ?? DEFAULT_LOCALE_CONFIGS[baseLocale] ?? {};
    const pluralRules = custom?.pluralRules ?? DEFAULT_PLURAL_RULES[locale] ?? DEFAULT_PLURAL_RULES[baseLocale];

    const config: LocaleConfig = {
      code: locale,
      name: custom?.name ?? defaults.name ?? locale,
      englishName: custom?.englishName ?? defaults.englishName ?? locale,
      direction: custom?.direction ?? defaults.direction ?? 'ltr',
      dateFormat: custom?.dateFormat ?? defaults.dateFormat ?? 'yyyy-MM-dd',
      timeFormat: custom?.timeFormat ?? defaults.timeFormat ?? 'HH:mm:ss',
      numberFormat: custom?.numberFormat ?? defaults.numberFormat,
      currency: custom?.currency ?? defaults.currency ?? 'USD',
      weekStartDay: custom?.weekStartDay ?? defaults.weekStartDay ?? 0,
      pluralRules: pluralRules ?? ((count: number) => (count === 1 ? 'one' : 'other')),
    };

    this.configs.set(locale, config);
  }

  /**
   * Get base locale from a locale code (e.g., 'en' from 'en-US')
   */
  getBaseLocale(locale: LocaleCode): LocaleCode {
    return locale.split('-')[0];
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): LocaleCode {
    return this.currentLocale;
  }

  /**
   * Set current locale
   */
  setCurrentLocale(locale: LocaleCode): void {
    const resolved = this.resolveLocale(locale);
    this.currentLocale = resolved;
  }

  /**
   * Get default locale
   */
  getDefaultLocale(): LocaleCode {
    return this.defaultLocale;
  }

  /**
   * Get fallback locale
   */
  getFallbackLocale(): LocaleCode {
    return this.fallbackLocale;
  }

  /**
   * Get all supported locales
   */
  getSupportedLocales(): LocaleCode[] {
    return Array.from(this.supportedLocales);
  }

  /**
   * Check if a locale is supported
   */
  isSupported(locale: LocaleCode): boolean {
    return this.supportedLocales.has(locale) || this.supportedLocales.has(this.getBaseLocale(locale));
  }

  /**
   * Resolve a locale to a supported locale
   */
  resolveLocale(locale: LocaleCode): LocaleCode {
    // Check exact match
    if (this.supportedLocales.has(locale)) {
      return locale;
    }

    // Check base locale
    const baseLocale = this.getBaseLocale(locale);
    if (this.supportedLocales.has(baseLocale)) {
      return baseLocale;
    }

    // Return fallback
    return this.fallbackLocale;
  }

  /**
   * Get locale configuration
   */
  getConfig(locale?: LocaleCode): LocaleConfig {
    const resolvedLocale = this.resolveLocale(locale ?? this.currentLocale);
    let config = this.configs.get(resolvedLocale);

    if (!config) {
      // Try base locale
      const baseLocale = this.getBaseLocale(resolvedLocale);
      config = this.configs.get(baseLocale);
    }

    if (!config) {
      // Return fallback config
      config = this.configs.get(this.fallbackLocale);
    }

    return config ?? this.createDefaultConfig(resolvedLocale);
  }

  /**
   * Create a default configuration for an unknown locale
   */
  private createDefaultConfig(locale: LocaleCode): LocaleConfig {
    return {
      code: locale,
      name: locale,
      englishName: locale,
      direction: 'ltr',
      dateFormat: 'yyyy-MM-dd',
      timeFormat: 'HH:mm:ss',
      currency: 'USD',
      weekStartDay: 0,
      pluralRules: (count: number) => (count === 1 ? 'one' : 'other'),
    };
  }

  /**
   * Get plural category for a count
   */
  getPluralCategory(count: number, locale?: LocaleCode): PluralCategory {
    const config = this.getConfig(locale);
    if (config.pluralRules) {
      return config.pluralRules(Math.abs(count));
    }
    return count === 1 ? 'one' : 'other';
  }

  /**
   * Get text direction for a locale
   */
  getDirection(locale?: LocaleCode): 'ltr' | 'rtl' {
    return this.getConfig(locale).direction;
  }

  /**
   * Add a custom locale configuration
   */
  addLocale(locale: LocaleCode, config: Partial<LocaleConfig>): void {
    this.supportedLocales.add(locale);
    this.initLocaleConfig(locale, config);
  }

  /**
   * Remove a locale (cannot remove default or fallback)
   */
  removeLocale(locale: LocaleCode): boolean {
    if (locale === this.defaultLocale || locale === this.fallbackLocale) {
      return false;
    }
    this.supportedLocales.delete(locale);
    this.configs.delete(locale);
    return true;
  }

  /**
   * Get best matching locale from a list of preferred locales
   */
  getBestMatch(preferredLocales: LocaleCode[]): LocaleCode {
    for (const locale of preferredLocales) {
      if (this.isSupported(locale)) {
        return this.resolveLocale(locale);
      }
    }
    return this.fallbackLocale;
  }
}

export { DEFAULT_LOCALE_CONFIGS, DEFAULT_PLURAL_RULES };
