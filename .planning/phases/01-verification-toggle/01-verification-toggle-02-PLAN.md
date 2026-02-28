---
phase: 01-verification-toggle
plan: 02
type: execute
wave: 2
depends_on:
  - 01-verification-toggle-01
files_modified:
  - src/app/(dashboard)/issues/[id]/page.tsx
  - src/app/(dashboard)/issues/page.tsx
autonomous: true

must_haves:
  truths:
    - "Issue detail page shows verified toggle/checkbox visible to authorized users"
    - "Verified status displayed in issue list alongside status badge"
    - "Toggle button only visible to QA or admin members"
    - "Toggle updates isVerified via API without changing status"
  artifacts:
    - path: "src/app/(dashboard)/issues/[id]/page.tsx"
      provides: "Verified toggle button in issue detail sidebar"
      contains: "isVerified"
    - path: "src/app/(dashboard)/issues/page.tsx"
      provides: "Verified indicator in issue list rows"
      contains: "isVerified"
  key_links:
    - from: "src/app/(dashboard)/issues/[id]/page.tsx"
      to: "/api/issues/[id]/verify"
      via: "fetch POST to toggle"
      pattern: "fetch.*verify"
---

<objective>
Add verified toggle UI to issue detail page and verified indicator to issue list. Display toggle only for authorized QA/admin users.

Purpose: Make verified status visible and toggleable in UI per VERIFY-01 and VERIFY-03.
Output: Updated issue detail page with toggle, updated issue list with verified indicator
</objective>

<execution_context>
@/home/saurav/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/saurav/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@src/app/(dashboard)/issues/[id]/page.tsx
@src/app/(dashboard)/issues/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add verified toggle to issue detail page</name>
  <files>src/app/(dashboard)/issues/[id]/page.tsx</files>
  <action>
    Update the issue detail page to:
    1. Add isVerified to IssueDetail interface
    2. Replace the old verification logic (checking issue.verifications array) with the new isVerified boolean from the API response
    3. Update the canVerify logic: user must be Admin role OR project member with role "qa" or "admin" (not just non-Viewer)
    4. Update the verify button UI to show checked/unchecked state based on isVerified
    5. Show "Verified By" section based on isVerified being true (not based on status === "Verified")
    6. The toggle should call POST /api/issues/[id]/verify and update the isVerified state
  </action>
  <verify>
    - Verify: Issue detail shows verified toggle button for QA/admin users
    - Verify: Clicking toggle calls API and updates isVerified
    - Verify: Toggle button shows correct state based on isVerified field
    - Verify: "Verified By" section appears when isVerified is true
  </verify>
  <done>
    Issue detail page has working verified toggle for authorized QA/admin users
  </done>
</task>

<task type="auto">
  <name>Task 2: Add verified indicator to issue list</name>
  <files>src/app/(dashboard)/issues/page.tsx</files>
  <action>
    Update the issue list page to:
    1. Add isVerified to Issue interface
    2. Display verified indicator (checkmark icon or badge) next to or near the status badge in both mobile card and desktop table views
    3. The indicator should be visible but subtle (e.g., green checkmark next to status)
  </action>
  <verify>
    - Verify: Issue list shows verified indicator for issues where isVerified is true
    - Verify: Indicator displays correctly in both mobile and desktop views
  </verify>
  <done>
    Issue list displays verified status indicator for each issue
  </done>
</task>

</tasks>

<verification>
- [ ] Issue detail shows verified toggle for QA/admin users
- [ ] Toggle updates isVerified via API without changing status
- [ ] Issue list shows verified indicator
- [ ] UI correctly reflects isVerified state from API
</verification>

<success_criteria>
Verified toggle visible in issue detail, verified indicator in issue list, only QA/admin can toggle
</success_criteria>

<output>
After completion, create `.planning/phases/01-verification-toggle/01-verification-toggle-02-SUMMARY.md`
</output>
