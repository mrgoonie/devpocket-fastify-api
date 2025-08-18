import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '@/app.js';
import { prisma } from '@/shared/database/client.js';

describe('Authentication Module', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const testUser = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'TestPass123',
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    
    // Clean up any existing test data
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  beforeEach(async () => {
    // Clean up between tests
    await prisma.session.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.emailVerificationToken.deleteMany();
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(testUser.email);
      expect(json.data.user.username).toBe(testUser.username);
      expect(json.data.user.email_verified).toBe(false);
    });

    it('should fail with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          ...testUser,
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          ...testUser,
          password: 'weak',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with duplicate email', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          ...testUser,
          username: 'different',
        },
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Register user before login tests
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(testUser.email);
      expect(json.data.access_token).toBeDefined();
      expect(json.data.refresh_token).toBeDefined();
      expect(json.data.expires_in).toBeTypeOf('number');
    });

    it('should fail with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'wrong@example.com',
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      accessToken = loginResponse.json().data.access_token;
    });

    it('should return current user with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe(testUser.email);
    });

    it('should fail without authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.code).toBe('AUTH_FAILED');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      refreshToken = loginResponse.json().data.refresh_token;
    });

    it('should refresh token successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refresh_token: refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.access_token).toBeDefined();
      expect(json.data.expires_in).toBeTypeOf('number');
    });

    it('should fail with invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refresh_token: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const json = response.json();
      expect(json.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and login user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      accessToken = loginResponse.json().data.access_token;
    });

    it('should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
    });

    it('should fail without authorization', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    beforeEach(async () => {
      // Register user before password reset tests
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });
    });

    it('should request password reset successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: testUser.email,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
    });

    it('should not reveal if email does not exist', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'nonexistent@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/auth/verify-email', () => {
    let verificationToken: string;

    beforeEach(async () => {
      // Register user to get verification token
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: testUser,
      });

      // Get the verification token from database
      const token = await prisma.emailVerificationToken.findFirst({
        where: {
          user: { email: testUser.email },
        },
      });
      verificationToken = token?.token || '';
    });

    it('should verify email successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/verify-email?token=${verificationToken}`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.email_verified).toBe(true);
    });

    it('should fail with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/verify-email?token=invalid-token',
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.code).toBe('INVALID_VERIFICATION_TOKEN');
    });
  });
});