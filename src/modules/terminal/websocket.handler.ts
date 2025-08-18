// Temporary stub for WebSocket handler to allow compilation
// TODO: Fix WebSocket integration issues

import { SocketStream } from '@fastify/websocket';
import { FastifyRequest } from 'fastify';

class TerminalWebSocketHandler {
  async handleConnection(_connection: SocketStream, _request: FastifyRequest) {
    throw new Error('WebSocket terminal functionality not available - disabled for compilation');
  }
}

export const terminalWebSocketHandler = new TerminalWebSocketHandler();