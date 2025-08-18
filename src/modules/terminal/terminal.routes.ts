// Temporary stub for terminal routes to allow compilation
// TODO: Fix WebSocket and Zod schema integration issues

import { FastifyInstance } from 'fastify';

export async function terminalRoutes(fastify: FastifyInstance) {
  // Placeholder route
  fastify.get('/terminal/placeholder', {
    schema: {
      tags: ['Terminal (Disabled)'],
      summary: 'Placeholder - Terminal functionality disabled',
      description: 'Terminal routes are temporarily disabled for compilation fixes',
      response: {
        503: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (_request, reply) => {
    return reply.code(503).send({
      error: 'Service Unavailable',
      message: 'Terminal functionality is temporarily disabled'
    });
  });
}