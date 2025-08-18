// Load test environment variables before any imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { beforeAll, afterAll } from 'vitest';
import { logger } from '@/shared/logger.js';

// Setup for tests
beforeAll(async () => {
  logger.info('Test environment setup complete');
});

afterAll(async () => {
  // Cleanup after tests
  logger.info('Test environment cleanup complete');
});