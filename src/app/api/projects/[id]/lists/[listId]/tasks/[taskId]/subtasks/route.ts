import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subtasks, taskActivity } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const taskIdNum = parseInt(taskId);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, description } = await request.json();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const existing = await db.query.subtasks.findMany({
      where: eq(subtasks.taskId, taskIdNum),
      columns: { sortOrder: true },
    });
    const maxSort = existing.length > 0 ? Math.max(...existing.map(s => s.sortOrder)) + 1 : 0;

    const result = db.transaction((tx) => {
      const created = tx.insert(subtasks).values({
        taskId: taskIdNum,
        title,
        description: description || null,
        sortOrder: maxSort,
      }).returning().all();

      tx.insert(taskActivity).values({
        projectId: parseInt(id),
        taskId: taskIdNum,
        subtaskId: created[0].id,
        userId: authUser.id,
        action: "subtask_created",
        newValue: title,
      }).run();

      return created[0];
    });

    return NextResponse.json({ subtask: result }, { status: 201 });
  } catch (error) {
    console.error("POST subtask error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
