# Fix Token Refresh API Missing refresh_token Field

**Date**: 2025-08-26  
**Status**: Planning  
**Priority**: High  

## Overview & Requirements

### Problem Statement
The token refresh API endpoint (`POST /api/v1/auth/refresh`) currently returns only `access_token` and `expires_in` fields, but the client (Flutter app) expects a `refresh_token` field in the response. This causes the client to fail when trying to access `data['refresh_token']`.

### Current vs Expected Behavior
**Current Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully", 
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "abc123def456...",
    "expires_in": 900
  }
}
```

### Requirements
- ✅ Add `refresh_token` field to refresh token API response
- ✅ Maintain backward compatibility (no breaking changes)
- ✅ Use Option A approach (return same refresh token for simplicity)
- ✅ Update response schemas in routes and auth schema files
- ✅ Update tests to validate new field
- ✅ Follow snake_case API naming convention

## Architecture & Design

### Approach Decision: Option A - Return Same Refresh Token
We'll implement **Option A** (return the same refresh token) rather than token rotation for the following reasons:
- **Simplicity**: No need to invalidate old tokens or update database
- **Backward Compatibility**: Existing sessions remain valid
- **Performance**: No additional database operations required
- **Consistency**: Aligns with current login/register behavior

### Token Flow Analysis
1. Client sends refresh token in request body
2. Service validates refresh token and returns `{userId, sessionId}`
3. Controller generates new JWT access token
4. **NEW**: Controller includes the original refresh token in response
5. Client receives both new access token and refresh token

## Implementation Steps

### Step 1: Update Auth Controller
**File**: `/src/modules/auth/auth.controller.ts`  
**Method**: `refreshToken` (lines 194-255)

**Changes Required:**
1. Capture the input refresh token from the request
2. Include the refresh token in the response data

**Code Changes:**
```typescript
// Around line 197 - capture the refresh token
const input = refreshTokenSchema.parse(request.body) as RefreshTokenInput;
const originalRefreshToken = input.refresh_token;

// Around line 227-234 - update response to include refresh_token
reply.send({
  success: true,
  message: 'Token refreshed successfully',
  data: {
    access_token: accessToken,
    refresh_token: originalRefreshToken, // Add this line
    expires_in: expiresInSeconds,
  },
});
```

### Step 2: Update Response Schemas
**File**: `/src/modules/auth/auth.schema.ts`  
**Schema**: `refreshResponseSchema` (lines 81-84)

**Changes Required:**
```typescript
export const refreshResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(), // Add this line
  expires_in: z.number(),
});
```

### Step 3: Update Route Response Schema
**File**: `/src/modules/auth/auth.routes.ts`  
**Route**: `POST /refresh` (lines 178-227)

**Changes Required:**
```typescript
// Around lines 200-206 - update response schema
data: {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    refresh_token: { type: 'string' }, // Add this line
    expires_in: { type: 'number' }
  }
},
```

### Step 4: Update Test Interfaces and Assertions
**File**: `/src/modules/auth/auth.test.ts`  
**Interface**: `RefreshTokenData` (around line where it's defined)

**Changes Required:**
```typescript
interface RefreshTokenData {
  access_token: string;
  refresh_token: string; // Add this line
}
```

**Test Updates:**
```typescript
// In the refresh token test (around line with refresh token test)
const { success, data } = response.json<ApiResponse<RefreshTokenData>>();
expect(success).toBe(true);
expect(data.access_token).toBeDefined();
expect(data.refresh_token).toBeDefined(); // Add this assertion
expect(data.refresh_token).toBe(result.refreshToken); // Verify same token
```

## Testing Strategy

### Unit Tests
1. **Refresh Token Endpoint Test**: Verify response includes `refresh_token` field
2. **Schema Validation**: Ensure new schema validates correctly
3. **Backward Compatibility**: Verify existing functionality still works

### Integration Tests
1. **Full Auth Flow**: Register → Login → Refresh → Use New Token
2. **Multiple Refresh**: Verify same refresh token works multiple times
3. **Client Compatibility**: Ensure Flutter client can access `data['refresh_token']`

### Test Commands
```bash
# Run auth module tests
pnpm test src/modules/auth/auth.test.ts

# Run all tests
pnpm test

# Run specific test pattern
pnpm test --grep "refresh token"
```

## Security Considerations

### Option A Security Analysis
- **Risk**: Refresh tokens don't rotate (potential for longer exposure)
- **Mitigation**: Current 7-day expiration limit still applies
- **Trade-off**: Accepted for simplicity and compatibility

### Validation
- Input validation remains unchanged (refresh token required)
- Token validation logic unchanged (expiration, database lookup)
- No new security vulnerabilities introduced

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing clients | High | Low | Maintain backward compatibility |
| Test failures | Medium | Medium | Update all relevant test cases |
| Schema validation errors | Medium | Low | Update all schema definitions |
| Client still can't access field | High | Low | Test with actual Flutter client pattern |

## TODO Checklist

### Implementation Tasks
- [ ] **Step 1**: Update AuthController.refreshToken method to include refresh_token
- [ ] **Step 2**: Update refreshResponseSchema in auth.schema.ts  
- [ ] **Step 3**: Update route response schema in auth.routes.ts
- [ ] **Step 4**: Update RefreshTokenData interface in auth.test.ts
- [ ] **Step 5**: Add test assertions for refresh_token field

### Validation Tasks
- [ ] **Test 1**: Run auth module tests and verify they pass
- [ ] **Test 2**: Run full test suite to ensure no regressions  
- [ ] **Test 3**: Manual test with actual refresh token request
- [ ] **Test 4**: Verify response matches expected JSON structure
- [ ] **Test 5**: Confirm client can access `data['refresh_token']`

### Quality Assurance
- [ ] **Code Review**: Review all changes for correctness
- [ ] **Schema Validation**: Ensure all schemas are consistent
- [ ] **Documentation**: Update API documentation if needed
- [ ] **Backward Compatibility**: Confirm no breaking changes

### Deployment Preparation
- [ ] **Staging Test**: Deploy to staging and test with client
- [ ] **Performance Check**: Verify no performance degradation
- [ ] **Rollback Plan**: Prepare rollback if issues arise

## File Modification Summary

| File | Lines | Type | Description |
|------|-------|------|-------------|
| `auth.controller.ts` | 194-255 | Logic | Add refresh_token to response |
| `auth.schema.ts` | 81-84 | Schema | Update refreshResponseSchema |
| `auth.routes.ts` | 200-206 | Schema | Update route response schema |
| `auth.test.ts` | Interface + Test | Test | Update interface and assertions |

## Success Criteria

✅ **Functional Requirements**
- Refresh token API returns `refresh_token` field
- Field contains the same refresh token sent in request
- All existing functionality continues to work

✅ **Technical Requirements**  
- All tests pass
- No TypeScript compilation errors
- Schema validation works correctly
- No performance impact

✅ **Client Compatibility**
- Client can successfully access `data['refresh_token']`
- Flutter app refresh token flow works end-to-end

---

**Implementation Ready**: This plan provides specific file modifications, code changes, and validation steps. Ready for implementation by backend-developer agent.