import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { ERR, ensureProjectAccess, findSimilar } from "@/lib/context-helpers";

const schema = z.object({
  text: z.string().min(1),
  k: z.number().int().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

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
    if (!(await ensureProjectAccess(projectId, authUser.id, authUser.role))) return ERR.forbidden();

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return ERR.validation(parsed.error.issues[0]?.message || "Invalid payload");

    const hits = await findSimilar(projectId, parsed.data.text, parsed.data.k || 5, parsed.data.threshold ?? 0.78);
    return NextResponse.json({ similar: hits });
  } catch (e) {
    console.error("[context similar]", e);
    return ERR.internal();
  }
}
