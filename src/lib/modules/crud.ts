/**
 * Generic CRUD engine shared by the PM catch-all API routes.
 *
 * Given a ModuleDef from the registry, it builds list / create / get /
 * update / delete operations with filtering, sorting, search, pagination,
 * project scoping and activity logging — no per-module code needed.
 */
import { db } from "@/lib/db";
import { projectMembers, projects } from "@/lib/db/schema";
import { pmActivity } from "@/lib/db/pm-schema";
import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { ModuleDef } from "./registry";
import { dateFields, numberFields, titleField } from "./registry";
import { z } from "zod";

type Col = ReturnType<typeof col>;
function col(m: ModuleDef, key: string) {
  // drizzle table columns are accessible by property name
  return (m.table as unknown as Record<string, unknown>)[key] as SQL & { name: string };
}

/** Project IDs the user may read. Admins see all non-archived projects. */
export async function accessibleProjectIds(userId: number, role: string): Promise<number[]> {
  if (role === "Admin") {
    const rows = await db.select({ id: projects.id }).from(projects).where(eq(projects.archived, false));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ pid: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  return rows.map((r) => r.pid);
}

export interface ListParams {
  projectId?: number;
  search?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page: number;
  limit: number;
  /** arbitrary field=value filters, e.g. { status: "Open", priority: "High" } */
  filters: Record<string, string>;
}

export async function listRecords(
  m: ModuleDef,
  userId: number,
  role: string,
  params: ListParams
) {
  const allowed = await accessibleProjectIds(userId, role);
  if (allowed.length === 0) {
    return { records: [], pagination: { page: params.page, limit: params.limit, total: 0, totalPages: 0 } };
  }

  const projectCol = col(m, "projectId");
  const conds: SQL[] = [];

  if (params.projectId && allowed.includes(params.projectId)) {
    conds.push(eq(projectCol, params.projectId));
  } else {
    conds.push(inArray(projectCol, allowed));
  }

  // Search across the title column.
  if (params.search) {
    const tKey = titleField(m);
    conds.push(like(col(m, tKey), `%${params.search}%`) as SQL);
  }

  // Field filters — only for known columns; support comma = IN.
  const fieldKeys = new Set(m.fields.map((f) => f.key));
  for (const [k, v] of Object.entries(params.filters)) {
    if (!fieldKeys.has(k) || !v) continue;
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      conds.push(inArray(col(m, k), parts));
    } else {
      conds.push(eq(col(m, k), parts[0]));
    }
  }

  const where = and(...conds);

  // Sorting.
  const sortKey = params.sort && fieldKeys.has(params.sort) ? params.sort : (m.defaultSort ?? "createdAt");
  const sortCol = col(m, sortKey);
  const orderBy = params.dir === "asc" ? asc(sortCol) : desc(sortCol);

  const offset = (params.page - 1) * params.limit;
  // Table is resolved dynamically from the registry, so drizzle can't infer
  // its row type here — cast through `any` at these generic call sites only.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const table = m.table as any;

  const records = await db
    .select()
    .from(table)
    .where(where)
    .orderBy(orderBy)
    .limit(params.limit)
    .offset(offset);

  const countRows = (await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(table)
    .where(where)) as Array<{ c: number }>;
  const total = countRows[0]?.c ?? 0;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return {
    records,
    pagination: { page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) },
  };
}

/** Coerce incoming JSON body into typed column values for a module. */
export function coerceValues(m: ModuleDef, body: Record<string, unknown>) {
  const dates = new Set(dateFields(m));
  const nums = new Set(numberFields(m));
  const out: Record<string, unknown> = {};
  for (const f of m.fields) {
    if (!(f.key in body)) continue;
    let v = body[f.key];
    if (v === "" || v === undefined) v = null;
    if (v !== null && dates.has(f.key)) v = new Date(v as string);
    if (v !== null && (nums.has(f.key) || f.type === "relation")) {
      const n = Number(v);
      v = Number.isNaN(n) ? null : n;
    }
    out[f.key] = v;
  }
  return out;
}

/** Zod schema built from the registry for create validation. */
export function buildCreateSchema(m: ModuleDef) {
  const shape: Record<string, z.ZodTypeAny> = { projectId: z.number() };
  for (const f of m.fields) {
    let s: z.ZodTypeAny;
    if (f.type === "number" || f.type === "relation") s = z.union([z.number(), z.string(), z.null()]);
    else s = z.union([z.string(), z.null()]);
    shape[f.key] = f.required ? s : s.optional().nullable();
  }
  return z.object(shape).passthrough();
}

export async function logActivity(
  projectId: number,
  moduleSlug: string,
  entityId: number,
  userId: number,
  action: string,
  detail?: string
) {
  try {
    await db.insert(pmActivity).values({ projectId, module: moduleSlug, entityId, userId, action, detail });
  } catch {
    // activity logging is best-effort; never block the write.
  }
}

export async function canWriteProject(userId: number, role: string, projectId: number): Promise<boolean> {
  if (role === "Admin") return true;
  if (role === "Viewer") return false;
  const m = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
  });
  return !!m;
}

export { col, or };
