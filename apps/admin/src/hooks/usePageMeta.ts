/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useEffect } from 'react';
import type { PageMeta } from '../types';

/**
 * Hook to set page metadata (title, description)
 */
export function usePageMeta(meta: PageMeta): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${meta.title} | Forge Admin`;

    return () => {
      document.title = previousTitle;
    };
  }, [meta.title]);
}
