import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contextEntries } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import { ERR, ensureProjectAccess, logContextActivity, syncEntryEmbedding, findSimilar } from "@/lib/context-helpers";

const KIND_VALUES = ["question", "answer", "note", "ingest", "ingest_chunk", "treemap", "task", "custom"] as const;
const STATUS_VALUES = ["active", "completed", "archived"] as const;

const createSchema = z.object({
  kind: z.enum(KIND_VALUES),
  title: z.string().max(500).optional(),
  body: z.string().min(1, "Body is required"),
  parentId: z.number().int().positive().optional(),
  source: z.enum(["user", "ai", "admin_pin"]).optional(),
  pinned: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  skipSimilarity: z.boolean().optional(),
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
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden("Not a project member");

    const sp = request.nextUrl.searchParams;
    const kind = sp.get("kind");
    const status = sp.get("status");
    const parentIdRaw = sp.get("parentId");
    const limit = Math.min(200, parseInt(sp.get("limit") || "100"));
    const page = parseInt(sp.get("page") || "1");
    const offset = (Math.max(1, page) - 1) * limit;

    const conditions = [eq(contextEntries.projectId, projectId)];
    if (kind && (KIND_VALUES as readonly string[]).includes(kind)) {
      conditions.push(eq(contextEntries.kind, kind as typeof KIND_VALUES[number]));
    }
    if (status && (STATUS_VALUES as readonly string[]).includes(status)) {
      conditions.push(eq(contextEntries.status, status as typeof STATUS_VALUES[number]));
    } else {
      // Default to active
      conditions.push(eq(contextEntries.status, "active"));
    }
    if (parentIdRaw) {
      const pid = parseInt(parentIdRaw);
      if (!isNaN(pid)) conditions.push(eq(contextEntries.parentId, pid));
    }

    const totalRow = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(contextEntries)
      .where(and(...conditions));
    const total = totalRow[0]?.count || 0;

    const rows = await db.query.contextEntries.findMany({
      where: and(...conditions),
      with: {
        creator: { columns: { id: true, name: true, email: true } },
      },
      orderBy: [desc(contextEntries.pinned), desc(contextEntries.updatedAt)],
      limit,
      offset,
    });

    return NextResponse.json({
      entries: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + rows.length < total,
        hasPrev: page > 1,
      },
    });
  } catch (e) {
    console.error("[context GET]", e);
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
    const { id } = await params;
    const projectId = parseInt(id);
    if (isNaN(projectId)) return ERR.invalidId();
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden("Not a project member");

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return ERR.validation(parsed.error.issues[0]?.message || "Invalid payload");

    const data = parsed.data;
    const isAdmin = authUser.role === "Admin";

    if (data.source === "admin_pin" && !isAdmin) return ERR.forbidden("Only admins can pin entries");
    if (data.source === "ai") return ERR.forbidden("Cannot create AI entries directly");
    if (data.pinned && !isAdmin) return ERR.forbidden("Only admins can pin entries");

    const similar = data.skipSimilarity ? [] : await findSimilar(projectId, `${data.title || ""}\n${data.body}`.trim(), 5);

    const inserted = await db
      .insert(contextEntries)
      .values({
        projectId,
        kind: data.kind,
        title: data.title || null,
        body: data.body,
        parentId: data.parentId || null,
        source: data.source || "user",
        pinned: !!data.pinned,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdBy: authUser.id,
      })
      .returning();
    const entry = inserted[0];

    await syncEntryEmbedding(entry.id, `${entry.title || ""}\n${entry.body}`.trim());
    await logContextActivity(projectId, entry.id, authUser.id, "created", null, entry.kind);

    return NextResponse.json({ entry, similar }, { status: 201 });
  } catch (e) {
    console.error("[context POST]", e);
    return ERR.internal();
  }
}
