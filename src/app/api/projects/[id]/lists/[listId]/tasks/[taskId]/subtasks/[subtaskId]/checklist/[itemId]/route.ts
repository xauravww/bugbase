import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checklistItems } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string; subtaskId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.content !== undefined) updates.content = body.content;
    if (body.done !== undefined) updates.done = body.done;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.restore === true) updates.deletedAt = null;

    db.update(checklistItems).set(updates).where(eq(checklistItems.id, parseInt(itemId))).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH checklist item error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string; subtaskId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    db.update(checklistItems).set({ deletedAt: new Date() }).where(eq(checklistItems.id, parseInt(itemId))).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE checklist item error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
