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
    
    // Debug environment variables
    logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`);
    logger.info(`REDIS_URL present: ${!!process.env.REDIS_URL}`);
    
    // Validate critical environment variables
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    if (!process.env.NODE_ENV) {
      throw new Error('NODE_ENV environment variable is required');
    }
    
    // Wait for database to be ready
    let retries = 30;
    logger.info('Waiting for database connection...');
    while (retries > 0) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info('Database connection successful');
        break;
      } catch (error) {
        retries--;
        logger.debug(`Database connection attempt failed (${30 - retries}/30): ${error instanceof Error ? error.message : error}`);
        if (retries === 0) {
          logger.error('Database connection failed after 30 retries. Last error:', error);
          throw new Error(`Database connection failed after 30 retries. Ensure PostgreSQL service is running and credentials are correct. Last error: ${error instanceof Error ? error.message : error}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Validate environment variables
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required for tests');
    }
    
    logger.info(`Using database: ${databaseUrl.replace(/\/\/[^@]+@/, '//***:***@')}`); // Hide credentials in logs

    // Ensure database schema exists
    try {
      await execAsync(`DATABASE_URL="${databaseUrl}" npx prisma db push --force-reset --skip-generate`);
      logger.info('Database schema reset successfully');
    } catch (error) {
      logger.warn('Schema setup failed:', error);
      // Try without reset
      try {
        await execAsync(`DATABASE_URL="${databaseUrl}" npx prisma db push --skip-generate`);
        logger.info('Database schema updated successfully');
      } catch (secondError) {
        logger.error('Database schema setup completely failed:', secondError);
        throw new Error('Cannot set up test database schema');
      }
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
    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Clean up test data in order to respect foreign key constraints
      // This order ensures child tables are cleaned before parent tables
      const deleteOperations = [
        () => tx.commandHistory.deleteMany(),
        () => tx.emailVerificationToken.deleteMany(),
        () => tx.passwordResetToken.deleteMany(),
        () => tx.paymentHistory.deleteMany(),
        () => tx.invoice.deleteMany(),
        () => tx.sshKey.deleteMany(),
        () => tx.terminalSession.deleteMany(),
        () => tx.session.deleteMany(),
        () => tx.usageLimits.deleteMany(),
        () => tx.subscription.deleteMany(),
        () => tx.sshProfile.deleteMany(),
        () => tx.user.deleteMany(),
      ];

      // Execute deletions in order
      for (const deleteOp of deleteOperations) {
        try {
          await deleteOp();
        } catch (error) {
          // Log but continue - table/model might not exist
          logger.debug(`Could not clean up table:`, error);
        }
      }
    }, {
      timeout: 30000, // 30 second timeout
    });
    
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));
  } catch (error) {
    logger.warn('Test cleanup failed:', error);
    // If cleanup fails, try a more aggressive approach
    try {
      // Disable foreign key checks temporarily
      await prisma.$executeRaw`SET session_replication_role = replica;`;
      
      // Truncate all tables
      const tables = [
        'command_history',
        'email_verification_tokens', 
        'password_reset_tokens',
        'payment_history',
        'invoices',
        'ssh_keys',
        'terminal_sessions',
        'sessions',
        'usage_limits',
        'subscriptions',
        'ssh_profiles',
        'users'
      ];
      
      for (const table of tables) {
        try {
          await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
        } catch (err) {
          // Table might not exist, continue
        }
      }
      
      // Re-enable foreign key checks
      await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
    } catch (fallbackError) {
      logger.error('Fallback cleanup also failed:', fallbackError);
    }
  }
}
