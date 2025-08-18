import { prisma } from './client.js';
import { logger } from '@/shared/logger.js';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    logger.info('Starting database seeding...');

    // Create a test user for development
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const testUser = await prisma.user.upsert({
      where: { email: 'test@devpocket.com' },
      update: {},
      create: {
        email: 'test@devpocket.com',
        username: 'testuser',
        password_hash: hashedPassword,
        email_verified: true,
      },
    });

    logger.info(`Created test user: ${testUser.email}`);

    // Create a sample SSH profile for the test user
    const sshProfile = await prisma.sshProfile.upsert({
      where: { 
        user_id_name: {
          user_id: testUser.id,
          name: 'Local SSH'
        }
      },
      update: {},
      create: {
        user_id: testUser.id,
        name: 'Local SSH',
        host: 'localhost',
        port: 22,
        username: 'user',
        auth_type: 'PASSWORD',
      },
    });

    logger.info(`Created SSH profile: ${sshProfile.name}`);

    // Create usage limits for the test user
    const usageLimits = await prisma.usageLimits.upsert({
      where: { user_id: testUser.id },
      update: {},
      create: {
        user_id: testUser.id,
        plan_type: 'FREE',
        ssh_connections: 0,
        ai_requests: 0,
        reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    logger.info(`Created usage limits for user: ${usageLimits.plan_type}`);

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}

export { seed };