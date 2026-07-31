/**
 * Project intelligence — the deterministic facts layer.
 *
 * Everything a manager needs to answer "what is done, what is left, what is
 * stuck, what is next" is computed here with plain SQL, never by the model.
 * Both the Work Update generator and the Ask agent read from this module, so
 * a number quoted in chat and the same number in a generated report always
 * agree.
 *
 * The rule that shapes this file: totals are always exact and always over the
 * whole project. Only the illustrative *examples* attached to a total are
 * capped, and every cap reports how many rows it hid. That is the fix for the
 * old generator, which silently showed the top N and let the rest vanish.
 */
import { db } from "@/lib/db";
import {
  issues, issueAssignees, lists, tasks, users, projects, activityLog, workLogs,
} from "@/lib/db/schema";
import {
  devTasks, bugs as pmBugs, features, requirements, milestones, sprints,
  releases, risks, userStories,
} from "@/lib/db/pm-schema";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

/** A work item normalised across issues / tasks / dev-tasks / bugs. */
export interface WorkItem {
  source: "issue" | "task" | "dev-task" | "bug" | "story";
  id: number;
  ref: string;
  title: string;
  status: string;
  priority: string;
  assignees: string[];
  dueDate: Date | null;
  updatedAt: Date | null;
  createdAt: Date | null;
  /** Whole days since the last update. Drives the "stale" signal. */
  staleDays: number;
  /** When the item reached a done state. Only set on completed items. */
  completedAt?: Date | null;
}

export interface StatusTally {
  value: string;
  count: number;
}

/** A total plus a capped sample, so the caller can always say "and N more". */
export interface Bucket {
  /** Exact count over the whole project — never truncated. */
  total: number;
  /** Illustrative rows, capped. */
  items: WorkItem[];
  /** total - items.length. Non-zero means the sample is partial. */
  hidden: number;
}

export interface MemberLoad {
  userId: number;
  name: string;
  open: number;
  overdue: number;
  completedInRange: number;
}

export interface ModuleRollup {
  slug: string;
  label: string;
  total: number;
  byStatus: StatusTally[];
  /** Records touched inside the reporting window. */
  updatedInRange: number;
}

export interface ProjectSnapshot {
  project: { id: number; name: string; key: string };
  range: { start: Date; end: Date | null; label: string };
  generatedAt: Date;

  /** Headline numbers. Every one of these is an exact count. */
  health: {
    openWork: number;
    completedInRange: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    stale: number;
    blockedOrOnHold: number;
    criticalOpen: number;
    completionRate: number;
    velocityPerWeek: number;
  };

  completed: Bucket;
  remaining: Bucket;
  blockers: Bucket;
  overdue: Bucket;
  dueSoon: Bucket;
  unassigned: Bucket;
  stale: Bucket;

  issueStatus: StatusTally[];
  issuePriority: StatusTally[];
  members: MemberLoad[];
  modules: ModuleRollup[];

  /** Forward-looking commitments — milestones, sprints, releases. */
  upcoming: {
    milestones: { id: number; title: string; status: string; targetDate: Date | null; daysOut: number | null }[];
    sprints: { id: number; name: string; status: string; startDate: Date | null; endDate: Date | null }[];
    releases: { id: number; version: string; status: string; releaseDate: Date | null }[];
  };

  /** Open risks, which the old generator never surfaced at all. */
  risks: {
    id: number; title: string; impact: string; probability: string;
    status: string; mitigationPlan: string | null;
  }[];

  manualLogs: { date: Date; author: string; content: string }[];
}

const DAY_MS = 86_400_000;
/** How many example rows any single bucket may show. Totals ignore this. */
export const SAMPLE_CAP = 25;
/** No update in this many days marks an item stale. */
export const STALE_DAYS = 7;
/** A due date inside this window counts as "due soon". */
export const DUE_SOON_DAYS = 7;
/** Trailing window velocity is measured over, independent of the report range. */
export const VELOCITY_WINDOW_DAYS = 28;

const OPEN_ISSUE_STATUS = ["Open", "In Progress", "In Review"];
const DONE_ISSUE_STATUS = ["Verified", "Closed"];
const OPEN_DEVTASK_STATUS = ["Todo", "In Progress", "Review", "Testing"];
const OPEN_BUG_STATUS = ["Open", "In Progress"];
const DONE_STORY_STATUS = ["Done", "Rejected"];
const BLOCKED_HINTS = ["blocked", "on hold", "waiting", "stuck", "paused"];

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function bucket(items: WorkItem[], cap = SAMPLE_CAP): Bucket {
  return { total: items.length, items: items.slice(0, cap), hidden: Math.max(0, items.length - cap) };
}

function tally(values: string[], order?: readonly string[]): StatusTally[] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  const out: StatusTally[] = [];
  const seen = new Set<string>();
  for (const v of [...(order ?? []), ...map.keys()]) {
    if (seen.has(v) || !map.has(v)) continue;
    seen.add(v);
    out.push({ value: v, count: map.get(v)! });
  }
  return out;
}

/**
 * Priority ordering used whenever a sample has to be cut down: the rows most
 * likely to matter to a manager survive the cap.
 */
const PRIORITY_RANK: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, none: 4,
};

function byUrgency(a: WorkItem, b: WorkItem): number {
  const pa = PRIORITY_RANK[a.priority] ?? 5;
  const pb = PRIORITY_RANK[b.priority] ?? 5;
  if (pa !== pb) return pa - pb;
  const da = a.dueDate?.getTime() ?? Infinity;
  const dbb = b.dueDate?.getTime() ?? Infinity;
  if (da !== dbb) return da - dbb;
  return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
}

/**
 * Build the snapshot. One call, ~15 queries, everything downstream reads from
 * the result rather than hitting the database again.
 */
export async function buildSnapshot(
  projectId: number,
  opts: { start: Date; end?: Date | null; userId?: number | null } = { start: new Date(0) }
): Promise<ProjectSnapshot> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, name: true, key: true },
  });
  if (!project) throw new Error("Project not found");

  const now = new Date();
  const start = opts.start;
  const end = opts.end ?? null;
  const rangeEnd = end ?? now;

  const userRows = await db.select({ id: users.id, name: users.name }).from(users);
  const userMap = new Map(userRows.map((u) => [u.id, u.name]));

  // ── ISSUES ────────────────────────────────────────────────────────────────
  const issueRows = await db.select().from(issues).where(eq(issues.projectId, projectId));
  const issueIds = issueRows.map((r) => r.id);

  const assigneeMap = new Map<number, string[]>();
  if (issueIds.length > 0) {
    const links = await db
      .select({ issueId: issueAssignees.issueId, userId: issueAssignees.userId })
      .from(issueAssignees)
      .where(inArray(issueAssignees.issueId, issueIds));
    for (const l of links) {
      const arr = assigneeMap.get(l.issueId) ?? [];
      arr.push(userMap.get(l.userId) ?? `User #${l.userId}`);
      assigneeMap.set(l.issueId, arr);
    }
  }

  const issueItems: WorkItem[] = issueRows.map((r) => ({
    source: "issue",
    id: r.id,
    ref: `Issue #${r.id}`,
    title: r.title,
    status: r.status,
    priority: r.priority,
    assignees: assigneeMap.get(r.id) ?? [],
    dueDate: r.dueDate ?? null,
    updatedAt: r.updatedAt ?? null,
    createdAt: r.createdAt ?? null,
    staleDays: r.updatedAt ? daysBetween(now, r.updatedAt) : 0,
  }));

  // ── TASKS (list-based) ────────────────────────────────────────────────────
  const listRows = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(and(eq(lists.projectId, projectId), isNull(lists.deletedAt)));
  const listIds = listRows.map((l) => l.id);

  const taskRows = listIds.length
    ? await db.select().from(tasks).where(and(inArray(tasks.listId, listIds), isNull(tasks.deletedAt)))
    : [];

  const taskItems: WorkItem[] = taskRows.map((t) => ({
    source: "task",
    id: t.id,
    ref: `Task #${t.id}`,
    title: t.title,
    status: t.status === "completed" ? "Completed" : "Active",
    priority: t.priority === "none" ? "none" : t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
    assignees: [],
    dueDate: t.dueDate ?? null,
    updatedAt: t.updatedAt ?? null,
    createdAt: t.createdAt ?? null,
    staleDays: t.updatedAt ? daysBetween(now, t.updatedAt) : 0,
  }));

  // ── PM DEV TASKS / BUGS / STORIES ─────────────────────────────────────────
  const devRows = await db.select().from(devTasks).where(eq(devTasks.projectId, projectId)).catch(() => []);
  const devItems: WorkItem[] = devRows.map((t) => ({
    source: "dev-task",
    id: t.id,
    ref: `Dev Task #${t.id}`,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignees: t.assigneeId ? [userMap.get(t.assigneeId) ?? `User #${t.assigneeId}`] : [],
    dueDate: t.dueDate ?? null,
    updatedAt: t.updatedAt ?? null,
    createdAt: t.createdAt ?? null,
    staleDays: t.updatedAt ? daysBetween(now, t.updatedAt) : 0,
  }));

  const bugRows = await db.select().from(pmBugs).where(eq(pmBugs.projectId, projectId)).catch(() => []);
  const bugItems: WorkItem[] = bugRows.map((b) => ({
    source: "bug",
    id: b.id,
    ref: `Bug #${b.id}`,
    title: b.title,
    status: b.status,
    priority: b.severity,
    assignees: [],
    dueDate: null,
    updatedAt: b.updatedAt ?? null,
    createdAt: b.createdAt ?? null,
    staleDays: b.updatedAt ? daysBetween(now, b.updatedAt) : 0,
  }));

  const storyRows = await db.select().from(userStories).where(eq(userStories.projectId, projectId)).catch(() => []);
  const storyItems: WorkItem[] = storyRows.map((s) => ({
    source: "story",
    id: s.id,
    ref: `Story #${s.id}`,
    title: s.title,
    status: s.status,
    priority: s.priority,
    assignees: [],
    dueDate: null,
    updatedAt: s.updatedAt ?? null,
    createdAt: s.createdAt ?? null,
    staleDays: s.updatedAt ? daysBetween(now, s.updatedAt) : 0,
  }));

  const all = [...issueItems, ...taskItems, ...devItems, ...bugItems, ...storyItems];

  const isOpen = (w: WorkItem) =>
    (w.source === "issue" && OPEN_ISSUE_STATUS.includes(w.status)) ||
    (w.source === "task" && w.status === "Active") ||
    (w.source === "dev-task" && OPEN_DEVTASK_STATUS.includes(w.status)) ||
    (w.source === "bug" && OPEN_BUG_STATUS.includes(w.status)) ||
    (w.source === "story" && !DONE_STORY_STATUS.includes(w.status));

  const openWork = all.filter(isOpen);

  // ── COMPLETED IN RANGE ────────────────────────────────────────────────────
  // Issues use the activity log so a close is attributed to when it happened,
  // not to whenever the row was last touched.
  //
  // Completions are gathered over a window wide enough for both the report
  // range and the trailing velocity window, then split. Without that, a report
  // for "today" would have no completions to measure velocity against and would
  // claim the team had stopped working.
  const velocityCutoff = new Date(rangeEnd.getTime() - VELOCITY_WINDOW_DAYS * DAY_MS);
  const dataStart = start < velocityCutoff ? start : velocityCutoff;
  const closeLogs = issueIds.length
    ? await db
        .select({
          issueId: activityLog.issueId,
          newValue: activityLog.newValue,
          createdAt: activityLog.createdAt,
          userId: activityLog.userId,
        })
        .from(activityLog)
        .where(
          and(
            inArray(activityLog.issueId, issueIds),
            eq(activityLog.action, "status_changed"),
            gte(activityLog.createdAt, dataStart),
            lte(activityLog.createdAt, rangeEnd),
            sql`${activityLog.newValue} IN ('Closed','Verified')`
          )
        )
        .orderBy(desc(activityLog.createdAt))
    : [];

  const closedIssueIds = new Set(closeLogs.map((l) => l.issueId).filter((v): v is number => v != null));
  /** Earliest recorded close per issue, so velocity is dated by the event. */
  const closedAtById = new Map<number, Date>();
  for (const l of closeLogs) {
    if (l.issueId == null || !l.createdAt) continue;
    const prev = closedAtById.get(l.issueId);
    if (!prev || l.createdAt < prev) closedAtById.set(l.issueId, l.createdAt);
  }
  const completedIssues = issueItems
    .filter((i) => closedIssueIds.has(i.id) || (DONE_ISSUE_STATUS.includes(i.status) && inWindow(i.updatedAt)))
    .map((i) => ({ ...i, completedAt: closedAtById.get(i.id) ?? i.updatedAt }));

  /** Inside the widened gather window, which also covers the velocity trail. */
  function inWindow(d: Date | null): boolean {
    if (!d) return false;
    return d >= dataStart && d <= rangeEnd;
  }

  const completedTasks = taskItems
    .filter((t) => {
      const raw = taskRows.find((r) => r.id === t.id);
      return t.status === "Completed" && inWindow(raw?.completedAt ?? null);
    })
    .map((t) => ({ ...t, completedAt: taskRows.find((r) => r.id === t.id)?.completedAt ?? t.updatedAt }));
  const completedDev = devItems
    .filter((t) => t.status === "Done" && inWindow(t.updatedAt))
    .map((t) => ({ ...t, completedAt: t.updatedAt }));
  const completedBugs = bugItems
    .filter((b) => ["Resolved", "Closed"].includes(b.status) && inWindow(b.updatedAt))
    .map((b) => ({ ...b, completedAt: b.updatedAt }));
  const completedStories = storyItems
    .filter((s) => s.status === "Done" && inWindow(s.updatedAt))
    .map((s) => ({ ...s, completedAt: s.updatedAt }));

  const completedWindow = [...completedIssues, ...completedTasks, ...completedDev, ...completedBugs, ...completedStories]
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  /** What the report covers: completions inside the requested range only. */
  const completed = completedWindow.filter((c) => c.completedAt && c.completedAt >= start);

  // ── DERIVED BUCKETS ───────────────────────────────────────────────────────
  const overdueItems = openWork
    .filter((w) => w.dueDate && w.dueDate < now)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()));

  const dueSoonItems = openWork
    .filter((w) => w.dueDate && w.dueDate >= now && w.dueDate <= new Date(now.getTime() + DUE_SOON_DAYS * DAY_MS))
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()));

  const unassignedItems = openWork
    .filter((w) => w.assignees.length === 0 && (w.source === "issue" || w.source === "dev-task"))
    .sort(byUrgency);

  const staleItems = openWork
    .filter((w) => w.staleDays >= STALE_DAYS)
    .sort((a, b) => b.staleDays - a.staleDays);

  // A blocker is anything that is both important and not moving: critical/high
  // priority, or explicitly parked, or overdue, or stale past the threshold.
  const blockerItems = openWork
    .filter((w) => {
      const parked = BLOCKED_HINTS.some((h) => w.status.toLowerCase().includes(h));
      const urgent = w.priority === "Critical" || w.priority === "High";
      const late = !!(w.dueDate && w.dueDate < now);
      return parked || late || (urgent && w.staleDays >= STALE_DAYS);
    })
    .sort(byUrgency);

  const remainingItems = [...openWork].sort(byUrgency);

  // ── VELOCITY ──────────────────────────────────────────────────────────────
  // Always the trailing VELOCITY_WINDOW_DAYS, never the reporting range. A range
  // of "since 2024" would otherwise spread a handful of recent completions across
  // two years, and a range of "today" would have nothing to divide at all.
  const recentCompletions = completedWindow.filter((c) => c.completedAt && c.completedAt >= velocityCutoff).length;
  const velocityPerWeek = Number(((recentCompletions / VELOCITY_WINDOW_DAYS) * 7).toFixed(1));
  const totalTracked = openWork.length + completed.length;
  const completionRate = totalTracked === 0 ? 0 : Math.round((completed.length / totalTracked) * 100);

  // ── MEMBER LOAD ───────────────────────────────────────────────────────────
  const memberMap = new Map<string, MemberLoad>();
  const touchMember = (name: string, patch: Partial<MemberLoad>) => {
    const cur = memberMap.get(name) ?? { userId: 0, name, open: 0, overdue: 0, completedInRange: 0 };
    memberMap.set(name, {
      ...cur,
      open: cur.open + (patch.open ?? 0),
      overdue: cur.overdue + (patch.overdue ?? 0),
      completedInRange: cur.completedInRange + (patch.completedInRange ?? 0),
    });
  };
  for (const w of openWork) {
    for (const a of w.assignees) {
      touchMember(a, { open: 1, overdue: w.dueDate && w.dueDate < now ? 1 : 0 });
    }
  }
  for (const w of completed) {
    for (const a of w.assignees) touchMember(a, { completedInRange: 1 });
  }
  const members = [...memberMap.values()].sort((a, b) => b.open - a.open);

  // ── PM TABLES READ ONCE, REUSED FOR ROLLUPS AND THE FORWARD LOOK ──────────
  const reqRows = await safeRows(requirements, projectId);
  const featureRows = await safeRows(features, projectId);
  const milestoneRows = await safeRows(milestones, projectId);
  const sprintRows = await safeRows(sprints, projectId);
  const releaseRows = await safeRows(releases, projectId);
  const riskRows = await safeRows(risks, projectId);

  const modules: ModuleRollup[] = [
    rollup("requirements", "Requirements", reqRows, "status", start, rangeEnd),
    rollup("features", "Features", featureRows, "status", start, rangeEnd),
    rollup("dev-tasks", "Dev Tasks", devRows, "status", start, rangeEnd),
    rollup("bugs", "Bugs", bugRows, "status", start, rangeEnd),
    rollup("user-stories", "User Stories", storyRows, "status", start, rangeEnd),
    rollup("milestones", "Milestones", milestoneRows, "status", start, rangeEnd),
    rollup("sprints", "Sprints", sprintRows, "status", start, rangeEnd),
    rollup("releases", "Releases", releaseRows, "status", start, rangeEnd),
    rollup("risks", "Risks", riskRows, "status", start, rangeEnd),
  ].filter((m) => m.total > 0);

  // ── FORWARD LOOK ──────────────────────────────────────────────────────────
  // "Not finished yet" per each table's own enum: milestones Done/Missed,
  // sprints Completed, releases Released/Rolled Back are all terminal.
  const upcoming = {
    milestones: milestoneRows
      .filter((m) => !["Done", "Missed"].includes(String(m.status ?? "")))
      .map((m) => ({
        id: m.id as number,
        title: String(m.name ?? `#${m.id}`),
        status: String(m.status ?? ""),
        targetDate: (m.targetDate as Date | null) ?? null,
        // Positive means the target date is already in the past.
        daysOut: m.targetDate ? daysBetween(now, m.targetDate as Date) : null,
      }))
      .sort((a, b) => (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity)),
    sprints: sprintRows
      .filter((s) => s.status !== "Completed")
      .map((s) => ({
        id: s.id as number,
        name: String(s.name ?? `#${s.id}`),
        status: String(s.status ?? ""),
        startDate: (s.startDate as Date | null) ?? null,
        endDate: (s.endDate as Date | null) ?? null,
      }))
      .sort((a, b) => (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity)),
    releases: releaseRows
      .filter((r) => !["Released", "Rolled Back"].includes(String(r.status ?? "")))
      .map((r) => ({
        id: r.id as number,
        version: String(r.version ?? `#${r.id}`),
        status: String(r.status ?? ""),
        releaseDate: (r.releaseDate as Date | null) ?? null,
      }))
      .sort((a, b) => (a.releaseDate?.getTime() ?? Infinity) - (b.releaseDate?.getTime() ?? Infinity)),
  };

  // Accepted risks stay listed: the manager still needs to know they exist.
  const openRisks = riskRows
    .filter((r) => String(r.status ?? "") !== "Closed")
    .map((r) => ({
      id: r.id as number,
      title: String(r.title ?? `#${r.id}`),
      impact: String(r.impact ?? "Unknown"),
      probability: String(r.probability ?? "Unknown"),
      status: String(r.status ?? ""),
      mitigationPlan: (r.mitigationPlan as string | null) ?? null,
    }))
    .sort((a, b) => (PRIORITY_RANK[b.impact] ?? 5) - (PRIORITY_RANK[a.impact] ?? 5));

  // ── MANUAL LOGS ───────────────────────────────────────────────────────────
  const logConds = [eq(workLogs.projectId, projectId), gte(workLogs.logDate, start), lte(workLogs.logDate, rangeEnd)];
  if (opts.userId) logConds.push(eq(workLogs.userId, opts.userId));
  const logRows = await db
    .select({ logDate: workLogs.logDate, content: workLogs.content, userId: workLogs.userId })
    .from(workLogs)
    .where(and(...logConds))
    .orderBy(desc(workLogs.logDate))
    .catch(() => []);

  const rangeLabel = end
    ? `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`
    : `since ${start.toISOString().slice(0, 10)}`;

  return {
    project,
    range: { start, end, label: rangeLabel },
    generatedAt: now,
    health: {
      openWork: openWork.length,
      completedInRange: completed.length,
      overdue: overdueItems.length,
      dueSoon: dueSoonItems.length,
      unassigned: unassignedItems.length,
      stale: staleItems.length,
      blockedOrOnHold: blockerItems.length,
      criticalOpen: openWork.filter((w) => w.priority === "Critical").length,
      completionRate,
      velocityPerWeek,
    },
    completed: bucket(completed),
    remaining: bucket(remainingItems),
    blockers: bucket(blockerItems),
    overdue: bucket(overdueItems),
    dueSoon: bucket(dueSoonItems),
    unassigned: bucket(unassignedItems),
    stale: bucket(staleItems),
    issueStatus: tally(issueItems.map((i) => i.status), ["Open", "In Progress", "In Review", "Verified", "Closed"]),
    issuePriority: tally(issueItems.map((i) => i.priority), ["Critical", "High", "Medium", "Low"]),
    members,
    modules,
    upcoming,
    risks: openRisks,
    manualLogs: logRows.map((l) => ({
      date: l.logDate,
      author: userMap.get(l.userId) ?? `User #${l.userId}`,
      content: l.content,
    })),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Select every row of a PM table for one project; a missing table yields []. */
async function safeRows(table: any, projectId: number): Promise<any[]> {
  try {
    return (await db.select().from(table).where(eq(table.projectId, projectId))) as any[];
  } catch (error) {
    console.error("[project-intel] table read failed:", error);
    return [];
  }
}

function rollup(
  slug: string,
  label: string,
  rows: any[],
  statusKey: string,
  start: Date,
  end: Date
): ModuleRollup {
  return {
    slug,
    label,
    total: rows.length,
    byStatus: tally(rows.map((r) => String(r[statusKey] ?? "Unknown"))),
    updatedInRange: rows.filter((r) => {
      const d = r.updatedAt as Date | null;
      return d && d >= start && d <= end;
    }).length,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** One-line rendering of a work item for prompt context. */
export function renderItem(w: WorkItem): string {
  const who = w.assignees.length ? w.assignees.join(", ") : "unassigned";
  const due = w.dueDate ? `, due ${w.dueDate.toISOString().slice(0, 10)}` : "";
  const stale = w.staleDays >= STALE_DAYS ? `, no update in ${w.staleDays}d` : "";
  return `${w.ref} "${w.title}" [${w.status}] [${w.priority}] (${who}${due}${stale})`;
}

/** Render a bucket with its exact total and an explicit "and N more" tail. */
export function renderBucket(heading: string, b: Bucket): string {
  if (b.total === 0) return `${heading}: none (0).`;
  const lines = b.items.map((i) => `- ${renderItem(i)}`);
  if (b.hidden > 0) lines.push(`- ...and ${b.hidden} more not listed here (total ${b.total}).`);
  // The shown/hidden split is spelled out so a consumer never has to count rows
  // to describe the sample — counting is exactly what models get wrong.
  const counts =
    b.hidden > 0
      ? `total_exact=${b.total}, shown_below=${b.items.length}, not_shown=${b.hidden}`
      : `total_exact=${b.total}, all shown below`;
  return `${heading} (${counts}):\n${lines.join("\n")}`;
}

/**
 * Compact text rendering of the whole snapshot for an LLM prompt. Ordered so
 * the exact totals come first and the model cannot mistake a capped sample for
 * the full picture.
 */
export function renderSnapshot(s: ProjectSnapshot): string {
  const h = s.health;
  const parts: string[] = [];

  parts.push(`PROJECT: ${s.project.name} (${s.project.key})
PERIOD: ${s.range.label}
GENERATED: ${s.generatedAt.toISOString()}

EXACT COUNTS (authoritative — never contradict these):
- Open work items: ${h.openWork}
- Completed in period: ${h.completedInRange}
- Overdue: ${h.overdue}
- Due within ${DUE_SOON_DAYS} days: ${h.dueSoon}
- Unassigned open: ${h.unassigned}
- Stale (no update in ${STALE_DAYS}+ days): ${h.stale}
- Blockers / at risk: ${h.blockedOrOnHold}
- Critical open: ${h.criticalOpen}
- Completion rate: ${h.completionRate}%
- Velocity: ${h.velocityPerWeek} items/week (trailing ${VELOCITY_WINDOW_DAYS} days)`);

  parts.push(renderBucket("COMPLETED IN PERIOD", s.completed));
  parts.push(renderBucket("REMAINING OPEN WORK", s.remaining));
  parts.push(renderBucket("BLOCKERS AND AT-RISK", s.blockers));
  parts.push(renderBucket("OVERDUE", s.overdue));
  parts.push(renderBucket("DUE SOON", s.dueSoon));
  parts.push(renderBucket("UNASSIGNED", s.unassigned));
  parts.push(renderBucket("STALE", s.stale));

  if (s.members.length > 0) {
    parts.push(
      `TEAM LOAD:\n${s.members
        .map((m) => `- ${m.name}: ${m.open} open, ${m.overdue} overdue, ${m.completedInRange} completed in period`)
        .join("\n")}`
    );
  }

  if (s.modules.length > 0) {
    parts.push(
      `WORKSPACE MODULES:\n${s.modules
        .map((m) => `- ${m.label}: ${m.total} total (${m.byStatus.map((b) => `${b.value} ${b.count}`).join(", ")}), ${m.updatedInRange} touched in period`)
        .join("\n")}`
    );
  }

  const up: string[] = [];
  for (const m of s.upcoming.milestones) {
    const when = m.targetDate ? m.targetDate.toISOString().slice(0, 10) : "no target date";
    const late = m.daysOut != null && m.daysOut > 0
      ? ` (OVERDUE by ${m.daysOut}d)`
      : m.daysOut != null ? ` (in ${Math.abs(m.daysOut)}d)` : "";
    up.push(`- Milestone "${m.title}" [${m.status}] target ${when}${late}`);
  }
  for (const sp of s.upcoming.sprints) {
    const win = sp.startDate && sp.endDate
      ? `${sp.startDate.toISOString().slice(0, 10)} → ${sp.endDate.toISOString().slice(0, 10)}`
      : "no dates";
    up.push(`- Sprint "${sp.name}" [${sp.status}] ${win}`);
  }
  for (const r of s.upcoming.releases) {
    const when = r.releaseDate ? r.releaseDate.toISOString().slice(0, 10) : "unscheduled";
    up.push(`- Release ${r.version} [${r.status}] target ${when}`);
  }
  parts.push(up.length > 0 ? `UPCOMING COMMITMENTS:\n${up.join("\n")}` : "UPCOMING COMMITMENTS: none recorded.");

  parts.push(
    s.risks.length > 0
      ? `OPEN RISKS:\n${s.risks.map((r) => `- "${r.title}" [impact ${r.impact}, probability ${r.probability}] [${r.status}]${r.mitigationPlan ? ` mitigation: ${r.mitigationPlan}` : " (no mitigation plan recorded)"}`).join("\n")}`
      : "OPEN RISKS: none recorded."
  );

  if (s.manualLogs.length > 0) {
    parts.push(
      `MANUAL WORK LOGS:\n${s.manualLogs
        .slice(0, 40)
        .map((l) => `- [${l.date.toISOString().slice(0, 10)}] ${l.author}: ${l.content}`)
        .join("\n")}`
    );
  }

  return parts.join("\n\n");
}
