import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../logger.js';

/**
 * Parse Redis URL and return connection options
 * Supports both authenticated and non-authenticated Redis URLs
 * 
 * Examples:
 * - redis://localhost:6379/1 (no auth)
 * - redis://username:password@localhost:6379/1 (with auth)
 * - redis://default:password@localhost:6379/1 (default user with password)
 */
export function parseRedisUrl(redisUrl: string): RedisOptions {
  try {
    const url = new globalThis.URL(redisUrl);
    
    const options: RedisOptions = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || 6379,
      db: parseInt(url.pathname.slice(1)) || 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    // Handle authentication if present in URL
    if (url.username || url.password) {
      if (url.username && url.username !== 'default') {
        // ACL authentication (username + password)
        options.username = url.username;
        options.password = url.password;
      } else {
        // Legacy auth (password only) or default user
        options.password = url.password;
      }
    }

    return options;
  } catch (error) {
    logger.error('Failed to parse Redis URL:', error);
    // Fallback to simple localhost connection
    return {
      host: 'localhost',
      port: 6379,
      db: 0,
      maxRetriesPerRequest: null,
    };
  }
}

/**
 * Create a Redis connection with flexible authentication support
 */
export function createRedisConnection(redisUrl: string): Redis {
  const options = parseRedisUrl(redisUrl);
  
  const redis = new Redis(options);

  // Add connection event handlers
  redis.on('connect', () => {
    logger.info(`Redis connected to ${options.host}:${options.port}/${options.db}`);
  });

  redis.on('error', (error) => {
    logger.error('Redis connection error:', error);
  });

  redis.on('close', () => {
    logger.info('Redis connection closed');
  });

  return redis;
}

/**
 * Create Redis connection for BullMQ with specific options
 */
export function createRedisConnectionForQueue(redisUrl: string): Redis {
  const options = parseRedisUrl(redisUrl);
  
  // BullMQ specific options
  const queueOptions: RedisOptions = {
    ...options,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  };

  return new Redis(queueOptions);
}
