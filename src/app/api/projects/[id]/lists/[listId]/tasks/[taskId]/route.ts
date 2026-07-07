import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, taskActivity, taskAssignees, taskCompleters, taskCategories } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, parseInt(taskId)),
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

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({ task });
  } catch (error) {
    console.error("GET task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const taskIdNum = parseInt(taskId);
    const projectId = parseInt(id);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const existing = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskIdNum),
      columns: { status: true, title: true, deletedAt: true },
    });
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    // Restore from soft-delete
    if (body.restore === true) updates.deletedAt = null;

    let statusChanged = false;
    const validStatus = body.status === "completed" ? "completed" : body.status === "active" ? "active" : undefined;
    if (validStatus !== undefined && validStatus !== existing.status) {
      statusChanged = true;
      updates.status = validStatus;
      if (validStatus === "completed") {
        updates.completedAt = new Date();
        updates.completedBy = authUser.id;
      } else {
        updates.completedAt = null;
        updates.completedBy = null;
      }
    }

    db.transaction((tx) => {
      tx.update(tasks).set(updates).where(eq(tasks.id, taskIdNum)).run();

      // Assignees (full replace)
      if (Array.isArray(body.assigneeIds)) {
        tx.delete(taskAssignees).where(eq(taskAssignees.taskId, taskIdNum)).run();
        for (const uid of body.assigneeIds as number[]) {
          tx.insert(taskAssignees).values({ taskId: taskIdNum, userId: uid }).run();
        }
      }

      // Completers (full replace)
      if (Array.isArray(body.completerIds)) {
        tx.delete(taskCompleters).where(eq(taskCompleters.taskId, taskIdNum)).run();
        for (const uid of body.completerIds as number[]) {
          tx.insert(taskCompleters).values({ taskId: taskIdNum, userId: uid, completedAt: new Date() }).run();
        }
      }

      // Categories / labels (full replace)
      if (Array.isArray(body.categoryIds)) {
        tx.delete(taskCategories).where(eq(taskCategories.taskId, taskIdNum)).run();
        for (const cid of body.categoryIds as number[]) {
          tx.insert(taskCategories).values({ taskId: taskIdNum, categoryId: cid }).run();
        }
      }

      // On completion, auto-add the completer to the completers list
      if (statusChanged && validStatus === "completed") {
        tx.insert(taskCompleters)
          .values({ taskId: taskIdNum, userId: authUser.id, completedAt: new Date() })
          .onConflictDoNothing()
          .run();
      }

      const action = body.restore === true ? "task_restored"
        : validStatus === "completed" ? "task_completed"
        : validStatus === "active" && existing.status === "completed" ? "task_reopened"
        : "task_updated";

      tx.insert(taskActivity).values({
        projectId,
        taskId: taskIdNum,
        userId: authUser.id,
        action,
        oldValue: statusChanged ? existing.status : undefined,
        newValue: validStatus || body.title || undefined,
      }).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const taskIdNum = parseInt(taskId);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskIdNum),
      columns: { title: true },
    });

    db.transaction((tx) => {
      // Soft delete — preserves ID so undo/restore is trivial
      tx.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, taskIdNum)).run();
      tx.insert(taskActivity).values({
        projectId: parseInt(id),
        taskId: taskIdNum,
        userId: authUser.id,
        action: "task_deleted",
        oldValue: task?.title || undefined,
      }).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
