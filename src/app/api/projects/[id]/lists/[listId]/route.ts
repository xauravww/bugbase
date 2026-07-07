import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lists, taskActivity } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string }> }
) {
  try {
    const { listId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await db.query.lists.findFirst({
      where: eq(lists.id, parseInt(listId)),
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

    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    return NextResponse.json({ list });
  } catch (error) {
    console.error("GET list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string }> }
) {
  try {
    const { id, listId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.color !== undefined) updates.color = body.color;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.archived !== undefined) updates.archived = body.archived;
    if (body.restore === true) updates.deletedAt = null;

    db.transaction((tx) => {
      tx.update(lists).set(updates).where(eq(lists.id, parseInt(listId))).run();
      tx.insert(taskActivity).values({
        projectId: parseInt(id),
        userId: authUser.id,
        action: body.restore === true ? "list_restored" : "list_updated",
        newValue: body.name || undefined,
      }).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string }> }
) {
  try {
    const { id, listId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await db.query.lists.findFirst({
      where: eq(lists.id, parseInt(listId)),
      columns: { name: true },
    });

    db.transaction((tx) => {
      // Soft delete — preserves ID for undo/restore
      tx.update(lists).set({ deletedAt: new Date() }).where(eq(lists.id, parseInt(listId))).run();
      tx.insert(taskActivity).values({
        projectId: parseInt(id),
        userId: authUser.id,
        action: "list_deleted",
        oldValue: list?.name || undefined,
      }).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
