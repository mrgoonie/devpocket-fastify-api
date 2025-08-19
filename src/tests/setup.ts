// Load test environment variables before any imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { beforeAll, afterAll } from 'vitest';
import { logger } from '@/shared/logger.js';
import { prisma, disconnectDatabase } from '@/shared/database/client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Use a file-based lock to prevent concurrent setup
const fs = require('fs');
const path = require('path');
const lockFile = path.join(process.cwd(), '.test-setup.lock');

// Global test setup - runs once for all test processes
beforeAll(async () => {
  // Check if setup is already in progress or complete
  const maxWaitTime = 60000; // 60 seconds
  const startTime = Date.now();
  
  while (fs.existsSync(lockFile)) {
    if (Date.now() - startTime > maxWaitTime) {
      // Remove stale lock file and continue
      try {
        fs.unlinkSync(lockFile);
        break;
      } catch (error) {
        logger.warn('Could not remove stale lock file:', error);
      }
    }
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Create lock file to prevent concurrent setup
  try {
    fs.writeFileSync(lockFile, process.pid.toString());
  } catch (error) {
    // Another process might have created it first - wait and continue
    await new Promise(resolve => setTimeout(resolve, 1000));
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

    // Ensure database schema exists with proper error handling
    try {
      logger.info('Creating/updating database schema...');
      // Use db push to create schema from prisma file (better for tests without migrations)
      await execAsync(`DATABASE_URL="${databaseUrl}" npx prisma db push --force-reset --skip-generate`, {
        timeout: 30000 // 30 second timeout
      });
      logger.info('Database schema created successfully');
    } catch (error) {
      logger.warn('Schema creation failed, trying without force-reset:', error);
      try {
        await execAsync(`DATABASE_URL="${databaseUrl}" npx prisma db push --skip-generate`, {
          timeout: 30000
        });
        logger.info('Database schema updated successfully');
      } catch (secondError) {
        logger.error('All schema setup methods failed:', secondError);
        throw new Error('Cannot set up test database schema');
      }
    }

    // Verify schema was created properly
    try {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      `;
      const tableCount = tables.length;
      if (tableCount < 5) { // We should have at least users, sessions, etc.
        throw new Error(`Database schema incomplete - only ${tableCount} tables found`);
      }
      logger.info(`Database schema verified - ${tableCount} tables found`);
    } catch (error) {
      logger.error('Schema verification failed:', error);
      throw error;
    }

    logger.info('Test environment setup complete');
  } catch (error) {
    logger.error('Test setup failed:', error);
    throw error;
  } finally {
    // Remove lock file
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    } catch (error) {
      logger.warn('Could not remove lock file:', error);
    }
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
            const result = await tx.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
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