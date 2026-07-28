import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { issues, activityLog, projects, projectMembers, issueAssignees } from "@/lib/db/schema";
import { eq, and, inArray, gte, desc, sql } from "drizzle-orm";

/**
 * POST /api/ai/work-update
 *
 * Generates an AI-powered work update for the manager.
 * Body: { projectId: number, mode: "done" | "left" }
 *
 * 1. Fetches project data (issues done today OR remaining open issues)
 * 2. Sends to LLM with a prompt to write in easy, plain language
 * 3. Returns the formatted update
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, mode } = await request.json();
    if (!projectId || !["done", "left"].includes(mode)) {
      return NextResponse.json(
        { error: "projectId and mode ('done' or 'left') are required" },
        { status: 400 }
      );
    }

    // Verify user has access to this project
    if (authUser.role !== "Admin") {
      const membership = await db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.userId, authUser.id),
          eq(projectMembers.projectId, projectId)
        ),
      });
      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Get project info
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, name: true, key: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dataContext = "";

    if (mode === "done") {
      // Fetch issues closed/resolved today
      const closedToday = await db.query.activityLog.findMany({
        where: and(
          eq(activityLog.action, "status_changed"),
          gte(activityLog.createdAt, today),
          sql`${activityLog.newValue} IN ('Closed', 'Verified', 'In Review')`
        ),
        with: { issue: true, user: true },
        orderBy: desc(activityLog.createdAt),
        limit: 50,
      });

      // Filter to this project
      const projectClosedToday = closedToday.filter(
        (a) => (a as typeof a & { issue?: { projectId: number } }).issue?.projectId === projectId
      );

      // Also fetch issues created today
      const createdToday = await db.query.issues.findMany({
        where: and(
          eq(issues.projectId, projectId),
          gte(issues.createdAt, today)
        ),
        orderBy: desc(issues.createdAt),
        limit: 30,
      });

      // Fetch issues updated today (commented, assigned, etc.)
      const updatedToday = await db.query.activityLog.findMany({
        where: and(
          gte(activityLog.createdAt, today),
          eq(activityLog.userId, authUser.id)
        ),
        with: { issue: true },
        orderBy: desc(activityLog.createdAt),
        limit: 50,
      });

      const projectUpdated = updatedToday.filter(
        (a) => (a as typeof a & { issue?: { projectId: number } }).issue?.projectId === projectId
      );

      const closedItems = projectClosedToday.map((a) => {
        const act = a as typeof a & { issue?: { title: string; id: number } };
        return `Issue #${act.issue?.id} "${act.issue?.title}" was moved to ${a.newValue}`;
      });

      const createdItems = createdToday.map(
        (i) => `Issue #${i.id} "${i.title}" was created (${i.type}, ${i.priority} priority)`
      );

      const activityItems = projectUpdated
        .filter((a) => a.action !== "status_changed")
        .map((a) => {
          const act = a as typeof a & { issue?: { title: string; id: number } };
          return `${a.action.replace(/_/g, " ")} on Issue #${act.issue?.id} "${act.issue?.title}"`;
        });

      dataContext = [
        closedItems.length > 0 ? `STATUS CHANGES TODAY:\n${closedItems.join("\n")}` : "",
        createdItems.length > 0 ? `NEW ISSUES CREATED TODAY:\n${createdItems.join("\n")}` : "",
        activityItems.length > 0 ? `OTHER ACTIVITY TODAY:\n${activityItems.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      if (!dataContext.trim()) {
        dataContext = "No activity recorded today for this project.";
      }
    } else {
      // mode === "left" — fetch open/in-progress issues
      const openIssues = await db.query.issues.findMany({
        where: and(
          eq(issues.projectId, projectId),
          sql`${issues.status} IN ('Open', 'In Progress', 'In Review')`
        ),
        with: {
          assignees: { with: { user: { columns: { name: true } } } },
        },
        orderBy: [desc(issues.priority), desc(issues.updatedAt)],
        limit: 40,
      });

      if (openIssues.length === 0) {
        dataContext = "No open issues remaining in this project. All clear!";
      } else {
        const items = openIssues.map((i) => {
          const assigneeNames = (i.assignees as Array<{ user: { name: string } }>)
            .map((a) => a.user.name)
            .join(", ");
          return `Issue #${i.id} "${i.title}" — Status: ${i.status}, Priority: ${i.priority}, Type: ${i.type}${assigneeNames ? `, Assigned to: ${assigneeNames}` : ""}`;
        });
        dataContext = `OPEN/IN-PROGRESS ISSUES (${openIssues.length} total):\n${items.join("\n")}`;
      }
    }

    // Call LLM
    const llmUrl = process.env.LOCAL_LLM_URL;
    const llmModel = process.env.LOCAL_LLM_MODEL;
    const llmKey = process.env.LOCAL_LLM_CLIENT_KEY;

    if (!llmUrl || !llmModel || !llmKey) {
      return NextResponse.json({ error: "LLM configuration missing" }, { status: 500 });
    }

    const modeLabel = mode === "done" ? "what was done today" : "what is left to do";
    const userPrompt = `Project: ${project.name} (${project.key})
Mode: ${modeLabel}

Here is the project data:

${dataContext}

Write them in points one by one what and why to tell my manager in easy way

1.
2.
3.
4.
5.

etc..

add more points but dont do formatting like adding titles or quote or dashes

make easy language`;

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
              "You are a helpful assistant that writes work updates for managers. Write in simple, easy-to-understand language. Use numbered points. Do not use any special formatting like bold, italics, headers, quotes, or dashes. Just plain numbered points explaining what was done or what is remaining and a brief reason why. Keep each point to 1-2 sentences maximum. Be specific but not overly technical.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM API Error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate work update" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const update = data.choices[0]?.message?.content?.trim();

    if (!update) {
      return NextResponse.json(
        { error: "No content returned from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      update,
      project: { id: project.id, name: project.name, key: project.key },
      mode,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Work Update Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
