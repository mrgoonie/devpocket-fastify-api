import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@/shared/logger.js';

// Type declaration for authenticated request
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: {
      userId: string;
      sessionId: string;
      email: string;
    };
  }
}

// Exported type for authenticated requests
export interface AuthenticatedRequest extends FastifyRequest {
  authUser: {
    userId: string;
    sessionId: string;
    email: string;
  };
  user: {
    id: string;
    email: string;
    sessionId: string;
  };
}

// Authentication middleware
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Check for Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        success: false,
        message: 'Missing or invalid authorization header',
        code: 'MISSING_AUTH_HEADER',
      });
      return;
    }

    // Extract token
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = request.server.jwt.verify(token) as {
      userId: string;
      sessionId: string;
      email: string;
    };

    // Validate session exists and is not expired
    const session = await request.server.prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session) {
      reply.status(401).send({
        success: false,
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
      return;
    }

    if (session.expires_at < new Date()) {
      // Clean up expired session
      await request.server.prisma.session.delete({
        where: { id: session.id },
      });
      
      reply.status(401).send({
        success: false,
        message: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
      return;
    }

    // Attach user info to request
    request.authUser = {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      email: decoded.email,
    };

    // Also set user property for compatibility
    (request as AuthenticatedRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      sessionId: decoded.sessionId,
    };

  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        reply.status(401).send({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }
      
      if (error.message.includes('invalid token') || 
          error.message.includes('jwt malformed')) {
        reply.status(401).send({
          success: false,
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
        return;
      }
    }

    reply.status(401).send({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED',
    });
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuthenticate(request: FastifyRequest) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No authentication provided, continue without user
      return;
    }

    const token = authHeader.slice(7);
    const decoded = request.server.jwt.verify(token) as {
      userId: string;
      sessionId: string;
      email: string;
    };

    // Check session validity
    const session = await request.server.prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (session && session.expires_at >= new Date()) {
      request.authUser = {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        email: decoded.email,
      };

      // Also set user property for compatibility
      (request as AuthenticatedRequest).user = {
        id: decoded.userId,
        email: decoded.email,
        sessionId: decoded.sessionId,
      };
    }
  } catch (error) {
    // Optional auth fails silently
    logger.debug('Optional authentication failed:', error);
  }
}

// Email verification required middleware
export async function requireEmailVerification(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    reply.status(401).send({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    // Check if user's email is verified
    const user = await request.server.prisma.user.findUnique({
      where: { id: request.authUser.userId },
      select: { email_verified: true },
    });

    if (!user) {
      reply.status(404).send({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    if (!user.email_verified) {
      reply.status(403).send({
        success: false,
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }
  } catch (error) {
    logger.error('Email verification check error:', error);
    reply.status(500).send({
      success: false,
      message: 'Internal server error',
      code: 'VERIFICATION_CHECK_FAILED',
    });
  }
}

// Admin role middleware (for future use)
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    reply.status(401).send({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    // Check if user has admin role (this would require adding role field to user schema)
    // For now, we'll implement a simple admin check based on email or user ID
    // This should be replaced with proper role-based access control
    
    const user = await request.server.prisma.user.findUnique({
      where: { id: request.authUser.userId },
      select: { email: true },
    });

    // Temporary admin check - replace with proper RBAC
    const isAdmin = user?.email.includes('admin') || false;

    if (!isAdmin) {
      reply.status(403).send({
        success: false,
        message: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      });
      return;
    }
  } catch (error) {
    logger.error('Admin check error:', error);
    reply.status(500).send({
      success: false,
      message: 'Internal server error',
      code: 'ADMIN_CHECK_FAILED',
    });
  }
}