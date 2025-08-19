import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (_request: FastifyRequest, _reply: FastifyReply) => Promise<void>;
  }
}