import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  projectMembers,
  issues,
  comments,
  activityLog,
  users,
} from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";

// GET /api/projects/[id]/team-progress?from=&to=&userId=
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "Invalid project ID", code: "INVALID_ID" }, { status: 400 });
    }

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) {
      return NextResponse.json({ error: "Project not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const membership = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, authUser.id)),
    });
    if (!membership && authUser.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const fromStr = sp.get("from");
    const toStr = sp.get("to");
    const userIdStr = sp.get("userId");
    const userIdFilter = userIdStr ? parseInt(userIdStr) : null;
    const limitParam = parseInt(sp.get("limit") || "20");
    const offsetParam = parseInt(sp.get("offset") || "0");
    const feedLimit = Math.max(1, Math.min(100, isNaN(limitParam) ? 20 : limitParam));
    const feedOffset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = fromStr ? new Date(fromStr) : defaultFrom;
    const to = toStr ? new Date(toStr) : now;
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date", code: "INVALID_DATE" }, { status: 400 });
    }

    // Members
    const members = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, projectId),
      with: {
        user: { columns: { id: true, name: true, email: true, role: true } },
      },
    });

    // Project's issue ids (for scoping comments + activity)
    const projectIssueRows = await db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.projectId, projectId));
    const projectIssueIds = projectIssueRows.map((r) => r.id);

    // Issues created in range, by reporter
    const createdRows = await db
      .select({ userId: issues.reporterId, count: sql<number>`COUNT(*)` })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), gte(issues.createdAt, from), lte(issues.createdAt, to)))
      .groupBy(issues.reporterId);

    // Issues closed (status changes to Closed/Verified) in range
    const closedRows = projectIssueIds.length
      ? await db
          .select({ userId: activityLog.userId, count: sql<number>`COUNT(*)` })
          .from(activityLog)
          .where(
            and(
              inArray(activityLog.issueId, projectIssueIds),
              eq(activityLog.action, "status_changed"),
              gte(activityLog.createdAt, from),
              lte(activityLog.createdAt, to),
              inArray(activityLog.newValue, ["Closed", "Verified"])
            )
          )
          .groupBy(activityLog.userId)
      : [];

    // Status updates (any status change) in range, by user
    const statusUpdateRows = projectIssueIds.length
      ? await db
          .select({ userId: activityLog.userId, count: sql<number>`COUNT(*)` })
          .from(activityLog)
          .where(
            and(
              inArray(activityLog.issueId, projectIssueIds),
              eq(activityLog.action, "status_changed"),
              gte(activityLog.createdAt, from),
              lte(activityLog.createdAt, to)
            )
          )
          .groupBy(activityLog.userId)
      : [];

    // Comments in range, by user
    const commentRows = projectIssueIds.length
      ? await db
          .select({ userId: comments.userId, count: sql<number>`COUNT(*)` })
          .from(comments)
          .where(
            and(
              inArray(comments.issueId, projectIssueIds),
              gte(comments.createdAt, from),
              lte(comments.createdAt, to)
            )
          )
          .groupBy(comments.userId)
      : [];

    // Total activity events in range, by user
    const activityRows = projectIssueIds.length
      ? await db
          .select({ userId: activityLog.userId, count: sql<number>`COUNT(*)` })
          .from(activityLog)
          .where(
            and(
              inArray(activityLog.issueId, projectIssueIds),
              gte(activityLog.createdAt, from),
              lte(activityLog.createdAt, to)
            )
          )
          .groupBy(activityLog.userId)
      : [];

    type StatBucket = { created: number; closed: number; comments: number; statusUpdates: number; activity: number };
    const byUser = new Map<number, StatBucket>();
    const ensure = (uid: number) => {
      let b = byUser.get(uid);
      if (!b) {
        b = { created: 0, closed: 0, comments: 0, statusUpdates: 0, activity: 0 };
        byUser.set(uid, b);
      }
      return b;
    };
    createdRows.forEach((r) => { ensure(r.userId).created = Number(r.count); });
    closedRows.forEach((r) => { ensure(r.userId).closed = Number(r.count); });
    commentRows.forEach((r) => { ensure(r.userId).comments = Number(r.count); });
    statusUpdateRows.forEach((r) => { ensure(r.userId).statusUpdates = Number(r.count); });
    activityRows.forEach((r) => { ensure(r.userId).activity = Number(r.count); });

    // Build per-member rows including 0-activity members
    const memberStats = members.map((m) => {
      const stats = byUser.get(m.user.id) || { created: 0, closed: 0, comments: 0, statusUpdates: 0, activity: 0 };
      return {
        user: m.user,
        role: m.role,
        ...stats,
      };
    });

    // Include any non-member contributors (e.g. former members) found in activity
    const memberIds = new Set(members.map((m) => m.user.id));
    const extraIds = Array.from(byUser.keys()).filter((id) => !memberIds.has(id));
    if (extraIds.length > 0) {
      const extras = await db.query.users.findMany({
        where: inArray(users.id, extraIds),
        columns: { id: true, name: true, email: true, role: true },
      });
      extras.forEach((u) => {
        const stats = byUser.get(u.id)!;
        memberStats.push({ user: u, role: "member" as const, ...stats });
      });
    }

    // Recent activity feed (cap 50)
    const activityWhere = userIdFilter
      ? and(
          inArray(activityLog.issueId, projectIssueIds.length ? projectIssueIds : [-1]),
          gte(activityLog.createdAt, from),
          lte(activityLog.createdAt, to),
          eq(activityLog.userId, userIdFilter)
        )
      : and(
          inArray(activityLog.issueId, projectIssueIds.length ? projectIssueIds : [-1]),
          gte(activityLog.createdAt, from),
          lte(activityLog.createdAt, to)
        );

    const recentActivity = projectIssueIds.length
      ? await db.query.activityLog.findMany({
          where: activityWhere,
          orderBy: [desc(activityLog.createdAt)],
          limit: feedLimit,
          offset: feedOffset,
          with: {
            user: { columns: { id: true, name: true, email: true } },
            issue: { columns: { id: true, title: true } },
          },
        })
      : [];

    const totalActivityRows = projectIssueIds.length
      ? await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(activityLog)
          .where(activityWhere)
      : [{ count: 0 }];
    const totalActivity = Number(totalActivityRows[0]?.count || 0);

    // Daily series with breakdown by event type
    type DailyPoint = { date: string; created: number; statusUpdates: number; comments: number; other: number; total: number };
    const dailyMap = new Map<string, DailyPoint>();
    const ensureDay = (date: string): DailyPoint => {
      let d = dailyMap.get(date);
      if (!d) {
        d = { date, created: 0, statusUpdates: 0, comments: 0, other: 0, total: 0 };
        dailyMap.set(date, d);
      }
      return d;
    };

    // Pre-fill all days in range so chart has continuous bars
    {
      const startDay = new Date(from);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(to);
      endDay.setHours(0, 0, 0, 0);
      for (let d = new Date(startDay); d.getTime() <= endDay.getTime(); d.setDate(d.getDate() + 1)) {
        ensureDay(d.toISOString().slice(0, 10));
      }
    }

    if (projectIssueIds.length) {
      // Activity log breakdown
      const dailyActivityRows = await db
        .select({
          day: sql<string>`strftime('%Y-%m-%d', ${activityLog.createdAt}, 'unixepoch')`,
          action: activityLog.action,
          count: sql<number>`COUNT(*)`,
        })
        .from(activityLog)
        .where(
          and(
            inArray(activityLog.issueId, projectIssueIds),
            gte(activityLog.createdAt, from),
            lte(activityLog.createdAt, to),
            ...(userIdFilter ? [eq(activityLog.userId, userIdFilter)] : [])
          )
        )
        .groupBy(sql`strftime('%Y-%m-%d', ${activityLog.createdAt}, 'unixepoch')`, activityLog.action);

      dailyActivityRows.forEach((r) => {
        const bucket = ensureDay(r.day);
        const c = Number(r.count);
        if (r.action === "status_changed") bucket.statusUpdates += c;
        else if (r.action === "comment_added") bucket.comments += c;
        else bucket.other += c;
        bucket.total += c;
      });

      // Issues created (issues table, not activity log)
      const dailyCreatedRows = await db
        .select({
          day: sql<string>`strftime('%Y-%m-%d', ${issues.createdAt}, 'unixepoch')`,
          count: sql<number>`COUNT(*)`,
        })
        .from(issues)
        .where(
          and(
            eq(issues.projectId, projectId),
            gte(issues.createdAt, from),
            lte(issues.createdAt, to),
            ...(userIdFilter ? [eq(issues.reporterId, userIdFilter)] : [])
          )
        )
        .groupBy(sql`strftime('%Y-%m-%d', ${issues.createdAt}, 'unixepoch')`);

      dailyCreatedRows.forEach((r) => {
        const bucket = ensureDay(r.day);
        const c = Number(r.count);
        bucket.created += c;
        bucket.total += c;
      });

      // Comments daily (overrides activity log "comment_added" counts since
      // comments are tracked in their own table — activity log may not log them
      // depending on app paths)
      const dailyCommentRows = await db
        .select({
          day: sql<string>`strftime('%Y-%m-%d', ${comments.createdAt}, 'unixepoch')`,
          count: sql<number>`COUNT(*)`,
        })
        .from(comments)
        .where(
          and(
            inArray(comments.issueId, projectIssueIds),
            gte(comments.createdAt, from),
            lte(comments.createdAt, to),
            ...(userIdFilter ? [eq(comments.userId, userIdFilter)] : [])
          )
        )
        .groupBy(sql`strftime('%Y-%m-%d', ${comments.createdAt}, 'unixepoch')`);

      dailyCommentRows.forEach((r) => {
        const bucket = ensureDay(r.day);
        const c = Number(r.count);
        // Replace activity-log comment count with authoritative comments table count
        bucket.total = bucket.total - bucket.comments + c;
        bucket.comments = c;
      });
    }
    const dailySeries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      members: memberStats.sort((a, b) => b.activity - a.activity),
      recentActivity,
      dailySeries,
      totals: {
        created: createdRows.reduce((s, r) => s + Number(r.count), 0),
        closed: closedRows.reduce((s, r) => s + Number(r.count), 0),
        comments: commentRows.reduce((s, r) => s + Number(r.count), 0),
        statusUpdates: statusUpdateRows.reduce((s, r) => s + Number(r.count), 0),
        activity: activityRows.reduce((s, r) => s + Number(r.count), 0),
      },
      feed: {
        limit: feedLimit,
        offset: feedOffset,
        total: totalActivity,
        hasMore: feedOffset + recentActivity.length < totalActivity,
      },
    });
  } catch (error) {
    console.error("Team progress error:", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
