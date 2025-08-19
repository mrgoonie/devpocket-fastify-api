# DevPocket Fastify API - Essential Commands

## Development Commands

### Environment Setup
```bash
# Start development environment with Docker
pnpm docker:up

# Stop development environment
pnpm docker:down

# View Docker logs
pnpm docker:logs
```

### Development Server
```bash
# Start development server with hot reload
pnpm dev

# Build TypeScript to JavaScript
pnpm build

# Start production server
pnpm start
```

### Database Operations
```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# Run database migrations
pnpm db:migrate

# Reset database (removes all data)
pnpm db:reset

# Seed database with test data
pnpm db:seed

# Manual database queries (for debugging)
psql postgresql://postgres:postgresql@localhost:5432/devpocket-fastify-api-dev
```

### Testing Commands
```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run tests in watch mode (development)
pnpm test --watch
```

### Code Quality
```bash
# Run ESLint
pnpm lint

# Auto-fix ESLint issues
pnpm lint:fix
```

### System Commands (Linux)
```bash
# Project exploration
ls -la                    # List files with details
find . -name "*.ts"       # Find TypeScript files
grep -r "pattern" src/    # Search in source code

# Process management
ps aux | grep node        # Find Node.js processes
kill -9 <pid>            # Force kill process

# Docker debugging
docker ps                 # List running containers
docker logs <container>   # View container logs
docker exec -it <container> bash  # Enter container

# Network debugging
netstat -tlnp             # List listening ports
lsof -i :3000            # Check what's using port 3000
```

## Pre-commit Checklist
1. `pnpm lint` - Fix any linting errors
2. `pnpm test` - Ensure all tests pass
3. `pnpm build` - Verify TypeScript compilation
4. Check for sensitive information before commit

## Important Notes
- Always use Docker Compose for consistent development environment
- Tests require PostgreSQL on port 5432 and Redis on port 6379
- Never commit `.env` files or API keys
- Use PNPM, not NPM or Yarn
- Node.js version must be 20+