import Fastify from 'fastify';
import { config } from '@/config/environment.js';
import { setupPlugins } from '@/config/plugins.js';
import { setupRoutes } from '@/config/routes.js';
import { logger } from '@/shared/logger.js';

async function buildApp() {
  const fastify = Fastify({
    logger: config.isDevelopment,
    trustProxy: true,
  });

  try {
    // Register plugins
    await setupPlugins(fastify);
    
    // Register routes
    await setupRoutes(fastify);

    return fastify;
  } catch (error) {
    fastify.log.error(error);
    throw error;
  }
}

async function start() {
  const app = await buildApp();
  
  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    
    app.log.info(`Server listening at ${address}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildApp };