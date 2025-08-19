import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { faker } from '@faker-js/faker';
import { createTestApp, createTestUserAndLogin } from '@/tests/helper.js';
import { prisma } from '@/shared/database/client.js';
import { UserResponse } from './auth.schema.js';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

interface RegisterData {
  user: UserResponse;
}

interface LoginData {
  user: UserResponse;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface MeData {
  user: UserResponse;
}

interface RefreshTokenData {
  access_token: string;
}

interface VerifyEmailData {
  user: UserResponse;
}

describe('Authentication Module', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: faker.internet.email(),
        username: faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'testuser',
        password: 'Password123!',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      expect(response.statusCode).toBe(201);
      const { success, data } = response.json<ApiResponse<RegisterData>>();
      expect(success).toBe(true);
      expect(data.user.email).toBe(userData.email.toLowerCase());
      expect(data.user.username).toBe(userData.username);
      expect(data.user.email_verified).toBe(false);
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        username: faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20),
        password: 'Password123!',
      };
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });
      expect(response.statusCode).toBe(400);
    });

    it('should fail with weak password', async () => {
      const userData = {
        email: faker.internet.email(),
        username: faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20),
        password: 'weak',
      };
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });
      expect(response.statusCode).toBe(400);
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: faker.internet.email(),
        username: faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'test_user',
        password: 'Password123!',
      };
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          ...userData,
          username: faker.internet.username().replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'new_user',
        },
      });

      expect(response.statusCode).toBe(409);
      const { code } = response.json<ApiResponse<null>>();
      expect(code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const { user, password } = await createTestUserAndLogin(app, 'USER');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: user.email,
          password,
        },
      });

      expect(response.statusCode).toBe(200);
      const { success, data } = response.json<ApiResponse<LoginData>>();
      expect(success).toBe(true);
      expect(data.user.email).toBe(user.email);
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.expires_in).toBeTypeOf('number');
    });

        it('should fail with invalid email', async () => {
      const { password } = await createTestUserAndLogin(app, 'USER');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'wrong@example.com',
          password,
        },
      });

      expect(response.statusCode).toBe(401);
      const { code } = response.json<ApiResponse<null>>();
      expect(code).toBe('INVALID_CREDENTIALS');
    });

        it('should fail with invalid password', async () => {
      const { user } = await createTestUserAndLogin(app, 'USER');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: user.email,
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const { code } = response.json<ApiResponse<null>>();
      expect(code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Authenticated routes', () => {
    let result: { user: UserResponse; token: string; refreshToken: string; password: string };

    beforeEach(async () => {
      result = await createTestUserAndLogin(app);
    });

    describe('GET /api/v1/auth/me', () => {
      it('should return current user with valid token', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/me',
          headers: {
            authorization: `Bearer ${result.token}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const { success, data } = response.json<ApiResponse<MeData>>();
        expect(success).toBe(true);
        expect(data.user.email).toBe(result.user.email);
      });

      it('should fail without authorization header', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/me',
        });
        expect(response.statusCode).toBe(401);
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
      });
    });

    describe('POST /api/v1/auth/refresh', () => {
      it('should refresh token successfully', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          payload: {
            refresh_token: result.refreshToken,
          },
        });

        expect(response.statusCode).toBe(200);
        const { success, data } = response.json<ApiResponse<RefreshTokenData>>();
        expect(success).toBe(true);
        expect(data.access_token).toBeDefined();
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
      });
    });

    describe('POST /api/v1/auth/logout', () => {
      it('should logout successfully', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: {
            authorization: `Bearer ${result.token}`,
          },
        });
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should request password reset successfully', async () => {
      const { user } = await createTestUserAndLogin(app);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: user.email,
        },
      });
      expect(response.statusCode).toBe(200);
    });

        it('should not reveal if email does not exist', async () => {
      await createTestUserAndLogin(app, 'USER');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {
          email: 'nonexistent@example.com',
        },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/auth/verify-email', () => {
    it('should verify email successfully', async () => {
      const { user } = await createTestUserAndLogin(app);
      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { user_id: user.id },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/verify-email?token=${tokenRecord?.token}`,
      });

      expect(response.statusCode).toBe(200);
      const { success, data } = response.json<ApiResponse<VerifyEmailData>>();
      expect(success).toBe(true);
      expect(data.user.email_verified).toBe(true);
    });

        it('should fail with invalid token', async () => {
      await createTestUserAndLogin(app, 'USER');
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/verify-email?token=invalid-token',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});