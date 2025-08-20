import { FastifyInstance } from 'fastify';
import { Response } from 'light-my-request';
import { faker } from '@faker-js/faker';
import { buildApp } from '../app.js';
import { UserResponse } from '../modules/auth/auth.schema.js';

// Track test app instances for proper cleanup
const testAppInstances = new Set<FastifyInstance>();

export async function build(): Promise<FastifyInstance> {
  const app = await buildApp();
  return app;
}

export async function createTestApp(): Promise<FastifyInstance> {
  // Create completely isolated Fastify instance
  const app = await buildApp();
  await app.ready();
  
  // Track instance for cleanup
  testAppInstances.add(app);
  
  return app;
}

// Clean up all test app instances
export async function cleanupTestApps(): Promise<void> {
  const cleanupPromises = Array.from(testAppInstances).map(async (app) => {
    try {
      await app.close();
    } catch (_) {
      // Ignore cleanup errors
    }
  });
  
  await Promise.all(cleanupPromises);
  testAppInstances.clear();
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

  // Add retry logic for CI environments where database operations might be slower
  const maxRetries = process.env.CI ? 3 : 1;
  const retryDelay = process.env.CI ? 1500 : 100;
  
  let lastRegisterError: any;
  let registerResponse: any;

  // Register user with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        console.log(`Registration retry attempt ${attempt}/${maxRetries} for ${email}`);
      }

      console.log(`Attempting to register user: ${email} (attempt ${attempt}/${maxRetries})`);
      registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userPayload,
      });

      console.log(`Registration response: ${registerResponse.statusCode} - ${registerResponse.body}`);

      if (registerResponse.statusCode === 201) {
        console.log(`User registration successful for ${email}`);
        break; // Success
      } else {
        lastRegisterError = new Error(
          `Registration failed: ${registerResponse.statusCode} - ${registerResponse.body}`
        );
        if (attempt === maxRetries) {
          throw lastRegisterError;
        }
      }
    } catch (error) {
      lastRegisterError = error;
      console.error(`Registration attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to register test user after ${maxRetries} attempts: ${registerResponse?.statusCode || 'unknown'} - ${registerResponse?.body || error}`,
        );
      }
    }
  }

  // Extended delay to ensure user is properly persisted before login, especially in CI
  console.log(`Waiting ${process.env.CI ? 500 : 50}ms before login attempt for ${email}`);
  await new Promise(resolve => setTimeout(resolve, process.env.CI ? 500 : 50));

  // Login user with retry logic
  let lastLoginError: any;
  let loginResponse: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        console.log(`Login retry attempt ${attempt}/${maxRetries} for ${email}`);
      }

      console.log(`Attempting to login user: ${email} (attempt ${attempt}/${maxRetries})`);
      loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });

      console.log(`Login response: ${loginResponse.statusCode} - ${loginResponse.body}`);

      if (loginResponse.statusCode === 200) {
        console.log(`User login successful for ${email}`);
        break; // Success
      } else {
        lastLoginError = new Error(
          `Login failed: ${loginResponse.statusCode} - ${loginResponse.body}`
        );
        console.error(`Login attempt ${attempt} failed for ${email}:`, lastLoginError.message);
        if (attempt === maxRetries) {
          throw lastLoginError;
        }
      }
    } catch (error) {
      lastLoginError = error;
      console.error(`Login attempt ${attempt} failed for ${email}:`, error);
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to login test user after ${maxRetries} attempts: ${loginResponse?.statusCode || 'unknown'} - ${loginResponse?.body || error}`,
        );
      }
    }
  }

  try {
    const responseBody = JSON.parse(loginResponse.body);
    // Handle cases where the response might be nested under a 'data' property
    const loginData = responseBody.data || responseBody;

    const { user, access_token: token, refresh_token: refreshToken } = loginData;
    
    if (!user || !token) {
      throw new Error(`Invalid login response structure: missing user or token - ${loginResponse.body}`);
    }
    
    return { user, token, refreshToken, password };
  } catch (parseError) {
    throw new Error(`Failed to parse login response: ${parseError} - Response: ${loginResponse.body}`);
  }
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