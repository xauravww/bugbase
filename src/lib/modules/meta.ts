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
  | "relation";

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
      { key: "status", label: "Status", type: "select", options: ["Draft", "Approved", "In Progress", "Done", "Rejected"], default: "Draft", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "acceptanceCriteria", label: "Acceptance Criteria", type: "textarea", placeholder: "Given / When / Then…" },
      { key: "parentId", label: "Parent Requirement", type: "relation", relation: "requirements" },
    ],
  },
  features: {
    slug: "features", label: "Features", singular: "Feature", icon: "Sparkles",
    statusKey: "status", views: ["table", "kanban", "list"], defaultSort: "updatedAt",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, isTitle: true, inList: true },
      { key: "status", label: "Status", type: "select", options: ["Proposed", "In Progress", "Done", "Cancelled"], default: "Proposed", inList: true },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY, default: "Medium", inList: true },
      { key: "storyPoints", label: "Story Points", type: "number", inList: true },
      { key: "epic", label: "Epic", type: "text" },
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
      { key: "dueDate", label: "Due Date", type: "date", inList: true },
      { key: "estimatedTime", label: "Estimated (h)", type: "number" },
      { key: "actualTime", label: "Actual (h)", type: "number" },
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
