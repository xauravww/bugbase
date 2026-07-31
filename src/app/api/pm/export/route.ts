import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { accessibleProjectIds } from "@/lib/modules/crud";
import { ALL_EXPORT_SLUGS, collectExport, orderedSlugs } from "@/lib/modules/export";
import { renderPdf } from "@/lib/modules/export-pdf";
import { renderXlsx } from "@/lib/modules/export-xlsx";

export const runtime = "nodejs";

/**
 * GET /api/pm/export?projectId=1&format=pdf|excel&modules=bugs,features
 *
 * Whole-workspace export for one project. `modules` is optional — omit it to
 * export every module. Auth accepts the `token` query param (same as the
 * issues export) so the browser can open the download in a new tab.
 */
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const projectId = Number(sp.get("projectId"));
  if (!projectId || Number.isNaN(projectId)) {
    return NextResponse.json({ error: "projectId is required", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const allowed = await accessibleProjectIds(authUser.id, authUser.role);
  if (!allowed.includes(projectId)) {
    return NextResponse.json({ error: "Not allowed for this project", code: "FORBIDDEN" }, { status: 403 });
  }

  const format = (sp.get("format") || "pdf").toLowerCase();
  if (format !== "pdf" && format !== "excel") {
    return NextResponse.json({ error: "format must be pdf or excel", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  const requested = (sp.get("modules") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const slugs = orderedSlugs(requested.length ? requested : ALL_EXPORT_SLUGS);
  if (slugs.length === 0) {
    return NextResponse.json({ error: "No valid modules selected", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const me = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
      columns: { name: true, email: true },
    });

    const bundle = await collectExport(projectId, slugs, {
      generatedBy: me?.name || me?.email || `User #${authUser.id}`,
      // Explicit selections are honoured verbatim; the picker only offers
      // non-empty modules, so a chosen-but-empty one means "show it as empty".
      includeEmpty: requested.length > 0,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const base = `${bundle.project.key}_workspace_${stamp}`;

    if (format === "excel") {
      const buf = await renderXlsx(bundle);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${base}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buf = await renderPdf(bundle);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[pm/export] error:", error);
    return NextResponse.json({ error: "Failed to build export", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
