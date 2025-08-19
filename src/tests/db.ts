import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/shared/logger.js';

const execAsync = promisify(exec);

// Ensure a clean database for each test file
export async function setupTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for tests');
  }

  logger.info(`Resetting test database: ${databaseUrl.replace(/\/\/[^@]+@/, '//***:***@')}`);

  try {
    // Use db push to create schema from prisma file (better for tests without migrations)
    await execAsync(`DATABASE_URL="${databaseUrl}" npx prisma db push --force-reset --skip-generate`, {
      timeout: 30000, // 30 second timeout
    });
    logger.info('Test database reset successfully');
  } catch (error) {
    logger.error('Failed to reset test database:', error);
    throw new Error('Cannot set up test database schema');
  }
}
