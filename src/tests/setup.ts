// Load test environment variables before any imports
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

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

// Database connection verification
async function verifyDatabaseConnection(): Promise<void> {
  const maxRetries = process.env.CI ? 5 : 3;
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        logger.debug(`Database connection verification attempt ${attempt}/${maxRetries}`);
      }
      
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1 as connected`;
      
      // Test database readiness by checking if we can query system tables
      await prisma.$queryRaw`SELECT current_database()`;
      
      logger.debug('Database connection verified successfully');
      return;
    } catch (error) {
      lastError = error;
      logger.warn(`Database connection attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${lastError}`);
      }
    }
  }
}

// Global mock cleanup - runs after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Setup test environment with server instance isolation
beforeAll(async () => {
  try {
    logger.info('Verifying database connection...');
    await verifyDatabaseConnection();
    
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
    
    // Add delay before database disconnect to ensure all operations complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await disconnectDatabase();
    
    // Add delay after cleanup to ensure complete isolation between test files
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info('Test environment cleanup complete');
  } catch (error) {
    logger.error('Test cleanup failed:', error);
  }
});

// Global mutex implementation to prevent concurrent database operations across all test files

class DatabaseMutex {
  private mutex: Promise<void> = Promise.resolve();
  private lockFile = path.join(process.cwd(), '.test-db-lock');
  
  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const currentMutex = this.mutex;
    let resolve: () => void;
    
    // Create a new promise that will be resolved when this operation completes
    this.mutex = new Promise<void>((res) => {
      resolve = res;
    });
    
    try {
      // Wait for previous operation to complete
      await currentMutex;
      
      // Acquire file lock
      await this.acquireFileLock();
      
      try {
        // Execute the operation
        const result = await operation();
        return result;
      } finally {
        // Release file lock
        await this.releaseFileLock();
      }
    } finally {
      // Release the mutex
      resolve!();
    }
  }
  
  private async acquireFileLock(): Promise<void> {
    const maxAttempts = 30; // 30 seconds max wait
    const delay = 1000; // 1 second between attempts
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Try to create lock file exclusively
        await fs.writeFile(this.lockFile, process.pid.toString(), { flag: 'wx' });
        return; // Success
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock file exists, check if the process is still running
          try {
            const pidStr = await fs.readFile(this.lockFile, 'utf8');
            const pid = parseInt(pidStr);
            
            // Check if process is still running
            try {
              process.kill(pid, 0); // Signal 0 just checks if process exists
              // Process exists, wait and retry
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            } catch {
              // Process doesn't exist, remove stale lock file
              await fs.unlink(this.lockFile);
              continue; // Retry acquiring lock
            }
          } catch {
            // Can't read lock file, remove it and retry
            await fs.unlink(this.lockFile);
            continue;
          }
        }
        throw error; // Other errors
      }
    }
    
    throw new Error('Could not acquire database lock after 30 seconds');
  }
  
  private async releaseFileLock(): Promise<void> {
    try {
      await fs.unlink(this.lockFile);
    } catch {
      // Ignore errors when releasing lock
    }
  }
}

const globalDatabaseMutex = new DatabaseMutex();

// Complete database reset function for test isolation
export async function resetDatabase(): Promise<void> {
  return globalDatabaseMutex.runExclusive(resetDatabaseInternal);
}


async function resetDatabaseInternal(): Promise<void> {
  try {
    logger.debug('Starting complete database reset...');
    
    // Simple but effective: Use TRUNCATE CASCADE for fastest reset
    // File lock ensures no concurrency issues
    await prisma.$transaction(async (tx) => {
      // Get all table names (excluding system tables)
      const tables = await tx.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%' 
        AND tablename != '_prisma_migrations'
      `;
      
      // Disable foreign key checks temporarily
      await tx.$executeRawUnsafe('SET session_replication_role = replica;');
      
      // Truncate all tables at once - faster and more reliable
      if (tables.length > 0) {
        const tableNames = tables.map(t => `"${t.tablename}"`).join(', ');
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
      }
      
      // Re-enable foreign key checks
      await tx.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      
    }, {
      timeout: 10000, // Shorter timeout since we're using TRUNCATE
      isolationLevel: 'ReadCommitted'
    });
    
    logger.debug('Database reset completed successfully');
    
  } catch (error) {
    logger.error('Database reset failed:', error);
    throw error;
  }
}

// Helper function for tests to clean up their data (selective cleanup for authentication tests)
export async function cleanupTestData(options: { cleanAuthData?: boolean } = {}): Promise<void> {
  // Only clean auth-related data if explicitly requested to prevent race conditions
  if (options.cleanAuthData) {
    try {
      logger.debug('Cleaning up auth test data...');
      
      // Use transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Clean up sessions first (foreign key dependency)
        await tx.session.deleteMany({
          where: {
            created_at: {
              // Only delete sessions created in the last 5 minutes (test sessions)
              gte: new Date(Date.now() - 5 * 60 * 1000)
            }
          }
        });
        
        // Clean up test users (identified by email pattern)
        await tx.user.deleteMany({
          where: {
            OR: [
              { email: { contains: 'test-' } },
              { username: { startsWith: 'testuser_' } }
            ]
          }
        });
      }, {
        timeout: process.env.CI ? 10000 : 5000,
        isolationLevel: 'ReadCommitted'
      });
      
      logger.debug('Auth test data cleanup complete');
    } catch (error) {
      logger.warn('Failed to clean up auth test data:', error);
      // Non-critical, continue with tests
    }
  }
  
  return Promise.resolve();
}
