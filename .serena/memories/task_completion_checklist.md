# DevPocket Fastify API - Task Completion Checklist

## Pre-Commit Requirements (MANDATORY)

### 1. Code Quality Checks
- [ ] **ESLint**: Run `pnpm lint` and fix all errors
- [ ] **TypeScript**: Run `pnpm build` to ensure compilation
- [ ] **Type Safety**: Verify no `any` types or non-null assertions added
- [ ] **Unused Code**: Remove unused variables, imports, functions

### 2. Testing Requirements (CRITICAL)
- [ ] **All Tests Pass**: Run `pnpm test` - DO NOT ignore failed tests
- [ ] **Test Coverage**: Ensure new code has appropriate test coverage
- [ ] **Test Isolation**: Verify tests don't interfere with each other
- [ ] **Database State**: Tests should clean up after themselves

### 3. Environment Verification
- [ ] **Docker Environment**: Test with `pnpm docker:up`
- [ ] **Database Connection**: Verify PostgreSQL connectivity
- [ ] **Redis Connection**: Verify Redis connectivity
- [ ] **Environment Variables**: Check all required env vars are documented

### 4. Security Check (CRITICAL)
- [ ] **No Secrets**: Never commit API keys, passwords, or sensitive data
- [ ] **No .env Files**: Ensure .env, .env.local, etc. are gitignored
- [ ] **SSH Keys**: No private keys in repository
- [ ] **Database URLs**: No production credentials in code

### 5. Documentation Updates
- [ ] **Code Comments**: Add comments for complex logic
- [ ] **API Changes**: Update Swagger documentation if needed
- [ ] **README Updates**: Update if new setup steps required
- [ ] **Memory Files**: Update project memories if architecture changed

## Post-Implementation Verification

### 1. Functional Testing
- [ ] **Manual Testing**: Test the implemented feature manually
- [ ] **Integration Testing**: Verify feature works with existing system
- [ ] **Error Scenarios**: Test error handling and edge cases
- [ ] **Performance**: Check for obvious performance issues

### 2. Code Review Preparation
- [ ] **Clean Commits**: Each commit has a clear, focused purpose
- [ ] **Commit Messages**: Use conventional commit format (feat:, fix:, etc.)
- [ ] **No AI Signatures**: Remove any AI attribution from commits
- [ ] **Logical Organization**: Related changes are grouped properly

### 3. Deployment Readiness
- [ ] **Environment Config**: Production environment variables documented
- [ ] **Migration Scripts**: Database migrations tested
- [ ] **Dependencies**: New dependencies justified and documented
- [ ] **Backwards Compatibility**: Changes don't break existing API

## Specific Project Rules

### Authentication Module
- [ ] **JWT Tokens**: Proper token validation and expiry
- [ ] **Password Hashing**: Use bcrypt with appropriate rounds
- [ ] **Rate Limiting**: Auth endpoints have rate limiting

### Terminal Module
- [ ] **WebSocket Security**: Authenticated connections only
- [ ] **SSH Key Encryption**: Keys encrypted before storage
- [ ] **PTY Security**: Proper process isolation

### Payment Module
- [ ] **Webhook Security**: Validate all webhook signatures
- [ ] **PII Protection**: No sensitive payment data in logs
- [ ] **Error Handling**: Graceful failure handling

## Emergency Checklist (If Tests Fail)

### 1. Database Issues
- [ ] Check Docker containers are running: `docker ps`
- [ ] Verify database credentials in vitest.config.ts
- [ ] Run database migrations: `pnpm db:migrate`
- [ ] Check database connectivity: `psql [connection_string]`

### 2. Redis Issues
- [ ] Verify Redis container is running
- [ ] Check Redis URL in environment
- [ ] Test Redis connection manually

### 3. Test Environment Issues
- [ ] Ensure test database is isolated (different from dev)
- [ ] Check vitest.config.ts environment variables
- [ ] Verify test setup files are properly configured
- [ ] Run tests sequentially: `pnpm test --fileParallelism=false`

## Final Verification Commands
```bash
# Must all pass before commit
pnpm lint           # No errors allowed
pnpm build          # Must compile successfully  
pnpm test           # All tests must pass
pnpm docker:up      # Environment must start
```

## Notes
- **Zero tolerance** for failing tests in commits
- **Security first** - never compromise on secrets management
- **Quality over speed** - take time to do it right
- **Documentation matters** - future developers will thank you