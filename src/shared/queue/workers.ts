import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '@/config/environment.js';
import { logger } from '@/shared/logger.js';

// Redis connection for workers
const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// Email worker - will be implemented with email service
export const emailWorker = new Worker(
  'email',
  async (job) => {
    const { type, data } = job.data;
    
    logger.info(`Processing email job: ${type}`, { jobId: job.id });
    
    try {
      switch (type) {
        case 'welcome':
          // await sendWelcomeEmail(data);
          logger.info('Welcome email would be sent here', data);
          break;
        case 'password-reset':
          // await sendPasswordResetEmail(data);
          logger.info('Password reset email would be sent here', data);
          break;
        case 'verification':
          // await sendVerificationEmail(data);
          logger.info('Verification email would be sent here', data);
          break;
        default:
          throw new Error(`Unknown email type: ${type}`);
      }
      
      logger.info(`Email job ${job.id} completed successfully`);
    } catch (error) {
      logger.error(`Email job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

// SSH cleanup worker
export const sshCleanupWorker = new Worker(
  'ssh-cleanup',
  async (job) => {
    const { sessionId, action } = job.data;
    
    logger.info(`Processing SSH cleanup job: ${action}`, { jobId: job.id, sessionId });
    
    try {
      switch (action) {
        case 'cleanup-session':
          // await cleanupSSHSession(sessionId);
          logger.info('SSH session cleanup would happen here', { sessionId });
          break;
        case 'close-connections':
          // await closeSSHConnections(sessionId);
          logger.info('SSH connections cleanup would happen here', { sessionId });
          break;
        default:
          throw new Error(`Unknown cleanup action: ${action}`);
      }
      
      logger.info(`SSH cleanup job ${job.id} completed successfully`);
    } catch (error) {
      logger.error(`SSH cleanup job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

// Graceful shutdown for workers
export async function closeWorkers() {
  await emailWorker.close();
  await sshCleanupWorker.close();
  await connection.quit();
  logger.info('All workers closed');
}