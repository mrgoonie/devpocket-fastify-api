# DevPocket Code Structure and Standards

## Tech Stack

### Core Technologies
- **Runtime**: Node.js 20+ (ESM modules)
- **Framework**: Fastify 4.x - High-performance web framework
- **Language**: TypeScript 5.x with strict type checking
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ for job queues
- **Package Manager**: pnpm for efficient dependency management

### Key Dependencies
- **Authentication**: @fastify/jwt for JWT token management
- **Validation**: Zod for schema validation and type inference
- **API Documentation**: @fastify/swagger and @fastify/swagger-ui
- **WebSocket**: @fastify/websocket for real-time terminal communication
- **SSH**: ssh2 for SSH connections, node-pty for PTY sessions
- **Security**: @fastify/helmet, @fastify/cors, @fastify/rate-limit
- **Encryption**: crypto-js and bcrypt for password and SSH key encryption
- **Email**: Resend for transactional emails
- **Logging**: Pino with pino-pretty for structured logging

### Testing Stack
- **Test Runner**: Vitest with global test mode
- **Mocking**: Vitest built-in mocking capabilities
- **Test Data**: @faker-js/faker for generating test data
- **API Testing**: Supertest for HTTP endpoint testing
- **Coverage**: @vitest/coverage-v8 for code coverage reports

## Development Environment

### Environment Setup
- **Docker Support**: Docker Compose for containerized development
- **Environment Files**: 
  - `.env` for development
  - `.env.test` for testing
  - `.env.prod` for production
- **Hot Reload**: tsx watch mode for development

### Docker Configuration
```yaml
services:
  app:
    - Node.js 20 Alpine base image
    - Auto-restart with volume mounts
    - Port 3000 exposed
  postgres:
    - PostgreSQL 15 Alpine (optional, commented out)
    - Persistent volume for data
    - Health checks configured
  redis:
    - Redis 7 Alpine (optional, commented out)
    - Persistent volume with AOF enabled
    - Health checks configured
```

### Development Scripts
```json
{
  "dev": "tsx watch src/app.ts",
  "build": "tsc",
  "test": "vitest run",
  "lint": "eslint src --ext .ts",
  "db:migrate": "prisma migrate dev",
  "docker:up": "docker-compose up -d"
}
```

## Code Structure

### Project Architecture
```
src/
├── app.ts                 # Application entry point
├── config/               # Configuration modules
│   ├── environment.ts    # Environment variables
│   ├── plugins.ts        # Fastify plugin registration
│   └── routes.ts         # Route registration
├── modules/              # Feature modules
│   ├── auth/            # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.schema.ts
│   │   ├── auth.middleware.ts
│   │   └── auth.test.ts
│   ├── terminal/        # Terminal/SSH module
│   │   ├── terminal.controller.ts
│   │   ├── terminal.service.ts
│   │   ├── ssh.service.ts
│   │   ├── pty.service.ts
│   │   └── websocket.handler.ts
│   └── payment/         # Payment module
├── shared/              # Shared utilities
│   ├── database/        # Database client and plugins
│   ├── encryption/      # Encryption services
│   ├── email/          # Email service
│   ├── health/         # Health check endpoints
│   ├── logger.ts       # Logger configuration
│   ├── queue/          # BullMQ queue setup
│   └── redis/          # Redis connection
├── tests/              # Test utilities
│   ├── setup.ts        # Test environment setup
│   ├── helper.ts       # Test helpers
│   └── db.ts          # Test database utilities
└── types/              # TypeScript declarations
    └── fastify.d.ts    # Fastify type extensions
```

### Module Pattern
Each feature module follows a consistent structure:
- **Controller**: HTTP request handling and response formatting
- **Service**: Business logic and data operations
- **Routes**: Route definitions and middleware application
- **Schema**: Zod schemas for validation and type inference
- **Middleware**: Request authentication and validation
- **Tests**: Unit and integration tests

### TypeScript Configuration
- **Strict Mode**: Full strict type checking enabled
- **Path Aliases**: `@/` mapped to `src/` directory
- **Module Resolution**: ESNext modules with Node resolution
- **Target**: ES2022 for modern JavaScript features

## Error Handling

### Structured Error Pattern
```typescript
try {
  // Business logic
  const result = await service.operation(data);
  reply.send({ success: true, data: result });
} catch (error) {
  logger.error('Operation failed:', error);
  
  // Specific error handling
  if (error instanceof Error && error.message.includes('specific')) {
    reply.status(400).send({
      success: false,
      message: 'User-friendly message',
      code: 'ERROR_CODE'
    });
    return;
  }
  
  // Generic error fallback
  reply.status(500).send({
    success: false,
    message: 'Internal server error',
    code: 'OPERATION_FAILED'
  });
}
```

## Database Transaction Management

### Transaction Isolation Levels
The codebase implements different isolation levels based on operation criticality:

```typescript
// Serializable for critical operations (Registration)
await prisma.$transaction(async (tx) => {
  // Critical operations requiring full isolation
}, {
  isolationLevel: 'Serializable',
  timeout: 10000, // 10 seconds
});

// ReadCommitted for standard operations (Login)
await prisma.$transaction(async (tx) => {
  // Standard operations with good performance
}, {
  isolationLevel: 'ReadCommitted', 
  timeout: 5000, // 5 seconds
});
```

### Retry Mechanism Pattern
Database operations include retry logic for handling transaction conflicts:

```typescript
// Retry mechanism for database conflicts
private static async retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // Handle Prisma P2034 (Transaction conflict) errors
      if (error?.code === 'P2034' && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`Database transaction conflict (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### Email Service Decoupling Pattern
Email operations are decoupled from database transactions to prevent blocking:

```typescript
// Database transaction (atomic)
const result = await this.retryOperation(async () => {
  return await prisma.$transaction(async (tx) => {
    // Database operations only
    return { user: newUser, verificationToken };
  });
});

// Email operations (non-blocking, outside transaction)
try {
  const emailService = await this.getEmailService();
  if (emailService) {
    await emailService.sendWelcomeEmail(user.email, user.username, token);
  }
} catch (error) {
  logger.warn('Failed to send email (non-blocking):', error);
  // Email failure should not affect core operation
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  details?: unknown;
}
```

### Error Categories
- **400 Bad Request**: Validation errors, invalid input
- **401 Unauthorized**: Authentication failures
- **403 Forbidden**: Authorization failures
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflicts (duplicates)
- **500 Internal Error**: Unexpected server errors
- **503 Service Unavailable**: Health check failures

## Testing Patterns

### Test Organization
- **Unit Tests**: Co-located with modules (`*.test.ts`)
- **Integration Tests**: In `src/tests/` directory
- **Test Setup**: Global setup in `src/tests/setup.ts`
- **Test Helpers**: Shared utilities in `src/tests/helper.ts`

### Test Structure
```typescript
describe('Module Name', () => {
  let app: FastifyInstance;
  
  beforeAll(async () => {
    app = await createTestApp();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('Feature/Endpoint', () => {
    it('should handle success case', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/endpoint',
        payload: validData
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject(expected);
    });
    
    it('should handle error case', async () => {
      // Error scenario testing
    });
  });
});
```

### Test Configuration
- **Isolation**: Tests run sequentially with database reset
- **Mocking**: Email service mocked to prevent actual sends
- **Database**: Transactional tests with automatic cleanup
- **Timeouts**: 30s test timeout, 60s hook timeout

### CI/CD Test Reliability Patterns
Enhanced test patterns for reliable CI/CD execution:

```typescript
// Environment-aware retry configuration
const maxRetries = process.env.CI ? 3 : 1;
const retryDelay = process.env.CI ? 1500 : 100;

// Database state verification pattern
for (let waitAttempt = 1; waitAttempt <= maxWaitAttempts; waitAttempt++) {
  const registeredUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (registeredUser) {
    break; // User found, proceed
  } else {
    const waitTime = 100 * waitAttempt;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

// Database connection verification in test setup
async function verifyDatabaseConnection(): Promise<void> {
  const maxRetries = process.env.CI ? 5 : 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1 as connected`;
      await prisma.$queryRaw`SELECT current_database()`;
      return; // Success
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }
}
```

## API Field Naming Conventions

### API Response Format
```javascript
{
  "success": boolean,
  "data": object | array | null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {} // Optional, development only
  },
  "meta": {
    "page": number,
    "limit": number,
    "total": number
  } // For paginated responses
}
```

### Snake Case Standard
All API request and response fields MUST use `snake_case` naming convention for consistency and developer experience:

```typescript
// ✅ Correct - snake_case
{
  "user_id": "uuid-string",
  "created_at": "2024-01-15T10:30:00Z",
  "profile_image": "url-string",
  "ssh_profiles": [...],
  "is_verified": true,
  "subscription_status": "active"
}

// ❌ Incorrect - camelCase, PascalCase, or mixed
{
  "userId": "uuid-string",          // camelCase
  "CreatedAt": "2024-01-15T10:30:00Z", // PascalCase
  "profile_image": "url-string",    // mixed with camelCase
  "sshProfiles": [...],             // camelCase
  "IsVerified": true,               // PascalCase
  "subscriptionstatus": "active"    // no separator
}
```

### Implementation Guidelines

#### Database Fields
Database field names should use `snake_case` to match API responses:
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  email_verified BOOLEAN
);
```

#### Zod Schema Validation
Define schemas with snake_case field names:
```typescript
export const userSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
  is_verified: z.boolean(),
  profile_settings: z.object({
    display_name: z.string().optional(),
    theme_preference: z.enum(['light', 'dark', 'auto'])
  })
});
```

#### TypeScript Type Definitions
All API-related interfaces should use snake_case:
```typescript
interface User {
  user_id: string;
  email: string;
  username: string;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
  profile_settings?: {
    display_name?: string;
    theme_preference: 'light' | 'dark' | 'auto';
  };
}
```

### Validation Patterns
Field naming validation should be enforced at multiple levels:

1. **Schema Level**: Zod schemas validate field names
2. **Database Level**: Column names follow snake_case
3. **API Level**: Request/response serialization maintains consistency
4. **Documentation Level**: All examples use snake_case
5. **Code Review Level**: Reviewers check for naming consistency

## Input/Output Validation

### Request Validation with Zod
```typescript
// Schema Definition
export const createSchema = z.object({
  email: z.string().email().toLowerCase(),
  username: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
});

// Type Inference
export type CreateInput = z.infer<typeof createSchema>;

// Controller Usage
const input = createSchema.parse(request.body);
```

### Validation Patterns
- **Email**: Lowercase transformation, format validation
- **Passwords**: Complexity requirements (uppercase, lowercase, numbers)
- **UUIDs**: Format validation for resource IDs
- **Enums**: Native enum validation with Prisma types
- **Optional Fields**: Explicit optional marking with defaults
- **Number Ranges**: Min/max validation for ports, limits

### Response Standardization
```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// Paginated Response
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
```

### JSON Schema Generation
- Zod schemas converted to JSON Schema for Fastify validation
- Automatic OpenAPI/Swagger documentation generation
- Type-safe request/response contracts

## Best Practices

### Code Quality
- ESLint configuration with TypeScript support
- Unused variable warnings (prefix with `_` to ignore)
- Prefer `const` over `let`, never use `var`
- Object shorthand and arrow functions preferred
- Console logging warnings (use logger instead)

### Security
- JWT tokens with configurable expiration
- Password hashing with bcrypt (10 rounds)
- SSH key encryption with AES-256
- Rate limiting on sensitive endpoints
- CORS and Helmet security headers
- Environment variable validation

### Performance
- Connection pooling for database
- Redis caching for sessions
- Lazy loading of heavy modules
- Efficient error handling without stack traces in production
- Structured logging with Pino for performance

### Development Workflow
1. Write tests first (TDD approach encouraged)
2. Implement feature with proper error handling
3. Use retry mechanisms for database operations prone to conflicts
4. Decouple email services from critical database transactions
5. **Enforce API field naming consistency**: All request/response fields must use snake_case
6. Run linting before commits
7. Run full test suite before push
8. Use conventional commit messages
9. Document API changes in changelog

#### API Field Naming Standards in Development
All API implementations must follow these naming conventions throughout development:

**Pre-Development Checklist:**
- Verify all API designs use snake_case field names
- Ensure database schema matches API field naming
- Plan TypeScript types with consistent snake_case

**During Implementation:**
- Write Zod schemas with snake_case field validation
- Use snake_case in all request/response interfaces  
- Maintain consistency across controller, service, and database layers

**Pre-Commit Validation:**
- Code review checks for snake_case compliance
- Verify no mixed camelCase/snake_case patterns
- Ensure database queries return properly named fields

### Database Best Practices
- Use appropriate transaction isolation levels based on operation criticality
- Implement retry logic with exponential backoff for P2034 conflicts  
- Keep transactions short and focused on database operations only
- Move email/notification services outside of database transactions
- Use database state verification in tests instead of fixed delays
- Pre-initialize services to avoid dynamic imports during transactions