import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { workLogs, projectMembers } from "@/lib/db/schema";
import { and, eq, gte, lte, desc, lt } from "drizzle-orm";

const PAGE_SIZE = 20;

/**
 * GET /api/work-logs?userId=&projectId=&start=&end=&cursor=&limit=
 *
 * Admins: see all users' logs (no userId required). Pass userId to filter to one user.
 * Non-admins: own logs only.
 * cursor: last log id for keyset pagination (returns logs with id < cursor).
 */
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const requestedUserId = sp.get("userId") ? Number(sp.get("userId")) : null;

  if (requestedUserId && requestedUserId !== authUser.id && authUser.role !== "Admin") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const conds = [];

  // Non-admins always scoped to self; admins can filter or see all
  if (authUser.role !== "Admin") {
    conds.push(eq(workLogs.userId, authUser.id));
  } else if (requestedUserId) {
    conds.push(eq(workLogs.userId, requestedUserId));
  }

  const projectId = sp.get("projectId");
  if (projectId) conds.push(eq(workLogs.projectId, Number(projectId)));

  const start = sp.get("start");
  if (start) conds.push(gte(workLogs.logDate, new Date(start)));

  const end = sp.get("end");
  if (end) {
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    conds.push(lte(workLogs.logDate, e));
  }

  const cursor = sp.get("cursor");
  if (cursor) conds.push(lt(workLogs.id, Number(cursor)));

  const limit = Math.min(Number(sp.get("limit") || PAGE_SIZE), 100);

  const logs = await db.query.workLogs.findMany({
    where: conds.length > 0 ? and(...conds) : undefined,
    with: {
      project: { columns: { id: true, name: true, key: true } },
      user: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(workLogs.logDate), desc(workLogs.id)],
    limit: limit + 1, // fetch one extra to know if there's a next page
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ logs: items, nextCursor, hasMore });
}

/**
 * POST /api/work-logs
 * Body: { content, logDate?, projectId? }
 */
export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, logDate, projectId } = await request.json();
  if (!content || !String(content).trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (projectId && authUser.role !== "Admin") {
    const member = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.userId, authUser.id),
        eq(projectMembers.projectId, Number(projectId))
      ),
    });
    if (!member) return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const [log] = await db
    .insert(workLogs)
    .values({
      userId: authUser.id,
      projectId: projectId ? Number(projectId) : null,
      logDate: logDate ? new Date(logDate) : new Date(),
      content: String(content).trim(),
    })
    .returning();

  return NextResponse.json({ log }, { status: 201 });
}
