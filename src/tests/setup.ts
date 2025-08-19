// Load test environment variables before any imports
import { config } from 'dotenv';
import path from 'path';

// // Set environment variables for testing
// const workerId = process.env.VITEST_WORKER_ID || '1';
// const baseDatabaseUrl = 'postgresql://devpocket_test:devpocket_test@localhost:5432';
// const databaseName = `devpocket-fastify-api-test-${workerId}`;

// process.env.DATABASE_URL = `${baseDatabaseUrl}/${databaseName}`;
// // Use a different Redis database for each worker to avoid conflicts
// process.env.REDIS_URL = `redis://localhost:6379/${workerId}`;

// Load any other environment variables from .env.test if it exists
config({ path: path.resolve(process.cwd(), '.env.test') });

// Mock EmailService to prevent actual email sending during tests
import { vi } from 'vitest';
vi.mock('@/shared/email/email.service.js', () => ({
  EmailService: {
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import { afterAll, afterEach, beforeAll } from 'vitest';
import { logger } from '@/shared/logger.js';
import { prisma, disconnectDatabase } from '@/shared/database/client.js';

// Global mock cleanup - runs after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Setup test environment with server instance isolation
beforeAll(async () => {
  try {
    logger.info('Resetting database for test suite...');
    await resetDatabase();
    logger.info('Database reset complete');
    
    // Clean up any existing Fastify instances to prevent plugin conflicts
    const { cleanupTestApps } = await import('@/tests/helper.js');
    await cleanupTestApps();
    
    // Longer delay to ensure database and server cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    logger.error('Failed to setup test environment:', error);
    throw error;
  }
}, 60000); // 60 second timeout

// Global test cleanup
afterAll(async () => {
  try {
    logger.info('Cleaning up test environment...');
    
    // Clean up any remaining Fastify instances
    const { cleanupTestApps } = await import('@/tests/helper.js');
    await cleanupTestApps();
    
    await disconnectDatabase();
    logger.info('Test environment cleanup complete');
  } catch (error) {
    logger.error('Test cleanup failed:', error);
  }
});

// Global mutex to prevent concurrent database operations across all test files
let globalDatabaseMutex: Promise<void> = Promise.resolve();

// Complete database reset function for test isolation
export async function resetDatabase(): Promise<void> {
  await globalDatabaseMutex;
  globalDatabaseMutex = resetDatabaseInternal();
  await globalDatabaseMutex;
}


async function resetDatabaseInternal(): Promise<void> {
  try {
    logger.debug('Starting complete database reset...');
    
    // Drop all data and reset sequences
    await prisma.$transaction(async (tx) => {
      // Disable foreign key checks temporarily
      await tx.$executeRawUnsafe('SET session_replication_role = replica;');
      
      // Get all table names (excluding system tables)
      const tables = await tx.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%' 
        AND tablename != '_prisma_migrations'
      `;
      
      // Truncate all tables
      for (const { tablename } of tables) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`);
      }
      
      // Re-enable foreign key checks
      await tx.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }, {
      timeout: 30000, // 30 second timeout
    });
    
    logger.debug('Database reset completed successfully');
    
  } catch (error) {
    logger.error('Database reset failed:', error);
    throw error;
  }
}

// Helper function for tests to clean up their data (disabled to prevent race conditions)
export async function cleanupTestData(): Promise<void> {
  // Completely disabled to prevent foreign key violations during test execution
  // Database is only reset once per test file at the beginning
  return Promise.resolve();
}
