/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageMeta } from '../usePageMeta';
import { useLocalStorage } from '../useLocalStorage';
import { useDebounce } from '../useDebounce';
import { usePagination } from '../usePagination';
import { useSort } from '../useSort';

describe('usePageMeta', () => {
  it('should set document title', () => {
    const originalTitle = document.title;
    renderHook(() => usePageMeta({ title: 'Test Page' }));
    expect(document.title).toBe('Test Page | Forge Admin');
    document.title = originalTitle;
  });

  it('should restore title on unmount', () => {
    document.title = 'Original Title';
    const { unmount } = renderHook(() => usePageMeta({ title: 'Test Page' }));
    expect(document.title).toBe('Test Page | Forge Admin');
    unmount();
    expect(document.title).toBe('Original Title');
  });
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return initial value when no stored value', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('should return stored value', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('stored');
  });

  it('should update value', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('updated');
    });
    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(localStorage.getItem('test-key') || '')).toBe('updated');
  });

  it('should update value with function', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 5));
    act(() => {
      result.current[1]((prev) => prev + 1);
    });
    expect(result.current[0]).toBe(6);
  });

  it('should remove value', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[2]();
    });
    expect(result.current[0]).toBe('initial');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('should handle objects', () => {
    const { result } = renderHook(() =>
      useLocalStorage('test-key', { count: 0 })
    );
    act(() => {
      result.current[1]({ count: 5 });
    });
    expect(result.current[0]).toEqual({ count: 5 });
  });
});

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('updated');
  });

  it('should cancel previous timeout on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(200));

    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(200));

    rerender({ value: 'd' });
    act(() => vi.advanceTimersByTime(500));

    expect(result.current).toBe('d');
  });
});

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination());
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.pagination.pageSize).toBe(25);
    expect(result.current.pagination.total).toBe(0);
  });

  it('should initialize with custom values', () => {
    const { result } = renderHook(() =>
      usePagination({ initialPage: 2, initialPageSize: 50, total: 100 })
    );
    expect(result.current.pagination.page).toBe(2);
    expect(result.current.pagination.pageSize).toBe(50);
    expect(result.current.pagination.total).toBe(100);
  });

  it('should set page', () => {
    const { result } = renderHook(() => usePagination({ total: 100 }));
    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.pagination.page).toBe(3);
  });

  it('should not set page beyond bounds', () => {
    const { result } = renderHook(() => usePagination({ total: 50 }));
    act(() => {
      result.current.setPage(10);
    });
    expect(result.current.pagination.page).toBe(2); // Max pages = 2
  });

  it('should set page size and reset to page 1', () => {
    const { result } = renderHook(() => usePagination({ total: 100 }));
    act(() => {
      result.current.setPage(3);
    });
    act(() => {
      result.current.setPageSize(50);
    });
    expect(result.current.pagination.pageSize).toBe(50);
    expect(result.current.pagination.page).toBe(1);
  });

  it('should calculate total pages', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, initialPageSize: 25 })
    );
    expect(result.current.totalPages).toBe(4);
  });

  it('should navigate next page', () => {
    const { result } = renderHook(() => usePagination({ total: 100 }));
    act(() => {
      result.current.nextPage();
    });
    expect(result.current.pagination.page).toBe(2);
  });

  it('should navigate prev page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, initialPage: 3 })
    );
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.pagination.page).toBe(2);
  });

  it('should not navigate beyond bounds', () => {
    const { result } = renderHook(() => usePagination({ total: 100 }));
    act(() => {
      result.current.prevPage();
    });
    expect(result.current.pagination.page).toBe(1);
  });

  it('should calculate page range', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, initialPageSize: 25, initialPage: 2 })
    );
    expect(result.current.pageRange).toEqual({ start: 26, end: 50 });
  });

  it('should calculate hasNextPage and hasPrevPage', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, initialPageSize: 25, initialPage: 2 })
    );
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPrevPage).toBe(true);
  });
});

describe('useSort', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSort());
    expect(result.current.sort.column).toBeNull();
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should initialize with custom values', () => {
    const { result } = renderHook(() => useSort('name', 'desc'));
    expect(result.current.sort.column).toBe('name');
    expect(result.current.sort.direction).toBe('desc');
  });

  it('should toggle sort on new column', () => {
    const { result } = renderHook(() => useSort());
    act(() => {
      result.current.toggleSort('name');
    });
    expect(result.current.sort.column).toBe('name');
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should toggle direction on same column', () => {
    const { result } = renderHook(() => useSort('name', 'asc'));
    act(() => {
      result.current.toggleSort('name');
    });
    expect(result.current.sort.column).toBe('name');
    expect(result.current.sort.direction).toBe('desc');
  });

  it('should clear sort on third click', () => {
    const { result } = renderHook(() => useSort('name', 'desc'));
    act(() => {
      result.current.toggleSort('name');
    });
    expect(result.current.sort.column).toBeNull();
  });

  it('should set sort directly', () => {
    const { result } = renderHook(() => useSort());
    act(() => {
      result.current.setSort('email', 'desc');
    });
    expect(result.current.sort.column).toBe('email');
    expect(result.current.sort.direction).toBe('desc');
  });

  it('should clear sort', () => {
    const { result } = renderHook(() => useSort('name', 'asc'));
    act(() => {
      result.current.clearSort();
    });
    expect(result.current.sort.column).toBeNull();
    expect(result.current.sort.direction).toBe('asc');
  });

  it('should get sort direction for column', () => {
    const { result } = renderHook(() => useSort('name', 'desc'));
    expect(result.current.getSortDirection('name')).toBe('desc');
    expect(result.current.getSortDirection('email')).toBeNull();
  });
});
