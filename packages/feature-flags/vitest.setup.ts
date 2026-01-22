import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
