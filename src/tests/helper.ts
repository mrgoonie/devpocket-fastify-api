import { FastifyInstance } from 'fastify';
import { Response } from 'light-my-request';
import { faker } from '@faker-js/faker';
import { buildApp } from '../app.js';
import { UserResponse } from '../modules/auth/auth.schema.js';
import { logger } from '../shared/logger.js';

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
  const maxRetries = process.env.CI ? 5 : 3; // Increased retries for CI
  const retryDelay = process.env.CI ? 2000 : 500; // Increased delay for CI
  
  let lastRegisterError: unknown;
  let registerResponse: Response | undefined;

  // Register user with retry logic
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        if (process.env.CI) {
          logger.info(`Registration retry attempt ${attempt}/${maxRetries} for ${email}`);
        }
      }

      if (process.env.CI) {
        logger.info(`Attempting to register user: ${email} (attempt ${attempt}/${maxRetries})`);
      }
      registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userPayload,
      });

      if (process.env.CI) {
        logger.info(`Registration response: ${registerResponse.statusCode} - ${registerResponse.body}`);
      }

      if (registerResponse.statusCode === 201) {
        if (process.env.CI) {
          logger.info(`User registration successful for ${email}`);
        }
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
      if (process.env.CI) {
        logger.error(`Registration attempt ${attempt} failed:`, error);
      }
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to register test user after ${maxRetries} attempts: ${registerResponse?.statusCode || 'unknown'} - ${registerResponse?.body || error}`,
        );
      }
    }
  }

  // Import prisma once at the beginning to avoid repeated imports
  const { prisma } = await import('../shared/database/client.js');
  
  // Verify user is properly persisted in database with password hash before attempting login
  const maxWaitAttempts = process.env.CI ? 15 : 10; // Increased wait attempts
  let userFound = false;
  let registeredUser: { id: string; email: string; username: string; password_hash: string; created_at: Date } | null = null;
  
  for (let waitAttempt = 1; waitAttempt <= maxWaitAttempts; waitAttempt++) {
    try {
      // Use transaction to ensure we get a consistent read
      registeredUser = await prisma.$transaction(async (tx) => {
        return await tx.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            username: true,
            password_hash: true,
            created_at: true
          }
        });
      }, {
        isolationLevel: 'ReadCommitted',
        timeout: 5000
      });
      
      if (registeredUser && registeredUser.password_hash) {
        if (process.env.CI) {
          logger.info(`User found in database with password hash: ${email} (attempt ${waitAttempt}/${maxWaitAttempts})`);
        }
        userFound = true;
        break;
      } else if (registeredUser && !registeredUser.password_hash) {
        // User exists but password hash is missing - this shouldn't happen
        if (process.env.CI) {
          logger.warn(`User found but password hash missing: ${email} (attempt ${waitAttempt}/${maxWaitAttempts})`);
        }
        const waitTime = 200 * waitAttempt;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        const waitTime = 200 * waitAttempt;
        if (process.env.CI) {
          logger.info(`User not yet in database, waiting ${waitTime}ms (attempt ${waitAttempt}/${maxWaitAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } catch (dbError) {
      if (process.env.CI) {
        logger.warn(`Database check failed (attempt ${waitAttempt}):`, dbError);
      }
      await new Promise(resolve => setTimeout(resolve, 200 * waitAttempt));
    }
  }
  
  if (!userFound) {
    throw new Error(`User not found in database after registration: ${email}`);
  }
  
  // Add extra delay in CI to ensure all database replicas are synchronized
  if (process.env.CI) {
    logger.info(`CI environment detected - adding extra 2s delay before login for database synchronization`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Login user with retry logic and exponential backoff
  let lastLoginError: unknown;
  let loginResponse: Response | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        // Exponential backoff with jitter
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        if (process.env.CI) {
          logger.info(`Login retry attempt ${attempt}/${maxRetries} for ${email} after ${backoffDelay}ms delay`);
        }
      }

      if (process.env.CI) {
        logger.info(`Attempting to login user: ${email} (attempt ${attempt}/${maxRetries})`);
      }
      loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
      });

      if (process.env.CI) {
        logger.info(`Login response: ${loginResponse.statusCode} - ${loginResponse.body}`);
      }

      if (loginResponse.statusCode === 200) {
        if (process.env.CI) {
          logger.info(`User login successful for ${email}`);
        }
        break; // Success
      } else {
        lastLoginError = new Error(
          `Login failed: ${loginResponse.statusCode} - ${loginResponse.body}`
        );
        if (process.env.CI) {
          logger.error(`Login attempt ${attempt} failed for ${email}:`, (lastLoginError as Error).message);
        }
        
        // If we're getting 401, verify the user still exists with correct password hash
        if (loginResponse.statusCode === 401 && attempt < maxRetries) {
          const userCheck = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, password_hash: true }
          });
          if (process.env.CI) {
            logger.info(`User verification after 401: ${userCheck ? 'exists' : 'not found'}, has password: ${userCheck?.password_hash ? 'yes' : 'no'}`);
          }
        }
        
        if (attempt === maxRetries) {
          throw lastLoginError;
        }
      }
    } catch (error) {
      lastLoginError = error;
      if (process.env.CI) {
        logger.error(`Login attempt ${attempt} failed for ${email}:`, error);
      }
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to login test user after ${maxRetries} attempts: ${loginResponse?.statusCode || 'unknown'} - ${loginResponse?.body || error}`,
        );
      }
    }
  }

  if (!loginResponse) {
    throw new Error('Login response is undefined after all retry attempts');
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