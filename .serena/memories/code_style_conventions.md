# DevPocket Fastify API - Code Style and Conventions

## Code Style Guidelines

### General Principles
- Prioritize functionality and readability over strict style enforcement
- Use reasonable code quality standards that enhance developer productivity
- Don't be too harsh on code linting
- Use try-catch error handling consistently

### TypeScript Configuration
- **Strict mode enabled**: noImplicitAny, strictNullChecks, strictFunctionTypes
- **ES2022 target** with ESNext modules
- **Path aliases**: Use `@/` for src root, `@/modules/`, `@/shared/`, etc.
- **Type safety**: Avoid `any` types, use proper type definitions
- **Null safety**: Avoid non-null assertions (`!`), use proper null checking

### Naming Conventions
- **Files**: kebab-case (e.g., `auth.service.ts`, `terminal.controller.ts`)
- **Directories**: kebab-case (e.g., `auth/`, `terminal/`)
- **Variables/Functions**: camelCase (e.g., `userService`, `validateToken`)
- **Classes**: PascalCase (e.g., `AuthService`, `TerminalController`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`, `DATABASE_URL`)
- **Interfaces**: PascalCase with descriptive names (e.g., `UserPayload`, `TerminalConfig`)

### File Organization
```
src/modules/[feature]/
├── [feature].controller.ts    # Route handlers
├── [feature].service.ts       # Business logic
├── [feature].routes.ts        # Route definitions
├── [feature].schema.ts        # Zod schemas
├── [feature].middleware.ts    # Feature-specific middleware
├── [feature].test.ts          # Tests
└── index.ts                   # Module exports
```

### ESLint Rules (Key Ones)
- **no-unused-vars**: Warn (allow `_` prefix for ignored params)
- **no-explicit-any**: Warn (should be avoided)
- **prefer-const**: Error (use const when possible)
- **no-console**: Warn (use logger instead)
- **object-shorthand**: Error (use ES6 shorthand)

### Function Patterns
```typescript
// Preferred: Arrow functions with explicit return types
export const validateUser = async (id: string): Promise<User | null> => {
  try {
    return await userService.findById(id);
  } catch (error) {
    logger.error('Failed to validate user', { id, error });
    throw error;
  }
};

// Controller pattern
export const getUserController = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> => {
  // Implementation
};
```

### Error Handling Pattern
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { context, error });
  throw new Error('Descriptive error message');
}
```

### Import Organization
1. Node.js built-ins
2. Third-party packages
3. Local imports (using path aliases)
4. Relative imports

### Testing Conventions
- **Test files**: `*.test.ts` in same directory as source
- **Test names**: Descriptive with "should" statements
- **Test structure**: Arrange-Act-Assert pattern
- **Mocking**: Use Vitest mocking features
- **Database**: Use test database with proper isolation

## Documentation Standards
- **README**: Update when adding major features
- **Comments**: Explain why, not what
- **JSDoc**: Use for public API functions
- **Type annotations**: Explicit for public interfaces

## Git Conventions
- **Commit format**: Conventional commits (feat:, fix:, docs:, etc.)
- **Branch naming**: feature/description, fix/description, chore/description
- **No AI signatures**: Clean, professional commit messages
- **Focused commits**: One logical change per commit