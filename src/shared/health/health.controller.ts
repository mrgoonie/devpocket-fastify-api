import { FastifyRequest, FastifyReply } from 'fastify';
import { HealthService } from './health.service.js';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Comprehensive health check endpoint
   */
  async getHealth(request: FastifyRequest, reply: FastifyReply) {
    try {
      const healthStatus = await this.healthService.getHealthStatus();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      
      reply.code(statusCode).send(healthStatus);
    } catch (error) {
      request.log.error('Health check error:', error);
      
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Kubernetes readiness probe endpoint
   */
  async getReadiness(request: FastifyRequest, reply: FastifyReply) {
    try {
      const readinessStatus = await this.healthService.getReadinessStatus();
      
      const statusCode = readinessStatus.ready ? 200 : 503;
      
      reply.code(statusCode).send({
        ready: readinessStatus.ready,
        timestamp: new Date().toISOString(),
        checks: readinessStatus.checks,
      });
    } catch (error) {
      request.log.error('Readiness check error:', error);
      
      reply.code(503).send({
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
      });
    }
  }

  /**
   * Kubernetes liveness probe endpoint
   */
  async getLiveness(request: FastifyRequest, reply: FastifyReply) {
    try {
      const livenessStatus = await this.healthService.getLivenessStatus();
      
      reply.send({
        alive: livenessStatus.alive,
        timestamp: new Date().toISOString(),
        uptime: livenessStatus.uptime,
        pid: process.pid,
        version: process.version,
      });
    } catch (error) {
      request.log.error('Liveness check error:', error);
      
      reply.code(503).send({
        alive: false,
        timestamp: new Date().toISOString(),
        error: 'Liveness check failed',
      });
    }
  }

  /**
   * Simple health check for load balancers
   */
  async getSimpleHealth(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  }
}