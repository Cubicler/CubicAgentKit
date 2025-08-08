import { defineConfig } from 'vitest/config';

const singleThread = process.env.VITEST_SINGLE_THREAD === 'true';
const pool = (process.env.VITEST_POOL as 'threads' | 'forks' | undefined) || 'threads';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    pool,
    poolOptions: {
      threads: { singleThread },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/mocks/',
        'tests/integration/'
      ]
    }
  }
});
