/**
 * @package @forge/i18n
 * @description React integration exports
 */

export {
  I18nProvider,
  I18nContext,
  useI18n,
  useI18nReady,
  useLocale,
  useLocales,
  useChangeLocale,
  useDirection,
} from './I18nProvider';

export { useTranslation, useNs, useNamespaces } from './useTranslation';

export {
  Trans,
  Plural,
  DateTime,
  NumberFormat,
  RelativeTime,
} from './Trans';
export type {
  PluralProps,
  DateTimeProps,
  NumberFormatProps,
  RelativeTimeProps,
} from './Trans';
