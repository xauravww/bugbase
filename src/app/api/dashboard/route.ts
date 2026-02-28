import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, activityLog, projectMembers, issueAssignees } from "@/lib/db/schema";
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

    // Use SQL aggregations instead of loading all into memory
    const stats = {
      openBugs: 0,
      openFeatures: 0,
      inProgress: 0,
      resolvedToday: 0,
    };

    if (projectIds.length > 0) {
      // Get counts using aggregation
      const counts = await db
        .select({
          type: issues.type,
          status: issues.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(issues)
        .where(inArray(issues.projectId, projectIds))
        .groupBy(issues.type, issues.status);

      for (const row of counts) {
        if (row.type === "Bug" && row.status !== "Closed") {
          stats.openBugs += row.count;
        }
        if (row.type === "Feature" && row.status !== "Closed") {
          stats.openFeatures += row.count;
        }
        if (row.status === "In Progress") {
          stats.inProgress += row.count;
        }
      }

      // Get resolved today count separately (need date comparison)
      const resolvedTodayResult = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(issues)
        .where(
          and(
            inArray(issues.projectId, projectIds),
            sql`${issues.status} IN('Closed', 'Verified')`,
            sql`${issues.updatedAt} >= ${today.toISOString()} `
          )
        );
      stats.resolvedToday = resolvedTodayResult[0]?.count || 0;
    }

    // Get recent issues (limit to 10, done in database)
    let recentIssues: Array<{
      id: number;
      title: string;
      type: string;
      status: string;
      priority: string;
      projectName: string;
      updatedAt: string;
    }> = [];

    if (projectIds.length > 0) {
      const assignments = await db.query.issueAssignees.findMany({
        where: eq(issueAssignees.userId, authUser.id),
      });
      const assignedIssueIds = assignments.map(a => a.issueId);

      if (assignedIssueIds.length > 0) {
        const projectIssues = await db.query.issues.findMany({
          where: and(
            inArray(issues.id, assignedIssueIds),
            inArray(issues.projectId, projectIds),
            sql`${issues.status} != 'Closed'`
          ),
          with: {
            project: { columns: { name: true } },
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
    }

    // Get recent activities
    let activities: Awaited<ReturnType<typeof db.query.activityLog.findMany>> = [];

    // Get issue IDs for user's projects first
    const projectIssuesResult = await db
      .select({ id: issues.id })
      .from(issues)
      .where(inArray(issues.projectId, projectIds));
    const projectIssueIds = projectIssuesResult.map(i => i.id);

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

    const recentActivities = activities.map((activity) => {
      const activityWithRelations = activity as typeof activity & { issue?: { title: string } | null; user?: { name: string } | null };
      return {
        id: activity.id,
        action: activity.action,
        issueId: activity.issueId,
        issueTitle: activityWithRelations.issue?.title || "Unknown",
        userName: activityWithRelations.user?.name || "Unknown",
        createdAt: activity.createdAt?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      stats,
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
