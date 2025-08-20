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
3. Run linting before commits
4. Run full test suite before push
5. Use conventional commit messages
6. Document API changes in changelog