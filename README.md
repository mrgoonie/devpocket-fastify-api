# DevPocket Fastify API

DevPocket is an AI-powered mobile terminal application that brings command-line functionality to mobile devices. This is the backend server built with Fastify, TypeScript, and modern technologies.

## 🚀 Features

### Core Features
- **SSH Terminal Access**: Secure SSH connections with PTY support
- **Real-time Communication**: WebSocket-based terminal streaming  
- **AI Integration**: BYOK (Bring Your Own Key) model with OpenRouter
- **Multi-device Sync**: Cloud-based session and history synchronization
- **Subscription Management**: RevenueCat integration with usage limits

### Technical Features
- **Fastify Framework**: High-performance Node.js web framework
- **TypeScript**: Full type safety and modern development experience
- **Prisma ORM**: Database management with PostgreSQL
- **Redis Caching**: Fast data access and session management
- **JWT Authentication**: Secure user authentication and authorization
- **Comprehensive Testing**: Vitest with integration test coverage
- **Docker Support**: Containerized development and deployment

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Database Setup](#-database-setup)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Architecture](#-architecture)
- [Contributing](#-contributing)

## 🏃 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/devpocket-fastify-api.git
cd devpocket-fastify-api

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env

# Start development environment
docker-compose up -d

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

The API will be available at `http://localhost:3000` and API documentation at `http://localhost:3000/docs`.

## 🔧 Prerequisites

- **Node.js**: Version 20.0.0 or higher
- **PNPM**: Version 8.0.0 or higher
- **Docker**: For PostgreSQL and Redis (optional)
- **PostgreSQL**: Version 15+ (if not using Docker)
- **Redis**: Version 7+ (if not using Docker)

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/devpocket-fastify-api.git
cd devpocket-fastify-api
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Verify Installation

```bash
# Check versions
node --version  # Should be 20+
pnpm --version  # Should be 8+
```

## 🌍 Environment Setup

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your specific configuration:

```env
# Development Environment Variables
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://devpocket:devpocket@localhost:5432/devpocket-fastify-api-dev?schema=public

# Redis Configuration  
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-min-32-characters-long

# Encryption Configuration (for SSH keys)
ENCRYPTION_KEY=your-encryption-key-for-ssh-keys-min-32-chars

# Email Configuration (Resend)
RESEND_API_KEY=re_your_actual_resend_api_key

# Payment Configuration (RevenueCat)
REVENUECAT_WEBHOOK_SECRET=your-revenuecat-webhook-secret
```

### 3. Generate Secure Keys

```bash
# Generate secure JWT secrets
openssl rand -base64 64

# Generate encryption key
openssl rand -base64 32
```

## 🗄️ Database Setup

### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Wait for services to be ready
docker-compose logs -f postgres

# Push database schema
pnpm db:push

# (Optional) Seed database with sample data
pnpm db:seed
```

### Option 2: Local Installation

1. **Install PostgreSQL 15+**
2. **Install Redis 7+**
3. **Create Database**:
   ```bash
   createdb devpocket-fastify-api-dev
   ```
4. **Push Schema**:
   ```bash
   pnpm db:push
   ```

### Database Management Commands

```bash
# Generate Prisma client
pnpm db:generate

# Push schema changes to database
pnpm db:push

# Create and run migrations
pnpm db:migrate

# Reset database (WARNING: Deletes all data)
pnpm db:reset

# Seed database with sample data
pnpm db:seed
```

## 🛠️ Development

### Start Development Server

```bash
# Start all services (recommended)
docker-compose up -d

# Or start only the API server
pnpm dev
```

### Development Commands

```bash
# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Fix linting issues
pnpm lint:fix

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

### Development Workflow

1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Make Changes**: Edit code with TypeScript and hot reload
3. **Run Tests**: `pnpm test`
4. **Lint Code**: `pnpm lint`
5. **Commit Changes**: Use conventional commit messages
6. **Create Pull Request**: Submit for review

## 📚 API Documentation

### Interactive Documentation

Visit `http://localhost:3000/docs` when the server is running to access the interactive Swagger UI documentation.

### API Overview

| Endpoint Category | Base Path | Description |
|------------------|-----------|-------------|
| Authentication | `/api/v1/auth` | User registration, login, JWT management |
| SSH Profiles | `/api/v1/ssh/profiles` | SSH connection profile management |
| Terminal Sessions | `/api/v1/terminal/sessions` | Terminal session lifecycle management |
| Subscriptions | `/api/v1/subscriptions` | Subscription and payment management |
| WebSocket | `/api/v1/terminal/ws` | Real-time terminal communication |
| Webhooks | `/api/v1/webhooks` | External service webhooks |

### Key API Features

- **RESTful Design**: Standard HTTP methods and status codes
- **JWT Authentication**: Bearer token authentication for protected endpoints
- **Request Validation**: Comprehensive input validation with Zod schemas
- **Error Handling**: Consistent error responses with helpful messages
- **Rate Limiting**: Protection against abuse and DoS attacks
- **CORS Support**: Cross-origin requests for web clients

### Authentication

Most endpoints require JWT authentication:

```bash
# Login to get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Use token in subsequent requests
curl -X GET http://localhost:3000/api/v1/ssh/profiles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🧪 Testing

### Test Structure

```
src/tests/
├── app.test.ts           # Application-level tests
├── helper.ts             # Test utilities and helpers
└── setup.ts              # Test environment setup

src/modules/*/
├── *.test.ts             # Module-specific tests
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/modules/auth/auth.test.ts

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode during development
pnpm test:watch
```

### Test Environment

Tests use a separate test database and Redis instance:

- **Database**: `devpocket-fastify-api-test`
- **Redis**: Database 1 (separate from development)
- **Environment**: Isolated test configuration

### Writing Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../tests/helper.js';

describe('Your Feature', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should do something', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/your-endpoint'
    });

    expect(response.statusCode).toBe(200);
  });
});
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

### Docker Deployment

```bash
# Build production image
docker build -t devpocket-api:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=your_production_database_url \
  -e REDIS_URL=your_production_redis_url \
  devpocket-api:latest
```

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/devpocket-fastify-api?schema=public
REDIS_URL=redis://host:port
JWT_SECRET=your_production_jwt_secret
JWT_REFRESH_SECRET=your_production_refresh_secret
ENCRYPTION_KEY=your_production_encryption_key
RESEND_API_KEY=your_production_resend_key
REVENUECAT_WEBHOOK_SECRET=your_production_webhook_secret
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates configured
- [ ] Health checks implemented
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup strategy in place

## 🏗️ Architecture

### Project Structure

```
src/
├── app.ts                 # Application entry point
├── config/               # Configuration files
│   ├── environment.ts    # Environment variables and validation
│   ├── plugins.ts        # Fastify plugins setup
│   └── routes.ts         # Route registration
├── modules/              # Feature modules
│   ├── auth/            # Authentication module
│   ├── payment/         # Payment and subscription module
│   ├── terminal/        # SSH and terminal module
│   └── shared/          # Shared module utilities
├── shared/               # Shared application utilities
│   ├── database/        # Database configuration and client
│   ├── email/           # Email service
│   ├── encryption/      # Encryption utilities
│   ├── logger.ts        # Logging configuration
│   └── queue/           # Background job processing
├── types/               # TypeScript type definitions
└── tests/               # Test utilities and setup
```

### Technology Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify 4.x with plugins
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+ with IORedis client
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schema validation
- **Testing**: Vitest with test utilities
- **Documentation**: OpenAPI/Swagger
- **Queue**: BullMQ for background jobs
- **Email**: Resend for transactional emails
- **Payments**: RevenueCat webhook integration

### Design Patterns

- **Modular Architecture**: Feature-based module organization
- **Dependency Injection**: Service layer with constructor injection
- **Repository Pattern**: Data access abstraction with Prisma
- **Middleware Pattern**: Request/response processing pipeline
- **Event-Driven**: WebSocket and queue-based processing
- **BYOK Pattern**: Bring Your Own Key for AI services

### Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **SSH Key Encryption**: AES-256 encryption for stored SSH keys
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Cross-origin request handling
- **Helmet Integration**: Security headers
- **SQL Injection Protection**: Prisma ORM query builder

## 🤝 Contributing

### Development Setup

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `pnpm install`
4. **Set up environment**: Copy and configure `.env`
5. **Run tests**: `pnpm test`
6. **Make changes and commit**: Use conventional commit format
7. **Create Pull Request**: Submit for review

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new authentication endpoint
fix: resolve JWT token expiration issue
docs: update API documentation
test: add payment webhook tests
refactor: improve error handling structure
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Linting rules enforced
- **Prettier**: Code formatting (disabled per project requirements)
- **Testing**: Comprehensive test coverage required

### Pull Request Process

1. Update documentation as needed
2. Ensure all tests pass
3. Add tests for new features
4. Update CHANGELOG.md
5. Request review from maintainers
6. Address feedback promptly

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Visit `/docs` when running the server
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Email**: contact@devpocket.com

## 🙏 Acknowledgments

- Fastify team for the excellent web framework
- Prisma team for the outstanding ORM
- RevenueCat for subscription management
- All contributors and supporters

---

**Happy coding! 🚀**