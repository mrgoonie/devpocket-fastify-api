import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { z } from 'zod';
import { ptyManager, PtySession } from './pty.service.js';
import { sshConnectionManager } from './ssh.service.js';
import { logger } from '../../shared/logger.js';
import { prisma } from '../../shared/database/client.js';

// WebSocket message schemas
const CreatePtyMessageSchema = z.object({
  type: z.literal('create_pty'),
  cols: z.number().min(1).max(500).default(80),
  rows: z.number().min(1).max(200).default(24),
  shell: z.string().optional(),
  cwd: z.string().optional()
});

const ConnectSshMessageSchema = z.object({
  type: z.literal('connect_ssh'),
  profileId: z.string().uuid(),
  cols: z.number().min(1).max(500).default(80),
  rows: z.number().min(1).max(200).default(24)
});

const PtyInputMessageSchema = z.object({
  type: z.literal('pty_input'),
  sessionId: z.string(),
  data: z.string()
});

const ResizePtyMessageSchema = z.object({
  type: z.literal('resize_pty'),
  sessionId: z.string(),
  cols: z.number().min(1).max(500),
  rows: z.number().min(1).max(200)
});

const KillSessionMessageSchema = z.object({
  type: z.literal('kill_session'),
  sessionId: z.string()
});

const PingMessageSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.number().optional()
});

const WebSocketMessageSchema = z.union([
  CreatePtyMessageSchema,
  ConnectSshMessageSchema,
  PtyInputMessageSchema,
  ResizePtyMessageSchema,
  KillSessionMessageSchema,
  PingMessageSchema
]);

// type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export interface ClientSession {
  userId: string;
  socket: SocketStream;
  activeSessions: Set<string>;
  sshConnections: Map<string, string>; // sessionId -> connectionId
  lastPing: number;
}

export class TerminalWebSocketHandler {
  private clients: Map<SocketStream, ClientSession> = new Map();
  private heartbeatInterval: NodeJS.Timeout;

  constructor() {
    // Setup heartbeat to check client connections
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeat();
    }, 30000); // Check every 30 seconds

    // Setup PTY event listeners
    this.setupPtyEventListeners();
  }

  /**
   * Setup WebSocket routes
   * @param fastify - Fastify instance
   */
  async setupRoutes(fastify: FastifyInstance): Promise<void> {
    await fastify.register(async (fastify) => {
      fastify.get('/ws/terminal', { websocket: true }, async (connection, request) => {
        const handler = new TerminalWebSocketHandler();
        await handler.handleConnection(connection, request);
      });
    });
  }

  /**
   * Handle WebSocket connection
   * @param connection - WebSocket connection
   * @param request - Fastify request
   */
  async handleConnection(connection: SocketStream, request: FastifyRequest): Promise<void> {
    try {
      // Extract user from JWT token
      const userId = await this.authenticateUser(request);
      
      const clientSession: ClientSession = {
        userId,
        socket: connection,
        activeSessions: new Set(),
        sshConnections: new Map(),
        lastPing: Date.now()
      };

      this.clients.set(connection, clientSession);
      
      logger.info(`Terminal WebSocket connected for user: ${userId}`);

      // Send welcome message
      this.sendMessage(connection, {
        type: 'connected',
        userId,
        timestamp: Date.now()
      });

      // Handle incoming messages
      connection.on('message', (message: Buffer) => {
        this.handleMessage(clientSession, message);
      });

      // Handle connection close
      connection.on('close', async () => {
        await this.handleDisconnection(clientSession);
      });

      // Handle connection error
      connection.on('error', (error) => {
        logger.error(`Terminal WebSocket error for user ${userId}:`, error);
        this.handleDisconnection(clientSession);
      });

    } catch (error) {
      logger.error('Terminal WebSocket authentication failed:', error);
      connection.terminate();
    }
  }

  /**
   * Handle incoming WebSocket message
   * @param clientSession - Client session
   * @param message - Raw message buffer
   */
  private async handleMessage(clientSession: ClientSession, message: Buffer): Promise<void> {
    try {
      const data = JSON.parse(message.toString());
      const parsedMessage = WebSocketMessageSchema.parse(data);

      clientSession.lastPing = Date.now();

      switch (parsedMessage.type) {
        case 'create_pty':
          await this.handleCreatePty(clientSession, parsedMessage);
          break;

        case 'connect_ssh':
          await this.handleConnectSsh(clientSession, parsedMessage);
          break;

        case 'pty_input':
          await this.handlePtyInput(clientSession, parsedMessage);
          break;

        case 'resize_pty':
          await this.handleResizePty(clientSession, parsedMessage);
          break;

        case 'kill_session':
          await this.handleKillSession(clientSession, parsedMessage);
          break;

        case 'ping':
          this.sendMessage(clientSession.socket, {
            type: 'pong',
            timestamp: Date.now()
          });
          break;

        default:
          logger.warn(`Unknown message type from user ${clientSession.userId}`);
      }

    } catch (error) {
      logger.error(`Error handling WebSocket message from user ${clientSession.userId}:`, error);
      this.sendError(clientSession.socket, 'Invalid message format or processing error');
    }
  }

  /**
   * Handle PTY session creation
   */
  private async handleCreatePty(clientSession: ClientSession, message: z.infer<typeof CreatePtyMessageSchema>): Promise<void> {
    try {
      const session = await ptyManager.createSession(
        clientSession.userId,
        undefined,
        {
          cols: message.cols,
          rows: message.rows,
          shell: message.shell,
          cwd: message.cwd
        }
      );

      clientSession.activeSessions.add(session.id);

      this.sendMessage(clientSession.socket, {
        type: 'session_created',
        sessionId: session.id,
        sessionType: 'local'
      });

      logger.info(`PTY session created: ${session.id} for user: ${clientSession.userId}`);

    } catch (error) {
      logger.error(`Error creating PTY session for user ${clientSession.userId}:`, error);
      this.sendError(clientSession.socket, 'Failed to create terminal session');
    }
  }

  /**
   * Handle SSH connection
   */
  private async handleConnectSsh(clientSession: ClientSession, message: z.infer<typeof ConnectSshMessageSchema>): Promise<void> {
    try {
      // Create SSH connection
      const sshConnection = await sshConnectionManager.createConnection(
        message.profileId,
        clientSession.userId
      );

      // Create PTY session for SSH
      const ptySession = await ptyManager.createSession(
        clientSession.userId,
        message.profileId,
        {
          cols: message.cols,
          rows: message.rows
        }
      );

      // Link SSH connection to PTY session
      clientSession.activeSessions.add(ptySession.id);
      clientSession.sshConnections.set(ptySession.id, sshConnection.id);

      // Create shell on SSH connection
      const shellStream = await sshConnectionManager.createShell(sshConnection.id);
      
      // Pipe SSH shell to PTY
      this.linkSshToPty(ptySession, shellStream, clientSession);

      this.sendMessage(clientSession.socket, {
        type: 'session_created',
        sessionId: ptySession.id,
        sessionType: 'ssh',
        profileId: message.profileId
      });

      logger.info(`SSH session created: ${ptySession.id} for user: ${clientSession.userId}`);

    } catch (error) {
      logger.error(`Error creating SSH session for user ${clientSession.userId}:`, error);
      this.sendError(clientSession.socket, `Failed to create SSH session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle PTY input
   */
  private async handlePtyInput(clientSession: ClientSession, message: z.infer<typeof PtyInputMessageSchema>): Promise<void> {
    try {
      if (!clientSession.activeSessions.has(message.sessionId)) {
        throw new Error('Session not found or access denied');
      }

      ptyManager.writeToSession(message.sessionId, clientSession.userId, message.data);

    } catch (error) {
      logger.error(`Error handling PTY input for session ${message.sessionId}:`, error);
      this.sendError(clientSession.socket, 'Failed to write to terminal session');
    }
  }

  /**
   * Handle PTY resize
   */
  private async handleResizePty(clientSession: ClientSession, message: z.infer<typeof ResizePtyMessageSchema>): Promise<void> {
    try {
      if (!clientSession.activeSessions.has(message.sessionId)) {
        throw new Error('Session not found or access denied');
      }

      ptyManager.resizeSession(message.sessionId, clientSession.userId, message.cols, message.rows);

    } catch (error) {
      logger.error(`Error resizing PTY session ${message.sessionId}:`, error);
      this.sendError(clientSession.socket, 'Failed to resize terminal session');
    }
  }

  /**
   * Handle session termination
   */
  private async handleKillSession(clientSession: ClientSession, message: z.infer<typeof KillSessionMessageSchema>): Promise<void> {
    try {
      if (!clientSession.activeSessions.has(message.sessionId)) {
        return; // Session not found or already terminated
      }

      // Close SSH connection if exists
      const sshConnectionId = clientSession.sshConnections.get(message.sessionId);
      if (sshConnectionId) {
        await sshConnectionManager.closeConnection(sshConnectionId);
        clientSession.sshConnections.delete(message.sessionId);
      }

      // Kill PTY session
      await ptyManager.killSession(message.sessionId, clientSession.userId);
      clientSession.activeSessions.delete(message.sessionId);

      this.sendMessage(clientSession.socket, {
        type: 'session_terminated',
        sessionId: message.sessionId
      });

    } catch (error) {
      logger.error(`Error killing session ${message.sessionId}:`, error);
      this.sendError(clientSession.socket, 'Failed to terminate session');
    }
  }

  /**
   * Handle client disconnection
   */
  private async handleDisconnection(clientSession: ClientSession): Promise<void> {
    try {
      logger.info(`Terminal WebSocket disconnected for user: ${clientSession.userId}`);

      // Close all SSH connections
      for (const sshConnectionId of clientSession.sshConnections.values()) {
        await sshConnectionManager.closeConnection(sshConnectionId);
      }

      // Kill all PTY sessions
      for (const sessionId of clientSession.activeSessions) {
        await ptyManager.killSession(sessionId, clientSession.userId);
      }

      // Remove client from active clients
      this.clients.delete(clientSession.socket);

    } catch (error) {
      logger.error(`Error handling disconnection for user ${clientSession.userId}:`, error);
    }
  }

  /**
   * Setup PTY event listeners
   */
  private setupPtyEventListeners(): void {
    // Handle PTY data output
    ptyManager.on('sessionData', (sessionId: string, data: string) => {
      const clientSession = this.findClientBySession(sessionId);
      if (clientSession) {
        this.sendMessage(clientSession.socket, {
          type: 'pty_output',
          sessionId,
          data
        });
      }
    });

    // Handle PTY session exit
    ptyManager.on('sessionExit', (sessionId: string, exitCode: number, signal: string) => {
      const clientSession = this.findClientBySession(sessionId);
      if (clientSession) {
        clientSession.activeSessions.delete(sessionId);
        clientSession.sshConnections.delete(sessionId);
        
        this.sendMessage(clientSession.socket, {
          type: 'session_exit',
          sessionId,
          exitCode,
          signal
        });
      }
    });

    // Handle PTY session error
    ptyManager.on('sessionError', (sessionId: string, error: string) => {
      const clientSession = this.findClientBySession(sessionId);
      if (clientSession) {
        clientSession.activeSessions.delete(sessionId);
        clientSession.sshConnections.delete(sessionId);
        
        this.sendMessage(clientSession.socket, {
          type: 'session_error',
          sessionId,
          error
        });
      }
    });
  }

  /**
   * Link SSH shell stream to PTY session
   */
  private linkSshToPty(ptySession: PtySession, shellStream: any, clientSession: ClientSession): void {
    // Forward SSH output to WebSocket
    shellStream.on('data', (data: Buffer) => {
      this.sendMessage(clientSession.socket, {
        type: 'pty_output',
        sessionId: ptySession.id,
        data: data.toString()
      });
    });

    // Forward PTY input to SSH
    ptyManager.on('sessionData', (sessionId: string, data: string) => {
      if (sessionId === ptySession.id) {
        shellStream.write(data);
      }
    });

    // Handle SSH stream close
    shellStream.on('close', () => {
      ptyManager.killSession(ptySession.id, ptySession.userId);
    });

    // Handle SSH stream error
    shellStream.on('error', (error: Error) => {
      logger.error(`SSH shell stream error for session ${ptySession.id}:`, error);
      ptyManager.killSession(ptySession.id, ptySession.userId);
    });
  }

  /**
   * Find client session by PTY session ID
   */
  private findClientBySession(sessionId: string): ClientSession | null {
    for (const clientSession of this.clients.values()) {
      if (clientSession.activeSessions.has(sessionId)) {
        return clientSession;
      }
    }
    return null;
  }

  /**
   * Authenticate user from request
   */
  private async authenticateUser(request: FastifyRequest): Promise<string> {
    try {
      // Extract JWT token from query params or headers
      const query = request.query as any;
      const token = query?.token || request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        throw new Error('No authentication token provided');
      }

      // Verify JWT token
      const decoded = request.server.jwt.verify(token) as any;
      
      if (!decoded.userId) {
        throw new Error('Invalid token payload');
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return decoded.userId;

    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(socket: SocketStream, message: any): void {
    try {
      socket.socket.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending WebSocket message:', error);
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private sendError(socket: SocketStream, error: string): void {
    this.sendMessage(socket, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  /**
   * Check heartbeat for all clients
   */
  private checkHeartbeat(): void {
    const now = Date.now();
    const staleClients: SocketStream[] = [];

    for (const [socket, clientSession] of this.clients) {
      const timeSinceLastPing = now - clientSession.lastPing;
      
      if (timeSinceLastPing > 60000) { // 1 minute timeout
        staleClients.push(socket);
      }
    }

    // Close stale connections
    staleClients.forEach(socket => {
      const clientSession = this.clients.get(socket);
      if (clientSession) {
        logger.info(`Closing stale WebSocket connection for user: ${clientSession.userId}`);
        socket.terminate();
      }
    });
  }

  /**
   * Cleanup on shutdown
   */
  async destroy(): Promise<void> {
    clearInterval(this.heartbeatInterval);
    
    // Close all client connections
    for (const [socket, clientSession] of this.clients) {
      await this.handleDisconnection(clientSession);
      socket.terminate();
    }

    this.clients.clear();
  }
}

// Export singleton instance
export const terminalWebSocketHandler = new TerminalWebSocketHandler();