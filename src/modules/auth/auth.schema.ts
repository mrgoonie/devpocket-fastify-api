import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// User registration schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  device_id: z.string().optional(), // For session creation during auto-login
});

// User login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  device_id: z.string().optional(),
});

// Password reset request schema
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
});

// Password reset completion schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
});

// Email verification schema
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// Change password schema (for authenticated users)
export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Response schemas for Swagger documentation
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  email_verified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const loginResponseSchema = z.object({
  user: userResponseSchema,
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export const refreshResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

// Registration response schema for Flutter client compatibility
// Returns authentication tokens for auto-login after registration
export const registrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    user: userResponseSchema,
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number(),
  }),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;

// JSON Schema exports for Fastify validation (must be after Zod schema definitions)
export const registerJsonSchema = zodToJsonSchema(registerSchema, 'registerSchema');
export const loginJsonSchema = zodToJsonSchema(loginSchema, 'loginSchema');
export const forgotPasswordJsonSchema = zodToJsonSchema(forgotPasswordSchema, 'forgotPasswordSchema');
export const resetPasswordJsonSchema = zodToJsonSchema(resetPasswordSchema, 'resetPasswordSchema');
export const verifyEmailJsonSchema = zodToJsonSchema(verifyEmailSchema, 'verifyEmailSchema');
export const refreshTokenJsonSchema = zodToJsonSchema(refreshTokenSchema, 'refreshTokenSchema');
export const changePasswordJsonSchema = zodToJsonSchema(changePasswordSchema, 'changePasswordSchema');
export const userResponseJsonSchema = zodToJsonSchema(userResponseSchema, 'userResponseSchema');
export const loginResponseJsonSchema = zodToJsonSchema(loginResponseSchema, 'loginResponseSchema');
export const refreshResponseJsonSchema = zodToJsonSchema(refreshResponseSchema, 'refreshResponseSchema');
export const registrationResponseJsonSchema = zodToJsonSchema(registrationResponseSchema, 'registrationResponseSchema');