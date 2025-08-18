import { z } from 'zod';

// Plan types enum
export const PlanTypeSchema = z.enum(['FREE', 'PRO', 'TEAM']);
export type PlanType = z.infer<typeof PlanTypeSchema>;

// Subscription status enum
export const SubscriptionStatusSchema = z.enum(['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAYMENT_FAILED']);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// Invoice status enum
export const InvoiceStatusSchema = z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

// Plan limits configuration
export interface PlanLimits {
  sshConnections: number;
  aiRequests: number;
  cloudHistory: boolean;
  multiDevice: boolean;
  teamFeatures: boolean;
  prioritySupport: boolean;
}

export const planLimits: Record<PlanType, PlanLimits> = {
  FREE: {
    sshConnections: 1,
    aiRequests: 10,
    cloudHistory: false,
    multiDevice: false,
    teamFeatures: false,
    prioritySupport: false,
  },
  PRO: {
    sshConnections: 10,
    aiRequests: 1000,
    cloudHistory: true,
    multiDevice: true,
    teamFeatures: false,
    prioritySupport: true,
  },
  TEAM: {
    sshConnections: 50,
    aiRequests: 5000,
    cloudHistory: true,
    multiDevice: true,
    teamFeatures: true,
    prioritySupport: true,
  },
};

// RevenueCat webhook event types
export const RevenueCatEventTypeSchema = z.enum([
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE_EXPIRATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_UNPAUSED',
  'TRANSFER',
  'TEST'
]);
export type RevenueCatEventType = z.infer<typeof RevenueCatEventTypeSchema>;

// RevenueCat webhook payload schema
export const RevenueCatWebhookSchema = z.object({
  event: z.object({
    type: RevenueCatEventTypeSchema,
    id: z.string(),
    event_timestamp_ms: z.number(),
    app_user_id: z.string(),
    aliases: z.array(z.string()).optional(),
    original_app_user_id: z.string(),
    product_id: z.string(),
    period_type: z.enum(['INTRO', 'TRIAL', 'NORMAL']).optional(),
    purchased_at_ms: z.number(),
    expiration_at_ms: z.number().optional(),
    environment: z.enum(['SANDBOX', 'PRODUCTION']),
    entitlement_id: z.string().optional(),
    entitlement_ids: z.array(z.string()).optional(),
    presented_offering_id: z.string().optional(),
    transaction_id: z.string().optional(),
    original_transaction_id: z.string().optional(),
    is_family_share: z.boolean().optional(),
    country_code: z.string().optional(),
    app_id: z.string(),
    currency: z.string().optional(),
    price: z.number().optional(),
    price_in_purchased_currency: z.number().optional(),
    subscriber_attributes: z.record(z.any()).optional(),
    store: z.enum(['APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMO']).optional(),
    takehome_percentage: z.number().optional(),
    offer_code: z.string().optional(),
    tax_percentage: z.number().optional(),
    commission_percentage: z.number().optional(),
    cancel_reason: z.enum([
      'UNSUBSCRIBE',
      'BILLING_ERROR',
      'DEVELOPER_INITIATED',
      'PRICE_INCREASE',
      'CUSTOMER_SUPPORT',
      'UNKNOWN'
    ]).optional(),
    auto_resume_at_ms: z.number().optional(),
  })
});
export type RevenueCatWebhook = z.infer<typeof RevenueCatWebhookSchema>;

// Subscription creation schema
export const CreateSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planType: PlanTypeSchema,
  providerRef: z.string(),
  expiresAt: z.date().optional(),
});
export type CreateSubscription = z.infer<typeof CreateSubscriptionSchema>;

// Subscription update schema
export const UpdateSubscriptionSchema = z.object({
  planType: PlanTypeSchema.optional(),
  status: SubscriptionStatusSchema.optional(),
  expiresAt: z.date().optional(),
});
export type UpdateSubscription = z.infer<typeof UpdateSubscriptionSchema>;

// Payment history creation schema
export const CreatePaymentHistorySchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  providerRef: z.string(),
  status: z.string(),
});
export type CreatePaymentHistory = z.infer<typeof CreatePaymentHistorySchema>;

// Usage limits update schema
export const UpdateUsageLimitsSchema = z.object({
  sshConnections: z.number().nonnegative().optional(),
  aiRequests: z.number().nonnegative().optional(),
});
export type UpdateUsageLimits = z.infer<typeof UpdateUsageLimitsSchema>;

// Plan information response schema
export const PlanInfoSchema = z.object({
  type: PlanTypeSchema,
  name: z.string(),
  description: z.string(),
  price: z.number(),
  currency: z.string(),
  billingPeriod: z.enum(['MONTHLY', 'YEARLY']),
  features: z.array(z.string()),
  limits: z.object({
    sshConnections: z.number(),
    aiRequests: z.number(),
    cloudHistory: z.boolean(),
    multiDevice: z.boolean(),
    teamFeatures: z.boolean(),
    prioritySupport: z.boolean(),
  }),
});
export type PlanInfo = z.infer<typeof PlanInfoSchema>;

// Current subscription response schema
export const CurrentSubscriptionSchema = z.object({
  id: z.string().uuid(),
  planType: PlanTypeSchema,
  status: SubscriptionStatusSchema,
  startedAt: z.date(),
  expiresAt: z.date().nullable(),
  limits: z.object({
    sshConnections: z.number(),
    aiRequests: z.number(),
    cloudHistory: z.boolean(),
    multiDevice: z.boolean(),
    teamFeatures: z.boolean(),
    prioritySupport: z.boolean(),
  }),
  usage: z.object({
    sshConnections: z.number(),
    aiRequests: z.number(),
    resetDate: z.date(),
  }),
});
export type CurrentSubscription = z.infer<typeof CurrentSubscriptionSchema>;

// Usage check result
export const UsageCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  currentUsage: z.number(),
  limit: z.number(),
});
export type UsageCheckResult = z.infer<typeof UsageCheckResultSchema>;

// Plan pricing configuration
export const planPricing = {
  FREE: { price: 0, currency: 'USD', billingPeriod: 'MONTHLY' as const },
  PRO: { price: 12, currency: 'USD', billingPeriod: 'MONTHLY' as const },
  TEAM: { price: 25, currency: 'USD', billingPeriod: 'MONTHLY' as const },
} as const;

// Plan information for API responses
export const planInfo: Record<PlanType, Omit<PlanInfo, 'type'>> = {
  FREE: {
    name: 'Free Tier',
    description: '7-day trial with core terminal features and BYOK AI',
    ...planPricing.FREE,
    features: [
      'Core terminal functionality',
      'SSH connections (1 max)',
      'AI features with BYOK',
      'Basic command history',
    ],
    limits: planLimits.FREE,
  },
  PRO: {
    name: 'Pro Tier',
    description: 'Full features with multi-device sync and cloud storage',
    ...planPricing.PRO,
    features: [
      'Everything in Free',
      'Multi-device synchronization',
      'Cloud command history',
      'SSH connections (10 max)',
      'AI request caching',
      'Priority support',
    ],
    limits: planLimits.PRO,
  },
  TEAM: {
    name: 'Team Tier',
    description: 'Advanced team collaboration and enterprise features',
    ...planPricing.TEAM,
    features: [
      'Everything in Pro',
      'Team workspaces',
      'Shared SSH profiles',
      'Advanced collaboration tools',
      'SSH connections (50 max)',
      'SSO integration',
      'Advanced analytics',
    ],
    limits: planLimits.TEAM,
  },
};