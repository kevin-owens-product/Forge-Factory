/**
 * @package @forge/i18n
 * @description React translation hook
 */

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  UseTranslationOptions,
  UseTranslationReturn,
  TranslationKey,
  TranslateOptions,
  Namespace,
} from '../i18n.types';
import { useI18n } from './I18nProvider';

/**
 * Hook for translations with namespace support
 */
export function useTranslation(
  ns?: Namespace | Namespace[],
  options?: UseTranslationOptions
): UseTranslationReturn {
  const i18n = useI18n();
  const [ready, setReady] = useState(false);

  // Normalize namespace(s)
  const namespaces = useMemo(() => {
    if (options?.ns) {
      return Array.isArray(options.ns) ? options.ns : [options.ns];
    }
    if (ns) {
      return Array.isArray(ns) ? ns : [ns];
    }
    return [];
  }, [ns, options?.ns]);

  // Key prefix
  const keyPrefix = options?.keyPrefix ?? '';

  // Load namespaces
  useEffect(() => {
    let mounted = true;

    const loadNamespaces = async () => {
      if (namespaces.length === 0) {
        setReady(true);
        return;
      }

      try {
        await Promise.all(namespaces.map((namespace) => i18n.loadNamespace(namespace)));
        if (mounted) {
          setReady(true);
        }
      } catch {
        // Even on error, mark as ready so the component can render
        if (mounted) {
          setReady(true);
        }
      }
    };

    loadNamespaces();

    return () => {
      mounted = false;
    };
  }, [namespaces, i18n]);

  // Translation function
  const t = useCallback(
    (key: TranslationKey, translateOptions?: TranslateOptions): string => {
      // Apply key prefix
      const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key;

      // Use first namespace as default
      const namespace = namespaces[0] ?? translateOptions?.namespace;

      return i18n.t(fullKey, {
        ...translateOptions,
        namespace,
      });
    },
    [i18n, keyPrefix, namespaces]
  );

  // Return value
  return useMemo<UseTranslationReturn>(
    () => ({
      t,
      locale: i18n.locale,
      locales: i18n.locales,
      changeLocale: i18n.changeLocale,
      ready: ready && i18n.isReady,
      i18n: i18n,
    }),
    [t, i18n, ready]
  );
}

/**
 * Hook for a single namespace (convenience alias)
 */
export function useNs(namespace: Namespace): UseTranslationReturn {
  return useTranslation(namespace);
}

/**
 * Hook for multiple namespaces
 */
export function useNamespaces(namespaces: Namespace[]): UseTranslationReturn {
  return useTranslation(namespaces);
}
