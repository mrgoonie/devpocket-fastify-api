import type { FastifyInstance } from 'fastify';
import { config } from '@/config/environment.js';
import prismaPlugin from '@/shared/database/plugin.js';
import { authenticate } from '@/modules/auth/auth.middleware.js';

export async function setupPlugins(fastify: FastifyInstance) {
  // Register Prisma plugin
  await fastify.register(prismaPlugin);

  // Register CORS
  await fastify.register(import('@fastify/cors'), {
    origin: config.isDevelopment ? true : [config.FRONTEND_URL],
    credentials: true,
  });

  // Register Helmet for security headers
  await fastify.register(import('@fastify/helmet'), {
    global: true,
  });

  // Register rate limiting (skip in test environment)
  if (!config.isTest) {
    await fastify.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
    });
  }

  // Register JWT
  await fastify.register(import('@fastify/jwt'), {
    secret: config.JWT.SECRET,
    sign: {
      expiresIn: config.JWT.EXPIRES_IN,
    },
  });

  // Register WebSocket support
  await fastify.register(import('@fastify/websocket'));

  // Add authentication method
  fastify.decorate('authenticate', authenticate);

  // Register Swagger documentation
  await fastify.register(import('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'DevPocket API',
        description: 'AI-powered mobile terminal backend server',
        version: '1.0.0',
      },
      servers: [
        {
          url: config.isDevelopment ? `http://localhost:${config.PORT}` : 'https://api.devpocket.com',
          description: config.isDevelopment ? 'Development server' : 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  // Register Swagger UI
  await fastify.register(import('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformSpecificationClone: true,
  });
}