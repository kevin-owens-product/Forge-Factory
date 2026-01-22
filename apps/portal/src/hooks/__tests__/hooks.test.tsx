/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePageMeta } from '../usePageMeta';
import { useLocalStorage } from '../useLocalStorage';
import { useDebounce } from '../useDebounce';

describe('usePageMeta', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.remove();
    }
  });

  it('should update document title', () => {
    renderHook(() => usePageMeta({ title: 'Test Page' }));

    expect(document.title).toBe('Test Page | Forge Portal');
  });

  it('should update meta description', () => {
    renderHook(() => usePageMeta({ title: 'Test', description: 'Test description' }));

    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('Test description');
  });

  it('should restore previous title on unmount', () => {
    document.title = 'Original Title';
    const { unmount } = renderHook(() => usePageMeta({ title: 'New Title' }));

    expect(document.title).toBe('New Title | Forge Portal');

    unmount();

    expect(document.title).toBe('Original Title');
  });

  it('should update title when meta changes', () => {
    const { rerender } = renderHook(({ meta }) => usePageMeta(meta), {
      initialProps: { meta: { title: 'First' } },
    });

    expect(document.title).toBe('First | Forge Portal');

    rerender({ meta: { title: 'Second' } });

    expect(document.title).toBe('Second | Forge Portal');
  });
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should return initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('initial');
  });

  it('should return stored value from localStorage', () => {
    window.localStorage.setItem('test-key', JSON.stringify('stored'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('stored');
  });

  it('should update value and localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(window.localStorage.getItem('test-key')!)).toBe('updated');
  });

  it('should support function updater', () => {
    const { result } = renderHook(() => useLocalStorage('test-count', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('should remove value from localStorage', () => {
    window.localStorage.setItem('test-key', JSON.stringify('value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe('initial');
    expect(window.localStorage.getItem('test-key')).toBeNull();
  });

  it('should handle complex objects', () => {
    const initial = { name: 'test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('test-obj', initial));

    act(() => {
      result.current[1]({ name: 'updated', count: 5 });
    });

    expect(result.current[0]).toEqual({ name: 'updated', count: 5 });
  });

  it('should handle arrays', () => {
    const { result } = renderHook(() => useLocalStorage<string[]>('test-array', []));

    act(() => {
      result.current[1](['a', 'b', 'c']);
    });

    expect(result.current[0]).toEqual(['a', 'b', 'c']);
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

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('should cancel pending update on new value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'first' });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current).toBe('second');
  });

  it('should work with different delay values', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 1000), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'updated' });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('should handle numbers', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: 0 },
    });

    rerender({ value: 100 });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(100);
  });

  it('should handle objects', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: { count: 0 } },
    });

    rerender({ value: { count: 5 } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toEqual({ count: 5 });
  });
});
