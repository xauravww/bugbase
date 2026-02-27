import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activityLog, issues, users, projectMembers } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, like, and, gte, lte } from "drizzle-orm";

// GET /api/settings/activity-logs - Get activity logs with pagination & filtering
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    
    if (!authUser || authUser.role !== "Admin") {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const action = searchParams.get("action") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    let whereClause = undefined;
    const conditions = [];

    if (search) {
      conditions.push(like(activityLog.action, `%${search}%`));
    }
    if (action) {
      conditions.push(eq(activityLog.action, action));
    }
    if (dateFrom) {
      conditions.push(gte(activityLog.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(activityLog.createdAt, new Date(dateTo)));
    }
    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    const logs = await db.query.activityLog.findMany({
      orderBy: desc(activityLog.createdAt),
      limit,
      offset,
      where: whereClause,
      with: {
        user: { columns: { id: true, name: true, email: true } },
        issue: {
          columns: { id: true, title: true },
          with: { project: { columns: { id: true, name: true } } },
        },
      },
    });

    const countQuery = db.select({ id: activityLog.id }).from(activityLog);
    const countResult = await (whereClause 
      ? db.select({ id: activityLog.id }).from(activityLog).where(whereClause)
      : countQuery);
    const total = countResult.length;

    return NextResponse.json({ 
      logs: logs.map(l => ({
        id: l.id,
        action: l.action,
        oldValue: l.oldValue,
        newValue: l.newValue,
        createdAt: l.createdAt,
        user: l.user,
        issue: l.issue ? { id: l.issue.id, title: l.issue.title, project: l.issue.project } : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
    
  } catch (error) {
    console.error("Get logs error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
