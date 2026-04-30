import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contextEntries, treemapPaths } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { ERR, ensureProjectAccess, logContextActivity, syncEntryEmbedding } from "@/lib/context-helpers";
import { parseTree, flattenPaths } from "@/lib/treemap";

const postSchema = z.object({
  body: z.string().min(1),
  title: z.string().max(500).optional(),
});

export async function GET(
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

    const latest = await db.query.contextEntries.findFirst({
      where: and(eq(contextEntries.projectId, projectId), eq(contextEntries.kind, "treemap")),
      orderBy: desc(contextEntries.updatedAt),
      with: { creator: { columns: { id: true, name: true } } },
    });

    const paths = await db.query.treemapPaths.findMany({
      where: eq(treemapPaths.projectId, projectId),
    });

    const tree = latest ? parseTree(latest.body) : [];
    return NextResponse.json({ entry: latest || null, tree, paths });
  } catch (e) {
    console.error("[treemap GET]", e);
    return ERR.internal();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) return ERR.unauth();
    if (authUser.role !== "Admin") return ERR.forbidden("Only admins can replace treemap");
    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return ERR.validation(parsed.error.issues[0]?.message || "Invalid payload");

    const inserted = await db
      .insert(contextEntries)
      .values({
        projectId,
        kind: "treemap",
        title: parsed.data.title || "Codebase treemap",
        body: parsed.data.body,
        source: "user",
        createdBy: authUser.id,
      })
      .returning();
    const entry = inserted[0];

    const tree = parseTree(parsed.data.body);
    const allPaths = flattenPaths(tree);

    const existing = await db
      .select({ path: treemapPaths.path })
      .from(treemapPaths)
      .where(eq(treemapPaths.projectId, projectId));
    const existingSet = new Set(existing.map(r => r.path));

    const newPaths = allPaths.filter(p => !existingSet.has(p));
    if (newPaths.length > 0) {
      await db.insert(treemapPaths).values(
        newPaths.map(p => ({
          projectId,
          path: p,
          tested: false,
          updatedBy: authUser.id,
        }))
      );
    }

    await syncEntryEmbedding(entry.id, `Treemap snapshot with ${allPaths.length} paths`);
    await logContextActivity(projectId, entry.id, authUser.id, "treemap_replaced", null, String(allPaths.length));

    return NextResponse.json({ entry, tree, addedPaths: newPaths.length, totalPaths: allPaths.length }, { status: 201 });
  } catch (e) {
    console.error("[treemap POST]", e);
    return ERR.internal();
  }
}
