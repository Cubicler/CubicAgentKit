import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: ['tests/integration/setup.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    env: {
      CUBICLER_URL: 'http://localhost:1504',
      TEST_TIMEOUT: '30000'
    }
  }
});
