import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { prisma } from './client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

async function prismaPlugin(fastify: FastifyInstance) {
  // Decorate fastify instance with prisma client
  fastify.decorate('prisma', prisma);

  // Ensure graceful shutdown
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});