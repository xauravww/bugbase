# Codebase Structure

**Analysis Date:** 2026-02-28

## Directory Layout

```
bugbase/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Auth route group
│   │   ├── (dashboard)/     # Protected dashboard routes
│   │   ├── api/            # API routes
│   │   └── layout.tsx       # Root layout
│   ├── components/          # React components
│   │   ├── layout/          # Layout components
│   │   └── ui/              # Reusable UI components
│   ├── contexts/            # React contexts
│   ├── constants/           # Constants and enums
│   ├── lib/                 # Library code
│   │   ├── auth/            # Authentication utilities
│   │   ├── db/              # Database layer
│   │   └── utils/           # Utility functions
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
├── drizzle.config.ts        # Drizzle config
├── next.config.ts          # Next.js config
├── tsconfig.json            # TypeScript config
└── package.json             # Dependencies
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router pages and API routes
- Contains: Route handlers, layouts, pages
- Key files: `layout.tsx`, `page.tsx`, `globals.css`

**src/app/(auth):**
- Purpose: Authentication pages (login, register)
- Contains: Login and register page components
- Pattern: Route group - doesn't affect URL

**src/app/(dashboard):**
- Purpose: Protected application pages
- Contains: Dashboard, projects, issues, team, settings
- Pattern: Route group with shared layout

**src/app/api:**
- Purpose: REST API endpoints
- Contains: Route handlers organized by resource
- Key files: `auth/`, `users/`, `projects/`, `issues/`

**src/components/ui:**
- Purpose: Reusable UI components
- Contains: Button, Input, Select, Modal, Avatar, Badge, Loader
- Pattern: Barrel file at `index.ts`

**src/components/layout:**
- Purpose: Layout-specific components
- Contains: Sidebar, Header
- Pattern: Auth-aware navigation

**src/contexts:**
- Purpose: React context providers
- Contains: AuthContext for authentication state
- Key files: `AuthContext.tsx`

**src/constants:**
- Purpose: Constants and enumerated values
- Contains: Roles, priorities, statuses
- Key files: `roles.ts`, `priorities.ts`, `statuses.ts`

**src/lib/auth:**
- Purpose: Authentication utilities
- Contains: JWT, password hashing, middleware
- Key files: `jwt.ts`, `hash.ts`, `middleware.ts`

**src/lib/db:**
- Purpose: Database layer
- Contains: Schema definitions, DB instance
- Key files: `schema.ts`, `index.ts`

**src/lib/utils:**
- Purpose: Utility functions
- Contains: Helper functions (cn for classnames)
- Key files: `cn.ts`

**src/types:**
- Purpose: TypeScript type definitions
- Contains: Domain types (User, Project, Issue)
- Pattern: Separate file per domain

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Root redirect to login
- `src/app/layout.tsx`: Root layout with AuthProvider
- `src/app/(dashboard)/layout.tsx`: Protected layout with sidebar

**Configuration:**
- `drizzle.config.ts`: Database configuration
- `next.config.ts`: Next.js configuration
- `tsconfig.json`: TypeScript configuration

**Core Logic:**
- `src/lib/db/schema.ts`: Database schema with all tables and relations
- `src/lib/auth/middleware.ts`: Auth middleware for API routes
- `src/contexts/AuthContext.tsx`: Client-side auth state

**Testing:**
- No test directory found - tests co-located or not present

## Naming Conventions

**Files:**
- PascalCase for components: `Button.tsx`, `Sidebar.tsx`
- camelCase for utilities: `cn.ts`, `jwt.ts`
- kebab-case for route segments: `activity-logs`, `email-templates`

**Functions:**
- camelCase: `getAuthUser`, `verifyToken`, `withAuth`

**Variables:**
- camelCase: `authUser`, `userToken`, `projectId`

**Types/Interfaces:**
- PascalCase: `User`, `Project`, `Issue`

**Constants:**
- SCREAMING_SCREAMING for values: `USER_ROLES`, `ISSUE_STATUSES`
- camelCase for permission keys: `manageUsers`, `createProjects`

**Directories:**
- camelCase: `src/lib/auth`, `src/components/ui`
- kebab-case: API route directories (e.g., `email-templates`)

## Where to Add New Code

**New Feature (API endpoint):**
- Primary code: `src/app/api/<resource>/route.ts`
- Follow REST patterns: GET/POST/PUT/DELETE

**New Dashboard Page:**
- Primary code: `src/app/(dashboard)/<feature>/page.tsx`
- Layout already handled by parent layout

**New UI Component:**
- Implementation: `src/components/ui/<ComponentName>.tsx`
- Export from: `src/components/ui/index.ts`

**New Database Table:**
- Schema: `src/lib/db/schema.ts` - add new table definition
- Types: `src/types/<entity>.ts` - add type definition

**New Constant:**
- Constants: `src/constants/<category>.ts`

**New Utility:**
- Utilities: `src/lib/utils/<function>.ts`

## Special Directories

**(auth) and (dashboard):**
- Purpose: Route groups for shared layouts
- Generated: No - defined in code
- Committed: Yes - part of Next.js routing

**src/app/api:**
- Purpose: API route handlers
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-02-28*
