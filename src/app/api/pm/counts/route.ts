/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { MODULE_LIST } from "@/lib/modules/registry";
import { accessibleProjectIds } from "@/lib/modules/crud";
import { db } from "@/lib/db";
import { eq, inArray, sql, type SQL } from "drizzle-orm";

/**
 * GET /api/pm/counts?projectId=123
 *
 * Record count per module, in one round-trip. The workspace sidebar needs a
 * badge for every module, and hitting the list endpoint once per module would
 * mean ~19 requests just to render the nav.
 *
 * Omit projectId for counts across every project the caller can read. Scoping
 * matches listRecords: a projectId the caller has no access to falls back to
 * their accessible set rather than leaking a count.
 *
 * Returns: { counts: { [slug]: number } }
 */
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const allowed = await accessibleProjectIds(authUser.id, authUser.role);
    const empty = Object.fromEntries(MODULE_LIST.map((m) => [m.slug, 0]));
    if (allowed.length === 0) return NextResponse.json({ counts: empty });

    const requested = request.nextUrl.searchParams.get("projectId");
    const projectId = requested ? Number(requested) : undefined;
    const scoped = projectId !== undefined && !Number.isNaN(projectId) && allowed.includes(projectId);

    const results = await Promise.all(
      MODULE_LIST.map(async (m) => {
        // Tables come from the registry, so drizzle cannot infer the row type.
        const table = m.table as any;
        const projectCol = table.projectId as SQL & { name: string };
        const where = scoped ? eq(projectCol, projectId!) : inArray(projectCol, allowed);
        try {
          const rows = (await db
            .select({ c: sql<number>`count(*)`.mapWith(Number) })
            .from(table)
            .where(where)) as Array<{ c: number }>;
          return [m.slug, rows[0]?.c ?? 0] as const;
        } catch (error) {
          // One missing table must not blank out every other badge.
          console.error(`[pm/counts] ${m.slug} failed:`, error);
          return [m.slug, 0] as const;
        }
      })
    );

    return NextResponse.json({ counts: Object.fromEntries(results) });
  } catch (error) {
    console.error("[pm/counts] error:", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
