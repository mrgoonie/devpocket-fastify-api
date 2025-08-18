import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authenticate, requireEmailVerification } from './auth.middleware.js';
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema,
  refreshTokenSchema,
  changePasswordSchema,
  userResponseSchema,
  loginResponseSchema,
  refreshResponseSchema,
} from './auth.schema.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Rate limiting configuration for auth endpoints
  const authRateLimit = {
    max: 5,
    timeWindow: '1 minute',
  };

  const passwordRateLimit = {
    max: 3,
    timeWindow: '5 minutes',
  };

  // Register user
  fastify.post('/register', {
    config: {
      rateLimit: authRateLimit,
    },
    schema: {
      tags: ['Authentication'],
      summary: 'Register new user',
      description: 'Create a new user account with email and password',
      body: registerSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                user: userResponseSchema,
              },
            },
          },
        },
        409: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: { type: 'array' },
          },
        },
      },
    },
  }, AuthController.register);

  // Login user
  fastify.post('/login', {
    config: {
      rateLimit: authRateLimit,
    },
    schema: {
      tags: ['Authentication'],
      summary: 'Login user',
      description: 'Authenticate user and return access token',
      body: loginSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: loginResponseSchema,
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: { type: 'array' },
          },
        },
      },
    },
  }, AuthController.login);

  // Logout user
  fastify.post('/logout', {
    preHandler: authenticate,
    schema: {
      tags: ['Authentication'],
      summary: 'Logout user',
      description: 'Invalidate user session and logout',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, AuthController.logout);

  // Refresh access token
  fastify.post('/refresh', {
    config: {
      rateLimit: authRateLimit,
    },
    schema: {
      tags: ['Authentication'],
      summary: 'Refresh access token',
      description: 'Generate new access token using refresh token',
      body: refreshTokenSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: refreshResponseSchema,
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: { type: 'array' },
          },
        },
      },
    },
  }, AuthController.refreshToken);

  // Get current user profile
  fastify.get('/me', {
    preHandler: authenticate,
    schema: {
      tags: ['Authentication'],
      summary: 'Get current user',
      description: 'Get authenticated user profile information',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: userResponseSchema,
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, AuthController.getCurrentUser);

  // Request password reset
  fastify.post('/forgot-password', {
    config: {
      rateLimit: passwordRateLimit,
    },
    schema: {
      tags: ['Authentication'],
      summary: 'Request password reset',
      description: 'Send password reset link to user email',
      body: forgotPasswordSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: { type: 'array' },
          },
        },
      },
    },
  }, AuthController.forgotPassword);

  // Reset password using token
  fastify.post('/reset-password', {
    config: {
      rateLimit: passwordRateLimit,
    },
    schema: {
      tags: ['Authentication'],
      summary: 'Reset password',
      description: 'Reset user password using reset token',
      body: resetPasswordSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, AuthController.resetPassword);

  // Verify email using token
  fastify.get('/verify-email', {
    schema: {
      tags: ['Authentication'],
      summary: 'Verify email',
      description: 'Verify user email using verification token',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                user: userResponseSchema,
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, AuthController.verifyEmail);

  // Change password for authenticated user
  fastify.post('/change-password', {
    preHandler: [authenticate, requireEmailVerification],
    config: {
      rateLimit: passwordRateLimit,
    },
    schema: {
      tags: ['Authentication'],
      summary: 'Change password',
      description: 'Change password for authenticated user',
      security: [{ bearerAuth: [] }],
      body: changePasswordSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, AuthController.changePassword);
}