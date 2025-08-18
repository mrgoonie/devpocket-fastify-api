import { prisma } from '../../shared/database/client.js';
import { encryptionService } from '../../shared/encryption/encryption.service.js';
import { sshConnectionManager } from './ssh.service.js';
import { ptyManager } from './pty.service.js';
import { logger } from '../../shared/logger.js';
import { AuthType, SessionStatus } from '@prisma/client';
import { 
  CreateSshProfileRequest, 
  UpdateSshProfileRequest,
  TestSshConnectionRequest,
  CreateTerminalSessionRequest,
  SshProfileResponse,
  SshProfileListResponse,
  SshTestResponse,
  TerminalSessionResponse,
  TerminalSessionListResponse,
  CommandHistoryListResponse
} from './terminal.schema.js';

export class TerminalService {
  
  /**
   * Create SSH profile with encrypted keys
   * @param userId - User ID
   * @param data - SSH profile data
   * @returns Created SSH profile
   */
  async createSshProfile(userId: string, data: CreateSshProfileRequest): Promise<SshProfileResponse> {
    try {
      // Check for duplicate profile name for this user
      const existingProfile = await prisma.sshProfile.findFirst({
        where: {
          user_id: userId,
          name: data.name
        }
      });

      if (existingProfile) {
        throw new Error('SSH profile with this name already exists');
      }

      // Validate SSH key requirements based on auth type
      if (data.auth_type === AuthType.SSH_KEY || data.auth_type === AuthType.SSH_KEY_WITH_PASSPHRASE) {
        if (!data.private_key || !data.public_key) {
          throw new Error('Private and public keys are required for SSH key authentication');
        }

        if (data.auth_type === AuthType.SSH_KEY_WITH_PASSPHRASE && !data.passphrase) {
          throw new Error('Passphrase is required for SSH key with passphrase authentication');
        }

        // Validate encryption data
        if (!encryptionService.validateEncryptionData(data.private_key)) {
          throw new Error('Invalid private key format or size');
        }
      }

      // Create SSH profile
      const profile = await prisma.sshProfile.create({
        data: {
          user_id: userId,
          name: data.name,
          host: data.host,
          port: data.port,
          username: data.username,
          auth_type: data.auth_type
        }
      });

      // Create SSH key record if key-based authentication
      if ((data.auth_type === AuthType.SSH_KEY || data.auth_type === AuthType.SSH_KEY_WITH_PASSPHRASE) 
          && data.private_key && data.public_key) {
        
        const encryptedPrivateKey = encryptionService.encryptSshKey(data.private_key);
        const encryptedPassphrase = data.passphrase 
          ? encryptionService.encryptPassphrase(data.passphrase)
          : null;

        await prisma.sshKey.create({
          data: {
            profile_id: profile.id,
            private_key_encrypted: encryptedPrivateKey,
            public_key: data.public_key,
            passphrase_encrypted: encryptedPassphrase
          }
        });
      }

      logger.info(`SSH profile created: ${profile.id} for user: ${userId}`);

      return this.formatSshProfileResponse(profile, true);

    } catch (error) {
      logger.error(`Error creating SSH profile for user ${userId}:`, error);
      throw new Error(`Failed to create SSH profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's SSH profiles
   * @param userId - User ID
   * @returns List of SSH profiles
   */
  async getUserSshProfiles(userId: string): Promise<SshProfileListResponse> {
    try {
      const profiles = await prisma.sshProfile.findMany({
        where: { user_id: userId },
        include: {
          ssh_keys: {
            select: { id: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      const formattedProfiles = profiles.map(profile => 
        this.formatSshProfileResponse(profile, profile.ssh_keys.length > 0)
      );

      return {
        profiles: formattedProfiles,
        total: profiles.length
      };

    } catch (error) {
      logger.error(`Error getting SSH profiles for user ${userId}:`, error);
      throw new Error('Failed to retrieve SSH profiles');
    }
  }

  /**
   * Get SSH profile by ID
   * @param profileId - Profile ID
   * @param userId - User ID for security validation
   * @returns SSH profile
   */
  async getSshProfile(profileId: string, userId: string): Promise<SshProfileResponse> {
    try {
      const profile = await prisma.sshProfile.findFirst({
        where: {
          id: profileId,
          user_id: userId
        },
        include: {
          ssh_keys: {
            select: { id: true }
          }
        }
      });

      if (!profile) {
        throw new Error('SSH profile not found or access denied');
      }

      return this.formatSshProfileResponse(profile, profile.ssh_keys.length > 0);

    } catch (error) {
      logger.error(`Error getting SSH profile ${profileId}:`, error);
      throw new Error(`Failed to retrieve SSH profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update SSH profile
   * @param profileId - Profile ID
   * @param userId - User ID for security validation
   * @param data - Update data
   * @returns Updated SSH profile
   */
  async updateSshProfile(profileId: string, userId: string, data: UpdateSshProfileRequest): Promise<SshProfileResponse> {
    try {
      // Check if profile exists and belongs to user
      const existingProfile = await prisma.sshProfile.findFirst({
        where: {
          id: profileId,
          user_id: userId
        },
        include: {
          ssh_keys: true
        }
      });

      if (!existingProfile) {
        throw new Error('SSH profile not found or access denied');
      }

      // Check for duplicate name if name is being updated
      if (data.name && data.name !== existingProfile.name) {
        const duplicateProfile = await prisma.sshProfile.findFirst({
          where: {
            user_id: userId,
            name: data.name,
            id: { not: profileId }
          }
        });

        if (duplicateProfile) {
          throw new Error('SSH profile with this name already exists');
        }
      }

      // Update profile basic info
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.host !== undefined) updateData.host = data.host;
      if (data.port !== undefined) updateData.port = data.port;
      if (data.username !== undefined) updateData.username = data.username;
      if (data.auth_type !== undefined) updateData.auth_type = data.auth_type;

      await prisma.sshProfile.update({
        where: { id: profileId },
        data: updateData
      });

      // Handle SSH key updates
      if (data.auth_type === AuthType.SSH_KEY || data.auth_type === AuthType.SSH_KEY_WITH_PASSPHRASE) {
        if (data.private_key && data.public_key) {
          // Validate encryption data
          if (!encryptionService.validateEncryptionData(data.private_key)) {
            throw new Error('Invalid private key format or size');
          }

          const encryptedPrivateKey = encryptionService.encryptSshKey(data.private_key);
          const encryptedPassphrase = data.passphrase 
            ? encryptionService.encryptPassphrase(data.passphrase)
            : null;

          // Delete existing SSH key and create new one
          await prisma.sshKey.deleteMany({
            where: { profile_id: profileId }
          });

          await prisma.sshKey.create({
            data: {
              profile_id: profileId,
              private_key_encrypted: encryptedPrivateKey,
              public_key: data.public_key,
              passphrase_encrypted: encryptedPassphrase
            }
          });
        }
      } else if (data.auth_type === AuthType.PASSWORD) {
        // Remove SSH keys for password authentication
        await prisma.sshKey.deleteMany({
          where: { profile_id: profileId }
        });
      }

      logger.info(`SSH profile updated: ${profileId} for user: ${userId}`);

      // Get updated profile with key info
      const finalProfile = await prisma.sshProfile.findUnique({
        where: { id: profileId },
        include: {
          ssh_keys: {
            select: { id: true }
          }
        }
      });

      return this.formatSshProfileResponse(finalProfile!, finalProfile!.ssh_keys.length > 0);

    } catch (error) {
      logger.error(`Error updating SSH profile ${profileId}:`, error);
      throw new Error(`Failed to update SSH profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete SSH profile
   * @param profileId - Profile ID
   * @param userId - User ID for security validation
   */
  async deleteSshProfile(profileId: string, userId: string): Promise<void> {
    try {
      // Check if profile exists and belongs to user
      const profile = await prisma.sshProfile.findFirst({
        where: {
          id: profileId,
          user_id: userId
        }
      });

      if (!profile) {
        throw new Error('SSH profile not found or access denied');
      }

      // Close any active SSH connections for this profile
      try {
        // Note: This is a simplified implementation - in production we'd need 
        // to track which connections belong to which profiles
        await sshConnectionManager.closeUserConnections(userId);
      } catch (error) {
        logger.warn(`Error closing SSH connections for profile ${profileId}:`, error);
      }

      // Delete profile (cascade will delete SSH keys and sessions)
      await prisma.sshProfile.delete({
        where: { id: profileId }
      });

      logger.info(`SSH profile deleted: ${profileId} for user: ${userId}`);

    } catch (error) {
      logger.error(`Error deleting SSH profile ${profileId}:`, error);
      throw new Error(`Failed to delete SSH profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test SSH connection
   * @param data - SSH connection test data
   * @returns Test result
   */
  async testSshConnection(data: TestSshConnectionRequest): Promise<SshTestResponse> {
    try {
      const config = {
        host: data.host,
        port: data.port,
        username: data.username,
        password: data.password,
        privateKey: data.private_key,
        passphrase: data.passphrase,
        readyTimeout: 10000 // 10 second timeout for tests
      };

      const result = await sshConnectionManager.testConnection(config);

      return {
        success: result.success,
        error: result.error,
        connection_time: result.connectionTime
      };

    } catch (error) {
      logger.error('Error testing SSH connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create terminal session
   * @param userId - User ID
   * @param data - Session creation data
   * @returns Created session
   */
  async createTerminalSession(userId: string, data: CreateTerminalSessionRequest): Promise<TerminalSessionResponse> {
    try {
      let profile = null;
      
      if (data.profile_id) {
        // Verify profile exists and belongs to user
        profile = await prisma.sshProfile.findFirst({
          where: {
            id: data.profile_id,
            user_id: userId
          }
        });

        if (!profile) {
          throw new Error('SSH profile not found or access denied');
        }
      }

      // Create PTY session (actual session creation happens via WebSocket)
      const session = await prisma.terminalSession.create({
        data: {
          user_id: userId,
          profile_id: data.profile_id,
          session_id: `session_${userId}_${Date.now()}`,
          status: SessionStatus.ACTIVE
        }
      });

      logger.info(`Terminal session created: ${session.session_id} for user: ${userId}`);

      return this.formatTerminalSessionResponse(session);

    } catch (error) {
      logger.error(`Error creating terminal session for user ${userId}:`, error);
      throw new Error(`Failed to create terminal session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's terminal sessions
   * @param userId - User ID
   * @returns List of terminal sessions
   */
  async getUserTerminalSessions(userId: string): Promise<TerminalSessionListResponse> {
    try {
      const sessions = await prisma.terminalSession.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 50 // Limit to last 50 sessions
      });

      const formattedSessions = sessions.map(session => 
        this.formatTerminalSessionResponse(session)
      );

      return {
        sessions: formattedSessions,
        total: sessions.length
      };

    } catch (error) {
      logger.error(`Error getting terminal sessions for user ${userId}:`, error);
      throw new Error('Failed to retrieve terminal sessions');
    }
  }

  /**
   * Get terminal session by ID
   * @param sessionId - Session ID
   * @param userId - User ID for security validation
   * @returns Terminal session
   */
  async getTerminalSession(sessionId: string, userId: string): Promise<TerminalSessionResponse> {
    try {
      const session = await prisma.terminalSession.findFirst({
        where: {
          id: sessionId,
          user_id: userId
        }
      });

      if (!session) {
        throw new Error('Terminal session not found or access denied');
      }

      return this.formatTerminalSessionResponse(session);

    } catch (error) {
      logger.error(`Error getting terminal session ${sessionId}:`, error);
      throw new Error(`Failed to retrieve terminal session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete terminal session
   * @param sessionId - Session ID
   * @param userId - User ID for security validation
   */
  async deleteTerminalSession(sessionId: string, userId: string): Promise<void> {
    try {
      // Check if session exists and belongs to user
      const session = await prisma.terminalSession.findFirst({
        where: {
          id: sessionId,
          user_id: userId
        }
      });

      if (!session) {
        throw new Error('Terminal session not found or access denied');
      }

      // Kill active PTY session if exists
      try {
        await ptyManager.killSession(sessionId, userId);
      } catch (error) {
        logger.warn(`PTY session ${sessionId} was not active:`, error);
      }

      // Update session status
      await prisma.terminalSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.TERMINATED,
          ended_at: new Date()
        }
      });

      logger.info(`Terminal session terminated: ${sessionId} for user: ${userId}`);

    } catch (error) {
      logger.error(`Error deleting terminal session ${sessionId}:`, error);
      throw new Error(`Failed to delete terminal session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get command history for session
   * @param sessionId - Session ID
   * @param userId - User ID for security validation
   * @param limit - Number of commands to return
   * @param offset - Offset for pagination
   * @returns Command history
   */
  async getCommandHistory(sessionId: string, userId: string, limit: number = 100, offset: number = 0): Promise<CommandHistoryListResponse> {
    try {
      // Verify session ownership
      const session = await prisma.terminalSession.findFirst({
        where: {
          id: sessionId,
          user_id: userId
        }
      });

      if (!session) {
        throw new Error('Terminal session not found or access denied');
      }

      const history = await prisma.commandHistory.findMany({
        where: { session_id: sessionId },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset
      });

      const total = await prisma.commandHistory.count({
        where: { session_id: sessionId }
      });

      const formattedHistory = history.map(cmd => ({
        id: cmd.id,
        command: cmd.command,
        output: cmd.output,
        status: cmd.status,
        created_at: cmd.created_at
      }));

      return {
        history: formattedHistory,
        total
      };

    } catch (error) {
      logger.error(`Error getting command history for session ${sessionId}:`, error);
      throw new Error(`Failed to retrieve command history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format SSH profile for response
   * @param profile - Raw profile data
   * @param hasSshKey - Whether profile has SSH key
   * @returns Formatted response
   */
  private formatSshProfileResponse(profile: any, hasSshKey: boolean): SshProfileResponse {
    return {
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      auth_type: profile.auth_type,
      has_ssh_key: hasSshKey,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    };
  }

  /**
   * Format terminal session for response
   * @param session - Raw session data
   * @returns Formatted response
   */
  private formatTerminalSessionResponse(session: any): TerminalSessionResponse {
    return {
      id: session.id,
      session_id: session.session_id,
      status: session.status,
      profile_id: session.profile_id,
      created_at: session.created_at,
      ended_at: session.ended_at
    };
  }
}

// Export singleton instance
export const terminalService = new TerminalService();