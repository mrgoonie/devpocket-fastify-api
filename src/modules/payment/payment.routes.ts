import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { authenticate, AuthenticatedRequest } from '../auth/auth.middleware.js';

export async function paymentRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const paymentService = new PaymentService(fastify.prisma);
  const paymentController = new PaymentController(paymentService);

  // Helper function to wrap authenticated route handlers
  const wrapAuthenticatedHandler = (handler: (_request: AuthenticatedRequest, _reply: FastifyReply) => Promise<void>) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      return handler(request as AuthenticatedRequest, reply);
    };
  };

  // Public webhook endpoint (no authentication required)
  fastify.post('/webhooks/revenuecat', {
    schema: {
      description: 'RevenueCat webhook endpoint for processing subscription events',
      tags: ['payment'],
      body: {
        type: 'object',
        description: 'RevenueCat webhook payload'
      },
      headers: {
        type: 'object',
        properties: {
          'x-revenuecat-signature': {
            type: 'string',
            description: 'Webhook signature for verification'
          }
        },
        required: ['x-revenuecat-signature']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, paymentController.handleWebhook.bind(paymentController));

  // Health check endpoint
  fastify.get('/payment/health', {
    schema: {
      description: 'Payment service health check',
      tags: ['payment'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, paymentController.healthCheck.bind(paymentController));

  // Protected routes (require authentication)
  fastify.register(async (fastify) => {
    // Apply authentication middleware to all routes in this context
    fastify.addHook('onRequest', authenticate);

    // Get current subscription
    fastify.get('/subscriptions/current', {
      schema: {
        description: 'Get current user subscription details',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              subscription: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  plan_type: { type: 'string', enum: ['FREE', 'PRO', 'TEAM'] },
                  status: { type: 'string', enum: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED'] },
                  started_at: { type: 'string', format: 'date-time' },
                  expires_at: { type: 'string', format: 'date-time', nullable: true },
                  limits: {
                    type: 'object',
                    properties: {
                      ssh_connections: { type: 'number' },
                      ai_requests: { type: 'number' },
                      cloudHistory: { type: 'boolean' },
                      multiDevice: { type: 'boolean' },
                      teamFeatures: { type: 'boolean' },
                      prioritySupport: { type: 'boolean' }
                    }
                  },
                  usage: {
                    type: 'object',
                    properties: {
                      ssh_connections: { type: 'number' },
                      ai_requests: { type: 'number' },
                      resetDate: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    }, wrapAuthenticatedHandler(paymentController.getCurrentSubscription.bind(paymentController)));

    // Get subscription status
    fastify.get('/subscriptions/status', {
      schema: {
        description: 'Get subscription status for authenticated user',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hasActiveSubscription: { type: 'boolean' },
              subscription: {
                type: 'object',
                nullable: true
              }
            }
          }
        }
      }
    }, wrapAuthenticatedHandler(paymentController.getSubscriptionStatus.bind(paymentController)));

    // Get available plans
    fastify.get('/subscriptions/plans', {
      schema: {
        description: 'Get available subscription plans',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              plans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['FREE', 'PRO', 'TEAM'] },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'number' },
                    currency: { type: 'string' },
                    billing_period: { type: 'string' },
                    features: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    limits: {
                      type: 'object',
                      properties: {
                        ssh_connections: { type: 'number' },
                        ai_requests: { type: 'number' },
                        cloud_history: { type: 'boolean' },
                        multi_device: { type: 'boolean' },
                        team_features: { type: 'boolean' },
                        priority_support: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }, paymentController.getSubscriptionPlans.bind(paymentController));

    // Get payment history
    fastify.get('/subscriptions/history', {
      schema: {
        description: 'Get user payment history',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    amount: { type: 'number' },
                    currency: { type: 'string' },
                    provider_ref: { type: 'string' },
                    status: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' }
                  }
                }
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  pages: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }, wrapAuthenticatedHandler(paymentController.getPaymentHistory.bind(paymentController)));

    // Cancel subscription
    fastify.post('/subscriptions/cancel', {
      schema: {
        description: 'Cancel current subscription',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    }, wrapAuthenticatedHandler(paymentController.cancelSubscription.bind(paymentController)));

    // Check usage limit for feature
    fastify.get('/subscriptions/usage/:feature', {
      schema: {
        description: 'Check usage limit for a specific feature',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            feature: { type: 'string', enum: ['ssh', 'ai'] }
          },
          required: ['feature']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              allowed: { type: 'boolean' },
              reason: { type: 'string' },
              current_usage: { type: 'number' },
              limit: { type: 'number' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    }, wrapAuthenticatedHandler(paymentController.checkUsageLimit.bind(paymentController)));

    // Create free subscription (for new users)
    fastify.post('/subscriptions/free', {
      schema: {
        description: 'Create initial free subscription for new users',
        tags: ['subscription'],
        security: [{ bearerAuth: [] }],
        response: {
          201: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              subscription: { type: 'object' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    }, wrapAuthenticatedHandler(paymentController.createFreeSubscription.bind(paymentController)));
  });
}