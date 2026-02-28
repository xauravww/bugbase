---
phase: 01-verification-toggle
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/db/schema.ts
  - src/app/api/issues/[id]/verify/route.ts
  - src/app/api/issues/route.ts
autonomous: true

must_haves:
  truths:
    - "Issues have isVerified boolean field persisted in database"
    - "Verification status does not change when issue status is modified"
    - "Only project QA or admin members can toggle verification"
    - "API endpoint correctly toggles isVerified field"
  artifacts:
    - path: "src/lib/db/schema.ts"
      provides: "Issue schema with isVerified boolean field"
      contains: "isVerified"
    - path: "src/app/api/issues/[id]/verify/route.ts"
      provides: "Toggle verification using isVerified field"
      exports: ["POST"]
  key_links:
    - from: "src/app/api/issues/[id]/verify/route.ts"
      to: "src/lib/db/schema.ts"
      via: "update isVerified field"
      pattern: "isVerified.*boolean"
---

<objective>
Add isVerified boolean field to issues table and update verify API to use it independently from status. Restrict verification toggle to project QA or admin members only.

Purpose: Implement a separate verified toggle that persists independently of issue status, as required by VERIFY-02.
Output: Database schema change, updated verify API endpoint
</objective>

<execution_context>
@/home/saurav/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/saurav/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@src/lib/db/schema.ts
@src/app/api/issues/[id]/verify/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add isVerified boolean field to issues schema</name>
  <files>src/lib/db/schema.ts</files>
  <action>
    Add `isVerified` boolean field to the issues table in schema.ts. Use drizzle sqlite integer mode for boolean.
    - Field: isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false)
    - Add index for efficient queries: isVerifiedIdx: index("idx_issues_verified").on(table.isVerified)
    - This field persists independently from the status field per user decision.
  </action>
  <verify>
    - grep "isVerified" src/lib/db/schema.ts returns the new field definition
    - Run database migration: npx drizzle-kit push
  </verify>
  <done>
    Issues table has isVerified boolean column, defaults to false, queryable by index
  </done>
</task>

<task type="auto">
  <name>Task 2: Update verify API to use isVerified and restrict to QA/admin</name>
  <files>src/app/api/issues/[id]/verify/route.ts</files>
  <action>
    Rewrite the POST handler in verify/route.ts to:
    1. Use isVerified boolean field on issues table instead of status change
    2. Remove the status change logic (lines 86-115 in original - should NOT change status anymore)
    3. Restrict to project QA or admin members only:
       - Check if user is Admin role OR has project membership with role "qa" or "admin"
       - Reject if user is only Developer, Member, or Viewer
    4. Log activity for verification toggle
    5. Return { isVerified: boolean } in response
  </action>
  <verify>
    - Verify: curl -X POST /api/issues/1/verify returns 200 with {isVerified: true/false}
    - Verify: Status does NOT change when verification is toggled
    - Verify: Non-QA/non-admin user gets 403 Forbidden
  </verify>
  <done>
    API toggles isVerified field without touching status, restricted to QA/admin only
  </done>
</task>

<task type="auto">
  <name>Task 3: Ensure issue list API includes isVerified field</name>
  <files>src/app/api/issues/route.ts</files>
  <action>
    Check that GET /api/issues returns isVerified field in issue objects. If not present in the query/select, add it to ensure UI can display verification status.
  </action>
  <verify>
    - Verify API response includes isVerified field for each issue
  </verify>
  <done>
    Issue list API returns isVerified for each issue
  </done>
</task>

</tasks>

<verification>
- [ ] isVerified field exists in database
- [ ] Verify endpoint toggles isVerified without changing status
- [ ] Only QA or admin project members can verify
- [ ] Issue list API returns isVerified field
</verification>

<success_criteria>
Database has isVerified boolean on issues, verify API uses it independently from status, authorization restricts to QA/admin only
</success_criteria>

<output>
After completion, create `.planning/phases/01-verification-toggle/01-verification-toggle-01-SUMMARY.md`
</output>
