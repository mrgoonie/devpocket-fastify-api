# DevPocket API Troubleshooting Guide

This guide provides solutions for common issues encountered during development, testing, and production deployment of the DevPocket API.

## Database-Related Issues

### P2034 Transaction Conflict Errors

**Symptoms:**
- `P2034` error codes in logs during user registration or login
- Intermittent authentication failures in high-concurrency scenarios
- Test failures in CI/CD environments with database timeouts

**Cause:**
Database transaction conflicts when multiple operations attempt to modify the same records simultaneously.

**Resolution:**
The API automatically handles these conflicts with retry logic:

```typescript
// Automatic retry with exponential backoff
- Registration: Up to 3 retries with 100ms base delay
- Login: Up to 5 retries with 100ms base delay
- Exponential backoff: delay = baseDelay * Math.pow(2, attempt - 1)
```

**Manual Debugging:**
```bash
# Check database logs for transaction conflicts
docker logs devpocket-postgres | grep -i "deadlock\|conflict"

# Monitor active connections
psql -c "SELECT count(*) as active_connections FROM pg_stat_activity;"

# Check for long-running transactions
psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
         FROM pg_stat_activity 
         WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"
```

### Database Connection Issues

**Symptoms:**
- Connection timeout errors during startup
- Tests failing with "database connection failed" messages
- Health check endpoints returning 503 status

**Common Causes:**
1. PostgreSQL service not running
2. Incorrect DATABASE_URL configuration
3. Database not accessible from container/CI environment
4. Connection pool exhausted

**Resolution Steps:**

1. **Verify database service:**
```bash
# Local development
docker-compose ps postgres
docker-compose logs postgres

# CI environment
pg_isready -h localhost -p 5432
```

2. **Check connection string:**
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://username:password@host:port/database
```

3. **Test direct connection:**
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

4. **Monitor connection pool:**
```bash
# Check active connections in database
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

### Slow Database Queries

**Symptoms:**
- Authentication endpoints taking longer than 2 seconds
- Transaction timeouts in logs
- High CPU usage on database server

**Investigation:**
```bash
# Enable query logging in PostgreSQL
# Add to postgresql.conf:
# log_min_duration_statement = 1000  # Log queries taking >1s

# Monitor slow queries
psql -c "SELECT query, mean_exec_time, calls 
         FROM pg_stat_statements 
         ORDER BY mean_exec_time DESC 
         LIMIT 10;"
```

**Common Solutions:**
- Check for missing database indexes
- Analyze transaction isolation levels
- Review connection pool settings
- Consider query optimization

## Email Service Issues

### Email Sending Failures

**Symptoms:**
- "Failed to send email (non-blocking)" warnings in logs
- Users not receiving verification or reset emails
- Email service initialization errors

**Impact:**
Email failures are designed to be non-blocking and do not prevent core authentication flows.

**Troubleshooting Steps:**

1. **Check email service configuration:**
```bash
# Verify environment variables
echo $RESEND_API_KEY
echo $FROM_EMAIL_ADDRESS
```

2. **Review email service logs:**
```bash
# Look for email service errors
docker logs devpocket-api | grep -i "email\|resend"
```

3. **Test email service connectivity:**
```typescript
// Manual test (add to temporary route)
const emailService = await import('@/shared/email/email.service.js');
await emailService.EmailService.sendWelcomeEmail(
  'test@example.com', 
  'testuser', 
  'test-token'
);
```

**Common Solutions:**
- Verify API key is valid and has sending permissions
- Check email domain configuration with Resend
- Ensure FROM_EMAIL_ADDRESS is verified with email provider
- Review rate limiting on email provider

### Email Service Dynamic Import Issues

**Symptoms:**
- "Failed to load email service" errors during transactions
- Inconsistent email sending behavior

**Cause:**
Dynamic imports during database transactions can cause timing issues.

**Resolution:**
The email service is now pre-initialized to avoid dynamic imports:

```typescript
// Pre-initialization pattern used in codebase
private static emailService: any = null;

private static async getEmailService() {
  if (!this.emailService) {
    try {
      const { EmailService } = await import('@/shared/email/email.service.js');
      this.emailService = EmailService;
    } catch (error) {
      logger.warn('Failed to load email service:', error);
    }
  }
  return this.emailService;
}
```

## CI/CD Test Issues

### Test Failures in GitHub Actions

**Symptoms:**
- Tests passing locally but failing in CI
- Race condition errors during authentication tests
- Database state inconsistencies in test runs

**Common Causes:**
1. Different timing behavior in CI environment
2. Database not fully initialized before tests run
3. Insufficient retry logic for slower CI environments

**Solutions Implemented:**

1. **Environment-aware configuration:**
```typescript
const maxRetries = process.env.CI ? 3 : 1;
const retryDelay = process.env.CI ? 1500 : 100;
```

2. **Database state verification:**
```typescript
// Verify user exists before attempting login
for (let waitAttempt = 1; waitAttempt <= maxWaitAttempts; waitAttempt++) {
  const registeredUser = await prisma.user.findUnique({
    where: { email }
  });
  if (registeredUser) break;
  await new Promise(resolve => setTimeout(resolve, 100 * waitAttempt));
}
```

3. **Database connection verification:**
```typescript
// Test database readiness before running tests
await prisma.$queryRaw`SELECT 1 as connected`;
await prisma.$queryRaw`SELECT current_database()`;
```

### Debugging CI Test Failures

**Investigation Steps:**

1. **Review GitHub Actions logs:**
```yaml
# Look for database connection issues
name: Debug Database Connection
run: |
  echo "DATABASE_URL: $DATABASE_URL"
  pg_isready -h localhost -p 5432
  psql $DATABASE_URL -c "SELECT version();"
```

2. **Enable debug logging:**
```bash
# Add to test environment
DEBUG=* npm test
LOG_LEVEL=debug npm test
```

3. **Check timing issues:**
```bash
# Look for timing-related errors in logs
grep -i "timeout\|retry\|attempt" test-logs.txt
```

### SSH Test Failures in CI/CD

**Symptoms:**
- SSH connection tests failing in GitHub Actions but passing locally
- `expect(testConnection.success).toBe(true)` receiving `false` 
- Connection timeout errors to external SSH servers from CI runners

**Root Cause:**
GitHub Actions runners cannot connect to external SSH servers due to network restrictions, firewall rules, or server availability issues.

**Solution Implemented:**
Environment-aware SSH testing with automatic fallback to mocks in CI:

```typescript
// CI environment detection
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const hasRealServer = !!process.env.SSH_TEST_REAL_SERVER;

// Skip real SSH tests in CI unless explicitly configured
const describeRealTests = isCI && !hasRealServer ? describe.skip : describe;
```

**Configuration Options:**

1. **Default CI Behavior (Recommended):**
   - Real SSH tests are skipped in CI
   - Mock SSH tests ensure connection logic is tested
   - No external dependencies required

2. **Enable Real SSH Tests in CI:**

**Option A: Use Docker SSH Server (Recommended):**
```bash
# Set in GitHub Actions repository variables
SSH_TEST_REAL_SERVER=true
# No additional configuration needed - uses Docker container
```

**Option B: Use External SSH Server:**
```bash
# Set in GitHub Actions secrets/environment
SSH_TEST_REAL_SERVER=true
SSH_TEST_HOST=your-test-server.com
SSH_TEST_PWD_USER=testuser
SSH_TEST_PWD_PASS=testpass
```

3. **Local Development:**
   - All SSH tests run against real servers when credentials are provided
   - Tests are skipped when credentials are missing

**Debugging SSH Test Issues:**

```bash
# Test locally with CI environment
CI=true npm test -- src/tests/ssh-real-connections.test.ts

# Check which tests are running/skipped
npm test -- src/tests/ssh-real-connections.test.ts --reporter=verbose

# Test real SSH connection manually
ssh testuser@your-server.com -p 22
```

**Mock Implementation:**
The SSH service automatically uses mocks in CI environments:
- `localhost` and `test-server` hosts → success
- `192.0.2.1` (RFC5737 test network) → timeout simulation
- Invalid configurations → connection failures

**Docker SSH Server Integration:**
The GitHub Actions workflow includes an optional SSH server container:
- **Image**: `linuxserver/openssh-server:latest`
- **Port**: `2222` (mapped to container port `2222`)
- **Credentials**: `testuser:testpass`
- **Usage**: Set `SSH_TEST_REAL_SERVER=true` in repository variables
- **Benefits**: Real SSH testing without external dependencies

## Authentication Flow Issues

### Registration → Login Flow Failures

**Symptoms:**
- User registration succeeds but immediate login fails
- "User not found during session creation" errors
- Inconsistent user state between registration and login

**Root Cause:**
Race conditions between registration transaction commit and login attempt.

**Solution Implemented:**
Database state verification ensures user is fully persisted before login:

```typescript
// Wait for user to be available in database
let userFound = false;
for (let waitAttempt = 1; waitAttempt <= maxWaitAttempts; waitAttempt++) {
  const registeredUser = await prisma.user.findUnique({
    where: { email }
  });
  if (registeredUser) {
    userFound = true;
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 100 * waitAttempt));
}
```

### Session Creation Issues

**Symptoms:**
- "User not found during session creation" errors
- Login succeeds but session token is invalid
- Inconsistent session state

**Resolution:**
Enhanced session creation with user existence verification:

```typescript
// Verify user exists before creating session
const existingUser = await tx.user.findUnique({
  where: { id: user.id }
});

if (!existingUser) {
  throw new Error('User not found during session creation');
}
```

## Performance Issues

### Slow Authentication Endpoints

**Investigation:**
1. Check database query performance
2. Review transaction isolation levels
3. Analyze retry mechanism overhead
4. Monitor connection pool utilization

**Optimization Tips:**
- Use ReadCommitted isolation for non-critical operations
- Keep transactions short and focused
- Pre-initialize services to avoid dynamic imports
- Consider connection pool size adjustments

### Memory Usage Issues

**Symptoms:**
- High memory consumption during tests
- Memory leaks in long-running processes
- Out of memory errors in CI

**Solutions:**
- Ensure proper cleanup of test app instances
- Monitor database connection pool size
- Use memory profiling tools for investigation

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Database Metrics:**
   - Transaction conflict rate (P2034 errors)
   - Query execution time
   - Connection pool utilization
   - Lock wait time

2. **Authentication Metrics:**
   - Registration success rate
   - Login success rate
   - Token refresh success rate
   - Average response time

3. **Email Service Metrics:**
   - Email sending success rate
   - Email service availability
   - Queue depth for email jobs

### Log Analysis

**Important Log Patterns:**
```bash
# Database transaction conflicts
grep "Database transaction conflict" logs/app.log

# Email service failures (non-blocking)
grep "Failed to send.*email.*non-blocking" logs/app.log

# Authentication failures
grep "Error (logging in|registering) user" logs/app.log

# Performance issues
grep "timeout\|slow" logs/app.log
```

## Emergency Procedures

### Database Recovery

If database becomes completely unavailable:
1. Check PostgreSQL service status
2. Verify disk space and memory availability
3. Review connection limits and active connections
4. Consider restarting PostgreSQL service
5. Check for corrupted indexes or data

### Service Degradation

If authentication services are experiencing high failure rates:
1. Check database connection pool health
2. Monitor error rates for specific endpoints
3. Review retry mechanism effectiveness
4. Consider temporary rate limiting adjustments
5. Verify email service is not blocking critical operations

## Getting Help

For additional support:
1. Check application logs with appropriate log levels
2. Review database query plans for performance issues
3. Monitor system resources (CPU, memory, disk I/O)
4. Consult team documentation in `/docs` directory
5. Create GitHub issues with detailed error information

---

*This troubleshooting guide is maintained alongside code changes. Always refer to the latest version for current best practices.*