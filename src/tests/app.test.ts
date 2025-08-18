import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@/app.js';
// import type { FastifyInstance } from 'fastify';

describe('App Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond to health check', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toHaveProperty('status', 'ok');
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('uptime');
  });

  it('should respond to test endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toHaveProperty('message', 'DevPocket API is running!');
    expect(json).toHaveProperty('timestamp');
  });

  it('should serve Swagger documentation', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });
});