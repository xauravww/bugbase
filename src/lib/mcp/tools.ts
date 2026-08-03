// Shared MCP tool registry. Each tool calls the bugbase REST API so the API's
// role + project-membership checks remain the single source of truth.
//
// Consumed by:
//   - src/app/api/mcp/route.ts   (remote Streamable-HTTP server, per-request JWT)
//   - mcp/server.ts              (local stdio server, JWT cached via `login`)
//
// The registry is transport-agnostic: a tool handler receives a `call(method,
// path, body)` fn and its validated args, and returns a JSON-serialisable value.

import { reviewRecord } from "@/lib/ai/review-record";

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
const strArr = { type: "array", items: { type: "string" } };

/**
 * Runs the AI record review test method on an item before creation or update.
 * If the item is out-of-category (belongsHere === false) and force is false,
 * returns an error preventing invalid creation.
 */
async function checkWithAi(moduleSlug: string, fields: Record<string, unknown>, force?: boolean) {
  const review = await reviewRecord(moduleSlug, fields);
  if (review && review.belongsHere === false && !force) {
    return {
      error: `AI Review Failed: Content does not belong in '${moduleSlug}'. It belongs in '${review.belongsIn || "another category"}'. ${review.summary}. Pass force=true to override.`,
      aiReview: review,
    };
  }
  return { aiReview: review };
}

export const TOOLS: ToolDef[] = [
  // ── uploads ──
  {
    name: "upload_image",
    description: "Upload a JPEG, PNG, GIF, WebP, or SVG image to the configured image host. Pass base64-encoded image bytes (or a data URL), filename, and mimeType. Returns a public URL, thumbnail, provider, and deleteHash. Upload first, then use the returned url in imageUrls when creating/updating an issue or add_issue_images.",
    inputSchema: {
      type: "object",
      properties: { imageBase64: str, filename: str, mimeType: str },
      required: ["imageBase64", "filename", "mimeType"],
    },
    handler: (a, ctx) => ctx.call("POST", "/api/upload", a),
  },

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
    description: "Global aggregate statistics across ALL projects: open/closed/inProgress issue COUNTS (numbers, not issue objects) and up-to-10 recent issues assigned to the calling user only (myRecentAssignments). Do NOT use this to list a project's issues — use list_issues with projectId instead.",
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
    description: "List actual issue objects with optional filters. Use this (not dashboard) when you need issues for a specific project. Pass projectId to scope to one project, status to filter by status (e.g. 'Open', 'In Progress', 'Closed').",
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
    description: "Create an issue. Pass imageUrls to attach public image URLs at creation. Automatically validated via AI test method to prevent out-of-category content. Set force=true to bypass AI validation.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, title: str, type: str, description: str,
        stepsToReproduce: str, expectedResult: str, actualResult: str,
        priority: str, dueDate: str, assigneeIds: numArr, categoryIds: numArr, imageUrls: strArr, force: bool,
      },
      required: ["projectId", "title"],
    },
    handler: async ({ force, ...a }, ctx) => {
      const aiCheck = await checkWithAi("issues", a as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("POST", "/api/issues", a);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
  },
  {
    name: "update_issue",
    description: "Update an issue (title, status, priority, description, etc.). Pass imageUrls to add public image URLs without replacing existing attachments. Automatically validated via AI test method.",
    inputSchema: {
      type: "object",
      properties: { issueId: num, title: str, status: str, priority: str, type: str, description: str, dueDate: str, imageUrls: strArr, force: bool },
      required: ["issueId"],
    },
    handler: async ({ issueId, force, ...updates }, ctx) => {
      const aiCheck = await checkWithAi("issues", updates as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("PUT", `/api/issues/${issueId}`, updates);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
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
    name: "add_issue_images",
    description: "Attach one or more public image URLs to an issue or, with commentId, to an existing comment on that issue. URLs are saved as attachments; no binary upload is required.",
    inputSchema: {
      type: "object",
      properties: { issueId: num, imageUrls: strArr, commentId: num },
      required: ["issueId", "imageUrls"],
    },
    handler: async ({ issueId, imageUrls, commentId }, ctx) => {
      const urls = imageUrls as string[];
      return Promise.all(urls.map((url) =>
        ctx.call("POST", `/api/issues/${issueId}/attachments`, {
          url,
          ...(commentId !== undefined ? { commentId } : {}),
        })
      ));
    },
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
    description: "Create a test case. Validated via AI test method. Set force=true to bypass duplicate detection and AI category checks.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, title: str, description: str, steps: str, expectedResult: str, force: bool },
      required: ["projectId", "title"],
    },
    handler: async ({ projectId, force, ...body }, ctx) => {
      const aiCheck = await checkWithAi("test-cases", body as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("POST", `/api/projects/${projectId}/test-cases`, { ...body, force });
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
  },
  {
    name: "update_test_case",
    description: "Update a test case. Validated via AI test method.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, testCaseId: num, title: str, description: str, steps: str, expectedResult: str, force: bool },
      required: ["projectId", "testCaseId"],
    },
    handler: async ({ projectId, testCaseId, force, ...body }, ctx) => {
      const aiCheck = await checkWithAi("test-cases", body as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("PATCH", `/api/projects/${projectId}/test-cases/${testCaseId}`, body);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
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
    description: "List task lists in a project. Use shallow=true for metadata + task counts only (faster). Without shallow, returns full nested tasks/subtasks/checklist.",
    inputSchema: { type: "object", properties: { projectId: num, shallow: bool }, required: ["projectId"] },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/lists${a.shallow ? "?shallow=true" : ""}`),
  },
  {
    name: "list_tasks",
    description: "List tasks in a list. Paginated (default 50, max 100). Returns pagination metadata.",
    inputSchema: {
      type: "object",
      properties: { projectId: num, listId: num, page: num, limit: num },
      required: ["projectId", "listId"],
    },
    handler: (a, ctx) => ctx.call("GET", `/api/projects/${a.projectId}/lists/${a.listId}/tasks${qs({ page: a.page, limit: a.limit })}`),
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
    description: "Create a task. Validated via AI test method to check category and proper details. Valid status: 'active' | 'completed'. Valid priority: 'none' | 'low' | 'medium' | 'high'.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, listId: num, title: str, description: str,
        priority: str, dueDate: str, status: str, assigneeIds: numArr, categoryIds: numArr, force: bool,
      },
      required: ["projectId", "listId", "title"],
    },
    handler: async ({ projectId, listId, force, ...body }, ctx) => {
      const aiCheck = await checkWithAi("tasks", body as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("POST", `/api/projects/${projectId}/lists/${listId}/tasks`, body);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
  },
  {
    name: "update_task",
    description: "Update a task: fields, status, assignees, completers, labels, or restore a soft-deleted task. Validated via AI test method.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: num, listId: num, taskId: num, title: str, description: str,
        priority: str, status: str, dueDate: str,
        assigneeIds: numArr, completerIds: numArr, categoryIds: numArr, restore: bool, force: bool,
      },
      required: ["projectId", "listId", "taskId"],
    },
    handler: async ({ projectId, listId, taskId, force, ...body }, ctx) => {
      const aiCheck = await checkWithAi("tasks", body as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("PATCH", `/api/projects/${projectId}/lists/${listId}/tasks/${taskId}`, body);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
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
    description: "Update a subtask (title/description/status, or restore). Valid status: 'active' | 'completed'.",
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

  // ── PM workspace — generic CRUD over every registered workspace module. ──
  {
    name: "pm_list",
    description:
      "List PM workspace records for any workspace module: requirements, features, dev-tasks, bugs, releases, api-docs, arch-docs, meeting-notes, risks, ideas, milestones, sprints, user-stories, personas, user-journeys, tech-stack, mockups, workflows, or business-rules. Supports projectId, search, sort, dir, page, limit, plus field filters (status, priority, severity, tags, etc.).",
    inputSchema: {
      type: "object",
      properties: { module: str, projectId: num, search: str, status: str, priority: str, severity: str, tags: str, sort: str, dir: str, page: num, limit: num },
      required: ["module"],
    },
    handler: ({ module, ...args }, ctx) => ctx.call("GET", `/api/pm/${module}${qs(args)}`),
  },
  {
    name: "pm_get",
    description: "Get a single PM record by module + id.",
    inputSchema: {
      type: "object",
      properties: { module: str, id: num },
      required: ["module", "id"],
    },
    handler: ({ module, id }, ctx) => ctx.call("GET", `/api/pm/${module}/${id}`),
  },
  {
    name: "pm_create",
    description:
      "Create a PM record. Automatically validated via AI test method to ensure content belongs in the specified module and has proper details. Pass module, projectId (required), and fields. Set force=true to bypass AI validation.",
    inputSchema: {
      type: "object",
      properties: {
        module: str, projectId: num, title: str, name: str, version: str, endpoint: str,
        description: str, status: str, priority: str, severity: str, type: str, environment: str,
        acceptanceCriteria: str, storyPoints: num, epic: str, dueDate: str, estimatedTime: num,
        actualTime: num, tags: str, requirementId: num, featureId: num, assigneeId: num, sprintId: num,
        taskId: num, parentId: num, releaseNotes: str, content: str, category: str,
        summary: str, decisions: str, actionItems: str, participants: str, meetingDate: str,
        mitigationPlan: str, impact: str, probability: str, effort: num, progress: num,
        targetDate: str, startDate: str, endDate: str, goal: str, releaseDate: str,
        httpMethod: str, authentication: str, requestBody: str, responseBody: str,
        stepsToReproduce: str, expectedResult: str, actualResult: str,
        role: str, benefit: str, goals: str, painPoints: str, behaviors: str,
        stage: str, persona: str, touchpoints: str, opportunities: str, rationale: str,
        screen: str, url: str, trigger: str, steps: str, condition: str, action: str,
        force: bool,
      },
      required: ["module", "projectId"],
    },
    handler: async ({ module, force, ...body }, ctx) => {
      const moduleSlug = String(module);
      const aiCheck = await checkWithAi(moduleSlug, body as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("POST", `/api/pm/${moduleSlug}`, body);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
  },
  {
    name: "pm_update",
    description: "Update a PM record. Automatically validated via AI test method to ensure proper details. Pass module, id, and fields.",
    inputSchema: {
      type: "object",
      properties: {
        module: str, id: num, title: str, name: str, version: str, endpoint: str,
        description: str, status: str, priority: str, severity: str, type: str, environment: str,
        acceptanceCriteria: str, storyPoints: num, epic: str, dueDate: str, estimatedTime: num,
        actualTime: num, tags: str, requirementId: num, featureId: num, assigneeId: num, sprintId: num,
        taskId: num, parentId: num, releaseNotes: str, content: str, category: str,
        summary: str, decisions: str, actionItems: str, participants: str, meetingDate: str,
        mitigationPlan: str, impact: str, probability: str, effort: num, progress: num,
        targetDate: str, startDate: str, endDate: str, goal: str, releaseDate: str,
        httpMethod: str, authentication: str, requestBody: str, responseBody: str,
        stepsToReproduce: str, expectedResult: str, actualResult: str,
        role: str, benefit: str, goals: str, painPoints: str, behaviors: str,
        stage: str, persona: str, touchpoints: str, opportunities: str, rationale: str,
        screen: str, url: str, trigger: str, steps: str, condition: str, action: str,
        force: bool,
      },
      required: ["module", "id"],
    },
    handler: async ({ module, id, force, ...body }, ctx) => {
      const moduleSlug = String(module);
      const aiCheck = await checkWithAi(moduleSlug, body as Record<string, unknown>, Boolean(force));
      if (aiCheck.error) return aiCheck;
      const res = await ctx.call("PATCH", `/api/pm/${moduleSlug}/${id}`, body);
      if (aiCheck.aiReview) {
        return { result: res, aiReview: aiCheck.aiReview };
      }
      return res;
    },
  },
  {
    name: "pm_delete",
    description: "Delete a PM record by module + id.",
    inputSchema: {
      type: "object",
      properties: { module: str, id: num },
      required: ["module", "id"],
    },
    handler: ({ module, id }, ctx) => ctx.call("DELETE", `/api/pm/${module}/${id}`),
  },
  {
    name: "pm_dashboard",
    description: "Multi-project PM dashboard: per-project health, completion %, open bugs, upcoming releases, tasks due today, risks, milestones, sprints, recent activity.",
    inputSchema: { type: "object", properties: {} },
    handler: (_a, ctx) => ctx.call("GET", "/api/pm/dashboard"),
  },
  {
    name: "check_with_ai",
    description:
      "Run the 'Check with AI' test method on any record before or after saving. Evaluates whether the content belongs in the specified module category and returns field-by-field suggestions and out-of-category warnings.",
    inputSchema: {
      type: "object",
      properties: {
        module: str,
        fields: { type: "object" },
      },
      required: ["module", "fields"],
    },
    handler: (a, ctx) => ctx.call("POST", "/api/ai/review-record", a),
  },
];

export const TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
