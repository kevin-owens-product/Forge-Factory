/**
 * @prompt-id forge-v4.1:feature:portal:001
 * @generated-at 2026-01-21T00:00:00Z
 * @model claude-opus-4-5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  truncate,
  capitalize,
  generateId,
  isDefined,
  cn,
} from '../index';

describe('formatDate', () => {
  it('should format date with default locale', () => {
    // Use explicit UTC time to avoid timezone issues
    const date = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    const result = formatDate(date);

    expect(result).toContain('January');
    expect(result).toContain('2024');
  });

  it('should format date with custom locale', () => {
    // Use explicit UTC time to avoid timezone issues
    const date = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    const result = formatDate(date, 'de-DE');

    expect(result).toContain('Januar');
    expect(result).toContain('2024');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for recent times', () => {
    const date = new Date('2024-01-15T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00Z');
    expect(formatRelativeTime(date)).toBe('5 minutes ago');
  });

  it('should return singular minute', () => {
    const date = new Date('2024-01-15T11:59:00Z');
    expect(formatRelativeTime(date)).toBe('1 minute ago');
  });

  it('should return hours ago', () => {
    const date = new Date('2024-01-15T09:00:00Z');
    expect(formatRelativeTime(date)).toBe('3 hours ago');
  });

  it('should return singular hour', () => {
    const date = new Date('2024-01-15T11:00:00Z');
    expect(formatRelativeTime(date)).toBe('1 hour ago');
  });

  it('should return days ago', () => {
    const date = new Date('2024-01-13T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('2 days ago');
  });

  it('should return singular day', () => {
    const date = new Date('2024-01-14T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('1 day ago');
  });

  it('should return formatted date for older dates', () => {
    const date = new Date('2024-01-01T12:00:00Z');
    const result = formatRelativeTime(date);
    expect(result).toContain('January');
    expect(result).toContain('2024');
  });
});

describe('truncate', () => {
  it('should return original string if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should return original string if equal to maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('should truncate and add ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should handle empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('should handle very short maxLength', () => {
    expect(truncate('hello', 4)).toBe('h...');
  });
});

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should handle already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  it('should handle single character', () => {
    expect(capitalize('h')).toBe('H');
  });

  it('should handle empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('should preserve rest of string', () => {
    expect(capitalize('hELLO')).toBe('HELLO');
  });
});

describe('generateId', () => {
  it('should generate id with default prefix', () => {
    const id = generateId();
    expect(id).toMatch(/^id-[a-z0-9]+$/);
  });

  it('should generate id with custom prefix', () => {
    const id = generateId('user');
    expect(id).toMatch(/^user-[a-z0-9]+$/);
  });

  it('should generate unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('isDefined', () => {
  it('should return true for defined values', () => {
    expect(isDefined('hello')).toBe(true);
    expect(isDefined(0)).toBe(true);
    expect(isDefined(false)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined([])).toBe(true);
    expect(isDefined({})).toBe(true);
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
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should filter out falsy values', () => {
    expect(cn('foo', false, 'bar', undefined, null, 'baz')).toBe('foo bar baz');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });

  it('should handle all falsy values', () => {
    expect(cn(false, undefined, null)).toBe('');
  });

  it('should handle single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
  });
});
