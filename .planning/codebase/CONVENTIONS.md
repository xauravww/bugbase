# Coding Conventions

**Analysis Date:** 2026-02-28

## Naming Patterns

**Files:**
- TypeScript files: `camelCase` (e.g., `jwt.ts`, `middleware.ts`, `hash.ts`)
- React components: `PascalCase` (e.g., `Button.tsx`, `Header.tsx`, `Modal.tsx`)
- Index files: `index.ts` / `index.tsx` for barrel exports

**Directories:**
- `camelCase` throughout (e.g., `lib/auth`, `lib/utils`, `components/ui`, `app/api`)

**Types & Interfaces:**
- `PascalCase` (e.g., `UserRole`, `Issue`, `JWTPayload`, `AuthContextType`)
- Suffix `Input` for creation types (e.g., `CreateIssueInput`)
- Suffix `WithRelations` for joined types (e.g., `IssueWithRelations`)

**Database Schema:**
- Table names: `snake_case` (e.g., `users`, `project_members`)
- Column names: `snake_case` (e.g., `passwordHash`, `createdAt`, `projectId`)
- Exports: `camelCase` (e.g., `users`, `projects`, `issues`)

**Constants:**
- Object values: `UPPER_SNAKE_CASE` (e.g., `USER_ROLES.ADMIN`, `ISSUE_STATUSES.OPEN`)
- Type exports: `PascalCase` (e.g., `type UserRole`)
- Enum-like constants: Capitalized (e.g., `ADMIN`, `DEVELOPER`)

## Code Style

**Formatting:**
- Tool: ESLint with `eslint-config-next` (Next.js recommended)
- Config file: `eslint.config.mjs`
- Strict mode: Enabled in `tsconfig.json`

**Linting:**
- ESLint extends Next.js core-web-vitals and TypeScript configs
- Default Next.js rules apply

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Usage: `import { db } from "@/lib/db"` (absolute imports)

**TypeScript Configuration:**
- Target: ES2017
- Strict mode: enabled
- Module resolution: bundler
- JSX: react-jsx

## Import Organization

**Order (observed pattern):**
1. External libraries (e.g., `next`, `react`, `zod`)
2. Path alias imports (`@/`)
3. Relative imports (e.g., `./`, `../`)

**Example from `src/app/api/auth/login/route.ts`:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword, signToken } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { USER_ROLES } from "@/constants/roles";
```

**Barrel Files:**
- Used for clean exports (e.g., `src/lib/auth/index.ts`, `src/lib/utils/cn.ts`)
- Index files re-export from submodules

## Error Handling

**API Routes:**
- Try-catch blocks wrapping async operations
- Consistent error response format:
```typescript
{ error: "Message", code: "ERROR_CODE" }
```
- Error codes: `UPPER_SNAKE_CASE` (e.g., `UNAUTHORIZED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`)

**Validation:**
- Uses Zod for request body validation
- Pattern: `schema.safeParse(body)` returns `{ success: boolean, data?: ..., error?: ... }`
- Returns first validation error message on failure

**Authentication Errors:**
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)

**Error Examples:**
```typescript
// Validation error
return NextResponse.json(
  { error: validation.error.issues[0].message, code: "VALIDATION_ERROR" },
  { status: 400 }
);

// Auth error
return NextResponse.json(
  { error: "Unauthorized", code: "UNAUTHORIZED" },
  { status: 401 }
);

// Server error
return NextResponse.json(
  { error: "Internal server error", code: "INTERNAL_ERROR" },
  { status: 500 }
);
```

## Logging

**Framework:** `console` (no structured logger)

**Patterns:**
- Error logging in catch blocks: `console.error("Operation error:", error)`
- No structured logging or log levels

## Comments

**When to Comment:**
- No explicit guidelines enforced
- Minimal inline comments observed
- Code generally self-explanatory

**JSDoc/TSDoc:**
- Not used in codebase

## Function Design

**Parameters:**
- Typed explicitly (no `any`)
- Use interfaces for complex objects
- Optional parameters with `?` suffix

**Return Values:**
- Explicit return types for functions
- `null` returned on failure (e.g., token verification)

**Async Functions:**
- Use `async/await` consistently
- Return `Promise<T>` for async functions

## React Component Patterns

**Functional Components:**
- Use `forwardRef` for components needing ref forwarding
- Display name set explicitly: `Button.displayName = "Button"`

**Props:**
- Extend HTML attributes with `ButtonHTMLAttributes<HTMLButtonElement>`
- Use `type ...Attributes` pattern

**Context:**
- Context created with `createContext<T | undefined>(undefined)`
- Custom hook throws error if used outside provider
- Example: `useAuth` hook in `src/contexts/AuthContext.tsx`

## Module Design

**Exports:**
- Named exports preferred
- Barrel files (`index.ts`) for grouped exports

**Auth Module (`src/lib/auth/`):**
- `index.ts`: Barrel export
- `hash.ts`: Password hashing with bcrypt
- `jwt.ts`: JWT sign/verify utilities
- `middleware.ts`: Auth middleware (withAuth, withRole, withPermission)

---

*Convention analysis: 2026-02-28*
