import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  issues, activityLog, projects, projectMembers, workLogs, users,
} from "@/lib/db/schema";
import { devTasks, bugs as pmBugs, features, requirements } from "@/lib/db/pm-schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

/**
 * POST /api/ai/work-update
 *
 * Body: {
 *   projectId: number,
 *   sections: Array<"issues_done"|"issues_left"|"tasks"|"workspace"|"manual_log">,
 *   startDate?: string,   // ISO date
 *   endDate?: string,     // ISO date
 *   targetUserId?: number // admin only
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, sections, startDate, endDate, targetUserId } = await request.json();

    if (!projectId || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: "projectId and sections[] are required" },
        { status: 400 }
      );
    }

    // Admin can generate for any project member; others only for themselves
    const effectiveUserId: number =
      targetUserId && authUser.role === "Admin" ? targetUserId : authUser.id;

    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.userId, authUser.id),
          eq(projectMembers.projectId, projectId)
        ),
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

    const rangeStart = startDate
      ? new Date(startDate)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const rangeEnd = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
      : null;

    const sectionBlocks: string[] = [];

    // ── ISSUES DONE ──────────────────────────────────────────────────────────
    if (sections.includes("issues_done")) {
      const closedLogs = await db.query.activityLog.findMany({
        where: and(
          eq(activityLog.action, "status_changed"),
          gte(activityLog.createdAt, rangeStart),
          sql`${activityLog.newValue} IN ('Closed', 'Verified', 'In Review')`
        ),
        with: { issue: true, user: true },
        orderBy: desc(activityLog.createdAt),
        limit: 80,
      });

      const filtered = closedLogs.filter((a) => {
        const act = a as typeof a & { issue?: { projectId: number } };
        return act.issue?.projectId === projectId && (!rangeEnd || a.createdAt! <= rangeEnd);
      });

      if (filtered.length > 0) {
        const lines = filtered.map((a) => {
          const act = a as typeof a & { issue?: { id: number; title: string }; user?: { name: string } };
          return `- Issue #${act.issue?.id} "${act.issue?.title}" → ${a.newValue}${act.user?.name ? ` (by ${act.user.name})` : ""}`;
        });
        sectionBlocks.push(`## Issues Completed\n${lines.join("\n")}`);
      } else {
        sectionBlocks.push("## Issues Completed\nNo issues were closed in this period.");
      }
    }

    // ── ISSUES LEFT ───────────────────────────────────────────────────────────
    if (sections.includes("issues_left")) {
      const openIssues = await db.query.issues.findMany({
        where: and(
          eq(issues.projectId, projectId),
          sql`${issues.status} IN ('Open', 'In Progress', 'In Review')`
        ),
        with: { assignees: { with: { user: { columns: { name: true } } } } },
        orderBy: [desc(issues.priority), desc(issues.updatedAt)],
        limit: 40,
      });

      if (openIssues.length > 0) {
        const lines = openIssues.map((i) => {
          const names = (i.assignees as Array<{ user: { name: string } }>)
            .map((a) => a.user.name).join(", ");
          return `- #${i.id} "${i.title}" [${i.status}] [${i.priority}]${names ? ` — ${names}` : ""}`;
        });
        sectionBlocks.push(`## Remaining Work (${openIssues.length} open)\n${lines.join("\n")}`);
      } else {
        sectionBlocks.push("## Remaining Work\nNo open issues. All clear!");
      }
    }

    // ── TASKS (TickTick-style) ────────────────────────────────────────────────
    if (sections.includes("tasks")) {
      const completedTasks = await db.query.tasks.findMany({
        where: and(
          eq(sql`(SELECT project_id FROM lists WHERE lists.id = ${sql.raw("tasks.list_id")})`, projectId),
          eq(sql`tasks.status`, "completed"),
          gte(sql`tasks.completed_at`, rangeStart)
        ),
        limit: 40,
      }).catch(() => []);

      if (completedTasks.length > 0) {
        const lines = completedTasks.map((t) => `- "${t.title}" [completed]`);
        sectionBlocks.push(`## Tasks Completed\n${lines.join("\n")}`);
      }
    }

    // ── WORKSPACE ITEMS (PM: devTasks, features, requirements, bugs) ──────────
    if (sections.includes("workspace")) {
      const wsBlocks: string[] = [];

      const doneDevTasks = await db.query.devTasks.findMany({
        where: and(
          eq(devTasks.projectId, projectId),
          eq(devTasks.status, "Done"),
          gte(devTasks.updatedAt, rangeStart)
        ),
        limit: 30,
      }).catch(() => []);
      if (doneDevTasks.length > 0) {
        wsBlocks.push(
          `### Dev Tasks Done\n${doneDevTasks.map((t) => `- "${t.title}" [${t.priority}]`).join("\n")}`
        );
      }

      const inProgressDevTasks = await db.query.devTasks.findMany({
        where: and(
          eq(devTasks.projectId, projectId),
          sql`${devTasks.status} IN ('In Progress', 'Review', 'Testing')`
        ),
        limit: 20,
      }).catch(() => []);
      if (inProgressDevTasks.length > 0) {
        wsBlocks.push(
          `### Dev Tasks In Progress\n${inProgressDevTasks.map((t) => `- "${t.title}" [${t.status}]`).join("\n")}`
        );
      }

      const recentFeatures = await db.query.features.findMany({
        where: and(
          eq(features.projectId, projectId),
          gte(features.updatedAt, rangeStart)
        ),
        limit: 20,
      }).catch(() => []);
      if (recentFeatures.length > 0) {
        wsBlocks.push(
          `### Features Updated\n${recentFeatures.map((f) => `- "${f.name}" [${f.status}]`).join("\n")}`
        );
      }

      const recentReqs = await db.query.requirements.findMany({
        where: and(
          eq(requirements.projectId, projectId),
          gte(requirements.updatedAt, rangeStart)
        ),
        limit: 20,
      }).catch(() => []);
      if (recentReqs.length > 0) {
        wsBlocks.push(
          `### Requirements Updated\n${recentReqs.map((r) => `- "${r.title}" [${r.status}]`).join("\n")}`
        );
      }

      const recentBugs = await db.query.bugs.findMany({
        where: and(
          eq(pmBugs.projectId, projectId),
          gte(pmBugs.updatedAt, rangeStart)
        ),
        limit: 20,
      }).catch(() => []);
      if (recentBugs.length > 0) {
        wsBlocks.push(
          `### Bugs Updated\n${recentBugs.map((b) => `- "${b.title}" [${b.status}]`).join("\n")}`
        );
      }

      if (wsBlocks.length > 0) {
        sectionBlocks.push(`## Workspace Items\n${wsBlocks.join("\n\n")}`);
      }
    }

    // ── MANUAL LOG ────────────────────────────────────────────────────────────
    if (sections.includes("manual_log")) {
      const logConds = [
        eq(workLogs.userId, effectiveUserId),
        gte(workLogs.logDate, rangeStart),
      ];
      if (rangeEnd) logConds.push(lte(workLogs.logDate, rangeEnd));

      const manualLogs = await db.query.workLogs.findMany({
        where: and(...logConds),
        orderBy: desc(workLogs.logDate),
        limit: 30,
      });

      if (manualLogs.length > 0) {
        const lines = manualLogs.map((l) => {
          const d = new Date(l.logDate).toLocaleDateString("en-GB", {
            day: "2-digit", month: "short",
          });
          return `- [${d}] ${l.content}`;
        });
        sectionBlocks.push(`## Manual Work Log\n${lines.join("\n")}`);
      }
    }

    // ── LLM ───────────────────────────────────────────────────────────────────
    const llmUrl = process.env.LOCAL_LLM_URL;
    const llmModel = process.env.LOCAL_LLM_MODEL;
    const llmKey = process.env.LOCAL_LLM_CLIENT_KEY;

    if (!llmUrl || !llmModel || !llmKey) {
      return NextResponse.json({ error: "LLM configuration missing" }, { status: 500 });
    }

    const dateRange = rangeEnd
      ? `${rangeStart.toLocaleDateString()} – ${rangeEnd.toLocaleDateString()}`
      : rangeStart.toLocaleDateString();

    const dataContext = sectionBlocks.join("\n\n");

    const userPrompt = `Project: ${project.name} (${project.key})
Team member: ${targetUser?.name ?? "Unknown"}
Period: ${dateRange}

Raw data grouped by section:

${dataContext}

Write a professional work update report for a manager. Use the exact section headings from the data above. Under each heading write clear numbered points in plain language explaining what happened and why it matters. Keep each point to 1-2 sentences. Do not add extra headings or formatting beyond the section headings and numbered points.`;

    const response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: "system",
            content:
              "You are a professional technical writer producing work update reports for engineering managers. Use the section headings provided. Under each heading write numbered plain-language points. No bold, no extra headers, no dashes. Be specific and concise.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM API Error:", errorText);
      return NextResponse.json({ error: "Failed to generate work update" }, { status: 500 });
    }

    const data = await response.json();
    const update = data.choices[0]?.message?.content?.trim();

    if (!update) {
      return NextResponse.json({ error: "No content returned from AI" }, { status: 500 });
    }

    return NextResponse.json({
      update,
      project: { id: project.id, name: project.name, key: project.key },
      targetUser: targetUser ?? null,
      sections,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Work Update Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
