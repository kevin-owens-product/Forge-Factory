import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '__tests__/',
        '**/*.d.ts',
        'vitest.config.ts',
        'src/index.ts',
        'src/external.d.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,  // XML parsing has many edge cases that are hard to fully test
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@forge/errors': path.resolve(__dirname, '../errors/src'),
      '@forge/auth': path.resolve(__dirname, '../auth/src'),
    },
  },
});
