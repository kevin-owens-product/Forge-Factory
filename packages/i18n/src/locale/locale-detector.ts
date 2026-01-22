/**
 * @package @forge/i18n
 * @description Locale detection functionality
 */

import {
  LocaleCode,
  LocaleDetectionSource,
  LocaleDetectionOptions,
} from '../i18n.types';
import { LocaleManager } from './locale-manager';

/**
 * Default detection options
 */
const DEFAULT_DETECTION_OPTIONS: Required<LocaleDetectionOptions> = {
  sources: ['query', 'cookie', 'storage', 'navigator', 'default'],
  cookieName: 'locale',
  storageKey: 'i18n-locale',
  queryParam: 'locale',
  pathIndex: 0,
  cacheDetection: true,
};

/**
 * LocaleDetector handles automatic locale detection from various sources
 */
export class LocaleDetector {
  private options: Required<LocaleDetectionOptions>;
  private localeManager: LocaleManager;
  private cachedLocale: LocaleCode | null = null;

  constructor(localeManager: LocaleManager, options?: LocaleDetectionOptions) {
    this.localeManager = localeManager;
    this.options = { ...DEFAULT_DETECTION_OPTIONS, ...options };
  }

  /**
   * Detect locale from configured sources
   */
  detect(): LocaleCode {
    if (this.options.cacheDetection && this.cachedLocale) {
      return this.cachedLocale;
    }

    for (const source of this.options.sources) {
      const locale = this.detectFromSource(source);
      if (locale && this.localeManager.isSupported(locale)) {
        const resolved = this.localeManager.resolveLocale(locale);
        if (this.options.cacheDetection) {
          this.cachedLocale = resolved;
        }
        return resolved;
      }
    }

    const fallback = this.localeManager.getDefaultLocale();
    if (this.options.cacheDetection) {
      this.cachedLocale = fallback;
    }
    return fallback;
  }

  /**
   * Detect locale from a specific source
   */
  private detectFromSource(source: LocaleDetectionSource): LocaleCode | null {
    switch (source) {
      case 'query':
        return this.detectFromQuery();
      case 'path':
        return this.detectFromPath();
      case 'subdomain':
        return this.detectFromSubdomain();
      case 'cookie':
        return this.detectFromCookie();
      case 'storage':
        return this.detectFromStorage();
      case 'header':
        return this.detectFromHeader();
      case 'navigator':
        return this.detectFromNavigator();
      case 'default':
        return this.localeManager.getDefaultLocale();
      default:
        return null;
    }
  }

  /**
   * Detect locale from URL query parameter
   */
  private detectFromQuery(): LocaleCode | null {
    if (typeof window === 'undefined') return null;

    try {
      const params = new URLSearchParams(window.location.search);
      return params.get(this.options.queryParam);
    } catch {
      return null;
    }
  }

  /**
   * Detect locale from URL path
   */
  private detectFromPath(): LocaleCode | null {
    if (typeof window === 'undefined') return null;

    try {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      return pathParts[this.options.pathIndex] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Detect locale from subdomain
   */
  private detectFromSubdomain(): LocaleCode | null {
    if (typeof window === 'undefined') return null;

    try {
      const subdomain = window.location.hostname.split('.')[0];
      // Check if subdomain looks like a locale code
      if (subdomain && /^[a-z]{2}(-[a-z]{2,4})?$/i.test(subdomain)) {
        return subdomain.toLowerCase();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect locale from cookie
   */
  private detectFromCookie(): LocaleCode | null {
    if (typeof document === 'undefined') return null;

    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.split('=').map((s) => s.trim());
        if (name === this.options.cookieName && value) {
          return decodeURIComponent(value);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect locale from localStorage
   */
  private detectFromStorage(): LocaleCode | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;

    try {
      return localStorage.getItem(this.options.storageKey);
    } catch {
      return null;
    }
  }

  /**
   * Detect locale from Accept-Language header (server-side)
   */
  private detectFromHeader(): LocaleCode | null {
    // This would be used in server-side context
    // In browser context, we can't access request headers directly
    return null;
  }

  /**
   * Detect locale from navigator
   */
  private detectFromNavigator(): LocaleCode | null {
    if (typeof navigator === 'undefined') return null;

    try {
      // Try navigator.languages first (array of preferred languages)
      if (navigator.languages && navigator.languages.length > 0) {
        return this.localeManager.getBestMatch(navigator.languages as LocaleCode[]);
      }

      // Fall back to navigator.language
      if (navigator.language) {
        return navigator.language;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parse Accept-Language header value
   */
  parseAcceptLanguage(header: string): LocaleCode[] {
    if (!header) return [];

    const locales: Array<{ locale: LocaleCode; quality: number }> = [];

    const parts = header.split(',');
    for (const part of parts) {
      const [locale, qualityPart] = part.trim().split(';');
      let quality = 1.0;

      if (qualityPart) {
        const match = qualityPart.match(/q=(\d+(\.\d+)?)/);
        if (match) {
          quality = parseFloat(match[1]);
        }
      }

      if (locale) {
        locales.push({ locale: locale.trim(), quality });
      }
    }

    // Sort by quality (highest first)
    locales.sort((a, b) => b.quality - a.quality);

    return locales.map((l) => l.locale);
  }

  /**
   * Persist detected locale to storage
   */
  persistLocale(locale: LocaleCode): void {
    // Update cache
    if (this.options.cacheDetection) {
      this.cachedLocale = locale;
    }

    // Persist to storage if available
    if (this.options.sources.includes('storage')) {
      this.saveToStorage(locale);
    }

    // Persist to cookie if available
    if (this.options.sources.includes('cookie')) {
      this.saveToCookie(locale);
    }
  }

  /**
   * Save locale to localStorage
   */
  private saveToStorage(locale: LocaleCode): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      localStorage.setItem(this.options.storageKey, locale);
    } catch {
      // Storage might be full or disabled
    }
  }

  /**
   * Save locale to cookie
   */
  private saveToCookie(locale: LocaleCode, days = 365): void {
    if (typeof document === 'undefined') return;

    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${this.options.cookieName}=${encodeURIComponent(locale)};expires=${expires.toUTCString()};path=/;samesite=lax`;
    } catch {
      // Cookie might be disabled
    }
  }

  /**
   * Clear persisted locale
   */
  clearPersistedLocale(): void {
    this.cachedLocale = null;

    // Clear from storage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(this.options.storageKey);
      } catch {
        // Ignore
      }
    }

    // Clear from cookie
    if (typeof document !== 'undefined') {
      try {
        document.cookie = `${this.options.cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Clear cached detection result
   */
  clearCache(): void {
    this.cachedLocale = null;
  }

  /**
   * Get current detection options
   */
  getOptions(): Required<LocaleDetectionOptions> {
    return { ...this.options };
  }

  /**
   * Update detection options
   */
  updateOptions(options: Partial<LocaleDetectionOptions>): void {
    this.options = { ...this.options, ...options };
    this.cachedLocale = null; // Clear cache when options change
  }
}

export { DEFAULT_DETECTION_OPTIONS };
