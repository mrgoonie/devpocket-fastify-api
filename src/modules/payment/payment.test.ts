import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, createTestUserAndLogin } from '@/tests/helper.js';
import { setupTestDatabase } from '@/tests/db.js';
import { prisma } from '@/shared/database/client.js';
import { UserResponse } from '../auth/auth.schema.js';
import { PlanInfo } from './payment.schema.js';
import crypto from 'crypto';

// Generic API Response Type
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
  error?: string;
  plans?: PlanInfo[];
  subscription?: SubscriptionData;
  hasActiveSubscription?: boolean;
  allowed?: boolean;
  currentUsage?: number;
  limit?: number;
  pagination?: PaginationData;
}

// Specific Data Interfaces
interface SubscriptionLimit {
  sshConnections: number;
  aiRequests: number;
  cloudHistory: boolean;
}

interface SubscriptionUsage {
  sshConnections: number;
  aiRequests: number;
}

interface SubscriptionData {
  planType: 'FREE' | 'PRO' | 'TEAM';
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE';
  limits: SubscriptionLimit;
  usage: SubscriptionUsage;
}

interface PlansData {
  plans: PlanInfo[];
}

interface CurrentSubscriptionData {
  subscription: SubscriptionData;
}

interface SubscriptionStatusData {
  hasActiveSubscription: boolean;
  subscription: SubscriptionData;
}

interface UsageLimitData {
  allowed: boolean;
  currentUsage: number;
  limit: number;
}

interface CancelSubscriptionData {
  message: string;
}

interface PaymentHistoryItem {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  provider_ref: string;
  status: string;
  created_at: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface PaymentHistoryData {
  data: PaymentHistoryItem[];
  pagination: PaginationData;
}

interface WebhookData {
  success: boolean;
}

interface HealthCheckData {
  status: string;
  service: string;
  timestamp: string;
}

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
        const { plans } = response.json<ApiResponse<PlansData>>();

        expect(plans).toBeDefined();
        if (plans) {
          expect(plans).toHaveLength(3);

          const planTypes = plans.map((p: PlanInfo) => p.type);
          expect(planTypes).toContain('FREE');
          expect(planTypes).toContain('PRO');
          expect(planTypes).toContain('TEAM');

          const freePlan = plans.find((p: PlanInfo) => p.type === 'FREE');
          expect(freePlan).toBeDefined();
          if (freePlan) {
            expect(freePlan.price).toBe(0);
            expect(freePlan.limits.sshConnections).toBe(1);
            expect(freePlan.limits.aiRequests).toBe(10);
            expect(freePlan.limits.cloudHistory).toBe(false);
          }
        }
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
        const { error } = response.json<ApiResponse<null>>();
        expect(error).toBe('User already has a subscription');
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
        const { subscription } = response.json<ApiResponse<CurrentSubscriptionData>>();
        expect(subscription).toBeDefined();
        if (subscription) {
          expect(subscription.planType).toBe('FREE');
          expect(subscription.status).toBe('ACTIVE');
        }
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
        const { subscription } = response.json<ApiResponse<CurrentSubscriptionData>>();

        expect(subscription).toBeDefined();
        if (subscription) {
          expect(subscription.planType).toBe('FREE');
          expect(subscription.status).toBe('ACTIVE');
          expect(subscription.limits).toBeDefined();
          expect(subscription.usage).toBeDefined();
        }
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
        const { hasActiveSubscription, subscription } = response.json<ApiResponse<SubscriptionStatusData>>();

        expect(hasActiveSubscription).toBe(true);
        expect(subscription).toBeDefined();
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
        const data = response.json<ApiResponse<UsageLimitData>>();

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
        const data = response.json<ApiResponse<UsageLimitData>>();

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
        const { message } = response.json<ApiResponse<CancelSubscriptionData>>();
        expect(message).toBe('Subscription cancelled successfully');

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
        const { data, pagination } = response.json<ApiResponse<PaymentHistoryData>>();

        expect(data).toBeDefined();
        expect(data).toHaveLength(2);
        expect(pagination).toBeDefined();
        if (pagination) {
          expect(pagination.total).toBe(2);
        }
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
        const { data, pagination } = response.json<ApiResponse<PaymentHistoryData>>();

        expect(data).toHaveLength(1);
        if (pagination) {
          expect(pagination.page).toBe(1);
          expect(pagination.limit).toBe(1);
          expect(pagination.total).toBe(2);
          expect(pagination.pages).toBe(2);
        }
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
      const { success } = response.json<ApiResponse<WebhookData>>();
      expect(success).toBe(true);

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
      const { error } = response.json<ApiResponse<null>>();
      expect(error).toBe('Invalid webhook signature');
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
      const data = response.json<HealthCheckData>();

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