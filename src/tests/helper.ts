import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

export async function build(): Promise<FastifyInstance> {
  const app = await buildApp();
  return app;
}

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

// Shared test user credentials with unique identifiers to avoid conflicts between test files
export const TEST_USERS = {
  auth: {
    email: 'auth-test@example.com',
    username: 'authuser',
    password: 'TestPass123!'
  },
  payment: {
    email: 'payment-test@example.com',
    username: 'paymentuser', 
    password: 'Password123!'
  },
  terminal: {
    email: 'terminal-test@example.com',
    username: 'terminaluser',
    password: 'TestPassword123!'
  }
};

// Helper to create a test user and get authentication token
export async function createTestUserAndLogin(app: FastifyInstance, userKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userKey];
  
  // Register the user
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: user
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(`Failed to register test user: ${registerResponse.statusCode} - ${registerResponse.payload}`);
  }

  // Login to get token
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: user.email,
      password: user.password
    }
  });

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Failed to login test user: ${loginResponse.statusCode} - ${loginResponse.payload}`);
  }

  const loginData = loginResponse.json();
  
  return {
    user: loginData.data.user,
    token: loginData.data.access_token,
    refreshToken: loginData.data.refresh_token
  };
}

// Helper to make authenticated requests
export async function makeAuthenticatedRequest(
  app: FastifyInstance, 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  token: string,
  payload?: Record<string, unknown>
) {
  return app.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${token}`
    },
    ...(payload && { payload })
  });
}