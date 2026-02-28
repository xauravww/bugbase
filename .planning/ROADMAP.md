# Roadmap: Bugbase

## Overview

A bug tracking system built with Next.js, TypeScript, Drizzle ORM, and SQLite. This roadmap addresses two key feature requests: (1) separating the "verified" toggle from normal issue status, and (2) restricting issue assignee/verifier assignment to only project members.

## Phases

- [ ] **Phase 1: Verification Toggle** - Separate verified status from normal issue status
- [ ] **Phase 2: Project Member Assignment** - Restrict assignments to project members only

## Phase Details

### Phase 1: Verification Toggle
**Goal**: Issues have a separate verified toggle, independent of the normal status workflow
**Depends on**: Nothing (first phase)
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03
**Success Criteria** (what must be TRUE):
  1. Each issue has a visible verified toggle/checkbox in the UI
  2. Verification status persists independently of issue status (verified toggle does not change when status changes)
  3. Only authorized users (project QA or admin) can toggle verification
  4. Verified toggle is displayed alongside status in issue list and detail views
**Plans**: 2 plans in 2 waves
  - [ ] 01-verification-toggle-01-PLAN.md — Database schema + API changes
  - [ ] 01-verification-toggle-02-PLAN.md — UI toggle and indicator

### Phase 2: Project Member Assignment
**Goal**: Issue assignees and verifiers can only be selected from project members
**Depends on**: Phase 1
**Requirements**: ASSIGN-01, ASSIGN-02, ASSIGN-03
**Success Criteria** (what must be TRUE):
  1. When assigning users to an issue, only project members appear in the selection dropdown
  2. Verifier selection restricted to project members with QA role (or all project members - need clarification)
  3. API rejects assignment attempts for non-project members with appropriate error
  4. Existing assignments to non-project members are migrated or handled gracefully
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Verification Toggle | 0/2 | Planned | - |
| 2. Project Member Assignment | 0/TBD | Not started | - |
