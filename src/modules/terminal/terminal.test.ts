import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { build, createTestUserAndLogin, makeAuthenticatedRequest } from '../../tests/helper.js';
import { cleanupTestData } from '../../tests/setup.js';
import { prisma } from '../../shared/database/client.js';
import { encryptionService } from '../../shared/encryption/encryption.service.js';
import { AuthType, SessionStatus } from '@prisma/client';

// Mock SSH2 module to prevent native module crashes during tests
vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    exec: vi.fn(),
    shell: vi.fn()
  }))
}));

// Mock SSH and PTY services to avoid native module imports
const mockSshConnectionManager = {
  destroy: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn(),
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
  getConnectionStats: vi.fn().mockReturnValue({ total: 0, active: 0 })
};

const mockPtyManager = {
  destroy: vi.fn(),
  getSessionStats: vi.fn().mockReturnValue({ total: 0, active: 0 })
};

vi.mock('./ssh.service.js', () => ({
  sshConnectionManager: mockSshConnectionManager
}));

vi.mock('./pty.service.js', () => ({
  ptyManager: mockPtyManager
}));

describe('Terminal Module Integration Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = await build();
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup mocked services
    await mockSshConnectionManager.destroy();
    await mockPtyManager.destroy();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData();
    
    // Small delay to ensure database is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create test user and get auth token using standardized helper
    const authData = await createTestUserAndLogin(app, 'terminal');
    testUser = authData.user;
    authToken = authData.token;
  });

  afterEach(async () => {
    // Reset mocks after each test
    vi.clearAllMocks();
    
    // Clean up test data after each test
    await cleanupTestData();
    
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('SSH Profile Management', () => {
    const testSshKey = {
      private_key: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEA1234567890abcdef...
-----END OPENSSH PRIVATE KEY-----`,
      public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDXNjQ1Njc4OTBhYmNkZWY... user@host'
    };

    it('should create SSH profile with key authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Test Server',
          host: 'test.example.com',
          port: 22,
          username: 'testuser',
          auth_type: AuthType.SSH_KEY,
          private_key: testSshKey.private_key,
          public_key: testSshKey.public_key
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Test Server');
      expect(data.data.host).toBe('test.example.com');
      expect(data.data.auth_type).toBe(AuthType.SSH_KEY);
      expect(data.data.has_ssh_key).toBe(true);
    });

    it('should create SSH profile with password authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Password Server',
          host: 'password.example.com',
          port: 2222,
          username: 'admin',
          auth_type: AuthType.PASSWORD
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.has_ssh_key).toBe(false);
    });

    it('should reject SSH key profile without keys', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Invalid Server',
          host: 'invalid.example.com',
          port: 22,
          username: 'user',
          auth_type: AuthType.SSH_KEY
          // Missing private_key and public_key
        }
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Private and public keys are required');
    });

    it('should reject duplicate profile names', async () => {
      // Create first profile
      await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Duplicate Server',
          host: 'server1.example.com',
          port: 22,
          username: 'user1',
          auth_type: AuthType.PASSWORD
        }
      });

      // Try to create second profile with same name
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Duplicate Server',
          host: 'server2.example.com',
          port: 22,
          username: 'user2',
          auth_type: AuthType.PASSWORD
        }
      });

      expect(response.statusCode).toBe(409);
      const data = response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should list user SSH profiles', async () => {
      // Create test profiles
      await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Server 1',
          host: 'server1.example.com',
          port: 22,
          username: 'user1',
          auth_type: AuthType.PASSWORD
        }
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Server 2',
          host: 'server2.example.com',
          port: 22,
          username: 'user2',
          auth_type: AuthType.SSH_KEY,
          private_key: testSshKey.private_key,
          public_key: testSshKey.public_key
        }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.profiles).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('should update SSH profile', async () => {
      // Create profile first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Original Server',
          host: 'original.example.com',
          port: 22,
          username: 'original',
          auth_type: AuthType.PASSWORD
        }
      });

      const profileId = createResponse.json().data.id;

      // Update profile
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/ssh/profiles/${profileId}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Updated Server',
          host: 'updated.example.com',
          port: 2222,
          username: 'updated'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Server');
      expect(data.data.host).toBe('updated.example.com');
      expect(data.data.port).toBe(2222);
      expect(data.data.username).toBe('updated');
    });

    it('should delete SSH profile', async () => {
      // Create profile first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'To Delete',
          host: 'delete.example.com',
          port: 22,
          username: 'delete',
          auth_type: AuthType.PASSWORD
        }
      });

      const profileId = createResponse.json().data.id;

      // Delete profile
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/ssh/profiles/${profileId}`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(204);

      // Verify profile is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/ssh/profiles/${profileId}`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('SSH Connection Testing', () => {
    it('should test SSH connection with password auth (mock)', async () => {
      // Mock successful connection
      mockSshConnectionManager.testConnection.mockResolvedValueOnce({
        success: true,
        connectionTime: 1500
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/test-connection',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          host: 'test.example.com',
          port: 22,
          username: 'testuser',
          auth_type: AuthType.PASSWORD,
          password: 'testpassword'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.success).toBe(true);
      expect(data.data.connection_time).toBe(1500);
    });

    it('should handle SSH connection failure (mock)', async () => {
      // Mock failed connection
      mockSshConnectionManager.testConnection.mockResolvedValueOnce({
        success: false,
        error: 'Connection timeout'
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/test-connection',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          host: 'invalid.example.com',
          port: 22,
          username: 'testuser',
          auth_type: AuthType.PASSWORD,
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.success).toBe(false);
      expect(data.data.error).toBe('Connection timeout');
    });
  });

  describe('Terminal Session Management', () => {
    it('should create local terminal session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          session_type: 'local'
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe(SessionStatus.ACTIVE);
      expect(data.data.profile_id).toBeNull();
    });

    it('should create SSH terminal session', async () => {
      // Create SSH profile first
      const profileResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'SSH Session Server',
          host: 'ssh.example.com',
          port: 22,
          username: 'sshuser',
          auth_type: AuthType.PASSWORD
        }
      });

      const profileId = profileResponse.json().data.id;

      // Create SSH terminal session
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          session_type: 'ssh',
          profile_id: profileId
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.profile_id).toBe(profileId);
    });

    it('should list user terminal sessions', async () => {
      // Create test sessions
      await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { session_type: 'local' }
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { session_type: 'local' }
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.sessions).toHaveLength(2);
    });

    it('should delete terminal session', async () => {
      // Create session first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { session_type: 'local' }
      });

      const sessionId = createResponse.json().data.id;

      // Delete session
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/terminal/sessions/${sessionId}`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('Command History', () => {
    it('should retrieve command history for session', async () => {
      // Create session first
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { session_type: 'local' }
      });

      expect(sessionResponse.statusCode).toBe(201);
      const sessionData = sessionResponse.json();
      expect(sessionData.success).toBe(true);
      const sessionId = sessionData.data.id;

      // Add some command history directly to database
      await prisma.commandHistory.createMany({
        data: [
          {
            session_id: sessionId,
            command: 'ls -la',
            output: 'total 0\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .',
            status: 0
          },
          {
            session_id: sessionId,
            command: 'pwd',
            output: '/home/user',
            status: 0
          }
        ]
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/terminal/sessions/${sessionId}/history`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.history).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('should support pagination in command history', async () => {
      // Create session first
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { session_type: 'local' }
      });

      expect(sessionResponse.statusCode).toBe(201);
      const sessionData = sessionResponse.json();
      expect(sessionData.success).toBe(true);
      const sessionId = sessionData.data.id;

      // Add multiple commands to history
      const commands = Array.from({ length: 15 }, (_, i) => ({
        session_id: sessionId,
        command: `command_${i}`,
        output: `output_${i}`,
        status: 0
      }));

      await prisma.commandHistory.createMany({ data: commands });

      // Test pagination
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/terminal/sessions/${sessionId}/history?limit=10&offset=5`,
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.history).toHaveLength(10);
      expect(data.data.total).toBe(15);
    });
  });

  describe('Terminal Statistics', () => {
    it('should return terminal statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/terminal/stats',
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('pty_sessions');
      expect(data.data).toHaveProperty('ssh_connections');
      expect(data.data).toHaveProperty('timestamp');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all terminal endpoints', async () => {
      const endpoints = [
        { method: 'GET', url: '/api/v1/ssh/profiles' },
        { method: 'POST', url: '/api/v1/ssh/profiles' },
        { method: 'GET', url: '/api/v1/terminal/sessions' },
        { method: 'POST', url: '/api/v1/terminal/sessions' },
        { method: 'GET', url: '/api/v1/terminal/stats' }
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          url: endpoint.url
          // No authorization header
        });

        expect(response.statusCode).toBe(401);
      }
    });
  });

  describe('Encryption Service', () => {
    it('should encrypt and decrypt SSH keys correctly', () => {
      const originalKey = 'test-ssh-private-key-content';
      
      const encrypted = encryptionService.encryptSshKey(originalKey);
      expect(encrypted).toContain(':'); // Should have IV:encrypted format
      expect(encrypted).not.toBe(originalKey);
      
      const decrypted = encryptionService.decryptSshKey(encrypted);
      expect(decrypted).toBe(originalKey);
    });

    it('should encrypt and decrypt passphrases correctly', () => {
      const originalPassphrase = 'test-passphrase-123';
      
      const encrypted = encryptionService.encryptPassphrase(originalPassphrase);
      expect(encrypted).toContain(':');
      expect(encrypted).not.toBe(originalPassphrase);
      
      const decrypted = encryptionService.decryptPassphrase(encrypted);
      expect(decrypted).toBe(originalPassphrase);
    });

    it('should validate encryption data', () => {
      expect(encryptionService.validateEncryptionData('valid-data')).toBe(true);
      expect(encryptionService.validateEncryptionData('')).toBe(false);
      expect(encryptionService.validateEncryptionData('x'.repeat(70000))).toBe(false);
    });
  });
});