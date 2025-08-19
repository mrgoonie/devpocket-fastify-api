# Production Dockerfile for DevPocket Fastify API
FROM node:20-alpine3.17 AS base

# Install pnpm
RUN npm install -g pnpm@8.10.5

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Dependencies stage
FROM base AS dependencies

# Install build tools and Python for node-gyp, plus OpenSSL for Prisma
RUN apk add --no-cache python3 py3-setuptools make g++ openssl-dev

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build the application
RUN pnpm build

# Production stage
FROM base AS production

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application from dependencies stage
COPY --from=dependencies /app/dist ./dist
COPY --from=dependencies /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=dependencies /app/prisma ./prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { host: 'localhost', port: 3000, path: '/ping', timeout: 2000 }; \
    const request = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    request.on('error', () => process.exit(1)); \
    request.on('timeout', () => process.exit(1)); \
    request.end();"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]