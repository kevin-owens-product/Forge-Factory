/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useEffect } from 'react';
import type { PageMeta } from '../types';

const DEFAULT_TITLE = 'Forge Portal';

/**
 * Hook to update the document title and meta description
 */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    const previousTitle = document.title;

    document.title = meta.title ? `${meta.title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;

    if (meta.description) {
      let descriptionMeta = document.querySelector('meta[name="description"]');
      if (!descriptionMeta) {
        descriptionMeta = document.createElement('meta');
        descriptionMeta.setAttribute('name', 'description');
        document.head.appendChild(descriptionMeta);
      }
      descriptionMeta.setAttribute('content', meta.description);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [meta.title, meta.description]);
}
