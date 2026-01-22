/**
 * @package @forge/i18n
 * @description External module declarations
 */

declare module '@forge/errors' {
  export class ForgeError extends Error {
    constructor(message: string, code?: string, details?: Record<string, unknown>);
    code: string;
    details: Record<string, unknown>;
  }
}

declare module '@testing-library/jest-dom/matchers' {
  const matchers: Record<string, unknown>;
  export = matchers;
}

// Intl.ListFormat declaration for older TypeScript targets
declare namespace Intl {
  interface ListFormatOptions {
    type?: 'conjunction' | 'disjunction' | 'unit';
    style?: 'long' | 'short' | 'narrow';
    localeMatcher?: 'lookup' | 'best fit';
  }

  interface ListFormat {
    format(list: string[]): string;
    formatToParts(list: string[]): Array<{ type: string; value: string }>;
  }

  const ListFormat: {
    prototype: ListFormat;
    new (locales?: string | string[], options?: ListFormatOptions): ListFormat;
    supportedLocalesOf(locales: string | string[], options?: { localeMatcher?: 'lookup' | 'best fit' }): string[];
  };
}
