import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, activityLog, issueAssignees, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's projects
    const userMemberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, authUser.id),
    });
    const projectIds = userMemberships.map(m => m.projectId);

    let allIssuesInProjects: typeof issues.$inferSelect[] = [];
    if (projectIds.length > 0) {
      allIssuesInProjects = await db.query.issues.findMany({
        where: inArray(issues.projectId, projectIds),
      });
    }

    const openBugs = allIssuesInProjects.filter(i => i.type === "Bug" && i.status !== "Closed").length;
    const openFeatures = allIssuesInProjects.filter(i => i.type === "Feature" && i.status !== "Closed").length;
    const inProgress = allIssuesInProjects.filter(i => i.status === "In Progress").length;
    const resolvedToday = allIssuesInProjects.filter(i => {
      if (i.status !== "Closed" && i.status !== "Verified") return false;
      const updated = i.updatedAt ? new Date(i.updatedAt) : null;
      return updated && updated >= today;
    }).length;

    // Get user's assigned issues
    const userAssignments = await db.query.issueAssignees.findMany({
      where: eq(issueAssignees.userId, authUser.id),
    });
    
    const assignedIssueIds = userAssignments.map(a => a.issueId);
    
    let recentIssues: Array<{
      id: number;
      title: string;
      type: string;
      status: string;
      priority: string;
      projectName: string;
      updatedAt: string;
    }> = [];

    // Get issues from projects user is member of (that aren't closed)
    if (projectIds.length > 0) {
      const projectIssues = await db.query.issues.findMany({
        where: and(
          inArray(issues.projectId, projectIds),
          sql`${issues.status} != 'Closed'`
        ),
        with: {
          project: true,
        },
        orderBy: desc(issues.updatedAt),
        limit: 10,
      });

      recentIssues = projectIssues.map(issue => ({
        id: issue.id,
        title: issue.title,
        type: issue.type,
        status: issue.status,
        priority: issue.priority,
        projectName: issue.project?.name || "Unknown",
        updatedAt: issue.updatedAt?.toISOString() || new Date().toISOString(),
      }));
    }

    // Get recent activities from user's projects
    const projectIssueIds = allIssuesInProjects.map(i => i.id);

    let activities: Awaited<ReturnType<typeof db.query.activityLog.findMany>> = [];
    if (projectIssueIds.length > 0) {
      activities = await db.query.activityLog.findMany({
        where: inArray(activityLog.issueId, projectIssueIds),
        with: {
          user: true,
          issue: true,
        },
        orderBy: desc(activityLog.createdAt),
        limit: 20,
      });
    }

    const recentActivities = activities.map((activity: any) => ({
      id: activity.id,
      action: activity.action,
      issueId: activity.issueId,
      issueTitle: activity.issue?.title || "Unknown",
      userName: activity.user?.name || "Unknown",
      createdAt: activity.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({
      stats: {
        openBugs,
        openFeatures,
        inProgress,
        resolvedToday,
      },
      recentIssues,
      recentActivities,
    });
    
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
