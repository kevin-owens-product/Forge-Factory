/**
 * @package @forge/i18n
 * @description Tests for locale management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocaleManager, LocaleDetector, FormatManager } from '../locale';

describe('LocaleManager', () => {
  let manager: LocaleManager;

  beforeEach(() => {
    manager = new LocaleManager('en', ['en', 'es', 'fr', 'de', 'ja', 'ar']);
  });

  describe('constructor', () => {
    it('should initialize with default locale', () => {
      expect(manager.getCurrentLocale()).toBe('en');
    });

    it('should initialize with supported locales', () => {
      expect(manager.getSupportedLocales()).toContain('en');
      expect(manager.getSupportedLocales()).toContain('es');
      expect(manager.getSupportedLocales()).toContain('fr');
    });

    it('should initialize with custom configs', () => {
      const custom = new LocaleManager(
        'en',
        ['en'],
        { en: { name: 'Custom English', currency: 'GBP' } }
      );
      const config = custom.getConfig('en');
      expect(config.name).toBe('Custom English');
      expect(config.currency).toBe('GBP');
    });

    it('should set fallback locale', () => {
      const custom = new LocaleManager('en', ['en', 'es'], undefined, 'es');
      expect(custom.getFallbackLocale()).toBe('es');
    });
  });

  describe('setCurrentLocale', () => {
    it('should set current locale', () => {
      manager.setCurrentLocale('es');
      expect(manager.getCurrentLocale()).toBe('es');
    });

    it('should resolve to supported locale', () => {
      manager.setCurrentLocale('es-MX');
      expect(manager.getCurrentLocale()).toBe('es');
    });

    it('should fallback for unsupported locale', () => {
      manager.setCurrentLocale('zh');
      expect(manager.getCurrentLocale()).toBe('en');
    });
  });

  describe('isSupported', () => {
    it('should return true for supported locales', () => {
      expect(manager.isSupported('en')).toBe(true);
      expect(manager.isSupported('es')).toBe(true);
    });

    it('should return true for base locale match', () => {
      expect(manager.isSupported('en-US')).toBe(true);
      expect(manager.isSupported('es-MX')).toBe(true);
    });

    it('should return false for unsupported locales', () => {
      expect(manager.isSupported('zh')).toBe(false);
      expect(manager.isSupported('ko')).toBe(false);
    });
  });

  describe('resolveLocale', () => {
    it('should return exact match', () => {
      expect(manager.resolveLocale('en')).toBe('en');
    });

    it('should return base locale', () => {
      expect(manager.resolveLocale('es-MX')).toBe('es');
    });

    it('should return fallback for unsupported', () => {
      expect(manager.resolveLocale('zh')).toBe('en');
    });
  });

  describe('getBaseLocale', () => {
    it('should extract base locale', () => {
      expect(manager.getBaseLocale('en-US')).toBe('en');
      expect(manager.getBaseLocale('zh-Hans-CN')).toBe('zh');
      expect(manager.getBaseLocale('fr')).toBe('fr');
    });
  });

  describe('getConfig', () => {
    it('should return locale config', () => {
      const config = manager.getConfig('en');
      expect(config.code).toBe('en');
      expect(config.name).toBe('English');
      expect(config.direction).toBe('ltr');
    });

    it('should return RTL direction for Arabic', () => {
      const config = manager.getConfig('ar');
      expect(config.direction).toBe('rtl');
    });

    it('should return current locale config when not specified', () => {
      manager.setCurrentLocale('fr');
      const config = manager.getConfig();
      expect(config.code).toBe('fr');
    });
  });

  describe('getPluralCategory', () => {
    it('should return "one" for count 1 in English', () => {
      expect(manager.getPluralCategory(1, 'en')).toBe('one');
    });

    it('should return "other" for counts != 1 in English', () => {
      expect(manager.getPluralCategory(0, 'en')).toBe('other');
      expect(manager.getPluralCategory(2, 'en')).toBe('other');
      expect(manager.getPluralCategory(10, 'en')).toBe('other');
    });

    it('should handle French plurals (0 and 1 are "one")', () => {
      expect(manager.getPluralCategory(0, 'fr')).toBe('one');
      expect(manager.getPluralCategory(1, 'fr')).toBe('one');
      expect(manager.getPluralCategory(2, 'fr')).toBe('other');
    });

    it('should return "other" for Japanese (no plurals)', () => {
      expect(manager.getPluralCategory(1, 'ja')).toBe('other');
      expect(manager.getPluralCategory(5, 'ja')).toBe('other');
    });

    it('should handle Arabic complex plurals', () => {
      expect(manager.getPluralCategory(0, 'ar')).toBe('zero');
      expect(manager.getPluralCategory(1, 'ar')).toBe('one');
      expect(manager.getPluralCategory(2, 'ar')).toBe('two');
      expect(manager.getPluralCategory(5, 'ar')).toBe('few');
      expect(manager.getPluralCategory(15, 'ar')).toBe('many');
    });
  });

  describe('getDirection', () => {
    it('should return ltr for most locales', () => {
      expect(manager.getDirection('en')).toBe('ltr');
      expect(manager.getDirection('es')).toBe('ltr');
      expect(manager.getDirection('fr')).toBe('ltr');
    });

    it('should return rtl for Arabic', () => {
      expect(manager.getDirection('ar')).toBe('rtl');
    });
  });

  describe('addLocale', () => {
    it('should add new locale', () => {
      manager.addLocale('pt', { name: 'Português', englishName: 'Portuguese' });
      expect(manager.isSupported('pt')).toBe(true);
      expect(manager.getConfig('pt').name).toBe('Português');
    });
  });

  describe('removeLocale', () => {
    it('should remove locale', () => {
      expect(manager.removeLocale('fr')).toBe(true);
      expect(manager.isSupported('fr')).toBe(false);
    });

    it('should not remove default locale', () => {
      expect(manager.removeLocale('en')).toBe(false);
      expect(manager.isSupported('en')).toBe(true);
    });
  });

  describe('getBestMatch', () => {
    it('should return best matching locale', () => {
      expect(manager.getBestMatch(['es-MX', 'en'])).toBe('es');
      expect(manager.getBestMatch(['zh', 'fr'])).toBe('fr');
    });

    it('should return fallback if no match', () => {
      expect(manager.getBestMatch(['zh', 'ko'])).toBe('en');
    });
  });
});

describe('LocaleDetector', () => {
  let manager: LocaleManager;
  let detector: LocaleDetector;

  beforeEach(() => {
    manager = new LocaleManager('en', ['en', 'es', 'fr']);
    detector = new LocaleDetector(manager, { sources: ['storage', 'navigator', 'default'] });
  });

  describe('detect', () => {
    it('should detect from localStorage', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('es');
      expect(detector.detect()).toBe('es');
    });

    it('should fall back to navigator', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      Object.defineProperty(navigator, 'languages', {
        value: ['fr-FR', 'en'],
        configurable: true,
      });
      expect(detector.detect()).toBe('fr');
    });

    it('should fall back to default', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
      Object.defineProperty(navigator, 'languages', {
        value: ['zh', 'ko'],
        configurable: true,
      });
      expect(detector.detect()).toBe('en');
    });

    it('should cache detected locale', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('es');
      detector.detect();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('fr');
      expect(detector.detect()).toBe('es'); // Still cached
    });
  });

  describe('parseAcceptLanguage', () => {
    it('should parse Accept-Language header', () => {
      const locales = detector.parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8');
      expect(locales).toEqual(['en-US', 'en', 'fr']);
    });

    it('should handle empty header', () => {
      expect(detector.parseAcceptLanguage('')).toEqual([]);
    });
  });

  describe('persistLocale', () => {
    it('should save to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      detector.persistLocale('es');
      expect(setItemSpy).toHaveBeenCalledWith('i18n-locale', 'es');
    });
  });

  describe('clearPersistedLocale', () => {
    it('should remove from localStorage', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
      detector.clearPersistedLocale();
      expect(removeItemSpy).toHaveBeenCalledWith('i18n-locale');
    });
  });

  describe('clearCache', () => {
    it('should clear detection cache', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('es');
      detector.detect();
      detector.clearCache();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('fr');
      expect(detector.detect()).toBe('fr');
    });
  });
});

describe('FormatManager', () => {
  let formatter: FormatManager;

  beforeEach(() => {
    formatter = new FormatManager('en-US');
  });

  describe('setLocale', () => {
    it('should change locale', () => {
      formatter.setLocale('fr');
      expect(formatter.getLocale()).toBe('fr');
    });
  });

  describe('formatDate', () => {
    it('should format date with default style', () => {
      const date = new Date(2024, 0, 15); // Use local time constructor
      const result = formatter.formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('2024');
    });

    it('should format date with pattern', () => {
      const date = new Date(2024, 0, 15); // Use local time constructor
      const result = formatter.formatDateWithPattern(date, 'yyyy-MM-dd');
      expect(result).toBe('2024-01-15');
    });

    it('should accept timestamp', () => {
      const date = new Date(2024, 0, 15); // Use local time constructor
      const result = formatter.formatDate(date.getTime());
      expect(result).toContain('Jan');
    });
  });

  describe('formatNumber', () => {
    it('should format number', () => {
      expect(formatter.formatNumber(1234567.89)).toBe('1,234,567.89');
    });

    it('should respect options', () => {
      expect(formatter.formatNumber(1234.5, { minimumFractionDigits: 2 })).toBe('1,234.50');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency', () => {
      expect(formatter.formatCurrency(1234.56, { currency: 'USD' })).toBe('$1,234.56');
    });

    it('should format different currencies', () => {
      expect(formatter.formatCurrency(1234.56, { currency: 'EUR' })).toContain('€');
    });
  });

  describe('formatPercent', () => {
    it('should format percentage', () => {
      expect(formatter.formatPercent(0.25)).toBe('25%');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time', () => {
      expect(formatter.formatRelativeTime(-1, 'day')).toContain('yesterday');
    });

    it('should format future time', () => {
      expect(formatter.formatRelativeTime(1, 'day')).toContain('tomorrow');
    });

    it('should normalize units', () => {
      expect(formatter.formatRelativeTime(-2, 'days')).toContain('2');
    });
  });

  describe('formatList', () => {
    it('should format list with conjunction', () => {
      expect(formatter.formatList(['a', 'b', 'c'])).toBe('a, b, and c');
    });

    it('should format list with disjunction', () => {
      expect(formatter.formatList(['a', 'b', 'c'], 'disjunction')).toBe('a, b, or c');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatter.formatBytes(0)).toBe('0 Bytes');
      expect(formatter.formatBytes(1024)).toContain('KB');
      expect(formatter.formatBytes(1024 * 1024)).toContain('MB');
    });
  });

  describe('formatDuration', () => {
    it('should format duration', () => {
      expect(formatter.formatDuration(3661000)).toBe('1h 1m 1s');
      expect(formatter.formatDuration(86400000)).toBe('1d 0h 0m 0s');
    });

    it('should respect precision', () => {
      expect(formatter.formatDuration(3661000, { precision: 'minutes' })).toBe('1h 1m');
    });
  });

  describe('formatOrdinal', () => {
    it('should format ordinals', () => {
      expect(formatter.formatOrdinal(1)).toBe('1st');
      expect(formatter.formatOrdinal(2)).toBe('2nd');
      expect(formatter.formatOrdinal(3)).toBe('3rd');
      expect(formatter.formatOrdinal(4)).toBe('4th');
      expect(formatter.formatOrdinal(11)).toBe('11th');
      expect(formatter.formatOrdinal(21)).toBe('21st');
    });
  });
});
