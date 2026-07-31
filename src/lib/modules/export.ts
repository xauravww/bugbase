/**
 * Workspace export collector.
 *
 * Pulls every record of the selected PM modules for one project and flattens
 * them into a render-agnostic shape (`ExportSection[]`) that both the PDF and
 * the Excel writer consume. Relations are resolved to human-readable names
 * here so neither renderer needs database access.
 */
import { db } from "@/lib/db";
import {
  users, projects, issues, issueAssignees, lists, tasks, subtasks, taskAssignees,
} from "@/lib/db/schema";
import { asc, eq, inArray, isNull, and } from "drizzle-orm";
import { MODULES, type ModuleDef } from "./registry";
import { titleField, type FieldType } from "./meta";
import { EXTRA_META, EXTRA_SLUGS, isExtraSlug } from "./export-extras";

/** Placeholder written wherever a record has no value for a field. */
export const EMPTY_VALUE = "No item present";

export interface ExportColumn {
  key: string;
  label: string;
  /** Long-form fields render as stacked blocks in the PDF instead of table cells. */
  long: boolean;
  /** Source field type ("meta" for the id / audit columns the registry omits). */
  type: FieldType | "meta";
}

export interface ExportSection {
  slug: string;
  label: string;
  singular: string;
  columns: ExportColumn[];
  /** Column key holding the record's display title. */
  titleKey: string;
  /** Column key the module treats as its status, when it has one. */
  statusKey?: string;
  /** Value → count for the status column, for the section opener chart. */
  statusBreakdown: { value: string; count: number }[];
  rows: Record<string, string>[];
}

export interface ExportBundle {
  project: { id: number; name: string; key: string };
  generatedAt: Date;
  generatedBy: string;
  sections: ExportSection[];
  totalRecords: number;
}

const LONG_TYPES = new Set(["textarea", "richtext"]);

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v as string | number);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v as string | number);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

/** Strip the markdown noise that would otherwise land verbatim in a PDF cell. */
function plain(v: string): string {
  return v
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`{1,3}|~~)/g, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Value → count for a status column, ordered by the field's own option list so
 * "Open → Closed" reads left-to-right rather than alphabetically.
 */
function tallyStatus(
  rows: Record<string, string>[],
  statusKey: string | undefined,
  options?: readonly string[]
): { value: string; count: number }[] {
  if (!statusKey) return [];
  const tally = new Map<string, number>();
  for (const r of rows) tally.set(r[statusKey], (tally.get(r[statusKey]) ?? 0) + 1);
  const out: { value: string; count: number }[] = [];
  const seen = new Set<string>();
  for (const v of [...(options ?? []), ...tally.keys()]) {
    if (seen.has(v) || !tally.has(v)) continue;
    seen.add(v);
    out.push({ value: v, count: tally.get(v)! });
  }
  return out;
}

type UserMap = Map<number, string>;

const ISSUE_STATUS = ["Open", "In Progress", "In Review", "Verified", "Closed"] as const;

/** The project's Issues tab, with assignees resolved to names. */
async function collectIssues(projectId: number, userMap: UserMap): Promise<ExportSection> {
  const meta = EXTRA_META.issues;
  const rowsRaw = await db
    .select()
    .from(issues)
    .where(eq(issues.projectId, projectId))
    .orderBy(asc(issues.id));

  const ids = rowsRaw.map((r) => r.id);
  const assignees = new Map<number, string[]>();
  if (ids.length > 0) {
    const links = await db
      .select({ issueId: issueAssignees.issueId, userId: issueAssignees.userId })
      .from(issueAssignees)
      .where(inArray(issueAssignees.issueId, ids));
    for (const l of links) {
      const list = assignees.get(l.issueId) ?? [];
      list.push(userMap.get(l.userId) ?? `User #${l.userId}`);
      assignees.set(l.issueId, list);
    }
  }

  const columns: ExportColumn[] = [
    { key: "id", label: "ID", long: false, type: "meta" },
    { key: "title", label: "Title", long: false, type: "text" },
    { key: "type", label: "Type", long: false, type: "select" },
    { key: "status", label: "Status", long: false, type: "select" },
    { key: "priority", label: "Priority", long: false, type: "select" },
    { key: "isVerified", label: "Verified", long: false, type: "select" },
    { key: "assignees", label: "Assignees", long: false, type: "text" },
    { key: "reporter", label: "Reporter", long: false, type: "text" },
    { key: "startDate", label: "Start Date", long: false, type: "date" },
    { key: "dueDate", label: "Due Date", long: false, type: "date" },
    { key: "description", label: "Description", long: true, type: "textarea" },
    { key: "stepsToReproduce", label: "Steps to Reproduce", long: true, type: "textarea" },
    { key: "expectedResult", label: "Expected Result", long: true, type: "textarea" },
    { key: "actualResult", label: "Actual Result", long: true, type: "textarea" },
    { key: "createdBy", label: "Created By", long: false, type: "meta" },
    { key: "createdAt", label: "Created", long: false, type: "meta" },
    { key: "updatedAt", label: "Updated", long: false, type: "meta" },
  ];

  const rows = [...rowsRaw]
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0) || b.id - a.id)
    .map((r) => {
      const reporter = userMap.get(r.reporterId) ?? `User #${r.reporterId}`;
      return {
        id: `#${r.id}`,
        title: r.title || EMPTY_VALUE,
        type: r.type,
        status: r.status,
        priority: r.priority,
        isVerified: r.isVerified ? "Verified" : "Not verified",
        assignees: assignees.get(r.id)?.join(", ") || EMPTY_VALUE,
        reporter,
        startDate: fmtDate(r.startDate) || EMPTY_VALUE,
        dueDate: fmtDate(r.dueDate) || EMPTY_VALUE,
        description: plain(r.description ?? "") || EMPTY_VALUE,
        stepsToReproduce: plain(r.stepsToReproduce ?? "") || EMPTY_VALUE,
        expectedResult: plain(r.expectedResult ?? "") || EMPTY_VALUE,
        actualResult: plain(r.actualResult ?? "") || EMPTY_VALUE,
        createdBy: reporter,
        createdAt: fmtDateTime(r.createdAt) || EMPTY_VALUE,
        updatedAt: fmtDateTime(r.updatedAt) || EMPTY_VALUE,
      } satisfies Record<string, string>;
    });

  return {
    slug: meta.slug,
    label: meta.label,
    singular: meta.singular,
    columns,
    titleKey: "title",
    statusKey: "status",
    statusBreakdown: tallyStatus(rows, "status", ISSUE_STATUS),
    rows,
  };
}

const TASK_STATUS = ["Active", "Completed"] as const;

function titleCase(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

/**
 * The project's Tasks tab. Tasks hang off lists rather than the project, so the
 * list is resolved to a column and its subtasks are folded into one field —
 * a separate section per list would fragment the document.
 */
async function collectTasks(projectId: number, userMap: UserMap): Promise<ExportSection> {
  const meta = EXTRA_META.tasks;
  const listRows = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(and(eq(lists.projectId, projectId), isNull(lists.deletedAt)));
  const listMap = new Map(listRows.map((l) => [l.id, l.name]));
  const listIds = listRows.map((l) => l.id);

  const taskRows = listIds.length
    ? await db
        .select()
        .from(tasks)
        .where(and(inArray(tasks.listId, listIds), isNull(tasks.deletedAt)))
    : [];

  const taskIds = taskRows.map((t) => t.id);
  const subMap = new Map<number, string[]>();
  const assigneeMap = new Map<number, string[]>();
  if (taskIds.length > 0) {
    const subRows = await db
      .select({ taskId: subtasks.taskId, title: subtasks.title, status: subtasks.status })
      .from(subtasks)
      .where(and(inArray(subtasks.taskId, taskIds), isNull(subtasks.deletedAt)))
      .orderBy(asc(subtasks.sortOrder));
    for (const s of subRows) {
      const list = subMap.get(s.taskId) ?? [];
      list.push(`${s.status === "completed" ? "[x]" : "[ ]"} ${s.title}`);
      subMap.set(s.taskId, list);
    }

    const links = await db
      .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(inArray(taskAssignees.taskId, taskIds));
    for (const l of links) {
      const list = assigneeMap.get(l.taskId) ?? [];
      list.push(userMap.get(l.userId) ?? `User #${l.userId}`);
      assigneeMap.set(l.taskId, list);
    }
  }

  const columns: ExportColumn[] = [
    { key: "id", label: "ID", long: false, type: "meta" },
    { key: "title", label: "Title", long: false, type: "text" },
    { key: "status", label: "Status", long: false, type: "select" },
    { key: "priority", label: "Priority", long: false, type: "select" },
    { key: "list", label: "List", long: false, type: "text" },
    { key: "assignees", label: "Assignees", long: false, type: "text" },
    { key: "dueDate", label: "Due Date", long: false, type: "date" },
    { key: "completedAt", label: "Completed", long: false, type: "date" },
    { key: "completedBy", label: "Completed By", long: false, type: "text" },
    { key: "description", label: "Description", long: true, type: "textarea" },
    { key: "subtasks", label: "Subtasks", long: true, type: "textarea" },
    { key: "createdBy", label: "Created By", long: false, type: "meta" },
    { key: "createdAt", label: "Created", long: false, type: "meta" },
    { key: "updatedAt", label: "Updated", long: false, type: "meta" },
  ];

  const rows = [...taskRows]
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0) || b.id - a.id)
    .map((t) => ({
      id: `#${t.id}`,
      title: t.title || EMPTY_VALUE,
      status: titleCase(t.status),
      priority: t.priority === "none" ? EMPTY_VALUE : titleCase(t.priority),
      list: listMap.get(t.listId) ?? EMPTY_VALUE,
      assignees: assigneeMap.get(t.id)?.join(", ") || EMPTY_VALUE,
      dueDate: fmtDate(t.dueDate) || EMPTY_VALUE,
      completedAt: fmtDateTime(t.completedAt) || EMPTY_VALUE,
      completedBy: t.completedBy ? userMap.get(t.completedBy) ?? `User #${t.completedBy}` : EMPTY_VALUE,
      description: plain(t.description ?? "") || EMPTY_VALUE,
      subtasks: subMap.get(t.id)?.join("\n") || EMPTY_VALUE,
      createdBy: userMap.get(t.createdBy) ?? EMPTY_VALUE,
      createdAt: fmtDateTime(t.createdAt) || EMPTY_VALUE,
      updatedAt: fmtDateTime(t.updatedAt) || EMPTY_VALUE,
    }));

  return {
    slug: meta.slug,
    label: meta.label,
    singular: meta.singular,
    columns,
    titleKey: "title",
    statusKey: "status",
    statusBreakdown: tallyStatus(rows, "status", TASK_STATUS),
    rows,
  };
}

/**
 * Build the export payload. `slugs` is filtered against the registry, so an
 * unknown slug is skipped rather than throwing. Modules with zero records are
 * kept only when `includeEmpty` is set — the picker already hides them.
 */
export async function collectExport(
  projectId: number,
  slugs: string[],
  opts: { generatedBy: string; includeEmpty?: boolean }
): Promise<ExportBundle> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new Error("Project not found");

  const mods = slugs.map((s) => MODULES[s]).filter(Boolean) as ModuleDef[];

  const userRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(asc(users.id));
  const userMap = new Map(userRows.map((u) => [u.id, u.name]));

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Raw rows per module, fetched once and reused for relation lookups so a
  // module referenced by another does not get queried twice.
  const rawCache = new Map<string, any[]>();
  const fetchRaw = async (m: ModuleDef): Promise<any[]> => {
    const hit = rawCache.get(m.slug);
    if (hit) return hit;
    const table = m.table as any;
    let rows: any[] = [];
    try {
      rows = (await db.select().from(table).where(eq(table.projectId, projectId))) as any[];
    } catch (error) {
      // A missing table must not sink the whole export.
      console.error(`[pm/export] ${m.slug} fetch failed:`, error);
    }
    rawCache.set(m.slug, rows);
    return rows;
  };

  // Relation targets referenced by the selected modules (may be outside the selection).
  const relationTargets = new Set<string>();
  for (const m of mods) {
    for (const f of m.fields) {
      if (f.type === "relation" && f.relation && f.relation !== "users") relationTargets.add(f.relation);
    }
  }
  const relationTitles = new Map<string, Map<number, string>>();
  for (const slug of relationTargets) {
    const target = MODULES[slug];
    if (!target) continue;
    const rows = await fetchRaw(target);
    const tKey = titleField(target);
    relationTitles.set(slug, new Map(rows.map((r) => [r.id as number, String(r[tKey] ?? `#${r.id}`)])));
  }

  const sections: ExportSection[] = [];
  let totalRecords = 0;

  for (const m of mods) {
    const raw = await fetchRaw(m);
    const sortKey = m.defaultSort ?? "createdAt";
    const sorted = [...raw].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const an = av instanceof Date ? av.getTime() : typeof av === "number" ? av : 0;
      const bn = bv instanceof Date ? bv.getTime() : typeof bv === "number" ? bv : 0;
      if (an !== bn) return bn - an;
      return (b.id as number) - (a.id as number);
    });

    if (sorted.length === 0 && !opts.includeEmpty) continue;

    const columns: ExportColumn[] = [
      { key: "id", label: "ID", long: false, type: "meta" },
      ...m.fields.map((f) => ({
        key: f.key,
        label: f.label,
        long: LONG_TYPES.has(f.type),
        type: f.type as FieldType,
      })),
      { key: "createdBy", label: "Created By", long: false, type: "meta" },
      { key: "createdAt", label: "Created", long: false, type: "meta" },
      { key: "updatedAt", label: "Updated", long: false, type: "meta" },
    ];

    const rows = sorted.map((r) => {
      const out: Record<string, string> = { id: `#${r.id}` };
      for (const f of m.fields) {
        const v = r[f.key];
        let s = "";
        if (v !== null && v !== undefined && v !== "") {
          if (f.type === "date") s = fmtDate(v);
          else if (f.type === "relation") {
            const n = Number(v);
            s = f.relation === "users"
              ? userMap.get(n) ?? `User #${n}`
              : relationTitles.get(f.relation ?? "")?.get(n) ?? `#${n}`;
          } else if (LONG_TYPES.has(f.type)) s = plain(String(v));
          else s = String(v);
        }
        out[f.key] = s || EMPTY_VALUE;
      }
      out.createdBy = userMap.get(r.createdBy as number) ?? EMPTY_VALUE;
      out.createdAt = fmtDateTime(r.createdAt) || EMPTY_VALUE;
      out.updatedAt = fmtDateTime(r.updatedAt) || EMPTY_VALUE;
      return out;
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const statusKey = m.statusKey;
    const statusField = statusKey ? m.fields.find((f) => f.key === statusKey) : undefined;

    totalRecords += rows.length;
    sections.push({
      slug: m.slug,
      label: m.label,
      singular: m.singular,
      columns,
      titleKey: titleField(m),
      statusKey,
      statusBreakdown: tallyStatus(rows, statusKey, statusField?.options),
      rows,
    });
  }

  // Extras — Issues and Tasks live outside the PM registry but belong in a
  // "full workspace" export, so they are collected with their own queries.
  for (const slug of slugs) {
    if (!isExtraSlug(slug)) continue;
    const section = slug === "issues"
      ? await collectIssues(projectId, userMap)
      : await collectTasks(projectId, userMap);
    if (section.rows.length === 0 && !opts.includeEmpty) continue;
    totalRecords += section.rows.length;
    sections.push(section);
  }

  return {
    project: { id: project.id, name: project.name, key: project.key },
    generatedAt: new Date(),
    generatedBy: opts.generatedBy,
    sections,
    totalRecords,
  };
}

/** Every exportable slug: the PM registry first, then Issues and Tasks. */
export const ALL_EXPORT_SLUGS: string[] = [...Object.keys(MODULES), ...EXTRA_SLUGS];

/** Filter + order the requested slugs; unknown ones are dropped. */
export function orderedSlugs(slugs: string[]): string[] {
  const wanted = new Set(slugs);
  return ALL_EXPORT_SLUGS.filter((s) => wanted.has(s));
}
