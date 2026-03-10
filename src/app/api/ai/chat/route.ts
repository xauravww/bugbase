import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, projects, milestones, projectMembers, activityLog } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { message, projectId } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const llmUrl = process.env.LOCAL_LLM_URL;
    const llmModel = process.env.LOCAL_LLM_MODEL;
    const llmKey = process.env.LOCAL_LLM_CLIENT_KEY;

    if (!llmUrl || !llmModel || !llmKey) {
      return NextResponse.json({ error: "LLM configuration missing" }, { status: 500 });
    }

    // Gather context
    let context = "";

    // Get user's projects
    const userMemberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, authUser.id),
    });
    const projectIds = userMemberships.map(m => m.projectId);

    if (projectIds.length > 0) {
      // Dashboard stats
      const counts = await db
        .select({
          type: issues.type,
          status: issues.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(issues)
        .where(inArray(issues.projectId, projectIds))
        .groupBy(issues.type, issues.status);

      let openBugs = 0, openFeatures = 0, inProgress = 0, totalIssues = 0;
      for (const row of counts) {
        totalIssues += row.count;
        if (row.type === "Bug" && row.status !== "Closed") openBugs += row.count;
        if (row.type === "Feature" && row.status !== "Closed") openFeatures += row.count;
        if (row.status === "In Progress") inProgress += row.count;
      }

      context += `\n--- Overall Stats ---\nTotal issues: ${totalIssues}\nOpen bugs: ${openBugs}\nOpen features: ${openFeatures}\nIn progress: ${inProgress}\n`;

      // List user's projects
      const userProjects = await db.query.projects.findMany({
        where: inArray(projects.id, projectIds),
        columns: { id: true, name: true, key: true },
      });
      context += `\nUser's projects: ${userProjects.map(p => `${p.name} (${p.key})`).join(", ")}\n`;

      // If specific project requested
      const targetProjectId = projectId ? parseInt(projectId) : null;
      if (targetProjectId && projectIds.includes(targetProjectId)) {
        const proj = userProjects.find(p => p.id === targetProjectId);
        context += `\n--- Project: ${proj?.name} ---\n`;

        // Project issue breakdown
        const projectCounts = await db
          .select({
            status: issues.status,
            priority: issues.priority,
            type: issues.type,
            isVerified: issues.isVerified,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(issues)
          .where(eq(issues.projectId, targetProjectId))
          .groupBy(issues.status, issues.priority, issues.type, issues.isVerified);

        const statusSummary: Record<string, number> = {};
        const prioritySummary: Record<string, number> = {};
        let verifiedCount = 0, projTotal = 0;
        for (const row of projectCounts) {
          projTotal += row.count;
          statusSummary[row.status] = (statusSummary[row.status] || 0) + row.count;
          prioritySummary[row.priority] = (prioritySummary[row.priority] || 0) + row.count;
          if (row.isVerified) verifiedCount += row.count;
        }

        context += `Total issues: ${projTotal}\n`;
        context += `By status: ${Object.entries(statusSummary).map(([k, v]) => `${k}: ${v}`).join(", ")}\n`;
        context += `By priority: ${Object.entries(prioritySummary).map(([k, v]) => `${k}: ${v}`).join(", ")}\n`;
        context += `Verified: ${verifiedCount}\n`;

        // Recent issues
        const recentIssues = await db.query.issues.findMany({
          where: eq(issues.projectId, targetProjectId),
          columns: { id: true, title: true, status: true, priority: true, type: true },
          orderBy: desc(issues.updatedAt),
          limit: 15,
        });
        if (recentIssues.length > 0) {
          context += `\nRecent issues:\n${recentIssues.map(i => `- [${i.type}] ${i.title} (${i.status}, ${i.priority})`).join("\n")}\n`;
        }

        // Milestone progress
        const projectMilestones = await db.query.milestones.findMany({
          where: eq(milestones.projectId, targetProjectId),
          columns: { id: true, title: true, status: true },
        });
        if (projectMilestones.length > 0) {
          context += `\nMilestones:\n${projectMilestones.map(m => `- ${m.title} (${m.status})`).join("\n")}\n`;
        }
      }

      // Recent activity (last 10)
      const projectIssuesResult = await db
        .select({ id: issues.id })
        .from(issues)
        .where(inArray(issues.projectId, projectIds))
        .limit(500);
      const projectIssueIds = projectIssuesResult.map(i => i.id);

      if (projectIssueIds.length > 0) {
        const recentActivities = await db.query.activityLog.findMany({
          where: inArray(activityLog.issueId, projectIssueIds),
          with: {
            user: { columns: { name: true } },
            issue: { columns: { title: true } },
          },
          orderBy: desc(activityLog.createdAt),
          limit: 10,
        });

        if (recentActivities.length > 0) {
          context += `\n--- Recent Activity ---\n`;
          for (const a of recentActivities) {
            const act = a as any;
            context += `- ${act.user?.name || "Unknown"} ${a.action} on "${act.issue?.title || "Unknown"}"`;
            if (a.oldValue && a.newValue) context += ` (${a.oldValue} → ${a.newValue})`;
            context += "\n";
          }
        }
      }
    }

    const systemPrompt = `You are BugBase Assistant, an AI helper for a bug tracking and project management platform. Answer questions about project status, bugs, testing progress, milestones, and team activity using the provided context. Be concise and helpful. If you don't have enough information to answer, say so.

${context}`;

    const response = await fetch(llmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM API Error:", errorText);
      return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
