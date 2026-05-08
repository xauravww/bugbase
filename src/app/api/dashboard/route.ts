import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issues, activityLog, projectMembers, issueAssignees, projects } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, sql, desc, inArray, gte } from "drizzle-orm";

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

    const accessibleProjects = authUser.role === "Admin"
      ? await db.query.projects.findMany({
        where: eq(projects.archived, false),
        columns: { id: true },
      })
      : await db.query.projectMembers.findMany({
        where: eq(projectMembers.userId, authUser.id),
        columns: { projectId: true },
      });

    const projectIds = accessibleProjects.map(project =>
      "projectId" in project ? project.projectId : project.id
    );

    // Use SQL aggregations instead of loading all into memory
    const stats = {
      open: 0,
      inProgress: 0,
      inReview: 0,
      verified: 0,
      closed: 0,
      openToday: 0,
      inProgressToday: 0,
      inReviewToday: 0,
      verifiedToday: 0,
      closedToday: 0,
    };

    if (projectIds.length > 0) {
      // Base filter: all issues in user's projects
      const baseWhere = inArray(issues.projectId, projectIds);

      // Get all-time counts using aggregation
      const counts = await db
        .select({
          status: issues.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(issues)
        .where(baseWhere)
        .groupBy(issues.status);

      // Today's counts from status changes
      const todayCounts = await db
        .select({
          status: activityLog.newValue,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(activityLog)
        .innerJoin(issues, eq(activityLog.issueId, issues.id))
        .where(and(
          inArray(issues.projectId, projectIds),
          eq(activityLog.action, "status_changed"),
          gte(activityLog.createdAt, today)
        ))
        .groupBy(activityLog.newValue);

      // Issues created today still in "Open" status (no "changed status" log for initial creation)
      const createdOpenToday = await db
        .select({
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(issues)
        .where(and(
          inArray(issues.projectId, projectIds),
          eq(issues.status, "Open"),
          gte(issues.createdAt, today)
        ));

      // Process all-time counts
      for (const row of counts) {
        if (row.status === "Open") {
          stats.open += row.count;
        }
        if (row.status === "In Progress") {
          stats.inProgress += row.count;
        }
        if (row.status === "In Review") {
          stats.inReview += row.count;
        }
        if (row.status === "Verified") {
          stats.verified += row.count;
        }
        if (row.status === "Closed") {
          stats.closed += row.count;
        }
      }

      // Count issues created today still in Open status
      if (createdOpenToday[0]?.count) {
        stats.openToday += createdOpenToday[0].count;
      }

      // Process today's counts from status changes
      for (const row of todayCounts) {
        if (row.status === "Open") {
          stats.openToday += row.count;
        }
        if (row.status === "In Progress") {
          stats.inProgressToday += row.count;
        }
        if (row.status === "In Review") {
          stats.inReviewToday += row.count;
        }
        if (row.status === "Verified") {
          stats.verifiedToday += row.count;
        }
        if (row.status === "Closed") {
          stats.closedToday += row.count;
        }
      }
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

    // Get today's status changes grouped by new status
    let todayStatusChanges: Array<{
      action: string;
      newValue: string | null;
      issueId: number | null;
      issueTitle: string;
      userName: string;
      createdAt: string;
    }> = [];

    if (projectIssueIds.length > 0) {
      const statusActivities = await db.query.activityLog.findMany({
        where: and(
          inArray(activityLog.issueId, projectIssueIds),
          eq(activityLog.action, "status_changed"),
          gte(activityLog.createdAt, today)
        ),
        with: {
          user: true,
          issue: true,
        },
        orderBy: desc(activityLog.createdAt),
        limit: 50,
      });

      todayStatusChanges = statusActivities.map((a) => {
        const act = a as typeof a & { issue?: { title: string } | null; user?: { name: string } | null };
        return {
          action: a.action,
          newValue: a.newValue,
          issueId: a.issueId,
          issueTitle: act.issue?.title || "Unknown",
          userName: act.user?.name || "Unknown",
          createdAt: a.createdAt?.toISOString() || new Date().toISOString(),
        };
      });
    }

    return NextResponse.json({
      stats,
      recentIssues,
      recentActivities,
      todayStatusChanges,
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
