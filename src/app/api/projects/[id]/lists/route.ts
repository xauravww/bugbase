import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lists, tasks, taskActivity } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, asc, and, isNull, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const shallow = request.nextUrl.searchParams.get("shallow") === "true";

    if (shallow) {
      const result = await db.query.lists.findMany({
        where: and(eq(lists.projectId, projectId), isNull(lists.deletedAt)),
        orderBy: asc(lists.sortOrder),
        with: { creator: { columns: { id: true, name: true } } },
      });

      const counts = db
        .select({
          listId: tasks.listId,
          total: sql<number>`count(*)`.as("total"),
          active: sql<number>`sum(case when ${tasks.status} = 'active' then 1 else 0 end)`.as("active"),
          completed: sql<number>`sum(case when ${tasks.status} = 'completed' then 1 else 0 end)`.as("completed"),
        })
        .from(tasks)
        .where(isNull(tasks.deletedAt))
        .groupBy(tasks.listId)
        .all();

      const countMap = Object.fromEntries(counts.map(c => [c.listId, c]));

      return NextResponse.json({
        lists: result.map(l => ({
          ...l,
          taskCount: countMap[l.id]?.total || 0,
          activeTaskCount: countMap[l.id]?.active || 0,
          completedTaskCount: countMap[l.id]?.completed || 0,
        })),
      });
    }

    const result = await db.query.lists.findMany({
      where: and(eq(lists.projectId, projectId), isNull(lists.deletedAt)),
      orderBy: asc(lists.sortOrder),
      with: {
        creator: { columns: { id: true, name: true } },
        tasks: {
          where: (t, { isNull }) => isNull(t.deletedAt),
          orderBy: (t, { asc }) => [asc(t.sortOrder)],
          with: {
            creator: { columns: { id: true, name: true } },
            assignees: { with: { user: { columns: { id: true, name: true } } } },
            completers: { with: { user: { columns: { id: true, name: true } } } },
            categories: { with: { category: { columns: { id: true, name: true, color: true } } } },
            subtasks: {
              where: (s, { isNull }) => isNull(s.deletedAt),
              orderBy: (s, { asc }) => [asc(s.sortOrder)],
              with: {
                checklist: {
                  where: (c, { isNull }) => isNull(c.deletedAt),
                  orderBy: (c, { asc }) => [asc(c.sortOrder)],
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ lists: result });
  } catch (error) {
    console.error("GET lists error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, description, color } = await request.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const existing = await db.query.lists.findMany({
      where: eq(lists.projectId, projectId),
      columns: { sortOrder: true },
    });
    const maxSort = existing.length > 0 ? Math.max(...existing.map(l => l.sortOrder)) + 1 : 0;

    const result = db.transaction((tx) => {
      const created = tx.insert(lists).values({
        projectId,
        name,
        description: description || null,
        color: color || "#5b76fe",
        sortOrder: maxSort,
        createdBy: authUser.id,
      }).returning().all();

      tx.insert(taskActivity).values({
        projectId,
        userId: authUser.id,
        action: "list_created",
        newValue: name,
      }).run();

      return created[0];
    });

    return NextResponse.json({ list: result }, { status: 201 });
  } catch (error) {
    console.error("POST list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
