# Codebase Concerns

**Analysis Date:** 2026-02-28

## Tech Debt

**Hardcoded JWT Secret:**
- Issue: Default JWT secret fallback is hardcoded in `src/lib/auth/jwt.ts` line 4
- Files: `src/lib/auth/jwt.ts`
- Impact: Application vulnerable if JWT_SECRET env var not set in production
- Fix approach: Throw error if JWT_SECRET is missing, never use fallback in production

**Minimal Next.js Configuration:**
- Issue: `next.config.ts` has no security headers, image optimization, or runtime configuration
- Files: `next.config.ts`
- Impact: Missing security headers (CSP, X-Frame-Options), no runtime restrictions
- Fix approach: Add security headers, configure image domains for ImgBB

**Large React Page Components:**
- Issue: Issue detail page is 923 lines of code in a single file
- Files: `src/app/(dashboard)/issues/[id]/page.tsx`
- Impact: Difficult to maintain, test, and reason about
- Fix approach: Split into smaller components (CommentSection, AttachmentList, ActivityFeed, IssueMetadata)

**SQL Query Inefficiencies:**
- Issue: Project list endpoint uses N+1 queries for issue counts (lines 81-93 in `src/app/api/projects/route.ts`)
- Files: `src/app/api/projects/route.ts`
- Impact: Performance degrades linearly with project count
- Fix approach: Use single aggregated query with COUNT and GROUP BY

**Activity Log Schema Mismatch:**
- Issue: Activity log table references are optional but queries don't handle null properly
- Files: `src/lib/db/schema.ts`, `src/app/api/dashboard/route.ts`
- Impact: Runtime errors when activity.issue is undefined
- Fix approach: Add null checks or use left joins properly

## Known Bugs

**SQL Injection via Search Parameters:**
- Symptoms: Search queries use string interpolation directly in LIKE clauses
- Files: `src/app/api/projects/route.ts` (lines 52-53), `src/app/api/issues/route.ts` (lines 80-82)
- Trigger: Search with special SQL characters
- Workaround: Sanitize search input or use parameterized queries through drizzle

**JWT Token Not Validated for Expiration Properly:**
- Symptoms: Token may be accepted past expiration in edge cases
- Files: `src/lib/auth/jwt.ts`
- Trigger: Clock skew or misconfiguration
- Workaround: Ensure jwt.verify is called correctly (currently appears correct, but default secret weakens security)

**Image Upload Missing File Type Validation:**
- Symptoms: Any file could be uploaded via `/api/upload`
- Files: `src/app/api/upload/route.ts`
- Trigger: Upload non-image file with image content-type header
- Workaround: Validate file type from actual content, not just form field

## Security Considerations

**Missing Environment Validation:**
- Risk: Application starts with weak defaults for critical secrets
- Files: `src/lib/auth/jwt.ts`, `drizzle.config.ts`
- Current mitigation: None
- Recommendations: Add startup validation that fails if required env vars are missing

**No Rate Limiting on Authentication Endpoints:**
- Risk: Brute force attacks on login/register endpoints
- Files: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`
- Current mitigation: None
- Recommendations: Add rate limiting middleware or use external service

**Role-Based Access Control Inconsistency:**
- Risk: Some endpoints check role at project level, others at global level
- Files: `src/app/api/issues/[id]/route.ts`, `src/app/api/projects/route.ts`
- Current mitigation: Mixed approach - project membership OR admin role
- Recommendations: Standardize authorization pattern across all endpoints

**No CSRF Protection for API Routes:**
- Risk: Cross-site request forgery on state-changing operations
- Files: All API routes
- Current mitigation: Next.js provides some protection
- Recommendations: Add explicit CSRF token validation for sensitive operations

## Performance Bottlenecks

**Dashboard Query Performance:**
- Problem: Dashboard loads all issues into memory then filters
- Files: `src/app/api/dashboard/route.ts` (lines 28-41)
- Cause: Fetches all project issues then filters in JavaScript
- Improvement path: Use SQL WHERE clauses with aggregations

**Project Issue Count N+1:**
- Problem: Each project makes separate query for issue count
- Files: `src/app/api/projects/route.ts` (lines 81-93)
- Cause: Loop with await inside
- Improvement path: Single query with JOIN and GROUP BY

**Missing Database Indexes:**
- Problem: No explicit indexes on frequently queried columns
- Files: `src/lib/db/schema.ts`
- Impact: Queries slow as data grows
- Improvement path: Add indexes on projectId, userId, status, createdAt

## Fragile Areas

**Authentication Middleware:**
- Files: `src/lib/auth/middleware.ts`
- Why fragile: Type casting user onto request object (line 33) is not type-safe
- Safe modification: Use proper Next.js request extension pattern
- Test coverage: None

**Schema Relations:**
- Files: `src/lib/db/schema.ts` (line 237)
- Why fragile: Empty relations object for emailTemplates
- Safe modification: Either remove unused table or add proper relations
- Test coverage: None

**Date Handling:**
- Files: Multiple API routes
- Why fragile: Inconsistent use of string vs Date vs timestamp
- Safe modification: Standardize on ISO strings throughout API
- Test coverage: None

## Scaling Limits

**SQLite Database:**
- Current capacity: Single file, local storage only
- Limit: Single writer, file-based, no horizontal scaling
- Scaling path: Migrate to PostgreSQL with connection pooling

**File Storage:**
- Current capacity: External ImgBB service
- Limit: Third-party dependency, storage costs
- Scaling path: Implement own file storage (S3, etc.)

**In-Memory Filtering:**
- Current capacity: Small to medium datasets
- Limit: Loading full tables into memory for filtering
- Scaling path: Push filtering to database queries

## Dependencies at Risk

**Zod v4.3.6:**
- Risk: Using prerelease or beta version (v4)
- Impact: Breaking changes may appear in minor updates
- Migration plan: Pin to specific version, test thoroughly on updates

**Better-sqlite3:**
- Risk: Native Node module requires compilation
- Impact: Build failures on some platforms, deployment complexity
- Migration plan: Consider pure JavaScript SQLite (sql.js) or switch to PostgreSQL

**Next.js 16.1.6:**
- Risk: Very new version, may have undiscovered bugs
- Impact: Stability concerns in production
- Migration plan: Monitor for patches, test thoroughly

## Missing Critical Features

**No Test Suite:**
- Problem: Zero test files in codebase
- Blocks: Safe refactoring, regression detection, confidence in changes
- Priority: High

**Email Templates Unused:**
- Problem: Database schema has email_templates table but no sending logic
- Blocks: User notifications, password reset, alerts
- Priority: Medium

**No Audit Logging for Security Events:**
- Problem: No logging of login attempts, permission denials, data exports
- Blocks: Security monitoring, compliance, incident investigation
- Priority: High

## Test Coverage Gaps

**Untested Authentication:**
- What's not tested: Login, register, token validation, role checks
- Files: `src/lib/auth/*`, `src/app/api/auth/*`
- Risk: Auth bugs could allow unauthorized access
- Priority: High

**Untested API Endpoints:**
- What's not tested: All 20+ API routes
- Files: `src/app/api/*`
- Risk: Silent failures, incorrect error handling
- Priority: High

**Untested Database Operations:**
- What's not tested: All CRUD via drizzle-orm
- Files: `src/lib/db/*`
- Risk: Data corruption, cascade delete issues
- Priority: High

---

*Concerns audit: 2026-02-28*
