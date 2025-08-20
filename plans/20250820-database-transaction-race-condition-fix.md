# Database Transaction Race Condition Fix Implementation Plan

**Date**: 2025-08-20  
**Author**: Implementation Specialist  
**Issue**: GitHub Actions test failures due to database transaction race conditions in user registration and login flow

## Overview

The current implementation has race condition issues where email service imports and operations within database transactions are causing timing issues that prevent successful user login immediately after registration. This manifests as GitHub Actions test failures where users are successfully registered but cannot immediately log in due to database inconsistencies or timing issues.

## Root Cause Analysis

### Current Issues Identified

1. **Email Service Import Inside Transaction**: In `auth.service.ts` line 121, the email service is imported using dynamic import inside the database transaction, which can cause timing issues.

2. **Long-Running Transactions**: The registration transaction includes email sending within the transaction boundary, making it long-running and prone to timeout/race conditions.

3. **Immediate Login After Registration**: Tests attempt to login immediately after registration without proper synchronization, causing race conditions.

4. **No Transaction Isolation Control**: Current implementation doesn't use specific isolation levels for critical operations.

5. **Lack of Retry Mechanisms**: No retry logic for handling temporary transaction conflicts (P2034 errors).

## Architecture Changes

### Current Flow (Problematic)
```
Registration Request → Database Transaction Start → 
Create User → Create Subscription → Create Usage Limits → Create Email Token → 
[INSIDE TRANSACTION] Import Email Service → Send Email → 
Transaction Commit → Return Success
```

### Proposed Flow (Fixed)
```
Registration Request → Database Transaction Start → 
Create User → Create Subscription → Create Usage Limits → Create Email Token → 
Transaction Commit → 
[OUTSIDE TRANSACTION] Queue Email Async → Return Success
```

## Implementation Plan

### Phase 1: Database Transaction Improvements

#### Task 1: Refactor User Registration Service
- **File**: `src/modules/auth/auth.service.ts`
- **Changes**:
  - Move email operations outside the database transaction
  - Use proper transaction isolation levels
  - Add retry mechanisms for P2034 errors
  - Implement optimistic concurrency control

#### Task 2: Enhance Login Session Creation
- **File**: `src/modules/auth/auth.service.ts`
- **Changes**:
  - Add proper transaction isolation for session creation
  - Implement retry logic for concurrent login attempts
  - Add user existence verification with proper timing

#### Task 3: Improve Email Service Integration
- **File**: `src/modules/auth/auth.service.ts`
- **Changes**:
  - Pre-import email service at module level
  - Make email operations truly asynchronous and non-blocking
  - Add proper error handling for email failures

### Phase 2: Queue and Reliability Improvements

#### Task 4: Enhance Email Queue Reliability
- **File**: `src/shared/email/email.service.ts`
- **Changes**:
  - Add circuit breaker pattern for email failures
  - Implement exponential backoff for retries
  - Add dead letter queue for failed emails

#### Task 5: Add Transaction Monitoring
- **Files**: `src/modules/auth/auth.service.ts`, `src/shared/logger.js`
- **Changes**:
  - Add transaction performance monitoring
  - Log transaction duration and retry attempts
  - Add metrics for race condition detection

### Phase 3: Test Infrastructure Improvements

#### Task 6: Fix Test Helper Race Conditions
- **File**: `src/tests/helper.ts`
- **Changes**:
  - Implement proper wait strategies instead of fixed delays
  - Add database state verification before login attempts
  - Use event-driven synchronization

#### Task 7: Add Transaction Testing Utils
- **New File**: `src/tests/transaction-utils.ts`
- **Changes**:
  - Add utilities for testing concurrent operations
  - Implement transaction conflict simulation
  - Add race condition detection helpers

## Detailed Implementation

### 1. AuthService Registration Refactor

```typescript
// BEFORE (Problematic)
static async register(input: RegisterInput): Promise<UserResponse> {
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({ /* ... */ });
    // ... other operations
    
    // PROBLEM: Email service import inside transaction
    try {
      const { EmailService } = await import('@/shared/email/email.service.js');
      await EmailService.sendWelcomeEmail(/* ... */);
    } catch (error) {
      logger.warn('Failed to send welcome email:', error);
    }
    
    return newUser;
  });
  return this.formatUserResponse(user);
}

// AFTER (Fixed)
static async register(input: RegisterInput): Promise<UserResponse> {
  // Pre-import email service at module level
  const { EmailService } = await import('@/shared/email/email.service.js');
  
  const MAX_RETRIES = 3;
  let retries = 0;
  let user: User;
  let verificationToken: string;

  while (retries < MAX_RETRIES) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Check for existing user with proper isolation
        const existingUser = await tx.user.findFirst({
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

        const hashedPassword = await this.hashPassword(input.password);
        
        // Create user and related records atomically
        const newUser = await tx.user.create({
          data: {
            email: input.email,
            username: input.username,
            password_hash: hashedPassword,
            email_verified: false,
          },
        });

        await tx.subscription.create({
          data: {
            user_id: newUser.id,
            plan_type: 'FREE',
            status: 'ACTIVE',
            started_at: new Date(),
            expires_at: null,
          },
        });

        await tx.usageLimits.create({
          data: {
            user_id: newUser.id,
            plan_type: 'FREE',
            reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        const token = this.generateSecureToken();
        await tx.emailVerificationToken.create({
          data: {
            user_id: newUser.id,
            token: token,
            expires_at: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_IN_MS),
          },
        });

        return { user: newUser, verificationToken: token };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      });

      user = result.user;
      verificationToken = result.verificationToken;
      break;
      
    } catch (error) {
      if (error.code === 'P2034' && retries < MAX_RETRIES - 1) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
        continue;
      }
      throw error;
    }
  }

  // Send email OUTSIDE transaction - non-blocking
  try {
    await EmailService.sendWelcomeEmail(user.email, user.username, verificationToken);
  } catch (error) {
    logger.warn('Failed to queue welcome email:', error);
    // Don't fail registration if email fails
  }

  logger.info(`User registered: ${user.email}`, { userId: user.id });
  return this.formatUserResponse(user);
}
```

### 2. Login Race Condition Fix

```typescript
// Enhanced login with proper transaction handling
static async login(input: LoginInput): Promise<{ user: UserResponse; session: { id: string; token: string } }> {
  const MAX_RETRIES = 3;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      // Find user first (outside transaction)
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      const isValidPassword = await this.verifyPassword(input.password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Create session with proper transaction isolation
      const refreshToken = this.generateSecureToken();
      const session = await prisma.$transaction(async (tx) => {
        // Double-check user still exists
        const existingUser = await tx.user.findUnique({
          where: { id: user.id }
        });
        
        if (!existingUser) {
          throw new Error('User not found during session creation');
        }
        
        return await tx.session.create({
          data: {
            user_id: user.id,
            token: refreshToken,
            device_id: input.device_id,
            expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_MS),
          },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      });

      logger.info(`User logged in: ${user.email}`, { 
        userId: user.id, 
        sessionId: session.id,
        deviceId: input.device_id 
      });

      return {
        user: this.formatUserResponse(user),
        session,
      };
      
    } catch (error) {
      if (error.code === 'P2034' && retries < MAX_RETRIES - 1) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 50));
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Email Service Pre-Import

```typescript
// At the top of auth.service.ts, pre-import email service
import { EmailService } from '@/shared/email/email.service.js';

// Remove dynamic imports from within transactions
```

### 4. Enhanced Email Service with Circuit Breaker

```typescript
// src/shared/email/email.service.ts enhancements
class EmailServiceCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 30000; // 30 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isCircuitOpen(): boolean {
    return this.failureCount >= this.FAILURE_THRESHOLD && 
           (Date.now() - this.lastFailureTime) < this.RECOVERY_TIMEOUT;
  }

  private onSuccess(): void {
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
}

const emailCircuitBreaker = new EmailServiceCircuitBreaker();

export class EmailService {
  static async sendWelcomeEmail(email: string, username: string, verificationToken: string): Promise<void> {
    await emailCircuitBreaker.execute(async () => {
      const verificationLink = `${config.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      
      await this.queueEmail({
        type: 'welcome',
        to: email,
        subject: templates.welcome.subject,
        html: templates.welcome.getHtml(username, verificationLink),
        text: templates.welcome.getText(username, verificationLink),
      });
    });

    logger.info(`Welcome email queued for ${email}`);
  }
}
```

### 5. Test Helper Improvements

```typescript
// Enhanced test helper with proper synchronization
export const createTestUserAndLogin = async (
  app: FastifyInstance,
  role: 'USER' | 'ADMIN' = 'USER',
): Promise<{ user: UserResponse; token: string; refreshToken: string; password: string }> => {
  const uniqueId = faker.string.uuid();
  const username = `testuser_${uniqueId.replace(/-/g, '_')}`.slice(0, 20);
  const email = `test-${uniqueId}@example.com`;
  const password = 'Password123!';

  // Register user
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, email, password, role },
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(`Registration failed: ${registerResponse.statusCode} - ${registerResponse.body}`);
  }

  // Wait for database consistency with exponential backoff
  const waitForUserConsistency = async (maxAttempts = 5): Promise<void> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Verify user exists and is properly created
        const user = await prisma.user.findUnique({
          where: { email },
          include: { subscriptions: true, usage_limits: true }
        });

        if (user && user.subscriptions.length > 0 && user.usage_limits.length > 0) {
          return; // User is fully set up
        }
      } catch (error) {
        // Database might not be ready
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
    throw new Error('User consistency check failed after all attempts');
  };

  await waitForUserConsistency();

  // Login user with retry logic
  const loginWithRetry = async (maxAttempts = 3) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const loginResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email, password },
        });

        if (loginResponse.statusCode === 200) {
          return loginResponse;
        }

        if (attempt === maxAttempts) {
          throw new Error(`Login failed after ${maxAttempts} attempts: ${loginResponse.statusCode} - ${loginResponse.body}`);
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
      }

      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 50));
    }
  };

  const loginResponse = await loginWithRetry();
  const responseBody = JSON.parse(loginResponse.body);
  const { user, access_token: token, refresh_token: refreshToken } = responseBody.data;

  return { user, token, refreshToken, password };
};
```

## Testing Strategy

### Unit Tests
- Test transaction retry mechanisms
- Test email service circuit breaker
- Test concurrent registration attempts
- Test login immediately after registration

### Integration Tests
- Test full registration → login flow
- Test concurrent user creation
- Test email service failures during registration
- Test database transaction conflicts

### Load Tests
- Simulate concurrent registration attempts
- Test email queue under load
- Verify transaction performance under stress

## Monitoring and Observability

### Metrics to Track
- Transaction duration and retry counts
- Email queue processing times
- Race condition occurrence frequency
- Database connection pool utilization

### Logging Enhancements
- Transaction start/end with timing
- Retry attempt details
- Email service failures
- Circuit breaker state changes

## Implementation Order

1. **Phase 1**: Database transaction improvements (Tasks 1-3)
2. **Phase 2**: Email service and queue enhancements (Tasks 4-5)
3. **Phase 3**: Test infrastructure fixes (Tasks 6-7)

## Rollback Plan

If issues arise during implementation:
1. Revert email service changes first
2. Revert transaction isolation changes
3. Revert to original registration flow
4. Keep enhanced logging for debugging

## Success Criteria

- [ ] GitHub Actions tests pass consistently (>95% success rate)
- [ ] User registration → login flow works without delays
- [ ] Email service failures don't break registration
- [ ] Transaction conflicts are handled gracefully
- [ ] Performance remains acceptable (<500ms for registration)

## Risks and Mitigation

### Risk: Performance degradation from serializable isolation
**Mitigation**: Use read-committed for non-critical operations, monitor performance

### Risk: Email service downtime affecting user experience
**Mitigation**: Circuit breaker pattern, graceful degradation

### Risk: Increased complexity making debugging harder
**Mitigation**: Enhanced logging, comprehensive test coverage

## Conclusion

This implementation plan addresses the root causes of database transaction race conditions by:
1. Properly separating transactional and non-transactional operations
2. Implementing appropriate isolation levels and retry mechanisms
3. Adding circuit breaker patterns for external services
4. Improving test reliability with proper synchronization

The changes will improve system reliability while maintaining performance and user experience.