import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { terminalController } from './terminal.controller.js';
import { PaymentService } from '../payment/payment.service.js';
import { AuthenticatedRequest } from '../auth/auth.middleware.js';
import { checkSshUsageLimit } from '../payment/payment.middleware.js';

export async function terminalRoutes(fastify: FastifyInstance) {
  // Initialize payment service for usage enforcement
  const paymentService = new PaymentService(fastify.prisma);

  // Helper function to wrap authenticated middleware
  const wrapAuthenticatedMiddleware = (middleware: (_request: AuthenticatedRequest, _reply: FastifyReply) => Promise<void>) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      return middleware(request as AuthenticatedRequest, reply);
    };
  };

  // Helper function to wrap authenticated route handlers
  const wrapAuthenticatedHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
    handler: (_request: AuthenticatedRequest & T, _reply: FastifyReply) => Promise<void>
  ) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      return handler(request as AuthenticatedRequest & T, reply);
    };
  };

  // SSH Profile Management Routes
  fastify.post('/ssh/profiles', {
    preHandler: [
      fastify.authenticate,
      wrapAuthenticatedMiddleware(checkSshUsageLimit(paymentService))
    ],
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Create SSH profile',
      description: 'Create a new SSH profile with encrypted key storage',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          host: { type: 'string' },
          port: { type: 'number' },
          username: { type: 'string' },
          auth_type: { type: 'string', enum: ['PASSWORD', 'SSH_KEY', 'SSH_KEY_WITH_PASSPHRASE'] },
          password: { type: 'string' },
          private_key: { type: 'string' },
          public_key: { type: 'string' },
          passphrase: { type: 'string' }
        },
        required: ['name', 'host', 'port', 'username', 'auth_type']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.createSshProfile.bind(terminalController)));

  fastify.get('/ssh/profiles', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'List SSH profiles',
      description: 'Get all SSH profiles for the authenticated user'
    }
  }, wrapAuthenticatedHandler(terminalController.getSshProfiles.bind(terminalController)));

  fastify.get('/ssh/profiles/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Get SSH profile',
      description: 'Get a specific SSH profile by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.getSshProfile.bind(terminalController)));

  fastify.put('/ssh/profiles/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Update SSH profile',
      description: 'Update an existing SSH profile',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.updateSshProfile.bind(terminalController)));

  fastify.delete('/ssh/profiles/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Delete SSH profile',
      description: 'Delete an SSH profile and all associated data',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.deleteSshProfile.bind(terminalController)));

  fastify.post('/ssh/test-connection', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Test SSH connection',
      description: 'Test SSH connection without saving the profile'
    }
  }, wrapAuthenticatedHandler(terminalController.testSshConnection.bind(terminalController)));

  // Terminal Session Management Routes
  fastify.post('/terminal/sessions', {
    preHandler: [
      fastify.authenticate,
      wrapAuthenticatedMiddleware(checkSshUsageLimit(paymentService))
    ],
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Create terminal session',
      description: 'Create a new terminal session (local or SSH)'
    }
  }, wrapAuthenticatedHandler(terminalController.createTerminalSession.bind(terminalController)));

  fastify.get('/terminal/sessions', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'List terminal sessions',
      description: 'Get all terminal sessions for the authenticated user'
    }
  }, wrapAuthenticatedHandler(terminalController.getTerminalSessions.bind(terminalController)));

  fastify.get('/terminal/sessions/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Get terminal session',
      description: 'Get a specific terminal session by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.getTerminalSession.bind(terminalController)));

  fastify.delete('/terminal/sessions/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Delete terminal session',
      description: 'Terminate and delete a terminal session',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.deleteTerminalSession.bind(terminalController)));

  fastify.get('/terminal/sessions/:id/history', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Get command history',
      description: 'Get command history for a terminal session',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, wrapAuthenticatedHandler(terminalController.getCommandHistory.bind(terminalController)));

  // Terminal Statistics Route
  fastify.get('/terminal/stats', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Get terminal statistics',
      description: 'Get current terminal connection and session statistics'
    }
  }, wrapAuthenticatedHandler(terminalController.getTerminalStats.bind(terminalController)));
}