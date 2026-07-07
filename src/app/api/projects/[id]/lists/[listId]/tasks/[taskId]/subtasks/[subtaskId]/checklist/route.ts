import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checklistItems } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listId: string; taskId: string; subtaskId: string }> }
) {
  try {
    const { subtaskId } = await params;
    const subtaskIdNum = parseInt(subtaskId);
    const authUser = getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { content } = await request.json();
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

    const existing = await db.query.checklistItems.findMany({
      where: eq(checklistItems.subtaskId, subtaskIdNum),
      columns: { sortOrder: true },
    });
    const maxSort = existing.length > 0 ? Math.max(...existing.map(c => c.sortOrder)) + 1 : 0;

    const created = db.insert(checklistItems).values({
      subtaskId: subtaskIdNum,
      content,
      sortOrder: maxSort,
    }).returning().all();

    return NextResponse.json({ item: created[0] }, { status: 201 });
  } catch (error) {
    console.error("POST checklist error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
