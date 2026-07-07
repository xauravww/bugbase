// Shared MCP tool registry. Each tool calls the bugbase REST API so the API's
// role + project-membership checks remain the single source of truth.
//
// Consumed by:
//   - src/app/api/mcp/route.ts   (remote Streamable-HTTP server, per-request JWT)
//   - mcp/server.ts              (local stdio server, JWT cached via `login`)
//
// The registry is transport-agnostic: a tool handler receives a `call(method,
// path, body)` fn and its validated args, and returns a JSON-serialisable value.

export interface ToolContext {
  // Perform an authenticated REST call against the bugbase API.
  call: (method: string, path: string, body?: unknown) => Promise<unknown>;
}

export interface ToolDef {
  name: string;
  description: string;
  // JSON Schema (draft-07 subset) for the tool arguments.
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const num = { type: "number" };
const str = { type: "string" };
const bool = { type: "boolean" };
const numArr = { type: "array", items: { type: "number" } };

export const TOOLS: ToolDef[] = [
  // ── whoami / projects ──
  {
    name: "whoami",
    description: "Return the current authenticated user (id, name, email, role).",
    inputSchema: { type: "object", properties: {} },
    handler: (_a, ctx) => ctx.call("GET", "/api/auth/me"),
  },
  {
    name: "list_projects",
    description: "List projects the current user can access.",
    inputSchema: { type: "object", properties: {} },
    handler: (_a, ctx) => ctx.call("GET", "/api/projects"),
  },
  {
    name: "get_project",
    description: "Get one project with its members.",
    inputSchema: { type: "object", properties: { projectId: num }, required: ["projectId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}`),
  },
  {
    name: "dashboard",
    description: "Cross-project dashboard: open/closed issue counts, recent issues, activity feed.",
    inputSchema: { type: "object", properties: {} },
    handler: (_a, ctx) => ctx.call("GET", "/api/dashboard"),
  },
  {
    name: "team_progress",
    description: "Team progress for a project: per-member created/closed/comments, daily series, recent activity.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, from: str, to: str, userId: num },
      required: ["projectId"],
    },
    handler: (a, ctx) =>
      ctx.call("GET", `/api/projects/${a.projectId}/team-progress${qs({ from: a.from, to: a.to, userId: a.userId })}`),
  },

  // ── issues ──
  {
    name: "list_issues",
    description: "List issues with optional filters. Scoped to the user's accessible projects.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, status: str, priority: str, type: str,
        search: str, assignedToMe: bool, page: num, limit: num,
      },
    },
    handler: (a, ctx) => ctx.call("GET", `/api/issues${qs(a)}`),
  },
  {
    name: "get_issue",
    description: "Get one issue with details.",
    inputSchema: { type: "object", properties: { issueId: num }, required: ["issueId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/issues/${a.issueId}`),
  },
  {
    name: "create_issue",
    description: "Create an issue. Requires create permission in the project (Viewers cannot).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, title: str, type: str, description: str,
        stepsToReproduce: str, expectedResult: str, actualResult: str,
        priority: str, dueDate: str, assigneeIds: numArr, categoryIds: numArr,
      },
      required: ["projectId", "title"],
    },
    handler: (a, ctx) => ctx.call("POST", "/api/issues", a),
  },
  {
    name: "update_issue",
    description: "Update an issue (title, status, priority, description, etc.).",
    inputSchema: {
      type: "object",
      properties: { issueId: num, title: str, status: str, priority: str, type: str, description: str, dueDate: str },
      required: ["issueId"],
    },
    handler: ({ issueId, ...updates }, ctx) => ctx.call("PUT", `/api/issues/${issueId}`, updates),
  },
  {
    name: "delete_issue",
    description: "Delete an issue (Admin only).",
    inputSchema: { type: "object", properties: { issueId: num }, required: ["issueId"] },
    handler: (a, ctx) => ctx.call("DELETE", `/api/issues/${a.issueId}`),
  },
  {
    name: "set_issue_assignees",
    description: "Replace an issue's assignee list.",
    inputSchema: { type: "object", properties: { issueId: num, userIds: numArr }, required: ["issueId", "userIds"] },
    handler: (a, ctx) => ctx.call("POST", `/api/issues/${a.issueId}/assignees`, { userIds: a.userIds }),
  },
  {
    name: "add_issue_comment",
    description: "Add a comment to an issue.",
    inputSchema: { type: "object", properties: { issueId: num, body: str }, required: ["issueId", "body"] },
    handler: (a, ctx) => ctx.call("POST", `/api/issues/${a.issueId}/comments`, { body: a.body }),
  },
  {
    name: "list_issue_comments",
    description: "List comments on an issue.",
    inputSchema: { type: "object", properties: { issueId: num }, required: ["issueId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/issues/${a.issueId}/comments`),
  },

  // ── test cases ──
  {
    name: "list_test_cases",
    description: "List test cases for a project.",
    inputSchema: { type: "object", properties: { projectId: num }, required: ["projectId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/test-cases`),
  },
  {
    name: "create_test_case",
    description: "Create a test case. Set force=true to bypass duplicate detection.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, title: str, description: str, steps: str, expectedResult: str, force: bool },
      required: ["projectId", "title"],
    },
    handler: ({ projectId, ...body }, ctx) => ctx.call("POST", `/api/projects/${projectId}/test-cases`, body),
  },
  {
    name: "update_test_case",
    description: "Update a test case.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, testCaseId: num, title: str, description: str, steps: str, expectedResult: str },
      required: ["projectId", "testCaseId"],
    },
    handler: ({ projectId, testCaseId, ...body }, ctx) =>
      ctx.call("PATCH", `/api/projects/${projectId}/test-cases/${testCaseId}`, body),
  },
  {
    name: "record_test_result",
    description: "Record a test-case run result (Pass | Fail | Blocked).",
    inputSchema: {
      type: "object",
      properties: { projectId: num, testCaseId: num, status: str, notes: str },
      required: ["projectId", "testCaseId", "status"],
    },
    handler: ({ projectId, testCaseId, status, notes }, ctx) =>
      ctx.call("POST", `/api/projects/${projectId}/test-cases/${testCaseId}/results`, { status, notes }),
  },

  // ── categories / labels ──
  {
    name: "list_categories",
    description: "List a project's categories (used as labels for issues and tasks).",
    inputSchema: { type: "object", properties: { projectId: num }, required: ["projectId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/categories`),
  },
  {
    name: "create_category",
    description: "Create a category/label in a project.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, name: str, color: str },
      required: ["projectId", "name"],
    },
    handler: (a, ctx) => ctx.call("POST", `/api/projects/${a.projectId}/categories`, { name: a.name, color: a.color }),
  },

  // ── task tracker ──
  {
    name: "list_lists",
    description: "List all task lists in a project with their tasks/subtasks/checklist.",
    inputSchema: { type: "object", properties: { projectId: num }, required: ["projectId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/lists`),
  },
  {
    name: "list_tasks",
    description: "List tasks in a list.",
    inputSchema: { type: "object", properties: { projectId: num, listId: num }, required: ["projectId", "listId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/lists/${a.listId}/tasks`),
  },
  {
    name: "get_task",
    description: "Get one task with subtasks, checklist, assignees, completers, labels.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, taskId: num },
      required: ["projectId", "listId", "taskId"],
    },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/lists/${a.listId}/tasks/${a.taskId}`),
  },
  {
    name: "create_list",
    description: "Create a task list.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, name: str, description: str, color: str },
      required: ["projectId", "name"],
    },
    handler: ({ projectId, ...body }, ctx) => ctx.call("POST", `/api/projects/${projectId}/lists`, body),
  },
  {
    name: "create_task",
    description: "Create a task. Optionally assign users and labels on create.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, listId: num, title: str, description: str,
        priority: str, dueDate: str, status: str, assigneeIds: numArr, categoryIds: numArr,
      },
      required: ["projectId", "listId", "title"],
    },
    handler: ({ projectId, listId, ...body }, ctx) =>
      ctx.call("POST", `/api/projects/${projectId}/lists/${listId}/tasks`, body),
  },
  {
    name: "update_task",
    description: "Update a task: fields, status, assignees, completers, labels, or restore a soft-deleted task.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, listId: num, taskId: num, title: str, description: str,
        priority: str, status: str, dueDate: str,
        assigneeIds: numArr, completerIds: numArr, categoryIds: numArr, restore: bool,
      },
      required: ["projectId", "listId", "taskId"],
    },
    handler: ({ projectId, listId, taskId, ...body }, ctx) =>
      ctx.call("PATCH", `/api/projects/${projectId}/lists/${listId}/tasks/${taskId}`, body),
  },
  {
    name: "delete_task",
    description: "Soft-delete a task (restore via update_task restore=true).",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, taskId: num },
      required: ["projectId", "listId", "taskId"],
    },
    handler: (a, ctx) => ctx.call("DELETE", `/api/projects/${a.projectId}/lists/${a.listId}/tasks/${a.taskId}`),
  },
  {
    name: "create_subtask",
    description: "Create a subtask under a task.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, taskId: num, title: str, description: str },
      required: ["projectId", "listId", "taskId", "title"],
    },
    handler: ({ projectId, listId, taskId, ...body }, ctx) =>
      ctx.call("POST", `/api/projects/${projectId}/lists/${listId}/tasks/${taskId}/subtasks`, body),
  },
  {
    name: "update_subtask",
    description: "Update a subtask (title/description/status, or restore).",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, taskId: num, subtaskId: num, title: str, description: str, status: str, restore: bool },
      required: ["projectId", "listId", "taskId", "subtaskId"],
    },
    handler: ({ projectId, listId, taskId, subtaskId, ...body }, ctx) =>
      ctx.call("PATCH", `/api/projects/${projectId}/lists/${listId}/tasks/${taskId}/subtasks/${subtaskId}`, body),
  },
  {
    name: "add_checklist_item",
    description: "Add a checklist item to a subtask.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, taskId: num, subtaskId: num, content: str },
      required: ["projectId", "listId", "taskId", "subtaskId", "content"],
    },
    handler: ({ projectId, listId, taskId, subtaskId, content }, ctx) =>
      ctx.call("POST", `/api/projects/${projectId}/lists/${listId}/tasks/${taskId}/subtasks/${subtaskId}/checklist`, { content }),
  },
  {
    name: "toggle_checklist",
    description: "Toggle a checklist item done/undone.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, taskId: num, subtaskId: num, itemId: num, done: bool },
      required: ["projectId", "listId", "taskId", "subtaskId", "itemId", "done"],
    },
    handler: ({ projectId, listId, taskId, subtaskId, itemId, done }, ctx) =>
      ctx.call("PATCH", `/api/projects/${projectId}/lists/${listId}/tasks/${taskId}/subtasks/${subtaskId}/checklist/${itemId}`, { done }),
  },
  {
    name: "task_history",
    description: "Task/list activity feed for a project (created/updated/completed/deleted/restored).",
    inputSchema: {
      type: "object",
      properties: { projectId: num, taskId: num, action: str, limit: num },
      required: ["projectId"],
    },
    handler: ({ projectId, ...args }, ctx) => ctx.call("GET", `/api/projects/${projectId}/task-activity${qs(args)}`),
  },

  // ── settings (Admin-scoped by API) ──
  {
    name: "activity_logs",
    description: "Global activity logs (Admin only — API returns 403 otherwise).",
    inputSchema: {
      type: "object",
      properties: { page: num, limit: num, search: str, action: str, dateFrom: str, dateTo: str },
    },
    handler: (a, ctx) => ctx.call("GET", `/api/settings/activity-logs${qs(a)}`),
  },
  {
    name: "email_templates",
    description: "List email notification templates (Admin only).",
    inputSchema: { type: "object", properties: {} },
    handler: (_a, ctx) => ctx.call("GET", "/api/settings/email-templates"),
  },
];

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
