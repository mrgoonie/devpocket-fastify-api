import { FastifyInstance } from 'fastify';
import { terminalController } from './terminal.controller.js';
import { terminalWebSocketHandler } from './websocket.handler.js';
import { PaymentService } from '../payment/payment.service.js';
import { 
  checkSshUsageLimit,
} from '../payment/payment.middleware.js';
import { 
  CreateSshProfileSchema,
  UpdateSshProfileSchema,
  SshProfileParamsSchema,
  TestSshConnectionSchema,
  CreateTerminalSessionSchema,
  TerminalSessionParamsSchema,
  GetCommandHistoryQuerySchema,
  SshProfileResponseSchema,
  SshProfileListResponseSchema,
  SshTestResponseSchema,
  TerminalSessionResponseSchema,
  TerminalSessionListResponseSchema,
  CommandHistoryListResponseSchema,
  WebSocketMessageSchema
} from './terminal.schema.js';

export async function terminalRoutes(fastify: FastifyInstance) {
  // Initialize payment service for usage enforcement
  const paymentService = new PaymentService(fastify.prisma);

  // SSH Profile Management Routes
  fastify.post('/ssh/profiles', {
    preHandler: [
      fastify.authenticate,
      checkSshUsageLimit(paymentService)
    ],
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Create SSH profile',
      description: 'Create a new SSH profile with encrypted key storage',
      body: CreateSshProfileSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: SshProfileResponseSchema
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Invalid SSH key format' }
          }
        },
        409: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'SSH profile with this name already exists' }
          }
        }
      }
    }
  }, terminalController.createSshProfile.bind(terminalController));

  fastify.get('/ssh/profiles', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'List SSH profiles',
      description: 'Get all SSH profiles for the authenticated user',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: SshProfileListResponseSchema
          }
        }
      }
    }
  }, terminalController.getSshProfiles.bind(terminalController));

  fastify.get('/ssh/profiles/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Get SSH profile',
      description: 'Get a specific SSH profile by ID',
      params: SshProfileParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: SshProfileResponseSchema
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'SSH profile not found or access denied' }
          }
        }
      }
    }
  }, terminalController.getSshProfile.bind(terminalController));

  fastify.put('/ssh/profiles/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Update SSH profile',
      description: 'Update an existing SSH profile',
      params: SshProfileParamsSchema,
      body: UpdateSshProfileSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: SshProfileResponseSchema
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'SSH profile not found or access denied' }
          }
        },
        409: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'SSH profile with this name already exists' }
          }
        }
      }
    }
  }, terminalController.updateSshProfile.bind(terminalController));

  fastify.delete('/ssh/profiles/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Delete SSH profile',
      description: 'Delete an SSH profile and all associated data',
      params: SshProfileParamsSchema,
      response: {
        204: {
          type: 'null',
          description: 'SSH profile deleted successfully'
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'SSH profile not found or access denied' }
          }
        }
      }
    }
  }, terminalController.deleteSshProfile.bind(terminalController));

  fastify.post('/ssh/test-connection', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['SSH Profiles'],
      summary: 'Test SSH connection',
      description: 'Test SSH connection without saving the profile',
      body: TestSshConnectionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: SshTestResponseSchema
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Connection failed: timeout' }
          }
        }
      }
    }
  }, terminalController.testSshConnection.bind(terminalController));

  // Terminal Session Management Routes
  fastify.post('/terminal/sessions', {
    preHandler: [
      fastify.authenticate,
      checkSshUsageLimit(paymentService)
    ],
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Create terminal session',
      description: 'Create a new terminal session (local or SSH)',
      body: CreateTerminalSessionSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: TerminalSessionResponseSchema
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'SSH profile not found or access denied' }
          }
        }
      }
    }
  }, terminalController.createTerminalSession.bind(terminalController));

  fastify.get('/terminal/sessions', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'List terminal sessions',
      description: 'Get all terminal sessions for the authenticated user',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: TerminalSessionListResponseSchema
          }
        }
      }
    }
  }, terminalController.getTerminalSessions.bind(terminalController));

  fastify.get('/terminal/sessions/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Get terminal session',
      description: 'Get a specific terminal session by ID',
      params: TerminalSessionParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: TerminalSessionResponseSchema
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Terminal session not found or access denied' }
          }
        }
      }
    }
  }, terminalController.getTerminalSession.bind(terminalController));

  fastify.delete('/terminal/sessions/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Delete terminal session',
      description: 'Terminate and delete a terminal session',
      params: TerminalSessionParamsSchema,
      response: {
        204: {
          type: 'null',
          description: 'Terminal session deleted successfully'
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Terminal session not found or access denied' }
          }
        }
      }
    }
  }, terminalController.deleteTerminalSession.bind(terminalController));

  fastify.get('/terminal/sessions/:id/history', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Get command history',
      description: 'Get command history for a terminal session',
      params: TerminalSessionParamsSchema,
      querystring: GetCommandHistoryQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: CommandHistoryListResponseSchema
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Terminal session not found or access denied' }
          }
        }
      }
    }
  }, terminalController.getCommandHistory.bind(terminalController));

  // Terminal Statistics Route
  fastify.get('/terminal/stats', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Terminal Sessions'],
      summary: 'Get terminal statistics',
      description: 'Get current terminal connection and session statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                pty_sessions: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', example: 5 },
                    active: { type: 'number', example: 3 },
                    inactive: { type: 'number', example: 2 }
                  }
                },
                ssh_connections: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', example: 2 },
                    active: { type: 'number', example: 1 },
                    idle: { type: 'number', example: 1 }
                  }
                },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, terminalController.getTerminalStats.bind(terminalController));

  // WebSocket Terminal Route
  fastify.register(async (fastify) => {
    fastify.get('/terminal/ws', {
      websocket: true,
      schema: {
        tags: ['WebSocket'],
        summary: 'Terminal WebSocket',
        description: 'Real-time terminal communication via WebSocket',
        querystring: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token'
            }
          }
        }
      }
    }, async (connection, request) => {
      await terminalWebSocketHandler.handleConnection(connection, request);
    });
  });

  // WebSocket Message Documentation (for OpenAPI)
  fastify.get('/terminal/ws/messages', {
    schema: {
      tags: ['WebSocket'],
      summary: 'WebSocket message types',
      description: 'Documentation of WebSocket message formats',
      response: {
        200: {
          type: 'object',
          properties: {
            message_types: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  description: { type: 'string' },
                  schema: WebSocketMessageSchema
                }
              }
            }
          }
        }
      }
    }
  }, async (_request, reply) => {
    reply.send({
      message_types: [
        {
          type: 'create_pty',
          description: 'Create a new PTY session',
          required_fields: ['type', 'cols', 'rows'],
          optional_fields: ['shell', 'cwd']
        },
        {
          type: 'connect_ssh',
          description: 'Create SSH connection with PTY',
          required_fields: ['type', 'profileId', 'cols', 'rows']
        },
        {
          type: 'pty_input',
          description: 'Send input to PTY session',
          required_fields: ['type', 'sessionId', 'data']
        },
        {
          type: 'resize_pty',
          description: 'Resize PTY session',
          required_fields: ['type', 'sessionId', 'cols', 'rows']
        },
        {
          type: 'kill_session',
          description: 'Terminate PTY session',
          required_fields: ['type', 'sessionId']
        },
        {
          type: 'ping',
          description: 'Heartbeat message',
          required_fields: ['type'],
          optional_fields: ['timestamp']
        }
      ],
      server_messages: [
        {
          type: 'connected',
          description: 'Connection established confirmation'
        },
        {
          type: 'session_created',
          description: 'Session created successfully'
        },
        {
          type: 'pty_output',
          description: 'Output from PTY session'
        },
        {
          type: 'session_exit',
          description: 'Session terminated'
        },
        {
          type: 'session_error',
          description: 'Session error occurred'
        },
        {
          type: 'pong',
          description: 'Heartbeat response'
        },
        {
          type: 'error',
          description: 'General error message'
        }
      ]
    });
  });
}