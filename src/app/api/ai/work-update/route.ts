import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { projects, projectMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateText } from "ai";
import { chatModel } from "@/lib/ai/provider";
import {
  buildSnapshot, renderBucket, renderItem, STALE_DAYS, DUE_SOON_DAYS, VELOCITY_WINDOW_DAYS,
  type ProjectSnapshot,
} from "@/lib/ai/project-intel";

export const runtime = "nodejs";

/**
 * POST /api/ai/work-update
 *
 * Body: {
 *   projectId: number,
 *   sections: Array<"issues_done"|"issues_left"|"blockers"|"tasks"|"workspace"
 *                   |"team"|"upcoming"|"risks"|"manual_log">,
 *   startDate?: string,   // ISO date
 *   endDate?: string,     // ISO date
 *   targetUserId?: number // admin only
 *   skipEmpty?: boolean
 * }
 *
 * The report is built in two halves. The stats header and every count come from
 * the deterministic snapshot (lib/ai/project-intel.ts) and are injected into
 * the response verbatim — the model never gets to restate a number. The model
 * only writes the prose underneath each heading. That split is what stops the
 * old behaviour where a "top 10" list silently stood in for 40 open items.
 */

const SECTION_IDS = [
  "issues_done", "issues_left", "blockers", "tasks", "workspace",
  "team", "upcoming", "risks", "manual_log",
] as const;
type SectionId = (typeof SECTION_IDS)[number];

function isSectionId(v: unknown): v is SectionId {
  return typeof v === "string" && (SECTION_IDS as readonly string[]).includes(v);
}

/** Deterministic header. Written by us, not the model, so it is always right. */
function statsHeader(s: ProjectSnapshot): string {
  const h = s.health;
  const bits = [
    `${h.openWork} open`,
    `${h.completedInRange} completed this period`,
    `${h.overdue} overdue`,
    `${h.dueSoon} due within ${DUE_SOON_DAYS} days`,
    `${h.unassigned} unassigned`,
    `${h.stale} stale (${STALE_DAYS}d+ untouched)`,
  ];
  if (h.criticalOpen > 0) bits.push(`${h.criticalOpen} critical`);
  return [
    `## Snapshot`,
    bits.join(" · "),
    ``,
    `Completion rate ${h.completionRate}% · velocity ${h.velocityPerWeek} items/week over the last ${VELOCITY_WINDOW_DAYS} days · period ${s.range.label}`,
  ].join("\n");
}

/**
 * Raw data blocks for the model. Each block carries its exact total, and every
 * capped list ends with an explicit "and N more" line so the model cannot
 * present a sample as the whole set.
 */
function dataBlocks(s: ProjectSnapshot, sections: SectionId[], skipEmpty: boolean): string[] {
  const out: string[] = [];
  const push = (heading: string, body: string, isEmpty: boolean) => {
    if (isEmpty && skipEmpty) return;
    out.push(`## ${heading}\n${body}`);
  };

  if (sections.includes("issues_done")) {
    push("Completed Work", renderBucket("Completed", s.completed), s.completed.total === 0);
  }

  if (sections.includes("issues_left")) {
    push("Remaining Work", renderBucket("Still open", s.remaining), s.remaining.total === 0);
  }

  if (sections.includes("blockers")) {
    const body = [
      renderBucket("Blocked or at risk", s.blockers),
      "",
      renderBucket("Overdue", s.overdue),
      "",
      renderBucket("Unassigned", s.unassigned),
      "",
      renderBucket("Stale", s.stale),
    ].join("\n");
    const empty = s.blockers.total + s.overdue.total + s.unassigned.total + s.stale.total === 0;
    push("Blockers and Risks to Delivery", body, empty);
  }

  if (sections.includes("tasks")) {
    const taskItems = s.remaining.items.filter((i) => i.source === "task" || i.source === "dev-task");
    const doneTasks = s.completed.items.filter((i) => i.source === "task" || i.source === "dev-task");
    const body = [
      doneTasks.length ? `Tasks completed:\n${doneTasks.map((t) => `- ${renderItem(t)}`).join("\n")}` : "Tasks completed: none.",
      "",
      taskItems.length ? `Tasks still active:\n${taskItems.map((t) => `- ${renderItem(t)}`).join("\n")}` : "Tasks still active: none.",
    ].join("\n");
    push("Tasks", body, taskItems.length + doneTasks.length === 0);
  }

  if (sections.includes("workspace")) {
    const body = s.modules.length
      ? s.modules
          .map((m) => {
            const breakdown = m.byStatus.map((b) => `${b.value} ${b.count}`).join(", ");
            return `- ${m.label}: ${m.total} total (${breakdown}); ${m.updatedInRange} touched this period`;
          })
          .join("\n")
      : "No workspace modules contain records for this project.";
    push("Workspace Modules", body, s.modules.length === 0);
  }

  if (sections.includes("team")) {
    const body = s.members.length
      ? s.members
          .map((m) => `- ${m.name}: ${m.open} open, ${m.overdue} overdue, ${m.completedInRange} completed this period`)
          .join("\n") + `\n- Unassigned open work: ${s.health.unassigned}`
      : `No work is assigned to anyone. ${s.health.unassigned} open items are unassigned.`;
    push("Team Workload", body, s.members.length === 0 && s.health.unassigned === 0);
  }

  if (sections.includes("upcoming")) {
    const lines: string[] = [];
    for (const m of s.upcoming.milestones) {
      const when = m.targetDate ? m.targetDate.toISOString().slice(0, 10) : "no target date";
      const flag = m.daysOut != null && m.daysOut > 0
        ? ` — OVERDUE by ${m.daysOut} days`
        : m.daysOut != null ? ` — ${Math.abs(m.daysOut)} days out` : "";
      lines.push(`- Milestone "${m.title}" [${m.status}] target ${when}${flag}`);
    }
    for (const sp of s.upcoming.sprints) {
      const win = sp.startDate && sp.endDate
        ? `${sp.startDate.toISOString().slice(0, 10)} to ${sp.endDate.toISOString().slice(0, 10)}`
        : "no dates set";
      lines.push(`- Sprint "${sp.name}" [${sp.status}] ${win}`);
    }
    for (const r of s.upcoming.releases) {
      const when = r.releaseDate ? r.releaseDate.toISOString().slice(0, 10) : "unscheduled";
      lines.push(`- Release ${r.version} [${r.status}] target ${when}`);
    }
    const body = lines.length
      ? lines.join("\n")
      : "No milestones, sprints or releases are recorded for this project. Future goals are not tracked in BugBase yet.";
    push("Upcoming Goals and Commitments", body, lines.length === 0);
  }

  if (sections.includes("risks")) {
    const body = s.risks.length
      ? s.risks
          .map((r) => `- "${r.title}" [impact ${r.impact}, probability ${r.probability}] [${r.status}]${r.mitigationPlan ? ` — mitigation: ${r.mitigationPlan}` : " — no mitigation plan recorded"}`)
          .join("\n")
      : "No open risks are recorded.";
    push("Open Risks", body, s.risks.length === 0);
  }

  if (sections.includes("manual_log")) {
    const body = s.manualLogs.length
      ? s.manualLogs
          .slice(0, 60)
          .map((l) => `- [${l.date.toISOString().slice(0, 10)}] ${l.author}: ${l.content}`)
          .join("\n") +
        (s.manualLogs.length > 60 ? `\n- ...and ${s.manualLogs.length - 60} more entries (total ${s.manualLogs.length}).` : "")
      : "No manual work logs were written for this period.";
    push("Manual Work Log", body, s.manualLogs.length === 0);
  }

  return out;
}

export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    projectId?: number; sections?: unknown; startDate?: string; endDate?: string;
    targetUserId?: number; skipEmpty?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = Number(body.projectId);
  const sections = Array.isArray(body.sections) ? body.sections.filter(isSectionId) : [];
  const skipEmpty = body.skipEmpty === true;

  if (!projectId || Number.isNaN(projectId) || sections.length === 0) {
    return NextResponse.json(
      { error: "projectId and at least one valid section are required", valid: SECTION_IDS },
      { status: 400 }
    );
  }

  try {
    // Admin may generate for any member; everyone else only for themselves.
    const effectiveUserId =
      body.targetUserId && authUser.role === "Admin" ? Number(body.targetUserId) : authUser.id;

    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(eq(projectMembers.userId, authUser.id), eq(projectMembers.projectId, projectId)),
      });
      if (!membership) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, name: true, key: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, effectiveUserId),
      columns: { id: true, name: true },
    });

    const rangeStart = body.startDate
      ? new Date(`${body.startDate}T00:00:00`)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const rangeEnd = body.endDate ? new Date(`${body.endDate}T23:59:59.999`) : null;

    // Manual logs are the only per-person section; the rest describe the project.
    const snapshot = await buildSnapshot(projectId, {
      start: rangeStart,
      end: rangeEnd,
      userId: sections.includes("manual_log") ? effectiveUserId : null,
    });

    const blocks = dataBlocks(snapshot, sections, skipEmpty);
    const header = statsHeader(snapshot);

    if (blocks.length === 0) {
      return NextResponse.json({
        update: `${header}\n\nNo activity was recorded for the selected sections in this period.`,
        stats: snapshot.health,
        project,
        targetUser: targetUser ?? null,
        sections,
        generatedAt: new Date().toISOString(),
      });
    }

    const userPrompt = `Project: ${project.name} (${project.key})
Reporting for: ${targetUser?.name ?? "the whole team"}
Period: ${snapshot.range.label}

Verified facts. Every count below is exact and was computed by the system, not estimated. This
snapshot is prepended to your report automatically — use the numbers, but do not restate the
snapshot itself:

${header.replace(/^## Snapshot\n/, "")}

Data grouped by section. Lists are capped for length; each block's header states total_exact,
shown_below, and not_shown explicitly so you never have to count rows.

${blocks.join("\n\n")}

Write the body of a work update report for an engineering manager.

Rules:
1. Never write a "## Snapshot" section and never restate the headline counts as their own section.
   Begin with the first "## " heading that appears in the data above.
2. Use exactly the "## " headings from the data above, in the same order. Add no other headings.
3. Under each heading, write numbered points in plain language: what happened, what it means, and
   what remains. 1-3 sentences per point.
4. Every number you write must be copied from the data above. Use total_exact as the total. When
   not_shown is above zero, say so once per section using the shown_below and not_shown values
   from that block. Never derive these figures yourself by counting rows.
5. Do not transcribe the rows. Summarise: group them by what a manager should do about them, and
   name only the items that carry the point. A section is at most 6 numbered points.
6. Name specific items by their id (Issue #41, Dev Task #7) when they matter. Never invent an id.
7. Call out anything a manager must act on: overdue work, unassigned critical items, one person
   holding most of the load, a milestone already past its target, a risk with no mitigation plan.
8. Where a section says data is not recorded, say that plainly and recommend recording it. Do not
   invent milestones, goals, or plans that are not in the data.
9. Report the facts without editorialising. Do not tell the team to work harder or speculate about
   morale — state what the data shows and what needs a decision.
10. Refer to people by name, or as "they" — never "he" or "she".
11. No bold, no italics, no tables. Headings and numbered points only.`;

    const { text } = await generateText({
      model: chatModel(),
      system:
        "You write work update reports for engineering managers. You are given exact, " +
        "pre-computed counts and capped data samples. You never restate a number that " +
        "contradicts the given facts, and you never present a capped sample as a complete " +
        "list — you always say how many rows were not shown. You never invent record ids, " +
        "milestones, or plans. Plain language, numbered points, no decorative formatting.",
      prompt: userPrompt,
      temperature: 0.25,
    });

    const update = text.trim();
    if (!update) throw new Error("No content returned from AI");

    // The header is prepended by us so the headline numbers are never model output.
    return NextResponse.json({
      update: `${header}\n\n${update}`,
      stats: snapshot.health,
      project,
      targetUser: targetUser ?? null,
      sections,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ai/work-update] error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    const status = msg === "LLM configuration missing" ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
