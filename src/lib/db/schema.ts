import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Users table
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["Admin", "Developer", "QA", "Viewer"] }).notNull().default("Developer"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
}));

// API tokens for remote MCP access (bearer `mcp_...`). Only the hash is stored.
export const apiTokens = sqliteTable("api_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  prefix: text("prefix").notNull(), // first chars shown in UI, e.g. "mcp_ab12"
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index("idx_api_tokens_user").on(table.userId),
  hashIdx: index("idx_api_tokens_hash").on(table.tokenHash),
}));

// Projects table
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  description: text("description"),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  createdBy: integer("created_by").notNull().references(() => users.id),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  keyIdx: index("idx_projects_key").on(table.key),
  creatorIdx: index("idx_projects_created_by").on(table.createdBy),
  archivedIdx: index("idx_projects_archived").on(table.archived),
}));

// Project members join table
export const projectMembers = sqliteTable("project_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "member", "qa"] }).notNull().default("member"),
}, (table) => ({
  projectUserIdx: index("idx_project_members_project_user").on(table.projectId, table.userId),
  userIdx: index("idx_project_members_user").on(table.userId),
}));

// Issues table
export const issues = sqliteTable("issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type", { enum: ["Bug", "Feature"] }).notNull().default("Bug"),
  description: text("description"),
  stepsToReproduce: text("steps_to_reproduce"),
  expectedResult: text("expected_result"),
  actualResult: text("actual_result"),
  status: text("status", { enum: ["Open", "In Progress", "In Review", "Verified", "Closed"] }).notNull().default("Open"),
  isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  priority: text("priority", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  reporterId: integer("reporter_id").notNull().references(() => users.id),
  startDate: integer("start_date", { mode: "timestamp" }),
  dueDate: integer("due_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_issues_project").on(table.projectId),
  statusIdx: index("idx_issues_status").on(table.status),
  isVerifiedIdx: index("idx_issues_verified").on(table.isVerified),
  reporterIdx: index("idx_issues_reporter").on(table.reporterId),
  createdAtIdx: index("idx_issues_created_at").on(table.createdAt),
}));

// Issue assignees join table
export const issueAssignees = sqliteTable("issue_assignees", {
  issueId: integer("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.issueId, table.userId] }),
}));

// Issue verifiers join table (users who can verify)
export const issueVerifiers = sqliteTable("issue_verifiers", {
  issueId: integer("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.issueId, table.userId] }),
}));

// Issue verifications (tracking who actually verified)
export const issueVerifications = sqliteTable("issue_verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  verifiedAt: integer("verified_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Comments table
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  issueIdx: index("idx_comments_issue").on(table.issueId),
  userIdx: index("idx_comments_user").on(table.userId),
}));

// Attachments table
export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id").references(() => issues.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  imgbbDeleteHash: text("imgbb_delete_hash"),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  issueIdx: index("idx_attachments_issue").on(table.issueId),
  commentIdx: index("idx_attachments_comment").on(table.commentId),
}));

// Activity log table
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id").references(() => issues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  issueIdx: index("idx_activity_log_issue").on(table.issueId),
  userIdx: index("idx_activity_log_user").on(table.userId),
  createdAtIdx: index("idx_activity_log_created_at").on(table.createdAt),
}));

// Email templates table
export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  event: text("event").notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Context entries: flexible per-project workspace records
export const contextEntries = sqliteTable("context_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["question", "answer", "note", "ingest", "ingest_chunk", "treemap", "task", "feature", "custom"] }).notNull(),
  parentId: integer("parent_id"),
  title: text("title"),
  body: text("body").notNull(),
  source: text("source", { enum: ["user", "ai", "admin_pin"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "completed", "archived"] }).notNull().default("active"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  metadata: text("metadata"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_context_entries_project").on(table.projectId),
  kindIdx: index("idx_context_entries_kind").on(table.kind),
  statusIdx: index("idx_context_entries_status").on(table.status),
  parentIdx: index("idx_context_entries_parent").on(table.parentId),
  updatedAtIdx: index("idx_context_entries_updated_at").on(table.updatedAt),
}));

// Embeddings linked to context entries (one row per entry)
export const contextEntryEmbeddings = sqliteTable("context_entry_embeddings", {
  entryId: integer("entry_id").primaryKey().references(() => contextEntries.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  dim: integer("dim").notNull(),
  vector: text("vector").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Per-path tested state for treemap nodes; survives treemap re-paste
export const treemapPaths = sqliteTable("treemap_paths", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  tested: integer("tested", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  lastTestedAt: integer("last_tested_at", { mode: "timestamp" }),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectPathIdx: index("idx_treemap_paths_project_path").on(table.projectId, table.path),
}));

// Activity log for context workspace
export const contextActivity = sqliteTable("context_activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  entryId: integer("entry_id").references(() => contextEntries.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_context_activity_project").on(table.projectId),
  entryIdx: index("idx_context_activity_entry").on(table.entryId),
  createdAtIdx: index("idx_context_activity_created_at").on(table.createdAt),
}));

// Test Cases table
export const testCases = sqliteTable("test_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  steps: text("steps"),
  expectedResult: text("expected_result"),
  categoryId: integer("category_id"), // Optional automatic category
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_test_cases_project").on(table.projectId),
}));

// Test Case Results (QA runs)
export const testCaseResults = sqliteTable("test_case_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  testCaseId: integer("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["Pass", "Fail", "Blocked"] }).notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  testCaseIdx: index("idx_test_case_results_test_case").on(table.testCaseId),
}));

// Test Case Embeddings for deduplication
export const testCaseEmbeddings = sqliteTable("test_case_embeddings", {
  testCaseId: integer("test_case_id").primaryKey().references(() => testCases.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  dim: integer("dim").notNull(),
  vector: text("vector").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Categories table (per-project tags)
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#5b76fe"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_categories_project").on(table.projectId),
  projectNameIdx: index("idx_categories_project_name").on(table.projectId, table.name),
}));

// Issue categories join table
export const issueCategories = sqliteTable("issue_categories", {
  issueId: integer("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.issueId, table.categoryId] }),
  categoryIdx: index("idx_issue_categories_category").on(table.categoryId),
}));

// Lists (TickTick-style task hierarchy)
export const lists = sqliteTable("lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#5b76fe"),
  sortOrder: integer("sort_order").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_lists_project").on(table.projectId),
  sortIdx: index("idx_lists_sort").on(table.projectId, table.sortOrder),
}));

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
  priority: text("priority", { enum: ["none", "low", "medium", "high"] }).notNull().default("none"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  completedBy: integer("completed_by").references(() => users.id),
  sortOrder: integer("sort_order").notNull().default(0),
  dueDate: integer("due_date", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  listIdx: index("idx_tasks_list").on(table.listId),
  statusIdx: index("idx_tasks_status").on(table.status),
  sortIdx: index("idx_tasks_list_sort").on(table.listId, table.sortOrder),
  deletedIdx: index("idx_tasks_deleted").on(table.deletedAt),
}));

export const subtasks = sqliteTable("subtasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  completedBy: integer("completed_by").references(() => users.id),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  taskIdx: index("idx_subtasks_task").on(table.taskId),
  sortIdx: index("idx_subtasks_task_sort").on(table.taskId, table.sortOrder),
}));

export const checklistItems = sqliteTable("checklist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subtaskId: integer("subtask_id").notNull().references(() => subtasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  subtaskIdx: index("idx_checklist_items_subtask").on(table.subtaskId),
}));

// Task ↔ user assignees (many-to-many)
export const taskAssignees = sqliteTable("task_assignees", {
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.taskId, table.userId] }),
  userIdx: index("idx_task_assignees_user").on(table.userId),
}));

// Task ↔ user completers (who marked it done; supports multiple)
export const taskCompleters = sqliteTable("task_completers", {
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  completedAt: integer("completed_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  pk: primaryKey({ columns: [table.taskId, table.userId] }),
  userIdx: index("idx_task_completers_user").on(table.userId),
}));

// Task ↔ category (labels, reuses project categories)
export const taskCategories = sqliteTable("task_categories", {
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.taskId, table.categoryId] }),
  categoryIdx: index("idx_task_categories_category").on(table.categoryId),
}));

export const taskActivity = sqliteTable("task_activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  subtaskId: integer("subtask_id").references(() => subtasks.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_task_activity_project").on(table.projectId),
  taskIdx: index("idx_task_activity_task").on(table.taskId),
  createdAtIdx: index("idx_task_activity_created_at").on(table.createdAt),
}));

// Daily work logs — free-form natural-language record of what a user did on a
// given day, optionally tied to a project. Complements activity_log (which only
// captures structured tracker events) so non-technical / off-tracker work is
// still visible in updates and on the calendar.
export const workLogs = sqliteTable("work_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  logDate: integer("log_date", { mode: "timestamp" }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index("idx_work_logs_user").on(table.userId),
  projectIdx: index("idx_work_logs_project").on(table.projectId),
  dateIdx: index("idx_work_logs_date").on(table.logDate),
  userDateIdx: index("idx_work_logs_user_date").on(table.userId, table.logDate),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  projectMemberships: many(projectMembers),
  reportedIssues: many(issues),
  comments: many(comments),
  activities: many(activityLog),
  apiTokens: many(apiTokens),
  workLogs: many(workLogs),
}));

export const workLogsRelations = relations(workLogs, ({ one }) => ({
  user: one(users, {
    fields: [workLogs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [workLogs.projectId],
    references: [projects.id],
  }),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  members: many(projectMembers),
  issues: many(issues),
  lists: many(lists),
  categories: many(categories),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  reporter: one(users, {
    fields: [issues.reporterId],
    references: [users.id],
  }),
  assignees: many(issueAssignees),
  verifiers: many(issueVerifiers),
  verifications: many(issueVerifications),
  comments: many(comments),
  attachments: many(attachments),
  activities: many(activityLog),
  categories: many(issueCategories),
}));

export const issueAssigneesRelations = relations(issueAssignees, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAssignees.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [issueAssignees.userId],
    references: [users.id],
  }),
}));

export const issueVerifiersRelations = relations(issueVerifiers, ({ one }) => ({
  issue: one(issues, {
    fields: [issueVerifiers.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [issueVerifiers.userId],
    references: [users.id],
  }),
}));

export const issueVerificationsRelations = relations(issueVerifications, ({ one }) => ({
  issue: one(issues, {
    fields: [issueVerifications.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [issueVerifications.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  issue: one(issues, {
    fields: [attachments.issueId],
    references: [issues.id],
  }),
  comment: one(comments, {
    fields: [attachments.commentId],
    references: [comments.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  issue: one(issues, {
    fields: [activityLog.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

export const emailTemplatesRelations = relations(emailTemplates, () => ({}));

export const contextEntriesRelations = relations(contextEntries, ({ one, many }) => ({
  project: one(projects, {
    fields: [contextEntries.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [contextEntries.createdBy],
    references: [users.id],
  }),
  embedding: one(contextEntryEmbeddings, {
    fields: [contextEntries.id],
    references: [contextEntryEmbeddings.entryId],
  }),
  activities: many(contextActivity),
}));

export const contextEntryEmbeddingsRelations = relations(contextEntryEmbeddings, ({ one }) => ({
  entry: one(contextEntries, {
    fields: [contextEntryEmbeddings.entryId],
    references: [contextEntries.id],
  }),
}));

export const treemapPathsRelations = relations(treemapPaths, ({ one }) => ({
  project: one(projects, {
    fields: [treemapPaths.projectId],
    references: [projects.id],
  }),
  updatedByUser: one(users, {
    fields: [treemapPaths.updatedBy],
    references: [users.id],
  }),
}));

export const contextActivityRelations = relations(contextActivity, ({ one }) => ({
  project: one(projects, {
    fields: [contextActivity.projectId],
    references: [projects.id],
  }),
  entry: one(contextEntries, {
    fields: [contextActivity.entryId],
    references: [contextEntries.id],
  }),
  user: one(users, {
    fields: [contextActivity.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  project: one(projects, {
    fields: [categories.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [categories.createdBy],
    references: [users.id],
  }),
  issues: many(issueCategories),
  tasks: many(taskCategories),
}));

export const issueCategoriesRelations = relations(issueCategories, ({ one }) => ({
  issue: one(issues, {
    fields: [issueCategories.issueId],
    references: [issues.id],
  }),
  category: one(categories, {
    fields: [issueCategories.categoryId],
    references: [categories.id],
  }),
}));

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  project: one(projects, {
    fields: [testCases.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [testCases.createdBy],
    references: [users.id],
  }),
  results: many(testCaseResults),
  embedding: one(testCaseEmbeddings, {
    fields: [testCases.id],
    references: [testCaseEmbeddings.testCaseId],
  }),
}));

export const testCaseResultsRelations = relations(testCaseResults, ({ one }) => ({
  testCase: one(testCases, {
    fields: [testCaseResults.testCaseId],
    references: [testCases.id],
  }),
  tester: one(users, {
    fields: [testCaseResults.userId],
    references: [users.id],
  }),
}));

export const testCaseEmbeddingsRelations = relations(testCaseEmbeddings, ({ one }) => ({
  testCase: one(testCases, {
    fields: [testCaseEmbeddings.testCaseId],
    references: [testCases.id],
  }),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  project: one(projects, {
    fields: [lists.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [lists.createdBy],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  list: one(lists, {
    fields: [tasks.listId],
    references: [lists.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "taskCreator",
  }),
  completedByUser: one(users, {
    fields: [tasks.completedBy],
    references: [users.id],
    relationName: "taskCompleter",
  }),
  subtasks: many(subtasks),
  activities: many(taskActivity),
  assignees: many(taskAssignees),
  completers: many(taskCompleters),
  categories: many(taskCategories),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignees.userId],
    references: [users.id],
  }),
}));

export const taskCompletersRelations = relations(taskCompleters, ({ one }) => ({
  task: one(tasks, {
    fields: [taskCompleters.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskCompleters.userId],
    references: [users.id],
  }),
}));

export const taskCategoriesRelations = relations(taskCategories, ({ one }) => ({
  task: one(tasks, {
    fields: [taskCategories.taskId],
    references: [tasks.id],
  }),
  category: one(categories, {
    fields: [taskCategories.categoryId],
    references: [categories.id],
  }),
}));

export const subtasksRelations = relations(subtasks, ({ one, many }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
  completedByUser: one(users, {
    fields: [subtasks.completedBy],
    references: [users.id],
    relationName: "subtaskCompleter",
  }),
  checklist: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  subtask: one(subtasks, {
    fields: [checklistItems.subtaskId],
    references: [subtasks.id],
  }),
}));

export const taskActivityRelations = relations(taskActivity, ({ one }) => ({
  project: one(projects, {
    fields: [taskActivity.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [taskActivity.taskId],
    references: [tasks.id],
  }),
  subtask: one(subtasks, {
    fields: [taskActivity.subtaskId],
    references: [subtasks.id],
  }),
  user: one(users, {
    fields: [taskActivity.userId],
    references: [users.id],
  }),
}));
