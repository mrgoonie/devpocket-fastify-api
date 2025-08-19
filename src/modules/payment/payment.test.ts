import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, createTestUserAndLogin } from '@/tests/helper.js';
import { setupTestDatabase } from '@/tests/db.js';
import { prisma } from '@/shared/database/client.js';
import { UserResponse } from '../auth/auth.schema.js';
import { PlanInfo } from './payment.schema.js';
import crypto from 'crypto';

describe('Payment Module', () => {
  let app: FastifyInstance;
  let testUser: UserResponse;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authenticated Routes', () => {
    beforeEach(async () => {
      const authData = await createTestUserAndLogin(app);
      testUser = authData.user;
      authToken = authData.token;
    });

    describe('Subscription Plans', () => {
      it('should get available subscription plans', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/plans',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        expect(data.plans).toBeDefined();
        expect(data.plans).toHaveLength(3);

        const planTypes = data.plans.map((p: PlanInfo) => p.type);
        expect(planTypes).toContain('FREE');
        expect(planTypes).toContain('PRO');
        expect(planTypes).toContain('TEAM');

        const freePlan = data.plans.find((p: PlanInfo) => p.type === 'FREE');
        expect(freePlan).toBeDefined();
        expect(freePlan.price).toBe(0);
        expect(freePlan.limits.sshConnections).toBe(1);
        expect(freePlan.limits.aiRequests).toBe(10);
        expect(freePlan.limits.cloudHistory).toBe(false);
      });
    });

    describe('Free Subscription Creation', () => {
      it('should not allow manual subscription creation as system auto-creates on first access', async () => {
        await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/current',
          headers: { authorization: `Bearer ${authToken}` },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/subscriptions/free',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('User already has a subscription');
      });

      it('should auto-create free subscription when getting current subscription', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/current',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data.subscription).toBeDefined();
        expect(data.subscription.planType).toBe('FREE');
        expect(data.subscription.status).toBe('ACTIVE');
      });
    });

    describe('Current Subscription', () => {
      it('should get current subscription', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/current',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

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
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        expect(data.hasActiveSubscription).toBe(true);
        expect(data.subscription).toBeDefined();
      });
    });

    describe('Usage Limits', () => {
      it('should check SSH usage limit', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/usage/ssh',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        expect(data.allowed).toBe(true);
        expect(data.currentUsage).toBe(0);
        expect(data.limit).toBe(1); // FREE plan limit
      });

      it('should check AI usage limit', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/usage/ai',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        expect(data.allowed).toBe(true);
        expect(data.currentUsage).toBe(0);
        expect(data.limit).toBe(10); // FREE plan limit
      });

      it('should reject invalid feature in usage check', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/usage/invalid',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('Subscription Management', () => {
      beforeEach(async () => {
        await prisma.subscription.create({
          data: {
            user_id: testUser.id,
            plan_type: 'PRO',
            status: 'ACTIVE',
            started_at: new Date(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      });

      it('should cancel subscription', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/subscriptions/cancel',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data.message).toBe('Subscription cancelled successfully');

        const subscription = await prisma.subscription.findFirst({
          where: { user_id: testUser.id },
        });
        expect(subscription?.status).toBe('CANCELLED');
      });
    });

    describe('Payment History', () => {
      beforeEach(async () => {
        await prisma.paymentHistory.createMany({
          data: [
            {
              user_id: testUser.id,
              amount: 12.0,
              currency: 'USD',
              provider_ref: 'test_payment_1',
              status: 'COMPLETED',
            },
            {
              user_id: testUser.id,
              amount: 12.0,
              currency: 'USD',
              provider_ref: 'test_payment_2',
              status: 'COMPLETED',
            },
          ],
        });
      });

      it('should get payment history', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/subscriptions/history',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

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
            authorization: `Bearer ${authToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        expect(data.data).toHaveLength(1);
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(1);
        expect(data.pagination.total).toBe(2);
        expect(data.pagination.pages).toBe(2);
      });
    });
  });

  describe('RevenueCat Webhook', () => {
    const webhookSecret = 'test_webhook_secret';

    beforeAll(() => {
      process.env.REVENUECAT_WEBHOOK_SECRET = webhookSecret;
    });

    afterAll(() => {
      delete process.env.REVENUECAT_WEBHOOK_SECRET;
    });

    function createWebhookSignature(payload: string, secret: string): string {
      return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }

    it('should process INITIAL_PURCHASE webhook', async () => {
      const { user } = await createTestUserAndLogin(app);
      const webhookPayload = {
        event: {
          type: 'INITIAL_PURCHASE',
          id: 'test_event_1',
          event_timestamp_ms: Date.now(),
          app_user_id: user.id,
          original_app_user_id: user.id,
          product_id: 'devpocket_pro_monthly',
          purchased_at_ms: Date.now(),
          expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
          environment: 'SANDBOX' as const,
          app_id: 'test_app',
          currency: 'USD',
          price: 12.0,
          transaction_id: 'test_transaction_1',
        },
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = createWebhookSignature(payload, webhookSecret);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/revenuecat',
        payload: webhookPayload,
        headers: {
          'x-revenuecat-signature': signature,
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);

      const subscription = await prisma.subscription.findFirst({
        where: { user_id: user.id },
      });
      expect(subscription).toBeDefined();
      expect(subscription?.plan_type).toBe('PRO');
      expect(subscription?.status).toBe('ACTIVE');

      const payment = await prisma.paymentHistory.findFirst({
        where: { user_id: user.id },
      });
      expect(payment).toBeDefined();
      expect(payment?.amount.toNumber()).toBe(12.0);
    });

    it('should reject webhook with invalid signature', async () => {
      const { user } = await createTestUserAndLogin(app);
      const webhookPayload = {
        event: {
          type: 'TEST',
          id: 'test_event_2',
          event_timestamp_ms: Date.now(),
          app_user_id: user.id,
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/revenuecat',
        payload: webhookPayload,
        headers: {
          'x-revenuecat-signature': 'invalid_signature',
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('Invalid webhook signature');
    });

    it('should reject webhook with missing signature', async () => {
      const webhookPayload = {
        event: {
          type: 'TEST',
          id: 'test_event_3',
          event_timestamp_ms: Date.now(),
          app_user_id: 'any_user_id',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/revenuecat',
        payload: webhookPayload,
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Health Check', () => {
    it('should return payment service health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/payment/health',
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();

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
          url: endpoint,
        });

        expect(response.statusCode).toBe(401);
      }
    });
  });
});