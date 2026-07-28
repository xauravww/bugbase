import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { workLogs } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const log = await db.query.workLogs.findFirst({ where: eq(workLogs.id, Number(id)) });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (log.userId !== authUser.id && authUser.role !== "Admin") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { content } = await request.json();
  if (!content || !String(content).trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const [updated] = await db
    .update(workLogs)
    .set({ content: String(content).trim(), updatedAt: new Date() })
    .where(and(eq(workLogs.id, Number(id))))
    .returning();

  return NextResponse.json({ log: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const log = await db.query.workLogs.findFirst({ where: eq(workLogs.id, Number(id)) });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (log.userId !== authUser.id && authUser.role !== "Admin") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  await db.delete(workLogs).where(eq(workLogs.id, Number(id)));
  return NextResponse.json({ success: true });
}
