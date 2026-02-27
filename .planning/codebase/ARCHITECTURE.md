# Architecture

**Analysis Date:** 2026-02-28

## Pattern Overview

**Overall:** RESTful API with Next.js App Router

**Key Characteristics:**
- Route-based API structure following Next.js App Router conventions
- JWT-based stateless authentication with role-based access control (RBAC)
- Drizzle ORM with SQLite for data persistence
- Server-side API routes with manual auth middleware (not using NextAuth)
- Client-side React Context for auth state management
- Zod for request validation in API routes

## Layers

**API Layer (Next.js Route Handlers):**
- Purpose: Handle HTTP requests and responses
- Location: `src/app/api/**`
- Contains: REST endpoint handlers
- Depends on: DB layer, auth utilities
- Used by: Frontend client (via fetch)

**Data Access Layer (Drizzle ORM):**
- Purpose: Database queries and schema definitions
- Location: `src/lib/db/`
- Contains: Schema definitions, query builders
- Depends on: SQLite database
- Used by: API layer

**Authentication Layer:**
- Purpose: JWT token management, password hashing, auth middleware
- Location: `src/lib/auth/`
- Contains: JWT utilities, password utilities, auth middleware
- Depends on: jsonwebtoken, bcryptjs
- Used by: API layer, contexts

**Type Layer:**
- Purpose: TypeScript type definitions
- Location: `src/types/`, `src/constants/`
- Contains: Domain types, constants (roles, statuses, priorities)
- Used by: All layers

**UI Layer (React Components):**
- Purpose: Render user interfaces
- Location: `src/app/**`, `src/components/**`
- Contains: Pages, layouts, UI components
- Depends on: Contexts, API layer (via fetch)
- Used by: Browser

**State/Context Layer:**
- Purpose: Client-side authentication state
- Location: `src/contexts/`
- Contains: AuthContext for login/logout/user state
- Used by: UI layer

## Data Flow

**Authentication Flow:**

1. User submits credentials to `/api/auth/login`
2. API validates credentials against DB
3. On success, JWT token generated and returned
4. Client stores token in localStorage
5. Subsequent requests include `Authorization: Bearer <token>` header
6. Auth middleware validates token on each protected request

**Issue Creation Flow:**

1. User submits issue form in UI
2. UI calls `/api/issues` (POST) with auth header
3. API middleware validates JWT
4. Zod validates request body
5. API checks project membership
6. Drizzle inserts issue to database
7. Issue assignees and verifiers created via join tables
8. Activity log entry created
9. Issue returned to client

**Protected Resource Access:**

1. Client request includes JWT in Authorization header
2. API route calls `getAuthUser(request)`
3. JWT verified, payload extracted
4. Role-based permission check (optional)
5. Resource fetched or modified via Drizzle
6. Response returned

## Key Abstractions

**Database Tables (Schema):**
- Purpose: Define data structure
- Examples: `src/lib/db/schema.ts`
- Pattern: Drizzle sqliteTable with relations

**Auth Middleware:**
- Purpose: Authentication and authorization decorators
- Location: `src/lib/auth/middleware.ts`
- Pattern: Higher-order functions (`withAuth`, `withRole`, `withPermission`)

**Type Definitions:**
- Purpose: TypeScript interfaces for domain entities
- Location: `src/types/*.ts`
- Pattern: Separate files per domain (user, project, issue)

**Constants:**
- Purpose: Enumerated values and role permissions
- Location: `src/constants/*.ts`
- Pattern: Const objects with TypeScript types

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Any page load
- Responsibilities: AuthProvider wrapper, metadata

**Auth Layout:**
- Location: `src/app/(auth)/layout.tsx`
- Triggers: `/login`, `/register`
- Responsibilities: Centered card container

**Dashboard Layout:**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: Any protected page
- Responsibilities: Auth check, sidebar navigation

**API Routes:**
- Base: `src/app/api/`
- Auth: `src/app/api/auth/login`, `register`, `me`
- Resources: `src/app/api/users`, `projects`, `issues`

## Error Handling

**Strategy:** Consistent JSON error responses with error codes

**Patterns:**
```typescript
// Validation errors
return NextResponse.json(
  { error: "Validation message", code: "VALIDATION_ERROR" },
  { status: 400 }
);

// Auth errors
return NextResponse.json(
  { error: "Unauthorized", code: "UNAUTHORIZED" },
  { status: 401 }
);

// Permission errors
return NextResponse.json(
  { error: "Forbidden", code: "FORBIDDEN" },
  { status: 403 }
);

// Server errors
return NextResponse.json(
  { error: "Internal server error", code: "INTERNAL_ERROR" },
  { status: 500 }
);
```

## Cross-Cutting Concerns

**Logging:** Console.log in API routes for debugging, no structured logging

**Validation:** Zod schemas in API route files for request body validation

**Authentication:** JWT with 7-day expiration, stored in localStorage (client)

**Authorization:** Role-based permissions defined in constants, checked in API middleware

---

*Architecture analysis: 2026-02-28*
