// Load test environment variables before any imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { beforeAll, afterAll } from 'vitest';
import { logger } from '@/shared/logger.js';
import { prisma, disconnectDatabase } from '@/shared/database/client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let isSetupComplete = false;

// Global test setup - runs once for all test files
beforeAll(async () => {
  // Only run setup once across all test files
  if (isSetupComplete) {
    return;
  }

  try {
    logger.info('Setting up test environment...');
    
    // Wait for database to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Database connection failed after 30 retries: ${error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Ensure database schema exists
    try {
      await execAsync('DATABASE_URL="postgresql://postgres:postgresql@localhost:5432/devpocket_test?schema=public" npx prisma db push --force-reset --skip-generate');
    } catch (error) {
      logger.warn('Schema setup failed:', error);
      // Try without reset
      await execAsync('DATABASE_URL="postgresql://postgres:postgresql@localhost:5432/devpocket_test?schema=public" npx prisma db push --skip-generate');
    }

    isSetupComplete = true;
    logger.info('Test environment setup complete');
  } catch (error) {
    logger.error('Test setup failed:', error);
    throw error;
  }
});

// Global test cleanup
afterAll(async () => {
  try {
    logger.info('Cleaning up test environment...');
    await disconnectDatabase();
    logger.info('Test environment cleanup complete');
  } catch (error) {
    logger.error('Test cleanup failed:', error);
  }
});

// Helper function for tests to clean up their data
export async function cleanupTestData(): Promise<void> {
  try {
    // Clean up test data (but keep schema)
    const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    
    for (const { tablename } of tableNames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }
  } catch (error) {
    logger.warn('Test cleanup failed:', error);
    // If cleanup fails, the test data might still be in an inconsistent state
    // but we shouldn't fail the test
  }
}