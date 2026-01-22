import { vi } from 'vitest';

vi.useFakeTimers({ shouldAdvanceTime: true });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
