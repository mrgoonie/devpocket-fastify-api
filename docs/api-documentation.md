# DevPocket API Documentation

## Overview

The DevPocket API is a RESTful API that powers the AI-powered mobile terminal application. It provides endpoints for user authentication, SSH profile management, terminal sessions, subscription management, and system health monitoring.

## API Information

- **Base URL**: `https://api.devpocket.com` (Production) / `http://localhost:3000` (Development)
- **API Version**: v1
- **API Prefix**: `/api/v1`
- **Documentation**: Available at `/docs` (Swagger UI)
- **Authentication**: JWT Bearer tokens

## Quick Start

### 1. Authentication

All protected endpoints require a Bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.devpocket.com/api/v1/auth/me
```

### 2. Register a New User

```bash
curl -X POST https://api.devpocket.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "securepassword"
  }'
```

### 3. Login

```bash
curl -X POST https://api.devpocket.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

## Core Endpoints

### Health & Monitoring

| Endpoint | Method | Description | Auth Required |
|----------|---------|-------------|---------------|
| `/health` | GET | Comprehensive health check | No |
| `/health/ready` | GET | Kubernetes readiness probe | No |
| `/health/live` | GET | Kubernetes liveness probe | No |
| `/ping` | GET | Simple health check for load balancers | No |

#### Health Check Response Format

The health service returns standardized responses:

**Healthy Response (`200 OK`):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "ok", "responseTime": 45, "message": "Database connection successful" },
    "redis": { "status": "ok", "responseTime": 12, "message": "Redis connection successful" },
    "memory": { "status": "ok", "message": "Memory usage is normal" },
    "disk": { "status": "ok", "message": "Disk access successful" }
  }
}
```

**Unhealthy Response (`503 Service Unavailable`):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "error": "One or more health checks failed"
}
```

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/v1/auth/register` | POST | Register new user |
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/auth/logout` | POST | User logout |
| `/api/v1/auth/refresh` | POST | Refresh access token |
| `/api/v1/auth/me` | GET | Get current user profile |
| `/api/v1/auth/forgot-password` | POST | Request password reset |
| `/api/v1/auth/reset-password` | POST | Reset password with token |
| `/api/v1/auth/verify-email` | GET | Verify email with token |
| `/api/v1/auth/change-password` | POST | Change password (authenticated) |

### SSH Profile Management

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/v1/ssh/profiles` | GET | List user's SSH profiles |
| `/api/v1/ssh/profiles` | POST | Create new SSH profile |
| `/api/v1/ssh/profiles/:id` | GET | Get specific SSH profile |
| `/api/v1/ssh/profiles/:id` | PUT | Update SSH profile |
| `/api/v1/ssh/profiles/:id` | DELETE | Delete SSH profile |
| `/api/v1/ssh/test-connection` | POST | Test SSH connection |

### Terminal Session Management

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/v1/terminal/sessions` | GET | List active terminal sessions |
| `/api/v1/terminal/sessions` | POST | Create new terminal session |
| `/api/v1/terminal/sessions/:id` | DELETE | Terminate terminal session |
| `/api/v1/terminal/sessions/:id/history` | GET | Get session command history |
| `/api/v1/terminal/stats` | GET | Get terminal usage statistics |

### Subscription & Payments

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/v1/subscriptions/current` | GET | Get current subscription |
| `/api/v1/subscriptions/status` | GET | Get subscription status |
| `/api/v1/subscriptions/plans` | GET | Get available plans |
| `/api/v1/subscriptions/history` | GET | Get payment history |
| `/api/v1/subscriptions/cancel` | POST | Cancel subscription |
| `/api/v1/subscriptions/usage/:feature` | GET | Check feature usage limits |
| `/api/v1/subscriptions/free` | POST | Create free subscription |
| `/api/v1/webhooks/revenuecat` | POST | RevenueCat webhook handler |
| `/api/v1/payment/health` | GET | Payment service health check |

## Authentication Flow

### 1. Registration
- User provides email, username, and password
- System creates account and sends email verification
- Returns user object (email_verified: false initially)

### 2. Email Verification
- User clicks verification link or calls `/verify-email` with token
- Account becomes fully active

### 3. Login
- User provides email and password
- Returns access_token, refresh_token, and user object
- Access token expires based on JWT.EXPIRES_IN config

### 4. Token Refresh
- Use refresh_token to get new access_token
- Refresh tokens have longer expiration

## Error Handling

All API endpoints follow a consistent error response format:

### Success Response Format
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": ["Detailed error messages"]
}
```

### Common HTTP Status Codes

- **200 OK**: Successful operation
- **201 Created**: Resource created successfully  
- **204 No Content**: Successful operation with no response body
- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Authentication required or invalid credentials
- **403 Forbidden**: Authenticated but insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists or conflict
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

### Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `USER_NOT_FOUND`: User does not exist
- `EMAIL_ALREADY_EXISTS`: Email already registered
- `INVALID_CREDENTIALS`: Login failed
- `TOKEN_EXPIRED`: JWT token expired
- `FEATURE_LIMIT_EXCEEDED`: Subscription limit reached
- `PAYMENT_FAILED`: Payment processing error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **Password reset endpoints**: 3 requests per 5 minutes  
- **General endpoints**: 100 requests per minute
- **Rate limit headers**: 
  - `x-ratelimit-limit`: Request limit
  - `x-ratelimit-remaining`: Remaining requests
  - `x-ratelimit-reset`: Reset timestamp

## WebSocket Connections

Real-time terminal communication uses WebSocket connections:

- **Endpoint**: `ws://localhost:3000/ws/terminal` or `wss://api.devpocket.com/ws/terminal`
- **Authentication**: Include JWT token in connection query: `?token=YOUR_JWT_TOKEN`
- **Protocol**: Binary data for terminal I/O, JSON for control messages

## Subscription Plans & Limits

### Free Tier (7 days)
- Core terminal functionality
- BYOK AI features
- Limited SSH connections
- No cloud history

### Pro Tier ($12/month)
- Multi-device sync
- Cloud command history
- Unlimited SSH connections
- AI request caching
- Priority support

### Team Tier ($25/user/month)
- All Pro features
- Team workspaces
- Shared SSH profiles
- SSO integration
- Advanced analytics

## Development & Testing

### Test Environment
- Mock implementations available for terminal services during testing
- All SSH-related functionality uses mock responses in test environment
- Health checks and authentication work normally in tests

### Docker Support
```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f api
```

### Environment Variables
Key environment variables for API configuration:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/devpocket
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## SDK Generation

The API supports automatic SDK generation using the OpenAPI specification:

```bash
# Generate TypeScript SDK
npx openapi-generator-cli generate \
  -i http://localhost:3000/docs/json \
  -g typescript-axios \
  -o ./sdk/typescript

# Generate Python SDK  
npx openapi-generator-cli generate \
  -i http://localhost:3000/docs/json \
  -g python \
  -o ./sdk/python
```

## Support & Resources

- **Documentation**: Available at `/docs` (Swagger UI)
- **Repository**: [GitHub Repository]
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Support**: Contact support for Pro/Team tier users

---

*This documentation is automatically kept in sync with the OpenAPI specification. For the most up-to-date API reference, visit the Swagger UI at `/docs`.*