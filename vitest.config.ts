import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.d.ts',
        '**/types.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@forge/shared-types': path.resolve(__dirname, './packages/shared-types/src'),
      '@forge/errors': path.resolve(__dirname, './packages/errors/src'),
      '@forge/prisma': path.resolve(__dirname, './packages/prisma/src'),
      '@forge/database': path.resolve(__dirname, './packages/database/src'),
    },
  },
});
