import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from './payment.service.js';
import { RevenueCatWebhookSchema, planInfo, PlanType } from './payment.schema.js';
import { AuthenticatedRequest } from '../auth/auth.middleware.js';

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  /**
   * Handle RevenueCat webhook
   */
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const signature = request.headers['x-revenuecat-signature'] as string;
      const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

      if (!webhookSecret) {
        return reply.code(500).send({ error: 'Webhook secret not configured' });
      }

      if (!signature) {
        return reply.code(400).send({ error: 'Missing webhook signature' });
      }

      // Verify webhook signature
      const payload = JSON.stringify(request.body);
      const isValid = this.paymentService.verifyWebhookSignature(payload, signature, webhookSecret);

      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid webhook signature' });
      }

      // Parse and validate webhook payload
      const webhook = RevenueCatWebhookSchema.parse(request.body);

      // Process the webhook event
      await this.paymentService.processWebhookEvent(webhook);

      reply.code(200).send({ success: true });
    } catch (error) {
      request.log.error('Webhook processing error:', error);
      
      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }
      
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Get current user subscription
   */
  async getCurrentSubscription(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const subscription = await this.paymentService.getCurrentSubscription(userId);

      if (!subscription) {
        return reply.code(404).send({ error: 'No subscription found' });
      }

      reply.send({ subscription });
    } catch (error) {
      request.log.error('Get subscription error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Get available subscription plans
   */
  async getSubscriptionPlans(request: FastifyRequest, reply: FastifyReply) {
    try {
      const plans = Object.entries(planInfo).map(([type, info]) => ({
        type: type as PlanType,
        ...info,
      }));

      reply.send({ plans });
    } catch (error) {
      request.log.error('Get plans error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };

      const result = await this.paymentService.getPaymentHistory(userId, page, limit);

      reply.send(result);
    } catch (error) {
      request.log.error('Get payment history error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;

      await this.paymentService.cancelSubscription(userId);

      reply.send({ message: 'Subscription cancelled successfully' });
    } catch (error) {
      request.log.error('Cancel subscription error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Check usage limits for a feature
   */
  async checkUsageLimit(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { feature } = request.params as { feature: 'ssh' | 'ai' };

      if (!['ssh', 'ai'].includes(feature)) {
        return reply.code(400).send({ error: 'Invalid feature. Must be "ssh" or "ai"' });
      }

      const result = await this.paymentService.checkUsageLimit(userId, feature);

      reply.send(result);
    } catch (error) {
      request.log.error('Check usage limit error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Get subscription status for authenticated user
   */
  async getSubscriptionStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const hasActive = await this.paymentService.hasActiveSubscription(userId);
      const subscription = await this.paymentService.getCurrentSubscription(userId);

      reply.send({
        hasActiveSubscription: hasActive,
        subscription,
      });
    } catch (error) {
      request.log.error('Get subscription status error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Create initial free subscription for new users
   */
  async createFreeSubscription(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;

      // Check if user already has a subscription
      const existingSubscription = await this.paymentService.getCurrentSubscription(userId);
      
      if (existingSubscription) {
        return reply.code(400).send({ error: 'User already has a subscription' });
      }

      const subscription = await this.paymentService.createFreeSubscription(userId);

      reply.code(201).send({ 
        message: 'Free subscription created successfully',
        subscription 
      });
    } catch (error) {
      request.log.error('Create free subscription error:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Health check endpoint for webhook
   */
  async healthCheck(request: FastifyRequest, reply: FastifyReply) {
    reply.send({ 
      status: 'ok', 
      service: 'payment',
      timestamp: new Date().toISOString() 
    });
  }
}