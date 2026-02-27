# External Integrations

**Analysis Date:** 2026-02-28

## APIs & External Services

**None detected** - This is a self-contained application with no external API integrations.

## Data Storage

**Databases:**
- SQLite (local file-based)
  - Driver: `better-sqlite3`
  - ORM: `drizzle-orm`
  - Connection: Local file path via `DATABASE_PATH` env var
  - Default location: `./bugbase.db`

**File Storage:**
- Local filesystem only
  - Attachment uploads stored in filesystem
  - Route: `src/app/api/upload/route.ts`

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `src/lib/auth/jwt.ts` - JWT token generation/verification
  - Hashing: `src/lib/auth/hash.ts` - bcryptjs for password hashing
  - Middleware: `src/lib/auth/middleware.ts` - Request authentication
  - Context: `src/contexts/AuthContext.tsx` - Client-side auth state
  - Routes: Login (`src/app/api/auth/login/route.ts`), Register (`src/app/api/auth/register/route.ts`)

**Session:**
- JWT tokens stored in HTTP-only cookies
- Token verification via `jsonwebtoken` package

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Bugsnag, or similar

**Logs:**
- Console logging only (standard `console.log/error`)
- No structured logging system

## CI/CD & Deployment

**Hosting:**
- Self-hosted (Node.js)
- No specific platform detected (could be Vercel, Railway, Fly.io, etc.)

**CI Pipeline:**
- Not detected - No GitHub Actions, CI services, or deployment configs

## Environment Configuration

**Required env vars:**
- `DATABASE_PATH` - SQLite database file path (optional, has default)

**Secrets location:**
- `.env.local` file (not read - contains sensitive configuration)

**Note:** Application uses custom authentication without external identity providers (no Auth0, Clerk, Supabase Auth, etc.)

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook endpoints

**Outgoing:**
- None detected - No outgoing webhooks to external services

---

*Integration audit: 2026-02-28*
