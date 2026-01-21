import { vi } from 'vitest';

// Mock timers for testing time-based functionality
vi.useFakeTimers({ shouldAdvanceTime: true });

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
