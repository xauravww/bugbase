import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectMembers } from "@/lib/db/schema";
import {
  requirements, features, devTasks, bugs, releases, risks, milestones, sprints,
  meetingNotes, archDocs, apiDocs, ideas, pmActivity,
} from "@/lib/db/pm-schema";
import { getAuthUser } from "@/lib/auth";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

/**
 * Multi-project PM dashboard. One endpoint returns every widget's data so
 * the client renders in a single round-trip. All counts are SQL aggregates
 * scoped to the caller's accessible (non-archived) projects.
 */
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  try {
    // accessible projects
    const projRows =
      authUser.role === "Admin"
        ? await db.select({ id: projects.id, name: projects.name, key: projects.key }).from(projects).where(eq(projects.archived, false))
        : await db
            .select({ id: projects.id, name: projects.name, key: projects.key })
            .from(projects)
            .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
            .where(and(eq(projectMembers.userId, authUser.id), eq(projects.archived, false)));

    const pids = projRows.map((p) => p.id);
    if (pids.length === 0) {
      return NextResponse.json({ empty: true, projects: [] });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    // Per-project task rollups for completion% + health.
    const taskAgg = await db
      .select({
        projectId: devTasks.projectId,
        total: sql<number>`count(*)`.mapWith(Number),
        done: sql<number>`sum(case when ${devTasks.status} = 'Done' then 1 else 0 end)`.mapWith(Number),
      })
      .from(devTasks)
      .where(inArray(devTasks.projectId, pids))
      .groupBy(devTasks.projectId);

    // Open bugs per project + critical open count.
    const bugAgg = await db
      .select({
        projectId: bugs.projectId,
        open: sql<number>`sum(case when ${bugs.status} in ('Open','In Progress') then 1 else 0 end)`.mapWith(Number),
        critical: sql<number>`sum(case when ${bugs.status} in ('Open','In Progress') and ${bugs.severity} = 'Critical' then 1 else 0 end)`.mapWith(Number),
      })
      .from(bugs)
      .where(inArray(bugs.projectId, pids))
      .groupBy(bugs.projectId);

    const reqAgg = await db
      .select({ projectId: requirements.projectId, total: sql<number>`count(*)`.mapWith(Number) })
      .from(requirements).where(inArray(requirements.projectId, pids)).groupBy(requirements.projectId);
    const featAgg = await db
      .select({ projectId: features.projectId, total: sql<number>`count(*)`.mapWith(Number) })
      .from(features).where(inArray(features.projectId, pids)).groupBy(features.projectId);
    const relAgg = await db
      .select({ projectId: releases.projectId, total: sql<number>`count(*)`.mapWith(Number) })
      .from(releases).where(inArray(releases.projectId, pids)).groupBy(releases.projectId);

    const taskMap = new Map(taskAgg.map((r) => [r.projectId, r]));
    const bugMap = new Map(bugAgg.map((r) => [r.projectId, r]));
    const reqMap = new Map(reqAgg.map((r) => [r.projectId, r.total]));
    const featMap = new Map(featAgg.map((r) => [r.projectId, r.total]));
    const relMap = new Map(relAgg.map((r) => [r.projectId, r.total]));

    // Open risks per project (for health).
    const riskAgg = await db
      .select({
        projectId: risks.projectId,
        highOpen: sql<number>`sum(case when ${risks.status} in ('Open','Mitigating') and ${risks.impact} = 'High' then 1 else 0 end)`.mapWith(Number),
      })
      .from(risks).where(inArray(risks.projectId, pids)).groupBy(risks.projectId);
    const riskMap = new Map(riskAgg.map((r) => [r.projectId, r.highOpen]));

    const projectCards = projRows.map((p) => {
      const t = taskMap.get(p.id) || { total: 0, done: 0 };
      const b = bugMap.get(p.id) || { open: 0, critical: 0 };
      const highRisk = riskMap.get(p.id) || 0;
      const completion = t.total ? Math.round((t.done / t.total) * 100) : 0;
      let health: "green" | "yellow" | "red" = "green";
      if ((b.critical || 0) > 0) health = "red";
      else if ((b.open || 0) > 3 || highRisk > 0) health = "yellow";
      return {
        id: p.id, name: p.name, key: p.key,
        completion,
        totalTasks: t.total, doneTasks: t.done,
        openBugs: b.open || 0, criticalBugs: b.critical || 0,
        requirements: reqMap.get(p.id) || 0,
        features: featMap.get(p.id) || 0,
        releases: relMap.get(p.id) || 0,
        health,
      };
    });

    const overallProgress = projectCards.length
      ? Math.round(projectCards.reduce((a, c) => a + c.completion, 0) / projectCards.length)
      : 0;

    // Widgets ---------------------------------------------------------------

    const upcomingReleases = await db.select().from(releases)
      .where(and(inArray(releases.projectId, pids), gte(releases.releaseDate, today)))
      .orderBy(releases.releaseDate).limit(5);

    const highPriorityTasks = await db.select().from(devTasks)
      .where(and(inArray(devTasks.projectId, pids), inArray(devTasks.priority, ["High", "Critical"]), sql`${devTasks.status} != 'Done'`))
      .orderBy(desc(devTasks.updatedAt)).limit(8);

    const tasksDueToday = await db.select().from(devTasks)
      .where(and(inArray(devTasks.projectId, pids), gte(devTasks.dueDate, today), lte(devTasks.dueDate, endOfToday), sql`${devTasks.status} != 'Done'`))
      .limit(10);

    const myTasks = await db.select().from(devTasks)
      .where(and(inArray(devTasks.projectId, pids), eq(devTasks.assigneeId, authUser.id), sql`${devTasks.status} != 'Done'`))
      .orderBy(desc(devTasks.updatedAt)).limit(8);

    const openBugsList = await db.select().from(bugs)
      .where(and(inArray(bugs.projectId, pids), inArray(bugs.status, ["Open", "In Progress"])))
      .orderBy(desc(bugs.updatedAt)).limit(10);

    const activeSprints = await db.select().from(sprints)
      .where(and(inArray(sprints.projectId, pids), eq(sprints.status, "Active"))).limit(6);

    // sprint task rollups
    const sprintIds = activeSprints.map((s) => s.id);
    let sprintTaskAgg: { sprintId: number | null; total: number; done: number }[] = [];
    if (sprintIds.length) {
      sprintTaskAgg = await db.select({
        sprintId: devTasks.sprintId,
        total: sql<number>`count(*)`.mapWith(Number),
        done: sql<number>`sum(case when ${devTasks.status} = 'Done' then 1 else 0 end)`.mapWith(Number),
      }).from(devTasks).where(inArray(devTasks.sprintId, sprintIds)).groupBy(devTasks.sprintId);
    }
    const sprintMap = new Map(sprintTaskAgg.map((r) => [r.sprintId, r]));
    const sprintCards = activeSprints.map((s) => {
      const agg = sprintMap.get(s.id) || { total: 0, done: 0 };
      return { ...s, totalTasks: agg.total, doneTasks: agg.done, completion: agg.total ? Math.round((agg.done / agg.total) * 100) : 0 };
    });

    const upcomingMilestones = await db.select().from(milestones)
      .where(and(inArray(milestones.projectId, pids), sql`${milestones.status} != 'Done'`))
      .orderBy(milestones.targetDate).limit(6);

    const openRisks = await db.select().from(risks)
      .where(and(inArray(risks.projectId, pids), inArray(risks.status, ["Open", "Mitigating"])))
      .orderBy(desc(risks.updatedAt)).limit(6);

    const latestMeetings = await db.select().from(meetingNotes)
      .where(inArray(meetingNotes.projectId, pids))
      .orderBy(desc(meetingNotes.meetingDate)).limit(3);

    const recentArch = await db.select({
      id: archDocs.id, title: archDocs.title, category: archDocs.category, projectId: archDocs.projectId, updatedAt: archDocs.updatedAt,
    }).from(archDocs).where(inArray(archDocs.projectId, pids)).orderBy(desc(archDocs.updatedAt)).limit(5);
    const recentApi = await db.select({
      id: apiDocs.id, endpoint: apiDocs.endpoint, httpMethod: apiDocs.httpMethod, projectId: apiDocs.projectId, updatedAt: apiDocs.updatedAt,
    }).from(apiDocs).where(inArray(apiDocs.projectId, pids)).orderBy(desc(apiDocs.updatedAt)).limit(5);

    const recentActivity = await db.select().from(pmActivity)
      .where(inArray(pmActivity.projectId, pids))
      .orderBy(desc(pmActivity.createdAt)).limit(15);

    const projName = new Map(projRows.map((p) => [p.id, p.key]));
    const withKey = <T extends { projectId: number }>(rows: T[]) =>
      rows.map((r) => ({ ...r, projectKey: projName.get(r.projectId) ?? "—" }));

    return NextResponse.json({
      projects: projectCards,
      activeProjectCount: projectCards.length,
      overallProgress,
      upcomingReleases: withKey(upcomingReleases),
      highPriorityTasks: withKey(highPriorityTasks),
      tasksDueToday: withKey(tasksDueToday),
      myTasks: withKey(myTasks),
      openBugs: withKey(openBugsList),
      totalOpenBugs: projectCards.reduce((a, c) => a + c.openBugs, 0),
      sprints: withKey(sprintCards),
      milestones: withKey(upcomingMilestones),
      risks: withKey(openRisks),
      latestMeetings: withKey(latestMeetings),
      recentDocs: [...withKey(recentArch), ...withKey(recentApi)],
      recentActivity: withKey(recentActivity),
    });
  } catch (error) {
    console.error("[pm/dashboard] error:", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
