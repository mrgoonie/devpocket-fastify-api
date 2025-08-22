# [Bug Fix] Flutter Registration API Contract Mismatch

**Date**: 2025-08-22  
**Type**: Bug Fix  
**Priority**: Critical  
**Context Tokens**: Flutter app shows "Registration error: type 'Null' is not a subtype of type 'String'" after successful backend registration due to API contract mismatch between frontend expectations and backend response structure.

## Executive Summary
Flutter client's registration flow fails with null type coercion error despite successful backend registration. The issue stems from a mismatch between the expected response structure in Flutter's `AuthResponse.fromJson()` model and the actual backend registration response format.

## Issue Analysis
### Symptoms
- [x] Flutter shows "Registration error: type 'Null' is not a subtype of type 'String'"
- [x] Backend registration succeeds (user created, database entries inserted)
- [x] API returns 201 status with success response
- [x] Flutter client fails to parse response

### Root Cause
API contract mismatch between Flutter client expectations and backend response format:

**Flutter expects** (AuthResponse.fromJson):
```json
{
  "user_id": "string",
  "token": "string", 
  "token_type": "string",
  "expires_in": number
}
```

**Backend provides** (registration endpoint):
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email for verification.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "string",
      "username": "string", 
      "email_verified": boolean,
      "created_at": "string",
      "updated_at": "string"
    }
  }
}
```

### Evidence
- **Files**: `/src/modules/auth/auth.controller.ts` (lines 47-51), `/docs/devpocket-flutter-integration.md` (lines 716-723)
- **Error Pattern**: `type 'Null' is not a subtype of type 'String'`
- **Affected Components**: Registration endpoint, Flutter AuthResponse model

## Context Links
- **Related Issues**: Flutter Create Account form submission error
- **Recent Changes**: No recent changes to auth endpoints
- **Dependencies**: Flutter app, Fastify backend authentication flow

## Solution Design
### Approach
Create separate response models for registration vs login flows. Registration should return user data structure that matches Flutter expectations, while login continues to return tokens.

### Changes Required
1. **auth.schema.ts** (`/src/modules/auth/auth.schema.ts`): Add RegistrationResponse schema
2. **auth.controller.ts** (`/src/modules/auth/auth.controller.ts`): Update registration response format
3. **Flutter docs** (`/docs/devpocket-flutter-integration.md`): Update client-side model expectations

### Testing Changes
- [x] Validate registration endpoint returns correct structure
- [ ] Test Flutter client can parse new response format
- [ ] Ensure login flow remains unchanged
- [ ] Verify no breaking changes to existing API consumers

## Implementation Steps

### Step 1: Update Auth Schema
**File**: `/src/modules/auth/auth.schema.ts`
- Add `RegistrationResponse` type and schema
- Include fields that Flutter client expects for registration flow

### Step 2: Modify Registration Controller Response  
**File**: `/src/modules/auth/auth.controller.ts`
- Update registration endpoint response structure
- Return user data in format compatible with Flutter expectations
- Maintain backward compatibility for success/message fields

### Step 3: Update Documentation
**File**: `/docs/devpocket-flutter-integration.md`  
- Document correct response structure for registration endpoint
- Update Flutter model recommendations

### Step 4: Run Tests
- Execute test suite to ensure no regressions
- Validate new response structure matches expectations

## Verification Plan
### Test Cases
- [ ] Registration with valid data returns correct response structure
- [ ] Flutter client can parse registration response without errors  
- [ ] Login flow continues to work with existing token structure
- [ ] Error responses maintain consistent format

### Rollback Plan
If the fix causes issues:
1. Revert commit: `git revert <commit-hash>`
2. Restore original response format in auth.controller.ts
3. Remove new schema definitions

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing API consumers | Medium | Maintain success/message fields for backward compatibility |
| Login flow affected by changes | Low | Only modify registration endpoint response |
| Flutter still can't parse response | Medium | Test response structure against Flutter model requirements |

## TODO Checklist
- [ ] Add RegistrationResponse schema to auth.schema.ts
- [ ] Update registration controller response format
- [ ] Update Flutter integration documentation
- [ ] Run full test suite and validate
- [ ] Test with actual Flutter client if available
- [ ] Code review and deploy