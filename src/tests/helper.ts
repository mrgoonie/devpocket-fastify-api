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