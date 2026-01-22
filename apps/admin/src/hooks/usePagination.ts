/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { useState, useCallback, useMemo } from 'react';
import type { PaginationState } from '../types';
import { DEFAULT_PAGE_SIZE } from '../constants';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  total?: number;
}

interface UsePaginationReturn {
  pagination: PaginationState;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotal: (total: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  pageRange: { start: number; end: number };
}

/**
 * Hook for pagination state management
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = 1, initialPageSize = DEFAULT_PAGE_SIZE, total: initialTotal = 0 } = options;

  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
    total: initialTotal,
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)), [pagination.total, pagination.pageSize]);

  const hasNextPage = pagination.page < totalPages;
  const hasPrevPage = pagination.page > 1;

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({
      ...prev,
      page: Math.max(1, Math.min(page, Math.ceil(prev.total / prev.pageSize) || 1)),
    }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPagination((prev) => ({
      ...prev,
      pageSize: size,
      page: 1, // Reset to first page when changing page size
    }));
  }, []);

  const setTotal = useCallback((total: number) => {
    setPagination((prev) => ({
      ...prev,
      total,
      page: Math.min(prev.page, Math.ceil(total / prev.pageSize) || 1),
    }));
  }, []);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(pagination.page + 1);
    }
  }, [hasNextPage, pagination.page, setPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPage(pagination.page - 1);
    }
  }, [hasPrevPage, pagination.page, setPage]);

  const pageRange = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = Math.min(start + pagination.pageSize, pagination.total);
    return { start: start + 1, end };
  }, [pagination]);

  return {
    pagination,
    setPage,
    setPageSize,
    setTotal,
    nextPage,
    prevPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    pageRange,
  };
}
