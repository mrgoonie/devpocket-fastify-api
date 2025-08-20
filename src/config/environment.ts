import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file (but not in test mode - handled by test setup)
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32).default('your-super-secret-jwt-key-change-this-in-production'),
  JWT_REFRESH_SECRET: z.string().min(32).default('your-refresh-secret-change-this-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().min(32).default('your-encryption-key-for-ssh-keys-change-this'),
  RESEND_API_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  FROM_EMAIL: z.string().email().default('noreply@devpocket.com'),
  FRONTEND_URL: z.string().url().default('https://api.devpocket.com'),
});

// Validate environment variables
const envVars = envSchema.parse(process.env);

export const config = {
  NODE_ENV: envVars.NODE_ENV,
  PORT: envVars.PORT,
  HOST: envVars.HOST,
  DATABASE_URL: envVars.DATABASE_URL,
  REDIS_URL: envVars.REDIS_URL,
  JWT: {
    SECRET: envVars.JWT_SECRET,
    REFRESH_SECRET: envVars.JWT_REFRESH_SECRET,
    EXPIRES_IN: envVars.JWT_EXPIRES_IN,
    REFRESH_EXPIRES_IN: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  ENCRYPTION_KEY: envVars.ENCRYPTION_KEY,
  RESEND_API_KEY: envVars.RESEND_API_KEY,
  REVENUECAT_WEBHOOK_SECRET: envVars.REVENUECAT_WEBHOOK_SECRET,
  FROM_EMAIL: envVars.FROM_EMAIL,
  FRONTEND_URL: envVars.FRONTEND_URL,
  isDevelopment: envVars.NODE_ENV === 'development',
  isProduction: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test',
} as const;