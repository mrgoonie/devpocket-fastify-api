# Kế Hoạch Phát Triển Backend DevPocket

## 🎯 Tech Stack & Development Environment Setup

### Initial Setup Tasks
```markdown
## TODO - Project Setup
- [ ] Initialize Node.js project với TypeScript
- [ ] Setup PNPM workspace
- [ ] Configure tsconfig.json với strict mode
- [ ] Setup Fastify framework với plugins cơ bản
- [ ] Configure Prisma ORM
- [ ] Setup Docker & Docker Compose
  - [ ] PostgreSQL container
  - [ ] Redis container
  - [ ] App container với hot-reload
- [ ] Configure ESLint rules
- [ ] Tạo .env.example và .env.test.example
- [ ] Setup Swagger/OpenAPI documentation
- [ ] Configure BullMQ với Redis
- [ ] Setup testing framework (Vitest/Jest)
- [ ] Setup semantic release (github release only, no NPM release) in GitHub Actions
```

### Code Structure & Naming Convention
```markdown
## Project Structure
src/
├── modules/           # Feature modules
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.route.ts
│   │   └── auth.schema.ts
│   ├── terminal/
│   ├── payment/
│   └── ...
├── shared/           # Shared utilities
│   ├── database/
│   ├── queue/
│   ├── cache/
│   └── email/
├── config/          # Configurations
├── types/           # TypeScript types
└── tests/           # Integration tests

## Naming Convention
- Files: kebab-case (user-service.ts)
- Classes: PascalCase (UserService)
- Functions: camelCase (getUserById)
- Constants: UPPER_SNAKE_CASE (MAX_RETRY_COUNT)
- Database tables: snake_case (user_profiles)
- API endpoints: kebab-case (/api/v1/user-profile)
```

---

## 📅 Phase 1: MVP Core (Weeks 1-3)

### 1.1 Authentication Module
```markdown
## TODO - Authentication
- [ ] Database schema design
  - [ ] users table (id, email, username, password_hash, created_at, updated_at)
  - [ ] sessions table (id, user_id, token, expires_at)
  - [ ] password_reset_tokens table
- [ ] Auth endpoints
  - [ ] POST /api/v1/auth/register
  - [ ] POST /api/v1/auth/login
  - [ ] POST /api/v1/auth/logout
  - [ ] POST /api/v1/auth/forgot-password
  - [ ] POST /api/v1/auth/reset-password
  - [ ] GET /api/v1/auth/verify-email
- [ ] JWT implementation với refresh tokens
- [ ] Password hashing với bcrypt
- [ ] Rate limiting cho auth endpoints
- [ ] Email service với Resend
  - [ ] Welcome email template
  - [ ] Password reset email template
  - [ ] Email verification template
- [ ] Validation với Zod schemas
- [ ] Error handling middleware
```

### 1.2 SSH Terminal Module (Basic)
```markdown
## TODO - SSH Connection
- [ ] Database schema
  - [ ] ssh_profiles table (id, user_id, name, host, port, username, auth_type)
  - [ ] ssh_keys table (id, profile_id, private_key_encrypted, public_key)
  - [ ] terminal_sessions table (id, user_id, profile_id, session_id, created_at)
- [ ] SSH endpoints
  - [ ] POST /api/v1/ssh/profiles (create profile)
  - [ ] GET /api/v1/ssh/profiles (list profiles)
  - [ ] PUT /api/v1/ssh/profiles/:id (update profile)
  - [ ] DELETE /api/v1/ssh/profiles/:id
  - [ ] POST /api/v1/ssh/connect (establish connection)
  - [ ] WebSocket /ws/terminal/:sessionId (terminal interaction)
- [ ] SSH client implementation với node-ssh2
  - [ ] Key-based authentication
  - [ ] Password authentication
  - [ ] Connection pooling
- [ ] WebSocket handler cho PTY interaction
- [ ] Encryption service cho SSH keys storage
```

### 1.3 Payment Module (RevenueCat Integration)
```markdown
## TODO - Payment & Subscriptions
- [ ] Database schema
  - [ ] subscriptions table (id, user_id, plan_type, status, started_at, expires_at)
  - [ ] payment_history table (id, user_id, amount, currency, provider_ref, created_at)
  - [ ] invoices table
- [ ] RevenueCat webhooks
  - [ ] POST /api/v1/webhooks/revenuecat
  - [ ] Handle purchase events
  - [ ] Handle subscription changes
  - [ ] Handle cancellations
- [ ] Subscription endpoints
  - [ ] GET /api/v1/subscriptions/current
  - [ ] GET /api/v1/subscriptions/history
  - [ ] POST /api/v1/subscriptions/cancel
- [ ] Plan enforcement middleware
- [ ] Usage limits per plan
```

### 1.4 Integration Tests
```markdown
## TODO - Testing
- [ ] Auth flow tests
  - [ ] Registration with email verification
  - [ ] Login/logout flow
  - [ ] Password reset flow
- [ ] SSH connection tests
  - [ ] Key-based auth test (.env.test config)
  - [ ] Password auth test (.env.test config)
  - [ ] Terminal command execution
- [ ] Payment webhook tests
  - [ ] Mock RevenueCat events
- [ ] Setup GitHub Actions workflow
```

---

## 📅 Phase 2: Block-Based Terminal (Weeks 4-5)

### 2.1 Command Block System
```markdown
## TODO - Block Terminal
- [ ] Database schema
  - [ ] command_blocks table (id, session_id, command, output, status, created_at)
  - [ ] block_metadata table (collapsed, pinned, tags)
- [ ] Block management endpoints
  - [ ] POST /api/v1/blocks (create block)
  - [ ] GET /api/v1/blocks/:sessionId (get session blocks)
  - [ ] PUT /api/v1/blocks/:id (update block state)
  - [ ] DELETE /api/v1/blocks/:id
- [ ] Real-time block updates via WebSocket
- [ ] Command execution queue với BullMQ
- [ ] Output streaming với chunking
- [ ] Block sharing functionality
  - [ ] POST /api/v1/blocks/:id/share
  - [ ] GET /api/v1/shared/:shareId
```

### 2.2 Command History & Search
```markdown
## TODO - History Management
- [ ] Database schema
  - [ ] command_history table (id, user_id, command, timestamp, device_id)
- [ ] History endpoints
  - [ ] GET /api/v1/history (paginated)
  - [ ] GET /api/v1/history/search
  - [ ] DELETE /api/v1/history/:id
- [ ] Redis caching for recent commands
- [ ] Full-text search với PostgreSQL
```

---

## 📅 Phase 3: AI Integration - BYOK (Weeks 6-7)

### 3.1 OpenRouter Integration
```markdown
## TODO - AI Features
- [ ] Database schema
  - [ ] ai_keys table (id, user_id, encrypted_key, provider, created_at)
  - [ ] ai_usage table (id, user_id, tokens_used, model, timestamp)
  - [ ] ai_cache table (prompt, response, model, expires_at)
- [ ] AI endpoints
  - [ ] POST /api/v1/ai/keys (save encrypted key)
  - [ ] POST /api/v1/ai/generate-command
  - [ ] POST /api/v1/ai/explain-error
  - [ ] POST /api/v1/ai/suggest
  - [ ] GET /api/v1/ai/usage
- [ ] OpenRouter client wrapper
- [ ] Prompt templates management
- [ ] Response caching với Redis (60% cost reduction)
- [ ] Rate limiting per user
```

### 3.2 Agent Mode
```markdown
## TODO - Natural Language Processing
- [ ] NLP to command conversion
- [ ] Context-aware suggestions
- [ ] Multi-turn conversations
- [ ] Command validation before execution
- [ ] Feedback collection for improvements
```

---

## 📅 Phase 4: Multi-Device Sync (Weeks 8-9)

### 4.1 Device Management
```markdown
## TODO - Device Registry
- [ ] Database schema
  - [ ] devices table (id, user_id, device_id, name, type, last_seen)
  - [ ] sync_queue table (id, user_id, data_type, payload, synced_at)
- [ ] Device endpoints
  - [ ] POST /api/v1/devices/register
  - [ ] GET /api/v1/devices
  - [ ] DELETE /api/v1/devices/:id
- [ ] Device limit enforcement (5 for Pro)
```

### 4.2 Real-time Sync
```markdown
## TODO - Data Synchronization
- [ ] WebSocket sync protocol
- [ ] Conflict resolution strategy
- [ ] Sync queue processor với BullMQ
- [ ] Incremental sync với timestamps
- [ ] Offline support với sync on reconnect
- [ ] Data compression cho sync payload
```

---

## 📅 Phase 5: Team Collaboration (Weeks 10-11)

### 5.1 Team Management
```markdown
## TODO - Teams & Workspaces
- [ ] Database schema
  - [ ] teams table (id, name, owner_id, created_at)
  - [ ] team_members table (team_id, user_id, role, joined_at)
  - [ ] team_invites table
- [ ] Team endpoints
  - [ ] POST /api/v1/teams
  - [ ] GET /api/v1/teams/:id/members
  - [ ] POST /api/v1/teams/:id/invite
  - [ ] PUT /api/v1/teams/:id/members/:userId
- [ ] Role-based access control (RBAC)
- [ ] Team billing management
```

### 5.2 Shared Resources
```markdown
## TODO - Collaboration Features
- [ ] Shared SSH profiles
- [ ] Shared workflows/scripts
- [ ] Team command library
- [ ] Activity feed
- [ ] Audit logs for compliance
```

---

## 📅 Phase 6: Advanced Features (Weeks 12+)

### 6.1 Automation & Workflows
```markdown
## TODO - Workflow Engine
- [ ] Workflow designer backend
- [ ] Scheduled tasks với cron
- [ ] Webhook triggers
- [ ] Custom scripts repository
```

### 6.2 Analytics & Monitoring
```markdown
## TODO - Usage Analytics
- [ ] Command usage statistics
- [ ] Performance metrics
- [ ] Error tracking
- [ ] Cost analysis for AI usage
- [ ] Admin dashboard APIs
```

### 6.3 Enterprise Features
```markdown
## TODO - Enterprise
- [ ] SSO integration (SAML 2.0)
- [ ] Advanced audit logs
- [ ] Custom AI model support
- [ ] Self-hosted deployment guide
- [ ] SLA monitoring
```

---

## 🚀 Deployment & DevOps

```markdown
## TODO - Infrastructure
- [ ] CI/CD pipeline với GitHub Actions
- [ ] Staging environment setup
- [ ] Production deployment với Docker
- [ ] Database migrations strategy
- [ ] Monitoring với Prometheus/Grafana
- [ ] Log aggregation với ELK stack
- [ ] Backup & disaster recovery
- [ ] Rate limiting với Redis
- [ ] CDN setup cho static assets
- [ ] Security scanning (OWASP)
```

---

## 📊 Performance Targets

```markdown
## Metrics to Monitor
- API response time: < 100ms (p95)
- WebSocket latency: < 50ms
- SSH connection time: < 2s
- AI response time: < 3s
- Uptime: 99.9%
- Concurrent users: 10,000+
- Commands/second: 1,000+
```

---

## 🔐 Security Checklist

```markdown
## Security Implementation
- [ ] Input validation tất cả endpoints
- [ ] SQL injection prevention với Prisma
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Rate limiting toàn bộ API
- [ ] SSH key encryption at rest
- [ ] API key rotation mechanism
- [ ] Security headers (Helmet.js)
- [ ] DDoS protection
- [ ] Penetration testing
```

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| **Phase 1** | 3 weeks | Auth, Basic SSH, Payment |
| **Phase 2** | 2 weeks | Block Terminal, History |
| **Phase 3** | 2 weeks | AI Integration (BYOK) |
| **Phase 4** | 2 weeks | Multi-device Sync |
| **Phase 5** | 2 weeks | Team Features |
| **Phase 6** | Ongoing | Advanced Features |

**Total MVP Timeline**: 3 weeks  
**Full Feature Set**: 11 weeks  
**Production Ready**: 12-14 weeks

Mỗi phase có thể phát triển song song một số features không conflict, giúp tối ưu thời gian development và có thể release incremental updates cho users.