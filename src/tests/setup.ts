// Load test environment variables before any imports
import { config } from 'dotenv';
import path from 'path';

// Set environment variables for testing
const workerId = process.env.VITEST_WORKER_ID || '1';
const baseDatabaseUrl = 'postgresql://devpocket_test:devpocket_test@localhost:5433';
const databaseName = `devpocket-fastify-api-test-${workerId}`;

process.env.DATABASE_URL = `${baseDatabaseUrl}/${databaseName}`;
// Use a different Redis database for each worker to avoid conflicts
process.env.REDIS_URL = `redis://localhost:6380/${workerId}`;

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

import { afterAll, afterEach } from 'vitest';
import { logger } from '@/shared/logger.js';
import { prisma, disconnectDatabase } from '@/shared/database/client.js';

// Global mock cleanup - runs after each test
afterEach(() => {
  vi.restoreAllMocks();
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

// Mutex to prevent concurrent cleanups
let cleanupMutex: Promise<void> = Promise.resolve();

// Helper function for tests to clean up their data
export async function cleanupTestData(): Promise<void> {
  // Wait for any previous cleanup to complete
  await cleanupMutex;
  
  // Create new cleanup promise
  cleanupMutex = cleanupTestDataInternal();
  
  // Wait for this cleanup to complete
  await cleanupMutex;
}

async function cleanupTestDataInternal(): Promise<void> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      attempt++;
      
      // Use a transaction for atomic cleanup
      await prisma.$transaction(async (tx) => {
        // First, check if tables exist
        const existingTables = await tx.$queryRaw<Array<{ tablename: string }>>`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
        `;
        
        const tableNames = existingTables.map(t => t.tablename);
        
        if (tableNames.length === 0) {
          logger.debug('No tables found for cleanup - database might not be initialized');
          return;
        }
        
        // Clean up test data in correct order to respect foreign key constraints
        // Child tables first, then parent tables
        const cleanupOrder = [
          'command_history',      // References terminal_sessions
          'ssh_keys',            // References ssh_profiles  
          'terminal_sessions',   // References users, ssh_profiles
          'email_verification_tokens', // References users
          'password_reset_tokens',     // References users
          'sessions',            // References users
          'invoices',           // References subscriptions
          'payment_history',    // References users
          'usage_limits',       // References users  
          'subscriptions',      // References users
          'ssh_profiles',       // References users
          'users'              // No dependencies
        ];

        // Only clean tables that actually exist
        const tablesToClean = cleanupOrder.filter(table => tableNames.includes(table));
        
        if (tablesToClean.length === 0) {
          logger.debug('No known tables found for cleanup');
          return;
        }

        logger.debug(`Cleaning up ${tablesToClean.length} tables: ${tablesToClean.join(', ')}`);

        // Delete records in the correct order (respecting foreign keys)
        for (const tableName of tablesToClean) {
          try {
            await tx.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
            logger.debug(`Cleaned table ${tableName}`);
          } catch (error) {
            logger.debug(`Could not clean table ${tableName}:`, error);
            // For some tables this might be expected, so continue
          }
        }

        // Reset sequences to ensure clean IDs for next tests
        for (const tableName of tablesToClean) {
          try {
            await tx.$executeRawUnsafe(`
              SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), 1, false) 
              WHERE pg_get_serial_sequence('"${tableName}"', 'id') IS NOT NULL
            `);
          } catch (error) {
            // Some tables might not have serial sequences, ignore
            logger.debug(`Could not reset sequence for ${tableName}:`, error);
          }
        }
      }, {
        timeout: 10000, // 10 second timeout for cleanup transaction
      });

      logger.debug('Test data cleanup completed successfully');
      return; // Success, exit retry loop
      
    } catch (error) {
      logger.warn(`Test cleanup attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        logger.error('All cleanup attempts failed, continuing anyway');
        return;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
