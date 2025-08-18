import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export class HealthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis
  ) {}

  async getHealthStatus(): Promise<HealthCheckResult> {
    // const startTime = Date.now(); // For future performance monitoring
    
    const [database, redis, memory, disk] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMemory(),
      this.checkDisk(),
    ]);

    const allHealthy = [database, redis, memory, disk].every(check => check.status === 'healthy');

    return {
      status: allHealthy ? 'ok' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database,
        redis,
        memory,
        disk,
      },
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        message: 'Database connection successful',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        message: 'Redis connection successful',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Redis connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const freeMemory = totalMemory - usedMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      const isHealthy = memoryUsagePercent < 90; // Alert if memory usage > 90%

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Memory usage is normal' : 'High memory usage detected',
        details: {
          totalMemory,
          usedMemory,
          freeMemory,
          usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Memory check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async checkDisk(): Promise<HealthCheck> {
    try {
      // Simple disk check - in production, you might want to use a proper disk usage library
      const stats = await import('fs/promises').then(fs => fs.stat('.'));
      
      return {
        status: 'healthy',
        message: 'Disk access successful',
        details: {
          lastModified: stats.mtime,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Disk access failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getReadinessStatus(): Promise<{ ready: boolean; checks: Record<string, HealthCheck> }> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ready = database.status === 'healthy' && redis.status === 'healthy';

    return {
      ready,
      checks: {
        database,
        redis,
      },
    };
  }

  async getLivenessStatus(): Promise<{ alive: boolean; uptime: number }> {
    // Simple liveness check - if the process is running, it's alive
    return {
      alive: true,
      uptime: process.uptime(),
    };
  }
}