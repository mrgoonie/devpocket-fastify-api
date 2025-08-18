# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevPocket is an AI-powered mobile terminal application that brings command-line functionality to mobile devices. The project consists of a Fastify backend server (planned) and Flutter mobile application (planned), with documentation currently in the `docs/` directory.

Key features:
- **BYOK (Bring Your Own Key)** model for AI features using OpenRouter
- SSH connections with PTY support for remote server access
- Local terminal emulation on mobile devices
- Natural language to command conversion using AI
- WebSocket-based real-time terminal communication
- Multi-device synchronization

## Architecture

### Backend (Fastify - Node.js)
- **WebSocket Terminal**: Real-time terminal communication at `/ws/terminal`
- **SSH/PTY Support**: Direct terminal interaction with pseudo-terminal support
- **AI Service**: BYOK model where users provide their own OpenRouter API keys
- **Authentication**: JWT-based authentication system
- **Database**: PostgreSQL for persistent storage, Redis for caching
- **Connection Management**: WebSocket connection manager for real-time updates

**Tech stack:**
* Runtime: Node.js 20+ với TypeScript
* Package manager: PNPM
* Framework: Fastify
* Database: PostgreSQL
  * Database name (dev): `devpocket-fastify-api-dev`
  * Database name (prod): `devpocket-fastify-api`
  * Note: create database if not exist (using `DATABASE_URL` connection string in `.env` and `.env.prod`)
* ORM: Prisma 
* Cache: Redis
* Queue: BullMQ (xử lý background jobs)
* API docs: Swagger (đầy đủ mô tả endpoint, schemas, response, http code, chuẩn hoá API)

## Development Environment: 
* Docker, Docker Compose
* Thiết lập code linting (eslint).
* Không cần code formatting (prettier).
* Thiết lập quy định tổ chức cấu trúc source code, quy chuẩn đặt tên biến & function.

### Frontend (Flutter - Dart)
The mobile app structure is documented in:
- `docs/devpocket-flutter-app-structure-dart.md` - App architecture
- `docs/devpocket-flutter-implementation-dart.md` - Implementation details
- `docs/devpocket-flutter-integration.md` - Backend integration

## Key Implementation Notes

### BYOK (Bring Your Own Key) Model
- Users provide their own OpenRouter API keys
- No API costs for the service provider
- Higher gross margins (85-98%)
- API keys are never stored, only validated

### Security Considerations
- JWT tokens for authentication
- SSH keys handled securely
- API keys transmitted but never stored
- WebSocket connections authenticated via token

### Real-time Features
- WebSocket for terminal I/O streaming
- PTY support for interactive terminal sessions
- Multi-device synchronization via Redis pub/sub

## Business Model

Freemium tiers documented in `docs/devpocket-product-overview.md`:
- **Free Tier (7 days)**: Core terminal + BYOK AI features
- **Pro Tier ($12/mo)**: Multi-device sync, cloud history, AI caching
- **Team Tier ($25/user/mo)**: Team workspaces, shared workflows, SSO

## Development Rules

### General
- Update existing docs (Markdown files) in `./docs` directory before any code refactoring
- Add new docs (Markdown files) to `./docs` directory after new feature implementation (do not create duplicated docs)
- Use `context7` mcp tools for docs of plugins/packages
- Use `senera` mcp tools for semantic retrieval and editing capabilities
- Use `psql` bash command to query database for debugging
- Whenever you want to understand the whole code base, use this command: [`repomix`](https://repomix.com/guide/usage) and read the output summary file.
- Create a plan with TODO tasks in `./plans` directory, follow and update it as you go.

### Environment Setup
- Use docker compose for development environment

### Code Quality Guidelines
- Don't be too harsh on code linting and formatting
- Prioritize functionality and readability over strict style enforcement
- Use reasonable code quality standards that enhance developer productivity
- Allow for minor style variations when they improve code clarity

### Pre-commit/Push Rules
- Run linting before commit
- Run tests before push (DO NOT ignore failed tests just to pass the build or github actions)
- Keep commits focused on the actual code changes
- **DO NOT** commit and push any confidential information (such as dotenv files, API keys, database credentials, etc.) to git repository!
- NEVER automatically add AI attribution signatures like:
  "🤖 Generated with [Claude Code]"
  "Co-Authored-By: Claude noreply@anthropic.com"
  Any AI tool attribution or signature
- Create clean, professional commit messages without AI references. Use conventional commit format.