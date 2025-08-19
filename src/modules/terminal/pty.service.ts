// Temporary stub for pty service to allow compilation
// TODO: Fix node-pty integration issues

import { ReadWriteStream } from 'stream';

export interface PtySession {
  id: string;
  userId: string;
  profileId?: string;
  ptyProcess: ReadWriteStream | null; // Better type for PTY process
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface PtyOptions {
  cols?: number;
  rows?: number;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export class PtyService {
  async createSession(): Promise<PtySession> {
    throw new Error('PTY service not available - node-pty module disabled for compilation');
  }

  async getSession(): Promise<PtySession | null> {
    return null;
  }

  async destroySession(): Promise<void> {
    // Stub implementation
  }

  async writeToSession(): Promise<void> {
    // Stub implementation
  }

  async resizeSession(): Promise<void> {
    // Stub implementation
  }

  getSessions(): PtySession[] {
    return [];
  }

  getSessionStats(_userId?: string) {
    return { active: 0, total: 0 };
  }

  killSession(_sessionId: string, _userId?: string): Promise<void> {
    return Promise.resolve();
  }

  destroy(): void {
    // Stub implementation
  }
}

export const ptyManager = new PtyService();