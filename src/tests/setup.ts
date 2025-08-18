import { beforeAll, afterAll } from 'vitest';
import { logger } from '@/shared/logger.js';

// Setup for tests
beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://devpocket_test:devpocket_test@localhost:5432/devpocket-fastify-api-test?schema=public';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-super-secret-jwt-key-for-testing-only-min-32-chars';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only-min-32-chars';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-ssh-keys-testing-min-32-chars';
  
  logger.info('Test environment setup complete');
});

afterAll(async () => {
  // Cleanup after tests
  logger.info('Test environment cleanup complete');
});