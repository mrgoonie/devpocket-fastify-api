import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from '../../tests/helper.js';
import { cleanupTestData } from '../../tests/setup.js';
import { PrismaClient, User } from '@prisma/client';
import { PlanInfo } from './payment.schema.js';
import crypto from 'crypto';

describe('Payment Module', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let testUser: User;
  let authToken: string;
  let uniqueTestUser: { email: string; username: string; password: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up all test data for proper isolation
    await cleanupTestData();
    
    // Small delay to ensure database is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate unique test user data
    const uniqueId = Math.random().toString(36).substring(2, 8); // 6 chars
    uniqueTestUser = {
      email: `payment-${Date.now()}-${uniqueId}@example.com`,
      username: `pay${uniqueId}`, // Keep under 20 chars
      password: 'Password123!'
    };
    
    // Recreate test user and get fresh auth token
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: uniqueTestUser
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: uniqueTestUser.email,
        password: uniqueTestUser.password
      }
    });

    const loginData = JSON.parse(loginResponse.payload);
    authToken = loginData.data?.access_token;
    testUser = loginData.data?.user;
  });

  describe('Subscription Plans', () => {
    it('should get available subscription plans', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/plans',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.plans).toBeDefined();
      expect(data.plans).toHaveLength(3);
      
      const planTypes = data.plans.map((p: PlanInfo) => p.type);
      expect(planTypes).toContain('FREE');
      expect(planTypes).toContain('PRO');
      expect(planTypes).toContain('TEAM');

      // Check FREE plan structure
      const freePlan = data.plans.find((p: PlanInfo) => p.type === 'FREE');
      expect(freePlan).toBeDefined();
      expect(freePlan.price).toBe(0);
      expect(freePlan.limits.sshConnections).toBe(1);
      expect(freePlan.limits.aiRequests).toBe(10);
      expect(freePlan.limits.cloudHistory).toBe(false);
    });
  });

  describe('Free Subscription Creation', () => {
    it('should create free subscription for new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/free',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      
      expect(data.message).toBe('Free subscription created successfully');
      expect(data.subscription).toBeDefined();
      expect(data.subscription.plan_type).toBe('FREE');
      expect(data.subscription.status).toBe('ACTIVE');
    });

    it('should not create duplicate free subscription', async () => {
      // Create first subscription
      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/free',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      // Try to create second subscription
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/free',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('User already has a subscription');
    });
  });

  describe('Current Subscription', () => {
    beforeEach(async () => {
      // Create free subscription for tests
      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/free',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });
    });

    it('should get current subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/current',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.subscription).toBeDefined();
      expect(data.subscription.planType).toBe('FREE');
      expect(data.subscription.status).toBe('ACTIVE');
      expect(data.subscription.limits).toBeDefined();
      expect(data.subscription.usage).toBeDefined();
    });

    it('should get subscription status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/status',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.hasActiveSubscription).toBe(true);
      expect(data.subscription).toBeDefined();
    });
  });

  describe('Usage Limits', () => {
    beforeEach(async () => {
      // Create free subscription for tests
      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/free',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });
    });

    it('should check SSH usage limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/usage/ssh',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.allowed).toBe(true);
      expect(data.currentUsage).toBe(0);
      expect(data.limit).toBe(1); // FREE plan limit
    });

    it('should check AI usage limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/usage/ai',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.allowed).toBe(true);
      expect(data.currentUsage).toBe(0);
      expect(data.limit).toBe(10); // FREE plan limit
    });

    it('should reject invalid feature in usage check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/usage/invalid',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toContain('Invalid feature');
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      // Create active subscription for tests
      await prisma.subscription.create({
        data: {
          user_id: testUser.id,
          plan_type: 'PRO',
          status: 'ACTIVE',
          started_at: new Date(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        }
      });
    });

    it('should cancel subscription', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions/cancel',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.message).toBe('Subscription cancelled successfully');

      // Verify subscription is cancelled in database
      const subscription = await prisma.subscription.findFirst({
        where: { user_id: testUser.id }
      });
      expect(subscription?.status).toBe('CANCELLED');
    });
  });

  describe('Payment History', () => {
    beforeEach(async () => {
      // Create test payment history
      await prisma.paymentHistory.createMany({
        data: [
          {
            user_id: testUser.id,
            amount: 12.00,
            currency: 'USD',
            provider_ref: 'test_payment_1',
            status: 'COMPLETED',
          },
          {
            user_id: testUser.id,
            amount: 12.00,
            currency: 'USD',
            provider_ref: 'test_payment_2',
            status: 'COMPLETED',
          }
        ]
      });
    });

    it('should get payment history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/history',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(2);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(2);
    });

    it('should get paginated payment history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/history?page=1&limit=1',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.data).toHaveLength(1);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(1);
      expect(data.pagination.total).toBe(2);
      expect(data.pagination.pages).toBe(2);
    });
  });

  describe('RevenueCat Webhook', () => {
    const webhookSecret = 'test_webhook_secret';

    beforeAll(() => {
      process.env.REVENUECAT_WEBHOOK_SECRET = webhookSecret;
    });

    function createWebhookSignature(payload: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    it('should process INITIAL_PURCHASE webhook', async () => {
      const webhookPayload = {
        event: {
          type: 'INITIAL_PURCHASE',
          id: 'test_event_1',
          event_timestamp_ms: Date.now(),
          app_user_id: testUser.id,
          original_app_user_id: testUser.id,
          product_id: 'devpocket_pro_monthly',
          purchased_at_ms: Date.now(),
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
          environment: 'SANDBOX' as const,
          app_id: 'test_app',
          currency: 'USD',
          price: 12.00,
          transaction_id: 'test_transaction_1'
        }
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = createWebhookSignature(payload, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/revenuecat',
        payload: webhookPayload,
        headers: {
          'x-revenuecat-signature': signature,
          'content-type': 'application/json'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);

      // Verify subscription was created
      const subscription = await prisma.subscription.findFirst({
        where: { user_id: testUser.id }
      });
      expect(subscription).toBeDefined();
      expect(subscription?.plan_type).toBe('PRO');
      expect(subscription?.status).toBe('ACTIVE');

      // Verify payment history was created
      const payment = await prisma.paymentHistory.findFirst({
        where: { user_id: testUser.id }
      });
      expect(payment).toBeDefined();
      expect(payment?.amount.toNumber()).toBe(12.00);
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        event: {
          type: 'TEST',
          id: 'test_event_2',
          event_timestamp_ms: Date.now(),
          app_user_id: testUser.id,
          original_app_user_id: testUser.id,
          product_id: 'test_product',
          purchased_at_ms: Date.now(),
          environment: 'SANDBOX' as const,
          app_id: 'test_app'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/revenuecat',
        payload: webhookPayload,
        headers: {
          'x-revenuecat-signature': 'invalid_signature',
          'content-type': 'application/json'
        }
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('should reject webhook with missing signature', async () => {
      const webhookPayload = {
        event: {
          type: 'TEST',
          id: 'test_event_3',
          event_timestamp_ms: Date.now(),
          app_user_id: testUser.id,
          original_app_user_id: testUser.id,
          product_id: 'test_product',
          purchased_at_ms: Date.now(),
          environment: 'SANDBOX' as const,
          app_id: 'test_app'
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/revenuecat',
        payload: webhookPayload,
        headers: {
          'content-type': 'application/json'
        }
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toBe('Missing webhook signature');
    });
  });

  describe('Health Check', () => {
    it('should return payment service health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payment/health'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      
      expect(data.status).toBe('ok');
      expect(data.service).toBe('payment');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Authentication Required', () => {
    it('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/v1/subscriptions/current',
        '/api/v1/subscriptions/status',
        '/api/v1/subscriptions/plans',
        '/api/v1/subscriptions/history',
        '/api/v1/subscriptions/usage/ssh',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await app.inject({
          method: 'GET',
          url: endpoint
        });

        expect(response.statusCode).toBe(401);
      }
    });
  });
});