# DevPocket Fastify API

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.2.2-blue.svg)](https://www.typescriptlang.org)
[![Fastify](https://img.shields.io/badge/fastify-4.24.3-black.svg)](https://fastify.io)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

DevPocket is an AI-powered mobile terminal application that brings command-line functionality to mobile devices. This repository contains the backend server built with Fastify, TypeScript, and modern technologies.

## 🚀 Features

### Phase 1 - Core Backend Infrastructure ✅
- **🔐 Authentication System**: JWT-based auth with refresh tokens
- **🐘 PostgreSQL Database**: Prisma ORM with comprehensive schemas
- **🔴 Redis Caching**: Session management and background job queues
- **📊 Health Monitoring**: Comprehensive health checks for all services
- **📖 API Documentation**: Interactive Swagger/OpenAPI documentation
- **🧪 Testing Framework**: Vitest with integration test coverage
- **🛡️ Security Middleware**: Helmet, CORS, rate limiting, input validation
- **📧 Email Integration**: Resend service for transactional emails
- **💳 Payment Webhooks**: RevenueCat integration for subscription management

### SSH & Terminal Features 🚧
- **🔑 SSH Profile Management**: Store and manage SSH connection profiles
- **⚡ Terminal Sessions**: Create and manage terminal sessions
- **🔐 SSH Key Encryption**: Secure storage of SSH keys with AES-256
- **📜 Command History**: Session-based command history tracking
- **📊 Terminal Statistics**: Usage analytics and session metrics

### Technical Features
- **🚀 High Performance**: Fastify framework with async/await
- **📝 TypeScript**: Full type safety and modern development experience  
- **🔧 Developer Experience**: Hot reload, comprehensive linting, testing
- **🐳 Docker Support**: Containerized development and deployment
- **📦 Background Jobs**: BullMQ for async processing
- **🔍 Request Validation**: Zod schemas for comprehensive input validation

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Database Setup](#-database-setup)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Docker Support](#-docker-support)
- [Project Structure](#-project-structure)
- [Available Scripts](#-available-scripts)
- [API Endpoints](#-api-endpoints)
- [WebSocket Communication](#-websocket-communication)
- [Troubleshooting](#-troubleshooting)
- [Phase 1 Summary](#-phase-1-summary)
- [Contributing](#-contributing)

## 🏃 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd devpocket-fastify-api

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development services (PostgreSQL & Redis)
docker-compose up -d postgres redis

# Run database setup
pnpm db:push

# Start development server
pnpm dev
```

🎉 **The API will be available at `http://localhost:3000`**  
📖 **API documentation at `http://localhost:3000/docs`**

## 🔧 Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **PNPM**: Version 8.0.0 or higher (recommended package manager)
- **Docker & Docker Compose**: For PostgreSQL and Redis services
- **PostgreSQL**: Version 15+ (if not using Docker)
- **Redis**: Version 7+ (if not using Docker)

### System Requirements
```bash
# Verify your setup
node --version    # Should be 20+
pnpm --version    # Should be 8+
docker --version  # For containerized services
```

## 📦 Installation

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd devpocket-fastify-api
```

### 2. Install Dependencies
```bash
# Using PNPM (recommended)
pnpm install

# Or using NPM
npm install
```

### 3. Verify Installation
```bash
# Check if TypeScript compiles successfully
pnpm build

# Should complete without errors
```

## 🌍 Environment Setup

### 1. Create Environment File
```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your specific configuration:

```env
# Development Environment
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://devpocket:devpocket@localhost:5432/devpocket-fastify-api-dev?schema=public

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Secrets (Generate with: openssl rand -base64 64)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long-replace-this
JWT_REFRESH_SECRET=your-refresh-secret-min-32-characters-long-replace-this

# SSH Key Encryption (Generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your-encryption-key-for-ssh-keys-min-32-chars-replace

# Email Service (Get from https://resend.com)
RESEND_API_KEY=re_your_actual_resend_api_key_here

# Payment Webhooks (Configure in RevenueCat dashboard)
REVENUECAT_WEBHOOK_SECRET=your-revenuecat-webhook-secret-here

# Docker Development Settings
POSTGRES_USER=devpocket
POSTGRES_PASSWORD=devpocket
POSTGRES_DB=devpocket-fastify-api-dev

# Optional Configuration
FRONTEND_URL=https://your-frontend-domain.com  # For CORS in production
PORT=3000  # API server port
HOST=0.0.0.0  # Server host
```

### 3. Generate Secure Keys

```bash
# Generate JWT secrets (run twice for JWT_SECRET and JWT_REFRESH_SECRET)
openssl rand -base64 64

# Generate encryption key for SSH keys
openssl rand -base64 32
```

## 🗄️ Database Setup

### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis services
docker-compose up -d postgres redis

# Wait for services to be ready (check logs)
docker-compose logs postgres
docker-compose logs redis

# Push database schema to PostgreSQL
pnpm db:push

# (Optional) Seed database with sample data
pnpm db:seed
```

### Option 2: Local Installation

1. **Install PostgreSQL 15+** and **Redis 7+**
2. **Create Development Database**:
   ```bash
   createdb devpocket-fastify-api-dev
   ```
3. **Update DATABASE_URL** in `.env` for your local setup
4. **Push Schema**:
   ```bash
   pnpm db:push
   ```

### Database Management Commands

```bash
# Generate Prisma client after schema changes
pnpm db:generate

# Push schema changes to database (development)
pnpm db:push

# Create and run migrations (production)
pnpm db:migrate

# Reset database (⚠️ WARNING: Deletes all data)
pnpm db:reset

# Seed database with sample data
pnpm db:seed
```

## 🛠️ Development

### Start Development Environment

```bash
# Start all services with Docker (recommended)
docker-compose up -d

# Or start only external services
docker-compose up -d postgres redis

# Then start the API server
pnpm dev
```

### Development Workflow

1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Make Changes**: Edit code with TypeScript and hot reload
3. **Run Tests**: `pnpm test` (fix failing tests before committing)
4. **Lint Code**: `pnpm lint` (fix linting issues)
5. **Build Check**: `pnpm build` (ensure TypeScript compiles)
6. **Commit Changes**: Use conventional commit messages
7. **Create Pull Request**: Submit for review

### Development Commands

```bash
# Development server with hot reload
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Code quality
pnpm lint          # Run ESLint
pnpm lint:fix      # Fix auto-fixable issues

# Testing
pnpm test          # Run all tests
pnpm test:coverage # Run tests with coverage report

# Docker management
pnpm docker:up     # Start Docker services
pnpm docker:down   # Stop Docker services  
pnpm docker:logs   # View service logs
```

## 📚 API Documentation

### Interactive Documentation

🌐 **Visit `http://localhost:3000/docs` when the server is running**

The Swagger UI provides:
- **Interactive API Testing**: Test endpoints directly from the browser
- **Request/Response Schemas**: Complete data model documentation
- **Authentication**: JWT bearer token testing
- **Error Response Examples**: Comprehensive error handling documentation

### API Overview

| Endpoint Category | Base Path | Description | Status |
|------------------|-----------|-------------|---------|
| **Health Checks** | `/api/v1/health` | Service health monitoring | ✅ Complete |
| **Authentication** | `/api/v1/auth` | User registration, login, JWT management | ✅ Complete |
| **SSH Profiles** | `/api/v1/ssh/profiles` | SSH connection profile management | 🚧 Implemented |
| **Terminal Sessions** | `/api/v1/terminal/sessions` | Terminal session lifecycle | 🚧 Implemented |
| **Subscriptions** | `/api/v1/subscriptions` | Subscription and payment management | ✅ Complete |
| **WebSocket** | `/ws/terminal` | Real-time terminal communication | 🚧 Framework Ready |
| **Webhooks** | `/api/v1/webhooks` | External service webhooks | ✅ Complete |

### Authentication Example

```bash
# Register new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'

# Login to get tokens
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'

# Use access token for authenticated requests
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🧪 Testing

### Current Test Status
- **Total Test Files**: 4 modules
- **Test Framework**: Vitest with comprehensive utilities
- **Coverage**: Integration tests for all major modules
- **Status**: Some tests need environment fixes (see Troubleshooting)

### Test Structure

```
src/tests/
├── app.test.ts           # Application-level integration tests
├── helper.ts             # Test utilities and helpers  
└── setup.ts              # Test environment configuration

src/modules/*/
├── *.test.ts             # Module-specific integration tests
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/modules/auth/auth.test.ts

# Run tests with coverage report
pnpm test:coverage

# Watch mode for development
pnpm test --watch
```

### Test Environment

Tests automatically use isolated test databases:
- **Database**: `devpocket-fastify-api-test` 
- **Redis**: Database 1 (separate from development)
- **Environment**: Isolated test configuration

## 🐳 Docker Support

### Development with Docker

```bash
# Start all services (PostgreSQL + Redis + API)
docker-compose up -d

# Start only external services
docker-compose up -d postgres redis

# View service logs
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop all services
docker-compose down
```

### Production Docker Build

```bash
# Build production image
docker build -t devpocket-api:latest .

# Run production container
docker run -p 3000:3000 \
  -e DATABASE_URL="your_production_database_url" \
  -e REDIS_URL="your_production_redis_url" \
  -e JWT_SECRET="your_production_jwt_secret" \
  devpocket-api:latest
```

### Docker Services

- **PostgreSQL**: Port 5432, persistent volume
- **Redis**: Port 6379, persistent volume  
- **API Application**: Port 3000, hot reload in development

## 🏗️ Project Structure

```
src/
├── app.ts                 # 🚀 Application entry point
├── config/               # ⚙️ Application configuration
│   ├── environment.ts    # Environment variables & validation
│   ├── plugins.ts        # Fastify plugins registration
│   └── routes.ts         # Route registration & organization
├── modules/              # 🧩 Feature modules (Domain-driven)
│   ├── auth/            # 🔐 Authentication & authorization
│   ├── payment/         # 💳 Subscription & payment webhooks
│   ├── terminal/        # ⚡ SSH profiles & terminal sessions
│   └── shared/          # 🔄 Shared module utilities
├── shared/               # 🛠️ Application-wide utilities
│   ├── cache/           # 🔴 Redis caching utilities
│   ├── database/        # 🐘 PostgreSQL client & migrations
│   ├── email/           # 📧 Email service (Resend)
│   ├── encryption/      # 🔐 SSH key encryption utilities
│   ├── health/          # 🏥 Health check services
│   ├── logger.ts        # 📝 Application logging (Pino)
│   └── queue/           # 🔄 Background job processing (BullMQ)
├── types/               # 📝 TypeScript type definitions
│   └── fastify.d.ts     # Fastify type extensions
└── tests/               # 🧪 Test utilities and setup
    ├── app.test.ts      # Application integration tests
    ├── helper.ts        # Test utilities
    └── setup.ts         # Test environment setup
```

### Technology Stack

**Core Framework:**
- **Runtime**: Node.js 20+ with TypeScript 5.2+
- **Web Framework**: Fastify 4.x with plugins ecosystem
- **Package Manager**: PNPM 8+ for efficient dependency management

**Database & Caching:**
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache & Sessions**: Redis 7+ with IORedis client
- **Background Jobs**: BullMQ for async task processing

**Security & Authentication:**
- **Authentication**: JWT with refresh token rotation
- **Password Security**: bcrypt with configurable salt rounds
- **SSH Key Storage**: AES-256 encryption for secure key storage
- **Request Security**: Helmet, CORS, rate limiting, input validation

**Development & Testing:**
- **Testing**: Vitest with comprehensive test utilities
- **Code Quality**: ESLint with TypeScript rules
- **API Documentation**: OpenAPI 3.0 with Swagger UI
- **Schema Validation**: Zod for runtime type checking

**External Integrations:**
- **Email**: Resend for transactional emails
- **Payments**: RevenueCat webhook integration
- **AI Services**: BYOK model with OpenRouter (planned)

## 📜 Available Scripts

### Development Scripts
```bash
pnpm dev          # Start development server with hot reload
pnpm build        # Build TypeScript to JavaScript
pnpm start        # Start production server
```

### Database Scripts
```bash
pnpm db:generate  # Generate Prisma client
pnpm db:push      # Push schema to database (dev)
pnpm db:migrate   # Create and run migrations (prod)
pnpm db:reset     # Reset database (⚠️ destructive)
pnpm db:seed      # Seed database with sample data
```

### Testing & Quality Scripts
```bash
pnpm test                # Run all tests
pnpm test:coverage       # Run tests with coverage
pnpm lint                # Run ESLint
pnpm lint:fix           # Fix auto-fixable lint issues
```

### Docker Scripts
```bash
pnpm docker:up          # Start Docker services
pnpm docker:down        # Stop Docker services
pnpm docker:logs        # View Docker logs
```

## 🔌 API Endpoints

### Authentication Endpoints
```bash
POST   /api/v1/auth/register      # User registration
POST   /api/v1/auth/login         # User login
GET    /api/v1/auth/me            # Get current user
POST   /api/v1/auth/refresh       # Refresh tokens
POST   /api/v1/auth/logout        # User logout
```

### SSH Profile Management
```bash
GET    /api/v1/ssh/profiles       # List SSH profiles
POST   /api/v1/ssh/profiles       # Create SSH profile
PUT    /api/v1/ssh/profiles/:id   # Update SSH profile
DELETE /api/v1/ssh/profiles/:id   # Delete SSH profile
POST   /api/v1/ssh/profiles/:id/test  # Test SSH connection
```

### Terminal Session Management
```bash
GET    /api/v1/terminal/sessions  # List terminal sessions
POST   /api/v1/terminal/sessions  # Create terminal session
DELETE /api/v1/terminal/sessions/:id # Delete terminal session
GET    /api/v1/terminal/sessions/:id/history # Get command history
GET    /api/v1/terminal/stats     # Get terminal statistics
```

### Health & Monitoring
```bash
GET    /api/v1/health             # Overall health check
GET    /api/v1/health/ready       # Readiness probe
GET    /api/v1/health/live        # Liveness probe
```

### Webhooks
```bash
POST   /api/v1/webhooks/revenuecat # RevenueCat subscription webhooks
```

## 🌐 WebSocket Communication

### Terminal WebSocket Connection

```javascript
// Connect to terminal WebSocket
const ws = new WebSocket('ws://localhost:3000/ws/terminal');

// Authentication with JWT token
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your_jwt_access_token'
}));

// Terminal input/output
ws.send(JSON.stringify({
  type: 'input',
  sessionId: 'session-uuid',
  data: 'ls -la\n'
}));

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Terminal output:', message);
};
```

### WebSocket Message Types
- **`auth`**: Authentication with JWT token
- **`input`**: Send command input to terminal
- **`output`**: Receive terminal output
- **`resize`**: Terminal resize events
- **`error`**: Error notifications

## 🔧 Troubleshooting

### Common Issues & Solutions

#### 1. Redis Authentication Errors
**Issue**: `NOAUTH Authentication required`
```bash
# Solution: Ensure Redis is running without auth in development
docker-compose restart redis

# Or check Redis configuration
docker-compose logs redis
```

#### 2. Database Connection Issues  
**Issue**: `Can't reach database server`
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL service
docker-compose restart postgres

# Verify connection string in .env
echo $DATABASE_URL
```

#### 3. Test Failures
**Issue**: Tests failing due to environment setup
```bash
# Ensure test database exists
pnpm db:push

# Clear Redis test cache
docker-compose exec redis redis-cli FLUSHDB

# Run tests with clean environment
pnpm test
```

#### 4. Port Already in Use
**Issue**: `EADDRINUSE: address already in use :::3000`
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or change PORT in .env
PORT=3001
```

#### 5. TypeScript Compilation Errors
**Issue**: Build failing with type errors
```bash
# Clear compiled files
rm -rf dist/

# Regenerate Prisma client
pnpm db:generate

# Clean install dependencies
rm -rf node_modules/
pnpm install

# Try building again
pnpm build
```

#### 6. Missing Environment Variables
**Issue**: Server fails to start due to missing env vars
```bash
# Copy example file
cp .env.example .env

# Generate required secrets
openssl rand -base64 64  # For JWT secrets
openssl rand -base64 32  # For encryption key
```

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=true
```

### Health Check Debugging
Check service health status:
```bash
curl http://localhost:3000/api/v1/health
```

Expected healthy response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "checks": {
    "database": { "status": "healthy", "responseTime": 5 },
    "redis": { "status": "healthy", "responseTime": 2 },
    "memory": { "status": "healthy" },
    "disk": { "status": "healthy" }
  }
}
```

## 📋 Phase 1 Summary

### ✅ Completed Features

**Core Infrastructure:**
- [x] Fastify server setup with TypeScript
- [x] PostgreSQL database with Prisma ORM
- [x] Redis caching and session management  
- [x] Docker Compose development environment
- [x] Comprehensive health monitoring
- [x] Security middleware (Helmet, CORS, rate limiting)

**Authentication System:**
- [x] JWT-based authentication with refresh tokens
- [x] User registration and login endpoints
- [x] Password hashing with bcrypt
- [x] Token validation middleware
- [x] User profile management

**SSH & Terminal Foundation:**
- [x] SSH profile CRUD operations
- [x] SSH key encryption/decryption service
- [x] Terminal session management framework
- [x] Command history tracking
- [x] Terminal statistics collection

**Payment Integration:**
- [x] RevenueCat webhook handling
- [x] Subscription status management
- [x] Usage limit enforcement middleware

**Developer Experience:**
- [x] Interactive API documentation (Swagger)
- [x] Comprehensive testing framework
- [x] ESLint configuration and code quality
- [x] Hot reload development environment
- [x] Docker containerization

### 🚧 Phase 1 Status Notes

**Current State:**
- ✅ **Application builds successfully** (`pnpm build`)
- ✅ **Server starts and runs** (`pnpm dev`)
- ✅ **API documentation accessible** at `/docs`
- ⚠️ **Some tests need environment fixes** (Redis auth, test database)
- ✅ **Docker development environment ready**

**Known Issues to Address:**
- Test environment Redis configuration needs fixing
- Some integration tests failing due to setup issues
- WebSocket terminal functionality framework ready but needs completion

### 🎯 Next Steps (Phase 2)

**Terminal Implementation:**
- [ ] Complete WebSocket terminal handler
- [ ] SSH connection pooling and management
- [ ] Real-time terminal I/O streaming
- [ ] PTY (pseudo-terminal) integration

**AI Integration:**
- [ ] OpenRouter API integration
- [ ] Natural language to command conversion
- [ ] Command suggestions and completions
- [ ] BYOK (Bring Your Own Key) implementation

**Mobile App Integration:**
- [ ] Flutter app development
- [ ] Real-time synchronization
- [ ] Offline mode support
- [ ] Push notifications for terminal activities

## 🤝 Contributing

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/devpocket-fastify-api.git
   cd devpocket-fastify-api
   ```
3. **Install dependencies**: `pnpm install`
4. **Set up environment**: Copy and configure `.env`
5. **Start services**: `docker-compose up -d postgres redis`
6. **Run database setup**: `pnpm db:push`
7. **Start development**: `pnpm dev`

### Contribution Guidelines

**Commit Convention:**
We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add SSH key rotation feature
fix: resolve JWT token expiration handling
docs: update API documentation for terminal endpoints
test: add integration tests for payment webhooks
refactor: improve error handling in terminal service
perf: optimize database queries for session management
```

**Code Style:**
- **TypeScript**: Strict mode with comprehensive type checking
- **ESLint**: Enforced linting rules (run `pnpm lint`)
- **Testing**: Comprehensive test coverage required
- **Documentation**: Update API docs and README as needed

**Pull Request Process:**
1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes with proper commit messages
3. Add/update tests for new functionality
4. Ensure all tests pass: `pnpm test`
5. Lint your code: `pnpm lint:fix`
6. Update documentation as needed
7. Submit pull request with detailed description

### Code Review Standards

- **Functionality**: Does the code work as intended?
- **Security**: Are there any security vulnerabilities?
- **Performance**: Is the code performant and scalable?
- **Testing**: Are there adequate tests for the changes?
- **Documentation**: Is the code well-documented?

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Resources

- **📖 API Documentation**: Visit `/docs` when running the server
- **🐛 Issues**: [Create an issue](https://github.com/your-repo/issues) on GitHub
- **💬 Discussions**: Use GitHub Discussions for questions and ideas
- **📧 Email**: support@devpocket.com

## 🙏 Acknowledgments

Special thanks to the amazing open source community:

- **[Fastify](https://fastify.io)** - Lightning fast web framework
- **[Prisma](https://prisma.io)** - Next-generation ORM for Node.js
- **[RevenueCat](https://revenuecat.com)** - Subscription infrastructure
- **[Resend](https://resend.com)** - Email delivery service
- All contributors and supporters of the DevPocket project

---

**🚀 Happy coding with DevPocket!**

*Built with ❤️ for developers who need powerful terminal access on mobile devices*