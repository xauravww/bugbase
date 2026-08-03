// In-process router for remote MCP. Dispatches tool calls directly to
// imported Next.js route handlers — zero HTTP roundtrip. The handlers
// still see a real NextRequest with proper auth headers, so all
// permission checks continue to work.

import { NextRequest } from "next/server";

// ── Route handler imports (only the routes MCP tools actually use) ──

import { GET as authMe } from "@/app/api/auth/me/route";
import { GET as getProjects } from "@/app/api/projects/route";
import { GET as getProject } from "@/app/api/projects/[id]/route";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getTeamProgress } from "@/app/api/projects/[id]/team-progress/route";
import { POST as uploadImage } from "@/app/api/upload/route";

import { GET as getIssues, POST as createIssue } from "@/app/api/issues/route";
import { GET as getIssue, PUT as updateIssue, DELETE as deleteIssue } from "@/app/api/issues/[id]/route";
import { POST as setAssignees } from "@/app/api/issues/[id]/assignees/route";
import { GET as getComments, POST as addComment } from "@/app/api/issues/[id]/comments/route";
import { POST as addAttachment } from "@/app/api/issues/[id]/attachments/route";

import { GET as getTestCases, POST as createTestCase } from "@/app/api/projects/[id]/test-cases/route";
import { PATCH as updateTestCase } from "@/app/api/projects/[id]/test-cases/[testCaseId]/route";
import { POST as recordResult } from "@/app/api/projects/[id]/test-cases/[testCaseId]/results/route";

import { GET as getCategories, POST as createCategory } from "@/app/api/projects/[id]/categories/route";

import { GET as getLists, POST as createList } from "@/app/api/projects/[id]/lists/route";
import { GET as getTasks, POST as createTask } from "@/app/api/projects/[id]/lists/[listId]/tasks/route";
import { GET as getTask, PATCH as updateTask, DELETE as deleteTask } from "@/app/api/projects/[id]/lists/[listId]/tasks/[taskId]/route";
import { POST as createSubtask } from "@/app/api/projects/[id]/lists/[listId]/tasks/[taskId]/subtasks/route";
import { PATCH as updateSubtask } from "@/app/api/projects/[id]/lists/[listId]/tasks/[taskId]/subtasks/[subtaskId]/route";
import { POST as addChecklistItem } from "@/app/api/projects/[id]/lists/[listId]/tasks/[taskId]/subtasks/[subtaskId]/checklist/route";
import { PATCH as toggleChecklist } from "@/app/api/projects/[id]/lists/[listId]/tasks/[taskId]/subtasks/[subtaskId]/checklist/[itemId]/route";

import { GET as getTaskActivity } from "@/app/api/projects/[id]/task-activity/route";
import { GET as getActivityLogs } from "@/app/api/settings/activity-logs/route";
import { GET as getEmailTemplates } from "@/app/api/settings/email-templates/route";

// PM workspace (generic module CRUD + dashboard + users)
import { GET as pmList, POST as pmCreate } from "@/app/api/pm/[module]/route";
import { GET as pmGet, PATCH as pmUpdate, DELETE as pmDelete } from "@/app/api/pm/[module]/[id]/route";
import { GET as pmDashboard } from "@/app/api/pm/dashboard/route";
import { GET as pmUsers } from "@/app/api/pm/users/route";

// ── Route table ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx: any) => Promise<Response>;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  methods: Record<string, Handler>;
}

const ROUTES: Route[] = [
  // uploads
  { pattern: /^\/api\/upload$/, paramNames: [], methods: { POST: uploadImage } },

  // auth
  { pattern: /^\/api\/auth\/me$/, paramNames: [], methods: { GET: authMe } },

  // projects
  { pattern: /^\/api\/projects$/, paramNames: [], methods: { GET: getProjects } },
  { pattern: /^\/api\/projects\/(\d+)$/, paramNames: ["id"], methods: { GET: getProject } },

  // dashboard
  { pattern: /^\/api\/dashboard$/, paramNames: [], methods: { GET: getDashboard } },

  // team progress
  { pattern: /^\/api\/projects\/(\d+)\/team-progress$/, paramNames: ["id"], methods: { GET: getTeamProgress } },

  // issues
  { pattern: /^\/api\/issues$/, paramNames: [], methods: { GET: getIssues, POST: createIssue } },
  { pattern: /^\/api\/issues\/(\d+)$/, paramNames: ["id"], methods: { GET: getIssue, PUT: updateIssue, DELETE: deleteIssue } },
  { pattern: /^\/api\/issues\/(\d+)\/assignees$/, paramNames: ["id"], methods: { POST: setAssignees } },
  { pattern: /^\/api\/issues\/(\d+)\/comments$/, paramNames: ["id"], methods: { GET: getComments, POST: addComment } },
  { pattern: /^\/api\/issues\/(\d+)\/attachments$/, paramNames: ["id"], methods: { POST: addAttachment } },

  // test cases
  { pattern: /^\/api\/projects\/(\d+)\/test-cases$/, paramNames: ["id"], methods: { GET: getTestCases, POST: createTestCase } },
  { pattern: /^\/api\/projects\/(\d+)\/test-cases\/(\d+)$/, paramNames: ["id", "testCaseId"], methods: { PATCH: updateTestCase } },
  { pattern: /^\/api\/projects\/(\d+)\/test-cases\/(\d+)\/results$/, paramNames: ["id", "testCaseId"], methods: { POST: recordResult } },

  // categories
  { pattern: /^\/api\/projects\/(\d+)\/categories$/, paramNames: ["id"], methods: { GET: getCategories, POST: createCategory } },

  // lists + tasks
  { pattern: /^\/api\/projects\/(\d+)\/lists$/, paramNames: ["id"], methods: { GET: getLists, POST: createList } },
  { pattern: /^\/api\/projects\/(\d+)\/lists\/(\d+)\/tasks$/, paramNames: ["id", "listId"], methods: { GET: getTasks, POST: createTask } },
  { pattern: /^\/api\/projects\/(\d+)\/lists\/(\d+)\/tasks\/(\d+)$/, paramNames: ["id", "listId", "taskId"], methods: { GET: getTask, PATCH: updateTask, DELETE: deleteTask } },
  { pattern: /^\/api\/projects\/(\d+)\/lists\/(\d+)\/tasks\/(\d+)\/subtasks$/, paramNames: ["id", "listId", "taskId"], methods: { POST: createSubtask } },
  { pattern: /^\/api\/projects\/(\d+)\/lists\/(\d+)\/tasks\/(\d+)\/subtasks\/(\d+)$/, paramNames: ["id", "listId", "taskId", "subtaskId"], methods: { PATCH: updateSubtask } },
  { pattern: /^\/api\/projects\/(\d+)\/lists\/(\d+)\/tasks\/(\d+)\/subtasks\/(\d+)\/checklist$/, paramNames: ["id", "listId", "taskId", "subtaskId"], methods: { POST: addChecklistItem } },
  { pattern: /^\/api\/projects\/(\d+)\/lists\/(\d+)\/tasks\/(\d+)\/subtasks\/(\d+)\/checklist\/(\d+)$/, paramNames: ["id", "listId", "taskId", "subtaskId", "itemId"], methods: { PATCH: toggleChecklist } },

  // task activity
  { pattern: /^\/api\/projects\/(\d+)\/task-activity$/, paramNames: ["id"], methods: { GET: getTaskActivity } },

  // settings
  { pattern: /^\/api\/settings\/activity-logs$/, paramNames: [], methods: { GET: getActivityLogs } },
  { pattern: /^\/api\/settings\/email-templates$/, paramNames: [], methods: { GET: getEmailTemplates } },

  // PM workspace — specific paths BEFORE the generic /[module] catch-all
  { pattern: /^\/api\/pm\/dashboard$/, paramNames: [], methods: { GET: pmDashboard } },
  { pattern: /^\/api\/pm\/users$/, paramNames: [], methods: { GET: pmUsers } },
  { pattern: /^\/api\/pm\/([\w-]+)\/(\d+)$/, paramNames: ["module", "id"], methods: { GET: pmGet, PATCH: pmUpdate, DELETE: pmDelete } },
  { pattern: /^\/api\/pm\/([\w-]+)$/, paramNames: ["module"], methods: { GET: pmList, POST: pmCreate } },
];

// ── Dispatch ──

export async function directCall(
  method: string,
  fullPath: string,
  body: unknown | undefined,
  origin: string,
  jwt: string,
): Promise<unknown> {
  const [pathname, search] = fullPath.split("?");

  for (const route of ROUTES) {
    const match = pathname.match(route.pattern);
    if (!match) continue;

    const handler = route.methods[method];
    if (!handler) break;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });

    const url = new URL(pathname, origin);
    if (search) url.search = `?${search}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    };

    const req = new NextRequest(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const res = await handler(req, { params: Promise.resolve(params) });
    const text = await res.text();

    if (!res.ok) throw new Error(`API ${method} ${pathname} → ${res.status}: ${text}`);

    try { return JSON.parse(text); } catch { return text; }
  }

  throw new Error(`No direct route matched: ${method} ${fullPath}`);
}
