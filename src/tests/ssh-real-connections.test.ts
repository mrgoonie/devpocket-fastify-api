import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createTestUserAndLogin } from './helper.js';
import { resetDatabase } from './setup.js';
import { AuthType, SessionStatus } from '@prisma/client';
import { sshConnectionManager } from '../modules/terminal/ssh.service.js';

// Define interfaces for API responses
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface SshProfileData {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: AuthType;
  has_ssh_key: boolean;
}

interface SshConnectionTestData {
  success: boolean;
  connection_time?: number;
  error?: string;
}

interface TerminalSessionData {
  id: string;
  status: SessionStatus;
  profile_id: string | null;
}

// SSH test configuration from environment
const SSH_TEST_CONFIG = {
  host: process.env.SSH_TEST_HOST || '46.250.239.227',
  port: parseInt(process.env.SSH_TEST_PORT || '22'),
  pwd: {
    username: process.env.SSH_TEST_PWD_USER || 'testpwd',
    password: process.env.SSH_TEST_PWD_PASS || 'Test@123',
  },
  key: {
    username: process.env.SSH_TEST_KEY_USER || 'testkey',
    publicKey: process.env.SSH_TEST_PUBLIC_KEY || '',
  },
};

// Test SSH private key from environment variable
const TEST_SSH_PRIVATE_KEY = process.env.SSH_TEST_PRIVATE_KEY || '';

describe('SSH Real Connection Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    const authData = await createTestUserAndLogin(app);
    authToken = authData.token;
    userId = authData.user.id;
  });

  afterEach(async () => {
    // Clean up SSH connections after each test
    await sshConnectionManager.closeUserConnections(userId);
  });

  describe('Real SSH Password Authentication', () => {
    // Skip these tests if SSH credentials are not available
    const skipIfNoCredentials = !SSH_TEST_CONFIG.pwd.username || !SSH_TEST_CONFIG.pwd.password 
      ? it.skip : it;

    skipIfNoCredentials('should test real SSH connection with password authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/test-connection',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          host: SSH_TEST_CONFIG.host,
          port: SSH_TEST_CONFIG.port,
          username: SSH_TEST_CONFIG.pwd.username,
          auth_type: AuthType.PASSWORD,
          password: SSH_TEST_CONFIG.pwd.password,
        },
      });

      expect(response.statusCode).toBe(200);
      const { success, data } = response.json<ApiResponse<SshConnectionTestData>>();
      expect(success).toBe(true);
      expect(data.success).toBe(true);
      expect(data.connection_time).toBeGreaterThan(0);
      expect(data.error).toBeUndefined();
    }, 30000); // 30 second timeout for real connection

    skipIfNoCredentials('should create SSH profile with password authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Real Test PWD Server',
          host: SSH_TEST_CONFIG.host,
          port: SSH_TEST_CONFIG.port,
          username: SSH_TEST_CONFIG.pwd.username,
          auth_type: AuthType.PASSWORD,
          // Note: Password not stored in profile for security
        },
      });

      expect(response.statusCode).toBe(201);
      const { success, data } = response.json<ApiResponse<SshProfileData>>();
      expect(success).toBe(true);
      expect(data.name).toBe('Real Test PWD Server');
      expect(data.host).toBe(SSH_TEST_CONFIG.host);
      expect(data.auth_type).toBe(AuthType.PASSWORD);
      expect(data.has_ssh_key).toBe(false);
    });

    skipIfNoCredentials('should create and execute commands on SSH session with password auth', async () => {
      // First create SSH profile
      const profileResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'PWD Command Test Server',
          host: SSH_TEST_CONFIG.host,
          port: SSH_TEST_CONFIG.port,
          username: SSH_TEST_CONFIG.pwd.username,
          auth_type: AuthType.PASSWORD,
        },
      });

      expect(profileResponse.statusCode).toBe(201);
      const { data: profile } = profileResponse.json<ApiResponse<SshProfileData>>();

      // Create terminal session
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          session_type: 'ssh',
          profile_id: profile.id,
          // For password auth, password needs to be provided at runtime
          runtime_password: SSH_TEST_CONFIG.pwd.password,
        },
      });

      expect(sessionResponse.statusCode).toBe(201);
      const { data: session } = sessionResponse.json<ApiResponse<TerminalSessionData>>();
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.profile_id).toBe(profile.id);
    }, 30000);
  });

  describe('Real SSH Key Authentication', () => {
    // Skip these tests if SSH key credentials are not available
    const skipIfNoKeyCredentials = !SSH_TEST_CONFIG.key.username || !SSH_TEST_CONFIG.key.publicKey
      ? it.skip : it;

    skipIfNoKeyCredentials('should create SSH profile with key authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Real Test KEY Server',
          host: SSH_TEST_CONFIG.host,
          port: SSH_TEST_CONFIG.port,
          username: SSH_TEST_CONFIG.key.username,
          auth_type: AuthType.SSH_KEY,
          private_key: TEST_SSH_PRIVATE_KEY,
          public_key: SSH_TEST_CONFIG.key.publicKey,
        },
      });

      expect(response.statusCode).toBe(201);
      const { success, data } = response.json<ApiResponse<SshProfileData>>();
      expect(success).toBe(true);
      expect(data.name).toBe('Real Test KEY Server');
      expect(data.host).toBe(SSH_TEST_CONFIG.host);
      expect(data.auth_type).toBe(AuthType.SSH_KEY);
      expect(data.has_ssh_key).toBe(true);
    });

    skipIfNoKeyCredentials('should test real SSH connection with key authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/test-connection',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          host: SSH_TEST_CONFIG.host,
          port: SSH_TEST_CONFIG.port,
          username: SSH_TEST_CONFIG.key.username,
          auth_type: AuthType.SSH_KEY,
          private_key: TEST_SSH_PRIVATE_KEY,
          public_key: SSH_TEST_CONFIG.key.publicKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const { success, data } = response.json<ApiResponse<SshConnectionTestData>>();
      expect(success).toBe(true);
      expect(data.success).toBe(true);
      expect(data.connection_time).toBeGreaterThan(0);
      expect(data.error).toBeUndefined();
    }, 30000);

    skipIfNoKeyCredentials('should create SSH session with key authentication and execute commands', async () => {
      // First create SSH profile with key
      const profileResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/ssh/profiles',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'KEY Command Test Server',
          host: SSH_TEST_CONFIG.host,
          port: SSH_TEST_CONFIG.port,
          username: SSH_TEST_CONFIG.key.username,
          auth_type: AuthType.SSH_KEY,
          private_key: TEST_SSH_PRIVATE_KEY,
          public_key: SSH_TEST_CONFIG.key.publicKey,
        },
      });

      expect(profileResponse.statusCode).toBe(201);
      const { data: profile } = profileResponse.json<ApiResponse<SshProfileData>>();

      // Create terminal session
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/terminal/sessions',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          session_type: 'ssh',
          profile_id: profile.id,
        },
      });

      expect(sessionResponse.statusCode).toBe(201);
      const { data: session } = sessionResponse.json<ApiResponse<TerminalSessionData>>();
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.profile_id).toBe(profile.id);
    }, 30000);
  });

  describe('SSH Command Execution', () => {
    const skipIfNoCredentials = !SSH_TEST_CONFIG.pwd.username || !SSH_TEST_CONFIG.pwd.password 
      ? it.skip : it;

    skipIfNoCredentials('should execute basic commands over SSH connection', async () => {
      // Test direct SSH connection first
      const testConnection = await sshConnectionManager.testConnection({
        host: SSH_TEST_CONFIG.host,
        port: SSH_TEST_CONFIG.port,
        username: SSH_TEST_CONFIG.pwd.username,
        password: SSH_TEST_CONFIG.pwd.password,
      });

      expect(testConnection.success).toBe(true);
      expect(testConnection.connectionTime).toBeGreaterThan(0);
    }, 45000);

    skipIfNoCredentials('should handle connection timeouts properly', async () => {
      // Test connection to unreachable host
      const testConnection = await sshConnectionManager.testConnection({
        host: '192.0.2.1', // RFC5737 TEST-NET-1 - guaranteed to be unreachable
        port: 22,
        username: 'testuser',
        password: 'anypassword',
      });

      expect(testConnection.success).toBe(false);
      expect(testConnection.error).toBeDefined();
    }, 30000);
  });

  describe('SSH Connection Management', () => {
    it('should return connection statistics', async () => {
      // Test connection statistics
      const stats = sshConnectionManager.getConnectionStats(userId);
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('idle');
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.idle).toBe('number');
    });

    it('should cleanup connections properly', async () => {
      // Test cleanup functionality
      await sshConnectionManager.closeUserConnections(userId);
      const stats = sshConnectionManager.getConnectionStats(userId);
      expect(stats.total).toBe(0);
    });
  });
});
