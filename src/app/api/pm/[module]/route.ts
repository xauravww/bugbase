/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getModule } from "@/lib/modules/registry";
import {
  listRecords,
  coerceValues,
  buildCreateSchema,
  logActivity,
  canWriteProject,
} from "@/lib/modules/crud";
import { db } from "@/lib/db";

const RESERVED = new Set(["projectId", "search", "sort", "dir", "page", "limit"]);

// GET /api/pm/[module] — list with filter / sort / search / pagination.
export async function GET(request: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const { module: slug } = await ctx.params;
  const m = getModule(slug);
  if (!m) return NextResponse.json({ error: "Unknown module", code: "NOT_FOUND" }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const filters: Record<string, string> = {};
  for (const [k, v] of sp.entries()) {
    if (!RESERVED.has(k)) filters[k] = v;
  }

  try {
    const result = await listRecords(m, authUser.id, authUser.role, {
      projectId: sp.get("projectId") ? parseInt(sp.get("projectId")!) : undefined,
      search: sp.get("search") || undefined,
      sort: sp.get("sort") || undefined,
      dir: (sp.get("dir") as "asc" | "desc") || "desc",
      page: parseInt(sp.get("page") || "1"),
      limit: Math.min(parseInt(sp.get("limit") || "50"), 200),
      filters,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[pm/${slug}] list error:`, error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// POST /api/pm/[module] — create.
export async function POST(request: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

  const { module: slug } = await ctx.params;
  const m = getModule(slug);
  if (!m) return NextResponse.json({ error: "Unknown module", code: "NOT_FOUND" }, { status: 404 });

  try {
    const body = await request.json();
    const schema = buildCreateSchema(m);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message, code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const projectId = Number(parsed.data.projectId);
    if (!(await canWriteProject(authUser.id, authUser.role, projectId))) {
      return NextResponse.json({ error: "Not allowed for this project", code: "FORBIDDEN" }, { status: 403 });
    }

    const values = coerceValues(m, body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await db
      .insert(m.table as any)
      .values({ ...values, projectId, createdBy: authUser.id } as any)
      .returning()) as any[];
    const row = rows[0];

    const rec = row as Record<string, unknown>;
    await logActivity(projectId, slug, rec.id as number, authUser.id, `created ${m.singular.toLowerCase()}`);

    return NextResponse.json({ record: row }, { status: 201 });
  } catch (error) {
    console.error(`[pm/${slug}] create error:`, error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
