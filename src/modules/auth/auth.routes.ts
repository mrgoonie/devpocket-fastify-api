import type { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { authenticate, requireEmailVerification } from './auth.middleware.js';
// Schema imports removed - using inline JSON schemas for Fastify validation
// TODO: Integrate with Zod schemas or use fastify-zod plugin

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
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string', minLength: 3, maxLength: 20 },
          password: { type: 'string', minLength: 8 }
        },
        required: ['email', 'username', 'password']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    email_verified: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' }
                  }
                },
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
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          device_id: { type: 'string' }
        },
        required: ['email', 'password']
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
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    email_verified: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' }
                  }
                },
                access_token: { type: 'string' },
                refresh_token: { type: 'string' },
                expires_in: { type: 'number' }
              }
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
      body: {
        type: 'object',
        properties: {
          refresh_token: { type: 'string', minLength: 1 }
        },
        required: ['refresh_token']
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
                access_token: { type: 'string' },
                expires_in: { type: 'number' }
              }
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
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    email_verified: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' }
                  }
                },
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
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      },
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
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 8 }
        },
        required: ['token', 'password']
      },
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
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    username: { type: 'string' },
                    email_verified: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' }
                  }
                },
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
      body: {
        type: 'object',
        properties: {
          current_password: { type: 'string', minLength: 1 },
          new_password: { type: 'string', minLength: 8 }
        },
        required: ['current_password', 'new_password']
      },
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