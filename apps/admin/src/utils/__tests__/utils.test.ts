/**
 * @prompt-id forge-v4.1:feature:admin:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  truncate,
  capitalize,
  generateId,
  isDefined,
  cn,
  formatBytes,
  formatPercent,
  formatNumber,
  debounce,
  sortBy,
  filterBySearch,
  getStatusColor,
  getSeverityColor,
} from '../index';

describe('formatDate', () => {
  it('should format date correctly', () => {
    // Use explicit time to avoid timezone issues
    const date = new Date(2024, 5, 15); // June 15, 2024 (months are 0-indexed)
    const result = formatDate(date, 'en-US');
    expect(result).toContain('June');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should use default locale', () => {
    const date = new Date('2024-01-01');
    const result = formatDate(date);
    expect(result).toBeTruthy();
  });
});

describe('formatDateTime', () => {
  it('should format datetime correctly', () => {
    // Use explicit time to avoid timezone issues
    const date = new Date(2024, 5, 15, 14, 30, 0); // June 15, 2024 14:30:00
    const result = formatDateTime(date, 'en-US');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should use default locale', () => {
    const date = new Date('2024-01-01T10:00:00');
    const result = formatDateTime(date);
    expect(result).toBeTruthy();
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for recent times', () => {
    const date = new Date('2024-06-15T11:59:30');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const date = new Date('2024-06-15T11:55:00');
    expect(formatRelativeTime(date)).toBe('5 minutes ago');
  });

  it('should return singular minute', () => {
    const date = new Date('2024-06-15T11:59:00');
    expect(formatRelativeTime(date)).toBe('1 minute ago');
  });

  it('should return hours ago', () => {
    const date = new Date('2024-06-15T10:00:00');
    expect(formatRelativeTime(date)).toBe('2 hours ago');
  });

  it('should return singular hour', () => {
    const date = new Date('2024-06-15T11:00:00');
    expect(formatRelativeTime(date)).toBe('1 hour ago');
  });

  it('should return days ago', () => {
    const date = new Date('2024-06-13T12:00:00');
    expect(formatRelativeTime(date)).toBe('2 days ago');
  });

  it('should return singular day', () => {
    const date = new Date('2024-06-14T12:00:00');
    expect(formatRelativeTime(date)).toBe('1 day ago');
  });

  it('should return formatted date for older times', () => {
    const date = new Date('2024-06-01T12:00:00');
    expect(formatRelativeTime(date)).toContain('June');
  });
});

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should handle exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should handle empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('should handle already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });
});

describe('generateId', () => {
  it('should generate unique ids', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('should use default prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^id-/);
  });

  it('should use custom prefix', () => {
    const id = generateId('user');
    expect(id).toMatch(/^user-/);
  });
});

describe('isDefined', () => {
  it('should return true for defined values', () => {
    expect(isDefined('hello')).toBe(true);
    expect(isDefined(0)).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined([])).toBe(true);
  });

  it('should return false for null', () => {
    expect(isDefined(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isDefined(undefined)).toBe(false);
  });
});

describe('cn', () => {
  it('should join class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('should filter falsy values', () => {
    expect(cn('a', false, 'b', undefined, 'c', null)).toBe('a b c');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('formatBytes', () => {
  it('should format bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('should handle decimal values', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

describe('formatPercent', () => {
  it('should format percentage', () => {
    expect(formatPercent(0.5)).toBe('50.0%');
    expect(formatPercent(0.123)).toBe('12.3%');
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('should use custom decimals', () => {
    expect(formatPercent(0.5, 0)).toBe('50%');
    expect(formatPercent(0.123, 2)).toBe('12.30%');
  });
});

describe('formatNumber', () => {
  it('should format numbers with separators', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('should handle small numbers', () => {
    expect(formatNumber(123)).toBe('123');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce function calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the function', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('sortBy', () => {
  const data = [
    { name: 'Bob', age: 30 },
    { name: 'Alice', age: 25 },
    { name: 'Charlie', age: 35 },
  ];

  it('should sort ascending by default', () => {
    const result = sortBy(data, 'name');
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
    expect(result[2].name).toBe('Charlie');
  });

  it('should sort descending', () => {
    const result = sortBy(data, 'age', 'desc');
    expect(result[0].age).toBe(35);
    expect(result[1].age).toBe(30);
    expect(result[2].age).toBe(25);
  });

  it('should not mutate original array', () => {
    const original = [...data];
    sortBy(data, 'name');
    expect(data).toEqual(original);
  });
});

describe('filterBySearch', () => {
  const data = [
    { name: 'John Doe', email: 'john@example.com' },
    { name: 'Jane Smith', email: 'jane@test.com' },
    { name: 'Bob Wilson', email: 'bob@example.com' },
  ];

  it('should filter by search term', () => {
    const result = filterBySearch(data, 'john', ['name', 'email']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John Doe');
  });

  it('should be case insensitive', () => {
    const result = filterBySearch(data, 'JANE', ['name']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Jane Smith');
  });

  it('should search multiple keys', () => {
    const result = filterBySearch(data, 'example', ['email']);
    expect(result).toHaveLength(2);
  });

  it('should return all data for empty search', () => {
    const result = filterBySearch(data, '', ['name']);
    expect(result).toHaveLength(3);
  });
});

describe('getStatusColor', () => {
  it('should return success for active status', () => {
    expect(getStatusColor('active')).toBe('success');
    expect(getStatusColor('healthy')).toBe('success');
    expect(getStatusColor('success')).toBe('success');
  });

  it('should return warning for pending status', () => {
    expect(getStatusColor('pending')).toBe('warning');
    expect(getStatusColor('trial')).toBe('warning');
    expect(getStatusColor('degraded')).toBe('warning');
    expect(getStatusColor('partial')).toBe('warning');
  });

  it('should return error for error status', () => {
    expect(getStatusColor('suspended')).toBe('error');
    expect(getStatusColor('cancelled')).toBe('error');
    expect(getStatusColor('inactive')).toBe('error');
    expect(getStatusColor('critical')).toBe('error');
    expect(getStatusColor('failure')).toBe('error');
  });

  it('should return info for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('info');
  });
});

describe('getSeverityColor', () => {
  it('should return info for LOW', () => {
    expect(getSeverityColor('LOW')).toBe('info');
  });

  it('should return warning for MEDIUM', () => {
    expect(getSeverityColor('MEDIUM')).toBe('warning');
  });

  it('should return error for HIGH and CRITICAL', () => {
    expect(getSeverityColor('HIGH')).toBe('error');
    expect(getSeverityColor('CRITICAL')).toBe('error');
  });

  it('should return info for unknown', () => {
    expect(getSeverityColor('UNKNOWN')).toBe('info');
  });
});
