import { PrismaClient, PlanType } from '@prisma/client';
import crypto from 'crypto';
import {
  CurrentSubscription,
  UsageCheckResult,
  RevenueCatWebhook,
  planLimits,
} from './payment.schema.js';
import { logger } from '@/shared/logger.js';

export class PaymentService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Verify RevenueCat webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * Process RevenueCat webhook event
   */
  async processWebhookEvent(webhook: RevenueCatWebhook): Promise<void> {
    const { event } = webhook;
    const userId = event.app_user_id;

    try {
      switch (event.type) {
        case 'INITIAL_PURCHASE':
        case 'NON_RENEWING_PURCHASE':
          await this.handlePurchase(event, userId);
          break;

        case 'RENEWAL':
          await this.handleRenewal(event, userId);
          break;

        case 'PRODUCT_CHANGE':
          await this.handlePlanChange(event, userId);
          break;

        case 'CANCELLATION':
          await this.handleCancellation(event, userId);
          break;

        case 'UNCANCELLATION':
          await this.handleUncancellation(event, userId);
          break;

        case 'EXPIRATION':
        case 'NON_RENEWING_PURCHASE_EXPIRATION':
          await this.handleExpiration(event, userId);
          break;

        case 'BILLING_ISSUE':
          await this.handleBillingIssue(event, userId);
          break;

        case 'TEST':
          logger.info('Test webhook event received:', event);
          break;

        default:
          logger.warn('Unhandled webhook event type:', event.type);
      }
    } catch (error) {
      logger.error('Error processing webhook event:', error);
      throw new Error(`Failed to process webhook event: ${event.type}`);
    }
  }

  /**
   * Handle initial purchase
   */
  private async handlePurchase(event: any, userId: string): Promise<void> {
    const planType = this.mapProductIdToPlan(event.product_id);
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    await this.prisma.$transaction(async (tx) => {
      // Find existing active subscription
      const existingSubscription = await tx.subscription.findFirst({
        where: { 
          user_id: userId,
          status: 'ACTIVE'
        },
        orderBy: { created_at: 'desc' }
      });

      if (existingSubscription) {
        // Update existing subscription
        await tx.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            plan_type: planType,
            status: 'ACTIVE',
            started_at: new Date(event.purchased_at_ms),
            expires_at: expiresAt,
          },
        });
      } else {
        // Create new subscription
        await tx.subscription.create({
          data: {
            user_id: userId,
            plan_type: planType,
            status: 'ACTIVE',
            started_at: new Date(event.purchased_at_ms),
            expires_at: expiresAt,
          },
        });
      }

      // Create payment history record
      if (event.price && event.currency) {
        await tx.paymentHistory.create({
          data: {
            user_id: userId,
            amount: event.price,
            currency: event.currency,
            provider_ref: event.transaction_id || event.id,
            status: 'COMPLETED',
          },
        });
      }

      // Update usage limits
      await this.updateUserUsageLimits(tx, userId, planType);
    });
  }

  /**
   * Handle subscription renewal
   */
  private async handleRenewal(event: any, userId: string): Promise<void> {
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    await this.prisma.$transaction(async (tx) => {
      // Update subscription expiration
      await tx.subscription.updateMany({
        where: { user_id: userId, status: 'ACTIVE' },
        data: {
          expires_at: expiresAt,
          updated_at: new Date(),
        },
      });

      // Create payment history record
      if (event.price && event.currency) {
        await tx.paymentHistory.create({
          data: {
            user_id: userId,
            amount: event.price,
            currency: event.currency,
            provider_ref: event.transaction_id || event.id,
            status: 'COMPLETED',
          },
        });
      }

      // Reset usage limits for new billing period
      await this.resetUserUsageLimits(tx, userId);
    });
  }

  /**
   * Handle plan change (upgrade/downgrade)
   */
  private async handlePlanChange(event: any, userId: string): Promise<void> {
    const newPlanType = this.mapProductIdToPlan(event.product_id);
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    await this.prisma.$transaction(async (tx) => {
      // Update subscription
      await tx.subscription.updateMany({
        where: { user_id: userId, status: 'ACTIVE' },
        data: {
          plan_type: newPlanType,
          expires_at: expiresAt,
          updated_at: new Date(),
        },
      });

      // Update usage limits to new plan
      await this.updateUserUsageLimits(tx, userId, newPlanType);
    });
  }

  /**
   * Handle subscription cancellation
   */
  private async handleCancellation(_event: any, userId: string): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { user_id: userId, status: 'ACTIVE' },
      data: {
        status: 'CANCELLED',
        updated_at: new Date(),
      },
    });
  }

  /**
   * Handle subscription uncancellation
   */
  private async handleUncancellation(_event: any, userId: string): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { user_id: userId, status: 'CANCELLED' },
      data: {
        status: 'ACTIVE',
        updated_at: new Date(),
      },
    });
  }

  /**
   * Handle subscription expiration
   */
  private async handleExpiration(_event: any, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update subscription status
      await tx.subscription.updateMany({
        where: { user_id: userId, status: { in: ['ACTIVE', 'CANCELLED'] } },
        data: {
          status: 'EXPIRED',
          updated_at: new Date(),
        },
      });

      // Downgrade to FREE plan
      await this.updateUserUsageLimits(tx, userId, 'FREE');
    });
  }

  /**
   * Handle billing issue
   */
  private async handleBillingIssue(_event: any, userId: string): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { user_id: userId, status: 'ACTIVE' },
      data: {
        status: 'PAYMENT_FAILED',
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get current user subscription
   */
  async getCurrentSubscription(userId: string): Promise<CurrentSubscription | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    if (!subscription) {
      // Create default FREE subscription if none exists
      const freeSubscription = await this.createFreeSubscription(userId);
      return this.formatCurrentSubscription(freeSubscription, userId);
    }

    return this.formatCurrentSubscription(subscription, userId);
  }

  /**
   * Create free subscription for new users
   */
  async createFreeSubscription(userId: string) {
    const freeTrialEnd = new Date();
    freeTrialEnd.setDate(freeTrialEnd.getDate() + 7); // 7-day trial

    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          user_id: userId,
          plan_type: 'FREE',
          status: 'ACTIVE',
          started_at: new Date(),
          expires_at: freeTrialEnd,
        },
      });

      // Initialize usage limits
      await this.updateUserUsageLimits(tx, userId, 'FREE');

      return subscription;
    });
  }

  /**
   * Format subscription with usage data
   */
  private async formatCurrentSubscription(subscription: any, userId: string): Promise<CurrentSubscription> {
    const usageLimits = await this.prisma.usageLimits.findUnique({
      where: { user_id: userId },
    });

    const limits = planLimits[subscription.plan_type as PlanType];

    return {
      id: subscription.id,
      planType: subscription.plan_type,
      status: subscription.status,
      startedAt: subscription.started_at,
      expiresAt: subscription.expires_at,
      limits,
      usage: {
        sshConnections: usageLimits?.ssh_connections || 0,
        aiRequests: usageLimits?.ai_requests || 0,
        resetDate: usageLimits?.reset_date || new Date(),
      },
    };
  }

  /**
   * Check if user can use a feature
   */
  async checkUsageLimit(userId: string, feature: 'ssh' | 'ai'): Promise<UsageCheckResult> {
    const subscription = await this.getCurrentSubscription(userId);
    
    if (!subscription) {
      return {
        allowed: false,
        reason: 'No active subscription',
        currentUsage: 0,
        limit: 0,
      };
    }

    const limits = subscription.limits;
    const usage = subscription.usage;

    switch (feature) {
      case 'ssh':
        return {
          allowed: usage.sshConnections < limits.sshConnections,
          reason: usage.sshConnections >= limits.sshConnections ? 'SSH connection limit reached' : undefined,
          currentUsage: usage.sshConnections,
          limit: limits.sshConnections,
        };
      
      case 'ai':
        return {
          allowed: usage.aiRequests < limits.aiRequests,
          reason: usage.aiRequests >= limits.aiRequests ? 'AI request limit reached' : undefined,
          currentUsage: usage.aiRequests,
          limit: limits.aiRequests,
        };

      default:
        return {
          allowed: false,
          reason: 'Unknown feature',
          currentUsage: 0,
          limit: 0,
        };
    }
  }

  /**
   * Increment usage counter
   */
  async incrementUsage(userId: string, feature: 'ssh' | 'ai'): Promise<void> {
    const field = feature === 'ssh' ? 'ssh_connections' : 'ai_requests';
    
    await this.prisma.usageLimits.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        plan_type: 'FREE',
        ssh_connections: feature === 'ssh' ? 1 : 0,
        ai_requests: feature === 'ai' ? 1 : 0,
        reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      update: {
        [field]: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.paymentHistory.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.paymentHistory.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user usage limits based on plan
   */
  private async updateUserUsageLimits(tx: any, userId: string, planType: PlanType): Promise<void> {
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1); // Reset monthly

    await tx.usageLimits.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        plan_type: planType,
        ssh_connections: 0,
        ai_requests: 0,
        reset_date: resetDate,
      },
      update: {
        plan_type: planType,
        reset_date: resetDate,
      },
    });
  }

  /**
   * Reset user usage limits for new billing period
   */
  private async resetUserUsageLimits(tx: any, userId: string): Promise<void> {
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);

    await tx.usageLimits.updateMany({
      where: { user_id: userId },
      data: {
        ssh_connections: 0,
        ai_requests: 0,
        reset_date: resetDate,
      },
    });
  }

  /**
   * Map RevenueCat product ID to internal plan type
   */
  private mapProductIdToPlan(productId: string): PlanType {
    // Map your RevenueCat product IDs to internal plan types
    const productMapping: Record<string, PlanType> = {
      'devpocket_pro_monthly': 'PRO',
      'devpocket_pro_yearly': 'PRO',
      'devpocket_team_monthly': 'TEAM',
      'devpocket_team_yearly': 'TEAM',
    };

    return productMapping[productId] || 'FREE';
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: 'ACTIVE',
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } }
        ]
      },
    });

    return subscription !== null;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: {
        user_id: userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'CANCELLED',
        updated_at: new Date(),
      },
    });
  }
}