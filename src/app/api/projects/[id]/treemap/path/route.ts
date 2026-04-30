import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { treemapPaths } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { ERR, ensureProjectAccess, logContextActivity } from "@/lib/context-helpers";

const patchSchema = z.object({
  path: z.string().min(1),
  tested: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return ERR.unauth();
    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return ERR.validation(parsed.error.issues[0]?.message || "Invalid payload");

    const existing = await db.query.treemapPaths.findFirst({
      where: and(eq(treemapPaths.projectId, projectId), eq(treemapPaths.path, parsed.data.path)),
    });

    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: new Date(), updatedBy: authUser.id };
      if (parsed.data.tested !== undefined) {
        patch.tested = parsed.data.tested;
        patch.lastTestedAt = parsed.data.tested ? new Date() : null;
      }
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
      await db.update(treemapPaths).set(patch).where(eq(treemapPaths.id, existing.id));
    } else {
      await db.insert(treemapPaths).values({
        projectId,
        path: parsed.data.path,
        tested: !!parsed.data.tested,
        notes: parsed.data.notes ?? null,
        lastTestedAt: parsed.data.tested ? new Date() : null,
        updatedBy: authUser.id,
      });
    }

    await logContextActivity(projectId, null, authUser.id, "path_updated", parsed.data.path, parsed.data.tested ? "tested" : "untested");

    const fresh = await db.query.treemapPaths.findFirst({
      where: and(eq(treemapPaths.projectId, projectId), eq(treemapPaths.path, parsed.data.path)),
    });
    return NextResponse.json({ path: fresh });
  } catch (e) {
    console.error("[treemap path PATCH]", e);
    return ERR.internal();
  }
}
