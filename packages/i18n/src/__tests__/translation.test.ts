/**
 * @package @forge/i18n
 * @description Tests for translation engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Translator, Interpolator, Pluralizer } from '../translation';
import { LocaleManager } from '../locale';

describe('Interpolator', () => {
  let interpolator: Interpolator;

  beforeEach(() => {
    interpolator = new Interpolator();
  });

  describe('interpolate', () => {
    it('should replace simple variables', () => {
      expect(interpolator.interpolate('Hello {{name}}', { name: 'John' })).toBe('Hello John');
    });

    it('should replace multiple variables', () => {
      expect(
        interpolator.interpolate('{{greeting}} {{name}}!', { greeting: 'Hello', name: 'John' })
      ).toBe('Hello John!');
    });

    it('should handle nested dot notation', () => {
      expect(
        interpolator.interpolate('Hello {{user.name}}', { user: { name: 'John' } })
      ).toBe('Hello John');
    });

    it('should handle undefined values', () => {
      expect(interpolator.interpolate('Hello {{name}}', {})).toBe('Hello ');
    });

    it('should handle null values', () => {
      expect(interpolator.interpolate('Hello {{name}}', { name: null })).toBe('Hello ');
    });

    it('should escape HTML by default', () => {
      expect(interpolator.interpolate('{{html}}', { html: '<script>alert("xss")</script>' }))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should not escape when disabled', () => {
      interpolator.updateOptions({ escapeHtml: false });
      expect(interpolator.interpolate('{{html}}', { html: '<b>bold</b>' })).toBe('<b>bold</b>');
    });

    it('should handle whitespace in variable names', () => {
      expect(interpolator.interpolate('{{ name }}', { name: 'John' })).toBe('John');
    });
  });

  describe('built-in formats', () => {
    it('should format numbers', () => {
      expect(interpolator.interpolate('{{value, number}}', { value: 1234.5 }, 'en-US'))
        .toBe('1,234.5');
    });

    it('should format numbers with decimals', () => {
      expect(interpolator.interpolate('{{value, number:2}}', { value: 1234.5 }, 'en-US'))
        .toBe('1,234.50');
    });

    it('should format currency', () => {
      const result = interpolator.interpolate('{{value, currency:USD}}', { value: 99.99 }, 'en-US');
      expect(result).toContain('$');
      expect(result).toContain('99.99');
    });

    it('should format percent', () => {
      expect(interpolator.interpolate('{{value, percent}}', { value: 0.25 }, 'en-US'))
        .toBe('25%');
    });

    it('should format dates', () => {
      const date = new Date(2024, 0, 15); // Use local time constructor
      const result = interpolator.interpolate('{{date, date}}', { date }, 'en-US');
      expect(result).toContain('Jan');
    });

    it('should format time', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = interpolator.interpolate('{{date, time}}', { date }, 'en-US');
      expect(result).toMatch(/2:30|14:30/);
    });

    it('should uppercase', () => {
      expect(interpolator.interpolate('{{text, uppercase}}', { text: 'hello' }))
        .toBe('HELLO');
    });

    it('should lowercase', () => {
      expect(interpolator.interpolate('{{text, lowercase}}', { text: 'HELLO' }))
        .toBe('hello');
    });

    it('should capitalize', () => {
      expect(interpolator.interpolate('{{text, capitalize}}', { text: 'hello world' }))
        .toBe('Hello world');
    });

    it('should truncate', () => {
      expect(interpolator.interpolate('{{text, truncate:10}}', { text: 'Hello World!' }))
        .toBe('Hello W...');
    });
  });

  describe('custom formatters', () => {
    it('should use custom formatter', () => {
      interpolator.addFormatter('reverse', (value) => String(value).split('').reverse().join(''));
      expect(interpolator.interpolate('{{text, reverse}}', { text: 'hello' })).toBe('olleh');
    });

    it('should remove formatter', () => {
      interpolator.addFormatter('test', () => 'test');
      interpolator.removeFormatter('test');
      expect(interpolator.interpolate('{{value, test}}', { value: 'hello' })).toBe('hello');
    });
  });

  describe('custom options', () => {
    it('should use custom prefix/suffix', () => {
      interpolator.updateOptions({ prefix: '${', suffix: '}' });
      expect(interpolator.interpolate('Hello ${name}', { name: 'John' })).toBe('Hello John');
    });

    it('should use custom undefined placeholder', () => {
      interpolator.updateOptions({ undefinedPlaceholder: '[missing]' });
      expect(interpolator.interpolate('Hello {{name}}', {})).toBe('Hello [missing]');
    });
  });
});

describe('Pluralizer', () => {
  let localeManager: LocaleManager;
  let pluralizer: Pluralizer;

  beforeEach(() => {
    localeManager = new LocaleManager('en', ['en', 'fr', 'ar', 'ja']);
    pluralizer = new Pluralizer(localeManager);
  });

  describe('selectPlural', () => {
    it('should return string as-is', () => {
      expect(pluralizer.selectPlural('Hello', 5)).toBe('Hello');
    });

    it('should select from plural object', () => {
      const value = { one: '1 item', other: '{{count}} items' };
      expect(pluralizer.selectPlural(value, 1, 'en')).toBe('1 item');
      expect(pluralizer.selectPlural(value, 5, 'en')).toBe('{{count}} items');
    });

    it('should use exact numeric match', () => {
      const value = { '0': 'No items', one: '1 item', other: '{{count}} items' };
      expect(pluralizer.selectPlural(value, 0, 'en')).toBe('No items');
    });

    it('should fall back to other', () => {
      const value = { other: 'items' };
      expect(pluralizer.selectPlural(value, 5, 'en')).toBe('items');
    });
  });

  describe('ICU format', () => {
    it('should detect ICU syntax', () => {
      expect(pluralizer.hasICUSyntax('{count, plural, one {#} other {#}}')).toBe(true);
      expect(pluralizer.hasICUSyntax('{type, select, a {A} other {B}}')).toBe(true);
      expect(pluralizer.hasICUSyntax('Regular text')).toBe(false);
    });
  });

  describe('createPluralObject', () => {
    it('should create plural object', () => {
      const obj = pluralizer.createPluralObject('1 item', 'items', 'No items');
      expect(obj.zero).toBe('No items');
      expect(obj.one).toBe('1 item');
      expect(obj.other).toBe('items');
    });
  });

  describe('createICUPlural', () => {
    it('should create ICU plural string', () => {
      const icu = pluralizer.createICUPlural('count', {
        one: '# item',
        other: '# items',
      });
      expect(icu).toContain('{count, plural,');
      expect(icu).toContain('one {# item}');
      expect(icu).toContain('other {# items}');
    });
  });

  describe('createICUSelect', () => {
    it('should create ICU select string', () => {
      const icu = pluralizer.createICUSelect('gender', { male: 'He', female: 'She' }, 'They');
      expect(icu).toContain('{gender, select,');
      expect(icu).toContain('male {He}');
      expect(icu).toContain('other {They}');
    });
  });
});

describe('Translator', () => {
  let localeManager: LocaleManager;
  let interpolator: Interpolator;
  let translator: Translator;

  beforeEach(() => {
    localeManager = new LocaleManager('en', ['en', 'es', 'fr']);
    interpolator = new Interpolator();
    translator = new Translator(localeManager, interpolator, {
      defaultNamespace: 'common',
      debug: false,
    });

    // Add test translations
    translator.addTranslations('en', {
      greeting: 'Hello',
      greetingWithName: 'Hello {{name}}',
      items: { one: '1 item', other: '{{count}} items' },
      nested: { deep: { key: 'Deep value' } },
    });

    translator.addTranslations('es', {
      greeting: 'Hola',
      greetingWithName: 'Hola {{name}}',
    });
  });

  describe('translate', () => {
    it('should translate simple key', () => {
      expect(translator.translate('greeting')).toBe('Hello');
    });

    it('should translate with interpolation', () => {
      expect(translator.translate('greetingWithName', { values: { name: 'John' } }))
        .toBe('Hello John');
    });

    it('should translate with pluralization', () => {
      expect(translator.translate('items', { count: 1 })).toBe('1 item');
      expect(translator.translate('items', { count: 5 })).toBe('5 items');
    });

    it('should translate nested keys', () => {
      expect(translator.translate('nested.deep.key')).toBe('Deep value');
    });

    it('should return key for missing translation', () => {
      expect(translator.translate('missing.key')).toBe('missing.key');
    });

    it('should return default value for missing translation', () => {
      expect(translator.translate('missing.key', { defaultValue: 'Default' })).toBe('Default');
    });

    it('should use specified locale', () => {
      expect(translator.translate('greeting', { locale: 'es' })).toBe('Hola');
    });

    it('should use fallback locale', () => {
      expect(translator.translate('nested.deep.key', { locale: 'es' })).toBe('Deep value');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', () => {
      expect(translator.exists('greeting')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(translator.exists('missing.key')).toBe(false);
    });
  });

  describe('addTranslations', () => {
    it('should add translations', () => {
      translator.addTranslations('en', { newKey: 'New value' });
      expect(translator.translate('newKey')).toBe('New value');
    });

    it('should merge translations', () => {
      translator.addTranslations('en', { greeting: 'Hi' });
      expect(translator.translate('greeting')).toBe('Hi');
      expect(translator.translate('items', { count: 1 })).toBe('1 item');
    });

    it('should add namespaced translations', () => {
      translator.addTranslations('en', { button: 'Click' }, 'ui');
      expect(translator.translate('button', { namespace: 'ui' })).toBe('Click');
    });
  });

  describe('getTranslations', () => {
    it('should return translations', () => {
      const translations = translator.getTranslations('en');
      expect(translations?.greeting).toBe('Hello');
    });

    it('should return undefined for unloaded', () => {
      expect(translator.getTranslations('de')).toBeUndefined();
    });
  });

  describe('clearTranslations', () => {
    it('should clear all translations', () => {
      translator.clearTranslations();
      expect(translator.getTranslations('en')).toBeUndefined();
    });
  });

  describe('clearLocaleTranslations', () => {
    it('should clear locale translations', () => {
      translator.clearLocaleTranslations('es');
      expect(translator.getTranslations('es')).toBeUndefined();
      expect(translator.getTranslations('en')).toBeDefined();
    });
  });

  describe('isLoaded', () => {
    it('should return true for loaded locale', () => {
      expect(translator.isLoaded('en')).toBe(true);
    });

    it('should return false for unloaded locale', () => {
      expect(translator.isLoaded('de')).toBe(false);
    });
  });

  describe('backend loading', () => {
    it('should load from backend', async () => {
      const backend = {
        load: vi.fn().mockResolvedValue({ hello: 'World' }),
      };
      translator.setBackend(backend);

      await translator.loadTranslations('de');

      expect(backend.load).toHaveBeenCalledWith('de', undefined);
      expect(translator.translate('hello', { locale: 'de' })).toBe('World');
    });

    it('should handle backend errors', async () => {
      const backend = {
        load: vi.fn().mockRejectedValue(new Error('Load failed')),
      };
      translator.setBackend(backend);

      await translator.loadTranslations('de');

      expect(translator.isLoaded('de')).toBe(true);
      expect(translator.getTranslations('de')).toEqual({});
    });
  });

  describe('missing key handler', () => {
    it('should call custom missing key handler', () => {
      const onMissingKey = vi.fn().mockReturnValue('Custom missing');
      const customTranslator = new Translator(localeManager, interpolator, {
        onMissingKey,
      });

      expect(customTranslator.translate('missing.key')).toBe('Custom missing');
      expect(onMissingKey).toHaveBeenCalledWith('missing.key', 'en', 'common');
    });
  });
});
