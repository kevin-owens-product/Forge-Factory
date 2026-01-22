/**
 * @package @forge/i18n
 * @description Trans component for rich text translations
 */

import React, { useMemo } from 'react';
import { TransProps, InterpolationValues } from '../i18n.types';
import { useTranslation } from './useTranslation';

/**
 * Regex to match component placeholders: <0>text</0> or <Component>text</Component>
 */
const COMPONENT_REGEX = /<(\w+)(?:\s[^>]*)?>([^<]*(?:<(?!\/?\1)[^<]*)*)<\/\1>|<(\w+)\s*\/>/g;

/**
 * Parse translation string and replace component placeholders
 */
function parseTranslation(
  text: string,
  components?: Record<string, React.ReactElement>,
  values?: InterpolationValues
): React.ReactNode[] {
  if (!components || Object.keys(components).length === 0) {
    return [text];
  }

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  // Reset regex
  COMPONENT_REGEX.lastIndex = 0;

  while ((match = COMPONENT_REGEX.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    // Self-closing tag: <Component />
    if (match[3]) {
      const componentKey = match[3];
      const component = components[componentKey];

      if (component) {
        result.push(
          React.cloneElement(component, {
            key: `trans-${keyCounter++}`,
          })
        );
      } else {
        result.push(match[0]);
      }
    }
    // Regular tag: <Component>content</Component>
    else {
      const componentKey = match[1];
      const content = match[2];
      const component = components[componentKey];

      if (component) {
        // Recursively parse content for nested components
        const children = parseTranslation(content, components, values);

        result.push(
          React.cloneElement(
            component,
            {
              key: `trans-${keyCounter++}`,
            },
            ...children
          )
        );
      } else {
        // If no matching component, just include the text content
        result.push(content);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

/**
 * Trans component for translations with embedded components
 *
 * Usage:
 * ```tsx
 * <Trans
 *   i18nKey="message.greeting"
 *   values={{ name: 'John' }}
 *   components={{
 *     bold: <strong />,
 *     link: <a href="/profile" />,
 *   }}
 * />
 * ```
 *
 * Translation: "Hello <bold>{{name}}</bold>! Visit your <link>profile</link>."
 * Result: Hello <strong>John</strong>! Visit your <a href="/profile">profile</a>.
 */
export function Trans({
  i18nKey,
  ns,
  defaults,
  values,
  count,
  context,
  components,
  tag: Tag,
  tagProps,
}: TransProps): React.ReactElement {
  const { t } = useTranslation(ns);

  // Get the translated text
  const translatedText = useMemo(() => {
    return t(i18nKey, {
      namespace: ns,
      defaultValue: defaults,
      values,
      count,
      context,
    });
  }, [t, i18nKey, ns, defaults, values, count, context]);

  // Parse and replace components
  const children = useMemo(() => {
    return parseTranslation(translatedText, components, values);
  }, [translatedText, components, values]);

  // Render
  if (Tag) {
    return React.createElement(Tag, tagProps, ...children);
  }

  // Return a fragment if no tag specified
  return <>{children}</>;
}

/**
 * Plural component for simple plural translations
 *
 * Usage:
 * ```tsx
 * <Plural
 *   i18nKey="items.count"
 *   count={items.length}
 *   zero="No items"
 *   one="1 item"
 *   other="{{count}} items"
 * />
 * ```
 */
export interface PluralProps {
  /** Translation key */
  i18nKey?: string;
  /** Namespace */
  ns?: string;
  /** Count value */
  count: number;
  /** Zero form */
  zero?: string;
  /** One form */
  one?: string;
  /** Two form */
  two?: string;
  /** Few form */
  few?: string;
  /** Many form */
  many?: string;
  /** Other form (default) */
  other: string;
  /** Additional values */
  values?: InterpolationValues;
}

export function Plural({
  i18nKey,
  ns,
  count,
  zero,
  one,
  two,
  few,
  many,
  other,
  values,
}: PluralProps): React.ReactElement {
  const { t } = useTranslation(ns);

  const text = useMemo(() => {
    // If i18nKey is provided, use translation
    if (i18nKey) {
      return t(i18nKey, { count, values: { ...values, count } });
    }

    // Otherwise, select form manually
    let selectedForm: string;

    // Check exact matches first
    if (count === 0 && zero !== undefined) {
      selectedForm = zero;
    } else if (count === 1 && one !== undefined) {
      selectedForm = one;
    } else if (count === 2 && two !== undefined) {
      selectedForm = two;
    } else {
      selectedForm = other;
    }

    // Replace {{count}} placeholder
    return selectedForm.replace(/\{\{count\}\}/g, String(count));
  }, [i18nKey, t, count, zero, one, two, few, many, other, values]);

  return <>{text}</>;
}

/**
 * DateTime component for formatted dates
 */
export interface DateTimeProps {
  /** Date value */
  value: Date | number;
  /** Date format style */
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  /** Time format style */
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

export function DateTime({
  value,
  dateStyle = 'medium',
  timeStyle,
}: DateTimeProps): React.ReactElement {
  const { i18n } = useTranslation();

  const formatted = useMemo(() => {
    return i18n.formatDate(value, { dateStyle, timeStyle });
  }, [i18n, value, dateStyle, timeStyle]);

  return <>{formatted}</>;
}

/**
 * Number component for formatted numbers
 */
export interface NumberFormatProps {
  /** Number value */
  value: number;
  /** Format style */
  style?: 'decimal' | 'currency' | 'percent';
  /** Currency code (required if style is 'currency') */
  currency?: string;
  /** Minimum fraction digits */
  minimumFractionDigits?: number;
  /** Maximum fraction digits */
  maximumFractionDigits?: number;
}

export function NumberFormat({
  value,
  style = 'decimal',
  currency,
  minimumFractionDigits,
  maximumFractionDigits,
}: NumberFormatProps): React.ReactElement {
  const { i18n } = useTranslation();

  const formatted = useMemo(() => {
    if (style === 'currency' && currency) {
      return i18n.formatCurrency(value, { currency });
    }
    return i18n.formatNumber(value, {
      style,
      minimumFractionDigits,
      maximumFractionDigits,
    });
  }, [i18n, value, style, currency, minimumFractionDigits, maximumFractionDigits]);

  return <>{formatted}</>;
}

/**
 * RelativeTime component for relative time formatting
 */
export interface RelativeTimeProps {
  /** Date value to compare against now */
  value: Date | number;
  /** Numeric display */
  numeric?: 'always' | 'auto';
  /** Style */
  style?: 'long' | 'short' | 'narrow';
}

export function RelativeTime({
  value,
  numeric = 'auto',
  style = 'long',
}: RelativeTimeProps): React.ReactElement {
  const { i18n } = useTranslation();

  const formatted = useMemo(() => {
    const date = typeof value === 'number' ? new Date(value) : value;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (Math.abs(diffSeconds) < 60) {
      return i18n.formatRelativeTime(diffSeconds, 'second', { numeric, style });
    } else if (Math.abs(diffMinutes) < 60) {
      return i18n.formatRelativeTime(diffMinutes, 'minute', { numeric, style });
    } else if (Math.abs(diffHours) < 24) {
      return i18n.formatRelativeTime(diffHours, 'hour', { numeric, style });
    } else {
      return i18n.formatRelativeTime(diffDays, 'day', { numeric, style });
    }
  }, [i18n, value, numeric, style]);

  return <>{formatted}</>;
}
