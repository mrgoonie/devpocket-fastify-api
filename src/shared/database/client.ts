import { PrismaClient } from '@prisma/client';
import { config } from '@/config/environment.js';
import { logger } from '@/shared/logger.js';

// Global Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with proper configuration
export const prisma = globalThis.__prisma || new PrismaClient({
  log: config.isDevelopment 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'pretty',
});

// In development, store the client globally to prevent multiple instances
if (config.isDevelopment) {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database connection closed');
}

// Health check for database
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
}