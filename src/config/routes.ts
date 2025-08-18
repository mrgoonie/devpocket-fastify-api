import type { FastifyInstance } from 'fastify';
import { authRoutes } from '@/modules/auth/auth.routes.js';
import { terminalRoutes } from '@/modules/terminal/terminal.routes.js';
import { paymentRoutes } from '@/modules/payment/payment.routes.js';
import { healthRoutes } from '@/shared/health/health.routes.js';

export async function setupRoutes(fastify: FastifyInstance) {
  // Health routes (no prefix, available at root)
  await fastify.register(healthRoutes);

  // API prefix
  await fastify.register(async function apiRoutes(fastify) {
    // Auth routes
    await fastify.register(authRoutes, { prefix: '/auth' });
    
    // Terminal routes (includes SSH and terminal session management)
    await fastify.register(terminalRoutes);
    
    // Payment routes (includes subscriptions and webhooks)
    await fastify.register(paymentRoutes);
    
    // Placeholder route for testing
    fastify.get('/test', {
      schema: {
        tags: ['Test'],
        summary: 'Test endpoint',
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    }, async () => {
      return {
        message: 'DevPocket API is running!',
        timestamp: new Date().toISOString(),
      };
    });
  }, { prefix: '/api/v1' });
}