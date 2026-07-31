/**
 * Read-only tools the Ask agent may call against one project, defined for the
 * Vercel AI SDK (`tool()` + zod schemas, so the SDK validates arguments and
 * repairs malformed calls before we ever run a query).
 *
 * Every tool closes over a single `projectId` supplied by the route after the
 * caller's access has been checked — the model never gets to choose which
 * project it reads, so a prompt-injected "now read project 9" cannot escape
 * the authorised scope. Nothing here writes.
 *
 * Numbers come from the shared snapshot (project-intel.ts), so a figure quoted
 * in chat and the same figure in a generated report always agree.
 */
import { tool, type Tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { eq, and, isNull, inArray, like, or, sql } from "drizzle-orm";
import { issues, lists, tasks, users, projectMembers } from "@/lib/db/schema";
import { MODULES } from "@/lib/modules/registry";
import { MODULE_META, titleField } from "@/lib/modules/meta";
import { EXTRA_LIST } from "@/lib/modules/export-extras";
import {
  buildSnapshot, renderItem, type ProjectSnapshot, type Bucket,
  STALE_DAYS, DUE_SOON_DAYS, VELOCITY_WINDOW_DAYS,
} from "./project-intel";

/** Hard ceiling on rows any single tool call may return. */
const ROW_LIMIT = 60;

const ALL_SLUGS = [...Object.keys(MODULE_META), ...EXTRA_LIST.map((e) => e.slug)];

/** A download button the model asked the UI to render. */
export interface ExportProposal {
  modules: string[];
  format: "pdf" | "excel" | "both";
  label: string;
}

/** Per-request state: snapshot cache plus the export buttons to render. */
export interface AgentSession {
  projectId: number;
  snapshots: Map<string, ProjectSnapshot>;
  exports: ExportProposal[];
  /** Data tools that returned successfully, for the empty-answer fallback. */
  facts: { tool: string; output: unknown }[];
}

export function newSession(projectId: number): AgentSession {
  return { projectId, snapshots: new Map(), exports: [], facts: [] };
}

const dateArg = z
  .string()
  .describe("ISO date, YYYY-MM-DD")
  .optional();

function parseDate(v: string | undefined, fallback: Date): Date {
  if (!v?.trim()) return fallback;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Snapshot for a date window, memoised per request. */
async function snapshotFor(
  s: AgentSession,
  startDate?: string,
  endDate?: string
): Promise<ProjectSnapshot> {
  const start = parseDate(startDate, new Date(Date.now() - 30 * 86_400_000));
  const end = endDate ? parseDate(endDate, new Date()) : null;
  if (end) end.setHours(23, 59, 59, 999);
  const key = `${start.getTime()}:${end?.getTime() ?? 0}`;
  const hit = s.snapshots.get(key);
  if (hit) return hit;
  const snap = await buildSnapshot(s.projectId, { start, end });
  s.snapshots.set(key, snap);
  return snap;
}

/**
 * Serialise a bucket keeping its exact total intact. Filters narrow the sample
 * rows only, so the reported total is never quietly reduced by a filter.
 */
function bucketPayload(b: Bucket, filters: { assignee?: string; priority?: string }) {
  let items = b.items;
  const notes: string[] = [];
  if (filters.assignee) {
    const needle = filters.assignee.toLowerCase();
    items = items.filter((i) => i.assignees.some((a) => a.toLowerCase().includes(needle)));
    notes.push(`Filtered to assignee "${filters.assignee}" within the listed rows only; total_exact is unfiltered.`);
  }
  if (filters.priority) {
    items = items.filter((i) => i.priority === filters.priority);
    notes.push(`Filtered to priority ${filters.priority} within the listed rows only.`);
  }
  return {
    total_exact: b.total,
    shown: Math.min(items.length, ROW_LIMIT),
    not_shown: b.hidden,
    note: notes.length ? notes.join(" ") : undefined,
    items: items.slice(0, ROW_LIMIT).map(renderItem),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Build the tool set for one authorised project. Returns SDK tools; the route
 * hands these to `generateText` and the SDK runs the loop.
 */
export function buildAgentTools(session: AgentSession): Record<string, Tool> {
  const projectId = session.projectId;

  /**
   * Remember what a data tool returned. Some models spend their whole step
   * budget on tool calls and stop without writing prose; the route uses these
   * recorded facts to compose a usable answer rather than returning nothing.
   */
  const remember = <T>(name: string, output: T): T => {
    session.facts.push({ tool: name, output });
    return output;
  };

  return {
    get_project_overview: tool({
      description:
        "Authoritative project status: exact counts of open/completed/overdue/unassigned/stale work, " +
        "completion rate, velocity, per-member load and module totals. Call this FIRST for any question " +
        "about overall status, progress or health. These counts are exact — never contradict them.",
      inputSchema: z.object({ startDate: dateArg, endDate: dateArg }),
      execute: async ({ startDate, endDate }) => {
        const s = await snapshotFor(session, startDate, endDate);
        return remember("get_project_overview", {
          project: `${s.project.name} (${s.project.key})`,
          period: s.range.label,
          exact_counts: s.health,
          definitions: {
            stale: `no update in ${STALE_DAYS}+ days`,
            due_soon: `due within ${DUE_SOON_DAYS} days`,
            blockers: "overdue, explicitly parked, or high/critical and stale",
            velocityPerWeek: `completions per week over the trailing ${VELOCITY_WINDOW_DAYS} days, not over the whole period`,
            completedInRange: "completions across the whole reporting period",
          },
          issue_status: s.issueStatus,
          issue_priority: s.issuePriority,
          modules: s.modules.map((m) => ({ slug: m.slug, total: m.total, updated_in_period: m.updatedInRange })),
          team: s.members,
        });
      },
    }),

    list_work_items: tool({
      description:
        "List work items from one bucket, with exact totals. Use for 'what is left', 'what is blocked', " +
        "'what is overdue', 'what did we finish'. Returns up to 60 rows plus a count of any not shown.",
      inputSchema: z.object({
        bucket: z
          .enum(["remaining", "completed", "blockers", "overdue", "due_soon", "unassigned", "stale"])
          .describe("Which set of items to list"),
        startDate: dateArg,
        endDate: dateArg,
        assignee: z.string().optional().describe("Narrow the listed rows to this person (name substring)"),
        priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
      }),
      execute: async ({ bucket, startDate, endDate, assignee, priority }) => {
        const s = await snapshotFor(session, startDate, endDate);
        const map: Record<string, Bucket> = {
          remaining: s.remaining,
          completed: s.completed,
          blockers: s.blockers,
          overdue: s.overdue,
          due_soon: s.dueSoon,
          unassigned: s.unassigned,
          stale: s.stale,
        };
        return remember("list_work_items", {
          bucket,
          period: s.range.label,
          ...bucketPayload(map[bucket], { assignee, priority }),
        });
      },
    }),

    get_module_breakdown: tool({
      description:
        "Status breakdown (value → count) for every workspace module that has records, plus its total. " +
        "Use for 'how much is in each module', coverage questions, or to decide what to export.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snapshotFor(session);
        return { modules: s.modules, note: "Modules with zero records are omitted." };
      },
    }),

    get_team_workload: tool({
      description:
        "Per-person open count, overdue count and completed-in-period count. Use for 'who is overloaded', " +
        "'what is X working on', 'who closed the most'.",
      inputSchema: z.object({ startDate: dateArg, endDate: dateArg }),
      execute: async ({ startDate, endDate }) => {
        const s = await snapshotFor(session, startDate, endDate);
        return { period: s.range.label, members: s.members, unassigned_open: s.health.unassigned };
      },
    }),

    get_forward_look: tool({
      description:
        "Upcoming milestones (with days until or past target), active and planned sprints, unreleased " +
        "releases, and open risks with their mitigation plans. Use for 'what is next', 'future goals', " +
        "'are we on track', 'what could go wrong'.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await snapshotFor(session);
        const nothingPlanned =
          s.upcoming.milestones.length === 0 &&
          s.upcoming.sprints.length === 0 &&
          s.upcoming.releases.length === 0;
        return {
          milestones: s.upcoming.milestones.map((m) => ({
            title: m.title,
            status: m.status,
            target: m.targetDate?.toISOString().slice(0, 10) ?? null,
            overdue_by_days: m.daysOut != null && m.daysOut > 0 ? m.daysOut : null,
            days_until: m.daysOut != null && m.daysOut <= 0 ? Math.abs(m.daysOut) : null,
          })),
          sprints: s.upcoming.sprints.map((sp) => ({
            name: sp.name,
            status: sp.status,
            start: sp.startDate?.toISOString().slice(0, 10) ?? null,
            end: sp.endDate?.toISOString().slice(0, 10) ?? null,
          })),
          releases: s.upcoming.releases.map((r) => ({
            version: r.version,
            status: r.status,
            target: r.releaseDate?.toISOString().slice(0, 10) ?? null,
          })),
          open_risks: s.risks,
          note: nothingPlanned
            ? "No milestones, sprints or releases are recorded for this project — future goals are not tracked yet. Say so; do not invent a roadmap."
            : undefined,
        };
      },
    }),

    get_work_logs: tool({
      description:
        "Manual work-log entries the team wrote for this project in a date range. Use when the user asks " +
        "what someone reported doing in their own words.",
      inputSchema: z.object({
        startDate: dateArg,
        endDate: dateArg,
        author: z.string().optional().describe("Filter to one person by name substring"),
      }),
      execute: async ({ startDate, endDate, author }) => {
        const s = await snapshotFor(session, startDate, endDate);
        const needle = author?.toLowerCase();
        const logs = s.manualLogs.filter((l) => !needle || l.author.toLowerCase().includes(needle));
        return {
          period: s.range.label,
          total: logs.length,
          logs: logs.slice(0, ROW_LIMIT).map((l) => ({
            date: l.date.toISOString().slice(0, 10),
            author: l.author,
            content: l.content,
          })),
        };
      },
    }),

    search_records: tool({
      description:
        "Full-text search across issue titles/descriptions and any workspace module. Use when the user " +
        "names a specific feature, bug or keyword and you need the matching records.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Keyword or phrase"),
        modules: z
          .array(z.string())
          .optional()
          .describe(`Restrict to these slugs. Valid: ${ALL_SLUGS.join(", ")}`),
      }),
      execute: async ({ query, modules }) => searchRecords(projectId, query, modules),
    }),

    list_module_records: tool({
      description:
        `List records of one workspace module, optionally filtered by status. Valid slugs: ${ALL_SLUGS.join(", ")}.`,
      inputSchema: z.object({
        module: z.string().describe("Module slug"),
        status: z.string().optional().describe("Exact status value to filter by"),
      }),
      execute: async ({ module, status }) => listModuleRecords(projectId, module, status),
    }),

    get_item_detail: tool({
      description:
        "Full detail of one record — description, repro steps, expected/actual, dates, assignees. " +
        "Use when the user asks about a specific numbered item.",
      inputSchema: z.object({
        module: z.string().describe("Module slug, or 'issues' / 'tasks'"),
        id: z.number().int().positive(),
      }),
      execute: async ({ module, id }) => itemDetail(projectId, module, id),
    }),

    propose_export: tool({
      description:
        "Offer the user a downloadable PDF or Excel report of specific modules. Call this whenever a " +
        "report or document is wanted, or when your answer covers data worth exporting. The UI renders " +
        "the download button — never write a URL yourself and never claim a file is attached.",
      inputSchema: z.object({
        modules: z
          .array(z.string())
          .min(1)
          .describe(`Module slugs to include, or ["all"]. Valid: ${ALL_SLUGS.join(", ")}`),
        format: z.enum(["pdf", "excel", "both"]).default("both"),
        label: z.string().optional().describe("Short button label, e.g. 'Remaining work report'"),
      }),
      execute: async ({ modules, format, label }) => {
        // Offering a download before reading anything produces a button with no
        // answer attached, which is exactly the "no clarity" failure this agent
        // exists to fix. Enforced here rather than in the prompt so it holds
        // regardless of how the model is feeling about instructions today.
        if (session.facts.length === 0) {
          return {
            error: "Gather the data first.",
            hint:
              "Call get_project_overview (and any other data tool you need) before proposing an " +
              "export, so your answer contains real findings alongside the download button.",
          };
        }

        // "all" is a sentinel the export route understands as "every module";
        // keeping it unexpanded avoids baking today's registry into the button.
        const valid = modules.includes("all")
          ? ["all"]
          : modules.filter((m) => MODULES[m] || EXTRA_LIST.some((e) => e.slug === m));
        if (valid.length === 0) {
          return {
            error: `None of [${modules.join(", ")}] is a valid module slug.`,
            valid: ALL_SLUGS,
            hint: 'Retry with real slugs, or ["all"] for the whole workspace.',
          };
        }
        const proposal: ExportProposal = {
          modules: valid,
          format,
          label: label?.trim() || "Project report",
        };
        session.exports.push(proposal);
        return {
          ok: true,
          rendered: `Download button(s) for "${proposal.label}" are now shown to the user.`,
          instruction:
            "The button is rendered. Now write your actual answer in prose: summarise the project " +
            "status and mention that the download is ready below. Do not invent a URL.",
        };
      },
    }),
  };
}

/** Search issue text plus the titles of PM modules. */
async function searchRecords(projectId: number, query: string, modules?: string[]) {
  const pattern = `%${query.trim()}%`;
  const targets = modules?.length
    ? modules
    : ["issues", "requirements", "features", "dev-tasks", "bugs", "user-stories"];

  const results: Record<string, string[]> = {};

  if (targets.includes("issues")) {
    const rows = await db
      .select({
        id: issues.id, title: issues.title, status: issues.status,
        priority: issues.priority, type: issues.type,
      })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), or(like(issues.title, pattern), like(issues.description, pattern))))
      .limit(ROW_LIMIT);
    if (rows.length) {
      results.issues = rows.map((r) => `Issue #${r.id} "${r.title}" [${r.type}] [${r.status}] [${r.priority}]`);
    }
  }

  if (targets.includes("tasks")) {
    const listIds = (
      await db.select({ id: lists.id }).from(lists)
        .where(and(eq(lists.projectId, projectId), isNull(lists.deletedAt)))
    ).map((l) => l.id);
    if (listIds.length) {
      const rows = await db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status })
        .from(tasks)
        .where(and(inArray(tasks.listId, listIds), isNull(tasks.deletedAt), like(tasks.title, pattern)))
        .limit(ROW_LIMIT);
      if (rows.length) results.tasks = rows.map((r) => `Task #${r.id} "${r.title}" [${r.status}]`);
    }
  }

  for (const slug of targets) {
    const mod = MODULES[slug];
    if (!mod) continue;
    const table = mod.table as any;
    const tKey = titleField(mod);
    try {
      const rows = (await db
        .select()
        .from(table)
        .where(and(eq(table.projectId, projectId), like(table[tKey], pattern)))
        .limit(ROW_LIMIT)) as any[];
      if (rows.length) {
        results[slug] = rows.map((r) => {
          const status = mod.statusKey ? ` [${r[mod.statusKey]}]` : "";
          return `${mod.singular} #${r.id} "${r[tKey]}"${status}`;
        });
      }
    } catch (error) {
      console.error(`[agent-tools] search ${slug} failed:`, error);
    }
  }

  const matches = Object.values(results).reduce((n, a) => n + a.length, 0);
  return {
    query,
    matches,
    results,
    note: matches === 0 ? "Nothing matched. Say so rather than guessing." : undefined,
  };
}

async function listModuleRecords(projectId: number, slug: string, status?: string) {
  if (slug === "issues") {
    const conds = [eq(issues.projectId, projectId)];
    if (status) conds.push(eq(issues.status, status as typeof issues.$inferSelect.status));
    const rows = await db.select().from(issues).where(and(...conds));
    return {
      module: "issues",
      total_exact: rows.length,
      shown: Math.min(rows.length, ROW_LIMIT),
      not_shown: Math.max(0, rows.length - ROW_LIMIT),
      records: rows.slice(0, ROW_LIMIT).map((r) => `#${r.id} "${r.title}" [${r.type}] [${r.status}] [${r.priority}]`),
    };
  }

  if (slug === "tasks") {
    const listRows = await db
      .select({ id: lists.id, name: lists.name })
      .from(lists)
      .where(and(eq(lists.projectId, projectId), isNull(lists.deletedAt)));
    const listMap = new Map(listRows.map((l) => [l.id, l.name]));
    const listIds = listRows.map((l) => l.id);
    const rows = listIds.length
      ? await db.select().from(tasks).where(and(inArray(tasks.listId, listIds), isNull(tasks.deletedAt)))
      : [];
    const filtered = status ? rows.filter((r) => r.status === status.toLowerCase()) : rows;
    return {
      module: "tasks",
      total_exact: filtered.length,
      shown: Math.min(filtered.length, ROW_LIMIT),
      not_shown: Math.max(0, filtered.length - ROW_LIMIT),
      records: filtered.slice(0, ROW_LIMIT).map(
        (r) => `#${r.id} "${r.title}" [${r.status}] (list: ${listMap.get(r.listId) ?? "?"})`
      ),
    };
  }

  const mod = MODULES[slug];
  if (!mod) return { error: `Unknown module "${slug}".`, valid: ALL_SLUGS };

  const table = mod.table as any;
  const tKey = titleField(mod);
  const conds = [eq(table.projectId, projectId)];
  if (status && mod.statusKey) conds.push(eq(table[mod.statusKey], status));
  const rows = (await db.select().from(table).where(and(...conds))) as any[];

  return {
    module: slug,
    label: mod.label,
    total_exact: rows.length,
    shown: Math.min(rows.length, ROW_LIMIT),
    not_shown: Math.max(0, rows.length - ROW_LIMIT),
    records: rows.slice(0, ROW_LIMIT).map((r) => {
      const st = mod.statusKey ? ` [${r[mod.statusKey]}]` : "";
      const pr = r.priority ? ` [${r.priority}]` : "";
      return `#${r.id} "${r[tKey]}"${st}${pr}`;
    }),
  };
}

async function itemDetail(projectId: number, slug: string, id: number) {
  if (slug === "issues") {
    const row = await db.query.issues.findFirst({
      where: and(eq(issues.id, id), eq(issues.projectId, projectId)),
    });
    if (!row) return { error: `Issue #${id} not found in this project.` };
    const names = await db
      .select({ name: users.name })
      .from(users)
      .innerJoin(sql`issue_assignees`, sql`issue_assignees.user_id = ${users.id}`)
      .where(sql`issue_assignees.issue_id = ${id}`)
      .catch(() => [] as { name: string }[]);
    return {
      ref: `Issue #${row.id}`,
      title: row.title,
      type: row.type,
      status: row.status,
      priority: row.priority,
      verified: row.isVerified,
      assignees: names.map((n) => n.name),
      startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      description: row.description,
      stepsToReproduce: row.stepsToReproduce,
      expectedResult: row.expectedResult,
      actualResult: row.actualResult,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  }

  if (slug === "tasks") {
    const row = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!row) return { error: `Task #${id} not found.` };
    const parent = await db.query.lists.findFirst({ where: eq(lists.id, row.listId) });
    if (!parent || parent.projectId !== projectId) {
      return { error: `Task #${id} does not belong to this project.` };
    }
    return {
      ref: `Task #${row.id}`,
      title: row.title,
      status: row.status,
      priority: row.priority,
      list: parent.name,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      description: row.description,
    };
  }

  const mod = MODULES[slug];
  if (!mod) return { error: `Unknown module "${slug}".`, valid: ALL_SLUGS };
  const table = mod.table as any;
  const rows = (await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.projectId, projectId)))
    .limit(1)) as any[];
  if (rows.length === 0) return { error: `${mod.singular} #${id} not found in this project.` };

  const r = rows[0];
  const out: Record<string, unknown> = { ref: `${mod.singular} #${r.id}` };
  for (const f of mod.fields) {
    const v = r[f.key];
    out[f.key] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  out.updatedAt = r.updatedAt instanceof Date ? r.updatedAt.toISOString() : null;
  return out;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Members of the project, for the agent's system prompt. */
export async function projectMemberNames(projectId: number): Promise<string[]> {
  const rows = await db
    .select({ name: users.name })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
  return rows.map((r) => r.name);
}
