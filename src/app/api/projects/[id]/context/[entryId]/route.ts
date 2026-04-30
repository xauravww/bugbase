import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contextEntries } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { ERR, ensureProjectAccess, logContextActivity, syncEntryEmbedding, deleteEntryEmbedding } from "@/lib/context-helpers";

const updateSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  body: z.string().min(1).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  pinned: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

async function loadEntry(projectId: number, entryId: number) {
  return db.query.contextEntries.findFirst({
    where: and(eq(contextEntries.id, entryId), eq(contextEntries.projectId, projectId)),
    with: { creator: { columns: { id: true, name: true, email: true } } },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return ERR.unauth();
    const { id, entryId } = await params;
    const projectId = parseInt(id);
    const eid = parseInt(entryId);
    if (isNaN(projectId) || isNaN(eid)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();
    const entry = await loadEntry(projectId, eid);
    if (!entry) return ERR.notFound();
    return NextResponse.json({ entry });
  } catch (e) {
    console.error("[context entry GET]", e);
    return ERR.internal();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return ERR.unauth();
    const { id, entryId } = await params;
    const projectId = parseInt(id);
    const eid = parseInt(entryId);
    if (isNaN(projectId) || isNaN(eid)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();

    const existing = await loadEntry(projectId, eid);
    if (!existing) return ERR.notFound();

    const isAdmin = authUser.role === "Admin";
    const isAuthor = existing.createdBy === authUser.id;
    if (!isAdmin && !isAuthor) return ERR.forbidden("Only author or admin can edit");
    if (existing.pinned && !isAdmin) return ERR.forbidden("Pinned entries are admin-only");

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return ERR.validation(parsed.error.issues[0]?.message || "Invalid payload");
    if (parsed.data.pinned !== undefined && !isAdmin) return ERR.forbidden("Only admins can change pinned");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.body !== undefined) patch.body = parsed.data.body;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.pinned !== undefined) patch.pinned = parsed.data.pinned;
    if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null;

    await db.update(contextEntries).set(patch).where(eq(contextEntries.id, eid));

    if (parsed.data.body !== undefined || parsed.data.title !== undefined) {
      const fresh = await loadEntry(projectId, eid);
      if (fresh) await syncEntryEmbedding(eid, `${fresh.title || ""}\n${fresh.body}`.trim());
    }
    await logContextActivity(projectId, eid, authUser.id, "updated");

    const updated = await loadEntry(projectId, eid);
    return NextResponse.json({ entry: updated });
  } catch (e) {
    console.error("[context entry PUT]", e);
    return ERR.internal();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return ERR.unauth();
    const { id, entryId } = await params;
    const projectId = parseInt(id);
    const eid = parseInt(entryId);
    if (isNaN(projectId) || isNaN(eid)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();

    const existing = await loadEntry(projectId, eid);
    if (!existing) return ERR.notFound();

    const isAdmin = authUser.role === "Admin";
    const isAuthor = existing.createdBy === authUser.id;
    if (!isAdmin && !isAuthor) return ERR.forbidden("Only author or admin can delete");
    if (existing.pinned && !isAdmin) return ERR.forbidden("Pinned entries are admin-only");

    await deleteEntryEmbedding(eid);
    await db.delete(contextEntries).where(eq(contextEntries.id, eid));
    await logContextActivity(projectId, null, authUser.id, "deleted", existing.kind);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[context entry DELETE]", e);
    return ERR.internal();
  }
}
