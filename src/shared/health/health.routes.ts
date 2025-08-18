import { FastifyInstance } from 'fastify';
import { HealthService } from './health.service.js';
import { HealthController } from './health.controller.js';
import Redis from 'ioredis';

export async function healthRoutes(fastify: FastifyInstance) {
  // Initialize health service
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const healthService = new HealthService(fastify.prisma, redis);
  const healthController = new HealthController(healthService);

  // Comprehensive health check
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Comprehensive health check',
      description: 'Returns detailed health status of all system components',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            checks: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'unhealthy'] },
                    responseTime: { type: 'number' },
                    message: { type: 'string' }
                  }
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'unhealthy'] },
                    responseTime: { type: 'number' },
                    message: { type: 'string' }
                  }
                },
                memory: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'unhealthy'] },
                    message: { type: 'string' }
                  }
                },
                disk: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'unhealthy'] },
                    message: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, healthController.getHealth.bind(healthController));

  // Kubernetes readiness probe
  fastify.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description: 'Kubernetes readiness probe endpoint - checks if app is ready to serve traffic',
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            checks: { type: 'object' }
          }
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean', example: false },
            timestamp: { type: 'string', format: 'date-time' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, healthController.getReadiness.bind(healthController));

  // Kubernetes liveness probe
  fastify.get('/health/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description: 'Kubernetes liveness probe endpoint - checks if app is alive',
      response: {
        200: {
          type: 'object',
          properties: {
            alive: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
            pid: { type: 'number' },
            version: { type: 'string' }
          }
        }
      }
    }
  }, healthController.getLiveness.bind(healthController));

  // Simple health check for load balancers
  fastify.get('/ping', {
    schema: {
      tags: ['Health'],
      summary: 'Simple ping endpoint',
      description: 'Simple health check for load balancers and monitoring',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, healthController.getSimpleHealth.bind(healthController));
}