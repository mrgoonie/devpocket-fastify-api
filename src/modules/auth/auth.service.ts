import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '@/shared/database/client.js';
import { logger } from '@/shared/logger.js';
import type { RegisterInput, LoginInput, UserResponse } from './auth.schema.js';
import type { User } from '@prisma/client';

// Constants
const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PASSWORD_RESET_EXPIRES_IN_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_EXPIRES_IN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Email service interface for type safety
interface EmailService {
  sendWelcomeEmail(email: string, username: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, username: string, token: string): Promise<void>;
}

export class AuthService {
  // Pre-import email service to avoid dynamic imports during transactions
  private static emailService: EmailService | null = null;
  
  // Initialize email service
  private static async getEmailService() {
    if (!this.emailService) {
      try {
        const { EmailService } = await import('@/shared/email/email.service.js');
        this.emailService = EmailService;
      } catch (error) {
        logger.warn('Failed to load email service:', error);
      }
    }
    return this.emailService;
  }

  // Hash password using bcrypt
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, BCRYPT_ROUNDS);
    } catch (error) {
      logger.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  // Verify password against hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  // Generate secure random token
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Convert User model to response format
  static formatUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      email_verified: user.email_verified,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString(),
    };
  }

  // Retry mechanism for database conflicts
  private static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        // Handle Prisma P2034 (Transaction conflict) errors
        const prismaError = error as { code?: string; message?: string };
        if (prismaError?.code === 'P2034' && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn(`Database transaction conflict (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`, {
            error: prismaError.message || String(error)
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  // Register new user
  static async register(input: RegisterInput): Promise<UserResponse> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: input.email },
            { username: input.username },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === input.email) {
          throw new Error('Email already registered');
        }
        if (existingUser.username === input.username) {
          throw new Error('Username already taken');
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(input.password);

      // Use a transaction with retry logic to ensure all related data is created atomically
      const result = await this.retryOperation(async () => {
        return await prisma.$transaction(async (tx) => {
          // Create user
          const newUser = await tx.user.create({
            data: {
              email: input.email,
              username: input.username,
              password_hash: hashedPassword,
              email_verified: false,
            },
          });

          // Create a free subscription for the new user
          await tx.subscription.create({
            data: {
              user_id: newUser.id,
              plan_type: 'FREE',
              status: 'ACTIVE',
              started_at: new Date(),
              expires_at: null, // Free plan does not expire
            },
          });

          // Create usage limits for the new user
          await tx.usageLimits.create({
            data: {
              user_id: newUser.id,
              plan_type: 'FREE',
              reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
          });

          // Create email verification token
          const verificationToken = this.generateSecureToken();
          await tx.emailVerificationToken.create({
            data: {
              user_id: newUser.id,
              token: verificationToken,
              expires_at: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_IN_MS),
            },
          });

          return { user: newUser, verificationToken };
        }, {
          isolationLevel: 'Serializable', // Use serializable isolation for registration
          timeout: process.env.CI ? 15000 : 10000, // Longer timeout in CI
        });
      }, process.env.CI ? 5 : 3, process.env.CI ? 200 : 100); // More retries in CI with longer base delay

      logger.info(`User registered: ${result.user.email}`, { userId: result.user.id });

      // Send verification email OUTSIDE of transaction
      try {
        const emailService = await this.getEmailService();
        if (emailService) {
          await emailService.sendWelcomeEmail(result.user.email, result.user.username, result.verificationToken);
        }
      } catch (error) {
        logger.warn('Failed to send welcome email (non-blocking):', error);
        // Email failure should not affect user registration
      }

      return this.formatUserResponse(result.user);
    } catch (error) {
      logger.error('Error registering user:', error);
      throw error;
    }
  }

  // Authenticate user and create session
  static async login(input: LoginInput): Promise<{ user: UserResponse; session: { id: string; token: string } }> {
    try {
      // Find user by email with retry mechanism and enhanced transaction isolation
      const loginResult = await this.retryOperation(async () => {
        // Use transaction for the entire login flow to ensure consistency
        return await prisma.$transaction(async (tx) => {
          // Find user by email within transaction
          const user = await tx.user.findUnique({
            where: { email: input.email },
          });

          if (!user) {
            throw new Error('Invalid email or password');
          }

          // Verify password
          const isValidPassword = await this.verifyPassword(input.password, user.password_hash);
          if (!isValidPassword) {
            throw new Error('Invalid email or password');
          }

          // Create refresh token
          const refreshToken = this.generateSecureToken();
          
          // Create session within the same transaction
          const session = await tx.session.create({
            data: {
              user_id: user.id,
              token: refreshToken,
              device_id: input.device_id,
              expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
            },
          });

          return { user, session };
        }, {
          isolationLevel: process.env.CI ? 'Serializable' : 'ReadCommitted', // Use serializable isolation in CI for better consistency
          timeout: process.env.CI ? 10000 : 5000, // Longer timeout in CI environment
        });
      }, process.env.CI ? 7 : 5, process.env.CI ? 200 : 100); // More retries and longer base delay in CI

      logger.info(`User logged in: ${loginResult.user.email}`, { 
        userId: loginResult.user.id, 
        sessionId: loginResult.session.id,
        deviceId: input.device_id 
      });

      return {
        user: this.formatUserResponse(loginResult.user),
        session: loginResult.session,
      };
    } catch (error) {
      logger.error('Error logging in user:', error);
      throw error;
    }
  }

  // Logout user by invalidating session
  static async logout(sessionToken: string): Promise<void> {
    try {
      const deletedSession = await prisma.session.delete({
        where: { token: sessionToken },
      });
      
      logger.info('User logged out', { sessionId: deletedSession.id });
    } catch (error) {
      // Session might not exist, which is fine for logout
      logger.warn('Session not found during logout:', error);
    }
  }

  // Refresh access token using refresh token
  static async refreshToken(refreshToken: string): Promise<{ userId: string; sessionId: string }> {
    try {
      // Find valid session
      const session = await prisma.session.findUnique({
        where: { 
          token: refreshToken,
        },
        include: {
          user: true,
        },
      });

      if (!session) {
        throw new Error('Invalid refresh token');
      }

      if (session.expires_at < new Date()) {
        // Clean up expired session
        await prisma.session.delete({
          where: { id: session.id },
        });
        throw new Error('Refresh token expired');
      }

      return {
        userId: session.user_id,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error('Error refreshing token:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findUserById(userId: string): Promise<UserResponse | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      return user ? this.formatUserResponse(user) : null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Create session for user (for auto-login after registration)
  static async createSessionForUser(userId: string, deviceId?: string): Promise<{ sessionId: string; refreshToken: string }> {
    try {
      // Create refresh token
      const refreshToken = this.generateSecureToken();
      
      // Create session
      const session = await prisma.session.create({
        data: {
          user_id: userId,
          token: refreshToken,
          device_id: deviceId,
          expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
        },
      });

      return {
        sessionId: session.id,
        refreshToken: session.token,
      };
    } catch (error) {
      logger.error('Error creating session for user:', error);
      throw error;
    }
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // Don't reveal if email exists - return success anyway
        logger.warn(`Password reset requested for non-existent email: ${email}`);
        return;
      }

      // Delete any existing reset tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { user_id: user.id },
      });

      // Create new reset token
      const resetToken = this.generateSecureToken();
      await prisma.passwordResetToken.create({
        data: {
          user_id: user.id,
          token: resetToken,
          expires_at: new Date(Date.now() + PASSWORD_RESET_EXPIRES_IN_MS),
        },
      });

      logger.info(`Password reset requested: ${user.email}`, { userId: user.id });

      // Send password reset email OUTSIDE of transaction
      try {
        const emailService = await this.getEmailService();
        if (emailService) {
          await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
        }
      } catch (error) {
        logger.warn('Failed to send password reset email (non-blocking):', error);
        // Don't fail the request if email fails
      }
    } catch (error) {
      logger.error('Error requesting password reset:', error);
      throw error;
    }
  }

  // Reset password using token
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Find valid reset token
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      if (resetToken.expires_at < new Date()) {
        // Clean up expired token
        await prisma.passwordResetToken.delete({
          where: { id: resetToken.id },
        });
        throw new Error('Reset token expired');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user password and delete reset token
      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.user_id },
          data: { password_hash: hashedPassword },
        }),
        prisma.passwordResetToken.delete({
          where: { id: resetToken.id },
        }),
        // Invalidate all existing sessions for security
        prisma.session.deleteMany({
          where: { user_id: resetToken.user_id },
        }),
      ]);

      logger.info(`Password reset completed: ${resetToken.user.email}`, { 
        userId: resetToken.user_id 
      });
    } catch (error) {
      logger.error('Error resetting password:', error);
      throw error;
    }
  }

  // Verify email using token
  static async verifyEmail(token: string): Promise<UserResponse> {
    try {
      // Find valid verification token
      const verificationToken = await prisma.emailVerificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!verificationToken) {
        throw new Error('Invalid or expired verification token');
      }

      if (verificationToken.expires_at < new Date()) {
        // Clean up expired token
        await prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
        throw new Error('Verification token expired');
      }

      // Update user email verification status and delete token
      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: verificationToken.user_id },
          data: { email_verified: true },
        }),
        prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        }),
      ]);

      logger.info(`Email verified: ${updatedUser.email}`, { 
        userId: updatedUser.id 
      });

      return this.formatUserResponse(updatedUser);
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw error;
    }
  }

  // Change password for authenticated user
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password_hash: hashedPassword },
      });

      logger.info(`Password changed: ${user.email}`, { userId });
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  // Clean up expired tokens (maintenance function)
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      const now = new Date();
      
      await prisma.$transaction([
        prisma.session.deleteMany({
          where: { expires_at: { lt: now } },
        }),
        prisma.passwordResetToken.deleteMany({
          where: { expires_at: { lt: now } },
        }),
        prisma.emailVerificationToken.deleteMany({
          where: { expires_at: { lt: now } },
        }),
      ]);

      logger.info('Expired tokens cleaned up');
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }
}