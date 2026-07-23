/**
 * PM Workspace schema — the delivery layer that hangs off `projects`.
 *
 * Every module table carries the common columns:
 *   id, project_id, created_by, created_at, updated_at
 * so the generic CRUD engine (src/lib/modules/crud.ts) and the activity
 * feed can treat them uniformly. Cross-module links are plain nullable
 * FKs (relational); many-to-many uses the junction tables at the bottom.
 */
import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { users, projects } from "./schema";

// Clients — projects belong to an optional client (agency use-case).
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Requirements — self-referential tree, root of the delivery hierarchy.
export const requirements = sqliteTable("requirements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["Feature", "Bug", "Enhancement", "Research"] }).notNull().default("Feature"),
  priority: text("priority", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  status: text("status", { enum: ["Draft", "Approved", "In Progress", "Done", "Rejected"] }).notNull().default("Draft"),
  acceptanceCriteria: text("acceptance_criteria"),
  parentId: integer("parent_id"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_requirements_project").on(t.projectId),
  statusIdx: index("idx_requirements_status").on(t.status),
  parentIdx: index("idx_requirements_parent").on(t.parentId),
}));

// Features — implement requirements.
export const features = sqliteTable("features", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["Proposed", "In Progress", "Done", "Cancelled"] }).notNull().default("Proposed"),
  priority: text("priority", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  requirementId: integer("requirement_id"),
  epic: text("epic"),
  storyPoints: integer("story_points"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_features_project").on(t.projectId),
  statusIdx: index("idx_features_status").on(t.status),
  requirementIdx: index("idx_features_requirement").on(t.requirementId),
}));

// Dev Tasks — engineering work items (distinct from the TickTick-style `tasks`).
export const devTasks = sqliteTable("dev_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["Todo", "In Progress", "Review", "Testing", "Done"] }).notNull().default("Todo"),
  priority: text("priority", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  assigneeId: integer("assignee_id"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  estimatedTime: real("estimated_time"),
  actualTime: real("actual_time"),
  featureId: integer("feature_id"),
  requirementId: integer("requirement_id"),
  sprintId: integer("sprint_id"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_dev_tasks_project").on(t.projectId),
  statusIdx: index("idx_dev_tasks_status").on(t.status),
  assigneeIdx: index("idx_dev_tasks_assignee").on(t.assigneeId),
  sprintIdx: index("idx_dev_tasks_sprint").on(t.sprintId),
}));

// Bugs — defect records (severity/environment/repro), optionally linked to a dev task.
export const bugs = sqliteTable("bugs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  status: text("status", { enum: ["Open", "In Progress", "Resolved", "Closed", "Won't Fix"] }).notNull().default("Open"),
  environment: text("environment", { enum: ["Dev", "Staging", "Production"] }).notNull().default("Dev"),
  stepsToReproduce: text("steps_to_reproduce"),
  expectedResult: text("expected_result"),
  actualResult: text("actual_result"),
  taskId: integer("task_id"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_bugs_project").on(t.projectId),
  statusIdx: index("idx_bugs_status").on(t.status),
  severityIdx: index("idx_bugs_severity").on(t.severity),
}));

// Releases — many-to-many with features and bugs (see junctions).
export const releases = sqliteTable("releases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  releaseDate: integer("release_date", { mode: "timestamp" }),
  status: text("status", { enum: ["Planned", "In Progress", "Released", "Rolled Back"] }).notNull().default("Planned"),
  releaseNotes: text("release_notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_releases_project").on(t.projectId),
  statusIdx: index("idx_releases_status").on(t.status),
}));

// API Documentation.
export const apiDocs = sqliteTable("api_docs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  httpMethod: text("http_method", { enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }).notNull().default("GET"),
  authentication: text("authentication", { enum: ["None", "Bearer", "API Key", "OAuth"] }).notNull().default("None"),
  requestBody: text("request_body"),
  responseBody: text("response_body"),
  status: text("status", { enum: ["Draft", "Stable", "Deprecated"] }).notNull().default("Draft"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_api_docs_project").on(t.projectId),
}));

// Architecture & Technical Docs.
export const archDocs = sqliteTable("arch_docs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category", { enum: ["Architecture", "Design", "Decision", "Runbook", "Diagram"] }).notNull().default("Architecture"),
  content: text("content"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_arch_docs_project").on(t.projectId),
}));

// Meeting Notes.
export const meetingNotes = sqliteTable("meeting_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  meetingDate: integer("meeting_date", { mode: "timestamp" }),
  participants: text("participants"),
  summary: text("summary"),
  decisions: text("decisions"),
  actionItems: text("action_items"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_meeting_notes_project").on(t.projectId),
}));

// Risks — impact × probability heat matrix.
export const risks = sqliteTable("risks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  impact: text("impact", { enum: ["Low", "Medium", "High"] }).notNull().default("Medium"),
  probability: text("probability", { enum: ["Low", "Medium", "High"] }).notNull().default("Medium"),
  mitigationPlan: text("mitigation_plan"),
  status: text("status", { enum: ["Open", "Mitigating", "Closed", "Accepted"] }).notNull().default("Open"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_risks_project").on(t.projectId),
  statusIdx: index("idx_risks_status").on(t.status),
}));

// Ideas / Product Backlog.
export const ideas = sqliteTable("ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  impact: integer("impact").notNull().default(3),
  effort: integer("effort").notNull().default(3),
  priority: text("priority", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  status: text("status", { enum: ["New", "Under Review", "Approved", "Rejected", "Converted"] }).notNull().default("New"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_ideas_project").on(t.projectId),
  statusIdx: index("idx_ideas_status").on(t.status),
}));

// Milestones.
export const milestones = sqliteTable("milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetDate: integer("target_date", { mode: "timestamp" }),
  status: text("status", { enum: ["Upcoming", "In Progress", "Done", "Missed"] }).notNull().default("Upcoming"),
  progress: integer("progress").notNull().default(0),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_milestones_project").on(t.projectId),
  statusIdx: index("idx_milestones_status").on(t.status),
}));

// Sprints — dev tasks link back via dev_tasks.sprint_id.
export const sprints = sqliteTable("sprints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  goal: text("goal"),
  status: text("status", { enum: ["Planned", "Active", "Completed"] }).notNull().default("Planned"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_sprints_project").on(t.projectId),
  statusIdx: index("idx_sprints_status").on(t.status),
}));

// --- Many-to-many junctions ---

export const releaseFeatures = sqliteTable("release_features", {
  releaseId: integer("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  featureId: integer("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.releaseId, t.featureId] }) }));

export const releaseBugs = sqliteTable("release_bugs", {
  releaseId: integer("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  bugId: integer("bug_id").notNull().references(() => bugs.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.releaseId, t.bugId] }) }));

// Task dependency edges (task blocked_by dependsOnTask).
export const devTaskDeps = sqliteTable("dev_task_deps", {
  taskId: integer("task_id").notNull().references(() => devTasks.id, { onDelete: "cascade" }),
  dependsOnId: integer("depends_on_id").notNull().references(() => devTasks.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.taskId, t.dependsOnId] }) }));

// PM activity feed (shared across all modules).
export const pmActivity = sqliteTable("pm_activity", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  entityId: integer("entity_id").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (t) => ({
  projectIdx: index("idx_pm_activity_project").on(t.projectId),
  createdAtIdx: index("idx_pm_activity_created_at").on(t.createdAt),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));
