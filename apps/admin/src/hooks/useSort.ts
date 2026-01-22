/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useState, useCallback } from 'react';
import type { SortState } from '../types';

interface UseSortReturn {
  sort: SortState;
  toggleSort: (column: string) => void;
  setSort: (column: string, direction: 'asc' | 'desc') => void;
  clearSort: () => void;
  getSortDirection: (column: string) => 'asc' | 'desc' | null;
}

/**
 * Hook for sort state management
 */
export function useSort(initialColumn?: string, initialDirection: 'asc' | 'desc' = 'asc'): UseSortReturn {
  const [sort, setSort] = useState<SortState>({
    column: initialColumn || null,
    direction: initialDirection,
  });

  const toggleSort = useCallback((column: string) => {
    setSort((prev) => {
      if (prev.column === column) {
        // If clicking the same column, toggle direction
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else {
          // If already desc, clear sort
          return { column: null, direction: 'asc' };
        }
      }
      // If clicking a different column, sort ascending
      return { column, direction: 'asc' };
    });
  }, []);

  const setSortState = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSort({ column, direction });
  }, []);

  const clearSort = useCallback(() => {
    setSort({ column: null, direction: 'asc' });
  }, []);

  const getSortDirection = useCallback(
    (column: string): 'asc' | 'desc' | null => {
      if (sort.column === column) {
        return sort.direction;
      }
      return null;
    },
    [sort]
  );

  return {
    sort,
    toggleSort,
    setSort: setSortState,
    clearSort,
    getSortDirection,
  };
}
