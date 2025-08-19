import { FastifyInstance } from 'fastify';
import { Response } from 'light-my-request';
import { faker } from '@faker-js/faker';
import { buildApp } from '../app.js';
import { UserResponse } from '../modules/auth/auth.schema.js';

export async function build(): Promise<FastifyInstance> {
  const app = await buildApp();
  return app;
}

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

// Helper to create a test user and get authentication token
export const createTestUserAndLogin = async (
  app: FastifyInstance,
  role: 'USER' | 'ADMIN' = 'USER',
): Promise<{ user: UserResponse; token: string; refreshToken: string; password: string }> => {
  const uniqueId = faker.string.uuid();
  // Replace hyphen with underscore to match username validation rules
  const username = `testuser_${uniqueId.replace(/-/g, '_')}`.slice(0, 20);
  const email = `test-${uniqueId}@example.com`;
  const password = 'Password123!';

  const userPayload = {
    username,
    email,
    password,
    role,
  };

  // Register user
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: userPayload,
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(
      `Failed to register test user: ${registerResponse.statusCode} - ${registerResponse.body}`,
    );
  }

  // Login user
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Failed to login test user: ${loginResponse.statusCode} - ${loginResponse.body}`);
  }

  const responseBody = JSON.parse(loginResponse.body);
  // Handle cases where the response might be nested under a 'data' property
  const loginData = responseBody.data || responseBody;

  const { user, access_token: token, refresh_token: refreshToken } = loginData;
  return { user, token, refreshToken, password };
};


// Helper to make authenticated requests
export async function makeAuthenticatedRequest(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  token: string,
  payload?: Record<string, unknown>,
): Promise<Response> {
  return app.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${token}`
    },
    ...(payload && { payload })
  });
}