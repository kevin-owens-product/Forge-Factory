/**
 * Vitest global setup for @forge/storage
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Setup global test environment
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup
});
