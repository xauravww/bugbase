import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// DELETE — revoke a token the caller owns (soft: sets revokedAt).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tokenId } = await params;
  const id = parseInt(tokenId);

  const row = await db.query.apiTokens.findFirst({
    where: and(eq(apiTokens.id, id), eq(apiTokens.userId, authUser.id)),
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, id)).run();
  return NextResponse.json({ success: true });
}
