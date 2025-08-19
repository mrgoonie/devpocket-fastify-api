import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../auth/auth.middleware.js';
import { ptyManager } from './pty.service.js';
import { sshConnectionManager } from './ssh.service.js';
import { terminalService } from './terminal.service.js';
import { 
  CreateSshProfileSchema,
  UpdateSshProfileSchema,
  SshProfileParamsSchema,
  TestSshConnectionSchema,
  CreateTerminalSessionSchema,
  TerminalSessionParamsSchema,
  GetCommandHistoryQuerySchema
} from './terminal.schema.js';
import { logger } from '../../shared/logger.js';

export class TerminalController {

  /**
   * Create SSH profile
   * @route POST /api/v1/ssh/profiles
   */
  async createSshProfile(
    request: AuthenticatedRequest & {
      Body: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const data = CreateSshProfileSchema.parse(request.body);

      const profile = await terminalService.createSshProfile(userId, data);

      reply.code(201).send({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error in createSshProfile:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        reply.code(409).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create SSH profile'
        });
      }
    }
  }

  /**
   * Get user's SSH profiles
   * @route GET /api/v1/ssh/profiles
   */
  async getSshProfiles(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const profiles = await terminalService.getUserSshProfiles(userId);

      reply.send({
        success: true,
        data: profiles
      });

    } catch (error) {
      logger.error('Error in getSshProfiles:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve SSH profiles'
      });
    }
  }

  /**
   * Get SSH profile by ID
   * @route GET /api/v1/ssh/profiles/:id
   */
  async getSshProfile(
    request: AuthenticatedRequest & {
      Params: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const { id } = SshProfileParamsSchema.parse(request.params);

      const profile = await terminalService.getSshProfile(id, userId);

      reply.send({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error in getSshProfile:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve SSH profile'
        });
      }
    }
  }

  /**
   * Update SSH profile
   * @route PUT /api/v1/ssh/profiles/:id
   */
  async updateSshProfile(
    request: AuthenticatedRequest & {
      Params: unknown;
      Body: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const { id } = SshProfileParamsSchema.parse(request.params);
      const data = UpdateSshProfileSchema.parse(request.body);

      const profile = await terminalService.updateSshProfile(id, userId, data);

      reply.send({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error in updateSshProfile:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else if (error instanceof Error && error.message.includes('already exists')) {
        reply.code(409).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update SSH profile'
        });
      }
    }
  }

  /**
   * Delete SSH profile
   * @route DELETE /api/v1/ssh/profiles/:id
   */
  async deleteSshProfile(
    request: AuthenticatedRequest & {
      Params: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const { id } = SshProfileParamsSchema.parse(request.params);

      await terminalService.deleteSshProfile(id, userId);

      reply.code(204).send();

    } catch (error) {
      logger.error('Error in deleteSshProfile:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to delete SSH profile'
        });
      }
    }
  }

  /**
   * Test SSH connection
   * @route POST /api/v1/ssh/test-connection
   */
  async testSshConnection(
    request: FastifyRequest<{
      Body: unknown;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const data = TestSshConnectionSchema.parse(request.body);
      const result = await terminalService.testSshConnection(data);

      reply.send({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error in testSshConnection:', error);
      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test SSH connection'
      });
    }
  }

  /**
   * Create terminal session
   * @route POST /api/v1/terminal/sessions
   */
  async createTerminalSession(
    request: AuthenticatedRequest & {
      Body: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const data = CreateTerminalSessionSchema.parse(request.body);

      const session = await terminalService.createTerminalSession(userId, data);

      reply.code(201).send({
        success: true,
        data: session
      });

    } catch (error) {
      logger.error('Error in createTerminalSession:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create terminal session'
        });
      }
    }
  }

  /**
   * Get user's terminal sessions
   * @route GET /api/v1/terminal/sessions
   */
  async getTerminalSessions(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const sessions = await terminalService.getUserTerminalSessions(userId);

      reply.send({
        success: true,
        data: sessions
      });

    } catch (error) {
      logger.error('Error in getTerminalSessions:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve terminal sessions'
      });
    }
  }

  /**
   * Get terminal session by ID
   * @route GET /api/v1/terminal/sessions/:id
   */
  async getTerminalSession(
    request: AuthenticatedRequest & {
      Params: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const { id } = TerminalSessionParamsSchema.parse(request.params);

      const session = await terminalService.getTerminalSession(id, userId);

      reply.send({
        success: true,
        data: session
      });

    } catch (error) {
      logger.error('Error in getTerminalSession:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve terminal session'
        });
      }
    }
  }

  /**
   * Delete terminal session
   * @route DELETE /api/v1/terminal/sessions/:id
   */
  async deleteTerminalSession(
    request: AuthenticatedRequest & {
      Params: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const { id } = TerminalSessionParamsSchema.parse(request.params);

      await terminalService.deleteTerminalSession(id, userId);

      reply.code(204).send();

    } catch (error) {
      logger.error('Error in deleteTerminalSession:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to delete terminal session'
        });
      }
    }
  }

  /**
   * Get command history for session
   * @route GET /api/v1/terminal/sessions/:id/history
   */
  async getCommandHistory(
    request: AuthenticatedRequest & {
      Params: unknown;
      Querystring: unknown;
    },
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      const { id } = TerminalSessionParamsSchema.parse(request.params);
      const { limit, offset } = GetCommandHistoryQuerySchema.parse(request.query);

      const history = await terminalService.getCommandHistory(id, userId, limit, offset);

      reply.send({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Error in getCommandHistory:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        reply.code(404).send({
          success: false,
          error: error.message
        });
      } else {
        reply.code(500).send({
          success: false,
          error: 'Failed to retrieve command history'
        });
      }
    }
  }

  /**
   * Get terminal connection statistics
   * @route GET /api/v1/terminal/stats
   */
  async getTerminalStats(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const userId = request.authUser.userId;
      
      // Get PTY session stats
      const ptyStats = ptyManager.getSessionStats(userId);
      
      // Get SSH connection stats
      const sshStats = sshConnectionManager.getConnectionStats(userId);

      reply.send({
        success: true,
        data: {
          pty_sessions: ptyStats,
          ssh_connections: sshStats,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error in getTerminalStats:', error);
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve terminal statistics'
      });
    }
  }
}

// Export singleton instance
export const terminalController = new TerminalController();