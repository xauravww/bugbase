/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getModule } from "@/lib/modules/registry";
import { coerceValues, logActivity, canWriteProject, col } from "@/lib/modules/crud";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

async function loadRecord(slug: string, id: number) {
  const m = getModule(slug);
  if (!m) return { m: null, row: null };
  const rows = await db
    .select()
    .from(m.table as any)
    .where(eq(col(m, "id"), id))
    .limit(1);
  return { m, row: (rows[0] as Record<string, unknown>) || null };
}

// GET /api/pm/[module]/[id]
export async function GET(request: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const { module: slug, id } = await ctx.params;
  const { m, row } = await loadRecord(slug, parseInt(id));
  if (!m) return NextResponse.json({ error: "Unknown module", code: "NOT_FOUND" }, { status: 404 });
  if (!row) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ record: row });
}

// PATCH /api/pm/[module]/[id] — update.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const { module: slug, id } = await ctx.params;
  const { m, row } = await loadRecord(slug, parseInt(id));
  if (!m) return NextResponse.json({ error: "Unknown module", code: "NOT_FOUND" }, { status: 404 });
  if (!row) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const projectId = row.projectId as number;
  if (!(await canWriteProject(authUser.id, authUser.role, projectId))) {
    return NextResponse.json({ error: "Not allowed", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const values = coerceValues(m, body);
    // touch updatedAt when the column exists
    if (m.fields.length && "updatedAt" in (m.table as object)) {
      (values as Record<string, unknown>).updatedAt = new Date();
    }
    const updated = (await (db
      .update(m.table as any)
      .set(values as any)
      .where(eq(col(m, "id"), parseInt(id)))
      .returning() as Promise<unknown[]>))[0];

    await logActivity(projectId, slug, parseInt(id), authUser.id, `updated ${m.singular.toLowerCase()}`);
    return NextResponse.json({ record: updated });
  } catch (error) {
    console.error(`[pm/${slug}] update error:`, error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// DELETE /api/pm/[module]/[id]
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ module: string; id: string }> }) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const { module: slug, id } = await ctx.params;
  const { m, row } = await loadRecord(slug, parseInt(id));
  if (!m) return NextResponse.json({ error: "Unknown module", code: "NOT_FOUND" }, { status: 404 });
  if (!row) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });

  const projectId = row.projectId as number;
  if (!(await canWriteProject(authUser.id, authUser.role, projectId))) {
    return NextResponse.json({ error: "Not allowed", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await db.delete(m.table as any).where(eq(col(m, "id"), parseInt(id)));
    await logActivity(projectId, slug, parseInt(id), authUser.id, `deleted ${m.singular.toLowerCase()}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[pm/${slug}] delete error:`, error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
