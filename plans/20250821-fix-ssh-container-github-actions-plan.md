# Fix SSH Server Container Failure in GitHub Actions

## Overview

The GitHub Actions CI/CD pipeline is failing with the error "Service container ssh-server failed. Error: Failed to initialize container linuxserver/openssh-server:latest". However, the container logs show it actually starts successfully, indicating the issue is with the health check configuration rather than the container itself.

## Problem Analysis

### Current Issue
- **Error**: `Service container ssh-server failed. Error: Failed to initialize container linuxserver/openssh-server:latest`
- **Container Status**: Actually starts successfully according to logs
- **Root Cause**: Health check failure, not actual container failure

### Current Health Check Configuration
```yaml
options: >-
  --health-cmd "ssh -o BatchMode=yes -o ConnectTimeout=5 testuser@localhost echo 'SSH server ready' || exit 1"
  --health-interval 15s
  --health-timeout 10s
  --health-retries 5
```

### Identified Problems
1. **Invalid Health Check Command**: The current SSH command tries to connect to `localhost` but needs to connect to the container itself
2. **Missing SSH Client**: The linuxserver/openssh-server container may not include SSH client tools needed for the health check
3. **Insufficient Start Period**: No grace period for container initialization
4. **Complex Health Check**: Attempting SSH connection is too complex for a health check

## Solution Architecture

### Option 1: Simple Health Check (Recommended)
Replace the SSH connection health check with a simple process/port check.

### Option 2: Alternative SSH Server Image
Use a different SSH server image with better health check support.

### Option 3: External Health Check
Remove container-level health check and implement application-level readiness check.

## Implementation Plan

### Phase 1: Fix Health Check Configuration (Immediate)

#### Step 1: Replace SSH Health Check
Update the health check to use a simple port check instead of SSH connection:

```yaml
ssh-server:
  image: linuxserver/openssh-server:latest
  env:
    PUID: 1000
    PGID: 1000
    TZ: UTC
    USER_NAME: testuser
    USER_PASSWORD: testpass
    PASSWORD_ACCESS: true
    SUDO_ACCESS: false
    PUBLIC_KEY_FILE: /config/.ssh/authorized_keys
  options: >-
    --health-cmd "nc -z localhost 2222"
    --health-interval 15s
    --health-timeout 5s
    --health-retries 10
    --health-start-period 60s
    --health-start-interval 5s
  ports:
    - 2222:2222
```

#### Step 2: Add Alternative Health Check Options
If netcat is not available, use process-based health check:

```yaml
options: >-
  --health-cmd "pgrep sshd"
  --health-interval 15s
  --health-timeout 5s
  --health-retries 10
  --health-start-period 60s
  --health-start-interval 5s
```

#### Step 3: Add File-based Health Check (Fallback)
Use file existence as health indicator:

```yaml
options: >-
  --health-cmd "test -f /var/run/sshd.pid"
  --health-interval 15s
  --health-timeout 5s
  --health-retries 10
  --health-start-period 60s
  --health-start-interval 5s
```

### Phase 2: Enhanced Container Readiness Check

#### Step 4: Update Workflow Readiness Check
Improve the manual SSH server readiness check in the workflow:

```yaml
- name: Wait for SSH server readiness
  if: vars.SSH_TEST_REAL_SERVER == 'true'
  run: |
    echo "=== Waiting for Docker SSH server to be ready ==="
    
    # Wait for container to be healthy
    for i in {1..60}; do
      if docker inspect ssh-server --format='{{.State.Health.Status}}' | grep -q "healthy"; then
        echo "Container reports healthy status"
        break
      else
        echo "Attempt $i: Container not healthy yet, waiting 2 seconds..."
        sleep 2
      fi
    done
    
    # Wait for port to be available
    for i in {1..30}; do
      if nc -z localhost 2222; then
        echo "SSH server port is open"
        break
      else
        echo "Attempt $i: SSH port not ready, waiting 2 seconds..."
        sleep 2
      fi
    done
    
    # Final connectivity test with authentication bypass for initial test
    echo "Testing SSH connectivity..."
    if timeout 10 ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 testuser@localhost echo "SSH ready" 2>/dev/null; then
      echo "SSH server is ready and accepting connections!"
    else
      echo "SSH connection test failed, but container may still be usable"
      echo "Checking container logs:"
      docker logs ssh-server --tail 20
    fi
```

### Phase 3: Alternative Solutions (If Primary Fix Fails)

#### Option A: Use Different SSH Server Image
Replace linuxserver/openssh-server with a more CI-friendly alternative:

```yaml
ssh-server:
  image: rastasheep/ubuntu-sshd:18.04
  env:
    SSH_USER: testuser
    SSH_PASSWORD: testpass
  options: >-
    --health-cmd "service ssh status"
    --health-interval 10s
    --health-timeout 5s
    --health-retries 5
    --health-start-period 30s
  ports:
    - 2222:22
```

#### Option B: Build Custom SSH Container
Create a custom Dockerfile with proper health check:

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    openssh-server \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser:testpass' | chpasswd && \
    mkdir -p /var/run/sshd

EXPOSE 22

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD nc -z localhost 22

CMD ["/usr/sbin/sshd", "-D"]
```

#### Option C: Remove Service Container Health Check
Disable health check and rely on application-level readiness:

```yaml
ssh-server:
  image: linuxserver/openssh-server:latest
  env:
    PUID: 1000
    PGID: 1000
    TZ: UTC
    USER_NAME: testuser
    USER_PASSWORD: testpass
    PASSWORD_ACCESS: true
    SUDO_ACCESS: false
  options: >-
    --no-healthcheck
  ports:
    - 2222:2222
```

## Testing Strategy

### Unit Tests
1. Test health check commands locally with Docker
2. Verify container startup timing
3. Test SSH connectivity after container is ready

### Integration Tests
1. Run full GitHub Actions workflow with updated configuration
2. Verify SSH tests pass with the container
3. Test both password and key-based authentication

### Verification Steps
```bash
# Test health check command locally
docker run -d --name test-ssh \
  -e USER_NAME=testuser \
  -e USER_PASSWORD=testpass \
  -e PASSWORD_ACCESS=true \
  -p 2222:2222 \
  linuxserver/openssh-server:latest

# Wait and test health check
sleep 30
docker exec test-ssh nc -z localhost 2222
docker exec test-ssh pgrep sshd

# Test SSH connectivity
ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p 2222 testuser@localhost echo "test"

# Cleanup
docker stop test-ssh && docker rm test-ssh
```

## Implementation Steps

### TODO Tasks

- [ ] **Step 1: Update health check to use netcat port check**
  - Modify `.github/workflows/ci.yml`
  - Replace SSH connection health check with `nc -z localhost 2222`
  - Add start period and start interval parameters

- [ ] **Step 2: Add fallback health check options**
  - Test process-based check (`pgrep sshd`)
  - Test file-based check (`test -f /var/run/sshd.pid`)
  - Document which works best

- [ ] **Step 3: Enhance workflow readiness check**
  - Update "Wait for SSH server readiness" step
  - Add container health status monitoring
  - Improve error logging and diagnostics

- [ ] **Step 4: Test locally**
  - Verify health check commands work with the container
  - Test SSH connectivity after health check passes
  - Measure actual startup time

- [ ] **Step 5: Update CI configuration and test**
  - Commit changes to GitHub
  - Monitor GitHub Actions run
  - Verify SSH tests pass

- [ ] **Step 6: Document alternative solutions**
  - Add fallback options to documentation
  - Update troubleshooting guide
  - Create container startup timing benchmarks

## Expected Outcomes

### Success Criteria
- [ ] GitHub Actions CI/CD pipeline passes without "Failed to initialize container" error
- [ ] SSH server container starts successfully and reports healthy status
- [ ] SSH connectivity tests pass in CI environment
- [ ] Container startup time is reasonable (< 60 seconds)
- [ ] No degradation in test coverage or functionality

### Performance Metrics
- **Container startup time**: Target < 45 seconds
- **Health check success rate**: 100% after implementation
- **CI pipeline reliability**: Eliminate flaky SSH container failures

## Rollback Plan

If the implementation causes issues:

1. **Immediate Rollback**: Revert to mock SSH tests only
   ```yaml
   # Comment out entire ssh-server service
   # ssh-server:
   #   image: linuxserver/openssh-server:latest
   ```

2. **Partial Rollback**: Disable health check only
   ```yaml
   options: >-
     --no-healthcheck
   ```

3. **Alternative Approach**: Switch to external SSH server testing
   - Use existing external server configuration
   - Skip container-based SSH tests in CI

## Risks and Mitigations

### Risk 1: Health Check Still Fails
**Mitigation**: Implement multiple fallback health check options and container alternatives.

### Risk 2: Container Startup Too Slow
**Mitigation**: Optimize container configuration and increase timeout values.

### Risk 3: SSH Tests Still Fail
**Mitigation**: Enhanced readiness checking and better error diagnostics.

### Risk 4: CI Pipeline Instability
**Mitigation**: Comprehensive testing and gradual rollout with rollback plan.

## Timeline

- **Immediate Fix (Day 1)**: Update health check configuration
- **Testing & Validation (Day 1)**: Local testing and verification
- **CI Implementation (Day 1)**: Deploy to GitHub Actions
- **Monitoring (Day 2-3)**: Monitor multiple CI runs for stability
- **Documentation (Day 3)**: Update troubleshooting guides

## References

- [GitHub Actions Service Containers Documentation](https://docs.github.com/en/actions/using-containerized-services/about-service-containers)
- [Docker Health Check Best Practices](https://docs.docker.com/reference/dockerfile/#healthcheck)
- [LinuxServer OpenSSH-Server Documentation](https://docs.linuxserver.io/images/docker-openssh-server/)
- [Docker Health Check Startup Time Improvements (2025)](https://docs.docker.com/engine/release-notes/)