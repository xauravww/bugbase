import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taskActivity } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");
    const action = url.searchParams.get("action");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const conditions = [eq(taskActivity.projectId, projectId)];
    if (taskId) conditions.push(eq(taskActivity.taskId, parseInt(taskId)));
    if (action) conditions.push(eq(taskActivity.action, action));
    if (dateFrom) conditions.push(gte(taskActivity.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(taskActivity.createdAt, new Date(dateTo)));

    const activities = await db.query.taskActivity.findMany({
      where: and(...conditions),
      orderBy: desc(taskActivity.createdAt),
      limit,
      with: {
        user: { columns: { id: true, name: true } },
        task: { columns: { id: true, title: true } },
      },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("GET task-activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
