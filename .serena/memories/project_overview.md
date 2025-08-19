# DevPocket Fastify API Project Overview

## Purpose
DevPocket is an AI-powered mobile terminal application that brings command-line functionality to mobile devices. This is the Fastify backend server that provides WebSocket terminal communication, SSH/PTY support, authentication, and AI service integration.

## Key Features
- **BYOK (Bring Your Own Key)** model for AI features using OpenRouter
- SSH connections with PTY support for remote server access
- Local terminal emulation on mobile devices
- Natural language to command conversion using AI
- WebSocket-based real-time terminal communication
- Multi-device synchronization
- JWT-based authentication system
- PostgreSQL for persistent storage, Redis for caching

## Tech Stack
- **Runtime**: Node.js 20+ with TypeScript
- **Package Manager**: PNPM
- **Framework**: Fastify
- **Database**: PostgreSQL (dev: devpocket-fastify-api-dev, prod: devpocket-fastify-api)
- **ORM**: Prisma
- **Cache**: Redis
- **Queue**: BullMQ for background jobs
- **Testing**: Vitest with coverage
- **API Documentation**: Swagger
- **Development**: Docker Compose

## Project Structure
```
src/
├── modules/          # Feature modules
│   ├── auth/         # JWT authentication, user management
│   ├── terminal/     # WebSocket, SSH, PTY services
│   └── payment/      # Payment processing (stub)
├── shared/           # Shared utilities
│   ├── database/     # Prisma client and seeding
│   ├── email/        # Email service
│   ├── encryption/   # SSH key encryption
│   ├── health/       # Health checks
│   └── queue/        # Background job processing
├── config/           # Application configuration
├── tests/            # Test helpers and setup
└── types/            # TypeScript type definitions
```

## Business Model
- **Free Tier (7 days)**: Core terminal + BYOK AI features
- **Pro Tier ($12/mo)**: Multi-device sync, cloud history, AI caching
- **Team Tier ($25/user/mo)**: Team workspaces, shared workflows, SSO