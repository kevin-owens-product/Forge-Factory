/**
 * @package @forge/i18n
 * @description Formatting utilities for dates, numbers, and currencies
 */

import {
  LocaleCode,
  DateFormatOptions,
  NumberFormatOptions,
  CurrencyFormatOptions,
  RelativeTimeFormatOptions,
  RelativeTimeUnit,
} from '../i18n.types';

/**
 * Date format pattern tokens
 */
const DATE_PATTERN_TOKENS: Record<string, (date: Date, locale: LocaleCode) => string> = {
  yyyy: (date) => String(date.getFullYear()),
  yy: (date) => String(date.getFullYear()).slice(-2),
  MM: (date) => String(date.getMonth() + 1).padStart(2, '0'),
  M: (date) => String(date.getMonth() + 1),
  dd: (date) => String(date.getDate()).padStart(2, '0'),
  d: (date) => String(date.getDate()),
  HH: (date) => String(date.getHours()).padStart(2, '0'),
  H: (date) => String(date.getHours()),
  hh: (date) => {
    const hours = date.getHours() % 12;
    return String(hours === 0 ? 12 : hours).padStart(2, '0');
  },
  h: (date) => {
    const hours = date.getHours() % 12;
    return String(hours === 0 ? 12 : hours);
  },
  mm: (date) => String(date.getMinutes()).padStart(2, '0'),
  m: (date) => String(date.getMinutes()),
  ss: (date) => String(date.getSeconds()).padStart(2, '0'),
  s: (date) => String(date.getSeconds()),
  SSS: (date) => String(date.getMilliseconds()).padStart(3, '0'),
  a: (date) => (date.getHours() >= 12 ? 'PM' : 'AM'),
  EEEE: (date, locale) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
  EEE: (date, locale) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
  MMMM: (date, locale) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(date),
  MMM: (date, locale) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(date),
};

/**
 * FormatManager handles all formatting operations
 */
export class FormatManager {
  private locale: LocaleCode;
  private dateFormatCache: Map<string, Intl.DateTimeFormat> = new Map();
  private numberFormatCache: Map<string, Intl.NumberFormat> = new Map();
  private relativeTimeFormatCache: Map<string, Intl.RelativeTimeFormat> = new Map();
  private listFormatCache: Map<string, Intl.ListFormat> = new Map();

  constructor(locale: LocaleCode) {
    this.locale = locale;
  }

  /**
   * Set the current locale
   */
  setLocale(locale: LocaleCode): void {
    if (this.locale !== locale) {
      this.locale = locale;
      this.clearCaches();
    }
  }

  /**
   * Get the current locale
   */
  getLocale(): LocaleCode {
    return this.locale;
  }

  /**
   * Clear all format caches
   */
  clearCaches(): void {
    this.dateFormatCache.clear();
    this.numberFormatCache.clear();
    this.relativeTimeFormatCache.clear();
    this.listFormatCache.clear();
  }

  /**
   * Format a date
   */
  formatDate(date: Date | number, options?: DateFormatOptions): string {
    const dateObj = typeof date === 'number' ? new Date(date) : date;

    // Use custom pattern if provided
    if (options?.pattern) {
      return this.formatDateWithPattern(dateObj, options.pattern);
    }

    // Use Intl.DateTimeFormat
    const intlOptions: Intl.DateTimeFormatOptions = {
      timeZone: options?.timeZone,
    };

    if (options?.dateStyle) {
      intlOptions.dateStyle = options.dateStyle;
    }

    if (options?.timeStyle) {
      intlOptions.timeStyle = options.timeStyle;
    }

    // Default to medium date style if nothing specified
    if (!options?.dateStyle && !options?.timeStyle) {
      intlOptions.dateStyle = 'medium';
    }

    const formatter = this.getDateFormatter(intlOptions);
    return formatter.format(dateObj);
  }

  /**
   * Format date using a pattern string
   */
  formatDateWithPattern(date: Date, pattern: string): string {
    let result = pattern;

    // Sort tokens by length (longest first) to avoid partial replacements
    const sortedTokens = Object.keys(DATE_PATTERN_TOKENS).sort(
      (a, b) => b.length - a.length
    );

    for (const token of sortedTokens) {
      if (result.includes(token)) {
        const replacement = DATE_PATTERN_TOKENS[token](date, this.locale);
        result = result.replace(new RegExp(token, 'g'), replacement);
      }
    }

    return result;
  }

  /**
   * Get or create a cached DateTimeFormat
   */
  private getDateFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${this.locale}:${JSON.stringify(options)}`;
    let formatter = this.dateFormatCache.get(key);

    if (!formatter) {
      formatter = new Intl.DateTimeFormat(this.locale, options);
      this.dateFormatCache.set(key, formatter);
    }

    return formatter;
  }

  /**
   * Format a number
   */
  formatNumber(value: number, options?: NumberFormatOptions): string {
    const formatter = this.getNumberFormatter(options);
    return formatter.format(value);
  }

  /**
   * Get or create a cached NumberFormat
   */
  private getNumberFormatter(options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = `${this.locale}:${JSON.stringify(options ?? {})}`;
    let formatter = this.numberFormatCache.get(key);

    if (!formatter) {
      formatter = new Intl.NumberFormat(this.locale, options);
      this.numberFormatCache.set(key, formatter);
    }

    return formatter;
  }

  /**
   * Format a currency value
   */
  formatCurrency(value: number, options: CurrencyFormatOptions): string {
    const intlOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: options.currency,
      currencyDisplay: options.currencyDisplay,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
      useGrouping: options.useGrouping,
    };

    const formatter = this.getNumberFormatter(intlOptions);
    return formatter.format(value);
  }

  /**
   * Format a percentage
   */
  formatPercent(value: number, options?: Omit<NumberFormatOptions, 'style'>): string {
    return this.formatNumber(value, { ...options, style: 'percent' });
  }

  /**
   * Format a relative time
   */
  formatRelativeTime(
    value: number,
    unit: RelativeTimeUnit,
    options?: RelativeTimeFormatOptions
  ): string {
    const formatter = this.getRelativeTimeFormatter(options);
    const normalizedUnit = this.normalizeRelativeTimeUnit(unit);
    return formatter.format(value, normalizedUnit);
  }

  /**
   * Normalize relative time unit to singular form
   */
  private normalizeRelativeTimeUnit(unit: RelativeTimeUnit): Intl.RelativeTimeFormatUnit {
    const unitMap: Record<string, Intl.RelativeTimeFormatUnit> = {
      year: 'year',
      years: 'year',
      quarter: 'quarter',
      quarters: 'quarter',
      month: 'month',
      months: 'month',
      week: 'week',
      weeks: 'week',
      day: 'day',
      days: 'day',
      hour: 'hour',
      hours: 'hour',
      minute: 'minute',
      minutes: 'minute',
      second: 'second',
      seconds: 'second',
    };
    return unitMap[unit] ?? 'day';
  }

  /**
   * Get or create a cached RelativeTimeFormat
   */
  private getRelativeTimeFormatter(
    options?: RelativeTimeFormatOptions
  ): Intl.RelativeTimeFormat {
    const key = `${this.locale}:${JSON.stringify(options ?? {})}`;
    let formatter = this.relativeTimeFormatCache.get(key);

    if (!formatter) {
      formatter = new Intl.RelativeTimeFormat(this.locale, {
        numeric: options?.numeric ?? 'auto',
        style: options?.style ?? 'long',
      });
      this.relativeTimeFormatCache.set(key, formatter);
    }

    return formatter;
  }

  /**
   * Format a list of items
   */
  formatList(
    items: string[],
    style: 'conjunction' | 'disjunction' | 'unit' = 'conjunction'
  ): string {
    const formatter = this.getListFormatter(style);
    return formatter.format(items);
  }

  /**
   * Get or create a cached ListFormat
   */
  private getListFormatter(
    style: 'conjunction' | 'disjunction' | 'unit'
  ): Intl.ListFormat {
    const key = `${this.locale}:${style}`;
    let formatter = this.listFormatCache.get(key);

    if (!formatter) {
      formatter = new Intl.ListFormat(this.locale, { type: style });
      this.listFormatCache.set(key, formatter);
    }

    return formatter;
  }

  /**
   * Format a date as time ago (e.g., "5 minutes ago")
   */
  formatTimeAgo(date: Date | number, options?: RelativeTimeFormatOptions): string {
    const dateObj = typeof date === 'number' ? new Date(date) : date;
    const now = new Date();
    const diffMs = dateObj.getTime() - now.getTime();
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);
    const diffWeeks = Math.round(diffDays / 7);
    const diffMonths = Math.round(diffDays / 30);
    const diffYears = Math.round(diffDays / 365);

    // Choose the most appropriate unit
    if (Math.abs(diffSeconds) < 60) {
      return this.formatRelativeTime(diffSeconds, 'second', options);
    } else if (Math.abs(diffMinutes) < 60) {
      return this.formatRelativeTime(diffMinutes, 'minute', options);
    } else if (Math.abs(diffHours) < 24) {
      return this.formatRelativeTime(diffHours, 'hour', options);
    } else if (Math.abs(diffDays) < 7) {
      return this.formatRelativeTime(diffDays, 'day', options);
    } else if (Math.abs(diffWeeks) < 4) {
      return this.formatRelativeTime(diffWeeks, 'week', options);
    } else if (Math.abs(diffMonths) < 12) {
      return this.formatRelativeTime(diffMonths, 'month', options);
    } else {
      return this.formatRelativeTime(diffYears, 'year', options);
    }
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const value = bytes / Math.pow(k, i);
    return `${this.formatNumber(value, { maximumFractionDigits: decimals })} ${sizes[i]}`;
  }

  /**
   * Format a duration in milliseconds to human readable string
   */
  formatDuration(ms: number, options?: { precision?: 'seconds' | 'minutes' | 'hours' }): string {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const precision = options?.precision ?? 'seconds';
    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (hours > 0 || (days > 0 && precision !== 'hours')) {
      parts.push(`${hours}h`);
    }
    if ((minutes > 0 || parts.length > 0) && precision !== 'hours') {
      parts.push(`${minutes}m`);
    }
    if (precision === 'seconds') {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ') || '0s';
  }

  /**
   * Format an ordinal number (1st, 2nd, 3rd, etc.)
   */
  formatOrdinal(n: number): string {
    // Use Intl.PluralRules if available
    try {
      const pr = new Intl.PluralRules(this.locale, { type: 'ordinal' });
      const rule = pr.select(n);

      // English-specific ordinal suffixes
      if (this.locale.startsWith('en')) {
        const suffixes: Record<string, string> = {
          one: 'st',
          two: 'nd',
          few: 'rd',
          other: 'th',
        };
        return `${n}${suffixes[rule] ?? 'th'}`;
      }

      // For other locales, just return the number
      // Full ordinal support would require locale-specific data
      return String(n);
    } catch {
      // Fallback for environments without Intl.PluralRules
      const abs = Math.abs(n);
      const lastDigit = abs % 10;
      const lastTwoDigits = abs % 100;

      if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return `${n}th`;
      }

      switch (lastDigit) {
        case 1:
          return `${n}st`;
        case 2:
          return `${n}nd`;
        case 3:
          return `${n}rd`;
        default:
          return `${n}th`;
      }
    }
  }
}
