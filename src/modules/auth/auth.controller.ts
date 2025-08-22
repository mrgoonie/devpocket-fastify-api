import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  verifyEmailSchema,
  refreshTokenSchema,
  changePasswordSchema,
  type RegisterInput,
  type LoginInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
  type RefreshTokenInput,
  type ChangePasswordInput,
} from './auth.schema.js';
import { logger } from '@/shared/logger.js';
import { config } from '@/config/environment.js';

// Utility function to get JWT expiration time in seconds
const getJWTExpirationSeconds = (): number => {
  const expiresIn = config.JWT.EXPIRES_IN;
  if (expiresIn.endsWith('m')) {
    return parseInt(expiresIn.slice(0, -1)) * 60;
  }
  if (expiresIn.endsWith('h')) {
    return parseInt(expiresIn.slice(0, -1)) * 3600;
  }
  if (expiresIn.endsWith('d')) {
    return parseInt(expiresIn.slice(0, -1)) * 86400;
  }
  return 900; // Default 15 minutes
};

export class AuthController {
  // Register new user
  static async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate input
      const input = registerSchema.parse(request.body) as RegisterInput;

      // Register user
      const user = await AuthService.register(input);

      // Auto-login: Create session and generate tokens for Flutter compatibility
      const sessionResult = await AuthService.createSessionForUser(user.id, input.device_id);

      // Generate JWT access token
      const accessToken = request.server.jwt.sign(
        { 
          userId: user.id,
          sessionId: sessionResult.sessionId,
          email: user.email,
        },
        { 
          expiresIn: config.JWT.EXPIRES_IN,
        }
      );

      const expiresInSeconds = getJWTExpirationSeconds();

      reply.status(201).send({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: { 
          user,
          access_token: accessToken,
          refresh_token: sessionResult.refreshToken,
          expires_in: expiresInSeconds,
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Email already registered')) {
          reply.status(409).send({
            success: false,
            message: 'Email already registered',
            code: 'EMAIL_EXISTS',
          });
          return;
        }
        
        if (error.message.includes('Username already taken')) {
          reply.status(409).send({
            success: false,
            message: 'Username already taken',
            code: 'USERNAME_EXISTS',
          });
          return;
        }
      }

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'REGISTRATION_FAILED',
      });
    }
  }

  // Login user
  static async login(request: FastifyRequest, reply: FastifyReply) {
    let input: LoginInput | undefined;
    try {
      // Validate input
      input = loginSchema.parse(request.body) as LoginInput;

      // Authenticate user
      const { user, session } = await AuthService.login(input);

      // Generate JWT access token
      const accessToken = request.server.jwt.sign(
        { 
          userId: user.id,
          sessionId: session.id,
          email: user.email,
        },
        { 
          expiresIn: config.JWT.EXPIRES_IN,
        }
      );

      const expiresInSeconds = getJWTExpirationSeconds();

      reply.send({
        success: true,
        message: 'Login successful',
        data: {
          user,
          access_token: accessToken,
          refresh_token: session.token,
          expires_in: expiresInSeconds,
        },
      });
    } catch (error) {
      logger.error('Login error details:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        input: input ? { email: input.email, hasPassword: !!input.password } : 'undefined',
        requestBody: request.body
      });
      
      if (error instanceof Error && error.message.includes('Invalid email or password')) {
        reply.status(401).send({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'LOGIN_FAILED',
      });
    }
  }

  // Logout user
  static async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { sessionId } = request.authUser as { sessionId: string };
      
      // Find session by ID and get token
      const session = await request.server.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (session) {
        await AuthService.logout(session.token);
      }

      reply.send({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      
      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'LOGOUT_FAILED',
      });
    }
  }

  // Refresh access token
  static async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate input
      const input = refreshTokenSchema.parse(request.body) as RefreshTokenInput;

      // Refresh token
      const { userId, sessionId } = await AuthService.refreshToken(input.refresh_token);

      // Get user details
      const user = await AuthService.findUserById(userId);
      if (!user) {
        reply.status(401).send({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      // Generate new JWT access token
      const accessToken = request.server.jwt.sign(
        { 
          userId,
          sessionId,
          email: user.email,
        },
        { 
          expiresIn: config.JWT.EXPIRES_IN,
        }
      );

      const expiresInSeconds = getJWTExpirationSeconds();

      reply.send({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          access_token: accessToken,
          expires_in: expiresInSeconds,
        },
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      if (error instanceof Error && 
          (error.message.includes('Invalid refresh token') || 
           error.message.includes('Refresh token expired'))) {
        reply.status(401).send({
          success: false,
          message: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        });
        return;
      }

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'TOKEN_REFRESH_FAILED',
      });
    }
  }

  // Get current user profile
  static async getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.authUser as { userId: string };
      
      const user = await AuthService.findUserById(userId);
      if (!user) {
        reply.status(404).send({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      reply.send({
        success: true,
        data: { user },
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      
      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'GET_USER_FAILED',
      });
    }
  }

  // Request password reset
  static async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate input
      const input = forgotPasswordSchema.parse(request.body) as ForgotPasswordInput;

      // Request password reset
      await AuthService.requestPasswordReset(input.email);

      // Always return success to prevent email enumeration
      reply.send({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (error) {
      logger.error('Forgot password error:', error);
      
      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'FORGOT_PASSWORD_FAILED',
      });
    }
  }

  // Reset password using token
  static async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate input
      const input = resetPasswordSchema.parse(request.body) as ResetPasswordInput;

      // Reset password
      await AuthService.resetPassword(input.token, input.password);

      reply.send({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      
      if (error instanceof Error && 
          (error.message.includes('Invalid or expired reset token') || 
           error.message.includes('Reset token expired'))) {
        reply.status(400).send({
          success: false,
          message: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN',
        });
        return;
      }

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'RESET_PASSWORD_FAILED',
      });
    }
  }

  // Verify email using token
  static async verifyEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Get token from query parameters
      const input = verifyEmailSchema.parse(request.query) as VerifyEmailInput;

      // Verify email
      const user = await AuthService.verifyEmail(input.token);

      reply.send({
        success: true,
        message: 'Email verified successfully',
        data: { user },
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      
      if (error instanceof Error && 
          (error.message.includes('Invalid or expired verification token') || 
           error.message.includes('Verification token expired'))) {
        reply.status(400).send({
          success: false,
          message: 'Invalid or expired verification token',
          code: 'INVALID_VERIFICATION_TOKEN',
        });
        return;
      }

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'EMAIL_VERIFICATION_FAILED',
      });
    }
  }

  // Change password for authenticated user
  static async changePassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Validate input
      const input = changePasswordSchema.parse(request.body) as ChangePasswordInput;
      const { userId } = request.authUser as { userId: string };

      // Change password
      await AuthService.changePassword(userId, input.current_password, input.new_password);

      reply.send({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      logger.error('Change password error:', error);
      
      if (error instanceof Error && error.message.includes('Current password is incorrect')) {
        reply.status(400).send({
          success: false,
          message: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD',
        });
        return;
      }

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
        code: 'CHANGE_PASSWORD_FAILED',
      });
    }
  }
}