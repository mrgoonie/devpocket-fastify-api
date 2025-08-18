import { FastifyReply } from 'fastify';
import { PaymentService } from './payment.service.js';
import { AuthenticatedRequest } from '../auth/auth.middleware.js';

/**
 * Middleware to check SSH usage limits before allowing SSH operations
 */
export function checkSshUsageLimit(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      
      const usageCheck = await paymentService.checkUsageLimit(userId, 'ssh');
      
      if (!usageCheck.allowed) {
        return reply.code(403).send({
          error: 'SSH usage limit exceeded',
          reason: usageCheck.reason,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit,
        });
      }

      // Store usage check result in request for potential use later
      request.usageCheck = usageCheck;
    } catch (error) {
      request.log.error({ error }, 'SSH usage check error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check AI usage limits before allowing AI operations
 */
export function checkAiUsageLimit(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      
      const usageCheck = await paymentService.checkUsageLimit(userId, 'ai');
      
      if (!usageCheck.allowed) {
        return reply.code(403).send({
          error: 'AI usage limit exceeded',
          reason: usageCheck.reason,
          currentUsage: usageCheck.currentUsage,
          limit: usageCheck.limit,
        });
      }

      // Store usage check result in request for potential use later
      request.usageCheck = usageCheck;
    } catch (error) {
      request.log.error({ error }, 'AI usage check error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to increment SSH usage after successful SSH connection
 */
export function incrementSshUsage(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, _reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      await paymentService.incrementUsage(userId, 'ssh');
    } catch (error) {
      request.log.error({ error }, 'SSH usage increment error');
      // Don't fail the request if usage increment fails, just log it
    }
  };
}

/**
 * Middleware to increment AI usage after successful AI request
 */
export function incrementAiUsage(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, _reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      await paymentService.incrementUsage(userId, 'ai');
    } catch (error) {
      request.log.error({ error }, 'AI usage increment error');
      // Don't fail the request if usage increment fails, just log it
    }
  };
}

/**
 * Middleware to check if user has active subscription
 */
export function requireActiveSubscription(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      
      const hasActive = await paymentService.hasActiveSubscription(userId);
      
      if (!hasActive) {
        return reply.code(403).send({
          error: 'Active subscription required',
          message: 'This feature requires an active subscription. Please upgrade your plan.',
        });
      }
    } catch (error) {
      request.log.error({ error }, 'Subscription check error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if user has specific plan type
 */
export function requirePlanType(paymentService: PaymentService, requiredPlan: 'PRO' | 'TEAM') {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      
      const subscription = await paymentService.getCurrentSubscription(userId);
      
      if (!subscription) {
        return reply.code(403).send({
          error: 'Subscription required',
          message: `This feature requires a ${requiredPlan} subscription.`,
          requiredPlan,
        });
      }

      // Check if user has required plan or higher
      const planHierarchy = { FREE: 0, PRO: 1, TEAM: 2 };
      const userPlanLevel = planHierarchy[subscription.planType];
      const requiredPlanLevel = planHierarchy[requiredPlan];

      if (userPlanLevel < requiredPlanLevel) {
        return reply.code(403).send({
          error: 'Upgrade required',
          message: `This feature requires a ${requiredPlan} subscription or higher.`,
          currentPlan: subscription.planType,
          requiredPlan,
        });
      }
    } catch (error) {
      request.log.error({ error }, 'Plan type check error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if user has cloud history feature
 */
export function requireCloudHistory(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      
      const subscription = await paymentService.getCurrentSubscription(userId);
      
      if (!subscription || !subscription.limits.cloudHistory) {
        return reply.code(403).send({
          error: 'Cloud history not available',
          message: 'Cloud history feature requires a PRO or TEAM subscription.',
          currentPlan: subscription?.planType || 'FREE',
        });
      }
    } catch (error) {
      request.log.error({ error }, 'Cloud history check error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if user has multi-device feature
 */
export function requireMultiDevice(paymentService: PaymentService) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const userId = request.user.id;
      
      const subscription = await paymentService.getCurrentSubscription(userId);
      
      if (!subscription || !subscription.limits.multiDevice) {
        return reply.code(403).send({
          error: 'Multi-device not available',
          message: 'Multi-device synchronization requires a PRO or TEAM subscription.',
          currentPlan: subscription?.planType || 'FREE',
        });
      }
    } catch (error) {
      request.log.error({ error }, 'Multi-device check error');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if user has team features
 */
export function requireTeamFeatures(paymentService: PaymentService) {
  return requirePlanType(paymentService, 'TEAM');
}

// Extend AuthenticatedRequest type to include usage check result
declare module '../auth/auth.middleware.js' {
  interface AuthenticatedRequest {
    usageCheck?: {
      allowed: boolean;
      reason?: string;
      currentUsage: number;
      limit: number;
    };
  }
}