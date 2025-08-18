import type { FastifyInstance } from 'fastify';
import { authRoutes } from '@/modules/auth/auth.routes.js';

export async function setupRoutes(fastify: FastifyInstance) {
  // API prefix
  await fastify.register(async function apiRoutes(fastify) {
    // Auth routes
    await fastify.register(authRoutes, { prefix: '/auth' });
    
    // SSH routes - will be implemented in terminal module  
    // await fastify.register(sshRoutes, { prefix: '/ssh' });
    
    // Terminal routes - will be implemented in terminal module
    // await fastify.register(terminalRoutes, { prefix: '/terminal' });
    
    // Payment routes - will be implemented in payment module
    // await fastify.register(paymentRoutes, { prefix: '/subscriptions' });
    
    // Webhook routes - will be implemented in payment module
    // await fastify.register(webhookRoutes, { prefix: '/webhooks' });
    
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