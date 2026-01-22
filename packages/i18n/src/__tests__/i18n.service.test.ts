/**
 * @package @forge/i18n
 * @description Tests for I18n service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createI18n, I18nServiceImpl } from '../i18n.service';
import { I18nConfig } from '../i18n.types';

describe('I18nService', () => {
  let i18n: I18nServiceImpl;
  let config: I18nConfig;

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

    config = {
      defaultLocale: 'en',
      supportedLocales: ['en', 'es', 'fr'],
      translations: {
        en: {
          greeting: 'Hello',
          greetingWithName: 'Hello {{name}}',
          items: { one: '1 item', other: '{{count}} items' },
        },
        es: {
          greeting: 'Hola',
          greetingWithName: 'Hola {{name}}',
        },
        fr: {
          greeting: 'Bonjour',
        },
      },
    };

    i18n = createI18n(config);
  });

  describe('createI18n', () => {
    it('should create i18n instance', () => {
      expect(i18n).toBeInstanceOf(I18nServiceImpl);
    });
  });

  describe('locale', () => {
    it('should return default locale', () => {
      expect(i18n.locale).toBe('en');
    });
  });

  describe('locales', () => {
    it('should return supported locales', () => {
      expect(i18n.locales).toContain('en');
      expect(i18n.locales).toContain('es');
      expect(i18n.locales).toContain('fr');
    });
  });

  describe('init', () => {
    it('should initialize service', async () => {
      await i18n.init();
      expect(i18n.isReady).toBe(true);
    });

    it('should detect locale on init', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('es');
      const newI18n = createI18n(config);
      await newI18n.init();
      expect(newI18n.locale).toBe('es');
    });
  });

  describe('changeLocale', () => {
    it('should change locale', async () => {
      await i18n.changeLocale('es');
      expect(i18n.locale).toBe('es');
    });

    it('should notify listeners', async () => {
      const callback = vi.fn();
      i18n.onLocaleChange(callback);

      await i18n.changeLocale('fr');

      expect(callback).toHaveBeenCalledWith('fr');
    });

    it('should persist locale', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      await i18n.changeLocale('es');
      expect(setItemSpy).toHaveBeenCalledWith('i18n-locale', 'es');
    });
  });

  describe('t', () => {
    it('should translate simple key', () => {
      expect(i18n.t('greeting')).toBe('Hello');
    });

    it('should translate with interpolation', () => {
      expect(i18n.t('greetingWithName', { values: { name: 'John' } })).toBe('Hello John');
    });

    it('should translate with pluralization', () => {
      expect(i18n.t('items', { count: 1 })).toBe('1 item');
      expect(i18n.t('items', { count: 5 })).toBe('5 items');
    });

    it('should use specified locale', () => {
      expect(i18n.t('greeting', { locale: 'es' })).toBe('Hola');
    });

    it('should return key for missing translation', () => {
      expect(i18n.t('missing.key')).toBe('missing.key');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', () => {
      expect(i18n.exists('greeting')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(i18n.exists('missing.key')).toBe(false);
    });
  });

  describe('addTranslations', () => {
    it('should add translations at runtime', () => {
      i18n.addTranslations('en', { newKey: 'New value' });
      expect(i18n.t('newKey')).toBe('New value');
    });
  });

  describe('getLocaleConfig', () => {
    it('should return locale config', () => {
      const config = i18n.getLocaleConfig('en');
      expect(config.code).toBe('en');
      expect(config.name).toBe('English');
    });
  });

  describe('formatDate', () => {
    it('should format date', () => {
      const date = new Date('2024-01-15');
      const result = i18n.formatDate(date);
      expect(result).toContain('Jan');
    });
  });

  describe('formatNumber', () => {
    it('should format number', () => {
      expect(i18n.formatNumber(1234567)).toContain('1,234,567');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency', () => {
      const result = i18n.formatCurrency(99.99, { currency: 'USD' });
      expect(result).toContain('$');
      expect(result).toContain('99.99');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time', () => {
      expect(i18n.formatRelativeTime(-1, 'day')).toContain('yesterday');
    });
  });

  describe('formatList', () => {
    it('should format list', () => {
      expect(i18n.formatList(['a', 'b', 'c'])).toBe('a, b, and c');
    });
  });

  describe('onLocaleChange', () => {
    it('should subscribe to locale changes', async () => {
      const callback = vi.fn();
      const unsubscribe = i18n.onLocaleChange(callback);

      await i18n.changeLocale('es');
      expect(callback).toHaveBeenCalledWith('es');

      unsubscribe();
      await i18n.changeLocale('fr');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    it('should cleanup on destroy', () => {
      i18n.destroy();
      expect(i18n.isReady).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should get direction', () => {
      expect(i18n.getDirection()).toBe('ltr');
    });

    it('should check if locale is supported', () => {
      expect(i18n.isSupported('en')).toBe(true);
      expect(i18n.isSupported('zh')).toBe(false);
    });

    it('should get best match', () => {
      expect(i18n.getBestMatch(['es-MX', 'en'])).toBe('es');
    });

    it('should format time ago', () => {
      const date = new Date(Date.now() - 5000);
      expect(i18n.formatTimeAgo(date)).toContain('second');
    });

    it('should format bytes', () => {
      expect(i18n.formatBytes(1024)).toContain('KB');
    });

    it('should format duration', () => {
      expect(i18n.formatDuration(3600000)).toBe('1h 0m 0s');
    });

    it('should format ordinal', () => {
      expect(i18n.formatOrdinal(1)).toBe('1st');
    });
  });

  describe('with backend', () => {
    it('should load namespace from backend', async () => {
      const backend = {
        load: vi.fn().mockResolvedValue({ ui: { button: 'Click me' } }),
      };

      const i18nWithBackend = createI18n({
        ...config,
        backend,
        defaultNamespace: 'common',
      });

      await i18nWithBackend.loadNamespace('ui');

      expect(backend.load).toHaveBeenCalledWith('en', 'ui');
    });
  });
});
