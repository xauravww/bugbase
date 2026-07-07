import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskActivity, taskAssignees, taskCategories } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, asc, and, isNull } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string }> }
) {
  try {
    const { listId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await db.query.tasks.findMany({
      where: and(eq(tasks.listId, parseInt(listId)), isNull(tasks.deletedAt)),
      orderBy: asc(tasks.sortOrder),
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
    });

    return NextResponse.json({ tasks: result });
  } catch (error) {
    console.error("GET tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string }> }
) {
  try {
    const { id, listId } = await params;
    const projectId = parseInt(id);
    const listIdNum = parseInt(listId);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, description, priority, dueDate, status, assigneeIds, categoryIds } = await request.json();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const existing = await db.query.tasks.findMany({
      where: eq(tasks.listId, listIdNum),
      columns: { sortOrder: true },
    });
    const maxSort = existing.length > 0 ? Math.max(...existing.map(t => t.sortOrder)) + 1 : 0;

    const validStatus = status === "completed" ? "completed" : "active";
    const isCompleted = validStatus === "completed";

    const result = db.transaction((tx) => {
      const created = tx.insert(tasks).values({
        listId: listIdNum,
        title,
        description: description || null,
        priority: priority || "none",
        status: validStatus,
        dueDate: dueDate ? new Date(dueDate) : null,
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? authUser.id : null,
        sortOrder: maxSort,
        createdBy: authUser.id,
      }).returning().all();

      const newId = created[0].id;

      if (Array.isArray(assigneeIds)) {
        for (const uid of assigneeIds as number[]) {
          tx.insert(taskAssignees).values({ taskId: newId, userId: uid }).run();
        }
      }
      if (Array.isArray(categoryIds)) {
        for (const cid of categoryIds as number[]) {
          tx.insert(taskCategories).values({ taskId: newId, categoryId: cid }).run();
        }
      }

      tx.insert(taskActivity).values({
        projectId,
        taskId: newId,
        userId: authUser.id,
        action: "task_created",
        newValue: title,
      }).run();

      return created[0];
    });

    return NextResponse.json({ task: result }, { status: 201 });
  } catch (error) {
    console.error("POST task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
