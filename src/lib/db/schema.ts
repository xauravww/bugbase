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
  priority: text("priority", { enum: ["Low", "Medium", "High", "Critical"] }).notNull().default("Medium"),
  reporterId: integer("reporter_id").notNull().references(() => users.id),
  startDate: integer("start_date", { mode: "timestamp" }),
  dueDate: integer("due_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => ({
  projectIdx: index("idx_issues_project").on(table.projectId),
  statusIdx: index("idx_issues_status").on(table.status),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  projectMemberships: many(projectMembers),
  reportedIssues: many(issues),
  comments: many(comments),
  activities: many(activityLog),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  members: many(projectMembers),
  issues: many(issues),
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
