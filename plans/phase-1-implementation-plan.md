# DevPocket Phase 1 Implementation Plan
## Backend Server MVP Core (Weeks 1-3)

### Overview
This document provides a detailed, step-by-step implementation plan for Phase 1 of the DevPocket backend server. The plan follows the project's architecture decisions and focuses on creating a solid foundation with four core modules: Project Setup, Authentication, SSH Terminal, and Payment integration.

**Target Timeline**: 3 weeks  
**Key Technologies**: Node.js 20+, TypeScript, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Docker  
**Architecture Pattern**: Modular structure with shared utilities  

---

## Week 1: Project Foundation & Authentication

### Day 1-2: Project Setup & Environment Configuration

#### 1.1 Initialize Node.js Project Structure
```markdown
# Core project initialization
- [ ] Run `npm init -y` to create package.json
- [ ] Setup PNPM workspace configuration
- [ ] Create initial directory structure following docs
- [ ] Configure TypeScript with strict mode
- [ ] Setup ESLint configuration (no Prettier per requirements)
```

**Directory Structure to Create:**
```
src/
├── modules/           # Feature modules
│   ├── auth/
│   ├── terminal/
│   ├── payment/
│   └── shared/
├── shared/           # Shared utilities
│   ├── database/
│   ├── queue/
│   ├── cache/
│   └── email/
├── config/          # Configurations
├── types/           # TypeScript types
└── tests/           # Integration tests
```

**Technical Decisions:**
- Use `"type": "module"` in package.json for ES modules
- Configure `tsconfig.json` with strict mode and path mapping
- Use kebab-case for file names, PascalCase for classes, camelCase for functions

#### 1.2 Docker & Database Setup
```markdown
# Infrastructure setup
- [ ] Create docker-compose.yml with PostgreSQL and Redis
- [ ] Configure environment variables (.env.example)
- [ ] Setup Prisma ORM with PostgreSQL connection
- [ ] Create initial database schema
- [ ] Test database connectivity
```

**Docker Services:**
- PostgreSQL 15 (devpocket-fastify-api-dev database)
- Redis 7 (for caching and BullMQ)
- App container with hot-reload development

#### 1.3 Fastify Framework Setup
```markdown
# Fastify application setup
- [ ] Install Fastify and core plugins
- [ ] Configure Fastify instance with plugins
- [ ] Setup Swagger/OpenAPI documentation
- [ ] Configure CORS and security headers
- [ ] Setup request logging and error handling
```

**Core Fastify Plugins:**
- `@fastify/swagger` and `@fastify/swagger-ui`
- `@fastify/cors`
- `@fastify/helmet` for security headers
- `@fastify/rate-limit`
- `@fastify/jwt` for authentication

#### 1.4 Development Tooling
```markdown
# Development environment
- [ ] Configure BullMQ with Redis
- [ ] Setup testing framework (Vitest)
- [ ] Configure GitHub Actions workflow
- [ ] Create .env.example and .env.test.example
- [ ] Setup semantic release configuration
```

### Day 3-5: Authentication Module Implementation

#### 1.5 Database Schema for Authentication
```markdown
# Prisma schema for auth module
- [ ] Create users table (id, email, username, password_hash, created_at, updated_at)
- [ ] Create sessions table (id, user_id, token, expires_at, device_id)
- [ ] Create password_reset_tokens table (id, user_id, token, expires_at)
- [ ] Create email_verification_tokens table
- [ ] Run initial database migration
```

**Key Schema Decisions:**
- Use UUIDs for primary keys
- Add device_id for multi-device support
- Include email verification workflow
- Store JWT refresh tokens in sessions table

#### 1.6 Authentication Service Implementation
```typescript
// Module: src/modules/auth/
- [ ] auth.schema.ts - Zod validation schemas
- [ ] auth.service.ts - Business logic (password hashing, JWT)
- [ ] auth.controller.ts - Request handlers
- [ ] auth.route.ts - Fastify route definitions
- [ ] Integration with Prisma ORM
```

**Core Features:**
- Password hashing with bcrypt (cost factor 12)
- JWT with refresh token mechanism
- Rate limiting on auth endpoints (5 attempts per minute)
- Input validation with Zod schemas
- Comprehensive error handling

#### 1.7 Authentication Endpoints
```markdown
# REST API endpoints to implement
- [ ] POST /api/v1/auth/register - User registration with validation
- [ ] POST /api/v1/auth/login - Login with JWT generation
- [ ] POST /api/v1/auth/logout - Token invalidation
- [ ] POST /api/v1/auth/refresh - JWT refresh mechanism
- [ ] POST /api/v1/auth/forgot-password - Password reset initiation
- [ ] POST /api/v1/auth/reset-password - Password reset completion
- [ ] GET /api/v1/auth/verify-email - Email verification
- [ ] GET /api/v1/auth/me - Get current user profile
```

#### 1.8 Email Service Integration
```markdown
# Email functionality with Resend
- [ ] Configure Resend API integration
- [ ] Create email templates (welcome, password reset, verification)
- [ ] Implement email service with queue processing
- [ ] Setup BullMQ job processing for emails
- [ ] Create email template validation
```

---

## Week 2: SSH Terminal Module & Core Infrastructure

### Day 6-8: SSH Terminal Foundation

#### 2.1 SSH Database Schema
```markdown
# SSH and terminal related tables
- [ ] ssh_profiles table (id, user_id, name, host, port, username, auth_type)
- [ ] ssh_keys table (id, profile_id, private_key_encrypted, public_key)
- [ ] terminal_sessions table (id, user_id, profile_id, session_id, status, created_at)
- [ ] command_history table (id, session_id, command, output, status, created_at)
```

**Security Considerations:**
- Encrypt SSH private keys at rest using AES-256
- Store encryption keys in environment variables
- Implement key rotation mechanism
- Audit all SSH connection attempts

#### 2.2 SSH Client Implementation
```typescript
// SSH functionality with node-ssh2
- [ ] SSH connection manager with connection pooling
- [ ] Support for key-based and password authentication
- [ ] PTY (pseudo-terminal) session management
- [ ] SSH tunnel management for secure connections
- [ ] Connection timeout and retry logic
```

**Technical Implementation:**
- Use `ssh2` library for SSH connections
- Implement connection pooling (max 10 concurrent connections per user)
- Support for SSH key passphrase encryption
- Graceful connection cleanup on user disconnect

#### 2.3 WebSocket Terminal Handler
```typescript
// Real-time terminal communication
- [ ] WebSocket endpoint /ws/terminal with authentication
- [ ] PTY session creation and management
- [ ] Real-time command input/output streaming
- [ ] Terminal resize handling
- [ ] Process management (start/stop/kill)
```

**WebSocket Message Types:**
- `create_pty` - Create new PTY session
- `pty_input` - Send input to PTY
- `pty_output` - Receive output from PTY
- `resize_pty` - Handle terminal resize
- `connect_ssh` - Establish SSH connection
- `disconnect` - Clean session cleanup

### Day 9-10: Terminal Endpoints & Integration

#### 2.4 SSH Profile Management
```markdown
# SSH profile CRUD operations
- [ ] POST /api/v1/ssh/profiles - Create SSH profile
- [ ] GET /api/v1/ssh/profiles - List user's SSH profiles
- [ ] GET /api/v1/ssh/profiles/:id - Get specific profile
- [ ] PUT /api/v1/ssh/profiles/:id - Update profile
- [ ] DELETE /api/v1/ssh/profiles/:id - Delete profile
- [ ] POST /api/v1/ssh/test-connection - Test SSH connection
```

#### 2.5 Terminal Session Management
```markdown
# Terminal session endpoints
- [ ] POST /api/v1/terminal/sessions - Create new terminal session
- [ ] GET /api/v1/terminal/sessions - List user sessions
- [ ] GET /api/v1/terminal/sessions/:id - Get session details
- [ ] DELETE /api/v1/terminal/sessions/:id - Terminate session
- [ ] GET /api/v1/terminal/sessions/:id/history - Get command history
```

---

## Week 3: Payment Integration & Testing

### Day 11-12: RevenueCat Integration

#### 3.1 Payment Database Schema
```sql
-- Subscription and payment tracking
- [ ] subscriptions table (id, user_id, plan_type, status, started_at, expires_at)
- [ ] payment_history table (id, user_id, amount, currency, provider_ref, created_at)
- [ ] invoices table (id, subscription_id, amount, status, due_date, paid_at)
- [ ] usage_limits table (id, user_id, plan_type, ssh_connections, ai_requests)
```

#### 3.2 RevenueCat Webhook Handler
```typescript
// Payment processing
- [ ] POST /api/v1/webhooks/revenuecat - Webhook endpoint
- [ ] Handle purchase events and subscription creation
- [ ] Process subscription upgrades/downgrades
- [ ] Handle subscription cancellations and refunds
- [ ] Implement webhook signature verification
```

**Webhook Events to Handle:**
- `INITIAL_PURCHASE` - New subscription
- `RENEWAL` - Subscription renewal
- `CANCELLATION` - Subscription cancelled
- `BILLING_ISSUE` - Payment failed
- `REFUND` - Refund processed

#### 3.3 Subscription Management
```markdown
# Subscription endpoints
- [ ] GET /api/v1/subscriptions/current - Get current subscription
- [ ] GET /api/v1/subscriptions/history - Get payment history
- [ ] POST /api/v1/subscriptions/cancel - Cancel subscription
- [ ] GET /api/v1/subscriptions/plans - Get available plans
- [ ] POST /api/v1/subscriptions/upgrade - Upgrade plan
```

### Day 13-15: Testing & Documentation

#### 3.4 Integration Testing
```markdown
# Comprehensive test suite
- [ ] Auth flow integration tests (register, login, logout)
- [ ] SSH connection testing with mock servers
- [ ] WebSocket terminal communication tests
- [ ] Payment webhook testing with mock events
- [ ] Database transaction testing
- [ ] API endpoint validation testing
```

**Test Environment Setup:**
- Mock SSH server for testing connections
- Mock RevenueCat webhook events
- Test database with clean state per test
- Integration tests for WebSocket connections

#### 3.5 API Documentation
```markdown
# Swagger/OpenAPI documentation
- [ ] Complete API documentation for all endpoints
- [ ] Request/response schema definitions
- [ ] Authentication requirements documentation
- [ ] Error response documentation
- [ ] Usage examples and code samples
```

#### 3.6 Deployment Preparation
```markdown
# Production readiness
- [ ] Environment variable validation
- [ ] Database migration scripts
- [ ] Health check endpoints
- [ ] Logging and monitoring setup
- [ ] Security audit and penetration testing
```

---

## Technical Specifications

### Environment Variables
```markdown
# Required environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/devpocket-fastify-api-dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret
ENCRYPTION_KEY=your-encryption-key-for-ssh-keys
RESEND_API_KEY=your-resend-api-key
REVENUECAT_WEBHOOK_SECRET=your-webhook-secret
```

### Package Dependencies
```json
{
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/swagger": "^8.12.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/jwt": "^7.2.0",
    "@fastify/websocket": "^8.3.0",
    "prisma": "^5.6.0",
    "@prisma/client": "^5.6.0",
    "bcrypt": "^5.1.1",
    "ssh2": "^1.14.0",
    "node-pty": "^1.0.0",
    "bullmq": "^4.15.0",
    "ioredis": "^5.3.2",
    "zod": "^3.22.4",
    "resend": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "@types/node": "^20.8.0",
    "vitest": "^0.34.0",
    "eslint": "^8.52.0"
  }
}
```

### Security Considerations
- Input validation on all endpoints using Zod
- Rate limiting on authentication endpoints
- SSH key encryption at rest
- JWT token rotation mechanism
- HTTPS enforcement in production
- SQL injection prevention with Prisma
- XSS protection with Helmet.js

### Performance Targets
- API response time: < 100ms (p95)
- WebSocket latency: < 50ms
- SSH connection establishment: < 2s
- Database query optimization
- Connection pooling for SSH and database

---

## Success Criteria

### Week 1 Deliverables
- ✅ Complete project setup with Docker environment
- ✅ Authentication module with JWT implementation
- ✅ Database schema and migrations
- ✅ Basic API documentation

### Week 2 Deliverables
- ✅ SSH profile management functionality
- ✅ WebSocket terminal communication
- ✅ PTY session management
- ✅ Terminal command execution

### Week 3 Deliverables
- ✅ RevenueCat payment integration
- ✅ Subscription management
- ✅ Comprehensive test suite
- ✅ Production-ready deployment configuration

### Quality Gates
- All tests passing with >80% code coverage
- API documentation complete and validated
- Security audit completed
- Performance benchmarks met
- Docker compose environment working
- Database migrations tested

---

## Next Steps (Phase 2 Preview)
After Phase 1 completion, the next priorities will be:
1. Block-based terminal interface
2. Command history and search functionality
3. AI integration with OpenRouter (BYOK model)
4. Multi-device synchronization

This plan provides a solid foundation for the DevPocket backend server, following the project's architectural decisions and ensuring a scalable, secure, and maintainable codebase.