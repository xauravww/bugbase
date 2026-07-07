import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subtasks, taskActivity } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string; subtaskId: string }> }
) {
  try {
    const { id, taskId, subtaskId } = await params;
    const subtaskIdNum = parseInt(subtaskId);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const existing = await db.query.subtasks.findFirst({
      where: eq(subtasks.id, subtaskIdNum),
      columns: { status: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.restore === true) updates.deletedAt = null;

    if (body.status !== undefined && body.status !== existing.status) {
      updates.status = body.status;
      if (body.status === "completed") {
        updates.completedAt = new Date();
        updates.completedBy = authUser.id;
      } else {
        updates.completedAt = null;
        updates.completedBy = null;
      }
    }

    db.transaction((tx) => {
      tx.update(subtasks).set(updates).where(eq(subtasks.id, subtaskIdNum)).run();

      const action = body.restore === true ? "subtask_restored"
        : body.status === "completed" ? "subtask_completed"
        : body.status === "active" && existing.status === "completed" ? "subtask_reopened"
        : "subtask_updated";

      tx.insert(taskActivity).values({
        projectId: parseInt(id),
        taskId: parseInt(taskId),
        subtaskId: subtaskIdNum,
        userId: authUser.id,
        action,
        oldValue: existing.status !== body.status ? existing.status : undefined,
        newValue: body.status || body.title || undefined,
      }).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH subtask error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string; subtaskId: string }> }
) {
  try {
    const { id, taskId, subtaskId } = await params;
    const subtaskIdNum = parseInt(subtaskId);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sub = await db.query.subtasks.findFirst({
      where: eq(subtasks.id, subtaskIdNum),
      columns: { title: true },
    });

    db.transaction((tx) => {
      // Soft delete — preserves ID for undo/restore
      tx.update(subtasks).set({ deletedAt: new Date() }).where(eq(subtasks.id, subtaskIdNum)).run();
      tx.insert(taskActivity).values({
        projectId: parseInt(id),
        taskId: parseInt(taskId),
        subtaskId: subtaskIdNum,
        userId: authUser.id,
        action: "subtask_deleted",
        oldValue: sub?.title || undefined,
      }).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE subtask error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
