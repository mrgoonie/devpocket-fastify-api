import { Queue, QueueEvents } from 'bullmq';
import { config } from '@/config/environment.js';
import { logger } from '@/shared/logger.js';
import { createRedisConnectionForQueue } from '@/shared/redis/redis-connection.js';

// Redis connection for BullMQ
const connection = createRedisConnectionForQueue(config.REDIS_URL);

// Email queue for async email processing
export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 10,
    removeOnFail: 5,
  },
});

// SSH cleanup queue for managing connections
export const sshCleanupQueue = new Queue('ssh-cleanup', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: 5,
    removeOnFail: 3,
  },
});

// Queue events for monitoring
const emailQueueEvents = new QueueEvents('email', { connection });
const sshCleanupQueueEvents = new QueueEvents('ssh-cleanup', { connection });

// Email queue event handlers
emailQueueEvents.on('completed', (jobId) => {
  logger.info(`Email job ${jobId} completed`);
});

emailQueueEvents.on('failed', (jobId, err) => {
  logger.error(`Email job ${jobId} failed:`, err);
});

// SSH cleanup queue event handlers
sshCleanupQueueEvents.on('completed', (jobId) => {
  logger.info(`SSH cleanup job ${jobId} completed`);
});

sshCleanupQueueEvents.on('failed', (jobId, err) => {
  logger.error(`SSH cleanup job ${jobId} failed:`, err);
});

// Graceful shutdown
export async function closeQueues() {
  await emailQueue.close();
  await sshCleanupQueue.close();
  await emailQueueEvents.close();
  await sshCleanupQueueEvents.close();
  await connection.quit();
  logger.info('All queues closed');
}