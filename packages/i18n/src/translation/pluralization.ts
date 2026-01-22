/**
 * @package @forge/i18n
 * @description Pluralization support for translations
 */

import {
  TranslationValue,
  PluralCategory,
  LocaleCode,
} from '../i18n.types';
import { LocaleManager } from '../locale/locale-manager';

/**
 * ICU plural format regex patterns
 */
const ICU_PLURAL_REGEX = /\{(\w+),\s*plural,\s*([^}]+)\}/g;
const ICU_PLURAL_CASE_REGEX = /(?:=(\d+)|(\w+))\s*\{([^}]*)\}/g;
const ICU_SELECT_REGEX = /\{(\w+),\s*select,\s*([^}]+)\}/g;
const ICU_SELECT_CASE_REGEX = /(\w+)\s*\{([^}]*)\}/g;

/**
 * Pluralizer handles plural form selection and ICU message parsing
 */
export class Pluralizer {
  private localeManager: LocaleManager;

  constructor(localeManager: LocaleManager) {
    this.localeManager = localeManager;
  }

  /**
   * Select the appropriate plural form for a translation value
   */
  selectPlural(
    value: TranslationValue,
    count: number,
    locale?: LocaleCode
  ): string {
    // If it's a simple string, return it
    if (typeof value === 'string') {
      return value;
    }

    // Check if it's a plural object
    if (this.isPluralObject(value)) {
      return this.selectFromPluralObject(value, count, locale);
    }

    // Return empty string for unsupported types
    return '';
  }

  /**
   * Check if a value is a plural object
   */
  private isPluralObject(value: TranslationValue): value is Record<PluralCategory, string> {
    if (typeof value !== 'object' || value === null) return false;

    const pluralKeys: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const keys = Object.keys(value);

    return keys.some((key) => pluralKeys.includes(key as PluralCategory));
  }

  /**
   * Select a value from a plural object
   */
  private selectFromPluralObject(
    pluralObj: Record<string, string>,
    count: number,
    locale?: LocaleCode
  ): string {
    // First, check for an exact numeric match (=0, =1, etc.)
    const exactKey = String(count);
    if (exactKey in pluralObj) {
      return pluralObj[exactKey];
    }

    // Get the plural category for this count
    const category = this.localeManager.getPluralCategory(count, locale);

    // Try to get the value for the category
    if (category in pluralObj) {
      return pluralObj[category];
    }

    // Fall back to 'other'
    if ('other' in pluralObj) {
      return pluralObj.other;
    }

    // Return first available value
    const keys = Object.keys(pluralObj);
    return keys.length > 0 ? pluralObj[keys[0]] : '';
  }

  /**
   * Parse and format ICU message format strings
   */
  parseICU(
    message: string,
    values: Record<string, string | number | boolean>,
    locale?: LocaleCode
  ): string {
    let result = message;

    // Process plural blocks
    result = this.processICUPlural(result, values, locale);

    // Process select blocks
    result = this.processICUSelect(result, values);

    return result;
  }

  /**
   * Process ICU plural syntax: {count, plural, =0 {no items} one {# item} other {# items}}
   */
  private processICUPlural(
    message: string,
    values: Record<string, string | number | boolean>,
    locale?: LocaleCode
  ): string {
    return message.replace(ICU_PLURAL_REGEX, (_, varName, cases) => {
      const count = Number(values[varName] ?? 0);
      const category = this.localeManager.getPluralCategory(count, locale);

      // Parse cases
      const caseMap = new Map<string, string>();
      let match: RegExpExecArray | null;
      const caseRegex = new RegExp(ICU_PLURAL_CASE_REGEX.source, 'g');

      while ((match = caseRegex.exec(cases)) !== null) {
        const [, exactNum, categoryKey, content] = match;
        const key = exactNum ? `=${exactNum}` : categoryKey;
        caseMap.set(key, content);
      }

      // Find matching case
      let selectedContent: string;

      // Check for exact match first
      if (caseMap.has(`=${count}`)) {
        selectedContent = caseMap.get(`=${count}`)!;
      } else if (caseMap.has(category)) {
        selectedContent = caseMap.get(category)!;
      } else if (caseMap.has('other')) {
        selectedContent = caseMap.get('other')!;
      } else {
        selectedContent = '';
      }

      // Replace # with the count
      return selectedContent.replace(/#/g, String(count));
    });
  }

  /**
   * Process ICU select syntax: {gender, select, male {He} female {She} other {They}}
   */
  private processICUSelect(
    message: string,
    values: Record<string, string | number | boolean>
  ): string {
    return message.replace(ICU_SELECT_REGEX, (_, varName, cases) => {
      const value = String(values[varName] ?? '');

      // Parse cases
      const caseMap = new Map<string, string>();
      let match: RegExpExecArray | null;
      const caseRegex = new RegExp(ICU_SELECT_CASE_REGEX.source, 'g');

      while ((match = caseRegex.exec(cases)) !== null) {
        const [, key, content] = match;
        caseMap.set(key, content);
      }

      // Find matching case
      if (caseMap.has(value)) {
        return caseMap.get(value)!;
      } else if (caseMap.has('other')) {
        return caseMap.get('other')!;
      }

      return '';
    });
  }

  /**
   * Check if a message contains ICU syntax
   */
  hasICUSyntax(message: string): boolean {
    return ICU_PLURAL_REGEX.test(message) || ICU_SELECT_REGEX.test(message);
  }

  /**
   * Create a simple plural object from singular/plural forms
   */
  createPluralObject(
    singular: string,
    plural: string,
    zero?: string
  ): Record<PluralCategory, string> {
    return {
      zero: zero ?? plural,
      one: singular,
      two: plural,
      few: plural,
      many: plural,
      other: plural,
    };
  }

  /**
   * Create a plural string using ICU format
   */
  createICUPlural(
    variable: string,
    forms: {
      zero?: string;
      one?: string;
      two?: string;
      few?: string;
      many?: string;
      other: string;
      exact?: Record<number, string>;
    }
  ): string {
    const parts: string[] = [];

    // Add exact matches first
    if (forms.exact) {
      for (const [num, text] of Object.entries(forms.exact)) {
        parts.push(`=${num} {${text}}`);
      }
    }

    // Add category forms
    if (forms.zero) parts.push(`zero {${forms.zero}}`);
    if (forms.one) parts.push(`one {${forms.one}}`);
    if (forms.two) parts.push(`two {${forms.two}}`);
    if (forms.few) parts.push(`few {${forms.few}}`);
    if (forms.many) parts.push(`many {${forms.many}}`);
    parts.push(`other {${forms.other}}`);

    return `{${variable}, plural, ${parts.join(' ')}}`;
  }

  /**
   * Create a select string using ICU format
   */
  createICUSelect(
    variable: string,
    options: Record<string, string>,
    other: string
  ): string {
    const parts = Object.entries(options).map(([key, value]) => `${key} {${value}}`);
    parts.push(`other {${other}}`);

    return `{${variable}, select, ${parts.join(' ')}}`;
  }
}
