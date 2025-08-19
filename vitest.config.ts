import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    // Enhanced isolation settings to prevent database conflicts
    maxConcurrency: 1, // Only one test at a time
    isolate: true, // Isolate test processes to prevent shared state
    sequence: {
      shuffle: false, // Run tests in predictable order
      concurrent: false, // Run test files sequentially
    },
    // Increased timeouts for database operations
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 60000, // 60 seconds for setup/teardown hooks
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://devpocket_test:devpocket_test@localhost:5432/devpocket-fastify-api-test?schema=public',
      REDIS_URL: 'redis://localhost:6379/1',
      JWT_SECRET: 'test-super-secret-jwt-key-for-testing-only-min-32-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-testing-only-min-32-chars',
      ENCRYPTION_KEY: 'test-encryption-key-for-ssh-keys-testing-min-32-chars',
      REVENUECAT_WEBHOOK_SECRET: 'test-webhook-secret-for-revenuecat-testing',
      RESEND_API_KEY: 'test-resend-api-key-for-testing-purposes',
      FROM_EMAIL: 'test@devpocket.com',
      FRONTEND_URL: 'http://localhost:3000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'src/tests',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});