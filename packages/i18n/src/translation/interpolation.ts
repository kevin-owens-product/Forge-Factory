/**
 * @package @forge/i18n
 * @description Variable interpolation for translations
 */

import {
  InterpolationOptions,
  InterpolationValues,
  LocaleCode,
} from '../i18n.types';

/**
 * Default interpolation options
 */
const DEFAULT_INTERPOLATION_OPTIONS: Required<InterpolationOptions> = {
  prefix: '{{',
  suffix: '}}',
  escapeHtml: true,
  formatters: {},
  undefinedPlaceholder: '',
  nullPlaceholder: '',
};

/**
 * HTML entities for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Interpolator handles variable replacement in translation strings
 */
export class Interpolator {
  private options: Required<InterpolationOptions>;
  private interpolationRegex: RegExp;

  constructor(options?: InterpolationOptions) {
    this.options = { ...DEFAULT_INTERPOLATION_OPTIONS, ...options };
    this.interpolationRegex = this.buildRegex();
  }

  /**
   * Build the interpolation regex based on options
   */
  private buildRegex(): RegExp {
    const prefix = this.escapeRegex(this.options.prefix);
    const suffix = this.escapeRegex(this.options.suffix);
    // Match: {{key}} or {{key, format}} or {{key, format:arg}}
    return new RegExp(`${prefix}\\s*([\\w.]+)(?:\\s*,\\s*([\\w]+)(?::\\s*([^}]+))?)?\\s*${suffix}`, 'g');
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Interpolate values into a string
   */
  interpolate(
    text: string,
    values?: InterpolationValues,
    locale?: LocaleCode
  ): string {
    if (!text || !values) return text;

    return text.replace(this.interpolationRegex, (_match, key, format, formatArg) => {
      // Get the value using dot notation (e.g., "user.name")
      const value = this.getValue(values, key);

      // Handle undefined/null
      if (value === undefined) {
        return this.options.undefinedPlaceholder;
      }
      if (value === null) {
        return this.options.nullPlaceholder;
      }

      // Apply formatter if specified
      let result: string;
      if (format && this.options.formatters[format]) {
        result = this.options.formatters[format](value, locale ?? 'en');
      } else if (format) {
        result = this.applyBuiltInFormat(value, format, formatArg, locale);
      } else {
        result = this.valueToString(value);
      }

      // Escape HTML if needed
      if (this.options.escapeHtml) {
        result = this.escapeHtml(result);
      }

      return result;
    });
  }

  /**
   * Get a value from an object using dot notation
   */
  private getValue(obj: InterpolationValues, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Convert a value to string
   */
  private valueToString(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Apply built-in formatting
   */
  private applyBuiltInFormat(
    value: unknown,
    format: string,
    formatArg?: string,
    locale?: LocaleCode
  ): string {
    const resolvedLocale = locale ?? 'en';

    switch (format.toLowerCase()) {
      case 'number':
        return this.formatNumber(value, formatArg, resolvedLocale);
      case 'currency':
        return this.formatCurrency(value, formatArg, resolvedLocale);
      case 'percent':
        return this.formatPercent(value, resolvedLocale);
      case 'date':
        return this.formatDate(value, formatArg, resolvedLocale);
      case 'time':
        return this.formatTime(value, formatArg, resolvedLocale);
      case 'datetime':
        return this.formatDateTime(value, formatArg, resolvedLocale);
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'capitalize':
        return this.capitalize(String(value));
      case 'truncate':
        return this.truncate(String(value), formatArg ? parseInt(formatArg, 10) : 50);
      default:
        return this.valueToString(value);
    }
  }

  /**
   * Format as number
   */
  private formatNumber(value: unknown, formatArg?: string, locale?: LocaleCode): string {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);

    const options: Intl.NumberFormatOptions = {};
    if (formatArg) {
      const decimals = parseInt(formatArg, 10);
      if (!isNaN(decimals)) {
        options.minimumFractionDigits = decimals;
        options.maximumFractionDigits = decimals;
      }
    }

    return new Intl.NumberFormat(locale, options).format(num);
  }

  /**
   * Format as currency
   */
  private formatCurrency(value: unknown, currency?: string, locale?: LocaleCode): string {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency ?? 'USD',
    }).format(num);
  }

  /**
   * Format as percent
   */
  private formatPercent(value: unknown, locale?: LocaleCode): string {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);

    return new Intl.NumberFormat(locale, {
      style: 'percent',
    }).format(num);
  }

  /**
   * Format as date
   */
  private formatDate(value: unknown, style?: string, locale?: LocaleCode): string {
    const date = this.toDate(value);
    if (!date) return String(value);

    const dateStyle = (style ?? 'medium') as 'full' | 'long' | 'medium' | 'short';
    return new Intl.DateTimeFormat(locale, { dateStyle }).format(date);
  }

  /**
   * Format as time
   */
  private formatTime(value: unknown, style?: string, locale?: LocaleCode): string {
    const date = this.toDate(value);
    if (!date) return String(value);

    const timeStyle = (style ?? 'short') as 'full' | 'long' | 'medium' | 'short';
    return new Intl.DateTimeFormat(locale, { timeStyle }).format(date);
  }

  /**
   * Format as date and time
   */
  private formatDateTime(value: unknown, style?: string, locale?: LocaleCode): string {
    const date = this.toDate(value);
    if (!date) return String(value);

    const resolvedStyle = (style ?? 'medium') as 'full' | 'long' | 'medium' | 'short';
    return new Intl.DateTimeFormat(locale, {
      dateStyle: resolvedStyle,
      timeStyle: resolvedStyle,
    }).format(date);
  }

  /**
   * Convert value to Date
   */
  private toDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Truncate string
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<InterpolationOptions>): void {
    this.options = { ...this.options, ...options };
    this.interpolationRegex = this.buildRegex();
  }

  /**
   * Get current options
   */
  getOptions(): Required<InterpolationOptions> {
    return { ...this.options };
  }

  /**
   * Add a custom formatter
   */
  addFormatter(name: string, formatter: (value: unknown, locale: LocaleCode) => string): void {
    this.options.formatters[name] = formatter;
  }

  /**
   * Remove a custom formatter
   */
  removeFormatter(name: string): void {
    delete this.options.formatters[name];
  }
}

export { DEFAULT_INTERPOLATION_OPTIONS };
