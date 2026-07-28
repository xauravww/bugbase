/**
 * Client-safe module metadata — NO server imports (no drizzle).
 *
 * Both the browser UI and the server registry consume this. The server
 * registry (registry.ts) additionally attaches the drizzle table ref per
 * module; the UI uses this file directly. Single source for fields, enums,
 * views and links.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "select"
  | "date"
  | "relation"
  | "tags";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  relation?: string; // module slug, or "users"
  required?: boolean;
  inList?: boolean;
  isTitle?: boolean;
  default?: string | number;
  placeholder?: string;
  mono?: boolean;
}

export type ViewKind = "table" | "kanban" | "list" | "calendar" | "timeline" | "gantt";

export interface ModuleMeta {
  slug: string;
  label: string;
  singular: string;
  icon: string;
  statusKey?: string;
  dateKey?: string;
  views: ViewKind[];
  defaultSort?: string;
  fields: FieldDef[];
}

const PRIORITY = ["Low", "Medium", "High", "Critical"] as const;

export const MODULE_META: Record<string, ModuleMeta> = {
  requirements: {
    slug: "requirements", label: "Requirements", singular: "Requirement", icon: "FileText",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "type", label: "Type", type: "select", options: ["Feature", "Bug", "Enhancement", "Research"], default: "Feature", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Approved", "In Progress", "Done", "Rejected"], default: "Active", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "acceptanceCriteria", label: "Acceptance Criteria", type: "textarea", placeholder: "Given / When / Then…" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
      { key: "parentId", label: "Parent Requirement", type: "relation", relation: "requirements" },
    ],
  },
  features: {
    slug: "features", label: "Features", singular: "Feature", icon: "Sparkles",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["Proposed", "Active", "In Progress", "Done", "Cancelled"], default: "Active", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "storyPoints", label: "Story Points", type: "number", inList: true },
      { key: "epic", label: "Epic", type: "text" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
      { key: "requirementId", label: "Linked Requirement", type: "relation", relation: "requirements" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  "dev-tasks": {
    slug: "dev-tasks", label: "Tasks", singular: "Task", icon: "CheckSquare",
    statusKey: "status", dateKey: "dueDate",
    views: ["table", "kanban", "list", "calendar", "timeline", "gantt"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Review", "Testing", "Done"], default: "Todo", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "assigneeId", label: "Assignee", type: "relation", relation: "users", inList: true },
      { key: "startDate", label: "Start Date", type: "date", inList: true },
      { key: "dueDate", label: "Due Date", type: "date", inList: true },
      { key: "estimatedTime", label: "Estimated (h)", type: "number" },
      { key: "actualTime", label: "Actual (h)", type: "number" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
      { key: "featureId", label: "Linked Feature", type: "relation", relation: "features" },
      { key: "requirementId", label: "Linked Requirement", type: "relation", relation: "requirements" },
      { key: "sprintId", label: "Sprint", type: "relation", relation: "sprints" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  bugs: {
    slug: "bugs", label: "Bugs", singular: "Bug", icon: "Bug",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "severity", label: "Severity", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Resolved", "Closed", "Won't Fix"], default: "Open", inList: true },
      { key: "environment", label: "Environment", type: "select", options: ["Dev", "Staging", "Production"], default: "Dev", inList: true },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
      { key: "taskId", label: "Linked Task", type: "relation", relation: "dev-tasks" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "stepsToReproduce", label: "Steps to Reproduce", type: "textarea" },
      { key: "expectedResult", label: "Expected Result", type: "textarea" },
      { key: "actualResult", label: "Actual Result", type: "textarea" },
    ],
  },
  releases: {
    slug: "releases", label: "Releases", singular: "Release", icon: "Rocket",
    statusKey: "status", dateKey: "releaseDate",
    views: ["table", "kanban", "list", "calendar", "timeline"], defaultSort: "releaseDate",
    fields: [
      { key: "version", label: "Version", type: "text", required: true, isTitle: true, inList: true, mono: true, placeholder: "v1.0.0" },
      { key: "status", label: "Status", type: "select", options: ["Planned", "In Progress", "Released", "Rolled Back"], default: "Planned", inList: true },
      { key: "releaseDate", label: "Release Date", type: "date", inList: true },
      { key: "releaseNotes", label: "Release Notes", type: "richtext" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  "api-docs": {
    slug: "api-docs", label: "API Docs", singular: "Endpoint", icon: "Code2",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "endpoint", label: "Endpoint", type: "text", required: true, isTitle: true, inList: true, mono: true, placeholder: "/api/v1/resource" },
      { key: "httpMethod", label: "Method", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"], default: "GET", inList: true },
      { key: "authentication", label: "Auth", type: "select", options: ["None", "Bearer", "API Key", "OAuth"], default: "None", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Stable", "Deprecated"], default: "Draft", inList: true },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
      { key: "requestBody", label: "Request Body", type: "textarea", mono: true },
      { key: "responseBody", label: "Response Body", type: "textarea", mono: true },
    ],
  },
  "arch-docs": {
    slug: "arch-docs", label: "Tech Docs", singular: "Document", icon: "BookOpen",
    statusKey: "category", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "category", label: "Category", type: "select", options: ["Architecture", "Design", "Decision", "Runbook", "Diagram"], default: "Architecture", inList: true },
      { key: "content", label: "Content", type: "richtext" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  "meeting-notes": {
    slug: "meeting-notes", label: "Meeting Notes", singular: "Meeting", icon: "CalendarClock",
    dateKey: "meetingDate", views: ["table", "list", "calendar"], defaultSort: "meetingDate",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "meetingDate", label: "Date", type: "date", inList: true },
      { key: "participants", label: "Participants", type: "text", placeholder: "Comma-separated" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "decisions", label: "Decisions", type: "textarea" },
      { key: "actionItems", label: "Action Items", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  risks: {
    slug: "risks", label: "Risks", singular: "Risk", icon: "AlertTriangle",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "impact", label: "Impact", type: "select", options: ["Low", "Medium", "High"], default: "Medium", inList: true },
      { key: "probability", label: "Probability", type: "select", options: ["Low", "Medium", "High"], default: "Medium", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Open", "Mitigating", "Closed", "Accepted"], default: "Open", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "mitigationPlan", label: "Mitigation Plan", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  ideas: {
    slug: "ideas", label: "Ideas", singular: "Idea", icon: "Lightbulb",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "impact", label: "Impact (1-5)", type: "number", default: 3, inList: true },
      { key: "effort", label: "Effort (1-5)", type: "number", default: 3, inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "status", label: "Status", type: "select", options: ["New", "Under Review", "Approved", "Rejected", "Converted"], default: "New", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  milestones: {
    slug: "milestones", label: "Milestones", singular: "Milestone", icon: "Flag",
    statusKey: "status", dateKey: "targetDate",
    views: ["table", "list", "calendar", "timeline", "gantt"], defaultSort: "targetDate",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, isTitle: true, inList: true },
      { key: "targetDate", label: "Target Date", type: "date", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Upcoming", "In Progress", "Done", "Missed"], default: "Upcoming", inList: true },
      { key: "progress", label: "Progress (%)", type: "number", default: 0, inList: true },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  sprints: {
    slug: "sprints", label: "Sprints", singular: "Sprint", icon: "Timer",
    statusKey: "status", dateKey: "startDate",
    views: ["table", "kanban", "list", "calendar", "timeline"], defaultSort: "startDate",
    fields: [
      { key: "name", label: "Sprint Name", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["Planned", "Active", "Completed"], default: "Planned", inList: true },
      { key: "startDate", label: "Start Date", type: "date", inList: true },
      { key: "endDate", label: "End Date", type: "date", inList: true },
      { key: "goal", label: "Goal", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  "user-stories": {
    slug: "user-stories", label: "User Stories", singular: "User Story", icon: "ScrollText",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Ready", "In Progress", "Done", "Rejected"], default: "Active", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "role", label: "As a…", type: "text", placeholder: "type of user" },
      { key: "goal", label: "I want to…", type: "text", placeholder: "goal" },
      { key: "benefit", label: "So that…", type: "text", placeholder: "benefit" },
      { key: "acceptanceCriteria", label: "Acceptance Criteria", type: "textarea", placeholder: "Given / When / Then…" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
      { key: "requirementId", label: "Linked Requirement", type: "relation", relation: "requirements" },
    ],
  },
  personas: {
    slug: "personas", label: "Personas", singular: "Persona", icon: "Users",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, isTitle: true, inList: true },
      { key: "role", label: "Role / Job Title", type: "text", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Archived"], default: "Draft", inList: true },
      { key: "goals", label: "Goals", type: "textarea" },
      { key: "painPoints", label: "Pain Points", type: "textarea" },
      { key: "behaviors", label: "Behaviors", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  "user-journeys": {
    slug: "user-journeys", label: "User Journeys", singular: "User Journey", icon: "Route",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "stage", label: "Stage", type: "select", options: ["Awareness", "Consideration", "Decision", "Onboarding", "Retention"], default: "Awareness", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "In Review", "Approved"], default: "Draft", inList: true },
      { key: "persona", label: "Persona", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "touchpoints", label: "Touchpoints", type: "textarea" },
      { key: "painPoints", label: "Pain Points", type: "textarea" },
      { key: "opportunities", label: "Opportunities", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  "tech-stack": {
    slug: "tech-stack", label: "Tech Stack", singular: "Technology", icon: "Layers",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, isTitle: true, inList: true },
      { key: "category", label: "Category", type: "select", options: ["Frontend", "Backend", "Database", "DevOps", "Testing", "Mobile", "Other"], default: "Backend", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Evaluating", "Adopted", "Deprecated"], default: "Evaluating", inList: true },
      { key: "version", label: "Version", type: "text", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "rationale", label: "Rationale", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  mockups: {
    slug: "mockups", label: "Mockups", singular: "Mockup", icon: "Frame",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "screen", label: "Screen / Page", type: "text", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "In Review", "Approved", "Needs Revision"], default: "Draft", inList: true },
      { key: "url", label: "Design URL", type: "text", placeholder: "https://figma.com/…" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  workflows: {
    slug: "workflows", label: "Workflows", singular: "Workflow", icon: "GitBranch",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Deprecated"], default: "Draft", inList: true },
      { key: "trigger", label: "Trigger", type: "text", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "steps", label: "Steps", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  "business-rules": {
    slug: "business-rules", label: "Business Rules", singular: "Business Rule", icon: "Scale",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "category", label: "Category", type: "select", options: ["Validation", "Authorization", "Calculation", "Process", "Constraint"], default: "Validation", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Active", "Deprecated"], default: "Draft", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "condition", label: "Condition", type: "textarea" },
      { key: "action", label: "Action", type: "textarea" },
      { key: "tags", label: "Tags", type: "tags", inList: true, placeholder: "Comma-separated" },
    ],
  },
  issues: {
    slug: "issues", label: "Issues", singular: "Issue", icon: "Bug",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "type", label: "Type", type: "select", options: ["Bug", "Feature", "Task", "Improvement"], default: "Bug", inList: true },
      { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Closed", "Resolved"], default: "Open", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "stepsToReproduce", label: "Steps to Reproduce", type: "textarea" },
      { key: "expectedResult", label: "Expected Result", type: "textarea" },
      { key: "actualResult", label: "Actual Result", type: "textarea" },
    ],
  },
  "test-cases": {
    slug: "test-cases", label: "Test Cases", singular: "Test Case", icon: "CheckSquare",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "steps", label: "Steps", type: "textarea" },
      { key: "expectedResult", label: "Expected Result", type: "textarea" },
    ],
  },
  tasks: {
    slug: "tasks", label: "Tasks", singular: "Task", icon: "CheckSquare",
    statusKey: "status", views: ["table", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["active", "completed"], default: "active", inList: true },
      { key: "priority", label: "Priority", type: "select", options: ["none", "low", "medium", "high"], default: "none", inList: true },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
};

export const META_LIST = Object.values(MODULE_META);

export function getMeta(slug: string): ModuleMeta | undefined {
  return MODULE_META[slug];
}

export function titleField(m: ModuleMeta): string {
  return m.fields.find((f) => f.isTitle)?.key ?? m.fields[0].key;
}

export function listFields(m: ModuleMeta): FieldDef[] {
  return m.fields.filter((f) => f.inList);
}
