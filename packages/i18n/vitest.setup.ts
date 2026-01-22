import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Store original values
const originalNavigatorLanguages = navigator.languages;

// Mock localStorage and cookies globally before each test
beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});

  // Reset navigator.languages to default
  Object.defineProperty(navigator, 'languages', {
    value: ['en-US', 'en'],
    configurable: true,
  });

  // Clear cookies
  document.cookie.split(';').forEach((cookie) => {
    const [name] = cookie.split('=');
    if (name) {
      document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();

  // Restore original navigator.languages
  Object.defineProperty(navigator, 'languages', {
    value: originalNavigatorLanguages,
    configurable: true,
  });

  // Clear cookies again
  document.cookie.split(';').forEach((cookie) => {
    const [name] = cookie.split('=');
    if (name) {
      document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
});
